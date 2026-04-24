import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getReclaimCliHelp } from "../src/cli-help.js";
import {
  getReclaimCommandSafetyManifest,
  reclaimCommandDefinitions,
  type ReclaimCommandSafetyManifest
} from "../src/command-safety-manifest.js";

describe("command safety manifest", () => {
  test("matches the committed public artifact", () => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "docs", "command-safety-manifest.json"), "utf8")
    ) as ReclaimCommandSafetyManifest;

    expect(committed).toEqual(getReclaimCommandSafetyManifest());
  });

  test("keeps help visibility aligned with manifest defaults", () => {
    const defaultHelp = getReclaimCliHelp();
    const defaultCommands = defaultHelp.groups.flatMap((group) => group.commands.map((command) => command.command));

    expect(defaultCommands).toEqual(
      reclaimCommandDefinitions.filter((definition) => definition.includeByDefault).map((definition) => definition.command)
    );
  });

  test("records explicit review points for public-distribution changes", () => {
    const manifest = getReclaimCommandSafetyManifest();

    expect(manifest.explicitReviewPoints).toEqual([
      "Package publication requires explicit review.",
      "Release automation requires explicit review.",
      "License changes require explicit review.",
      "Broader API commitments require explicit review."
    ]);
    expect(manifest.commands.find((command) => command.command === "reclaim:tasks:create")).toMatchObject({
      confirmationFlag: "--confirm-write",
      safetyClass: "confirmed_write",
      currentMode: "live_write"
    });
  });
});
