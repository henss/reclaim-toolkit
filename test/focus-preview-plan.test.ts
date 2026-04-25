import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { focus, parseReclaimFocusPreviewInput } from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

function loadFocusFixture(): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "examples", "focus-and-buffers.example.json"), "utf8")
  ) as unknown;
}

describe("focus preview planning diffs", () => {
  test("emits explicit create, update, unchanged, and remove diff receipts from a synthetic baseline", () => {
    const input = parseReclaimFocusPreviewInput(loadFocusFixture());
    const preview = focus.previewCreates(input.focusBlocks, {
      currentFocusBlocks: input.currentFocusBlocks,
      timePolicyContext: {
        timeSchemes: input.timeSchemes,
        defaultTaskEventCategory: input.defaultTaskEventCategory ?? "WORK",
        preferredTimePolicyId: input.preferredTimePolicyId,
        preferredTimePolicyTitle: input.preferredTimePolicyTitle
      }
    });

    expect(preview).toMatchObject({
      focusBlockCount: 3,
      currentFocusBlockCount: 3,
      planDiffSummary: {
        added: 9,
        changed: 3,
        removed: 9,
        unchanged: 19
      }
    });
    expect(preview.focusBlocks.map((focusBlock) => [focusBlock.title, focusBlock.planDiff.action])).toEqual([
      ["Prototype review block", "unchanged"],
      ["Documentation drafting block", "update"],
      ["Inbox triage block", "create"]
    ]);
    expect(preview.focusBlocks[0]?.planDiff.diffLines).toContain("  title: Prototype review block");
    expect(preview.focusBlocks[1]?.planDiff.diffLines).toContain("- durationMinutes: 45");
    expect(preview.focusBlocks[1]?.planDiff.diffLines).toContain("+ durationMinutes: 60");
    expect(preview.focusBlocks[1]?.planDiff.diffLines).toContain("- windowStart: 12:00");
    expect(preview.focusBlocks[1]?.planDiff.diffLines).toContain("+ windowEnd: 15:00");
    expect(preview.focusBlocks[2]?.planDiff.diffLines).toContain("+ title: Inbox triage block");
    expect(preview.removedFocusBlocks).toHaveLength(1);
    expect(preview.removedFocusBlocks[0]).toMatchObject({
      title: "Weekly review follow-up block",
      planDiff: {
        action: "remove"
      }
    });
    expect(preview.removedFocusBlocks[0]?.planDiff.diffLines).toContain("- title: Weekly review follow-up block");
  });

  test("emits parseable JSON diff receipts for the focus preview CLI", () => {
    const result = runNpmCli([
      "reclaim:focus:preview-create",
      "--",
      "--input",
      path.join("examples", "focus-and-buffers.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      currentFocusBlockCount: number;
      planDiffSummary: { added: number; changed: number; removed: number; unchanged: number };
      focusBlocks: Array<{ title: string; planDiff: { action: string; diffLines: string[] } }>;
      removedFocusBlocks: Array<{ title: string; planDiff: { action: string; diffLines: string[] } }>;
    };

    expect(output.currentFocusBlockCount).toBe(3);
    expect(output.planDiffSummary).toEqual({
      added: 9,
      changed: 3,
      removed: 9,
      unchanged: 19
    });
    expect(output.focusBlocks[0]?.planDiff.action).toBe("unchanged");
    expect(output.focusBlocks[1]?.planDiff.action).toBe("update");
    expect(output.focusBlocks[2]?.planDiff.action).toBe("create");
    expect(output.focusBlocks[1]?.planDiff.diffLines).toContain("- durationMinutes: 45");
    expect(output.focusBlocks[2]?.planDiff.diffLines).toContain("+ title: Inbox triage block");
    expect(output.removedFocusBlocks[0]?.planDiff.action).toBe("remove");
    expect(output.removedFocusBlocks[0]?.planDiff.diffLines).toContain("- title: Weekly review follow-up block");
  });
});
