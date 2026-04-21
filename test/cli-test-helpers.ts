import { spawn, spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import { type Server } from "node:http";
import os from "node:os";
import path from "node:path";

export function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected test server to listen on a TCP port.");
      }
      resolve(address.port);
    });
  });
}

export function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "reclaim-toolkit-"));
}

export function writeConfigFile(configPath: string, config: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function runNpmCli(args: string[]): SpawnSyncReturns<string> {
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

export function runNpmCliAsync(
  args: string[]
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const child = process.platform === "win32"
    ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", ["npm", "run", "--silent", ...args].join(" ")], {
      cwd: process.cwd()
    })
    : spawn(npmCommand(), ["run", "--silent", ...args], { cwd: process.cwd() });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}
