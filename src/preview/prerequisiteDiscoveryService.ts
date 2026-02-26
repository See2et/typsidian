import { RuntimeCheckResult } from "./contracts";

export interface RuntimeVerifier {
  verify(commandName: string): Promise<boolean>;
}

export class PrerequisiteDiscoveryService {
  public constructor(private readonly verifier: RuntimeVerifier) {}

  public async ensureRuntimeAvailable(commandName: string): Promise<RuntimeCheckResult> {
    try {
      const available = await this.verifier.verify(commandName);
      if (!available) {
        return {
          ok: false,
          reason: "MISSING_RUNTIME",
        };
      }

      return {
        ok: true,
        resolvedCommand: commandName,
      };
    } catch (error) {
      return {
        ok: false,
        reason: this.classifyError(error),
      };
    }
  }

  public resetRuntimeCache(): void {
  }

  private classifyError(error: unknown): "MISSING_RUNTIME" | "INVALID_PATH" {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return "MISSING_RUNTIME";
    }

    return "INVALID_PATH";
  }
}
