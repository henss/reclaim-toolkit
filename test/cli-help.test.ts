import { describe, expect, test } from "vitest";
import { runNpmCli } from "./cli-test-helpers.js";

describe("CLI help output", () => {
  test("keeps default help focused on the conventional public baseline", () => {
    const result = runNpmCli(["reclaim:help"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      help: string;
      readSafety: string;
      includesOptionalSurfaces: boolean;
      optionalSurfaceHint?: { flag: string; hiddenCommandCount: number };
      groups: Array<{ id: string; commands: Array<{ command: string }> }>;
    };

    expect(output).toMatchObject({
      help: "reclaim-toolkit-help",
      readSafety: "public_metadata",
      includesOptionalSurfaces: false,
      optionalSurfaceHint: {
        flag: "--include-optional"
      }
    });
    expect(output.optionalSurfaceHint?.hiddenCommandCount).toBeGreaterThan(0);
    expect(output.groups.map((group) => group.id)).toEqual(["core", "tasks"]);
    const visibleCommands = output.groups.flatMap((group) => group.commands.map((command) => command.command));
    expect(visibleCommands).toContain("reclaim:help");
    expect(visibleCommands).toContain("reclaim:tasks:create");
    expect(visibleCommands).not.toContain("reclaim:scenarios:preview-weekly");
    expect(visibleCommands).not.toContain("reclaim:habits:preview-create");
    expect(visibleCommands).not.toContain("reclaim:meetings-hours:inspect");
  });

  test("reveals optional surfaces with readiness gates when requested", () => {
    const result = runNpmCli(["reclaim:help", "--", "--include-optional"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout) as {
      includesOptionalSurfaces: boolean;
      optionalSurfaceHint?: unknown;
      groups: Array<{
        id: string;
        commands: Array<{
          command: string;
          currentMode: string;
          readinessStatus?: string;
          readinessGate?: string;
        }>;
      }>;
    };

    expect(output.includesOptionalSurfaces).toBe(true);
    expect(output.optionalSurfaceHint).toBeUndefined();
    const optionalGroup = output.groups.find((group) => group.id === "optional");
    expect(optionalGroup).toBeDefined();
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:scenarios:preview-weekly")).toMatchObject({
      currentMode: "preview_only",
      readinessStatus: "evidence_pending",
      readinessGate: expect.stringContaining("live scheduling contract")
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:habits:preview-create")).toMatchObject({
      currentMode: "preview_only",
      readinessStatus: "review_pending",
      readinessGate: expect.stringContaining("generated OpenAPI contract")
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:focus:preview-create")).toMatchObject({
      readinessStatus: "evidence_pending"
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:meetings:preview-availability")).toMatchObject({
      currentMode: "preview_only",
      readinessStatus: "blocked",
      readinessGate: expect.stringContaining("routing review")
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:hours-config:audit")).toMatchObject({
      currentMode: "read_only",
      readinessStatus: "ready",
      readinessGate: expect.stringContaining("hours-config coverage")
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:hours-config:preview-diff")).toMatchObject({
      currentMode: "read_only",
      readinessStatus: "ready",
      readinessGate: expect.stringContaining("source handles")
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:account-audit:inspect")).toMatchObject({
      currentMode: "read_only",
      readinessStatus: "ready"
    });
    expect(optionalGroup?.commands.find((command) => command.command === "reclaim:account-audit:preview-drift")).toMatchObject({
      currentMode: "read_only",
      readinessStatus: "ready",
      readinessGate: expect.stringContaining("source handles")
    });
  });
});
