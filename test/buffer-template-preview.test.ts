import fs from "node:fs";
import path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  bufferTemplates,
  buffers,
  focus,
  parseReclaimBufferInputs,
  parseReclaimBufferPreviewInput,
  parseReclaimBufferTemplateInputs,
  parseReclaimFocusInputs,
  parseReclaimFocusPreviewInput
} from "../src/index.js";

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpmCli(args: string[]): SpawnSyncReturns<string> {
  if (process.platform === "win32") {
    return spawnSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", ["npm", "run", "--silent", ...args].join(" ")],
      {
        cwd: process.cwd(),
        encoding: "utf8"
      }
    );
  }

  return spawnSync(npmCommand(), ["run", "--silent", ...args], {
    cwd: process.cwd(),
    encoding: "utf8"
  });
}

function loadFocusAndBufferFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "focus-and-buffers.example.json"), "utf8")
  ) as unknown;
}

function expectFocusAndBufferTimePolicyExplanations(
  focusBlocks: Array<{
    timePolicyExplanation?: {
      title: string;
      status: string;
      selectedPolicy?: { id: string; title?: string };
      checkedDays?: string[];
    };
  }>,
  buffers: Array<{
    timePolicyExplanation?: {
      title: string;
      status: string;
      selectedPolicy?: { id: string; title?: string };
      checkedDays?: string[];
    };
  }>
): void {
  expect(focusBlocks[0]?.timePolicyExplanation).toMatchObject({
    title: "Prototype review block",
    status: "fit",
    selectedPolicy: {
      id: "policy-work",
      title: "Work Hours"
    },
    checkedDays: ["tuesday"]
  });
  expect(buffers[0]?.timePolicyExplanation).toMatchObject({
    title: "Post-review notes buffer",
    status: "fit",
    selectedPolicy: {
      id: "policy-work"
    },
    checkedDays: ["tuesday", "thursday"]
  });
  expect(buffers[1]?.timePolicyExplanation).toMatchObject({
    title: "Context switch buffer",
    status: "fit",
    selectedPolicy: {
      id: "policy-personal"
    },
    checkedDays: ["monday", "friday"]
  });
}

describe("focus and buffers", () => {
  test("parses and previews the synthetic focus and buffer fixture without write capability", () => {
    const raw = loadFocusAndBufferFixture();
    const parsedFocusBlocks = parseReclaimFocusInputs(raw);
    const parsedBuffers = parseReclaimBufferInputs(raw);
    const focusPreview = focus.previewCreates(parsedFocusBlocks);
    const bufferPreview = buffers.previewCreates(parsedBuffers);

    expect(parsedFocusBlocks).toHaveLength(2);
    expect(parsedBuffers).toHaveLength(2);
    expect(focusPreview).toMatchObject({
      focusBlockCount: 2,
      writeSafety: "preview_only",
      previewReceipt: {
        operation: "focus.preview",
        readinessStatus: "evidence_pending"
      }
    });
    expect(bufferPreview).toMatchObject({
      bufferCount: 2,
      writeSafety: "preview_only",
      previewReceipt: {
        operation: "buffer.preview",
        readinessStatus: "evidence_pending"
      }
    });
    expect(Date.parse(focusPreview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
    expect(Date.parse(bufferPreview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
    expect(focusPreview.focusBlocks[0]?.request).toMatchObject({
      title: "Prototype review block",
      eventCategory: "WORK",
      cadence: "weekly",
      daysOfWeek: ["tuesday"],
      alwaysPrivate: true
    });
    expect(bufferPreview.buffers[0]?.request).toMatchObject({
      title: "Post-review notes buffer",
      eventCategory: "WORK",
      placement: "after",
      anchor: "Prototype review block",
      alwaysPrivate: true
    });
  });
});

describe("focus and buffer time-policy explanations", () => {
  test("adds time-policy explanations to focus and buffer previews when synthetic policy context is provided", () => {
    const focusInput = parseReclaimFocusPreviewInput(loadFocusAndBufferFixture());
    const bufferInput = parseReclaimBufferPreviewInput(loadFocusAndBufferFixture());
    const focusPreview = focus.previewCreates(focusInput.focusBlocks, {
      timePolicyContext: {
        timeSchemes: focusInput.timeSchemes,
        defaultTaskEventCategory: focusInput.defaultTaskEventCategory ?? "WORK",
        preferredTimePolicyId: focusInput.preferredTimePolicyId,
        preferredTimePolicyTitle: focusInput.preferredTimePolicyTitle
      }
    });
    const bufferPreview = buffers.previewCreates(bufferInput.buffers, {
      timePolicyContext: {
        timeSchemes: bufferInput.timeSchemes,
        defaultTaskEventCategory: bufferInput.defaultTaskEventCategory ?? "PERSONAL",
        preferredTimePolicyId: bufferInput.preferredTimePolicyId,
        preferredTimePolicyTitle: bufferInput.preferredTimePolicyTitle
      }
    });

    expectFocusAndBufferTimePolicyExplanations(focusPreview.focusBlocks, bufferPreview.buffers);
  });

  test("emits parseable JSON with time-policy explanations for focus and buffer preview CLIs", () => {
    const focusResult = runNpmCli([
      "reclaim:focus:preview-create",
      "--",
      "--input",
      path.join("examples", "focus-and-buffers.example.json")
    ]);
    const bufferResult = runNpmCli([
      "reclaim:buffers:preview-create",
      "--",
      "--input",
      path.join("examples", "focus-and-buffers.example.json")
    ]);

    expect(focusResult.status).toBe(0);
    expect(focusResult.stderr).toBe("");
    expect(bufferResult.status).toBe(0);
    expect(bufferResult.stderr).toBe("");

    const focusOutput = JSON.parse(focusResult.stdout) as {
      focusBlocks: Array<{
        timePolicyExplanation?: {
          title: string;
          status: string;
          selectedPolicy?: { id: string; title?: string };
          checkedDays?: string[];
        };
      }>;
    };
    const bufferOutput = JSON.parse(bufferResult.stdout) as {
      buffers: Array<{
        timePolicyExplanation?: {
          title: string;
          status: string;
          selectedPolicy?: { id: string; title?: string };
          checkedDays?: string[];
        };
      }>;
    };

    expectFocusAndBufferTimePolicyExplanations(focusOutput.focusBlocks, bufferOutput.buffers);
  });

  test("rejects ambiguous focus and buffer inputs", () => {
    expect(() =>
      parseReclaimFocusInputs({
        focusBlocks: [
          {
            title: "Weekly review block",
            durationMinutes: 60,
            cadence: "weekly"
          }
        ]
      })
    ).toThrow("Weekly focus blocks require at least one dayOfWeek.");

    expect(() =>
      parseReclaimFocusInputs({
        focusBlocks: [
          {
            title: "Daily review block",
            durationMinutes: 30,
            cadence: "daily",
            daysOfWeek: ["monday"]
          }
        ]
      })
    ).toThrow("Daily focus blocks should omit daysOfWeek.");

    expect(() =>
      parseReclaimBufferInputs({
        buffers: [
          {
            title: "Transition buffer",
            durationMinutes: 15,
            anchor: "Generic review",
            windowStart: "14:00",
            windowEnd: "13:00"
          }
        ]
      })
    ).toThrow("windowEnd must be later than windowStart.");
  });
});

describe("buffer template preview helper", () => {
  test("parses and previews synthetic buffer templates with mock receipts", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "buffer-templates.example.json"), "utf8")
    ) as unknown;

    const parsedTemplates = parseReclaimBufferTemplateInputs(raw);
    const preview = bufferTemplates.preview(parsedTemplates);

    expect(parsedTemplates).toHaveLength(2);
    expect(preview).toMatchObject({
      templateCount: 2,
      writeSafety: "preview_only"
    });
    expect(preview.templates[0]).toMatchObject({
      template: "meeting_recovery",
      title: "Meeting recovery buffer",
      request: {
        placement: "after",
        anchor: "Weekly project sync",
        durationMinutes: 15,
        eventCategory: "WORK"
      },
      mockResponse: {
        previewId: "buffer-template-preview-1",
        mode: "mock_reclaim_buffer_preview",
        status: "preview_ready"
      },
      previewReceipt: {
        operation: "buffer.preview",
        previewId: "buffer-template-preview-1",
        template: "meeting_recovery",
        status: "mock_preview_recorded"
      }
    });
    expect(preview.templates[1]).toMatchObject({
      template: "transition_time",
      title: "Mode switch buffer",
      request: {
        placement: "between",
        anchor: "Documentation drafting block",
        durationMinutes: 12
      }
    });
  });

  test("rejects invalid template windows", () => {
    expect(() =>
      parseReclaimBufferTemplateInputs({
        templates: [
          {
            template: "meeting_recovery",
            anchor: "Weekly project sync",
            windowStart: "16:00",
            windowEnd: "15:00"
          }
        ]
      })
    ).toThrow("windowEnd must be later than windowStart.");
  });

  test("emits parseable JSON for the template preview CLI command", () => {
    const result = runNpmCli([
      "reclaim:buffers:preview-template",
      "--",
      "--input",
      path.join("examples", "buffer-templates.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      templateCount: number;
      writeSafety: string;
      templates: Array<{
        template: string;
        mockResponse: { mode: string };
        previewReceipt: { operation: string };
      }>;
    };
    expect(output.templateCount).toBe(2);
    expect(output.writeSafety).toBe("preview_only");
    expect(output.templates[0]?.template).toBe("meeting_recovery");
    expect(output.templates[0]?.mockResponse.mode).toBe("mock_reclaim_buffer_preview");
    expect(output.templates[0]?.previewReceipt.operation).toBe("buffer.preview");
  });
});
