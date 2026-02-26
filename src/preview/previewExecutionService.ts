import { join } from "node:path";

import {
  PreviewExecutionResult,
  PreviewTarget,
} from "./contracts";
import {
  ExternalCliRunner,
  ProcessRunOptions,
} from "./externalCliRunner";
import { PreviewOutputPublisher } from "./previewOutputPublisher";

export interface PreviewExecutionService {
  executePreview(target: PreviewTarget, command: string): Promise<PreviewExecutionResult>;
}

export class DefaultPreviewExecutionService implements PreviewExecutionService {
  public constructor(
    private readonly runner: ExternalCliRunner,
    private readonly publisher: PreviewOutputPublisher,
    private readonly runOptions: ProcessRunOptions = { timeoutMs: 100000 },
  ) {}

  public async executePreview(
    target: PreviewTarget,
    command: string,
  ): Promise<PreviewExecutionResult> {
    const artifactPath = this.publisher.computeOutputPath(target);

    const runResult = await this.runner.runWithArgs(
      command,
      ["compile", target.filePath, artifactPath],
      this.runOptions,
    );

    if (runResult.exitCode !== 0) {
      throw Object.assign(new Error(runResult.stderr || "preview command failed"), {
        exitCode: runResult.exitCode,
        stdout: runResult.stdout,
        stderr: runResult.stderr,
      });
    }

    const exists = await this.publisher.ensureArtifactExists(artifactPath);
    if (!exists) {
      throw new Error(`artifact not found: ${artifactPath}`);
    }

    return {
      artifactPath,
      deterministicKey: artifactPath,
      commandRunAt: new Date().toISOString(),
      processRun: runResult,
    };
  }
}

export class StubPreviewExecutionService implements PreviewExecutionService {
  public constructor(
    private readonly simulate: (target: PreviewTarget, command: string) => Promise<void> = async () => {
      return;
    },
  ) {}

  public async executePreview(target: PreviewTarget, command: string): Promise<PreviewExecutionResult> {
    await this.simulate(target, command);

    return {
      artifactPath: join(target.filePath, "..", "preview.pdf"),
      deterministicKey: target.filePath,
      commandRunAt: new Date().toISOString(),
      processRun: {
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
    };
  }
}
