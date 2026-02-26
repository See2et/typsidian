import {
  PreviewFlowResult,
  PreviewFailureCategory,
  RuntimeCheckResult,
} from "./contracts";
import { PreviewContextResolver } from "./previewContextResolver";
import { PrerequisiteDiscoveryService } from "./prerequisiteDiscoveryService";
import { PreviewOutputPresenter } from "./previewOutputPresenter";
import { PreviewFailurePolicy } from "./previewFailurePolicy";
import {
  PreviewExecutionService,
} from "./previewExecutionService";
import { PluginStateGuard } from "./pluginStateGuard";

export interface PreviewCommandController {
  isCommandAvailable(): boolean;
  runFromCurrentContext(): Promise<PreviewFlowResult>;
}

export interface PreviewCommandControllerDeps {
  resolver: PreviewContextResolver;
  runtime: PrerequisiteDiscoveryService;
  execution: PreviewExecutionService;
  presenter: PreviewOutputPresenter;
  failurePolicy: PreviewFailurePolicy;
  stateGuard: PluginStateGuard;
  onNotice: (message: string) => void;
}

export class DefaultPreviewCommandController
  implements PreviewCommandController
{
  public constructor(private readonly deps: PreviewCommandControllerDeps) {}

  public isCommandAvailable(): boolean {
    const targetResult = this.deps.resolver.resolveTargetForCommand();
    return targetResult.ok;
  }

  public async runFromCurrentContext(): Promise<PreviewFlowResult> {
    return this.deps.stateGuard.withLeafPreserved(async () => {
      let artifactPath: string | undefined;
      const targetResult = this.deps.resolver.resolveTargetForCommand();
      if (!targetResult.ok) {
        const message = "Typst ファイルが選択されていません。現在の編集対象を確認してください。";
        this.deps.onNotice(message);
        return {
          ok: false,
          message,
        };
      }

      const runtimeResult: RuntimeCheckResult =
        await this.deps.runtime.ensureRuntimeAvailable("typst");
      if (!runtimeResult.ok) {
        const runtimeCategory =
          runtimeResult.reason === "MISSING_RUNTIME"
            ? "DEPENDENCY_MISSING"
            : "PROCESS_FAILED_TO_START";
        return this.presentFailure(runtimeCategory, "Typst CLI が見つかりません。", {
          command: "typst",
          reason: runtimeResult.reason,
        });
      }

      try {
        const executionResult = await this.deps.execution.executePreview(
          targetResult.target,
          runtimeResult.resolvedCommand,
        );
        artifactPath = executionResult.artifactPath;
        await this.deps.presenter.openArtifact(artifactPath);

        return {
          ok: true,
          message: "Preview Typst を開きました。",
          artifactPath: executionResult.artifactPath,
        };
      } catch (error) {
        const fallbackMessage = error instanceof Error ? error.message : "unknown";
        const category = this.deps.failurePolicy.classify(error, fallbackMessage);
        const artifactPathFromError =
          error instanceof Error
            ? /artifact not found:\s*(.+)$/i.exec(error.message)?.[1]
            : undefined;

        return this.presentFailure(category, fallbackMessage, {
          command: runtimeResult.resolvedCommand,
          path: artifactPathFromError ?? artifactPath ?? targetResult.target.filePath,
          reason: fallbackMessage,
        },
        error);
      }
    });
  }

  private presentFailure(
    category: PreviewFailureCategory,
    fallbackMessage: string,
    context: {
      command?: string;
      path?: string;
      reason?: string;
    },
    error?: unknown,
  ): PreviewFlowResult {
    const message = this.deps.failurePolicy.getNoticeMessage(category, context);
    const logContext = JSON.stringify({
      category,
      message: fallbackMessage,
      reason: context.reason,
    });

    console.warn("[typsidian] preview failed", logContext);
    this.deps.onNotice(message);

    return {
      ok: false,
      message,
    };
  }
}
