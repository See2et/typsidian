export const TYP_FILE_EXTENSION = "typ";
export const PREVIEW_COMMAND_NAME = "Preview Typst";
export const PREVIEW_COMMAND_ID = "preview-typst";

export interface PreviewFileLike {
  readonly path: string;
  readonly extension: string;
}

export type PreviewTarget = {
  filePath: string;
  displayName: string;
};

export type PreviewResolveError = "NO_ACTIVE_TARGET";

export type PreviewResolveResult =
  | { ok: true; target: PreviewTarget }
  | { ok: false; reason: PreviewResolveError };

export type RuntimeCommand = string;

export type RuntimeCheckResult =
  | {
      ok: true;
      resolvedCommand: RuntimeCommand;
    }
  | {
      ok: false;
      reason: "MISSING_RUNTIME" | "INVALID_PATH";
    };

export type ProcessRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type PreviewExecutionResult = {
  artifactPath: string;
  commandRunAt: string;
  deterministicKey: string;
  processRun: ProcessRunResult;
};

export type PreviewFailureCategory =
  | "DEPENDENCY_MISSING"
  | "PROCESS_FAILED_TO_START"
  | "PROCESS_TIMEOUT"
  | "PROCESS_EXIT_ERROR"
  | "ARTIFACT_NOT_FOUND"
  | "ARTIFACT_OPEN_FAILED";

export type PreviewFlowResult =
  | {
      ok: true;
      message: string;
      artifactPath: string;
    }
  | {
      ok: false;
      message: string;
    };
