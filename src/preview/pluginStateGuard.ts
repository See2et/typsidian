import { WorkspaceLeaf } from "obsidian";

export interface PluginStateGuardContract {
  withLeafPreserved<T>(action: () => Promise<T>): Promise<T>;
  restoreActiveLeafIfNeeded(): void;
}

export class PluginStateGuard implements PluginStateGuardContract {
  public constructor(
    private readonly currentLeafProvider: () => WorkspaceLeaf | null,
    private readonly restoreLeaf: (leaf: WorkspaceLeaf | null) => void,
  ) {}

  private leafToRestore: WorkspaceLeaf | null = null;

  public async withLeafPreserved<T>(action: () => Promise<T>): Promise<T> {
    const previousLeaf = this.currentLeafProvider();
    this.leafToRestore = previousLeaf;
    try {
      return await action();
    } finally {
      this.restoreActiveLeafIfNeeded();
      this.leafToRestore = null;
    }
  }

  public restoreActiveLeafIfNeeded(): void {
    this.restoreIfChanged(this.leafToRestore);
  }

  private restoreIfChanged(expectedLeaf: WorkspaceLeaf | null): void {
    if (expectedLeaf !== this.currentLeafProvider()) {
      this.restoreLeaf(expectedLeaf);
    }
  }
}
