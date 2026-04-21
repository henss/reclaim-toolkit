import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

const repoRoot = process.cwd();
const tempRoots: string[] = [];
let packedTarballPath = "";

function makeTempDir(prefix: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(tempDir);
  return tempDir;
}

function npmExecutable(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function quoteForCmd(arg: string): string {
  return /\s/.test(arg) ? `"${arg}"` : arg;
}

function runProcess(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function runNpm(args: string[], cwd: string): CommandResult {
  if (process.platform === "win32") {
    return runProcess(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", [npmExecutable(), ...args.map(quoteForCmd)].join(" ")],
      cwd
    );
  }

  return runProcess(npmExecutable(), args, cwd);
}

function writeConsumerPackage(consumerDir: string): void {
  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "reclaim-toolkit-smoke-consumer",
        private: true,
        type: "module"
      },
      null,
      2
    ),
    "utf8"
  );
}

function installPackage(consumerDir: string, installTarget: string): void {
  const installResult = runNpm(["install", "--no-package-lock", installTarget], consumerDir);

  expect(installResult.status).toBe(0);
  expect(installResult.stderr).not.toContain("npm ERR!");
}

function runNodeScript(consumerDir: string, source: string): CommandResult {
  const scriptPath = path.join(consumerDir, "consumer-smoke.mjs");
  fs.writeFileSync(scriptPath, source, "utf8");
  return runProcess(process.execPath, [scriptPath], consumerDir);
}

function runInstalledCli(consumerDir: string, args: string[]): CommandResult {
  const binPath = process.platform === "win32"
    ? path.join(consumerDir, "node_modules", ".bin", "reclaim-toolkit.cmd")
    : path.join(consumerDir, "node_modules", ".bin", "reclaim-toolkit");

  if (process.platform === "win32") {
    return runProcess(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", [quoteForCmd(binPath), ...args.map(quoteForCmd)].join(" ")],
      consumerDir
    );
  }

  return runProcess(binPath, args, consumerDir);
}

function createConsumerWorkspace(): string {
  const consumerDir = makeTempDir("reclaim-toolkit-consumer-");
  writeConsumerPackage(consumerDir);
  return consumerDir;
}

function packBuiltPackage(): string {
  const stageDir = makeTempDir("reclaim-toolkit-stage-");
  const packDir = makeTempDir("reclaim-toolkit-pack-");

  fs.copyFileSync(path.join(repoRoot, "package.json"), path.join(stageDir, "package.json"));
  fs.copyFileSync(path.join(repoRoot, "README.md"), path.join(stageDir, "README.md"));
  fs.copyFileSync(path.join(repoRoot, "LICENSE"), path.join(stageDir, "LICENSE"));
  fs.cpSync(path.join(repoRoot, "dist"), path.join(stageDir, "dist"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "docs"), path.join(stageDir, "docs"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "examples"), path.join(stageDir, "examples"), { recursive: true });

  const packResult = runNpm(["pack", "--json", "--pack-destination", packDir], stageDir);

  expect(packResult.status).toBe(0);
  expect(packResult.stderr).not.toContain("npm ERR!");

  const [packInfo] = JSON.parse(packResult.stdout) as Array<{ filename: string }>;
  expect(packInfo?.filename).toBeTruthy();

  return path.join(packDir, packInfo.filename);
}

beforeAll(() => {
  const buildResult = runNpm(["run", "build"], repoRoot);

  expect(buildResult.status).toBe(0);
  expect(buildResult.stderr).not.toContain("npm ERR!");

  packedTarballPath = packBuiltPackage();
});

afterAll(() => {
  for (const tempRoot of tempRoots) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("package consumer smoke matrix", () => {
  const installModes = [
    {
      label: "workspace path install",
      getInstallTarget: () => repoRoot
    },
    {
      label: "packed tarball install",
      getInstallTarget: () => packedTarballPath
    }
  ];

  for (const installMode of installModes) {
    test(`supports ESM library imports via ${installMode.label}`, () => {
      const consumerDir = createConsumerWorkspace();
      installPackage(consumerDir, installMode.getInstallTarget());

      const runResult = runNodeScript(
        consumerDir,
        [
          "import { tasks } from \"reclaim-toolkit\";",
          "const preview = tasks.previewCreates([{ title: \"Consumer smoke task\", durationMinutes: 30 }], {",
          "  timeSchemeId: \"policy-work\",",
          "  eventCategory: \"WORK\"",
          "});",
          "console.log(JSON.stringify({",
          "  taskCount: preview.taskCount,",
          "  firstTaskTitle: preview.tasks[0]?.title,",
          "  timeSchemeId: preview.tasks[0]?.request.timeSchemeId,",
          "  eventCategory: preview.tasks[0]?.request.eventCategory",
          "}));"
        ].join("\n")
      );

      expect(runResult.status).toBe(0);
      expect(runResult.stderr).toBe("");
      expect(JSON.parse(runResult.stdout)).toEqual({
        taskCount: 1,
        firstTaskTitle: "Consumer smoke task",
        timeSchemeId: "policy-work",
        eventCategory: "WORK"
      });
    });

    test(`supports the installed CLI via ${installMode.label}`, () => {
      const consumerDir = createConsumerWorkspace();
      installPackage(consumerDir, installMode.getInstallTarget());

      const cliResult = runInstalledCli(consumerDir, ["reclaim:onboarding"]);

      expect(cliResult.status).toBe(0);
      expect(cliResult.stderr).toBe("");
      expect(JSON.parse(cliResult.stdout)).toMatchObject({
        wizard: "reclaim-toolkit-onboarding",
        writeSafety: "no_live_writes",
        config: {
          path: "config/reclaim.local.json",
          parseStatus: "missing"
        }
      });
    });
  }
});
