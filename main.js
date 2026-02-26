var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TypsidianPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_node_child_process2 = require("node:child_process");
var import_node_path3 = require("node:path");

// src/preview/contracts.ts
var TYP_FILE_EXTENSION = "typ";
var PREVIEW_COMMAND_NAME = "Preview Typst";
var PREVIEW_COMMAND_ID = "preview-typst";

// src/preview/previewCommandController.ts
var DefaultPreviewCommandController = class {
  constructor(deps) {
    this.deps = deps;
  }
  isCommandAvailable() {
    const targetResult = this.deps.resolver.resolveTargetForCommand();
    return targetResult.ok;
  }
  async runFromCurrentContext() {
    return this.deps.stateGuard.withLeafPreserved(async () => {
      const targetResult = this.deps.resolver.resolveTargetForCommand();
      if (!targetResult.ok) {
        const message = "Typst \u30D5\u30A1\u30A4\u30EB\u304C\u9078\u629E\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u73FE\u5728\u306E\u7DE8\u96C6\u5BFE\u8C61\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
        this.deps.onNotice(message);
        return {
          ok: false,
          message
        };
      }
      const runtimeResult = await this.deps.runtime.ensureRuntimeAvailable("typst");
      if (!runtimeResult.ok) {
        const runtimeCategory = runtimeResult.reason === "MISSING_RUNTIME" ? "DEPENDENCY_MISSING" : "PROCESS_FAILED_TO_START";
        return this.presentFailure(runtimeCategory, "Typst CLI \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002", {
          command: "typst",
          reason: runtimeResult.reason
        });
      }
      try {
        const executionResult = await this.deps.execution.executePreview(
          targetResult.target,
          runtimeResult.resolvedCommand
        );
        await this.deps.presenter.openArtifact(executionResult.artifactPath);
        return {
          ok: true,
          message: "Preview Typst \u3092\u958B\u304D\u307E\u3057\u305F\u3002",
          artifactPath: executionResult.artifactPath
        };
      } catch (error) {
        const fallbackMessage = error instanceof Error ? error.message : "unknown";
        const category = this.deps.failurePolicy.classify(error, fallbackMessage);
        return this.presentFailure(
          category,
          fallbackMessage,
          {
            command: runtimeResult.resolvedCommand,
            path: targetResult.target.filePath,
            reason: fallbackMessage
          },
          error
        );
      }
    });
  }
  presentFailure(category, fallbackMessage, context, error) {
    const message = this.deps.failurePolicy.getNoticeMessage(category, context);
    const logContext = JSON.stringify({
      category,
      message: fallbackMessage,
      reason: context.reason
    });
    console.warn("[typsidian] preview failed", logContext);
    this.deps.onNotice(message);
    return {
      ok: false,
      message
    };
  }
};

// src/preview/previewContextResolver.ts
var PreviewContextResolver = class {
  constructor(getActiveFile) {
    this.getActiveFile = getActiveFile;
  }
  resolveTargetForCommand() {
    const activeFile = this.getActiveFile();
    if (!activeFile || !this.isTypFile(activeFile)) {
      return this.fail("NO_ACTIVE_TARGET");
    }
    const fileName = this.getFileName(activeFile.path);
    return {
      ok: true,
      target: {
        filePath: activeFile.path,
        displayName: fileName
      }
    };
  }
  isTypFile(file) {
    return file.extension.toLowerCase() === TYP_FILE_EXTENSION;
  }
  getFileName(path) {
    const index = path.lastIndexOf("/");
    if (index === -1) {
      return path;
    }
    return path.slice(index + 1);
  }
  fail(reason) {
    return { ok: false, reason };
  }
};

// src/preview/prerequisiteDiscoveryService.ts
var PrerequisiteDiscoveryService = class {
  constructor(verifier) {
    this.verifier = verifier;
  }
  async ensureRuntimeAvailable(commandName) {
    try {
      const available = await this.verifier.verify(commandName);
      if (!available) {
        return {
          ok: false,
          reason: "MISSING_RUNTIME"
        };
      }
      return {
        ok: true,
        resolvedCommand: commandName
      };
    } catch (error) {
      return {
        ok: false,
        reason: this.classifyError(error)
      };
    }
  }
  resetRuntimeCache() {
  }
  classifyError(error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return "MISSING_RUNTIME";
    }
    return "INVALID_PATH";
  }
};

// src/preview/previewFailurePolicy.ts
var PreviewFailurePolicy = class {
  classify(error, fallbackMessage) {
    const message = this.extractMessage(error);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return "DEPENDENCY_MISSING";
    }
    if (message.includes("timeout")) {
      return "PROCESS_TIMEOUT";
    }
    if (typeof error === "object" && error !== null && "exitCode" in error && error.exitCode !== 0) {
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
  getNoticeMessage(category, context) {
    switch (category) {
      case "DEPENDENCY_MISSING":
        return "Typst CLI \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002`typst` \u304C PATH \u304B\u3089\u5B9F\u884C\u3067\u304D\u308B\u304B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      case "PROCESS_TIMEOUT":
        return "Typst CLI \u306E\u5B9F\u884C\u304C\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F\u3002\u5165\u529B\u5185\u5BB9\u3092\u78BA\u8A8D\u3057\u3066\u518D\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
      case "PROCESS_EXIT_ERROR":
        return `Typst CLI \u304C ${context.command ?? "\u30B3\u30DE\u30F3\u30C9"} \u3067\u5931\u6557\u3057\u307E\u3057\u305F\u3002`;
      case "ARTIFACT_NOT_FOUND":
        return `PDF \u6210\u679C\u7269\u304C\u751F\u6210\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F: ${context.path ?? "\u4E0D\u660E"}`;
      case "ARTIFACT_OPEN_FAILED":
        return `PDF \u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F: ${context.path ?? "\u4E0D\u660E"}`;
      case "PROCESS_FAILED_TO_START":
      default:
        return "\u30D7\u30EC\u30D3\u30E5\u30FC\u5B9F\u884C\u3092\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002";
    }
  }
  extractMessage(error) {
    if (typeof error === "string") {
      return error.toLowerCase();
    }
    if (error instanceof Error) {
      return error.message.toLowerCase();
    }
    return "";
  }
};

// src/preview/externalCliRunner.ts
var import_node_child_process = require("node:child_process");
var NodeExternalCliRunner = class {
  async runWithArgs(command, args, options) {
    return this.runProcess(command, args, options);
  }
  runCommandString(commandLine, options) {
    const isWindows = process.platform === "win32";
    return this.runProcess(isWindows ? "cmd" : "sh", [isWindows ? "/c" : "-c", commandLine], options);
  }
  async runProcess(command, args, options) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const processOptions = {
        cwd: options.cwd,
        env: options.env
      };
      let child;
      try {
        child = (0, import_node_child_process.spawn)(command, args, {
          ...processOptions,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        reject(error);
        return;
      }
      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      const timeoutMs = options.timeoutMs;
      let timeoutId;
      if (typeof timeoutMs === "number" && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          void child.kill();
          resolve({
            exitCode: null,
            stdout,
            stderr: `${stderr}
process timeout after ${timeoutMs}ms`
          });
        }, timeoutMs);
      }
      child.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId !== void 0) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });
      child.on("close", (code) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId !== void 0) {
          clearTimeout(timeoutId);
        }
        resolve({
          exitCode: code,
          stdout,
          stderr
        });
      });
    });
  }
};

// src/preview/previewOutputPresenter.ts
var PreviewOutputPresenter = class {
  constructor(openInPane, openPath, revealPath) {
    this.openInPane = openInPane;
    this.openPath = openPath;
    this.revealPath = revealPath;
  }
  async openArtifact(path) {
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
  async revealInFolder(path) {
    this.revealPath(path);
  }
};

// src/preview/previewExecutionService.ts
var import_node_path = require("node:path");
var DefaultPreviewExecutionService = class {
  constructor(runner, publisher, runOptions = { timeoutMs: 1e5 }) {
    this.runner = runner;
    this.publisher = publisher;
    this.runOptions = runOptions;
  }
  async executePreview(target, command) {
    const artifactPath = this.publisher.computeOutputPath(target);
    const runResult = await this.runner.runWithArgs(
      command,
      ["compile", target.filePath, artifactPath],
      this.runOptions
    );
    if (runResult.exitCode !== 0) {
      throw Object.assign(new Error(runResult.stderr || "preview command failed"), {
        exitCode: runResult.exitCode,
        stdout: runResult.stdout,
        stderr: runResult.stderr
      });
    }
    const artifactPathForCheck = this.resolveArtifactPathForCheck(artifactPath);
    const exists = await this.publisher.ensureArtifactExists(artifactPathForCheck);
    if (!exists) {
      throw new Error(`artifact not found: ${artifactPathForCheck}`);
    }
    return {
      artifactPath,
      deterministicKey: artifactPath,
      commandRunAt: (/* @__PURE__ */ new Date()).toISOString(),
      processRun: runResult
    };
  }
  resolveArtifactPathForCheck(artifactPath) {
    if ((0, import_node_path.isAbsolute)(artifactPath)) {
      return artifactPath;
    }
    if (typeof this.runOptions.cwd === "string" && this.runOptions.cwd.length > 0) {
      return (0, import_node_path.join)(this.runOptions.cwd, artifactPath);
    }
    return artifactPath;
  }
};

// src/preview/previewOutputPublisher.ts
var import_promises = require("node:fs/promises");
var import_node_path2 = require("node:path");
var PreviewOutputPublisher = class {
  computeOutputPath(target) {
    const root = (0, import_node_path2.dirname)(target.filePath);
    const name = (0, import_node_path2.basename)(target.filePath);
    const stem = name.slice(0, name.length - (0, import_node_path2.extname)(name).length);
    return (0, import_node_path2.join)(root, `${stem}.pdf`);
  }
  async ensureArtifactExists(path) {
    try {
      await (0, import_promises.access)(path);
      return true;
    } catch {
      return false;
    }
  }
};

// src/preview/pluginStateGuard.ts
var PluginStateGuard = class {
  constructor(currentLeafProvider, restoreLeaf) {
    this.currentLeafProvider = currentLeafProvider;
    this.restoreLeaf = restoreLeaf;
  }
  leafToRestore = null;
  async withLeafPreserved(action) {
    const previousLeaf = this.currentLeafProvider();
    this.leafToRestore = previousLeaf;
    try {
      return await action();
    } finally {
      this.restoreActiveLeafIfNeeded();
      this.leafToRestore = null;
    }
  }
  restoreActiveLeafIfNeeded() {
    this.restoreIfChanged(this.leafToRestore);
  }
  restoreIfChanged(expectedLeaf) {
    if (expectedLeaf !== this.currentLeafProvider()) {
      this.restoreLeaf(expectedLeaf);
    }
  }
};

// src/main.ts
var TYP_EXTENSION = "typ";
var TYP_VIEW = "markdown";
var PREVIEW_ICON_PRIMARY = "panel-right-open";
var PREVIEW_ICON_FALLBACK = "play";
var NEW_TYP_NAME = "Untitled";
var NEW_TYP_EXT = `.${TYP_EXTENSION}`;
var TYP_FILE_EXTENSIONS = [TYP_EXTENSION, "Typ", "TYP"];
var TypsidianPlugin = class extends import_obsidian.Plugin {
  previousActiveLeaf = null;
  currentActiveLeaf = null;
  previewCommandController = null;
  previewHeaderActions = /* @__PURE__ */ new Map();
  previewIcon = this.resolvePreviewIcon();
  async onload() {
    this.currentActiveLeaf = this.app.workspace.getMostRecentLeaf();
    this.app.workspace.onLayoutReady(() => {
      this.registerExtensions(Array.from(TYP_FILE_EXTENSIONS), TYP_VIEW);
      this.registerTypLifecycleObserver();
      this.registerTypContextMenuActions();
      this.registerPreviewCommand();
      this.syncPreviewHeaderAction(this.currentActiveLeaf);
      this.logStartupState();
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange)
    );
    this.registerEvent(
      this.app.workspace.on("file-open", this.handleFileOpen)
    );
    console.info("[typsidian] plugin loaded");
  }
  handleFileOpen = (file) => {
    this.syncPreviewHeaderAction(this.app.workspace.getMostRecentLeaf());
    if (!file || !this.isTypFile(file)) {
      return;
    }
    if (!this.isTypFileAccessible(file)) {
      this.restoreActiveLeaf(this.previousActiveLeaf);
      new import_obsidian.Notice(
        ".typ \u30D5\u30A1\u30A4\u30EB\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D5\u30A1\u30A4\u30EB\u304C\u958B\u3051\u308B\u72B6\u614B\u304B\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044"
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
  handleActiveLeafChange = (leaf) => {
    if (leaf === this.currentActiveLeaf) {
      return;
    }
    this.previousActiveLeaf = this.currentActiveLeaf;
    this.currentActiveLeaf = leaf;
    this.syncPreviewHeaderAction(leaf);
  };
  registerTypLifecycleObserver() {
    this.registerEvent(this.app.vault.on("create", this.handleVaultCreate));
    this.registerEvent(this.app.vault.on("rename", this.handleVaultRename));
    this.registerEvent(this.app.vault.on("delete", this.handleVaultDelete));
  }
  registerTypContextMenuActions() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.addNewTypContextMenuItem(menu, this.getTargetFolder(file));
      })
    );
    this.registerEvent(
      this.app.workspace.on(
        "files-menu",
        (menu, files) => {
          const targetFile = files?.[0];
          this.addNewTypContextMenuItem(menu, this.getTargetFolder(targetFile));
        }
      )
    );
  }
  registerPreviewCommand() {
    const commandController = this.createPreviewCommandController();
    this.previewCommandController = commandController;
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
      }
    });
  }
  syncPreviewHeaderAction(leaf) {
    if (!leaf || !(leaf.view instanceof import_obsidian.MarkdownView)) {
      if (leaf) {
        this.removePreviewHeaderAction(leaf);
      }
      return;
    }
    const activeFile = leaf.view.file;
    if (!activeFile || !this.isTypFile(activeFile)) {
      this.removePreviewHeaderAction(leaf);
      return;
    }
    if (!this.previewCommandController || this.previewHeaderActions.has(leaf)) {
      return;
    }
    const action = leaf.view.addAction(this.previewIcon, PREVIEW_COMMAND_NAME, () => {
      void this.runPreviewFromRibbon();
    });
    this.previewHeaderActions.set(leaf, action);
  }
  removePreviewHeaderAction(leaf) {
    const action = this.previewHeaderActions.get(leaf);
    if (!action) {
      return;
    }
    action.remove();
    this.previewHeaderActions.delete(leaf);
  }
  async runPreviewFromRibbon() {
    if (!this.previewCommandController) {
      return;
    }
    if (!this.previewCommandController.isCommandAvailable()) {
      return;
    }
    await this.previewCommandController.runFromCurrentContext();
  }
  createPreviewCommandController() {
    const getActiveLike = () => {
      const activeFile = this.app.workspace.getActiveFile();
      if (!activeFile) {
        return null;
      }
      return {
        path: activeFile.path,
        extension: activeFile.extension
      };
    };
    const vaultBasePath = this.getVaultBasePath();
    const runner = new NodeExternalCliRunner();
    const outputPublisher = new PreviewOutputPublisher();
    const execution = new DefaultPreviewExecutionService(
      runner,
      outputPublisher,
      vaultBasePath ? { cwd: vaultBasePath } : {}
    );
    const presenter = new PreviewOutputPresenter(
      (path) => this.openInRightPane(path),
      (path) => this.openBySystem(this.resolveVaultPath(path)),
      (path) => {
        void this.revealInOs(this.resolveVaultPath(path));
      }
    );
    const failurePolicy = new PreviewFailurePolicy();
    const stateGuard = new PluginStateGuard(
      () => this.currentActiveLeaf,
      (leaf) => this.restoreActiveLeaf(leaf)
    );
    const runtime = new PrerequisiteDiscoveryService({
      verify: (commandName) => new Promise((resolve) => {
        const testProcess = (0, import_node_child_process2.spawn)(commandName, ["--version"], {
          stdio: ["ignore", "ignore", "pipe"],
          cwd: vaultBasePath ?? void 0
        });
        testProcess.on("error", () => {
          resolve(false);
        });
        testProcess.on("close", (code) => {
          resolve(code === 0 || code === null);
        });
      })
    });
    return new DefaultPreviewCommandController({
      resolver: new PreviewContextResolver(getActiveLike),
      runtime,
      execution,
      presenter,
      failurePolicy,
      stateGuard,
      onNotice: (message) => new import_obsidian.Notice(message)
    });
  }
  openBySystem(path) {
    return new Promise((resolve) => {
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
      const args = process.platform === "win32" ? ["/c", "start", path] : process.platform === "darwin" ? [path] : [path];
      let child;
      try {
        child = (0, import_node_child_process2.spawn)(command, args, {
          stdio: ["ignore", "ignore", "pipe"]
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
  async openInRightPane(path) {
    const target = this.app.vault.getAbstractFileByPath(path);
    if (!(target instanceof import_obsidian.TFile)) {
      throw new Error(`artifact is not a vault file: ${path}`);
    }
    const rightLeaf = this.app.workspace.getLeaf("split", "vertical");
    await rightLeaf.openFile(target, { active: false });
  }
  async revealInOs(path) {
    const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", path] : process.platform === "darwin" ? ["-R", path] : [path];
    await this.openBySystemWithArgs(command, args);
  }
  openBySystemWithArgs(command, args) {
    return new Promise((resolve) => {
      let child;
      try {
        child = (0, import_node_child_process2.spawn)(command, args, {
          stdio: ["ignore", "ignore", "ignore"]
        });
      } catch {
        resolve();
        return;
      }
      child.on("close", () => resolve());
      child.on("error", () => resolve());
    });
  }
  resolveVaultPath(relativePath) {
    const vaultBasePath = this.getVaultBasePath();
    if (!vaultBasePath) {
      return relativePath;
    }
    return (0, import_node_path3.join)(vaultBasePath, relativePath);
  }
  getVaultBasePath() {
    const adapter = this.app.vault.adapter;
    const maybeGetBasePath = "getBasePath" in adapter && typeof adapter.getBasePath === "function" ? adapter.getBasePath : null;
    if (!maybeGetBasePath) {
      return null;
    }
    return maybeGetBasePath.call(adapter);
  }
  addNewTypContextMenuItem(menu, target) {
    menu.addItem((item) => {
      item.setTitle("New Typst").setIcon("file-plus-corner").onClick(async () => {
        try {
          const name = await this.resolveUniqueTypFileName(target);
          const targetPath = this.joinPath(target.path, name);
          const created = await this.app.vault.create(targetPath, "");
          await this.app.workspace.getLeaf(false).openFile(created);
        } catch (error) {
          console.error("[typsidian] failed to create typ file", error);
          new import_obsidian.Notice(".typ \u30D5\u30A1\u30A4\u30EB\u306E\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F");
        }
      });
    });
  }
  async resolveUniqueTypFileName(folder) {
    const initialName = `${NEW_TYP_NAME}${NEW_TYP_EXT}`;
    if (!this.app.vault.getAbstractFileByPath(
      this.joinPath(folder.path, initialName)
    )) {
      return initialName;
    }
    let counter = 1;
    while (true) {
      const name = `${NEW_TYP_NAME} ${counter}${NEW_TYP_EXT}`;
      if (!this.app.vault.getAbstractFileByPath(this.joinPath(folder.path, name))) {
        return name;
      }
      counter += 1;
    }
  }
  getTargetFolder(file) {
    if (file instanceof import_obsidian.TFolder) {
      return file;
    }
    if (file instanceof import_obsidian.TFile) {
      return file.parent ?? this.app.vault.getRoot();
    }
    return this.app.vault.getRoot();
  }
  isTypFile(file) {
    return file instanceof import_obsidian.TFile && file.extension.toLowerCase() === TYP_EXTENSION;
  }
  getLeafByTypFile(path) {
    return this.app.workspace.getLeavesOfType(TYP_VIEW).find(
      (leaf) => leaf.view instanceof import_obsidian.MarkdownView && leaf.view.file?.path === path
    ) || null;
  }
  handleVaultCreate = (file) => {
    if (!this.isTypFile(file)) {
      return;
    }
    this.logLifecycle("create", file);
  };
  handleVaultRename = (file, oldPath) => {
    if (!this.isTypFile(file)) {
      return;
    }
    this.logLifecycle("rename", file, oldPath);
  };
  handleVaultDelete = (file) => {
    if (!this.isTypFile(file)) {
      return;
    }
    this.logLifecycle("delete", file);
  };
  isTypFileAccessible(file) {
    return this.app.vault.getAbstractFileByPath(file.path) instanceof import_obsidian.TFile;
  }
  restoreActiveLeaf(leaf) {
    if (!leaf) {
      return;
    }
    const activeLeaf = this.currentActiveLeaf;
    if (activeLeaf === leaf) {
      return;
    }
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
  logLifecycle(eventName, file, oldPath) {
    if (oldPath) {
      console.info(`[typsidian] ${eventName}: ${oldPath} -> ${file.path}`);
      return;
    }
    console.info(`[typsidian] ${eventName}: ${file.path}`);
  }
  logStartupState() {
    console.info(
      "[typsidian] startup observers and context menu actions registered"
    );
  }
  joinPath(folderPath, fileName) {
    if (!folderPath) {
      return fileName;
    }
    return `${folderPath}/${fileName}`;
  }
  resolvePreviewIcon() {
    if ((0, import_obsidian.getIcon)(PREVIEW_ICON_PRIMARY)) {
      return PREVIEW_ICON_PRIMARY;
    }
    return PREVIEW_ICON_FALLBACK;
  }
  onunload() {
    for (const action of this.previewHeaderActions.values()) {
      action.remove();
    }
    this.previewHeaderActions.clear();
    console.info("[typsidian] plugin unloaded");
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3ByZXZpZXcvY29udHJhY3RzLnRzIiwgInNyYy9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3Q29udGV4dFJlc29sdmVyLnRzIiwgInNyYy9wcmV2aWV3L3ByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2UudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld0ZhaWx1cmVQb2xpY3kudHMiLCAic3JjL3ByZXZpZXcvZXh0ZXJuYWxDbGlSdW5uZXIudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld091dHB1dFByZXNlbnRlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3RXhlY3V0aW9uU2VydmljZS50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyLnRzIiwgInNyYy9wcmV2aWV3L3BsdWdpblN0YXRlR3VhcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIGdldEljb24sXG4gIE1hcmtkb3duVmlldyxcbiAgTWVudSxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFRBYnN0cmFjdEZpbGUsXG4gIFRGaWxlLFxuICBURm9sZGVyLFxuICBXb3Jrc3BhY2VMZWFmLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IENoaWxkUHJvY2Vzcywgc3Bhd24gfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHtcbiAgUFJFVklFV19DT01NQU5EX0lELFxuICBQUkVWSUVXX0NPTU1BTkRfTkFNRSxcbn0gZnJvbSBcIi4vcHJldmlldy9jb250cmFjdHNcIjtcbmltcG9ydCB7IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlclwiO1xuaW1wb3J0IHsgUHJldmlld0NvbnRleHRSZXNvbHZlciB9IGZyb20gXCIuL3ByZXZpZXcvcHJldmlld0NvbnRleHRSZXNvbHZlclwiO1xuaW1wb3J0IHsgUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZSB9IGZyb20gXCIuL3ByZXZpZXcvcHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZVwiO1xuaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVQb2xpY3kgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdGYWlsdXJlUG9saWN5XCI7XG5pbXBvcnQgeyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIgfSBmcm9tIFwiLi9wcmV2aWV3L2V4dGVybmFsQ2xpUnVubmVyXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHJlc2VudGVyXCI7XG5pbXBvcnQgeyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdFeGVjdXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyXCI7XG5pbXBvcnQgeyBQbHVnaW5TdGF0ZUd1YXJkIH0gZnJvbSBcIi4vcHJldmlldy9wbHVnaW5TdGF0ZUd1YXJkXCI7XG5cbmNvbnN0IFRZUF9FWFRFTlNJT04gPSBcInR5cFwiO1xuY29uc3QgVFlQX1ZJRVcgPSBcIm1hcmtkb3duXCI7XG5jb25zdCBQUkVWSUVXX0lDT05fUFJJTUFSWSA9IFwicGFuZWwtcmlnaHQtb3BlblwiO1xuY29uc3QgUFJFVklFV19JQ09OX0ZBTExCQUNLID0gXCJwbGF5XCI7XG5jb25zdCBORVdfVFlQX05BTUUgPSBcIlVudGl0bGVkXCI7XG5jb25zdCBORVdfVFlQX0VYVCA9IGAuJHtUWVBfRVhURU5TSU9OfWA7XG5jb25zdCBUWVBfRklMRV9FWFRFTlNJT05TID0gW1RZUF9FWFRFTlNJT04sIFwiVHlwXCIsIFwiVFlQXCJdIGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVHlwTGlmZWN5Y2xlRXZlbnRUYXJnZXQge1xuICBwYXRoOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHlwc2lkaWFuUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBwcmV2aW91c0FjdGl2ZUxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdXJyZW50QWN0aXZlTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHByZXZpZXdDb21tYW5kQ29udHJvbGxlcjogRGVmYXVsdFByZXZpZXdDb21tYW5kQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHByZXZpZXdIZWFkZXJBY3Rpb25zID0gbmV3IE1hcDxXb3Jrc3BhY2VMZWFmLCBIVE1MRWxlbWVudD4oKTtcbiAgcHJpdmF0ZSByZWFkb25seSBwcmV2aWV3SWNvbiA9IHRoaXMucmVzb2x2ZVByZXZpZXdJY29uKCk7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY3VycmVudEFjdGl2ZUxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMucmVnaXN0ZXJFeHRlbnNpb25zKEFycmF5LmZyb20oVFlQX0ZJTEVfRVhURU5TSU9OUyksIFRZUF9WSUVXKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpO1xuICAgICAgdGhpcy5yZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpO1xuICAgICAgdGhpcy5yZWdpc3RlclByZXZpZXdDb21tYW5kKCk7XG4gICAgICB0aGlzLnN5bmNQcmV2aWV3SGVhZGVyQWN0aW9uKHRoaXMuY3VycmVudEFjdGl2ZUxlYWYpO1xuICAgICAgdGhpcy5sb2dTdGFydHVwU3RhdGUoKTtcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCB0aGlzLmhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UpLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHRoaXMuaGFuZGxlRmlsZU9wZW4pLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gbG9hZGVkXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVGaWxlT3BlbiA9IChmaWxlOiBURmlsZSB8IG51bGwpOiB2b2lkID0+IHtcbiAgICB0aGlzLnN5bmNQcmV2aWV3SGVhZGVyQWN0aW9uKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpKTtcblxuICAgIGlmICghZmlsZSB8fCAhdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlQWNjZXNzaWJsZShmaWxlKSkge1xuICAgICAgdGhpcy5yZXN0b3JlQWN0aXZlTGVhZih0aGlzLnByZXZpb3VzQWN0aXZlTGVhZik7XG4gICAgICBuZXcgTm90aWNlKFxuICAgICAgICBcIi50eXAgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDkyXHU5NThCXHUzMDUxXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDY3XHUzMDU3XHUzMDVGXHUzMDAyXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDRDXHU5NThCXHUzMDUxXHUzMDhCXHU3MkI2XHU2MTRCXHUzMDRCXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nTGVhZiA9IHRoaXMuZ2V0TGVhZkJ5VHlwRmlsZShmaWxlLnBhdGgpO1xuXG4gICAgaWYgKCFleGlzdGluZ0xlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY3RpdmVMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldE1vc3RSZWNlbnRMZWFmKCk7XG4gICAgaWYgKGFjdGl2ZUxlYWYgPT09IGV4aXN0aW5nTGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5zZXRBY3RpdmVMZWFmKGV4aXN0aW5nTGVhZiwgeyBmb2N1czogdHJ1ZSB9KTtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UgPSAobGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkID0+IHtcbiAgICBpZiAobGVhZiA9PT0gdGhpcy5jdXJyZW50QWN0aXZlTGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucHJldmlvdXNBY3RpdmVMZWFmID0gdGhpcy5jdXJyZW50QWN0aXZlTGVhZjtcbiAgICB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmID0gbGVhZjtcbiAgICB0aGlzLnN5bmNQcmV2aWV3SGVhZGVyQWN0aW9uKGxlYWYpO1xuICB9O1xuXG4gIHByaXZhdGUgcmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgdGhpcy5oYW5kbGVWYXVsdENyZWF0ZSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCB0aGlzLmhhbmRsZVZhdWx0UmVuYW1lKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKFwiZGVsZXRlXCIsIHRoaXMuaGFuZGxlVmF1bHREZWxldGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJUeXBDb250ZXh0TWVudUFjdGlvbnMoKTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51OiBNZW51LCBmaWxlOiBUQWJzdHJhY3RGaWxlKSA9PiB7XG4gICAgICAgIHRoaXMuYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnUsIHRoaXMuZ2V0VGFyZ2V0Rm9sZGVyKGZpbGUpKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXG4gICAgICAgIFwiZmlsZXMtbWVudVwiLFxuICAgICAgICAobWVudTogTWVudSwgZmlsZXM6IFRBYnN0cmFjdEZpbGVbXSB8IG51bGwpID0+IHtcbiAgICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gZmlsZXM/LlswXTtcbiAgICAgICAgICB0aGlzLmFkZE5ld1R5cENvbnRleHRNZW51SXRlbShtZW51LCB0aGlzLmdldFRhcmdldEZvbGRlcih0YXJnZXRGaWxlKSk7XG4gICAgICAgIH0sXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyUHJldmlld0NvbW1hbmQoKTogdm9pZCB7XG4gICAgY29uc3QgY29tbWFuZENvbnRyb2xsZXIgPSB0aGlzLmNyZWF0ZVByZXZpZXdDb21tYW5kQ29udHJvbGxlcigpO1xuICAgIHRoaXMucHJldmlld0NvbW1hbmRDb250cm9sbGVyID0gY29tbWFuZENvbnRyb2xsZXI7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFBSRVZJRVdfQ09NTUFORF9JRCxcbiAgICAgIG5hbWU6IFBSRVZJRVdfQ09NTUFORF9OQU1FLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzQXZhaWxhYmxlID0gY29tbWFuZENvbnRyb2xsZXIuaXNDb21tYW5kQXZhaWxhYmxlKCk7XG5cbiAgICAgICAgaWYgKGNoZWNraW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGlzQXZhaWxhYmxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0F2YWlsYWJsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZvaWQgY29tbWFuZENvbnRyb2xsZXIucnVuRnJvbUN1cnJlbnRDb250ZXh0KCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY1ByZXZpZXdIZWFkZXJBY3Rpb24obGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkIHtcbiAgICBpZiAoIWxlYWYgfHwgIShsZWFmLnZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcpKSB7XG4gICAgICBpZiAobGVhZikge1xuICAgICAgICB0aGlzLnJlbW92ZVByZXZpZXdIZWFkZXJBY3Rpb24obGVhZik7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IGxlYWYudmlldy5maWxlO1xuICAgIGlmICghYWN0aXZlRmlsZSB8fCAhdGhpcy5pc1R5cEZpbGUoYWN0aXZlRmlsZSkpIHtcbiAgICAgIHRoaXMucmVtb3ZlUHJldmlld0hlYWRlckFjdGlvbihsZWFmKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMucHJldmlld0NvbW1hbmRDb250cm9sbGVyIHx8IHRoaXMucHJldmlld0hlYWRlckFjdGlvbnMuaGFzKGxlYWYpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aW9uID0gbGVhZi52aWV3LmFkZEFjdGlvbih0aGlzLnByZXZpZXdJY29uLCBQUkVWSUVXX0NPTU1BTkRfTkFNRSwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLnJ1blByZXZpZXdGcm9tUmliYm9uKCk7XG4gICAgfSk7XG4gICAgdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy5zZXQobGVhZiwgYWN0aW9uKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlUHJldmlld0hlYWRlckFjdGlvbihsZWFmOiBXb3Jrc3BhY2VMZWFmKTogdm9pZCB7XG4gICAgY29uc3QgYWN0aW9uID0gdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy5nZXQobGVhZik7XG4gICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhY3Rpb24ucmVtb3ZlKCk7XG4gICAgdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy5kZWxldGUobGVhZik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJ1blByZXZpZXdGcm9tUmliYm9uKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5wcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMucHJldmlld0NvbW1hbmRDb250cm9sbGVyLmlzQ29tbWFuZEF2YWlsYWJsZSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5wcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIucnVuRnJvbUN1cnJlbnRDb250ZXh0KCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVByZXZpZXdDb21tYW5kQ29udHJvbGxlcigpOiBEZWZhdWx0UHJldmlld0NvbW1hbmRDb250cm9sbGVyIHtcbiAgICBjb25zdCBnZXRBY3RpdmVMaWtlID0gKCkgPT4ge1xuICAgICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICBpZiAoIWFjdGl2ZUZpbGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHBhdGg6IGFjdGl2ZUZpbGUucGF0aCxcbiAgICAgICAgZXh0ZW5zaW9uOiBhY3RpdmVGaWxlLmV4dGVuc2lvbixcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGNvbnN0IHZhdWx0QmFzZVBhdGggPSB0aGlzLmdldFZhdWx0QmFzZVBhdGgoKTtcblxuICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIoKTtcbiAgICBjb25zdCBvdXRwdXRQdWJsaXNoZXIgPSBuZXcgUHJldmlld091dHB1dFB1Ymxpc2hlcigpO1xuICAgIGNvbnN0IGV4ZWN1dGlvbiA9IG5ldyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UoXG4gICAgICBydW5uZXIsXG4gICAgICBvdXRwdXRQdWJsaXNoZXIsXG4gICAgICB2YXVsdEJhc2VQYXRoID8geyBjd2Q6IHZhdWx0QmFzZVBhdGggfSA6IHt9LFxuICAgICk7XG4gICAgY29uc3QgcHJlc2VudGVyID0gbmV3IFByZXZpZXdPdXRwdXRQcmVzZW50ZXIoXG4gICAgICAocGF0aCkgPT4gdGhpcy5vcGVuSW5SaWdodFBhbmUocGF0aCksXG4gICAgICAocGF0aCkgPT4gdGhpcy5vcGVuQnlTeXN0ZW0odGhpcy5yZXNvbHZlVmF1bHRQYXRoKHBhdGgpKSxcbiAgICAgIChwYXRoKSA9PiB7XG4gICAgICAgIHZvaWQgdGhpcy5yZXZlYWxJbk9zKHRoaXMucmVzb2x2ZVZhdWx0UGF0aChwYXRoKSk7XG4gICAgICB9LFxuICAgICk7XG4gICAgY29uc3QgZmFpbHVyZVBvbGljeSA9IG5ldyBQcmV2aWV3RmFpbHVyZVBvbGljeSgpO1xuICAgIGNvbnN0IHN0YXRlR3VhcmQgPSBuZXcgUGx1Z2luU3RhdGVHdWFyZChcbiAgICAgICgpID0+IHRoaXMuY3VycmVudEFjdGl2ZUxlYWYsXG4gICAgICAobGVhZikgPT4gdGhpcy5yZXN0b3JlQWN0aXZlTGVhZihsZWFmKSxcbiAgICApO1xuICAgIGNvbnN0IHJ1bnRpbWUgPSBuZXcgUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZSh7XG4gICAgICB2ZXJpZnk6IChjb21tYW5kTmFtZSkgPT5cbiAgICAgICAgbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICBjb25zdCB0ZXN0UHJvY2VzcyA9IHNwYXduKGNvbW1hbmROYW1lLCBbXCItLXZlcnNpb25cIl0sIHtcbiAgICAgICAgICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJpZ25vcmVcIiwgXCJwaXBlXCJdLFxuICAgICAgICAgICAgY3dkOiB2YXVsdEJhc2VQYXRoID8/IHVuZGVmaW5lZCxcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHRlc3RQcm9jZXNzLm9uKFwiZXJyb3JcIiwgKCkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZShmYWxzZSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB0ZXN0UHJvY2Vzcy5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKGNvZGUgPT09IDAgfHwgY29kZSA9PT0gbnVsbCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBEZWZhdWx0UHJldmlld0NvbW1hbmRDb250cm9sbGVyKHtcbiAgICAgIHJlc29sdmVyOiBuZXcgUHJldmlld0NvbnRleHRSZXNvbHZlcihnZXRBY3RpdmVMaWtlKSxcbiAgICAgIHJ1bnRpbWUsXG4gICAgICBleGVjdXRpb24sXG4gICAgICBwcmVzZW50ZXIsXG4gICAgICBmYWlsdXJlUG9saWN5LFxuICAgICAgc3RhdGVHdWFyZCxcbiAgICAgIG9uTm90aWNlOiAobWVzc2FnZSkgPT4gbmV3IE5vdGljZShtZXNzYWdlKSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgb3BlbkJ5U3lzdGVtKHBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmcgfCBudWxsPigocmVzb2x2ZSkgPT4ge1xuICAgICAgY29uc3QgY29tbWFuZCA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIgPyBcIm9wZW5cIiA6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIiA/IFwiY21kXCIgOiBcInhkZy1vcGVuXCI7XG4gICAgICBjb25zdCBhcmdzID1cbiAgICAgICAgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiXG4gICAgICAgICAgPyBbXCIvY1wiLCBcInN0YXJ0XCIsIHBhdGhdXG4gICAgICAgICAgOiBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiXG4gICAgICAgICAgICA/IFtwYXRoXVxuICAgICAgICAgICAgOiBbcGF0aF07XG5cbiAgICAgIGxldCBjaGlsZDogQ2hpbGRQcm9jZXNzO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY2hpbGQgPSBzcGF3bihjb21tYW5kLCBhcmdzLCB7XG4gICAgICAgICAgc3RkaW86IFtcImlnbm9yZVwiLCBcImlnbm9yZVwiLCBcInBpcGVcIl0sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZDogJHtTdHJpbmcoZXJyb3IpfWApO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxldCBzdGRlcnIgPSBcIlwiO1xuICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICAgIHN0ZGVyciArPSBTdHJpbmcoY2h1bmspO1xuICAgICAgfSk7XG5cbiAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycm9yKSA9PiB7XG4gICAgICAgIHJlc29sdmUoYG9wZW4gY29tbWFuZCBmYWlsZWQ6ICR7U3RyaW5nKGVycm9yKX1gKTtcbiAgICAgIH0pO1xuXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XG4gICAgICAgIGlmIChjb2RlID09PSAwIHx8IGNvZGUgPT09IG51bGwpIHtcbiAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdGRlcnIubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJlc29sdmUoYG9wZW4gY29tbWFuZCBmYWlsZWQ6ICR7c3RkZXJyfWApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc29sdmUoYG9wZW4gY29tbWFuZCBmYWlsZWQgd2l0aCBleGl0IGNvZGUgJHtTdHJpbmcoY29kZSl9YCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgb3BlbkluUmlnaHRQYW5lKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcbiAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgYXJ0aWZhY3QgaXMgbm90IGEgdmF1bHQgZmlsZTogJHtwYXRofWApO1xuICAgIH1cblxuICAgIGNvbnN0IHJpZ2h0TGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKFwic3BsaXRcIiwgXCJ2ZXJ0aWNhbFwiKTtcbiAgICBhd2FpdCByaWdodExlYWYub3BlbkZpbGUodGFyZ2V0LCB7IGFjdGl2ZTogZmFsc2UgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJldmVhbEluT3MocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgY29tbWFuZCA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCIgPyBcIm9wZW5cIiA6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIiA/IFwiY21kXCIgOiBcInhkZy1vcGVuXCI7XG4gICAgY29uc3QgYXJncyA9XG4gICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCJcbiAgICAgICAgPyBbXCIvY1wiLCBcInN0YXJ0XCIsIHBhdGhdXG4gICAgICAgIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIlxuICAgICAgICAgID8gW1wiLVJcIiwgcGF0aF1cbiAgICAgICAgICA6IFtwYXRoXTtcblxuICAgIGF3YWl0IHRoaXMub3BlbkJ5U3lzdGVtV2l0aEFyZ3MoY29tbWFuZCwgYXJncyk7XG4gIH1cblxuICBwcml2YXRlIG9wZW5CeVN5c3RlbVdpdGhBcmdzKGNvbW1hbmQ6IHN0cmluZywgYXJnczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIGxldCBjaGlsZDogQ2hpbGRQcm9jZXNzO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY2hpbGQgPSBzcGF3bihjb21tYW5kLCBhcmdzLCB7XG4gICAgICAgICAgc3RkaW86IFtcImlnbm9yZVwiLCBcImlnbm9yZVwiLCBcImlnbm9yZVwiXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNoaWxkLm9uKFwiY2xvc2VcIiwgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKCkgPT4gcmVzb2x2ZSgpKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzb2x2ZVZhdWx0UGF0aChyZWxhdGl2ZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgdmF1bHRCYXNlUGF0aCA9IHRoaXMuZ2V0VmF1bHRCYXNlUGF0aCgpO1xuICAgIGlmICghdmF1bHRCYXNlUGF0aCkge1xuICAgICAgcmV0dXJuIHJlbGF0aXZlUGF0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gam9pbih2YXVsdEJhc2VQYXRoLCByZWxhdGl2ZVBhdGgpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRWYXVsdEJhc2VQYXRoKCk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xuICAgIGNvbnN0IG1heWJlR2V0QmFzZVBhdGggPVxuICAgICAgXCJnZXRCYXNlUGF0aFwiIGluIGFkYXB0ZXIgJiYgdHlwZW9mIGFkYXB0ZXIuZ2V0QmFzZVBhdGggPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/IGFkYXB0ZXIuZ2V0QmFzZVBhdGhcbiAgICAgICAgOiBudWxsO1xuXG4gICAgaWYgKCFtYXliZUdldEJhc2VQYXRoKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gbWF5YmVHZXRCYXNlUGF0aC5jYWxsKGFkYXB0ZXIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGROZXdUeXBDb250ZXh0TWVudUl0ZW0obWVudTogTWVudSwgdGFyZ2V0OiBURm9sZGVyKTogdm9pZCB7XG4gICAgbWVudS5hZGRJdGVtKChpdGVtKSA9PiB7XG4gICAgICBpdGVtXG4gICAgICAgIC5zZXRUaXRsZShcIk5ldyBUeXBzdFwiKVxuICAgICAgICAuc2V0SWNvbihcImZpbGUtcGx1cy1jb3JuZXJcIilcbiAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gYXdhaXQgdGhpcy5yZXNvbHZlVW5pcXVlVHlwRmlsZU5hbWUodGFyZ2V0KTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0aGlzLmpvaW5QYXRoKHRhcmdldC5wYXRoLCBuYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUodGFyZ2V0UGF0aCwgXCJcIik7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKGZhbHNlKS5vcGVuRmlsZShjcmVhdGVkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlt0eXBzaWRpYW5dIGZhaWxlZCB0byBjcmVhdGUgdHlwIGZpbGVcIiwgZXJyb3IpO1xuICAgICAgICAgICAgbmV3IE5vdGljZShcIi50eXAgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDZFXHU0RjVDXHU2MjEwXHUzMDZCXHU1OTMxXHU2NTU3XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlc29sdmVVbmlxdWVUeXBGaWxlTmFtZShmb2xkZXI6IFRGb2xkZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGluaXRpYWxOYW1lID0gYCR7TkVXX1RZUF9OQU1FfSR7TkVXX1RZUF9FWFR9YDtcbiAgICBpZiAoXG4gICAgICAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKFxuICAgICAgICB0aGlzLmpvaW5QYXRoKGZvbGRlci5wYXRoLCBpbml0aWFsTmFtZSksXG4gICAgICApXG4gICAgKSB7XG4gICAgICByZXR1cm4gaW5pdGlhbE5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvdW50ZXIgPSAxO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBuYW1lID0gYCR7TkVXX1RZUF9OQU1FfSAke2NvdW50ZXJ9JHtORVdfVFlQX0VYVH1gO1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRoaXMuam9pblBhdGgoZm9sZGVyLnBhdGgsIG5hbWUpKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiBuYW1lO1xuICAgICAgfVxuICAgICAgY291bnRlciArPSAxO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0VGFyZ2V0Rm9sZGVyKGZpbGU/OiBUQWJzdHJhY3RGaWxlKTogVEZvbGRlciB7XG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICByZXR1cm4gZmlsZS5wYXJlbnQgPz8gdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG4gIH1cblxuICBwcml2YXRlIGlzVHlwRmlsZShmaWxlOiBUQWJzdHJhY3RGaWxlKTogZmlsZSBpcyBURmlsZSB7XG4gICAgcmV0dXJuIGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpID09PSBUWVBfRVhURU5TSU9OO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMZWFmQnlUeXBGaWxlKHBhdGg6IHN0cmluZyk6IFdvcmtzcGFjZUxlYWYgfCBudWxsIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlXG4gICAgICAgIC5nZXRMZWF2ZXNPZlR5cGUoVFlQX1ZJRVcpXG4gICAgICAgIC5maW5kKChsZWFmKSA9PlxuICAgICAgICAgIGxlYWYudmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldyAmJiBsZWFmLnZpZXcuZmlsZT8ucGF0aCA9PT0gcGF0aFxuICAgICAgICApIHx8XG4gICAgICBudWxsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlVmF1bHRDcmVhdGUgPSAoZmlsZTogVEFic3RyYWN0RmlsZSk6IHZvaWQgPT4ge1xuICAgIGlmICghdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0xpZmVjeWNsZShcImNyZWF0ZVwiLCBmaWxlKTtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZVZhdWx0UmVuYW1lID0gKGZpbGU6IFRBYnN0cmFjdEZpbGUsIG9sZFBhdGg6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgIGlmICghdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0xpZmVjeWNsZShcInJlbmFtZVwiLCBmaWxlLCBvbGRQYXRoKTtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZVZhdWx0RGVsZXRlID0gKGZpbGU6IFRBYnN0cmFjdEZpbGUpOiB2b2lkID0+IHtcbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sb2dMaWZlY3ljbGUoXCJkZWxldGVcIiwgZmlsZSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBpc1R5cEZpbGVBY2Nlc3NpYmxlKGZpbGU6IFRGaWxlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlLnBhdGgpIGluc3RhbmNlb2YgVEZpbGU7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVBY3RpdmVMZWFmKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCB7XG4gICAgaWYgKCFsZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlTGVhZiA9IHRoaXMuY3VycmVudEFjdGl2ZUxlYWY7XG4gICAgaWYgKGFjdGl2ZUxlYWYgPT09IGxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uuc2V0QWN0aXZlTGVhZihsZWFmLCB7IGZvY3VzOiB0cnVlIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2dMaWZlY3ljbGUoXG4gICAgZXZlbnROYW1lOiBcImNyZWF0ZVwiIHwgXCJyZW5hbWVcIiB8IFwiZGVsZXRlXCIsXG4gICAgZmlsZTogVHlwTGlmZWN5Y2xlRXZlbnRUYXJnZXQsXG4gICAgb2xkUGF0aD86IHN0cmluZyxcbiAgKTogdm9pZCB7XG4gICAgaWYgKG9sZFBhdGgpIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhgW3R5cHNpZGlhbl0gJHtldmVudE5hbWV9OiAke29sZFBhdGh9IC0+ICR7ZmlsZS5wYXRofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUuaW5mbyhgW3R5cHNpZGlhbl0gJHtldmVudE5hbWV9OiAke2ZpbGUucGF0aH1gKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9nU3RhcnR1cFN0YXRlKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgIFwiW3R5cHNpZGlhbl0gc3RhcnR1cCBvYnNlcnZlcnMgYW5kIGNvbnRleHQgbWVudSBhY3Rpb25zIHJlZ2lzdGVyZWRcIixcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBqb2luUGF0aChmb2xkZXJQYXRoOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICghZm9sZGVyUGF0aCkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lO1xuICAgIH1cblxuICAgIHJldHVybiBgJHtmb2xkZXJQYXRofS8ke2ZpbGVOYW1lfWA7XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVQcmV2aWV3SWNvbigpOiBzdHJpbmcge1xuICAgIGlmIChnZXRJY29uKFBSRVZJRVdfSUNPTl9QUklNQVJZKSkge1xuICAgICAgcmV0dXJuIFBSRVZJRVdfSUNPTl9QUklNQVJZO1xuICAgIH1cblxuICAgIHJldHVybiBQUkVWSUVXX0lDT05fRkFMTEJBQ0s7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGFjdGlvbiBvZiB0aGlzLnByZXZpZXdIZWFkZXJBY3Rpb25zLnZhbHVlcygpKSB7XG4gICAgICBhY3Rpb24ucmVtb3ZlKCk7XG4gICAgfVxuICAgIHRoaXMucHJldmlld0hlYWRlckFjdGlvbnMuY2xlYXIoKTtcblxuICAgIGNvbnNvbGUuaW5mbyhcIlt0eXBzaWRpYW5dIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxufVxuIiwgImV4cG9ydCBjb25zdCBUWVBfRklMRV9FWFRFTlNJT04gPSBcInR5cFwiO1xuZXhwb3J0IGNvbnN0IFBSRVZJRVdfQ09NTUFORF9OQU1FID0gXCJQcmV2aWV3IFR5cHN0XCI7XG5leHBvcnQgY29uc3QgUFJFVklFV19DT01NQU5EX0lEID0gXCJwcmV2aWV3LXR5cHN0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld0ZpbGVMaWtlIHtcbiAgcmVhZG9ubHkgcGF0aDogc3RyaW5nO1xuICByZWFkb25seSBleHRlbnNpb246IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgUHJldmlld1RhcmdldCA9IHtcbiAgZmlsZVBhdGg6IHN0cmluZztcbiAgZGlzcGxheU5hbWU6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdSZXNvbHZlRXJyb3IgPSBcIk5PX0FDVElWRV9UQVJHRVRcIjtcblxuZXhwb3J0IHR5cGUgUHJldmlld1Jlc29sdmVSZXN1bHQgPVxuICB8IHsgb2s6IHRydWU7IHRhcmdldDogUHJldmlld1RhcmdldCB9XG4gIHwgeyBvazogZmFsc2U7IHJlYXNvbjogUHJldmlld1Jlc29sdmVFcnJvciB9O1xuXG5leHBvcnQgdHlwZSBSdW50aW1lQ29tbWFuZCA9IHN0cmluZztcblxuZXhwb3J0IHR5cGUgUnVudGltZUNoZWNrUmVzdWx0ID1cbiAgfCB7XG4gICAgICBvazogdHJ1ZTtcbiAgICAgIHJlc29sdmVkQ29tbWFuZDogUnVudGltZUNvbW1hbmQ7XG4gICAgfVxuICB8IHtcbiAgICAgIG9rOiBmYWxzZTtcbiAgICAgIHJlYXNvbjogXCJNSVNTSU5HX1JVTlRJTUVcIiB8IFwiSU5WQUxJRF9QQVRIXCI7XG4gICAgfTtcblxuZXhwb3J0IHR5cGUgUHJvY2Vzc1J1blJlc3VsdCA9IHtcbiAgZXhpdENvZGU6IG51bWJlciB8IG51bGw7XG4gIHN0ZG91dDogc3RyaW5nO1xuICBzdGRlcnI6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdFeGVjdXRpb25SZXN1bHQgPSB7XG4gIGFydGlmYWN0UGF0aDogc3RyaW5nO1xuICBjb21tYW5kUnVuQXQ6IHN0cmluZztcbiAgZGV0ZXJtaW5pc3RpY0tleTogc3RyaW5nO1xuICBwcm9jZXNzUnVuOiBQcm9jZXNzUnVuUmVzdWx0O1xufTtcblxuZXhwb3J0IHR5cGUgUHJldmlld0ZhaWx1cmVDYXRlZ29yeSA9XG4gIHwgXCJERVBFTkRFTkNZX01JU1NJTkdcIlxuICB8IFwiUFJPQ0VTU19GQUlMRURfVE9fU1RBUlRcIlxuICB8IFwiUFJPQ0VTU19USU1FT1VUXCJcbiAgfCBcIlBST0NFU1NfRVhJVF9FUlJPUlwiXG4gIHwgXCJBUlRJRkFDVF9OT1RfRk9VTkRcIlxuICB8IFwiQVJUSUZBQ1RfT1BFTl9GQUlMRURcIjtcblxuZXhwb3J0IHR5cGUgUHJldmlld0Zsb3dSZXN1bHQgPVxuICB8IHtcbiAgICAgIG9rOiB0cnVlO1xuICAgICAgbWVzc2FnZTogc3RyaW5nO1xuICAgICAgYXJ0aWZhY3RQYXRoOiBzdHJpbmc7XG4gICAgfVxuICB8IHtcbiAgICAgIG9rOiBmYWxzZTtcbiAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICB9O1xuIiwgImltcG9ydCB7XG4gIFByZXZpZXdGbG93UmVzdWx0LFxuICBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5LFxuICBSdW50aW1lQ2hlY2tSZXN1bHQsXG59IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuaW1wb3J0IHsgUHJldmlld0NvbnRleHRSZXNvbHZlciB9IGZyb20gXCIuL3ByZXZpZXdDb250ZXh0UmVzb2x2ZXJcIjtcbmltcG9ydCB7IFByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2UgfSBmcm9tIFwiLi9wcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIH0gZnJvbSBcIi4vcHJldmlld091dHB1dFByZXNlbnRlclwiO1xuaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVQb2xpY3kgfSBmcm9tIFwiLi9wcmV2aWV3RmFpbHVyZVBvbGljeVwiO1xuaW1wb3J0IHtcbiAgUHJldmlld0V4ZWN1dGlvblNlcnZpY2UsXG59IGZyb20gXCIuL3ByZXZpZXdFeGVjdXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQbHVnaW5TdGF0ZUd1YXJkIH0gZnJvbSBcIi4vcGx1Z2luU3RhdGVHdWFyZFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdDb21tYW5kQ29udHJvbGxlciB7XG4gIGlzQ29tbWFuZEF2YWlsYWJsZSgpOiBib29sZWFuO1xuICBydW5Gcm9tQ3VycmVudENvbnRleHQoKTogUHJvbWlzZTxQcmV2aWV3Rmxvd1Jlc3VsdD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld0NvbW1hbmRDb250cm9sbGVyRGVwcyB7XG4gIHJlc29sdmVyOiBQcmV2aWV3Q29udGV4dFJlc29sdmVyO1xuICBydW50aW1lOiBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlO1xuICBleGVjdXRpb246IFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlO1xuICBwcmVzZW50ZXI6IFByZXZpZXdPdXRwdXRQcmVzZW50ZXI7XG4gIGZhaWx1cmVQb2xpY3k6IFByZXZpZXdGYWlsdXJlUG9saWN5O1xuICBzdGF0ZUd1YXJkOiBQbHVnaW5TdGF0ZUd1YXJkO1xuICBvbk5vdGljZTogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXJcbiAgaW1wbGVtZW50cyBQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXJcbntcbiAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZGVwczogUHJldmlld0NvbW1hbmRDb250cm9sbGVyRGVwcykge31cblxuICBwdWJsaWMgaXNDb21tYW5kQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHRhcmdldFJlc3VsdCA9IHRoaXMuZGVwcy5yZXNvbHZlci5yZXNvbHZlVGFyZ2V0Rm9yQ29tbWFuZCgpO1xuICAgIHJldHVybiB0YXJnZXRSZXN1bHQub2s7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuRnJvbUN1cnJlbnRDb250ZXh0KCk6IFByb21pc2U8UHJldmlld0Zsb3dSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5kZXBzLnN0YXRlR3VhcmQud2l0aExlYWZQcmVzZXJ2ZWQoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0UmVzdWx0ID0gdGhpcy5kZXBzLnJlc29sdmVyLnJlc29sdmVUYXJnZXRGb3JDb21tYW5kKCk7XG4gICAgICBpZiAoIXRhcmdldFJlc3VsdC5vaykge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gXCJUeXBzdCBcdTMwRDVcdTMwQTFcdTMwQTRcdTMwRUJcdTMwNENcdTkwNzhcdTYyOUVcdTMwNTVcdTMwOENcdTMwNjZcdTMwNDRcdTMwN0VcdTMwNUJcdTMwOTNcdTMwMDJcdTczRkVcdTU3MjhcdTMwNkVcdTdERThcdTk2QzZcdTVCRkVcdThDNjFcdTMwOTJcdTc4QkFcdThBOERcdTMwNTdcdTMwNjZcdTMwNEZcdTMwNjBcdTMwNTVcdTMwNDRcdTMwMDJcIjtcbiAgICAgICAgdGhpcy5kZXBzLm9uTm90aWNlKG1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBjb25zdCBydW50aW1lUmVzdWx0OiBSdW50aW1lQ2hlY2tSZXN1bHQgPVxuICAgICAgICBhd2FpdCB0aGlzLmRlcHMucnVudGltZS5lbnN1cmVSdW50aW1lQXZhaWxhYmxlKFwidHlwc3RcIik7XG4gICAgICBpZiAoIXJ1bnRpbWVSZXN1bHQub2spIHtcbiAgICAgICAgY29uc3QgcnVudGltZUNhdGVnb3J5ID1cbiAgICAgICAgICBydW50aW1lUmVzdWx0LnJlYXNvbiA9PT0gXCJNSVNTSU5HX1JVTlRJTUVcIlxuICAgICAgICAgICAgPyBcIkRFUEVOREVOQ1lfTUlTU0lOR1wiXG4gICAgICAgICAgICA6IFwiUFJPQ0VTU19GQUlMRURfVE9fU1RBUlRcIjtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJlc2VudEZhaWx1cmUocnVudGltZUNhdGVnb3J5LCBcIlR5cHN0IENMSSBcdTMwNENcdTg5OEJcdTMwNjRcdTMwNEJcdTMwOEFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwMDJcIiwge1xuICAgICAgICAgIGNvbW1hbmQ6IFwidHlwc3RcIixcbiAgICAgICAgICByZWFzb246IHJ1bnRpbWVSZXN1bHQucmVhc29uLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXhlY3V0aW9uUmVzdWx0ID0gYXdhaXQgdGhpcy5kZXBzLmV4ZWN1dGlvbi5leGVjdXRlUHJldmlldyhcbiAgICAgICAgICB0YXJnZXRSZXN1bHQudGFyZ2V0LFxuICAgICAgICAgIHJ1bnRpbWVSZXN1bHQucmVzb2x2ZWRDb21tYW5kLFxuICAgICAgICApO1xuICAgICAgICBhd2FpdCB0aGlzLmRlcHMucHJlc2VudGVyLm9wZW5BcnRpZmFjdChleGVjdXRpb25SZXN1bHQuYXJ0aWZhY3RQYXRoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6IFwiUHJldmlldyBUeXBzdCBcdTMwOTJcdTk1OEJcdTMwNERcdTMwN0VcdTMwNTdcdTMwNUZcdTMwMDJcIixcbiAgICAgICAgICBhcnRpZmFjdFBhdGg6IGV4ZWN1dGlvblJlc3VsdC5hcnRpZmFjdFBhdGgsXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBmYWxsYmFja01lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwidW5rbm93blwiO1xuICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHRoaXMuZGVwcy5mYWlsdXJlUG9saWN5LmNsYXNzaWZ5KGVycm9yLCBmYWxsYmFja01lc3NhZ2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnByZXNlbnRGYWlsdXJlKGNhdGVnb3J5LCBmYWxsYmFja01lc3NhZ2UsIHtcbiAgICAgICAgICBjb21tYW5kOiBydW50aW1lUmVzdWx0LnJlc29sdmVkQ29tbWFuZCxcbiAgICAgICAgICBwYXRoOiB0YXJnZXRSZXN1bHQudGFyZ2V0LmZpbGVQYXRoLFxuICAgICAgICAgIHJlYXNvbjogZmFsbGJhY2tNZXNzYWdlLFxuICAgICAgICB9LFxuICAgICAgICBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHByZXNlbnRGYWlsdXJlKFxuICAgIGNhdGVnb3J5OiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5LFxuICAgIGZhbGxiYWNrTWVzc2FnZTogc3RyaW5nLFxuICAgIGNvbnRleHQ6IHtcbiAgICAgIGNvbW1hbmQ/OiBzdHJpbmc7XG4gICAgICBwYXRoPzogc3RyaW5nO1xuICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgIH0sXG4gICAgZXJyb3I/OiB1bmtub3duLFxuICApOiBQcmV2aWV3Rmxvd1Jlc3VsdCB7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZGVwcy5mYWlsdXJlUG9saWN5LmdldE5vdGljZU1lc3NhZ2UoY2F0ZWdvcnksIGNvbnRleHQpO1xuICAgIGNvbnN0IGxvZ0NvbnRleHQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBjYXRlZ29yeSxcbiAgICAgIG1lc3NhZ2U6IGZhbGxiYWNrTWVzc2FnZSxcbiAgICAgIHJlYXNvbjogY29udGV4dC5yZWFzb24sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLndhcm4oXCJbdHlwc2lkaWFuXSBwcmV2aWV3IGZhaWxlZFwiLCBsb2dDb250ZXh0KTtcbiAgICB0aGlzLmRlcHMub25Ob3RpY2UobWVzc2FnZSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb2s6IGZhbHNlLFxuICAgICAgbWVzc2FnZSxcbiAgICB9O1xuICB9XG59XG4iLCAiaW1wb3J0IHtcbiAgUHJldmlld0ZpbGVMaWtlLFxuICBQcmV2aWV3UmVzb2x2ZUVycm9yLFxuICBQcmV2aWV3UmVzb2x2ZVJlc3VsdCxcbiAgVFlQX0ZJTEVfRVhURU5TSU9OLFxufSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxudHlwZSBBY3RpdmVGaWxlUHJvdmlkZXIgPSAoKSA9PiBQcmV2aWV3RmlsZUxpa2UgfCBudWxsO1xuXG5leHBvcnQgY2xhc3MgUHJldmlld0NvbnRleHRSZXNvbHZlciB7XG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGdldEFjdGl2ZUZpbGU6IEFjdGl2ZUZpbGVQcm92aWRlcikge31cblxuICBwdWJsaWMgcmVzb2x2ZVRhcmdldEZvckNvbW1hbmQoKTogUHJldmlld1Jlc29sdmVSZXN1bHQge1xuICAgIGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmdldEFjdGl2ZUZpbGUoKTtcblxuICAgIGlmICghYWN0aXZlRmlsZSB8fCAhdGhpcy5pc1R5cEZpbGUoYWN0aXZlRmlsZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmZhaWwoXCJOT19BQ1RJVkVfVEFSR0VUXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVOYW1lID0gdGhpcy5nZXRGaWxlTmFtZShhY3RpdmVGaWxlLnBhdGgpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiB0cnVlLFxuICAgICAgdGFyZ2V0OiB7XG4gICAgICAgIGZpbGVQYXRoOiBhY3RpdmVGaWxlLnBhdGgsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBmaWxlTmFtZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgaXNUeXBGaWxlKGZpbGU6IFByZXZpZXdGaWxlTGlrZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpID09PSBUWVBfRklMRV9FWFRFTlNJT047XG4gIH1cblxuICBwcml2YXRlIGdldEZpbGVOYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaW5kZXggPSBwYXRoLmxhc3RJbmRleE9mKFwiL1wiKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICByZXR1cm4gcGF0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gcGF0aC5zbGljZShpbmRleCArIDEpO1xuICB9XG5cbiAgcHJpdmF0ZSBmYWlsKHJlYXNvbjogUHJldmlld1Jlc29sdmVFcnJvcik6IHsgb2s6IGZhbHNlOyByZWFzb246IFByZXZpZXdSZXNvbHZlRXJyb3IgfSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb24gfTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFJ1bnRpbWVDaGVja1Jlc3VsdCB9IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJ1bnRpbWVWZXJpZmllciB7XG4gIHZlcmlmeShjb21tYW5kTmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPjtcbn1cblxuZXhwb3J0IGNsYXNzIFByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2Uge1xuICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB2ZXJpZmllcjogUnVudGltZVZlcmlmaWVyKSB7fVxuXG4gIHB1YmxpYyBhc3luYyBlbnN1cmVSdW50aW1lQXZhaWxhYmxlKGNvbW1hbmROYW1lOiBzdHJpbmcpOiBQcm9taXNlPFJ1bnRpbWVDaGVja1Jlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBhdmFpbGFibGUgPSBhd2FpdCB0aGlzLnZlcmlmaWVyLnZlcmlmeShjb21tYW5kTmFtZSk7XG4gICAgICBpZiAoIWF2YWlsYWJsZSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICByZWFzb246IFwiTUlTU0lOR19SVU5USU1FXCIsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiB0cnVlLFxuICAgICAgICByZXNvbHZlZENvbW1hbmQ6IGNvbW1hbmROYW1lLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICByZWFzb246IHRoaXMuY2xhc3NpZnlFcnJvcihlcnJvciksXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZXNldFJ1bnRpbWVDYWNoZSgpOiB2b2lkIHtcbiAgfVxuXG4gIHByaXZhdGUgY2xhc3NpZnlFcnJvcihlcnJvcjogdW5rbm93bik6IFwiTUlTU0lOR19SVU5USU1FXCIgfCBcIklOVkFMSURfUEFUSFwiIHtcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICBcImNvZGVcIiBpbiBlcnJvciAmJlxuICAgICAgZXJyb3IuY29kZSA9PT0gXCJFTk9FTlRcIlxuICAgICkge1xuICAgICAgcmV0dXJuIFwiTUlTU0lOR19SVU5USU1FXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiSU5WQUxJRF9QQVRIXCI7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5IH0gZnJvbSBcIi4vY29udHJhY3RzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFpbHVyZUNhdGVnb3J5Q29udGV4dCB7XG4gIGNvbW1hbmQ/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG4gIHJlYXNvbj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3RmFpbHVyZVBvbGljeUNvbnRyYWN0IHtcbiAgY2xhc3NpZnkoZXJyb3I6IHVua25vd24sIGZhbGxiYWNrTWVzc2FnZTogc3RyaW5nKTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeTtcbiAgZ2V0Tm90aWNlTWVzc2FnZShjYXRlZ29yeTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeSwgY29udGV4dDogRmFpbHVyZUNhdGVnb3J5Q29udGV4dCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFByZXZpZXdGYWlsdXJlUG9saWN5IGltcGxlbWVudHMgUHJldmlld0ZhaWx1cmVQb2xpY3lDb250cmFjdCB7XG4gIHB1YmxpYyBjbGFzc2lmeShlcnJvcjogdW5rbm93biwgZmFsbGJhY2tNZXNzYWdlOiBzdHJpbmcpOiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5IHtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5leHRyYWN0TWVzc2FnZShlcnJvcik7XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICBcImNvZGVcIiBpbiBlcnJvciAmJlxuICAgICAgZXJyb3IuY29kZSA9PT0gXCJFTk9FTlRcIlxuICAgICkge1xuICAgICAgcmV0dXJuIFwiREVQRU5ERU5DWV9NSVNTSU5HXCI7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2UuaW5jbHVkZXMoXCJ0aW1lb3V0XCIpKSB7XG4gICAgICByZXR1cm4gXCJQUk9DRVNTX1RJTUVPVVRcIjtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICBcImV4aXRDb2RlXCIgaW4gZXJyb3IgJiZcbiAgICAgIChlcnJvciBhcyB7IGV4aXRDb2RlOiBudW1iZXIgfCBudWxsIH0pLmV4aXRDb2RlICE9PSAwXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJQUk9DRVNTX0VYSVRfRVJST1JcIjtcbiAgICB9XG5cbiAgICBpZiAoZmFsbGJhY2tNZXNzYWdlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoXCJ0aW1lb3V0XCIpKSB7XG4gICAgICByZXR1cm4gXCJQUk9DRVNTX1RJTUVPVVRcIjtcbiAgICB9XG5cbiAgICBpZiAoZmFsbGJhY2tNZXNzYWdlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoXCJhcnRpZmFjdFwiKSkge1xuICAgICAgcmV0dXJuIFwiQVJUSUZBQ1RfTk9UX0ZPVU5EXCI7XG4gICAgfVxuXG4gICAgaWYgKGZhbGxiYWNrTWVzc2FnZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKFwib3BlblwiKSkge1xuICAgICAgcmV0dXJuIFwiQVJUSUZBQ1RfT1BFTl9GQUlMRURcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJQUk9DRVNTX0ZBSUxFRF9UT19TVEFSVFwiO1xuICB9XG5cbiAgcHVibGljIGdldE5vdGljZU1lc3NhZ2UoXG4gICAgY2F0ZWdvcnk6IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnksXG4gICAgY29udGV4dDogRmFpbHVyZUNhdGVnb3J5Q29udGV4dCxcbiAgKTogc3RyaW5nIHtcbiAgICBzd2l0Y2ggKGNhdGVnb3J5KSB7XG4gICAgICBjYXNlIFwiREVQRU5ERU5DWV9NSVNTSU5HXCI6XG4gICAgICAgIHJldHVybiBcIlR5cHN0IENMSSBcdTMwNENcdTg5OEJcdTMwNjRcdTMwNEJcdTMwOEFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwMDJgdHlwc3RgIFx1MzA0QyBQQVRIIFx1MzA0Qlx1MzA4OVx1NUI5Rlx1ODg0Q1x1MzA2N1x1MzA0RFx1MzA4Qlx1MzA0Qlx1NzhCQVx1OEE4RFx1MzA1N1x1MzA2Nlx1MzA0Rlx1MzA2MFx1MzA1NVx1MzA0NFx1MzAwMlwiO1xuICAgICAgY2FzZSBcIlBST0NFU1NfVElNRU9VVFwiOlxuICAgICAgICByZXR1cm4gXCJUeXBzdCBDTEkgXHUzMDZFXHU1QjlGXHU4ODRDXHUzMDRDXHUzMEJGXHUzMEE0XHUzMEUwXHUzMEEyXHUzMEE2XHUzMEM4XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGXHUzMDAyXHU1MTY1XHU1MjlCXHU1MTg1XHU1QkI5XHUzMDkyXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHU1MThEXHU1QjlGXHU4ODRDXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XHUzMDAyXCI7XG4gICAgICBjYXNlIFwiUFJPQ0VTU19FWElUX0VSUk9SXCI6XG4gICAgICAgIHJldHVybiBgVHlwc3QgQ0xJIFx1MzA0QyAke2NvbnRleHQuY29tbWFuZCA/PyBcIlx1MzBCM1x1MzBERVx1MzBGM1x1MzBDOVwifSBcdTMwNjdcdTU5MzFcdTY1NTdcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUZcdTMwMDJgO1xuICAgICAgY2FzZSBcIkFSVElGQUNUX05PVF9GT1VORFwiOlxuICAgICAgICByZXR1cm4gYFBERiBcdTYyMTBcdTY3OUNcdTcyNjlcdTMwNENcdTc1MUZcdTYyMTBcdTMwNTVcdTMwOENcdTMwN0VcdTMwNUJcdTMwOTNcdTMwNjdcdTMwNTdcdTMwNUY6ICR7Y29udGV4dC5wYXRoID8/IFwiXHU0RTBEXHU2NjBFXCJ9YDtcbiAgICAgIGNhc2UgXCJBUlRJRkFDVF9PUEVOX0ZBSUxFRFwiOlxuICAgICAgICByZXR1cm4gYFBERiBcdTMwOTJcdTk1OEJcdTMwNTFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwNjdcdTMwNTdcdTMwNUY6ICR7Y29udGV4dC5wYXRoID8/IFwiXHU0RTBEXHU2NjBFXCJ9YDtcbiAgICAgIGNhc2UgXCJQUk9DRVNTX0ZBSUxFRF9UT19TVEFSVFwiOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFwiXHUzMEQ3XHUzMEVDXHUzMEQzXHUzMEU1XHUzMEZDXHU1QjlGXHU4ODRDXHUzMDkyXHU5NThCXHU1OUNCXHUzMDY3XHUzMDREXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDY3XHUzMDU3XHUzMDVGXHUzMDAyXCI7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0TWVzc2FnZShlcnJvcjogdW5rbm93bik6IHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIGVycm9yLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIHJldHVybiBlcnJvci5tZXNzYWdlLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBDaGlsZFByb2Nlc3MsIFNwYXduT3B0aW9ucywgc3Bhd24gfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5cbmltcG9ydCB7IFByb2Nlc3NSdW5SZXN1bHQgfSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcm9jZXNzUnVuT3B0aW9ucyB7XG4gIGN3ZD86IHN0cmluZztcbiAgZW52PzogTm9kZUpTLlByb2Nlc3NFbnY7XG4gIHRpbWVvdXRNcz86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHRlcm5hbENsaVJ1bm5lciB7XG4gIHJ1bldpdGhBcmdzKFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PjtcbiAgcnVuQ29tbWFuZFN0cmluZyhcbiAgICBjb21tYW5kTGluZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+O1xufVxuXG5leHBvcnQgY2xhc3MgTm9kZUV4dGVybmFsQ2xpUnVubmVyIGltcGxlbWVudHMgRXh0ZXJuYWxDbGlSdW5uZXIge1xuICBwdWJsaWMgYXN5bmMgcnVuV2l0aEFyZ3MoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5ydW5Qcm9jZXNzKGNvbW1hbmQsIGFyZ3MsIG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIHJ1bkNvbW1hbmRTdHJpbmcoXG4gICAgY29tbWFuZExpbmU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PiB7XG4gICAgY29uc3QgaXNXaW5kb3dzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiO1xuICAgIHJldHVybiB0aGlzLnJ1blByb2Nlc3MoaXNXaW5kb3dzID8gXCJjbWRcIiA6IFwic2hcIiwgW2lzV2luZG93cyA/IFwiL2NcIiA6IFwiLWNcIiwgY29tbWFuZExpbmVdLCBvcHRpb25zKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcnVuUHJvY2VzcyhcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgc2V0dGxlZCA9IGZhbHNlO1xuXG4gICAgICBjb25zdCBwcm9jZXNzT3B0aW9uczogU3Bhd25PcHRpb25zID0ge1xuICAgICAgICBjd2Q6IG9wdGlvbnMuY3dkLFxuICAgICAgICBlbnY6IG9wdGlvbnMuZW52LFxuICAgICAgfTtcblxuICAgICAgbGV0IGNoaWxkOiBDaGlsZFByb2Nlc3M7XG4gICAgICB0cnkge1xuICAgICAgICBjaGlsZCA9IHNwYXduKGNvbW1hbmQsIGFyZ3MsIHtcbiAgICAgICAgICAuLi5wcm9jZXNzT3B0aW9ucyxcbiAgICAgICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwicGlwZVwiLCBcInBpcGVcIl0sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgc3Rkb3V0ID0gXCJcIjtcbiAgICAgIGxldCBzdGRlcnIgPSBcIlwiO1xuXG4gICAgICBjaGlsZC5zdGRvdXQ/LnNldEVuY29kaW5nKFwidXRmOFwiKTtcbiAgICAgIGNoaWxkLnN0ZGVycj8uc2V0RW5jb2RpbmcoXCJ1dGY4XCIpO1xuICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICAgIHN0ZG91dCArPSBTdHJpbmcoY2h1bmspO1xuICAgICAgfSk7XG4gICAgICBjaGlsZC5zdGRlcnI/Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgICAgc3RkZXJyICs9IFN0cmluZyhjaHVuayk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdGltZW91dE1zID0gb3B0aW9ucy50aW1lb3V0TXM7XG4gICAgICBsZXQgdGltZW91dElkOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0eXBlb2YgdGltZW91dE1zID09PSBcIm51bWJlclwiICYmIHRpbWVvdXRNcyA+IDApIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgaWYgKHNldHRsZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcbiAgICAgICAgICB2b2lkIGNoaWxkLmtpbGwoKTtcbiAgICAgICAgICByZXNvbHZlKHtcbiAgICAgICAgICAgIGV4aXRDb2RlOiBudWxsLFxuICAgICAgICAgICAgc3Rkb3V0LFxuICAgICAgICAgICAgc3RkZXJyOiBgJHtzdGRlcnJ9XFxucHJvY2VzcyB0aW1lb3V0IGFmdGVyICR7dGltZW91dE1zfW1zYCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSwgdGltZW91dE1zKTtcbiAgICAgIH1cblxuICAgICAgY2hpbGQub24oXCJlcnJvclwiLCAoZXJyb3IpID0+IHtcbiAgICAgICAgaWYgKHNldHRsZWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRpbWVvdXRJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XG4gICAgICAgIGlmIChzZXR0bGVkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0dGxlZCA9IHRydWU7XG4gICAgICAgIGlmICh0aW1lb3V0SWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgZXhpdENvZGU6IGNvZGUsXG4gICAgICAgICAgc3Rkb3V0LFxuICAgICAgICAgIHN0ZGVycixcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTW9ja0V4dGVybmFsQ2xpUnVubmVyIGltcGxlbWVudHMgRXh0ZXJuYWxDbGlSdW5uZXIge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBoYW5kbGVyOiAoXG4gICAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICAgICkgPT4gUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PixcbiAgKSB7fVxuXG4gIHB1YmxpYyBydW5XaXRoQXJncyhcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLmhhbmRsZXIoY29tbWFuZCwgYXJncywgb3B0aW9ucyk7XG4gIH1cblxuICBwdWJsaWMgcnVuQ29tbWFuZFN0cmluZyhcbiAgICBjb21tYW5kTGluZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG4gICAgcmV0dXJuIHRoaXMuaGFuZGxlcihpc1dpbmRvd3MgPyBcImNtZFwiIDogXCJzaFwiLCBbaXNXaW5kb3dzID8gXCIvY1wiIDogXCItY1wiLCBjb21tYW5kTGluZV0sIG9wdGlvbnMpO1xuICB9XG59XG4iLCAiZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3T3V0cHV0UHJlc2VudGVyQ29udHJhY3Qge1xuICBvcGVuQXJ0aWZhY3QocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbiAgcmV2ZWFsSW5Gb2xkZXIocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGNsYXNzIFByZXZpZXdPdXRwdXRQcmVzZW50ZXIgaW1wbGVtZW50cyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyQ29udHJhY3Qge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcGVuSW5QYW5lOiAocGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3BlblBhdGg6IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8c3RyaW5nIHwgbnVsbD4sXG4gICAgcHJpdmF0ZSByZWFkb25seSByZXZlYWxQYXRoOiAocGF0aDogc3RyaW5nKSA9PiB2b2lkLFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIG9wZW5BcnRpZmFjdChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5vcGVuSW5QYW5lKHBhdGgpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gY2F0Y2gge1xuICAgICAgY29uc3Qgb3BlblJlc3VsdCA9IGF3YWl0IHRoaXMub3BlblBhdGgocGF0aCk7XG4gICAgICBpZiAob3BlblJlc3VsdCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3Iob3BlblJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJldmVhbEluRm9sZGVyKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmV2ZWFsUGF0aChwYXRoKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGlzQWJzb2x1dGUsIGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmltcG9ydCB7XG4gIFByZXZpZXdFeGVjdXRpb25SZXN1bHQsXG4gIFByZXZpZXdUYXJnZXQsXG59IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuaW1wb3J0IHtcbiAgRXh0ZXJuYWxDbGlSdW5uZXIsXG4gIFByb2Nlc3NSdW5PcHRpb25zLFxufSBmcm9tIFwiLi9leHRlcm5hbENsaVJ1bm5lclwiO1xuaW1wb3J0IHsgUHJldmlld091dHB1dFB1Ymxpc2hlciB9IGZyb20gXCIuL3ByZXZpZXdPdXRwdXRQdWJsaXNoZXJcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3RXhlY3V0aW9uU2VydmljZSB7XG4gIGV4ZWN1dGVQcmV2aWV3KHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxQcmV2aWV3RXhlY3V0aW9uUmVzdWx0Pjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRQcmV2aWV3RXhlY3V0aW9uU2VydmljZSBpbXBsZW1lbnRzIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcnVubmVyOiBFeHRlcm5hbENsaVJ1bm5lcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHB1Ymxpc2hlcjogUHJldmlld091dHB1dFB1Ymxpc2hlcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJ1bk9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zID0geyB0aW1lb3V0TXM6IDEwMDAwMCB9LFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWN1dGVQcmV2aWV3KFxuICAgIHRhcmdldDogUHJldmlld1RhcmdldCxcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHJldmlld0V4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IGFydGlmYWN0UGF0aCA9IHRoaXMucHVibGlzaGVyLmNvbXB1dGVPdXRwdXRQYXRoKHRhcmdldCk7XG5cbiAgICBjb25zdCBydW5SZXN1bHQgPSBhd2FpdCB0aGlzLnJ1bm5lci5ydW5XaXRoQXJncyhcbiAgICAgIGNvbW1hbmQsXG4gICAgICBbXCJjb21waWxlXCIsIHRhcmdldC5maWxlUGF0aCwgYXJ0aWZhY3RQYXRoXSxcbiAgICAgIHRoaXMucnVuT3B0aW9ucyxcbiAgICApO1xuXG4gICAgaWYgKHJ1blJlc3VsdC5leGl0Q29kZSAhPT0gMCkge1xuICAgICAgdGhyb3cgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IocnVuUmVzdWx0LnN0ZGVyciB8fCBcInByZXZpZXcgY29tbWFuZCBmYWlsZWRcIiksIHtcbiAgICAgICAgZXhpdENvZGU6IHJ1blJlc3VsdC5leGl0Q29kZSxcbiAgICAgICAgc3Rkb3V0OiBydW5SZXN1bHQuc3Rkb3V0LFxuICAgICAgICBzdGRlcnI6IHJ1blJlc3VsdC5zdGRlcnIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBhcnRpZmFjdFBhdGhGb3JDaGVjayA9IHRoaXMucmVzb2x2ZUFydGlmYWN0UGF0aEZvckNoZWNrKGFydGlmYWN0UGF0aCk7XG4gICAgY29uc3QgZXhpc3RzID0gYXdhaXQgdGhpcy5wdWJsaXNoZXIuZW5zdXJlQXJ0aWZhY3RFeGlzdHMoYXJ0aWZhY3RQYXRoRm9yQ2hlY2spO1xuICAgIGlmICghZXhpc3RzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGFydGlmYWN0IG5vdCBmb3VuZDogJHthcnRpZmFjdFBhdGhGb3JDaGVja31gKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYXJ0aWZhY3RQYXRoLFxuICAgICAgZGV0ZXJtaW5pc3RpY0tleTogYXJ0aWZhY3RQYXRoLFxuICAgICAgY29tbWFuZFJ1bkF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBwcm9jZXNzUnVuOiBydW5SZXN1bHQsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzb2x2ZUFydGlmYWN0UGF0aEZvckNoZWNrKGFydGlmYWN0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoaXNBYnNvbHV0ZShhcnRpZmFjdFBhdGgpKSB7XG4gICAgICByZXR1cm4gYXJ0aWZhY3RQYXRoO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5ydW5PcHRpb25zLmN3ZCA9PT0gXCJzdHJpbmdcIiAmJiB0aGlzLnJ1bk9wdGlvbnMuY3dkLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBqb2luKHRoaXMucnVuT3B0aW9ucy5jd2QsIGFydGlmYWN0UGF0aCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFydGlmYWN0UGF0aDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3R1YlByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIGltcGxlbWVudHMgUHJldmlld0V4ZWN1dGlvblNlcnZpY2Uge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBzaW11bGF0ZTogKHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgcmV0dXJuO1xuICAgIH0sXG4gICkge31cblxuICBwdWJsaWMgYXN5bmMgZXhlY3V0ZVByZXZpZXcodGFyZ2V0OiBQcmV2aWV3VGFyZ2V0LCBjb21tYW5kOiBzdHJpbmcpOiBQcm9taXNlPFByZXZpZXdFeGVjdXRpb25SZXN1bHQ+IHtcbiAgICBhd2FpdCB0aGlzLnNpbXVsYXRlKHRhcmdldCwgY29tbWFuZCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYXJ0aWZhY3RQYXRoOiBqb2luKHRhcmdldC5maWxlUGF0aCwgXCIuLlwiLCBcInByZXZpZXcucGRmXCIpLFxuICAgICAgZGV0ZXJtaW5pc3RpY0tleTogdGFyZ2V0LmZpbGVQYXRoLFxuICAgICAgY29tbWFuZFJ1bkF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBwcm9jZXNzUnVuOiB7XG4gICAgICAgIGV4aXRDb2RlOiAwLFxuICAgICAgICBzdGRvdXQ6IFwiXCIsXG4gICAgICAgIHN0ZGVycjogXCJcIixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGFjY2VzcyB9IGZyb20gXCJub2RlOmZzL3Byb21pc2VzXCI7XG5pbXBvcnQgeyBkaXJuYW1lLCBleHRuYW1lLCBiYXNlbmFtZSwgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcblxuaW1wb3J0IHsgUHJldmlld1RhcmdldCB9IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdPdXRwdXRQdWJsaXNoQ29udHJhY3Qge1xuICBjb21wdXRlT3V0cHV0UGF0aCh0YXJnZXQ6IFByZXZpZXdUYXJnZXQpOiBzdHJpbmc7XG4gIGVuc3VyZUFydGlmYWN0RXhpc3RzKHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj47XG59XG5cbmV4cG9ydCBjbGFzcyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyIGltcGxlbWVudHMgUHJldmlld091dHB1dFB1Ymxpc2hDb250cmFjdCB7XG4gIHB1YmxpYyBjb21wdXRlT3V0cHV0UGF0aCh0YXJnZXQ6IFByZXZpZXdUYXJnZXQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJvb3QgPSBkaXJuYW1lKHRhcmdldC5maWxlUGF0aCk7XG4gICAgY29uc3QgbmFtZSA9IGJhc2VuYW1lKHRhcmdldC5maWxlUGF0aCk7XG4gICAgY29uc3Qgc3RlbSA9IG5hbWUuc2xpY2UoMCwgbmFtZS5sZW5ndGggLSBleHRuYW1lKG5hbWUpLmxlbmd0aCk7XG5cbiAgICByZXR1cm4gam9pbihyb290LCBgJHtzdGVtfS5wZGZgKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBlbnN1cmVBcnRpZmFjdEV4aXN0cyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYWNjZXNzKHBhdGgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgV29ya3NwYWNlTGVhZiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBsdWdpblN0YXRlR3VhcmRDb250cmFjdCB7XG4gIHdpdGhMZWFmUHJlc2VydmVkPFQ+KGFjdGlvbjogKCkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD47XG4gIHJlc3RvcmVBY3RpdmVMZWFmSWZOZWVkZWQoKTogdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIFBsdWdpblN0YXRlR3VhcmQgaW1wbGVtZW50cyBQbHVnaW5TdGF0ZUd1YXJkQ29udHJhY3Qge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBjdXJyZW50TGVhZlByb3ZpZGVyOiAoKSA9PiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJlc3RvcmVMZWFmOiAobGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpID0+IHZvaWQsXG4gICkge31cblxuICBwcml2YXRlIGxlYWZUb1Jlc3RvcmU6IFdvcmtzcGFjZUxlYWYgfCBudWxsID0gbnVsbDtcblxuICBwdWJsaWMgYXN5bmMgd2l0aExlYWZQcmVzZXJ2ZWQ8VD4oYWN0aW9uOiAoKSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gICAgY29uc3QgcHJldmlvdXNMZWFmID0gdGhpcy5jdXJyZW50TGVhZlByb3ZpZGVyKCk7XG4gICAgdGhpcy5sZWFmVG9SZXN0b3JlID0gcHJldmlvdXNMZWFmO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgYWN0aW9uKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMucmVzdG9yZUFjdGl2ZUxlYWZJZk5lZWRlZCgpO1xuICAgICAgdGhpcy5sZWFmVG9SZXN0b3JlID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVzdG9yZUFjdGl2ZUxlYWZJZk5lZWRlZCgpOiB2b2lkIHtcbiAgICB0aGlzLnJlc3RvcmVJZkNoYW5nZWQodGhpcy5sZWFmVG9SZXN0b3JlKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzdG9yZUlmQ2hhbmdlZChleHBlY3RlZExlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCB7XG4gICAgaWYgKGV4cGVjdGVkTGVhZiAhPT0gdGhpcy5jdXJyZW50TGVhZlByb3ZpZGVyKCkpIHtcbiAgICAgIHRoaXMucmVzdG9yZUxlYWYoZXhwZWN0ZWRMZWFmKTtcbiAgICB9XG4gIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBVU87QUFDUCxJQUFBQSw2QkFBb0M7QUFDcEMsSUFBQUMsb0JBQXFCOzs7QUNaZCxJQUFNLHFCQUFxQjtBQUMzQixJQUFNLHVCQUF1QjtBQUM3QixJQUFNLHFCQUFxQjs7O0FDMkIzQixJQUFNLGtDQUFOLE1BRVA7QUFBQSxFQUNTLFlBQTZCLE1BQW9DO0FBQXBDO0FBQUEsRUFBcUM7QUFBQSxFQUVsRSxxQkFBOEI7QUFDbkMsVUFBTSxlQUFlLEtBQUssS0FBSyxTQUFTLHdCQUF3QjtBQUNoRSxXQUFPLGFBQWE7QUFBQSxFQUN0QjtBQUFBLEVBRUEsTUFBYSx3QkFBb0Q7QUFDL0QsV0FBTyxLQUFLLEtBQUssV0FBVyxrQkFBa0IsWUFBWTtBQUN4RCxZQUFNLGVBQWUsS0FBSyxLQUFLLFNBQVMsd0JBQXdCO0FBQ2hFLFVBQUksQ0FBQyxhQUFhLElBQUk7QUFDcEIsY0FBTSxVQUFVO0FBQ2hCLGFBQUssS0FBSyxTQUFTLE9BQU87QUFDMUIsZUFBTztBQUFBLFVBQ0wsSUFBSTtBQUFBLFVBQ0o7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUVBLFlBQU0sZ0JBQ0osTUFBTSxLQUFLLEtBQUssUUFBUSx1QkFBdUIsT0FBTztBQUN4RCxVQUFJLENBQUMsY0FBYyxJQUFJO0FBQ3JCLGNBQU0sa0JBQ0osY0FBYyxXQUFXLG9C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TUFDQSxTQUNNO0FBQ04sUUFBSSxTQUFTO0FBQ1gsY0FBUSxLQUFLLGVBQWUsU0FBUyxLQUFLLE9BQU8sT0FBTyxLQUFLLElBQUksRUFBRTtBQUNuRTtBQUFBLElBQ0Y7QUFFQSxZQUFRLEtBQUssZUFBZSxTQUFTLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFBQSxFQUN2RDtBQUFBLEVBRVEsa0JBQXdCO0FBQzlCLFlBQVE7QUFBQSxNQUNOO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLFNBQVMsWUFBb0IsVUFBMEI7QUFDN0QsUUFBSSxDQUFDLFlBQVk7QUFDZixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU8sR0FBRyxVQUFVLElBQUksUUFBUTtBQUFBLEVBQ2xDO0FBQUEsRUFFUSxxQkFBNkI7QUFDbkMsWUFBSSx5QkFBUSxvQkFBb0IsR0FBRztBQUNqQyxhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU87QUFBQSxFQUNUO0FBQUEsRUFFQSxXQUFpQjtBQUNmLGVBQVcsVUFBVSxLQUFLLHFCQUFxQixPQUFPLEdBQUc7QUFDdkQsYUFBTyxPQUFPO0FBQUEsSUFDaEI7QUFDQSxTQUFLLHFCQUFxQixNQUFNO0FBRWhDLFlBQVEsS0FBSyw2QkFBNkI7QUFBQSxFQUM1QztBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfbm9kZV9jaGlsZF9wcm9jZXNzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfcGF0aCJdCn0K
