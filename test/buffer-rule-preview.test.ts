import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  bufferRules,
  parseReclaimBufferRulePreviewInput
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function expectProtectedTimeWindowDiff(
  diff: {
    status: string;
    selectedPolicy?: { id: string; title: string };
    diffSummary: {
      fitDays: number;
      partialDays: number;
      outsideWindowDays: number;
      uncheckedDays: number;
    };
    diffLines: string[];
  } | undefined,
  options: {
    status: string;
    selectedPolicy?: { id: string; title: string };
    diffSummary: {
      fitDays: number;
      partialDays: number;
      outsideWindowDays: number;
      uncheckedDays: number;
    };
    expectedLines: string[];
  }
): void {
  expect(diff).toMatchObject({
    status: options.status,
    diffSummary: options.diffSummary
  });
  if (options.selectedPolicy) {
    expect(diff?.selectedPolicy).toMatchObject(options.selectedPolicy);
  }

  for (const line of options.expectedLines) {
    expect(diff?.diffLines).toContain(line);
  }
}

function expectUpdatedMeetingRecoveryRule(
  rule: {
    ruleId: string;
    currentBuffer?: {
      title: string;
      request: { durationMinutes: number; placement: string; anchor: string };
    };
    mockResponse: { mode: string; action: string };
    previewReceipt: {
      operation: string;
      action: string;
      status: string;
      diffSummary: { changed: number; added: number; removed: number };
      diffLines: string[];
      protectedTimeWindowDiff?: {
        status: string;
        selectedPolicy?: { id: string; title: string };
        diffSummary: {
          fitDays: number;
          partialDays: number;
          outsideWindowDays: number;
          uncheckedDays: number;
        };
        diffLines: string[];
      };
    };
  }
): void {
  expect(rule).toMatchObject({
    ruleId: "meeting-recovery-default",
    currentBuffer: {
      title: "Weekly project sync recovery",
      request: {
        durationMinutes: 10,
        placement: "after",
        anchor: "Weekly project sync"
      }
    },
    mockResponse: {
      mode: "mock_reclaim_buffer_rule_preview",
      action: "update"
    },
    previewReceipt: {
      operation: "buffer.rule.preview",
      action: "update",
      status: "mock_preview_diff_recorded",
      diffSummary: {
        changed: 2,
        added: 0,
        removed: 0
      }
    }
  });
  expect(rule.previewReceipt.diffLines).toContain("- durationMinutes: 10");
  expect(rule.previewReceipt.diffLines).toContain("+ durationMinutes: 15");
  expect(rule.previewReceipt.diffLines).toContain("  placement: after");
  expectProtectedTimeWindowDiff(rule.previewReceipt.protectedTimeWindowDiff, {
    status: "partial",
    selectedPolicy: {
      id: "policy-work",
      title: "Work Hours"
    },
    diffSummary: {
      fitDays: 1,
      partialDays: 1,
      outsideWindowDays: 0,
      uncheckedDays: 0
    },
    expectedLines: [
      "+ tuesday: 30 overlapping minute(s) inside protected windows 11:00-12:30",
      "~ thursday: 10 overlapping minute(s), below the 15-minute requirement, inside protected windows 11:50-12:00"
    ]
  });
}

function expectCreatedTransitionRule(
  rule: {
    ruleId: string;
    currentBuffer?: { title: string } | undefined;
    mockResponse: { action: string };
    previewReceipt: {
      action: string;
      diffSummary: { added: number; changed: number; removed: number; unchanged: number };
      diffLines: string[];
      protectedTimeWindowDiff?: {
        status: string;
        diffSummary: {
          fitDays: number;
          partialDays: number;
          outsideWindowDays: number;
          uncheckedDays: number;
        };
        diffLines: string[];
      };
    };
  }
): void {
  expect(rule).toMatchObject({
    ruleId: "deep-work-transition",
    currentBuffer: undefined,
    mockResponse: {
      action: "create"
    },
    previewReceipt: {
      action: "create",
      diffSummary: {
        added: 9,
        changed: 0,
        removed: 0,
        unchanged: 0
      }
    }
  });
  expect(rule.previewReceipt.diffLines).toContain("+ anchor: Design review block");
  expectProtectedTimeWindowDiff(rule.previewReceipt.protectedTimeWindowDiff, {
    status: "outside_window",
    diffSummary: {
      fitDays: 0,
      partialDays: 0,
      outsideWindowDays: 2,
      uncheckedDays: 0
    },
    expectedLines: [
      "- tuesday: no overlap against protected windows 11:00-12:30"
    ]
  });
}

describe("buffer rule preview", () => {
  test("parses and previews synthetic buffer rules with diff-style receipts", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "buffer-rules.example.json"), "utf8")
    ) as unknown;

    const parsed = parseReclaimBufferRulePreviewInput(raw);
    const preview = bufferRules.preview(parsed);

    expect(parsed.rules).toHaveLength(2);
    expect(parsed.currentBuffers).toHaveLength(1);
    expect(preview).toMatchObject({
      ruleCount: 2,
      writeSafety: "preview_only"
    });
    expectUpdatedMeetingRecoveryRule(preview.rules[0]!);
    expectCreatedTransitionRule(preview.rules[1]!);
  });

  test("rejects invalid buffer rule windows", () => {
    expect(() =>
      parseReclaimBufferRulePreviewInput({
        rules: [
          {
            ruleId: "bad-window",
            title: "Invalid buffer",
            durationMinutes: 10,
            anchor: "Generic review block",
            windowStart: "16:00",
            windowEnd: "15:00"
          }
        ]
      })
    ).toThrow("windowEnd must be later than windowStart.");
  });

  test("emits parseable JSON for the buffer rule preview CLI command", () => {
    const result = runNpmCli([
      "reclaim:buffers:preview-rule",
      "--",
      "--input",
      path.join("examples", "buffer-rules.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      ruleCount: number;
      writeSafety: string;
      rules: Array<{
        ruleId: string;
        mockResponse: { action: string };
        previewReceipt: {
          operation: string;
          diffLines: string[];
          protectedTimeWindowDiff?: {
            status: string;
            diffLines: string[];
          };
        };
      }>;
    };
    expect(output.ruleCount).toBe(2);
    expect(output.writeSafety).toBe("preview_only");
    expect(output.rules[0]?.ruleId).toBe("meeting-recovery-default");
    expect(output.rules[0]?.mockResponse.action).toBe("update");
    expect(output.rules[0]?.previewReceipt.operation).toBe("buffer.rule.preview");
    expect(output.rules[0]?.previewReceipt.diffLines).toContain("- durationMinutes: 10");
    expect(output.rules[0]?.previewReceipt.protectedTimeWindowDiff?.status).toBe("partial");
  });
});
