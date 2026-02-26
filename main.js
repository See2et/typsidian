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
      let artifactPath;
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
        artifactPath = executionResult.artifactPath;
        await this.deps.presenter.openArtifact(artifactPath);
        return {
          ok: true,
          message: "Preview Typst \u3092\u958B\u304D\u307E\u3057\u305F\u3002",
          artifactPath: executionResult.artifactPath
        };
      } catch (error) {
        const fallbackMessage = error instanceof Error ? error.message : "unknown";
        const category = this.deps.failurePolicy.classify(error, fallbackMessage);
        const artifactPathFromError = error instanceof Error ? /artifact not found:\s*(.+)$/i.exec(error.message)?.[1] : void 0;
        return this.presentFailure(
          category,
          fallbackMessage,
          {
            command: runtimeResult.resolvedCommand,
            path: artifactPathFromError ?? artifactPath ?? targetResult.target.filePath,
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
        env: options.env ? { ...process.env, ...options.env } : process.env
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
    return (0, import_node_path.join)(process.cwd(), artifactPath);
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
      const entry = await (0, import_promises.stat)(path);
      return entry.isFile();
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
  async withLeafPreserved(action) {
    const previousLeaf = this.currentLeafProvider();
    try {
      return await action();
    } finally {
      this.restoreActiveLeafIfNeeded(previousLeaf);
    }
  }
  restoreActiveLeafIfNeeded(expectedLeaf) {
    this.restoreIfChanged(expectedLeaf);
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
      {
        timeoutMs: 1e5,
        cwd: vaultBasePath ?? void 0
      }
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
      const args = process.platform === "win32" ? ["/c", "start", "", path] : process.platform === "darwin" ? [path] : [path];
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
    const args = process.platform === "win32" ? ["/c", "start", "", path] : process.platform === "darwin" ? ["-R", path] : [path];
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3ByZXZpZXcvY29udHJhY3RzLnRzIiwgInNyYy9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3Q29udGV4dFJlc29sdmVyLnRzIiwgInNyYy9wcmV2aWV3L3ByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2UudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld0ZhaWx1cmVQb2xpY3kudHMiLCAic3JjL3ByZXZpZXcvZXh0ZXJuYWxDbGlSdW5uZXIudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld091dHB1dFByZXNlbnRlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3RXhlY3V0aW9uU2VydmljZS50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyLnRzIiwgInNyYy9wcmV2aWV3L3BsdWdpblN0YXRlR3VhcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIGdldEljb24sXG4gIE1hcmtkb3duVmlldyxcbiAgTWVudSxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFRBYnN0cmFjdEZpbGUsXG4gIFRGaWxlLFxuICBURm9sZGVyLFxuICBXb3Jrc3BhY2VMZWFmLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IENoaWxkUHJvY2Vzcywgc3Bhd24gfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHtcbiAgUFJFVklFV19DT01NQU5EX0lELFxuICBQUkVWSUVXX0NPTU1BTkRfTkFNRSxcbn0gZnJvbSBcIi4vcHJldmlldy9jb250cmFjdHNcIjtcbmltcG9ydCB7IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlclwiO1xuaW1wb3J0IHsgUHJldmlld0NvbnRleHRSZXNvbHZlciB9IGZyb20gXCIuL3ByZXZpZXcvcHJldmlld0NvbnRleHRSZXNvbHZlclwiO1xuaW1wb3J0IHsgUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZSB9IGZyb20gXCIuL3ByZXZpZXcvcHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZVwiO1xuaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVQb2xpY3kgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdGYWlsdXJlUG9saWN5XCI7XG5pbXBvcnQgeyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIgfSBmcm9tIFwiLi9wcmV2aWV3L2V4dGVybmFsQ2xpUnVubmVyXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHJlc2VudGVyXCI7XG5pbXBvcnQgeyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdFeGVjdXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyXCI7XG5pbXBvcnQgeyBQbHVnaW5TdGF0ZUd1YXJkIH0gZnJvbSBcIi4vcHJldmlldy9wbHVnaW5TdGF0ZUd1YXJkXCI7XG5cbmNvbnN0IFRZUF9FWFRFTlNJT04gPSBcInR5cFwiO1xuY29uc3QgVFlQX1ZJRVcgPSBcIm1hcmtkb3duXCI7XG5jb25zdCBQUkVWSUVXX0lDT05fUFJJTUFSWSA9IFwicGFuZWwtcmlnaHQtb3BlblwiO1xuY29uc3QgUFJFVklFV19JQ09OX0ZBTExCQUNLID0gXCJwbGF5XCI7XG5jb25zdCBORVdfVFlQX05BTUUgPSBcIlVudGl0bGVkXCI7XG5jb25zdCBORVdfVFlQX0VYVCA9IGAuJHtUWVBfRVhURU5TSU9OfWA7XG5jb25zdCBUWVBfRklMRV9FWFRFTlNJT05TID0gW1RZUF9FWFRFTlNJT04sIFwiVHlwXCIsIFwiVFlQXCJdIGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVHlwTGlmZWN5Y2xlRXZlbnRUYXJnZXQge1xuICBwYXRoOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHlwc2lkaWFuUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBwcmV2aW91c0FjdGl2ZUxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdXJyZW50QWN0aXZlTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHByZXZpZXdDb21tYW5kQ29udHJvbGxlcjogRGVmYXVsdFByZXZpZXdDb21tYW5kQ29udHJvbGxlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHByZXZpZXdIZWFkZXJBY3Rpb25zID0gbmV3IE1hcDxXb3Jrc3BhY2VMZWFmLCBIVE1MRWxlbWVudD4oKTtcbiAgcHJpdmF0ZSByZWFkb25seSBwcmV2aWV3SWNvbiA9IHRoaXMucmVzb2x2ZVByZXZpZXdJY29uKCk7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY3VycmVudEFjdGl2ZUxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMucmVnaXN0ZXJFeHRlbnNpb25zKEFycmF5LmZyb20oVFlQX0ZJTEVfRVhURU5TSU9OUyksIFRZUF9WSUVXKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpO1xuICAgICAgdGhpcy5yZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpO1xuICAgICAgdGhpcy5yZWdpc3RlclByZXZpZXdDb21tYW5kKCk7XG4gICAgICB0aGlzLnN5bmNQcmV2aWV3SGVhZGVyQWN0aW9uKHRoaXMuY3VycmVudEFjdGl2ZUxlYWYpO1xuICAgICAgdGhpcy5sb2dTdGFydHVwU3RhdGUoKTtcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCB0aGlzLmhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UpLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHRoaXMuaGFuZGxlRmlsZU9wZW4pLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gbG9hZGVkXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVGaWxlT3BlbiA9IChmaWxlOiBURmlsZSB8IG51bGwpOiB2b2lkID0+IHtcbiAgICB0aGlzLnN5bmNQcmV2aWV3SGVhZGVyQWN0aW9uKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpKTtcblxuICAgIGlmICghZmlsZSB8fCAhdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlQWNjZXNzaWJsZShmaWxlKSkge1xuICAgICAgdGhpcy5yZXN0b3JlQWN0aXZlTGVhZih0aGlzLnByZXZpb3VzQWN0aXZlTGVhZik7XG4gICAgICBuZXcgTm90aWNlKFxuICAgICAgICBcIi50eXAgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDkyXHU5NThCXHUzMDUxXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDY3XHUzMDU3XHUzMDVGXHUzMDAyXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDRDXHU5NThCXHUzMDUxXHUzMDhCXHU3MkI2XHU2MTRCXHUzMDRCXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGV4aXN0aW5nTGVhZiA9IHRoaXMuZ2V0TGVhZkJ5VHlwRmlsZShmaWxlLnBhdGgpO1xuXG4gICAgaWYgKCFleGlzdGluZ0xlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY3RpdmVMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldE1vc3RSZWNlbnRMZWFmKCk7XG4gICAgaWYgKGFjdGl2ZUxlYWYgPT09IGV4aXN0aW5nTGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5zZXRBY3RpdmVMZWFmKGV4aXN0aW5nTGVhZiwgeyBmb2N1czogdHJ1ZSB9KTtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UgPSAobGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkID0+IHtcbiAgICBpZiAobGVhZiA9PT0gdGhpcy5jdXJyZW50QWN0aXZlTGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucHJldmlvdXNBY3RpdmVMZWFmID0gdGhpcy5jdXJyZW50QWN0aXZlTGVhZjtcbiAgICB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmID0gbGVhZjtcbiAgICB0aGlzLnN5bmNQcmV2aWV3SGVhZGVyQWN0aW9uKGxlYWYpO1xuICB9O1xuXG4gIHByaXZhdGUgcmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgdGhpcy5oYW5kbGVWYXVsdENyZWF0ZSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCB0aGlzLmhhbmRsZVZhdWx0UmVuYW1lKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKFwiZGVsZXRlXCIsIHRoaXMuaGFuZGxlVmF1bHREZWxldGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJUeXBDb250ZXh0TWVudUFjdGlvbnMoKTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51OiBNZW51LCBmaWxlOiBUQWJzdHJhY3RGaWxlKSA9PiB7XG4gICAgICAgIHRoaXMuYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnUsIHRoaXMuZ2V0VGFyZ2V0Rm9sZGVyKGZpbGUpKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXG4gICAgICAgIFwiZmlsZXMtbWVudVwiLFxuICAgICAgICAobWVudTogTWVudSwgZmlsZXM6IFRBYnN0cmFjdEZpbGVbXSB8IG51bGwpID0+IHtcbiAgICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gZmlsZXM/LlswXTtcbiAgICAgICAgICB0aGlzLmFkZE5ld1R5cENvbnRleHRNZW51SXRlbShtZW51LCB0aGlzLmdldFRhcmdldEZvbGRlcih0YXJnZXRGaWxlKSk7XG4gICAgICAgIH0sXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIHJlZ2lzdGVyUHJldmlld0NvbW1hbmQoKTogdm9pZCB7XG4gICAgY29uc3QgY29tbWFuZENvbnRyb2xsZXIgPSB0aGlzLmNyZWF0ZVByZXZpZXdDb21tYW5kQ29udHJvbGxlcigpO1xuICAgIHRoaXMucHJldmlld0NvbW1hbmRDb250cm9sbGVyID0gY29tbWFuZENvbnRyb2xsZXI7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFBSRVZJRVdfQ09NTUFORF9JRCxcbiAgICAgIG5hbWU6IFBSRVZJRVdfQ09NTUFORF9OQU1FLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzQXZhaWxhYmxlID0gY29tbWFuZENvbnRyb2xsZXIuaXNDb21tYW5kQXZhaWxhYmxlKCk7XG5cbiAgICAgICAgaWYgKGNoZWNraW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGlzQXZhaWxhYmxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0F2YWlsYWJsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZvaWQgY29tbWFuZENvbnRyb2xsZXIucnVuRnJvbUN1cnJlbnRDb250ZXh0KCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgc3luY1ByZXZpZXdIZWFkZXJBY3Rpb24obGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkIHtcbiAgICBpZiAoIWxlYWYgfHwgIShsZWFmLnZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcpKSB7XG4gICAgICBpZiAobGVhZikge1xuICAgICAgICB0aGlzLnJlbW92ZVByZXZpZXdIZWFkZXJBY3Rpb24obGVhZik7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IGxlYWYudmlldy5maWxlO1xuICAgIGlmICghYWN0aXZlRmlsZSB8fCAhdGhpcy5pc1R5cEZpbGUoYWN0aXZlRmlsZSkpIHtcbiAgICAgIHRoaXMucmVtb3ZlUHJldmlld0hlYWRlckFjdGlvbihsZWFmKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMucHJldmlld0NvbW1hbmRDb250cm9sbGVyIHx8IHRoaXMucHJldmlld0hlYWRlckFjdGlvbnMuaGFzKGxlYWYpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aW9uID0gbGVhZi52aWV3LmFkZEFjdGlvbih0aGlzLnByZXZpZXdJY29uLCBQUkVWSUVXX0NPTU1BTkRfTkFNRSwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLnJ1blByZXZpZXdGcm9tUmliYm9uKCk7XG4gICAgfSk7XG4gICAgdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy5zZXQobGVhZiwgYWN0aW9uKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVtb3ZlUHJldmlld0hlYWRlckFjdGlvbihsZWFmOiBXb3Jrc3BhY2VMZWFmKTogdm9pZCB7XG4gICAgY29uc3QgYWN0aW9uID0gdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy5nZXQobGVhZik7XG4gICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhY3Rpb24ucmVtb3ZlKCk7XG4gICAgdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy5kZWxldGUobGVhZik7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJ1blByZXZpZXdGcm9tUmliYm9uKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5wcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMucHJldmlld0NvbW1hbmRDb250cm9sbGVyLmlzQ29tbWFuZEF2YWlsYWJsZSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5wcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIucnVuRnJvbUN1cnJlbnRDb250ZXh0KCk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVByZXZpZXdDb21tYW5kQ29udHJvbGxlcigpOiBEZWZhdWx0UHJldmlld0NvbW1hbmRDb250cm9sbGVyIHtcbiAgICBjb25zdCBnZXRBY3RpdmVMaWtlID0gKCkgPT4ge1xuICAgICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICBpZiAoIWFjdGl2ZUZpbGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHBhdGg6IGFjdGl2ZUZpbGUucGF0aCxcbiAgICAgICAgZXh0ZW5zaW9uOiBhY3RpdmVGaWxlLmV4dGVuc2lvbixcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGNvbnN0IHZhdWx0QmFzZVBhdGggPSB0aGlzLmdldFZhdWx0QmFzZVBhdGgoKTtcblxuICAgIGNvbnN0IHJ1bm5lciA9IG5ldyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIoKTtcbiAgICBjb25zdCBvdXRwdXRQdWJsaXNoZXIgPSBuZXcgUHJldmlld091dHB1dFB1Ymxpc2hlcigpO1xuICAgIGNvbnN0IGV4ZWN1dGlvbiA9IG5ldyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UoXG4gICAgICBydW5uZXIsXG4gICAgICBvdXRwdXRQdWJsaXNoZXIsXG4gICAgICB7XG4gICAgICAgIHRpbWVvdXRNczogMTAwMDAwLFxuICAgICAgICBjd2Q6IHZhdWx0QmFzZVBhdGggPz8gdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICApO1xuICAgIGNvbnN0IHByZXNlbnRlciA9IG5ldyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyKFxuICAgICAgKHBhdGgpID0+IHRoaXMub3BlbkluUmlnaHRQYW5lKHBhdGgpLFxuICAgICAgKHBhdGgpID0+IHRoaXMub3BlbkJ5U3lzdGVtKHRoaXMucmVzb2x2ZVZhdWx0UGF0aChwYXRoKSksXG4gICAgICAocGF0aCkgPT4ge1xuICAgICAgICB2b2lkIHRoaXMucmV2ZWFsSW5Pcyh0aGlzLnJlc29sdmVWYXVsdFBhdGgocGF0aCkpO1xuICAgICAgfSxcbiAgICApO1xuICAgIGNvbnN0IGZhaWx1cmVQb2xpY3kgPSBuZXcgUHJldmlld0ZhaWx1cmVQb2xpY3koKTtcbiAgICBjb25zdCBzdGF0ZUd1YXJkID0gbmV3IFBsdWdpblN0YXRlR3VhcmQoXG4gICAgICAoKSA9PiB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmLFxuICAgICAgKGxlYWYpID0+IHRoaXMucmVzdG9yZUFjdGl2ZUxlYWYobGVhZiksXG4gICAgKTtcbiAgICBjb25zdCBydW50aW1lID0gbmV3IFByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2Uoe1xuICAgICAgdmVyaWZ5OiAoY29tbWFuZE5hbWUpID0+XG4gICAgICAgIG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgY29uc3QgdGVzdFByb2Nlc3MgPSBzcGF3bihjb21tYW5kTmFtZSwgW1wiLS12ZXJzaW9uXCJdLCB7XG4gICAgICAgICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwiaWdub3JlXCIsIFwicGlwZVwiXSxcbiAgICAgICAgICAgIGN3ZDogdmF1bHRCYXNlUGF0aCA/PyB1bmRlZmluZWQsXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICB0ZXN0UHJvY2Vzcy5vbihcImVycm9yXCIsICgpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZmFsc2UpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgdGVzdFByb2Nlc3Mub24oXCJjbG9zZVwiLCAoY29kZSkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZShjb2RlID09PSAwIHx8IGNvZGUgPT09IG51bGwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KSxcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgRGVmYXVsdFByZXZpZXdDb21tYW5kQ29udHJvbGxlcih7XG4gICAgICByZXNvbHZlcjogbmV3IFByZXZpZXdDb250ZXh0UmVzb2x2ZXIoZ2V0QWN0aXZlTGlrZSksXG4gICAgICBydW50aW1lLFxuICAgICAgZXhlY3V0aW9uLFxuICAgICAgcHJlc2VudGVyLFxuICAgICAgZmFpbHVyZVBvbGljeSxcbiAgICAgIHN0YXRlR3VhcmQsXG4gICAgICBvbk5vdGljZTogKG1lc3NhZ2UpID0+IG5ldyBOb3RpY2UobWVzc2FnZSksXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG9wZW5CeVN5c3RlbShwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nIHwgbnVsbD4oKHJlc29sdmUpID0+IHtcbiAgICAgIGNvbnN0IGNvbW1hbmQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiID8gXCJvcGVuXCIgOiBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIgPyBcImNtZFwiIDogXCJ4ZGctb3BlblwiO1xuICAgICAgY29uc3QgYXJncyA9XG4gICAgICAgIHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIlxuICAgICAgICAgID8gW1wiL2NcIiwgXCJzdGFydFwiLCBcIlwiLCBwYXRoXVxuICAgICAgICAgIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIlxuICAgICAgICAgICAgPyBbcGF0aF1cbiAgICAgICAgICAgIDogW3BhdGhdO1xuXG4gICAgICBsZXQgY2hpbGQ6IENoaWxkUHJvY2VzcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGNoaWxkID0gc3Bhd24oY29tbWFuZCwgYXJncywge1xuICAgICAgICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJpZ25vcmVcIiwgXCJwaXBlXCJdLFxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJlc29sdmUoYG9wZW4gY29tbWFuZCBmYWlsZWQ6ICR7U3RyaW5nKGVycm9yKX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgc3RkZXJyID0gXCJcIjtcbiAgICAgIGNoaWxkLnN0ZGVycj8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xuICAgICAgICBzdGRlcnIgKz0gU3RyaW5nKGNodW5rKTtcbiAgICAgIH0pO1xuXG4gICAgICBjaGlsZC5vbihcImVycm9yXCIsIChlcnJvcikgPT4ge1xuICAgICAgICByZXNvbHZlKGBvcGVuIGNvbW1hbmQgZmFpbGVkOiAke1N0cmluZyhlcnJvcil9YCk7XG4gICAgICB9KTtcblxuICAgICAgY2hpbGQub24oXCJjbG9zZVwiLCAoY29kZSkgPT4ge1xuICAgICAgICBpZiAoY29kZSA9PT0gMCB8fCBjb2RlID09PSBudWxsKSB7XG4gICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RkZXJyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXNvbHZlKGBvcGVuIGNvbW1hbmQgZmFpbGVkOiAke3N0ZGVycn1gKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXNvbHZlKGBvcGVuIGNvbW1hbmQgZmFpbGVkIHdpdGggZXhpdCBjb2RlICR7U3RyaW5nKGNvZGUpfWApO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIG9wZW5JblJpZ2h0UGFuZShwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG4gICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgVEZpbGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGFydGlmYWN0IGlzIG5vdCBhIHZhdWx0IGZpbGU6ICR7cGF0aH1gKTtcbiAgICB9XG5cbiAgICBjb25zdCByaWdodExlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihcInNwbGl0XCIsIFwidmVydGljYWxcIik7XG4gICAgYXdhaXQgcmlnaHRMZWFmLm9wZW5GaWxlKHRhcmdldCwgeyBhY3RpdmU6IGZhbHNlIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXZlYWxJbk9zKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiID8gXCJvcGVuXCIgOiBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIgPyBcImNtZFwiIDogXCJ4ZGctb3BlblwiO1xuICAgIGNvbnN0IGFyZ3MgPVxuICAgICAgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiXG4gICAgICAgID8gW1wiL2NcIiwgXCJzdGFydFwiLCBcIlwiLCBwYXRoXVxuICAgICAgICA6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCJcbiAgICAgICAgICA/IFtcIi1SXCIsIHBhdGhdXG4gICAgICAgICAgOiBbcGF0aF07XG5cbiAgICBhd2FpdCB0aGlzLm9wZW5CeVN5c3RlbVdpdGhBcmdzKGNvbW1hbmQsIGFyZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBvcGVuQnlTeXN0ZW1XaXRoQXJncyhjb21tYW5kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICBsZXQgY2hpbGQ6IENoaWxkUHJvY2VzcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGNoaWxkID0gc3Bhd24oY29tbWFuZCwgYXJncywge1xuICAgICAgICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJpZ25vcmVcIiwgXCJpZ25vcmVcIl0sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICBjaGlsZC5vbihcImVycm9yXCIsICgpID0+IHJlc29sdmUoKSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVWYXVsdFBhdGgocmVsYXRpdmVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHZhdWx0QmFzZVBhdGggPSB0aGlzLmdldFZhdWx0QmFzZVBhdGgoKTtcbiAgICBpZiAoIXZhdWx0QmFzZVBhdGgpIHtcbiAgICAgIHJldHVybiByZWxhdGl2ZVBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGpvaW4odmF1bHRCYXNlUGF0aCwgcmVsYXRpdmVQYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VmF1bHRCYXNlUGF0aCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBhZGFwdGVyID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlcjtcbiAgICBjb25zdCBtYXliZUdldEJhc2VQYXRoID1cbiAgICAgIFwiZ2V0QmFzZVBhdGhcIiBpbiBhZGFwdGVyICYmIHR5cGVvZiBhZGFwdGVyLmdldEJhc2VQYXRoID09PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgPyBhZGFwdGVyLmdldEJhc2VQYXRoXG4gICAgICAgIDogbnVsbDtcblxuICAgIGlmICghbWF5YmVHZXRCYXNlUGF0aCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1heWJlR2V0QmFzZVBhdGguY2FsbChhZGFwdGVyKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnU6IE1lbnUsIHRhcmdldDogVEZvbGRlcik6IHZvaWQge1xuICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgaXRlbVxuICAgICAgICAuc2V0VGl0bGUoXCJOZXcgVHlwc3RcIilcbiAgICAgICAgLnNldEljb24oXCJmaWxlLXBsdXMtY29ybmVyXCIpXG4gICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbmFtZSA9IGF3YWl0IHRoaXMucmVzb2x2ZVVuaXF1ZVR5cEZpbGVOYW1lKHRhcmdldCk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gdGhpcy5qb2luUGF0aCh0YXJnZXQucGF0aCwgbmFtZSk7XG4gICAgICAgICAgICBjb25zdCBjcmVhdGVkID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKHRhcmdldFBhdGgsIFwiXCIpO1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZihmYWxzZSkub3BlbkZpbGUoY3JlYXRlZCk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbdHlwc2lkaWFuXSBmYWlsZWQgdG8gY3JlYXRlIHR5cCBmaWxlXCIsIGVycm9yKTtcbiAgICAgICAgICAgIG5ldyBOb3RpY2UoXCIudHlwIFx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA2RVx1NEY1Q1x1NjIxMFx1MzA2Qlx1NTkzMVx1NjU1N1x1MzA1N1x1MzA3RVx1MzA1N1x1MzA1RlwiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXNvbHZlVW5pcXVlVHlwRmlsZU5hbWUoZm9sZGVyOiBURm9sZGVyKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBpbml0aWFsTmFtZSA9IGAke05FV19UWVBfTkFNRX0ke05FV19UWVBfRVhUfWA7XG4gICAgaWYgKFxuICAgICAgIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChcbiAgICAgICAgdGhpcy5qb2luUGF0aChmb2xkZXIucGF0aCwgaW5pdGlhbE5hbWUpLFxuICAgICAgKVxuICAgICkge1xuICAgICAgcmV0dXJuIGluaXRpYWxOYW1lO1xuICAgIH1cblxuICAgIGxldCBjb3VudGVyID0gMTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgbmFtZSA9IGAke05FV19UWVBfTkFNRX0gJHtjb3VudGVyfSR7TkVXX1RZUF9FWFR9YDtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0aGlzLmpvaW5QYXRoKGZvbGRlci5wYXRoLCBuYW1lKSlcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gbmFtZTtcbiAgICAgIH1cbiAgICAgIGNvdW50ZXIgKz0gMTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGdldFRhcmdldEZvbGRlcihmaWxlPzogVEFic3RyYWN0RmlsZSk6IFRGb2xkZXIge1xuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgcmV0dXJuIGZpbGU7XG4gICAgfVxuXG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgcmV0dXJuIGZpbGUucGFyZW50ID8/IHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBpc1R5cEZpbGUoZmlsZTogVEFic3RyYWN0RmlsZSk6IGZpbGUgaXMgVEZpbGUge1xuICAgIHJldHVybiBmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKSA9PT0gVFlQX0VYVEVOU0lPTjtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TGVhZkJ5VHlwRmlsZShwYXRoOiBzdHJpbmcpOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZVxuICAgICAgICAuZ2V0TGVhdmVzT2ZUeXBlKFRZUF9WSUVXKVxuICAgICAgICAuZmluZCgobGVhZikgPT5cbiAgICAgICAgICBsZWFmLnZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcgJiYgbGVhZi52aWV3LmZpbGU/LnBhdGggPT09IHBhdGhcbiAgICAgICAgKSB8fFxuICAgICAgbnVsbFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVZhdWx0Q3JlYXRlID0gKGZpbGU6IFRBYnN0cmFjdEZpbGUpOiB2b2lkID0+IHtcbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sb2dMaWZlY3ljbGUoXCJjcmVhdGVcIiwgZmlsZSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVWYXVsdFJlbmFtZSA9IChmaWxlOiBUQWJzdHJhY3RGaWxlLCBvbGRQYXRoOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sb2dMaWZlY3ljbGUoXCJyZW5hbWVcIiwgZmlsZSwgb2xkUGF0aCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVWYXVsdERlbGV0ZSA9IChmaWxlOiBUQWJzdHJhY3RGaWxlKTogdm9pZCA9PiB7XG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nTGlmZWN5Y2xlKFwiZGVsZXRlXCIsIGZpbGUpO1xuICB9O1xuXG4gIHByaXZhdGUgaXNUeXBGaWxlQWNjZXNzaWJsZShmaWxlOiBURmlsZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZS5wYXRoKSBpbnN0YW5jZW9mIFRGaWxlO1xuICB9XG5cbiAgcHJpdmF0ZSByZXN0b3JlQWN0aXZlTGVhZihsZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmICghbGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjdGl2ZUxlYWYgPSB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmO1xuICAgIGlmIChhY3RpdmVMZWFmID09PSBsZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnNldEFjdGl2ZUxlYWYobGVhZiwgeyBmb2N1czogdHJ1ZSB9KTtcbiAgfVxuXG4gIHByaXZhdGUgbG9nTGlmZWN5Y2xlKFxuICAgIGV2ZW50TmFtZTogXCJjcmVhdGVcIiB8IFwicmVuYW1lXCIgfCBcImRlbGV0ZVwiLFxuICAgIGZpbGU6IFR5cExpZmVjeWNsZUV2ZW50VGFyZ2V0LFxuICAgIG9sZFBhdGg/OiBzdHJpbmcsXG4gICk6IHZvaWQge1xuICAgIGlmIChvbGRQYXRoKSB7XG4gICAgICBjb25zb2xlLmluZm8oYFt0eXBzaWRpYW5dICR7ZXZlbnROYW1lfTogJHtvbGRQYXRofSAtPiAke2ZpbGUucGF0aH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmluZm8oYFt0eXBzaWRpYW5dICR7ZXZlbnROYW1lfTogJHtmaWxlLnBhdGh9YCk7XG4gIH1cblxuICBwcml2YXRlIGxvZ1N0YXJ0dXBTdGF0ZSgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmluZm8oXG4gICAgICBcIlt0eXBzaWRpYW5dIHN0YXJ0dXAgb2JzZXJ2ZXJzIGFuZCBjb250ZXh0IG1lbnUgYWN0aW9ucyByZWdpc3RlcmVkXCIsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgam9pblBhdGgoZm9sZGVyUGF0aDogc3RyaW5nLCBmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoIWZvbGRlclBhdGgpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYCR7Zm9sZGVyUGF0aH0vJHtmaWxlTmFtZX1gO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNvbHZlUHJldmlld0ljb24oKTogc3RyaW5nIHtcbiAgICBpZiAoZ2V0SWNvbihQUkVWSUVXX0lDT05fUFJJTUFSWSkpIHtcbiAgICAgIHJldHVybiBQUkVWSUVXX0lDT05fUFJJTUFSWTtcbiAgICB9XG5cbiAgICByZXR1cm4gUFJFVklFV19JQ09OX0ZBTExCQUNLO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBhY3Rpb24gb2YgdGhpcy5wcmV2aWV3SGVhZGVyQWN0aW9ucy52YWx1ZXMoKSkge1xuICAgICAgYWN0aW9uLnJlbW92ZSgpO1xuICAgIH1cbiAgICB0aGlzLnByZXZpZXdIZWFkZXJBY3Rpb25zLmNsZWFyKCk7XG5cbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gdW5sb2FkZWRcIik7XG4gIH1cbn1cbiIsICJleHBvcnQgY29uc3QgVFlQX0ZJTEVfRVhURU5TSU9OID0gXCJ0eXBcIjtcbmV4cG9ydCBjb25zdCBQUkVWSUVXX0NPTU1BTkRfTkFNRSA9IFwiUHJldmlldyBUeXBzdFwiO1xuZXhwb3J0IGNvbnN0IFBSRVZJRVdfQ09NTUFORF9JRCA9IFwicHJldmlldy10eXBzdFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdGaWxlTGlrZSB7XG4gIHJlYWRvbmx5IHBhdGg6IHN0cmluZztcbiAgcmVhZG9ubHkgZXh0ZW5zaW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdUYXJnZXQgPSB7XG4gIGZpbGVQYXRoOiBzdHJpbmc7XG4gIGRpc3BsYXlOYW1lOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBQcmV2aWV3UmVzb2x2ZUVycm9yID0gXCJOT19BQ1RJVkVfVEFSR0VUXCI7XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdSZXNvbHZlUmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyB0YXJnZXQ6IFByZXZpZXdUYXJnZXQgfVxuICB8IHsgb2s6IGZhbHNlOyByZWFzb246IFByZXZpZXdSZXNvbHZlRXJyb3IgfTtcblxuZXhwb3J0IHR5cGUgUnVudGltZUNvbW1hbmQgPSBzdHJpbmc7XG5cbmV4cG9ydCB0eXBlIFJ1bnRpbWVDaGVja1Jlc3VsdCA9XG4gIHwge1xuICAgICAgb2s6IHRydWU7XG4gICAgICByZXNvbHZlZENvbW1hbmQ6IFJ1bnRpbWVDb21tYW5kO1xuICAgIH1cbiAgfCB7XG4gICAgICBvazogZmFsc2U7XG4gICAgICByZWFzb246IFwiTUlTU0lOR19SVU5USU1FXCIgfCBcIklOVkFMSURfUEFUSFwiO1xuICAgIH07XG5cbmV4cG9ydCB0eXBlIFByb2Nlc3NSdW5SZXN1bHQgPSB7XG4gIGV4aXRDb2RlOiBudW1iZXIgfCBudWxsO1xuICBzdGRvdXQ6IHN0cmluZztcbiAgc3RkZXJyOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBQcmV2aWV3RXhlY3V0aW9uUmVzdWx0ID0ge1xuICBhcnRpZmFjdFBhdGg6IHN0cmluZztcbiAgY29tbWFuZFJ1bkF0OiBzdHJpbmc7XG4gIGRldGVybWluaXN0aWNLZXk6IHN0cmluZztcbiAgcHJvY2Vzc1J1bjogUHJvY2Vzc1J1blJlc3VsdDtcbn07XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnkgPVxuICB8IFwiREVQRU5ERU5DWV9NSVNTSU5HXCJcbiAgfCBcIlBST0NFU1NfRkFJTEVEX1RPX1NUQVJUXCJcbiAgfCBcIlBST0NFU1NfVElNRU9VVFwiXG4gIHwgXCJQUk9DRVNTX0VYSVRfRVJST1JcIlxuICB8IFwiQVJUSUZBQ1RfTk9UX0ZPVU5EXCJcbiAgfCBcIkFSVElGQUNUX09QRU5fRkFJTEVEXCI7XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdGbG93UmVzdWx0ID1cbiAgfCB7XG4gICAgICBvazogdHJ1ZTtcbiAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICAgIGFydGlmYWN0UGF0aDogc3RyaW5nO1xuICAgIH1cbiAgfCB7XG4gICAgICBvazogZmFsc2U7XG4gICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgfTtcbiIsICJpbXBvcnQge1xuICBQcmV2aWV3Rmxvd1Jlc3VsdCxcbiAgUHJldmlld0ZhaWx1cmVDYXRlZ29yeSxcbiAgUnVudGltZUNoZWNrUmVzdWx0LFxufSBmcm9tIFwiLi9jb250cmFjdHNcIjtcbmltcG9ydCB7IFByZXZpZXdDb250ZXh0UmVzb2x2ZXIgfSBmcm9tIFwiLi9wcmV2aWV3Q29udGV4dFJlc29sdmVyXCI7XG5pbXBvcnQgeyBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlIH0gZnJvbSBcIi4vcHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZVwiO1xuaW1wb3J0IHsgUHJldmlld091dHB1dFByZXNlbnRlciB9IGZyb20gXCIuL3ByZXZpZXdPdXRwdXRQcmVzZW50ZXJcIjtcbmltcG9ydCB7IFByZXZpZXdGYWlsdXJlUG9saWN5IH0gZnJvbSBcIi4vcHJldmlld0ZhaWx1cmVQb2xpY3lcIjtcbmltcG9ydCB7XG4gIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlLFxufSBmcm9tIFwiLi9wcmV2aWV3RXhlY3V0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgUGx1Z2luU3RhdGVHdWFyZCB9IGZyb20gXCIuL3BsdWdpblN0YXRlR3VhcmRcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIge1xuICBpc0NvbW1hbmRBdmFpbGFibGUoKTogYm9vbGVhbjtcbiAgcnVuRnJvbUN1cnJlbnRDb250ZXh0KCk6IFByb21pc2U8UHJldmlld0Zsb3dSZXN1bHQ+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdDb21tYW5kQ29udHJvbGxlckRlcHMge1xuICByZXNvbHZlcjogUHJldmlld0NvbnRleHRSZXNvbHZlcjtcbiAgcnVudGltZTogUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZTtcbiAgZXhlY3V0aW9uOiBQcmV2aWV3RXhlY3V0aW9uU2VydmljZTtcbiAgcHJlc2VudGVyOiBQcmV2aWV3T3V0cHV0UHJlc2VudGVyO1xuICBmYWlsdXJlUG9saWN5OiBQcmV2aWV3RmFpbHVyZVBvbGljeTtcbiAgc3RhdGVHdWFyZDogUGx1Z2luU3RhdGVHdWFyZDtcbiAgb25Ob3RpY2U6IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0UHJldmlld0NvbW1hbmRDb250cm9sbGVyXG4gIGltcGxlbWVudHMgUHJldmlld0NvbW1hbmRDb250cm9sbGVyXG57XG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGRlcHM6IFByZXZpZXdDb21tYW5kQ29udHJvbGxlckRlcHMpIHt9XG5cbiAgcHVibGljIGlzQ29tbWFuZEF2YWlsYWJsZSgpOiBib29sZWFuIHtcbiAgICBjb25zdCB0YXJnZXRSZXN1bHQgPSB0aGlzLmRlcHMucmVzb2x2ZXIucmVzb2x2ZVRhcmdldEZvckNvbW1hbmQoKTtcbiAgICByZXR1cm4gdGFyZ2V0UmVzdWx0Lm9rO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkZyb21DdXJyZW50Q29udGV4dCgpOiBQcm9taXNlPFByZXZpZXdGbG93UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMuZGVwcy5zdGF0ZUd1YXJkLndpdGhMZWFmUHJlc2VydmVkKGFzeW5jICgpID0+IHtcbiAgICAgIGxldCBhcnRpZmFjdFBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IHRhcmdldFJlc3VsdCA9IHRoaXMuZGVwcy5yZXNvbHZlci5yZXNvbHZlVGFyZ2V0Rm9yQ29tbWFuZCgpO1xuICAgICAgaWYgKCF0YXJnZXRSZXN1bHQub2spIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IFwiVHlwc3QgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDRDXHU5MDc4XHU2MjlFXHUzMDU1XHUzMDhDXHUzMDY2XHUzMDQ0XHUzMDdFXHUzMDVCXHUzMDkzXHUzMDAyXHU3M0ZFXHU1NzI4XHUzMDZFXHU3REU4XHU5NkM2XHU1QkZFXHU4QzYxXHUzMDkyXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XHUzMDAyXCI7XG4gICAgICAgIHRoaXMuZGVwcy5vbk5vdGljZShtZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcnVudGltZVJlc3VsdDogUnVudGltZUNoZWNrUmVzdWx0ID1cbiAgICAgICAgYXdhaXQgdGhpcy5kZXBzLnJ1bnRpbWUuZW5zdXJlUnVudGltZUF2YWlsYWJsZShcInR5cHN0XCIpO1xuICAgICAgaWYgKCFydW50aW1lUmVzdWx0Lm9rKSB7XG4gICAgICAgIGNvbnN0IHJ1bnRpbWVDYXRlZ29yeSA9XG4gICAgICAgICAgcnVudGltZVJlc3VsdC5yZWFzb24gPT09IFwiTUlTU0lOR19SVU5USU1FXCJcbiAgICAgICAgICAgID8gXCJERVBFTkRFTkNZX01JU1NJTkdcIlxuICAgICAgICAgICAgOiBcIlBST0NFU1NfRkFJTEVEX1RPX1NUQVJUXCI7XG4gICAgICAgIHJldHVybiB0aGlzLnByZXNlbnRGYWlsdXJlKHJ1bnRpbWVDYXRlZ29yeSwgXCJUeXBzdCBDTEkgXHUzMDRDXHU4OThCXHUzMDY0XHUzMDRCXHUzMDhBXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDAyXCIsIHtcbiAgICAgICAgICBjb21tYW5kOiBcInR5cHN0XCIsXG4gICAgICAgICAgcmVhc29uOiBydW50aW1lUmVzdWx0LnJlYXNvbixcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGV4ZWN1dGlvblJlc3VsdCA9IGF3YWl0IHRoaXMuZGVwcy5leGVjdXRpb24uZXhlY3V0ZVByZXZpZXcoXG4gICAgICAgICAgdGFyZ2V0UmVzdWx0LnRhcmdldCxcbiAgICAgICAgICBydW50aW1lUmVzdWx0LnJlc29sdmVkQ29tbWFuZCxcbiAgICAgICAgKTtcbiAgICAgICAgYXJ0aWZhY3RQYXRoID0gZXhlY3V0aW9uUmVzdWx0LmFydGlmYWN0UGF0aDtcbiAgICAgICAgYXdhaXQgdGhpcy5kZXBzLnByZXNlbnRlci5vcGVuQXJ0aWZhY3QoYXJ0aWZhY3RQYXRoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6IFwiUHJldmlldyBUeXBzdCBcdTMwOTJcdTk1OEJcdTMwNERcdTMwN0VcdTMwNTdcdTMwNUZcdTMwMDJcIixcbiAgICAgICAgICBhcnRpZmFjdFBhdGg6IGV4ZWN1dGlvblJlc3VsdC5hcnRpZmFjdFBhdGgsXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBmYWxsYmFja01lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwidW5rbm93blwiO1xuICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHRoaXMuZGVwcy5mYWlsdXJlUG9saWN5LmNsYXNzaWZ5KGVycm9yLCBmYWxsYmFja01lc3NhZ2UpO1xuICAgICAgICBjb25zdCBhcnRpZmFjdFBhdGhGcm9tRXJyb3IgPVxuICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRXJyb3JcbiAgICAgICAgICAgID8gL2FydGlmYWN0IG5vdCBmb3VuZDpcXHMqKC4rKSQvaS5leGVjKGVycm9yLm1lc3NhZ2UpPy5bMV1cbiAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnByZXNlbnRGYWlsdXJlKGNhdGVnb3J5LCBmYWxsYmFja01lc3NhZ2UsIHtcbiAgICAgICAgICBjb21tYW5kOiBydW50aW1lUmVzdWx0LnJlc29sdmVkQ29tbWFuZCxcbiAgICAgICAgICBwYXRoOiBhcnRpZmFjdFBhdGhGcm9tRXJyb3IgPz8gYXJ0aWZhY3RQYXRoID8/IHRhcmdldFJlc3VsdC50YXJnZXQuZmlsZVBhdGgsXG4gICAgICAgICAgcmVhc29uOiBmYWxsYmFja01lc3NhZ2UsXG4gICAgICAgIH0sXG4gICAgICAgIGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlc2VudEZhaWx1cmUoXG4gICAgY2F0ZWdvcnk6IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnksXG4gICAgZmFsbGJhY2tNZXNzYWdlOiBzdHJpbmcsXG4gICAgY29udGV4dDoge1xuICAgICAgY29tbWFuZD86IHN0cmluZztcbiAgICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgICByZWFzb24/OiBzdHJpbmc7XG4gICAgfSxcbiAgICBlcnJvcj86IHVua25vd24sXG4gICk6IFByZXZpZXdGbG93UmVzdWx0IHtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5kZXBzLmZhaWx1cmVQb2xpY3kuZ2V0Tm90aWNlTWVzc2FnZShjYXRlZ29yeSwgY29udGV4dCk7XG4gICAgY29uc3QgbG9nQ29udGV4dCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGNhdGVnb3J5LFxuICAgICAgbWVzc2FnZTogZmFsbGJhY2tNZXNzYWdlLFxuICAgICAgcmVhc29uOiBjb250ZXh0LnJlYXNvbixcbiAgICB9KTtcblxuICAgIGNvbnNvbGUud2FybihcIlt0eXBzaWRpYW5dIHByZXZpZXcgZmFpbGVkXCIsIGxvZ0NvbnRleHQpO1xuICAgIHRoaXMuZGVwcy5vbk5vdGljZShtZXNzYWdlKTtcblxuICAgIHJldHVybiB7XG4gICAgICBvazogZmFsc2UsXG4gICAgICBtZXNzYWdlLFxuICAgIH07XG4gIH1cbn1cbiIsICJpbXBvcnQge1xuICBQcmV2aWV3RmlsZUxpa2UsXG4gIFByZXZpZXdSZXNvbHZlRXJyb3IsXG4gIFByZXZpZXdSZXNvbHZlUmVzdWx0LFxuICBUWVBfRklMRV9FWFRFTlNJT04sXG59IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG50eXBlIEFjdGl2ZUZpbGVQcm92aWRlciA9ICgpID0+IFByZXZpZXdGaWxlTGlrZSB8IG51bGw7XG5cbmV4cG9ydCBjbGFzcyBQcmV2aWV3Q29udGV4dFJlc29sdmVyIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZ2V0QWN0aXZlRmlsZTogQWN0aXZlRmlsZVByb3ZpZGVyKSB7fVxuXG4gIHB1YmxpYyByZXNvbHZlVGFyZ2V0Rm9yQ29tbWFuZCgpOiBQcmV2aWV3UmVzb2x2ZVJlc3VsdCB7XG4gICAgY29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuZ2V0QWN0aXZlRmlsZSgpO1xuXG4gICAgaWYgKCFhY3RpdmVGaWxlIHx8ICF0aGlzLmlzVHlwRmlsZShhY3RpdmVGaWxlKSkge1xuICAgICAgcmV0dXJuIHRoaXMuZmFpbChcIk5PX0FDVElWRV9UQVJHRVRcIik7XG4gICAgfVxuXG4gICAgY29uc3QgZmlsZU5hbWUgPSB0aGlzLmdldEZpbGVOYW1lKGFjdGl2ZUZpbGUucGF0aCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb2s6IHRydWUsXG4gICAgICB0YXJnZXQ6IHtcbiAgICAgICAgZmlsZVBhdGg6IGFjdGl2ZUZpbGUucGF0aCxcbiAgICAgICAgZGlzcGxheU5hbWU6IGZpbGVOYW1lLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBpc1R5cEZpbGUoZmlsZTogUHJldmlld0ZpbGVMaWtlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZpbGUuZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCkgPT09IFRZUF9GSUxFX0VYVEVOU0lPTjtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0RmlsZU5hbWUocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBpbmRleCA9IHBhdGgubGFzdEluZGV4T2YoXCIvXCIpO1xuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgIHJldHVybiBwYXRoO1xuICAgIH1cblxuICAgIHJldHVybiBwYXRoLnNsaWNlKGluZGV4ICsgMSk7XG4gIH1cblxuICBwcml2YXRlIGZhaWwocmVhc29uOiBQcmV2aWV3UmVzb2x2ZUVycm9yKTogeyBvazogZmFsc2U7IHJlYXNvbjogUHJldmlld1Jlc29sdmVFcnJvciB9IHtcbiAgICByZXR1cm4geyBvazogZmFsc2UsIHJlYXNvbiB9O1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUnVudGltZUNoZWNrUmVzdWx0IH0gZnJvbSBcIi4vY29udHJhY3RzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUnVudGltZVZlcmlmaWVyIHtcbiAgdmVyaWZ5KGNvbW1hbmROYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+O1xufVxuXG5leHBvcnQgY2xhc3MgUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZSB7XG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHZlcmlmaWVyOiBSdW50aW1lVmVyaWZpZXIpIHt9XG5cbiAgcHVibGljIGFzeW5jIGVuc3VyZVJ1bnRpbWVBdmFpbGFibGUoY29tbWFuZE5hbWU6IHN0cmluZyk6IFByb21pc2U8UnVudGltZUNoZWNrUmVzdWx0PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGF2YWlsYWJsZSA9IGF3YWl0IHRoaXMudmVyaWZpZXIudmVyaWZ5KGNvbW1hbmROYW1lKTtcbiAgICAgIGlmICghYXZhaWxhYmxlKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgIHJlYXNvbjogXCJNSVNTSU5HX1JVTlRJTUVcIixcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IHRydWUsXG4gICAgICAgIHJlc29sdmVkQ29tbWFuZDogY29tbWFuZE5hbWUsXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvazogZmFsc2UsXG4gICAgICAgIHJlYXNvbjogdGhpcy5jbGFzc2lmeUVycm9yKGVycm9yKSxcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlc2V0UnVudGltZUNhY2hlKCk6IHZvaWQge1xuICAgIC8vIE5vLW9wOiBydW50aW1lIGNhY2hlIGlzIG5vdCBpbXBsZW1lbnRlZCB5ZXQuXG4gICAgdm9pZCAwO1xuICB9XG5cbiAgcHJpdmF0ZSBjbGFzc2lmeUVycm9yKGVycm9yOiB1bmtub3duKTogXCJNSVNTSU5HX1JVTlRJTUVcIiB8IFwiSU5WQUxJRF9QQVRIXCIge1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgZXJyb3IgIT09IG51bGwgJiZcbiAgICAgIFwiY29kZVwiIGluIGVycm9yICYmXG4gICAgICBlcnJvci5jb2RlID09PSBcIkVOT0VOVFwiXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJNSVNTSU5HX1JVTlRJTUVcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJJTlZBTElEX1BBVEhcIjtcbiAgfVxufVxuIiwgImltcG9ydCB7IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnkgfSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBGYWlsdXJlQ2F0ZWdvcnlDb250ZXh0IHtcbiAgY29tbWFuZD86IHN0cmluZztcbiAgcGF0aD86IHN0cmluZztcbiAgcmVhc29uPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdGYWlsdXJlUG9saWN5Q29udHJhY3Qge1xuICBjbGFzc2lmeShlcnJvcjogdW5rbm93biwgZmFsbGJhY2tNZXNzYWdlOiBzdHJpbmcpOiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5O1xuICBnZXROb3RpY2VNZXNzYWdlKGNhdGVnb3J5OiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5LCBjb250ZXh0OiBGYWlsdXJlQ2F0ZWdvcnlDb250ZXh0KTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgUHJldmlld0ZhaWx1cmVQb2xpY3kgaW1wbGVtZW50cyBQcmV2aWV3RmFpbHVyZVBvbGljeUNvbnRyYWN0IHtcbiAgcHVibGljIGNsYXNzaWZ5KGVycm9yOiB1bmtub3duLCBmYWxsYmFja01lc3NhZ2U6IHN0cmluZyk6IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnkge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmV4dHJhY3RNZXNzYWdlKGVycm9yKTtcblxuICAgIGlmIChcbiAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgZXJyb3IgIT09IG51bGwgJiZcbiAgICAgIFwiY29kZVwiIGluIGVycm9yICYmXG4gICAgICBlcnJvci5jb2RlID09PSBcIkVOT0VOVFwiXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJERVBFTkRFTkNZX01JU1NJTkdcIjtcbiAgICB9XG5cbiAgICBpZiAobWVzc2FnZS5pbmNsdWRlcyhcInRpbWVvdXRcIikpIHtcbiAgICAgIHJldHVybiBcIlBST0NFU1NfVElNRU9VVFwiO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHR5cGVvZiBlcnJvciA9PT0gXCJvYmplY3RcIiAmJlxuICAgICAgZXJyb3IgIT09IG51bGwgJiZcbiAgICAgIFwiZXhpdENvZGVcIiBpbiBlcnJvciAmJlxuICAgICAgKGVycm9yIGFzIHsgZXhpdENvZGU6IG51bWJlciB8IG51bGwgfSkuZXhpdENvZGUgIT09IDBcbiAgICApIHtcbiAgICAgIHJldHVybiBcIlBST0NFU1NfRVhJVF9FUlJPUlwiO1xuICAgIH1cblxuICAgIGlmIChmYWxsYmFja01lc3NhZ2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcInRpbWVvdXRcIikpIHtcbiAgICAgIHJldHVybiBcIlBST0NFU1NfVElNRU9VVFwiO1xuICAgIH1cblxuICAgIGlmIChmYWxsYmFja01lc3NhZ2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcImFydGlmYWN0XCIpKSB7XG4gICAgICByZXR1cm4gXCJBUlRJRkFDVF9OT1RfRk9VTkRcIjtcbiAgICB9XG5cbiAgICBpZiAoZmFsbGJhY2tNZXNzYWdlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoXCJvcGVuXCIpKSB7XG4gICAgICByZXR1cm4gXCJBUlRJRkFDVF9PUEVOX0ZBSUxFRFwiO1xuICAgIH1cblxuICAgIHJldHVybiBcIlBST0NFU1NfRkFJTEVEX1RPX1NUQVJUXCI7XG4gIH1cblxuICBwdWJsaWMgZ2V0Tm90aWNlTWVzc2FnZShcbiAgICBjYXRlZ29yeTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeSxcbiAgICBjb250ZXh0OiBGYWlsdXJlQ2F0ZWdvcnlDb250ZXh0LFxuICApOiBzdHJpbmcge1xuICAgIHN3aXRjaCAoY2F0ZWdvcnkpIHtcbiAgICAgIGNhc2UgXCJERVBFTkRFTkNZX01JU1NJTkdcIjpcbiAgICAgICAgcmV0dXJuIFwiVHlwc3QgQ0xJIFx1MzA0Q1x1ODk4Qlx1MzA2NFx1MzA0Qlx1MzA4QVx1MzA3RVx1MzA1Qlx1MzA5M1x1MzAwMmB0eXBzdGAgXHUzMDRDIFBBVEggXHUzMDRCXHUzMDg5XHU1QjlGXHU4ODRDXHUzMDY3XHUzMDREXHUzMDhCXHUzMDRCXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XHUzMDAyXCI7XG4gICAgICBjYXNlIFwiUFJPQ0VTU19USU1FT1VUXCI6XG4gICAgICAgIHJldHVybiBcIlR5cHN0IENMSSBcdTMwNkVcdTVCOUZcdTg4NENcdTMwNENcdTMwQkZcdTMwQTRcdTMwRTBcdTMwQTJcdTMwQTZcdTMwQzhcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUZcdTMwMDJcdTUxNjVcdTUyOUJcdTUxODVcdTVCQjlcdTMwOTJcdTc4QkFcdThBOERcdTMwNTdcdTMwNjZcdTUxOERcdTVCOUZcdTg4NENcdTMwNTdcdTMwNjZcdTMwNEZcdTMwNjBcdTMwNTVcdTMwNDRcdTMwMDJcIjtcbiAgICAgIGNhc2UgXCJQUk9DRVNTX0VYSVRfRVJST1JcIjpcbiAgICAgICAgcmV0dXJuIGBUeXBzdCBDTEkgXHUzMDRDICR7Y29udGV4dC5jb21tYW5kID8/IFwiXHUzMEIzXHUzMERFXHUzMEYzXHUzMEM5XCJ9IFx1MzA2N1x1NTkzMVx1NjU1N1x1MzA1N1x1MzA3RVx1MzA1N1x1MzA1Rlx1MzAwMmA7XG4gICAgICBjYXNlIFwiQVJUSUZBQ1RfTk9UX0ZPVU5EXCI6XG4gICAgICAgIHJldHVybiBgUERGIFx1NjIxMFx1Njc5Q1x1NzI2OVx1MzA0Q1x1NzUxRlx1NjIxMFx1MzA1NVx1MzA4Q1x1MzA3RVx1MzA1Qlx1MzA5M1x1MzA2N1x1MzA1N1x1MzA1RjogJHtjb250ZXh0LnBhdGggPz8gXCJcdTRFMERcdTY2MEVcIn1gO1xuICAgICAgY2FzZSBcIkFSVElGQUNUX09QRU5fRkFJTEVEXCI6XG4gICAgICAgIHJldHVybiBgUERGIFx1MzA5Mlx1OTU4Qlx1MzA1MVx1MzA3RVx1MzA1Qlx1MzA5M1x1MzA2N1x1MzA1N1x1MzA1RjogJHtjb250ZXh0LnBhdGggPz8gXCJcdTRFMERcdTY2MEVcIn1gO1xuICAgICAgY2FzZSBcIlBST0NFU1NfRkFJTEVEX1RPX1NUQVJUXCI6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gXCJcdTMwRDdcdTMwRUNcdTMwRDNcdTMwRTVcdTMwRkNcdTVCOUZcdTg4NENcdTMwOTJcdTk1OEJcdTU5Q0JcdTMwNjdcdTMwNERcdTMwN0VcdTMwNUJcdTMwOTNcdTMwNjdcdTMwNTdcdTMwNUZcdTMwMDJcIjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGV4dHJhY3RNZXNzYWdlKGVycm9yOiB1bmtub3duKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIGVycm9yID09PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gZXJyb3IudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgcmV0dXJuIGVycm9yLm1lc3NhZ2UudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxufVxuIiwgImltcG9ydCB7IENoaWxkUHJvY2VzcywgU3Bhd25PcHRpb25zLCBzcGF3biB9IGZyb20gXCJub2RlOmNoaWxkX3Byb2Nlc3NcIjtcblxuaW1wb3J0IHsgUHJvY2Vzc1J1blJlc3VsdCB9IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb2Nlc3NSdW5PcHRpb25zIHtcbiAgY3dkPzogc3RyaW5nO1xuICBlbnY/OiBOb2RlSlMuUHJvY2Vzc0VudjtcbiAgdGltZW91dE1zPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4dGVybmFsQ2xpUnVubmVyIHtcbiAgcnVuV2l0aEFyZ3MoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+O1xuICBydW5Db21tYW5kU3RyaW5nKFxuICAgIGNvbW1hbmRMaW5lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD47XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIgaW1wbGVtZW50cyBFeHRlcm5hbENsaVJ1bm5lciB7XG4gIHB1YmxpYyBhc3luYyBydW5XaXRoQXJncyhcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLnJ1blByb2Nlc3MoY29tbWFuZCwgYXJncywgb3B0aW9ucyk7XG4gIH1cblxuICBwdWJsaWMgcnVuQ29tbWFuZFN0cmluZyhcbiAgICBjb21tYW5kTGluZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG4gICAgcmV0dXJuIHRoaXMucnVuUHJvY2Vzcyhpc1dpbmRvd3MgPyBcImNtZFwiIDogXCJzaFwiLCBbaXNXaW5kb3dzID8gXCIvY1wiIDogXCItY1wiLCBjb21tYW5kTGluZV0sIG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBydW5Qcm9jZXNzKFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCBzZXR0bGVkID0gZmFsc2U7XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NPcHRpb25zOiBTcGF3bk9wdGlvbnMgPSB7XG4gICAgICAgIGN3ZDogb3B0aW9ucy5jd2QsXG4gICAgICAgIGVudjogb3B0aW9ucy5lbnYgPyB7IC4uLnByb2Nlc3MuZW52LCAuLi5vcHRpb25zLmVudiB9IDogcHJvY2Vzcy5lbnYsXG4gICAgICB9O1xuXG4gICAgICBsZXQgY2hpbGQ6IENoaWxkUHJvY2VzcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGNoaWxkID0gc3Bhd24oY29tbWFuZCwgYXJncywge1xuICAgICAgICAgIC4uLnByb2Nlc3NPcHRpb25zLFxuICAgICAgICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJwaXBlXCIsIFwicGlwZVwiXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxldCBzdGRvdXQgPSBcIlwiO1xuICAgICAgbGV0IHN0ZGVyciA9IFwiXCI7XG5cbiAgICAgIGNoaWxkLnN0ZG91dD8uc2V0RW5jb2RpbmcoXCJ1dGY4XCIpO1xuICAgICAgY2hpbGQuc3RkZXJyPy5zZXRFbmNvZGluZyhcInV0ZjhcIik7XG4gICAgICBjaGlsZC5zdGRvdXQ/Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgICAgc3Rkb3V0ICs9IFN0cmluZyhjaHVuayk7XG4gICAgICB9KTtcbiAgICAgIGNoaWxkLnN0ZGVycj8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xuICAgICAgICBzdGRlcnIgKz0gU3RyaW5nKGNodW5rKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB0aW1lb3V0TXMgPSBvcHRpb25zLnRpbWVvdXRNcztcbiAgICAgIGxldCB0aW1lb3V0SWQ6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkO1xuICAgICAgaWYgKHR5cGVvZiB0aW1lb3V0TXMgPT09IFwibnVtYmVyXCIgJiYgdGltZW91dE1zID4gMCkge1xuICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICBpZiAoc2V0dGxlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNldHRsZWQgPSB0cnVlO1xuICAgICAgICAgIHZvaWQgY2hpbGQua2lsbCgpO1xuICAgICAgICAgIHJlc29sdmUoe1xuICAgICAgICAgICAgZXhpdENvZGU6IG51bGwsXG4gICAgICAgICAgICBzdGRvdXQsXG4gICAgICAgICAgICBzdGRlcnI6IGAke3N0ZGVycn1cXG5wcm9jZXNzIHRpbWVvdXQgYWZ0ZXIgJHt0aW1lb3V0TXN9bXNgLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9LCB0aW1lb3V0TXMpO1xuICAgICAgfVxuXG4gICAgICBjaGlsZC5vbihcImVycm9yXCIsIChlcnJvcikgPT4ge1xuICAgICAgICBpZiAoc2V0dGxlZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldHRsZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGltZW91dElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgfVxuICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgfSk7XG5cbiAgICAgIGNoaWxkLm9uKFwiY2xvc2VcIiwgKGNvZGUpID0+IHtcbiAgICAgICAgaWYgKHNldHRsZWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRpbWVvdXRJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXNvbHZlKHtcbiAgICAgICAgICBleGl0Q29kZTogY29kZSxcbiAgICAgICAgICBzdGRvdXQsXG4gICAgICAgICAgc3RkZXJyLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBNb2NrRXh0ZXJuYWxDbGlSdW5uZXIgaW1wbGVtZW50cyBFeHRlcm5hbENsaVJ1bm5lciB7XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGhhbmRsZXI6IChcbiAgICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICAgKSA9PiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+LFxuICApIHt9XG5cbiAgcHVibGljIHJ1bldpdGhBcmdzKFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMuaGFuZGxlcihjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBydW5Db21tYW5kU3RyaW5nKFxuICAgIGNvbW1hbmRMaW5lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIGNvbnN0IGlzV2luZG93cyA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIjtcbiAgICByZXR1cm4gdGhpcy5oYW5kbGVyKGlzV2luZG93cyA/IFwiY21kXCIgOiBcInNoXCIsIFtpc1dpbmRvd3MgPyBcIi9jXCIgOiBcIi1jXCIsIGNvbW1hbmRMaW5lXSwgb3B0aW9ucyk7XG4gIH1cbn1cbiIsICJleHBvcnQgaW50ZXJmYWNlIFByZXZpZXdPdXRwdXRQcmVzZW50ZXJDb250cmFjdCB7XG4gIG9wZW5BcnRpZmFjdChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xuICByZXZlYWxJbkZvbGRlcihwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgY2xhc3MgUHJldmlld091dHB1dFByZXNlbnRlciBpbXBsZW1lbnRzIFByZXZpZXdPdXRwdXRQcmVzZW50ZXJDb250cmFjdCB7XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wZW5JblBhbmU6IChwYXRoOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcGVuUGF0aDogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmcgfCBudWxsPixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJldmVhbFBhdGg6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQsXG4gICkge31cblxuICBwdWJsaWMgYXN5bmMgb3BlbkFydGlmYWN0KHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLm9wZW5JblBhbmUocGF0aCk7XG4gICAgICByZXR1cm47XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCBvcGVuUmVzdWx0ID0gYXdhaXQgdGhpcy5vcGVuUGF0aChwYXRoKTtcbiAgICAgIGlmIChvcGVuUmVzdWx0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihvcGVuUmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcmV2ZWFsSW5Gb2xkZXIocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5yZXZlYWxQYXRoKHBhdGgpO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGV4dG5hbWUsIGlzQWJzb2x1dGUsIGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmltcG9ydCB7XG4gIFByZXZpZXdFeGVjdXRpb25SZXN1bHQsXG4gIFByZXZpZXdUYXJnZXQsXG59IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuaW1wb3J0IHtcbiAgRXh0ZXJuYWxDbGlSdW5uZXIsXG4gIFByb2Nlc3NSdW5PcHRpb25zLFxufSBmcm9tIFwiLi9leHRlcm5hbENsaVJ1bm5lclwiO1xuaW1wb3J0IHsgUHJldmlld091dHB1dFB1Ymxpc2hlciB9IGZyb20gXCIuL3ByZXZpZXdPdXRwdXRQdWJsaXNoZXJcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3RXhlY3V0aW9uU2VydmljZSB7XG4gIGV4ZWN1dGVQcmV2aWV3KHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxQcmV2aWV3RXhlY3V0aW9uUmVzdWx0Pjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRQcmV2aWV3RXhlY3V0aW9uU2VydmljZSBpbXBsZW1lbnRzIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcnVubmVyOiBFeHRlcm5hbENsaVJ1bm5lcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHB1Ymxpc2hlcjogUHJldmlld091dHB1dFB1Ymxpc2hlcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJ1bk9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zID0geyB0aW1lb3V0TXM6IDEwMDAwMCB9LFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWN1dGVQcmV2aWV3KFxuICAgIHRhcmdldDogUHJldmlld1RhcmdldCxcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHJldmlld0V4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IGFydGlmYWN0UGF0aCA9IHRoaXMucHVibGlzaGVyLmNvbXB1dGVPdXRwdXRQYXRoKHRhcmdldCk7XG5cbiAgICBjb25zdCBydW5SZXN1bHQgPSBhd2FpdCB0aGlzLnJ1bm5lci5ydW5XaXRoQXJncyhcbiAgICAgIGNvbW1hbmQsXG4gICAgICBbXCJjb21waWxlXCIsIHRhcmdldC5maWxlUGF0aCwgYXJ0aWZhY3RQYXRoXSxcbiAgICAgIHRoaXMucnVuT3B0aW9ucyxcbiAgICApO1xuXG4gICAgaWYgKHJ1blJlc3VsdC5leGl0Q29kZSAhPT0gMCkge1xuICAgICAgdGhyb3cgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IocnVuUmVzdWx0LnN0ZGVyciB8fCBcInByZXZpZXcgY29tbWFuZCBmYWlsZWRcIiksIHtcbiAgICAgICAgZXhpdENvZGU6IHJ1blJlc3VsdC5leGl0Q29kZSxcbiAgICAgICAgc3Rkb3V0OiBydW5SZXN1bHQuc3Rkb3V0LFxuICAgICAgICBzdGRlcnI6IHJ1blJlc3VsdC5zdGRlcnIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBhcnRpZmFjdFBhdGhGb3JDaGVjayA9IHRoaXMucmVzb2x2ZUFydGlmYWN0UGF0aEZvckNoZWNrKGFydGlmYWN0UGF0aCk7XG4gICAgY29uc3QgZXhpc3RzID0gYXdhaXQgdGhpcy5wdWJsaXNoZXIuZW5zdXJlQXJ0aWZhY3RFeGlzdHMoYXJ0aWZhY3RQYXRoRm9yQ2hlY2spO1xuICAgIGlmICghZXhpc3RzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGFydGlmYWN0IG5vdCBmb3VuZDogJHthcnRpZmFjdFBhdGhGb3JDaGVja31gKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYXJ0aWZhY3RQYXRoLFxuICAgICAgZGV0ZXJtaW5pc3RpY0tleTogYXJ0aWZhY3RQYXRoLFxuICAgICAgY29tbWFuZFJ1bkF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICBwcm9jZXNzUnVuOiBydW5SZXN1bHQsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzb2x2ZUFydGlmYWN0UGF0aEZvckNoZWNrKGFydGlmYWN0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoaXNBYnNvbHV0ZShhcnRpZmFjdFBhdGgpKSB7XG4gICAgICByZXR1cm4gYXJ0aWZhY3RQYXRoO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5ydW5PcHRpb25zLmN3ZCA9PT0gXCJzdHJpbmdcIiAmJiB0aGlzLnJ1bk9wdGlvbnMuY3dkLmxlbmd0aCA+IDApIHtcbiAgICAgIHJldHVybiBqb2luKHRoaXMucnVuT3B0aW9ucy5jd2QsIGFydGlmYWN0UGF0aCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGpvaW4ocHJvY2Vzcy5jd2QoKSwgYXJ0aWZhY3RQYXRoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3R1YlByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIGltcGxlbWVudHMgUHJldmlld0V4ZWN1dGlvblNlcnZpY2Uge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBzaW11bGF0ZTogKHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgcmV0dXJuO1xuICAgIH0sXG4gICkge31cblxuICBwdWJsaWMgYXN5bmMgZXhlY3V0ZVByZXZpZXcodGFyZ2V0OiBQcmV2aWV3VGFyZ2V0LCBjb21tYW5kOiBzdHJpbmcpOiBQcm9taXNlPFByZXZpZXdFeGVjdXRpb25SZXN1bHQ+IHtcbiAgICBhd2FpdCB0aGlzLnNpbXVsYXRlKHRhcmdldCwgY29tbWFuZCk7XG4gICAgY29uc3QgZmlsZU5hbWUgPSBiYXNlbmFtZSh0YXJnZXQuZmlsZVBhdGgpO1xuICAgIGNvbnN0IHN0ZW0gPSBmaWxlTmFtZS5zbGljZSgwLCBmaWxlTmFtZS5sZW5ndGggLSBleHRuYW1lKGZpbGVOYW1lKS5sZW5ndGgpO1xuICAgIGNvbnN0IGFydGlmYWN0UGF0aCA9IGpvaW4oZGlybmFtZSh0YXJnZXQuZmlsZVBhdGgpLCBgJHtzdGVtfS5wZGZgKTtcblxuICAgIHJldHVybiB7XG4gICAgICBhcnRpZmFjdFBhdGgsXG4gICAgICBkZXRlcm1pbmlzdGljS2V5OiB0YXJnZXQuZmlsZVBhdGgsXG4gICAgICBjb21tYW5kUnVuQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHByb2Nlc3NSdW46IHtcbiAgICAgICAgZXhpdENvZGU6IDAsXG4gICAgICAgIHN0ZG91dDogXCJcIixcbiAgICAgICAgc3RkZXJyOiBcIlwiLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG59XG4iLCAiaW1wb3J0IHsgc3RhdCB9IGZyb20gXCJub2RlOmZzL3Byb21pc2VzXCI7XG5pbXBvcnQgeyBkaXJuYW1lLCBleHRuYW1lLCBiYXNlbmFtZSwgam9pbiB9IGZyb20gXCJub2RlOnBhdGhcIjtcblxuaW1wb3J0IHsgUHJldmlld1RhcmdldCB9IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdPdXRwdXRQdWJsaXNoQ29udHJhY3Qge1xuICBjb21wdXRlT3V0cHV0UGF0aCh0YXJnZXQ6IFByZXZpZXdUYXJnZXQpOiBzdHJpbmc7XG4gIGVuc3VyZUFydGlmYWN0RXhpc3RzKHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj47XG59XG5cbmV4cG9ydCBjbGFzcyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyIGltcGxlbWVudHMgUHJldmlld091dHB1dFB1Ymxpc2hDb250cmFjdCB7XG4gIHB1YmxpYyBjb21wdXRlT3V0cHV0UGF0aCh0YXJnZXQ6IFByZXZpZXdUYXJnZXQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHJvb3QgPSBkaXJuYW1lKHRhcmdldC5maWxlUGF0aCk7XG4gICAgY29uc3QgbmFtZSA9IGJhc2VuYW1lKHRhcmdldC5maWxlUGF0aCk7XG4gICAgY29uc3Qgc3RlbSA9IG5hbWUuc2xpY2UoMCwgbmFtZS5sZW5ndGggLSBleHRuYW1lKG5hbWUpLmxlbmd0aCk7XG5cbiAgICByZXR1cm4gam9pbihyb290LCBgJHtzdGVtfS5wZGZgKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBlbnN1cmVBcnRpZmFjdEV4aXN0cyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZW50cnkgPSBhd2FpdCBzdGF0KHBhdGgpO1xuICAgICAgcmV0dXJuIGVudHJ5LmlzRmlsZSgpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TdGF0ZUd1YXJkQ29udHJhY3Qge1xuICB3aXRoTGVhZlByZXNlcnZlZDxUPihhY3Rpb246ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+O1xuICByZXN0b3JlQWN0aXZlTGVhZklmTmVlZGVkKGV4cGVjdGVkTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgUGx1Z2luU3RhdGVHdWFyZCBpbXBsZW1lbnRzIFBsdWdpblN0YXRlR3VhcmRDb250cmFjdCB7XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGN1cnJlbnRMZWFmUHJvdmlkZXI6ICgpID0+IFdvcmtzcGFjZUxlYWYgfCBudWxsLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcmVzdG9yZUxlYWY6IChsZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCkgPT4gdm9pZCxcbiAgKSB7fVxuXG4gIHB1YmxpYyBhc3luYyB3aXRoTGVhZlByZXNlcnZlZDxUPihhY3Rpb246ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCBwcmV2aW91c0xlYWYgPSB0aGlzLmN1cnJlbnRMZWFmUHJvdmlkZXIoKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnJlc3RvcmVBY3RpdmVMZWFmSWZOZWVkZWQocHJldmlvdXNMZWFmKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVzdG9yZUFjdGl2ZUxlYWZJZk5lZWRlZChleHBlY3RlZExlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCB7XG4gICAgdGhpcy5yZXN0b3JlSWZDaGFuZ2VkKGV4cGVjdGVkTGVhZik7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJZkNoYW5nZWQoZXhwZWN0ZWRMZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmIChleHBlY3RlZExlYWYgIT09IHRoaXMuY3VycmVudExlYWZQcm92aWRlcigpKSB7XG4gICAgICB0aGlzLnJlc3RvcmVMZWFmKGV4cGVjdGVkTGVhZik7XG4gICAgfVxuICB9XG59XG4iXSwKICAibWFw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O0FBRUEsWUFBUSxLQUFLLGVBQWUsU0FBUyxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQUEsRUFDdkQ7QUFBQSxFQUVRLGtCQUF3QjtBQUM5QixZQUFRO0FBQUEsTUFDTjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFUSxTQUFTLFlBQW9CLFVBQTBCO0FBQzdELFFBQUksQ0FBQyxZQUFZO0FBQ2YsYUFBTztBQUFBLElBQ1Q7QUFFQSxXQUFPLEdBQUcsVUFBVSxJQUFJLFFBQVE7QUFBQSxFQUNsQztBQUFBLEVBRVEscUJBQTZCO0FBQ25DLFlBQUkseUJBQVEsb0JBQW9CLEdBQUc7QUFDakMsYUFBTztBQUFBLElBQ1Q7QUFFQSxXQUFPO0FBQUEsRUFDVDtBQUFBLEVBRUEsV0FBaUI7QUFDZixlQUFXLFVBQVUsS0FBSyxxQkFBcUIsT0FBTyxHQUFHO0FBQ3ZELGFBQU8sT0FBTztBQUFBLElBQ2hCO0FBQ0EsU0FBSyxxQkFBcUIsTUFBTTtBQUVoQyxZQUFRLEtBQUssNkJBQTZCO0FBQUEsRUFDNUM7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X25vZGVfY2hpbGRfcHJvY2VzcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgImltcG9ydF9ub2RlX3BhdGgiXQp9Cg==
