import {
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from "obsidian";

const TYP_EXTENSION = "typ";
const TYP_VIEW = "markdown";
const NEW_TYP_NAME = "Untitled";
const NEW_TYP_EXT = `.${TYP_EXTENSION}`;
const TYP_FILE_EXTENSIONS = [TYP_EXTENSION, "Typ", "TYP"] as const;

interface TypLifecycleEventTarget {
  path: string;
  name: string;
}

export default class TypsidianPlugin extends Plugin {
  private previousActiveLeaf: WorkspaceLeaf | null = null;
  private currentActiveLeaf: WorkspaceLeaf | null = null;

  async onload(): Promise<void> {
    this.currentActiveLeaf = this.app.workspace.getMostRecentLeaf();

    this.app.workspace.onLayoutReady(() => {
      this.registerExtensions(Array.from(TYP_FILE_EXTENSIONS), TYP_VIEW);
      this.registerTypLifecycleObserver();
      this.registerTypContextMenuActions();
      this.logStartupState();
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", this.handleFileOpen),
    );

    console.info("[typsidian] plugin loaded");
  }

  private handleFileOpen = (file: TFile | null): void => {
    if (!file || !this.isTypFile(file)) {
      return;
    }

    if (!this.isTypFileAccessible(file)) {
      this.restoreActiveLeaf(this.previousActiveLeaf);
      new Notice(
        ".typ ファイルを開けませんでした。ファイルを開封できる状態を確認してください",
      );
      return;
    }

    const existingLeaf = this.getLeafByTypFile(file.path);

    if (!existingLeaf) {
      return;
    }

    const activeLeaf = this.app.workspace.getMostRecentLeaf();
    if (activeLeaf === existingLeaf) {
      return;
    }

    this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
  };

  private handleActiveLeafChange = (leaf: WorkspaceLeaf | null): void => {
    if (leaf === this.currentActiveLeaf) {
      return;
    }

    this.previousActiveLeaf = this.currentActiveLeaf;
    this.currentActiveLeaf = leaf;
  };

  private registerTypLifecycleObserver(): void {
    this.registerEvent(this.app.vault.on("create", this.handleVaultCreate));
    this.registerEvent(this.app.vault.on("rename", this.handleVaultRename));
    this.registerEvent(this.app.vault.on("delete", this.handleVaultDelete));
  }

  private registerTypContextMenuActions(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
        this.addNewTypContextMenuItem(menu, this.getTargetFolder(file));
      }),
    );

    this.registerEvent(
      this.app.workspace.on(
        "files-menu",
        (menu: Menu, files: TAbstractFile[] | null) => {
          const targetFile = files?.[0];
          this.addNewTypContextMenuItem(menu, this.getTargetFolder(targetFile));
        },
      ),
    );
  }

  private addNewTypContextMenuItem(menu: Menu, target: TFolder): void {
    menu.addItem((item) => {
      item
        .setTitle("New Typst")
        .setIcon("new-file")
        .onClick(async () => {
          try {
            const name = await this.resolveUniqueTypFileName(target);
            const targetPath = this.joinPath(target.path, name);
            const created = await this.app.vault.create(targetPath, "");

            await this.app.workspace.getLeaf(false).openFile(created);
          } catch (error) {
            console.error("[typsidian] failed to create typ file", error);
            new Notice(".typ ファイルの作成に失敗しました");
          }
        });
    });
  }

  private async resolveUniqueTypFileName(folder: TFolder): Promise<string> {
    const initialName = `${NEW_TYP_NAME}${NEW_TYP_EXT}`;
    if (
      !this.app.vault.getAbstractFileByPath(
        this.joinPath(folder.path, initialName),
      )
    ) {
      return initialName;
    }

    let counter = 1;
    while (true) {
      const name = `${NEW_TYP_NAME} ${counter}${NEW_TYP_EXT}`;
      if (
        !this.app.vault.getAbstractFileByPath(this.joinPath(folder.path, name))
      ) {
        return name;
      }
      counter += 1;
    }
  }

  private getTargetFolder(file?: TAbstractFile): TFolder {
    if (file instanceof TFolder) {
      return file;
    }

    if (file instanceof TFile) {
      return file.parent ?? this.app.vault.getRoot();
    }

    return this.app.vault.getRoot();
  }

  private isTypFile(file: TAbstractFile): file is TFile {
    return file instanceof TFile && file.extension.toLowerCase() === TYP_EXTENSION;
  }

  private getLeafByTypFile(path: string): WorkspaceLeaf | null {
    return (
      this.app.workspace
        .getLeavesOfType(TYP_VIEW)
        .find((leaf) =>
          leaf.view instanceof MarkdownView && leaf.view.file?.path === path
        ) ||
      null
    );
  }

  private handleVaultCreate = (file: TAbstractFile): void => {
    if (!this.isTypFile(file)) {
      return;
    }

    this.logLifecycle("create", file);
  };

  private handleVaultRename = (file: TAbstractFile, oldPath: string): void => {
    if (!this.isTypFile(file)) {
      return;
    }

    this.logLifecycle("rename", file, oldPath);
  };

  private handleVaultDelete = (file: TAbstractFile): void => {
    if (!this.isTypFile(file)) {
      return;
    }

    this.logLifecycle("delete", file);
  };

  private isTypFileAccessible(file: TFile): boolean {
    return this.app.vault.getAbstractFileByPath(file.path) instanceof TFile;
  }

  private restoreActiveLeaf(leaf: WorkspaceLeaf | null): void {
    if (!leaf) {
      return;
    }

    const activeLeaf = this.currentActiveLeaf;
    if (activeLeaf === leaf) {
      return;
    }

    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  private logLifecycle(
    eventName: "create" | "rename" | "delete",
    file: TypLifecycleEventTarget,
    oldPath?: string,
  ): void {
    if (oldPath) {
      console.info(`[typsidian] ${eventName}: ${oldPath} -> ${file.path}`);
      return;
    }

    console.info(`[typsidian] ${eventName}: ${file.path}`);
  }

  private logStartupState(): void {
    console.info(
      "[typsidian] startup observers and context menu actions registered",
    );
  }

  private joinPath(folderPath: string, fileName: string): string {
    if (!folderPath) {
      return fileName;
    }

    return `${folderPath}/${fileName}`;
  }

  onunload(): void {
    console.info("[typsidian] plugin unloaded");
  }
}
