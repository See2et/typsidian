import { ChildProcess, SpawnOptions, spawn } from "node:child_process";

import { ProcessRunResult } from "./contracts";

export interface ProcessRunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface ExternalCliRunner {
  runWithArgs(
    command: string,
    args: string[],
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult>;
  runCommandString(
    commandLine: string,
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult>;
}

export class NodeExternalCliRunner implements ExternalCliRunner {
  public async runWithArgs(
    command: string,
    args: string[],
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult> {
    return this.runProcess(command, args, options);
  }

  public runCommandString(
    commandLine: string,
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult> {
    const isWindows = process.platform === "win32";
    return this.runProcess(isWindows ? "cmd" : "sh", [isWindows ? "/c" : "-c", commandLine], options);
  }

  private async runProcess(
    command: string,
    args: string[],
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const processOptions: SpawnOptions = {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
      };

      let child: ChildProcess;
      try {
        child = spawn(command, args, {
          ...processOptions,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        reject(error);
        return;
      }

      let stdout = "";
      let stderr = "";

      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });

      const timeoutMs = options.timeoutMs;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (typeof timeoutMs === "number" && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          void child.kill();
          resolve({
            exitCode: null,
            stdout,
            stderr: `${stderr}\nprocess timeout after ${timeoutMs}ms`,
          });
        }, timeoutMs);
      }

      child.on("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });

      child.on("close", (code) => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }

        resolve({
          exitCode: code,
          stdout,
          stderr,
        });
      });
    });
  }
}

export class MockExternalCliRunner implements ExternalCliRunner {
  public constructor(
    private readonly handler: (
      command: string,
      args: string[],
      options: ProcessRunOptions,
    ) => Promise<ProcessRunResult>,
  ) {}

  public runWithArgs(
    command: string,
    args: string[],
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult> {
    return this.handler(command, args, options);
  }

  public runCommandString(
    commandLine: string,
    options: ProcessRunOptions,
  ): Promise<ProcessRunResult> {
    const isWindows = process.platform === "win32";
    return this.handler(isWindows ? "cmd" : "sh", [isWindows ? "/c" : "-c", commandLine], options);
  }
}
