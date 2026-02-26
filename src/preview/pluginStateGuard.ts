import { WorkspaceLeaf } from "obsidian";

export interface PluginStateGuardContract {
  withLeafPreserved<T>(action: () => Promise<T>): Promise<T>;
  restoreActiveLeafIfNeeded(expectedLeaf: WorkspaceLeaf | null): void;
}

export class PluginStateGuard implements PluginStateGuardContract {
  public constructor(
    private readonly currentLeafProvider: () => WorkspaceLeaf | null,
    private readonly restoreLeaf: (leaf: WorkspaceLeaf | null) => void,
  ) {}

  public async withLeafPreserved<T>(action: () => Promise<T>): Promise<T> {
    const previousLeaf = this.currentLeafProvider();
    try {
      return await action();
    } finally {
      this.restoreActiveLeafIfNeeded(previousLeaf);
    }
  }

  public restoreActiveLeafIfNeeded(expectedLeaf: WorkspaceLeaf | null): void {
    this.restoreIfChanged(expectedLeaf);
  }

  private restoreIfChanged(expectedLeaf: WorkspaceLeaf | null): void {
    if (expectedLeaf !== this.currentLeafProvider()) {
      this.restoreLeaf(expectedLeaf);
    }
  }
}
