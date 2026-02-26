export interface PreviewOutputPresenterContract {
  openArtifact(path: string): Promise<void>;
  revealInFolder(path: string): Promise<void>;
}

export class PreviewOutputPresenter implements PreviewOutputPresenterContract {
  public constructor(
    private readonly openInPane: (path: string) => Promise<void>,
    private readonly openPath: (path: string) => Promise<string | null>,
    private readonly revealPath: (path: string) => void,
  ) {}

  public async openArtifact(path: string): Promise<void> {
    try {
      await this.openInPane(path);
      return;
    } catch {
      const openResult = await this.openPath(path);
      if (openResult) {
        throw new Error(openResult);
      }
    }
  }

  public async revealInFolder(path: string): Promise<void> {
    this.revealPath(path);
  }
}
