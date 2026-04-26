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

interface ConsumerInstallMode {
  label: string;
  getInstallTarget: () => string;
}

interface TypeScriptConsumerMode {
  label: string;
  source: string;
  tsconfig: Record<string, unknown>;
}

interface ExportSurfaceExpectation {
  label: string;
  importPath: string;
  expectedExports: string[];
  forbiddenExports: string[];
}

const repoRoot = process.cwd();
const tempRoots: string[] = [];
let packedTarballPath = "";
const installTestTimeoutMs = 20_000;
const exportSurfaceExpectations: ExportSurfaceExpectation[] = [
  {
    label: "core client subpath",
    importPath: "reclaim-toolkit/core",
    expectedExports: ["createReclaimClient", "createReclaimOpenApiClient", "loadReclaimConfig"],
    forbiddenExports: ["getReclaimCliHelp", "runMockReadonlyReclaimMcpServer"]
  },
  {
    label: "CLI metadata subpath",
    importPath: "reclaim-toolkit/cli",
    expectedExports: ["getReclaimCliHelp", "getReclaimOnboardingWizard", "getReclaimCommandSafetyManifest"],
    forbiddenExports: ["createReclaimClient", "runMockReadonlyReclaimMcpServer"]
  },
  {
    label: "mock utilities subpath",
    importPath: "reclaim-toolkit/mock",
    expectedExports: ["fixtureRecorder", "runMockReclaimApiDemo", "runMockReadonlyReclaimMcpServer"],
    forbiddenExports: ["createReclaimClient", "getReclaimCliHelp"]
  }
];
const typeScriptModes: TypeScriptConsumerMode[] = [
  {
    label: "TypeScript NodeNext imports",
    source: [
      "import { createReclaimOpenApiClient, loadReclaimConfig, tasks, type ReclaimTaskInput } from \"reclaim-toolkit\";",
      "",
      "const input: ReclaimTaskInput[] = [{",
      "  title: \"TypeScript smoke task\",",
      "  durationMinutes: 45,",
      "  eventCategory: \"WORK\"",
      "}];",
      "",
      "const preview = tasks.previewCreates(input, {",
      "  timeSchemeId: \"policy-work\"",
      "});",
      "",
      "const config = loadReclaimConfig();",
      "if (config) {",
      "  createReclaimOpenApiClient(config);",
      "}",
      "",
      "const typedSummary: {",
      "  taskCount: number;",
      "  firstTaskTitle: string | undefined;",
      "} = {",
      "  taskCount: preview.taskCount,",
      "  firstTaskTitle: preview.tasks[0]?.title",
      "};",
      "",
      "console.log(typedSummary.taskCount);"
    ].join("\n"),
    tsconfig: {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        skipLibCheck: true
      }
    }
  },
  {
    label: "TypeScript bundler imports",
    source: [
      "import { DEFAULT_RECLAIM_CONFIG_PATH, tasks, type ReclaimTaskInput } from \"reclaim-toolkit\";",
      "",
      "const input: ReclaimTaskInput[] = [{",
      "  title: \"Bundler smoke task\",",
      "  durationMinutes: 30",
      "}];",
      "",
      "const preview = tasks.previewCreates(input, {",
      "  timeSchemeId: \"policy-personal\"",
      "});",
      "",
      "const typedSummary = {",
      "  configPath: DEFAULT_RECLAIM_CONFIG_PATH,",
      "  taskCount: preview.taskCount,",
      "  firstTaskTitle: preview.tasks[0]?.request.title",
      "};",
      "",
      "console.log(typedSummary.configPath);"
    ].join("\n"),
    tsconfig: {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noEmit: true,
        skipLibCheck: true
      }
    }
  }
];
typeScriptModes.push({
  label: "TypeScript core client subpath imports",
  source: [
    "import { createReclaimClient, loadReclaimConfig, type ReclaimConfig } from \"reclaim-toolkit/core\";",
    "",
    "const config: ReclaimConfig = {",
    "  apiUrl: \"https://api.app.reclaim.ai\",",
    "  apiKey: \"example-key\",",
    "  timeoutMs: 20000,",
    "  defaultTaskEventCategory: \"WORK\"",
    "};",
    "",
    "createReclaimClient(config);",
    "const maybeConfig = loadReclaimConfig();",
    "console.log(maybeConfig?.apiUrl ?? config.apiUrl);"
  ].join("\n"),
  tsconfig: {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noEmit: true,
      skipLibCheck: true
    }
  }
});

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

function writeConsumerTypeScriptProject(
  consumerDir: string,
  options: {
    source: string;
    tsconfig: Record<string, unknown>;
  }
): void {
  fs.writeFileSync(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify(options.tsconfig, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(consumerDir, "consumer-smoke.ts"), options.source, "utf8");
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

function runTypeScriptProject(consumerDir: string): CommandResult {
  return runProcess(
    process.execPath,
    [
      path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
      "--project",
      path.join(consumerDir, "tsconfig.json"),
      "--pretty",
      "false"
    ],
    consumerDir
  );
}

function createConsumerWorkspace(): string {
  const consumerDir = makeTempDir("reclaim-toolkit-consumer-");
  writeConsumerPackage(consumerDir);
  return consumerDir;
}

function assertEsmLibraryImportWorks(installMode: ConsumerInstallMode): void {
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
}

function assertTypeScriptImportWorks(
  installMode: ConsumerInstallMode,
  typeScriptMode: TypeScriptConsumerMode
): void {
  const consumerDir = createConsumerWorkspace();
  installPackage(consumerDir, installMode.getInstallTarget());
  writeConsumerTypeScriptProject(consumerDir, typeScriptMode);

  const compileResult = runTypeScriptProject(consumerDir);

  expect(compileResult.status, compileResult.stdout).toBe(0);
  expect(compileResult.stderr, compileResult.stderr).toBe("");
}

function assertInstalledCliWorks(installMode: ConsumerInstallMode): void {
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
}

function assertExportSurfaceWorks(
  installMode: ConsumerInstallMode,
  expectation: ExportSurfaceExpectation
): void {
  const consumerDir = createConsumerWorkspace();
  installPackage(consumerDir, installMode.getInstallTarget());

  const runResult = runNodeScript(
    consumerDir,
    [
      `import * as exportedModule from ${JSON.stringify(expectation.importPath)};`,
      "console.log(JSON.stringify(Object.keys(exportedModule).sort()));"
    ].join("\n")
  );

  expect(runResult.status).toBe(0);
  expect(runResult.stderr).toBe("");
  const exports = JSON.parse(runResult.stdout) as string[];
  for (const expectedExport of expectation.expectedExports) {
    expect(exports).toContain(expectedExport);
  }
  for (const forbiddenExport of expectation.forbiddenExports) {
    expect(exports).not.toContain(forbiddenExport);
  }
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
  const installModes: ConsumerInstallMode[] = [
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
      assertEsmLibraryImportWorks(installMode);
    }, installTestTimeoutMs);

    for (const typeScriptMode of typeScriptModes) {
      test(`supports ${typeScriptMode.label} via ${installMode.label}`, () => {
        assertTypeScriptImportWorks(installMode, typeScriptMode);
      }, installTestTimeoutMs);
    }

    test(`supports the installed CLI via ${installMode.label}`, () => {
      assertInstalledCliWorks(installMode);
    }, installTestTimeoutMs);

    for (const expectation of exportSurfaceExpectations) {
      test(`supports ${expectation.label} via ${installMode.label}`, () => {
        assertExportSurfaceWorks(installMode, expectation);
      }, installTestTimeoutMs);
    }
  }
});
