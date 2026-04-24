import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  meetingsHours,
  parseReclaimMeetingsAndHoursSnapshot
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

describe("meetings-hours preview inspect", () => {
  test("adds a preview receipt to the local inspect helper", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "examples", "meetings-and-hours.example.json"), "utf8")
    ) as unknown;

    const preview = meetingsHours.previewInspectSnapshot(parseReclaimMeetingsAndHoursSnapshot(raw));

    expect(preview).toMatchObject({
      meetingCount: 2,
      hourPolicyCount: 2,
      readSafety: "read_only",
      previewReceipt: {
        operation: "hours.inspect.preview",
        readinessStatus: "read_only_boundary"
      }
    });
    expect(Date.parse(preview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
  });

  test("emits the preview receipt through the meetings-hours preview inspect CLI", () => {
    const result = runNpmCli([
      "reclaim:meetings-hours:preview-inspect",
      "--",
      "--input",
      path.join("examples", "meetings-and-hours.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      readSafety: string;
      previewReceipt: {
        operation: string;
        readinessStatus: string;
        previewGeneratedAt: string;
      };
    };
    expect(output.readSafety).toBe("read_only");
    expect(output.previewReceipt.operation).toBe("hours.inspect.preview");
    expect(output.previewReceipt.readinessStatus).toBe("read_only_boundary");
    expect(Date.parse(output.previewReceipt.previewGeneratedAt)).not.toBeNaN();
  });
});
