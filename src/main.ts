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
import { ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import {
  PREVIEW_COMMAND_ID,
  PREVIEW_COMMAND_NAME,
} from "./preview/contracts";
import { DefaultPreviewCommandController } from "./preview/previewCommandController";
import { PreviewContextResolver } from "./preview/previewContextResolver";
import { PrerequisiteDiscoveryService } from "./preview/prerequisiteDiscoveryService";
import { PreviewFailurePolicy } from "./preview/previewFailurePolicy";
import { NodeExternalCliRunner } from "./preview/externalCliRunner";
import { PreviewOutputPresenter } from "./preview/previewOutputPresenter";
import { DefaultPreviewExecutionService } from "./preview/previewExecutionService";
import { PreviewOutputPublisher } from "./preview/previewOutputPublisher";
import { PluginStateGuard } from "./preview/pluginStateGuard";

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
      this.registerPreviewCommand();
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
        ".typ ファイルを開けませんでした。ファイルが開ける状態か確認してください",
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

  private registerPreviewCommand(): void {
    const commandController = this.createPreviewCommandController();

    this.addCommand({
      id: PREVIEW_COMMAND_ID,
      name: PREVIEW_COMMAND_NAME,
      checkCallback: (checking) => {
        const isAvailable = commandController.isCommandAvailable();

        if (checking) {
          return isAvailable;
        }

        if (!isAvailable) {
          return false;
        }

        void commandController.runFromCurrentContext();
        return true;
      },
    });
  }

  private createPreviewCommandController(): DefaultPreviewCommandController {
    const getActiveLike = () => {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        return null;
      }

      return {
        path: activeFile.path,
        extension: activeFile.extension,
      };
    };

    const vaultBasePath = this.getVaultBasePath();

    const runner = new NodeExternalCliRunner();
    const outputPublisher = new PreviewOutputPublisher();
    const execution = new DefaultPreviewExecutionService(
      runner,
      outputPublisher,
      vaultBasePath ? { cwd: vaultBasePath } : {},
    );
    const presenter = new PreviewOutputPresenter(
      (path) => this.openInRightPane(path),
      (path) => this.openBySystem(this.resolveVaultPath(path)),
      (path) => {
        void this.revealInOs(this.resolveVaultPath(path));
      },
    );
    const failurePolicy = new PreviewFailurePolicy();
    const stateGuard = new PluginStateGuard(
      () => this.currentActiveLeaf,
      (leaf) => this.restoreActiveLeaf(leaf),
    );
    const runtime = new PrerequisiteDiscoveryService({
      verify: (commandName) =>
        new Promise<boolean>((resolve) => {
          const testProcess = spawn(commandName, ["--version"], {
            stdio: ["ignore", "ignore", "pipe"],
            cwd: vaultBasePath ?? undefined,
          });

          testProcess.on("error", () => {
            resolve(false);
          });

          testProcess.on("close", (code) => {
            resolve(code === 0 || code === null);
          });
        }),
    });

    return new DefaultPreviewCommandController({
      resolver: new PreviewContextResolver(getActiveLike),
      runtime,
      execution,
      presenter,
      failurePolicy,
      stateGuard,
      onNotice: (message) => new Notice(message),
    });
  }

  private openBySystem(path: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
      const args =
        process.platform === "win32"
          ? ["/c", "start", path]
          : process.platform === "darwin"
            ? [path]
            : [path];

      let child: ChildProcess;
      try {
        child = spawn(command, args, {
          stdio: ["ignore", "ignore", "pipe"],
        });
      } catch (error) {
        resolve(`open command failed: ${String(error)}`);
        return;
      }

      let stderr = "";
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        resolve(`open command failed: ${String(error)}`);
      });

      child.on("close", (code) => {
        if (code === 0 || code === null) {
          resolve(null);
          return;
        }

        if (stderr.length > 0) {
          resolve(`open command failed: ${stderr}`);
          return;
        }

        resolve(`open command failed with exit code ${String(code)}`);
      });
    });
  }

  private async openInRightPane(path: string): Promise<void> {
    const target = this.app.vault.getAbstractFileByPath(path);
    if (!(target instanceof TFile)) {
      throw new Error(`artifact is not a vault file: ${path}`);
    }

    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(target, { active: false });
  }

  private async revealInOs(path: string): Promise<void> {
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["/c", "start", path]
        : process.platform === "darwin"
          ? ["-R", path]
          : [path];

    await this.openBySystemWithArgs(command, args);
  }

  private openBySystemWithArgs(command: string, args: string[]): Promise<void> {
    return new Promise<void>((resolve) => {
      let child: ChildProcess;
      try {
        child = spawn(command, args, {
          stdio: ["ignore", "ignore", "ignore"],
        });
      } catch {
        resolve();
        return;
      }

      child.on("close", () => resolve());
      child.on("error", () => resolve());
    });
  }

  private resolveVaultPath(relativePath: string): string {
    const vaultBasePath = this.getVaultBasePath();
    if (!vaultBasePath) {
      return relativePath;
    }

    return join(vaultBasePath, relativePath);
  }

  private getVaultBasePath(): string | null {
    const adapter = this.app.vault.adapter;
    const maybeGetBasePath =
      "getBasePath" in adapter && typeof adapter.getBasePath === "function"
        ? adapter.getBasePath
        : null;

    if (!maybeGetBasePath) {
      return null;
    }

    return maybeGetBasePath.call(adapter);
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
