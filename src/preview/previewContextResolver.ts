import {
  PreviewFileLike,
  PreviewResolveError,
  PreviewResolveResult,
  TYP_FILE_EXTENSION,
} from "./contracts";

type ActiveFileProvider = () => PreviewFileLike | null;

export class PreviewContextResolver {
  public constructor(private readonly getActiveFile: ActiveFileProvider) {}

  public resolveTargetForCommand(): PreviewResolveResult {
    const activeFile = this.getActiveFile();

    if (!activeFile || !this.isTypFile(activeFile)) {
      return this.fail("NO_ACTIVE_TARGET");
    }

    const fileName = this.getFileName(activeFile.path);

    return {
      ok: true,
      target: {
        filePath: activeFile.path,
        displayName: fileName,
      },
    };
  }

  private isTypFile(file: PreviewFileLike): boolean {
    return file.extension.toLowerCase() === TYP_FILE_EXTENSION;
  }

  private getFileName(path: string): string {
    const index = path.lastIndexOf("/");
    if (index === -1) {
      return path;
    }

    return path.slice(index + 1);
  }

  private fail(reason: PreviewResolveError): { ok: false; reason: PreviewResolveError } {
    return { ok: false, reason };
  }
}
