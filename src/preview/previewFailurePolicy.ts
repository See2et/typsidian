import { PreviewFailureCategory } from "./contracts";

export interface FailureCategoryContext {
  command?: string;
  path?: string;
  reason?: string;
}

export interface PreviewFailurePolicyContract {
  classify(error: unknown, fallbackMessage: string): PreviewFailureCategory;
  getNoticeMessage(category: PreviewFailureCategory, context: FailureCategoryContext): string;
}

export class PreviewFailurePolicy implements PreviewFailurePolicyContract {
  public classify(error: unknown, fallbackMessage: string): PreviewFailureCategory {
    const message = this.extractMessage(error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "DEPENDENCY_MISSING";
    }

    if (message.includes("timeout")) {
      return "PROCESS_TIMEOUT";
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "exitCode" in error &&
      (error as { exitCode: number | null }).exitCode !== 0
    ) {
      return "PROCESS_EXIT_ERROR";
    }

    if (fallbackMessage.toLowerCase().includes("timeout")) {
      return "PROCESS_TIMEOUT";
    }

    if (fallbackMessage.toLowerCase().includes("artifact")) {
      return "ARTIFACT_NOT_FOUND";
    }

    if (fallbackMessage.toLowerCase().includes("open")) {
      return "ARTIFACT_OPEN_FAILED";
    }

    return "PROCESS_FAILED_TO_START";
  }

  public getNoticeMessage(
    category: PreviewFailureCategory,
    context: FailureCategoryContext,
  ): string {
    switch (category) {
      case "DEPENDENCY_MISSING":
        return "Typst CLI が見つかりません。`typst` が PATH から実行できるか確認してください。";
      case "PROCESS_TIMEOUT":
        return "Typst CLI の実行がタイムアウトしました。入力内容を確認して再実行してください。";
      case "PROCESS_EXIT_ERROR":
        return `Typst CLI が ${context.command ?? "コマンド"} で失敗しました。`;
      case "ARTIFACT_NOT_FOUND":
        return `PDF 成果物が生成されませんでした: ${context.path ?? "不明"}`;
      case "ARTIFACT_OPEN_FAILED":
        return `PDF を開けませんでした: ${context.path ?? "不明"}`;
      case "PROCESS_FAILED_TO_START":
      default:
        return "プレビュー実行を開始できませんでした。";
    }
  }

  private extractMessage(error: unknown): string {
    if (typeof error === "string") {
      return error.toLowerCase();
    }

    if (error instanceof Error) {
      return error.message.toLowerCase();
    }

    return "";
  }
}
