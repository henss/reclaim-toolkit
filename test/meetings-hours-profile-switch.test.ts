import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  meetingsHours,
  parseReclaimHoursPresetSwitchPreviewInput
} from "../src/index.js";
import { runNpmCli } from "./cli-test-helpers.js";

describe("meetings-hours profile switch preview", () => {
  test("previews preset changes across synthetic profiles", () => {
    const raw = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), "examples", "meetings-hours-profile-switch.example.json"),
        "utf8"
      )
    ) as unknown;

    const preview = meetingsHours.previewPresetSwitches(
      parseReclaimHoursPresetSwitchPreviewInput(raw)
    );

    expect(preview).toMatchObject({
      profileCount: 3,
      currentProfileId: "profile-workweek",
      readSafety: "read_only",
      previewReceipt: {
        operation: "hours.switch.preview",
        readinessStatus: "read_only_boundary"
      }
    });
    expect(Date.parse(preview.previewReceipt.previewGeneratedAt)).not.toBeNaN();
    expect(preview.profiles.find((profile) => profile.id === "profile-workweek")).toMatchObject({
      isCurrentProfile: true,
      selectedPolicy: {
        id: "policy-work",
        title: "Work Hours"
      },
      selectionReason: 'Matched preferred Reclaim time policy title "Work Hours".'
    });
    expect(preview.switchPreviews).toEqual([
      {
        targetProfileId: "profile-deep-work",
        targetProfileTitle: "Deep Work Sprint",
        outcome: "different_policy",
        currentPolicyId: "policy-work",
        currentPolicyTitle: "Work Hours",
        targetPolicyId: "policy-deep-work",
        targetPolicyTitle: "Deep Work",
        summary: "Switching to Deep Work Sprint changes the hours preset from Work Hours to Deep Work."
      },
      {
        targetProfileId: "profile-weekend-personal",
        targetProfileTitle: "Weekend Personal",
        outcome: "different_policy",
        currentPolicyId: "policy-work",
        currentPolicyTitle: "Work Hours",
        targetPolicyId: "policy-personal",
        targetPolicyTitle: "Personal Hours",
        summary:
          "Switching to Weekend Personal changes the hours preset from Work Hours to Personal Hours."
      }
    ]);
  });

  test("emits parseable JSON for the profile-switch CLI preview", () => {
    const result = runNpmCli([
      "reclaim:meetings-hours:preview-switch",
      "--",
      "--input",
      path.join("examples", "meetings-hours-profile-switch.example.json")
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      currentProfileId: string;
      profiles: Array<{ id: string; isCurrentProfile: boolean; selectedPolicy?: { id: string } }>;
      switchPreviews: Array<{ targetProfileId: string; outcome: string }>;
      readSafety: string;
      previewReceipt: { operation: string; readinessStatus: string; previewGeneratedAt: string };
    };
    expect(output.currentProfileId).toBe("profile-workweek");
    expect(output.readSafety).toBe("read_only");
    expect(output.previewReceipt.operation).toBe("hours.switch.preview");
    expect(output.previewReceipt.readinessStatus).toBe("read_only_boundary");
    expect(Date.parse(output.previewReceipt.previewGeneratedAt)).not.toBeNaN();
    expect(output.profiles.find((profile) => profile.id === "profile-workweek")).toMatchObject({
      isCurrentProfile: true,
      selectedPolicy: { id: "policy-work" }
    });
    expect(output.switchPreviews).toMatchObject([
      {
        targetProfileId: "profile-deep-work",
        outcome: "different_policy"
      },
      {
        targetProfileId: "profile-weekend-personal",
        outcome: "different_policy"
      }
    ]);
  });
});
