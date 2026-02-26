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
var NEW_TYP_NAME = "Untitled";
var NEW_TYP_EXT = `.${TYP_EXTENSION}`;
var TYP_FILE_EXTENSIONS = [TYP_EXTENSION, "Typ", "TYP"];
var TypsidianPlugin = class extends import_obsidian.Plugin {
  previousActiveLeaf = null;
  currentActiveLeaf = null;
  async onload() {
    this.currentActiveLeaf = this.app.workspace.getMostRecentLeaf();
    this.app.workspace.onLayoutReady(() => {
      this.registerExtensions(Array.from(TYP_FILE_EXTENSIONS), TYP_VIEW);
      this.registerTypLifecycleObserver();
      this.registerTypContextMenuActions();
      this.registerPreviewCommand();
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
      item.setTitle("New Typst").setIcon("new-file").onClick(async () => {
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
  onunload() {
    console.info("[typsidian] plugin unloaded");
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3ByZXZpZXcvY29udHJhY3RzLnRzIiwgInNyYy9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3Q29udGV4dFJlc29sdmVyLnRzIiwgInNyYy9wcmV2aWV3L3ByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2UudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld0ZhaWx1cmVQb2xpY3kudHMiLCAic3JjL3ByZXZpZXcvZXh0ZXJuYWxDbGlSdW5uZXIudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld091dHB1dFByZXNlbnRlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3RXhlY3V0aW9uU2VydmljZS50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyLnRzIiwgInNyYy9wcmV2aWV3L3BsdWdpblN0YXRlR3VhcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIE1hcmtkb3duVmlldyxcbiAgTWVudSxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFRBYnN0cmFjdEZpbGUsXG4gIFRGaWxlLFxuICBURm9sZGVyLFxuICBXb3Jrc3BhY2VMZWFmLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IENoaWxkUHJvY2Vzcywgc3Bhd24gfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHtcbiAgUFJFVklFV19DT01NQU5EX0lELFxuICBQUkVWSUVXX0NPTU1BTkRfTkFNRSxcbn0gZnJvbSBcIi4vcHJldmlldy9jb250cmFjdHNcIjtcbmltcG9ydCB7IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlclwiO1xuaW1wb3J0IHsgUHJldmlld0NvbnRleHRSZXNvbHZlciB9IGZyb20gXCIuL3ByZXZpZXcvcHJldmlld0NvbnRleHRSZXNvbHZlclwiO1xuaW1wb3J0IHsgUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZSB9IGZyb20gXCIuL3ByZXZpZXcvcHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZVwiO1xuaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVQb2xpY3kgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdGYWlsdXJlUG9saWN5XCI7XG5pbXBvcnQgeyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIgfSBmcm9tIFwiLi9wcmV2aWV3L2V4dGVybmFsQ2xpUnVubmVyXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHJlc2VudGVyXCI7XG5pbXBvcnQgeyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdFeGVjdXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyXCI7XG5pbXBvcnQgeyBQbHVnaW5TdGF0ZUd1YXJkIH0gZnJvbSBcIi4vcHJldmlldy9wbHVnaW5TdGF0ZUd1YXJkXCI7XG5cbmNvbnN0IFRZUF9FWFRFTlNJT04gPSBcInR5cFwiO1xuY29uc3QgVFlQX1ZJRVcgPSBcIm1hcmtkb3duXCI7XG5jb25zdCBORVdfVFlQX05BTUUgPSBcIlVudGl0bGVkXCI7XG5jb25zdCBORVdfVFlQX0VYVCA9IGAuJHtUWVBfRVhURU5TSU9OfWA7XG5jb25zdCBUWVBfRklMRV9FWFRFTlNJT05TID0gW1RZUF9FWFRFTlNJT04sIFwiVHlwXCIsIFwiVFlQXCJdIGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVHlwTGlmZWN5Y2xlRXZlbnRUYXJnZXQge1xuICBwYXRoOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHlwc2lkaWFuUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBwcmV2aW91c0FjdGl2ZUxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdXJyZW50QWN0aXZlTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwgPSBudWxsO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldE1vc3RSZWNlbnRMZWFmKCk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICB0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9ucyhBcnJheS5mcm9tKFRZUF9GSUxFX0VYVEVOU0lPTlMpLCBUWVBfVklFVyk7XG4gICAgICB0aGlzLnJlZ2lzdGVyVHlwTGlmZWN5Y2xlT2JzZXJ2ZXIoKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJUeXBDb250ZXh0TWVudUFjdGlvbnMoKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJQcmV2aWV3Q29tbWFuZCgpO1xuICAgICAgdGhpcy5sb2dTdGFydHVwU3RhdGUoKTtcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCB0aGlzLmhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UpLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHRoaXMuaGFuZGxlRmlsZU9wZW4pLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gbG9hZGVkXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVGaWxlT3BlbiA9IChmaWxlOiBURmlsZSB8IG51bGwpOiB2b2lkID0+IHtcbiAgICBpZiAoIWZpbGUgfHwgIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZUFjY2Vzc2libGUoZmlsZSkpIHtcbiAgICAgIHRoaXMucmVzdG9yZUFjdGl2ZUxlYWYodGhpcy5wcmV2aW91c0FjdGl2ZUxlYWYpO1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgXCIudHlwIFx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA5Mlx1OTU4Qlx1MzA1MVx1MzA3RVx1MzA1Qlx1MzA5M1x1MzA2N1x1MzA1N1x1MzA1Rlx1MzAwMlx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA0Q1x1OTU4Qlx1MzA1MVx1MzA4Qlx1NzJCNlx1NjE0Qlx1MzA0Qlx1NzhCQVx1OEE4RFx1MzA1N1x1MzA2Nlx1MzA0Rlx1MzA2MFx1MzA1NVx1MzA0NFwiLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdGluZ0xlYWYgPSB0aGlzLmdldExlYWZCeVR5cEZpbGUoZmlsZS5wYXRoKTtcblxuICAgIGlmICghZXhpc3RpbmdMZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlTGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgIGlmIChhY3RpdmVMZWFmID09PSBleGlzdGluZ0xlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uuc2V0QWN0aXZlTGVhZihleGlzdGluZ0xlYWYsIHsgZm9jdXM6IHRydWUgfSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVBY3RpdmVMZWFmQ2hhbmdlID0gKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCA9PiB7XG4gICAgaWYgKGxlYWYgPT09IHRoaXMuY3VycmVudEFjdGl2ZUxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnByZXZpb3VzQWN0aXZlTGVhZiA9IHRoaXMuY3VycmVudEFjdGl2ZUxlYWY7XG4gICAgdGhpcy5jdXJyZW50QWN0aXZlTGVhZiA9IGxlYWY7XG4gIH07XG5cbiAgcHJpdmF0ZSByZWdpc3RlclR5cExpZmVjeWNsZU9ic2VydmVyKCk6IHZvaWQge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCB0aGlzLmhhbmRsZVZhdWx0Q3JlYXRlKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIHRoaXMuaGFuZGxlVmF1bHRSZW5hbWUpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJkZWxldGVcIiwgdGhpcy5oYW5kbGVWYXVsdERlbGV0ZSkpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcbiAgICAgICAgdGhpcy5hZGROZXdUeXBDb250ZXh0TWVudUl0ZW0obWVudSwgdGhpcy5nZXRUYXJnZXRGb2xkZXIoZmlsZSkpO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJmaWxlcy1tZW51XCIsXG4gICAgICAgIChtZW51OiBNZW51LCBmaWxlczogVEFic3RyYWN0RmlsZVtdIHwgbnVsbCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSBmaWxlcz8uWzBdO1xuICAgICAgICAgIHRoaXMuYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnUsIHRoaXMuZ2V0VGFyZ2V0Rm9sZGVyKHRhcmdldEZpbGUpKTtcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJQcmV2aWV3Q29tbWFuZCgpOiB2b2lkIHtcbiAgICBjb25zdCBjb21tYW5kQ29udHJvbGxlciA9IHRoaXMuY3JlYXRlUHJldmlld0NvbW1hbmRDb250cm9sbGVyKCk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFBSRVZJRVdfQ09NTUFORF9JRCxcbiAgICAgIG5hbWU6IFBSRVZJRVdfQ09NTUFORF9OQU1FLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzQXZhaWxhYmxlID0gY29tbWFuZENvbnRyb2xsZXIuaXNDb21tYW5kQXZhaWxhYmxlKCk7XG5cbiAgICAgICAgaWYgKGNoZWNraW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGlzQXZhaWxhYmxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0F2YWlsYWJsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZvaWQgY29tbWFuZENvbnRyb2xsZXIucnVuRnJvbUN1cnJlbnRDb250ZXh0KCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHJldmlld0NvbW1hbmRDb250cm9sbGVyKCk6IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIge1xuICAgIGNvbnN0IGdldEFjdGl2ZUxpa2UgPSAoKSA9PiB7XG4gICAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgIGlmICghYWN0aXZlRmlsZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogYWN0aXZlRmlsZS5wYXRoLFxuICAgICAgICBleHRlbnNpb246IGFjdGl2ZUZpbGUuZXh0ZW5zaW9uLFxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgY29uc3QgdmF1bHRCYXNlUGF0aCA9IHRoaXMuZ2V0VmF1bHRCYXNlUGF0aCgpO1xuXG4gICAgY29uc3QgcnVubmVyID0gbmV3IE5vZGVFeHRlcm5hbENsaVJ1bm5lcigpO1xuICAgIGNvbnN0IG91dHB1dFB1Ymxpc2hlciA9IG5ldyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyKCk7XG4gICAgY29uc3QgZXhlY3V0aW9uID0gbmV3IERlZmF1bHRQcmV2aWV3RXhlY3V0aW9uU2VydmljZShcbiAgICAgIHJ1bm5lcixcbiAgICAgIG91dHB1dFB1Ymxpc2hlcixcbiAgICAgIHZhdWx0QmFzZVBhdGggPyB7IGN3ZDogdmF1bHRCYXNlUGF0aCB9IDoge30sXG4gICAgKTtcbiAgICBjb25zdCBwcmVzZW50ZXIgPSBuZXcgUHJldmlld091dHB1dFByZXNlbnRlcihcbiAgICAgIChwYXRoKSA9PiB0aGlzLm9wZW5JblJpZ2h0UGFuZShwYXRoKSxcbiAgICAgIChwYXRoKSA9PiB0aGlzLm9wZW5CeVN5c3RlbSh0aGlzLnJlc29sdmVWYXVsdFBhdGgocGF0aCkpLFxuICAgICAgKHBhdGgpID0+IHtcbiAgICAgICAgdm9pZCB0aGlzLnJldmVhbEluT3ModGhpcy5yZXNvbHZlVmF1bHRQYXRoKHBhdGgpKTtcbiAgICAgIH0sXG4gICAgKTtcbiAgICBjb25zdCBmYWlsdXJlUG9saWN5ID0gbmV3IFByZXZpZXdGYWlsdXJlUG9saWN5KCk7XG4gICAgY29uc3Qgc3RhdGVHdWFyZCA9IG5ldyBQbHVnaW5TdGF0ZUd1YXJkKFxuICAgICAgKCkgPT4gdGhpcy5jdXJyZW50QWN0aXZlTGVhZixcbiAgICAgIChsZWFmKSA9PiB0aGlzLnJlc3RvcmVBY3RpdmVMZWFmKGxlYWYpLFxuICAgICk7XG4gICAgY29uc3QgcnVudGltZSA9IG5ldyBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlKHtcbiAgICAgIHZlcmlmeTogKGNvbW1hbmROYW1lKSA9PlxuICAgICAgICBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRlc3RQcm9jZXNzID0gc3Bhd24oY29tbWFuZE5hbWUsIFtcIi0tdmVyc2lvblwiXSwge1xuICAgICAgICAgICAgc3RkaW86IFtcImlnbm9yZVwiLCBcImlnbm9yZVwiLCBcInBpcGVcIl0sXG4gICAgICAgICAgICBjd2Q6IHZhdWx0QmFzZVBhdGggPz8gdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgdGVzdFByb2Nlc3Mub24oXCJlcnJvclwiLCAoKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKGZhbHNlKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHRlc3RQcm9jZXNzLm9uKFwiY2xvc2VcIiwgKGNvZGUpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoY29kZSA9PT0gMCB8fCBjb2RlID09PSBudWxsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIoe1xuICAgICAgcmVzb2x2ZXI6IG5ldyBQcmV2aWV3Q29udGV4dFJlc29sdmVyKGdldEFjdGl2ZUxpa2UpLFxuICAgICAgcnVudGltZSxcbiAgICAgIGV4ZWN1dGlvbixcbiAgICAgIHByZXNlbnRlcixcbiAgICAgIGZhaWx1cmVQb2xpY3ksXG4gICAgICBzdGF0ZUd1YXJkLFxuICAgICAgb25Ob3RpY2U6IChtZXNzYWdlKSA9PiBuZXcgTm90aWNlKG1lc3NhZ2UpLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvcGVuQnlTeXN0ZW0ocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZyB8IG51bGw+KChyZXNvbHZlKSA9PiB7XG4gICAgICBjb25zdCBjb21tYW5kID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiA/IFwib3BlblwiIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiID8gXCJjbWRcIiA6IFwieGRnLW9wZW5cIjtcbiAgICAgIGNvbnN0IGFyZ3MgPVxuICAgICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCJcbiAgICAgICAgICA/IFtcIi9jXCIsIFwic3RhcnRcIiwgcGF0aF1cbiAgICAgICAgICA6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCJcbiAgICAgICAgICAgID8gW3BhdGhdXG4gICAgICAgICAgICA6IFtwYXRoXTtcblxuICAgICAgbGV0IGNoaWxkOiBDaGlsZFByb2Nlc3M7XG4gICAgICB0cnkge1xuICAgICAgICBjaGlsZCA9IHNwYXduKGNvbW1hbmQsIGFyZ3MsIHtcbiAgICAgICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwiaWdub3JlXCIsIFwicGlwZVwiXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXNvbHZlKGBvcGVuIGNvbW1hbmQgZmFpbGVkOiAke1N0cmluZyhlcnJvcil9YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGV0IHN0ZGVyciA9IFwiXCI7XG4gICAgICBjaGlsZC5zdGRlcnI/Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgICAgc3RkZXJyICs9IFN0cmluZyhjaHVuayk7XG4gICAgICB9KTtcblxuICAgICAgY2hpbGQub24oXCJlcnJvclwiLCAoZXJyb3IpID0+IHtcbiAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZDogJHtTdHJpbmcoZXJyb3IpfWApO1xuICAgICAgfSk7XG5cbiAgICAgIGNoaWxkLm9uKFwiY2xvc2VcIiwgKGNvZGUpID0+IHtcbiAgICAgICAgaWYgKGNvZGUgPT09IDAgfHwgY29kZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJlc29sdmUobnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0ZGVyci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZDogJHtzdGRlcnJ9YCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZCB3aXRoIGV4aXQgY29kZSAke1N0cmluZyhjb2RlKX1gKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBvcGVuSW5SaWdodFBhbmUocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuICAgIGlmICghKHRhcmdldCBpbnN0YW5jZW9mIFRGaWxlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhcnRpZmFjdCBpcyBub3QgYSB2YXVsdCBmaWxlOiAke3BhdGh9YCk7XG4gICAgfVxuXG4gICAgY29uc3QgcmlnaHRMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoXCJzcGxpdFwiLCBcInZlcnRpY2FsXCIpO1xuICAgIGF3YWl0IHJpZ2h0TGVhZi5vcGVuRmlsZSh0YXJnZXQsIHsgYWN0aXZlOiBmYWxzZSB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmV2ZWFsSW5PcyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb21tYW5kID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiA/IFwib3BlblwiIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiID8gXCJjbWRcIiA6IFwieGRnLW9wZW5cIjtcbiAgICBjb25zdCBhcmdzID1cbiAgICAgIHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIlxuICAgICAgICA/IFtcIi9jXCIsIFwic3RhcnRcIiwgcGF0aF1cbiAgICAgICAgOiBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiXG4gICAgICAgICAgPyBbXCItUlwiLCBwYXRoXVxuICAgICAgICAgIDogW3BhdGhdO1xuXG4gICAgYXdhaXQgdGhpcy5vcGVuQnlTeXN0ZW1XaXRoQXJncyhjb21tYW5kLCBhcmdzKTtcbiAgfVxuXG4gIHByaXZhdGUgb3BlbkJ5U3lzdGVtV2l0aEFyZ3MoY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgbGV0IGNoaWxkOiBDaGlsZFByb2Nlc3M7XG4gICAgICB0cnkge1xuICAgICAgICBjaGlsZCA9IHNwYXduKGNvbW1hbmQsIGFyZ3MsIHtcbiAgICAgICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwiaWdub3JlXCIsIFwiaWdub3JlXCJdLFxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY2hpbGQub24oXCJjbG9zZVwiLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgICAgY2hpbGQub24oXCJlcnJvclwiLCAoKSA9PiByZXNvbHZlKCkpO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNvbHZlVmF1bHRQYXRoKHJlbGF0aXZlUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCB2YXVsdEJhc2VQYXRoID0gdGhpcy5nZXRWYXVsdEJhc2VQYXRoKCk7XG4gICAgaWYgKCF2YXVsdEJhc2VQYXRoKSB7XG4gICAgICByZXR1cm4gcmVsYXRpdmVQYXRoO1xuICAgIH1cblxuICAgIHJldHVybiBqb2luKHZhdWx0QmFzZVBhdGgsIHJlbGF0aXZlUGF0aCk7XG4gIH1cblxuICBwcml2YXRlIGdldFZhdWx0QmFzZVBhdGgoKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgYWRhcHRlciA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXI7XG4gICAgY29uc3QgbWF5YmVHZXRCYXNlUGF0aCA9XG4gICAgICBcImdldEJhc2VQYXRoXCIgaW4gYWRhcHRlciAmJiB0eXBlb2YgYWRhcHRlci5nZXRCYXNlUGF0aCA9PT0gXCJmdW5jdGlvblwiXG4gICAgICAgID8gYWRhcHRlci5nZXRCYXNlUGF0aFxuICAgICAgICA6IG51bGw7XG5cbiAgICBpZiAoIW1heWJlR2V0QmFzZVBhdGgpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBtYXliZUdldEJhc2VQYXRoLmNhbGwoYWRhcHRlcik7XG4gIH1cblxuICBwcml2YXRlIGFkZE5ld1R5cENvbnRleHRNZW51SXRlbShtZW51OiBNZW51LCB0YXJnZXQ6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcbiAgICAgIGl0ZW1cbiAgICAgICAgLnNldFRpdGxlKFwiTmV3IFR5cHN0XCIpXG4gICAgICAgIC5zZXRJY29uKFwibmV3LWZpbGVcIilcbiAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gYXdhaXQgdGhpcy5yZXNvbHZlVW5pcXVlVHlwRmlsZU5hbWUodGFyZ2V0KTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0aGlzLmpvaW5QYXRoKHRhcmdldC5wYXRoLCBuYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUodGFyZ2V0UGF0aCwgXCJcIik7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKGZhbHNlKS5vcGVuRmlsZShjcmVhdGVkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlt0eXBzaWRpYW5dIGZhaWxlZCB0byBjcmVhdGUgdHlwIGZpbGVcIiwgZXJyb3IpO1xuICAgICAgICAgICAgbmV3IE5vdGljZShcIi50eXAgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDZFXHU0RjVDXHU2MjEwXHUzMDZCXHU1OTMxXHU2NTU3XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlc29sdmVVbmlxdWVUeXBGaWxlTmFtZShmb2xkZXI6IFRGb2xkZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGluaXRpYWxOYW1lID0gYCR7TkVXX1RZUF9OQU1FfSR7TkVXX1RZUF9FWFR9YDtcbiAgICBpZiAoXG4gICAgICAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKFxuICAgICAgICB0aGlzLmpvaW5QYXRoKGZvbGRlci5wYXRoLCBpbml0aWFsTmFtZSksXG4gICAgICApXG4gICAgKSB7XG4gICAgICByZXR1cm4gaW5pdGlhbE5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvdW50ZXIgPSAxO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBuYW1lID0gYCR7TkVXX1RZUF9OQU1FfSAke2NvdW50ZXJ9JHtORVdfVFlQX0VYVH1gO1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRoaXMuam9pblBhdGgoZm9sZGVyLnBhdGgsIG5hbWUpKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiBuYW1lO1xuICAgICAgfVxuICAgICAgY291bnRlciArPSAxO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0VGFyZ2V0Rm9sZGVyKGZpbGU/OiBUQWJzdHJhY3RGaWxlKTogVEZvbGRlciB7XG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICByZXR1cm4gZmlsZS5wYXJlbnQgPz8gdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG4gIH1cblxuICBwcml2YXRlIGlzVHlwRmlsZShmaWxlOiBUQWJzdHJhY3RGaWxlKTogZmlsZSBpcyBURmlsZSB7XG4gICAgcmV0dXJuIGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpID09PSBUWVBfRVhURU5TSU9OO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRMZWFmQnlUeXBGaWxlKHBhdGg6IHN0cmluZyk6IFdvcmtzcGFjZUxlYWYgfCBudWxsIHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlXG4gICAgICAgIC5nZXRMZWF2ZXNPZlR5cGUoVFlQX1ZJRVcpXG4gICAgICAgIC5maW5kKChsZWFmKSA9PlxuICAgICAgICAgIGxlYWYudmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldyAmJiBsZWFmLnZpZXcuZmlsZT8ucGF0aCA9PT0gcGF0aFxuICAgICAgICApIHx8XG4gICAgICBudWxsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlVmF1bHRDcmVhdGUgPSAoZmlsZTogVEFic3RyYWN0RmlsZSk6IHZvaWQgPT4ge1xuICAgIGlmICghdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0xpZmVjeWNsZShcImNyZWF0ZVwiLCBmaWxlKTtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZVZhdWx0UmVuYW1lID0gKGZpbGU6IFRBYnN0cmFjdEZpbGUsIG9sZFBhdGg6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgIGlmICghdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0xpZmVjeWNsZShcInJlbmFtZVwiLCBmaWxlLCBvbGRQYXRoKTtcbiAgfTtcblxuICBwcml2YXRlIGhhbmRsZVZhdWx0RGVsZXRlID0gKGZpbGU6IFRBYnN0cmFjdEZpbGUpOiB2b2lkID0+IHtcbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sb2dMaWZlY3ljbGUoXCJkZWxldGVcIiwgZmlsZSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBpc1R5cEZpbGVBY2Nlc3NpYmxlKGZpbGU6IFRGaWxlKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlLnBhdGgpIGluc3RhbmNlb2YgVEZpbGU7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVBY3RpdmVMZWFmKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCB7XG4gICAgaWYgKCFsZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlTGVhZiA9IHRoaXMuY3VycmVudEFjdGl2ZUxlYWY7XG4gICAgaWYgKGFjdGl2ZUxlYWYgPT09IGxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uuc2V0QWN0aXZlTGVhZihsZWFmLCB7IGZvY3VzOiB0cnVlIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2dMaWZlY3ljbGUoXG4gICAgZXZlbnROYW1lOiBcImNyZWF0ZVwiIHwgXCJyZW5hbWVcIiB8IFwiZGVsZXRlXCIsXG4gICAgZmlsZTogVHlwTGlmZWN5Y2xlRXZlbnRUYXJnZXQsXG4gICAgb2xkUGF0aD86IHN0cmluZyxcbiAgKTogdm9pZCB7XG4gICAgaWYgKG9sZFBhdGgpIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhgW3R5cHNpZGlhbl0gJHtldmVudE5hbWV9OiAke29sZFBhdGh9IC0+ICR7ZmlsZS5wYXRofWApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnNvbGUuaW5mbyhgW3R5cHNpZGlhbl0gJHtldmVudE5hbWV9OiAke2ZpbGUucGF0aH1gKTtcbiAgfVxuXG4gIHByaXZhdGUgbG9nU3RhcnR1cFN0YXRlKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgIFwiW3R5cHNpZGlhbl0gc3RhcnR1cCBvYnNlcnZlcnMgYW5kIGNvbnRleHQgbWVudSBhY3Rpb25zIHJlZ2lzdGVyZWRcIixcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBqb2luUGF0aChmb2xkZXJQYXRoOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICghZm9sZGVyUGF0aCkge1xuICAgICAgcmV0dXJuIGZpbGVOYW1lO1xuICAgIH1cblxuICAgIHJldHVybiBgJHtmb2xkZXJQYXRofS8ke2ZpbGVOYW1lfWA7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gdW5sb2FkZWRcIik7XG4gIH1cbn1cbiIsICJleHBvcnQgY29uc3QgVFlQX0ZJTEVfRVhURU5TSU9OID0gXCJ0eXBcIjtcbmV4cG9ydCBjb25zdCBQUkVWSUVXX0NPTU1BTkRfTkFNRSA9IFwiUHJldmlldyBUeXBzdFwiO1xuZXhwb3J0IGNvbnN0IFBSRVZJRVdfQ09NTUFORF9JRCA9IFwicHJldmlldy10eXBzdFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdGaWxlTGlrZSB7XG4gIHJlYWRvbmx5IHBhdGg6IHN0cmluZztcbiAgcmVhZG9ubHkgZXh0ZW5zaW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdUYXJnZXQgPSB7XG4gIGZpbGVQYXRoOiBzdHJpbmc7XG4gIGRpc3BsYXlOYW1lOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBQcmV2aWV3UmVzb2x2ZUVycm9yID0gXCJOT19BQ1RJVkVfVEFSR0VUXCI7XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdSZXNvbHZlUmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyB0YXJnZXQ6IFByZXZpZXdUYXJnZXQgfVxuICB8IHsgb2s6IGZhbHNlOyByZWFzb246IFByZXZpZXdSZXNvbHZlRXJyb3IgfTtcblxuZXhwb3J0IHR5cGUgUnVudGltZUNvbW1hbmQgPSBzdHJpbmc7XG5cbmV4cG9ydCB0eXBlIFJ1bnRpbWVDaGVja1Jlc3VsdCA9XG4gIHwge1xuICAgICAgb2s6IHRydWU7XG4gICAgICByZXNvbHZlZENvbW1hbmQ6IFJ1bnRpbWVDb21tYW5kO1xuICAgIH1cbiAgfCB7XG4gICAgICBvazogZmFsc2U7XG4gICAgICByZWFzb246IFwiTUlTU0lOR19SVU5USU1FXCIgfCBcIklOVkFMSURfUEFUSFwiO1xuICAgIH07XG5cbmV4cG9ydCB0eXBlIFByb2Nlc3NSdW5SZXN1bHQgPSB7XG4gIGV4aXRDb2RlOiBudW1iZXIgfCBudWxsO1xuICBzdGRvdXQ6IHN0cmluZztcbiAgc3RkZXJyOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgdHlwZSBQcmV2aWV3RXhlY3V0aW9uUmVzdWx0ID0ge1xuICBhcnRpZmFjdFBhdGg6IHN0cmluZztcbiAgY29tbWFuZFJ1bkF0OiBzdHJpbmc7XG4gIGRldGVybWluaXN0aWNLZXk6IHN0cmluZztcbiAgcHJvY2Vzc1J1bjogUHJvY2Vzc1J1blJlc3VsdDtcbn07XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnkgPVxuICB8IFwiREVQRU5ERU5DWV9NSVNTSU5HXCJcbiAgfCBcIlBST0NFU1NfRkFJTEVEX1RPX1NUQVJUXCJcbiAgfCBcIlBST0NFU1NfVElNRU9VVFwiXG4gIHwgXCJQUk9DRVNTX0VYSVRfRVJST1JcIlxuICB8IFwiQVJUSUZBQ1RfTk9UX0ZPVU5EXCJcbiAgfCBcIkFSVElGQUNUX09QRU5fRkFJTEVEXCI7XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdGbG93UmVzdWx0ID1cbiAgfCB7XG4gICAgICBvazogdHJ1ZTtcbiAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICAgIGFydGlmYWN0UGF0aDogc3RyaW5nO1xuICAgIH1cbiAgfCB7XG4gICAgICBvazogZmFsc2U7XG4gICAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgfTtcbiIsICJpbXBvcnQge1xuICBQcmV2aWV3Rmxvd1Jlc3VsdCxcbiAgUHJldmlld0ZhaWx1cmVDYXRlZ29yeSxcbiAgUnVudGltZUNoZWNrUmVzdWx0LFxufSBmcm9tIFwiLi9jb250cmFjdHNcIjtcbmltcG9ydCB7IFByZXZpZXdDb250ZXh0UmVzb2x2ZXIgfSBmcm9tIFwiLi9wcmV2aWV3Q29udGV4dFJlc29sdmVyXCI7XG5pbXBvcnQgeyBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlIH0gZnJvbSBcIi4vcHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZVwiO1xuaW1wb3J0IHsgUHJldmlld091dHB1dFByZXNlbnRlciB9IGZyb20gXCIuL3ByZXZpZXdPdXRwdXRQcmVzZW50ZXJcIjtcbmltcG9ydCB7IFByZXZpZXdGYWlsdXJlUG9saWN5IH0gZnJvbSBcIi4vcHJldmlld0ZhaWx1cmVQb2xpY3lcIjtcbmltcG9ydCB7XG4gIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlLFxufSBmcm9tIFwiLi9wcmV2aWV3RXhlY3V0aW9uU2VydmljZVwiO1xuaW1wb3J0IHsgUGx1Z2luU3RhdGVHdWFyZCB9IGZyb20gXCIuL3BsdWdpblN0YXRlR3VhcmRcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIge1xuICBpc0NvbW1hbmRBdmFpbGFibGUoKTogYm9vbGVhbjtcbiAgcnVuRnJvbUN1cnJlbnRDb250ZXh0KCk6IFByb21pc2U8UHJldmlld0Zsb3dSZXN1bHQ+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdDb21tYW5kQ29udHJvbGxlckRlcHMge1xuICByZXNvbHZlcjogUHJldmlld0NvbnRleHRSZXNvbHZlcjtcbiAgcnVudGltZTogUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZTtcbiAgZXhlY3V0aW9uOiBQcmV2aWV3RXhlY3V0aW9uU2VydmljZTtcbiAgcHJlc2VudGVyOiBQcmV2aWV3T3V0cHV0UHJlc2VudGVyO1xuICBmYWlsdXJlUG9saWN5OiBQcmV2aWV3RmFpbHVyZVBvbGljeTtcbiAgc3RhdGVHdWFyZDogUGx1Z2luU3RhdGVHdWFyZDtcbiAgb25Ob3RpY2U6IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0UHJldmlld0NvbW1hbmRDb250cm9sbGVyXG4gIGltcGxlbWVudHMgUHJldmlld0NvbW1hbmRDb250cm9sbGVyXG57XG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGRlcHM6IFByZXZpZXdDb21tYW5kQ29udHJvbGxlckRlcHMpIHt9XG5cbiAgcHVibGljIGlzQ29tbWFuZEF2YWlsYWJsZSgpOiBib29sZWFuIHtcbiAgICBjb25zdCB0YXJnZXRSZXN1bHQgPSB0aGlzLmRlcHMucmVzb2x2ZXIucmVzb2x2ZVRhcmdldEZvckNvbW1hbmQoKTtcbiAgICByZXR1cm4gdGFyZ2V0UmVzdWx0Lm9rO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHJ1bkZyb21DdXJyZW50Q29udGV4dCgpOiBQcm9taXNlPFByZXZpZXdGbG93UmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMuZGVwcy5zdGF0ZUd1YXJkLndpdGhMZWFmUHJlc2VydmVkKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHRhcmdldFJlc3VsdCA9IHRoaXMuZGVwcy5yZXNvbHZlci5yZXNvbHZlVGFyZ2V0Rm9yQ29tbWFuZCgpO1xuICAgICAgaWYgKCF0YXJnZXRSZXN1bHQub2spIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IFwiVHlwc3QgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDRDXHU5MDc4XHU2MjlFXHUzMDU1XHUzMDhDXHUzMDY2XHUzMDQ0XHUzMDdFXHUzMDVCXHUzMDkzXHUzMDAyXHU3M0ZFXHU1NzI4XHUzMDZFXHU3REU4XHU5NkM2XHU1QkZFXHU4QzYxXHUzMDkyXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XHUzMDAyXCI7XG4gICAgICAgIHRoaXMuZGVwcy5vbk5vdGljZShtZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgbWVzc2FnZSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcnVudGltZVJlc3VsdDogUnVudGltZUNoZWNrUmVzdWx0ID1cbiAgICAgICAgYXdhaXQgdGhpcy5kZXBzLnJ1bnRpbWUuZW5zdXJlUnVudGltZUF2YWlsYWJsZShcInR5cHN0XCIpO1xuICAgICAgaWYgKCFydW50aW1lUmVzdWx0Lm9rKSB7XG4gICAgICAgIGNvbnN0IHJ1bnRpbWVDYXRlZ29yeSA9XG4gICAgICAgICAgcnVudGltZVJlc3VsdC5yZWFzb24gPT09IFwiTUlTU0lOR19SVU5USU1FXCJcbiAgICAgICAgICAgID8gXCJERVBFTkRFTkNZX01JU1NJTkdcIlxuICAgICAgICAgICAgOiBcIlBST0NFU1NfRkFJTEVEX1RPX1NUQVJUXCI7XG4gICAgICAgIHJldHVybiB0aGlzLnByZXNlbnRGYWlsdXJlKHJ1bnRpbWVDYXRlZ29yeSwgXCJUeXBzdCBDTEkgXHUzMDRDXHU4OThCXHUzMDY0XHUzMDRCXHUzMDhBXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDAyXCIsIHtcbiAgICAgICAgICBjb21tYW5kOiBcInR5cHN0XCIsXG4gICAgICAgICAgcmVhc29uOiBydW50aW1lUmVzdWx0LnJlYXNvbixcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGV4ZWN1dGlvblJlc3VsdCA9IGF3YWl0IHRoaXMuZGVwcy5leGVjdXRpb24uZXhlY3V0ZVByZXZpZXcoXG4gICAgICAgICAgdGFyZ2V0UmVzdWx0LnRhcmdldCxcbiAgICAgICAgICBydW50aW1lUmVzdWx0LnJlc29sdmVkQ29tbWFuZCxcbiAgICAgICAgKTtcbiAgICAgICAgYXdhaXQgdGhpcy5kZXBzLnByZXNlbnRlci5vcGVuQXJ0aWZhY3QoZXhlY3V0aW9uUmVzdWx0LmFydGlmYWN0UGF0aCk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgICBtZXNzYWdlOiBcIlByZXZpZXcgVHlwc3QgXHUzMDkyXHU5NThCXHUzMDREXHUzMDdFXHUzMDU3XHUzMDVGXHUzMDAyXCIsXG4gICAgICAgICAgYXJ0aWZhY3RQYXRoOiBleGVjdXRpb25SZXN1bHQuYXJ0aWZhY3RQYXRoLFxuICAgICAgICB9O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgZmFsbGJhY2tNZXNzYWdlID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcInVua25vd25cIjtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSB0aGlzLmRlcHMuZmFpbHVyZVBvbGljeS5jbGFzc2lmeShlcnJvciwgZmFsbGJhY2tNZXNzYWdlKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5wcmVzZW50RmFpbHVyZShjYXRlZ29yeSwgZmFsbGJhY2tNZXNzYWdlLCB7XG4gICAgICAgICAgY29tbWFuZDogcnVudGltZVJlc3VsdC5yZXNvbHZlZENvbW1hbmQsXG4gICAgICAgICAgcGF0aDogdGFyZ2V0UmVzdWx0LnRhcmdldC5maWxlUGF0aCxcbiAgICAgICAgICByZWFzb246IGZhbGxiYWNrTWVzc2FnZSxcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmVzZW50RmFpbHVyZShcbiAgICBjYXRlZ29yeTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeSxcbiAgICBmYWxsYmFja01lc3NhZ2U6IHN0cmluZyxcbiAgICBjb250ZXh0OiB7XG4gICAgICBjb21tYW5kPzogc3RyaW5nO1xuICAgICAgcGF0aD86IHN0cmluZztcbiAgICAgIHJlYXNvbj86IHN0cmluZztcbiAgICB9LFxuICAgIGVycm9yPzogdW5rbm93bixcbiAgKTogUHJldmlld0Zsb3dSZXN1bHQge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLmRlcHMuZmFpbHVyZVBvbGljeS5nZXROb3RpY2VNZXNzYWdlKGNhdGVnb3J5LCBjb250ZXh0KTtcbiAgICBjb25zdCBsb2dDb250ZXh0ID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgY2F0ZWdvcnksXG4gICAgICBtZXNzYWdlOiBmYWxsYmFja01lc3NhZ2UsXG4gICAgICByZWFzb246IGNvbnRleHQucmVhc29uLFxuICAgIH0pO1xuXG4gICAgY29uc29sZS53YXJuKFwiW3R5cHNpZGlhbl0gcHJldmlldyBmYWlsZWRcIiwgbG9nQ29udGV4dCk7XG4gICAgdGhpcy5kZXBzLm9uTm90aWNlKG1lc3NhZ2UpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiBmYWxzZSxcbiAgICAgIG1lc3NhZ2UsXG4gICAgfTtcbiAgfVxufVxuIiwgImltcG9ydCB7XG4gIFByZXZpZXdGaWxlTGlrZSxcbiAgUHJldmlld1Jlc29sdmVFcnJvcixcbiAgUHJldmlld1Jlc29sdmVSZXN1bHQsXG4gIFRZUF9GSUxFX0VYVEVOU0lPTixcbn0gZnJvbSBcIi4vY29udHJhY3RzXCI7XG5cbnR5cGUgQWN0aXZlRmlsZVByb3ZpZGVyID0gKCkgPT4gUHJldmlld0ZpbGVMaWtlIHwgbnVsbDtcblxuZXhwb3J0IGNsYXNzIFByZXZpZXdDb250ZXh0UmVzb2x2ZXIge1xuICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBnZXRBY3RpdmVGaWxlOiBBY3RpdmVGaWxlUHJvdmlkZXIpIHt9XG5cbiAgcHVibGljIHJlc29sdmVUYXJnZXRGb3JDb21tYW5kKCk6IFByZXZpZXdSZXNvbHZlUmVzdWx0IHtcbiAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5nZXRBY3RpdmVGaWxlKCk7XG5cbiAgICBpZiAoIWFjdGl2ZUZpbGUgfHwgIXRoaXMuaXNUeXBGaWxlKGFjdGl2ZUZpbGUpKSB7XG4gICAgICByZXR1cm4gdGhpcy5mYWlsKFwiTk9fQUNUSVZFX1RBUkdFVFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlTmFtZSA9IHRoaXMuZ2V0RmlsZU5hbWUoYWN0aXZlRmlsZS5wYXRoKTtcblxuICAgIHJldHVybiB7XG4gICAgICBvazogdHJ1ZSxcbiAgICAgIHRhcmdldDoge1xuICAgICAgICBmaWxlUGF0aDogYWN0aXZlRmlsZS5wYXRoLFxuICAgICAgICBkaXNwbGF5TmFtZTogZmlsZU5hbWUsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGlzVHlwRmlsZShmaWxlOiBQcmV2aWV3RmlsZUxpa2UpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmlsZS5leHRlbnNpb24udG9Mb3dlckNhc2UoKSA9PT0gVFlQX0ZJTEVfRVhURU5TSU9OO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRGaWxlTmFtZShwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGluZGV4ID0gcGF0aC5sYXN0SW5kZXhPZihcIi9cIik7XG4gICAgaWYgKGluZGV4ID09PSAtMSkge1xuICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhdGguc2xpY2UoaW5kZXggKyAxKTtcbiAgfVxuXG4gIHByaXZhdGUgZmFpbChyZWFzb246IFByZXZpZXdSZXNvbHZlRXJyb3IpOiB7IG9rOiBmYWxzZTsgcmVhc29uOiBQcmV2aWV3UmVzb2x2ZUVycm9yIH0ge1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uIH07XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBSdW50aW1lQ2hlY2tSZXN1bHQgfSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBSdW50aW1lVmVyaWZpZXIge1xuICB2ZXJpZnkoY29tbWFuZE5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj47XG59XG5cbmV4cG9ydCBjbGFzcyBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgdmVyaWZpZXI6IFJ1bnRpbWVWZXJpZmllcikge31cblxuICBwdWJsaWMgYXN5bmMgZW5zdXJlUnVudGltZUF2YWlsYWJsZShjb21tYW5kTmFtZTogc3RyaW5nKTogUHJvbWlzZTxSdW50aW1lQ2hlY2tSZXN1bHQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYXZhaWxhYmxlID0gYXdhaXQgdGhpcy52ZXJpZmllci52ZXJpZnkoY29tbWFuZE5hbWUpO1xuICAgICAgaWYgKCFhdmFpbGFibGUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgcmVhc29uOiBcIk1JU1NJTkdfUlVOVElNRVwiLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBvazogdHJ1ZSxcbiAgICAgICAgcmVzb2x2ZWRDb21tYW5kOiBjb21tYW5kTmFtZSxcbiAgICAgIH07XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgcmVhc29uOiB0aGlzLmNsYXNzaWZ5RXJyb3IoZXJyb3IpLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgcmVzZXRSdW50aW1lQ2FjaGUoKTogdm9pZCB7XG4gIH1cblxuICBwcml2YXRlIGNsYXNzaWZ5RXJyb3IoZXJyb3I6IHVua25vd24pOiBcIk1JU1NJTkdfUlVOVElNRVwiIHwgXCJJTlZBTElEX1BBVEhcIiB7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiICYmXG4gICAgICBlcnJvciAhPT0gbnVsbCAmJlxuICAgICAgXCJjb2RlXCIgaW4gZXJyb3IgJiZcbiAgICAgIGVycm9yLmNvZGUgPT09IFwiRU5PRU5UXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBcIk1JU1NJTkdfUlVOVElNRVwiO1xuICAgIH1cblxuICAgIHJldHVybiBcIklOVkFMSURfUEFUSFwiO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVDYXRlZ29yeSB9IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZhaWx1cmVDYXRlZ29yeUNvbnRleHQge1xuICBjb21tYW5kPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xuICByZWFzb24/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld0ZhaWx1cmVQb2xpY3lDb250cmFjdCB7XG4gIGNsYXNzaWZ5KGVycm9yOiB1bmtub3duLCBmYWxsYmFja01lc3NhZ2U6IHN0cmluZyk6IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnk7XG4gIGdldE5vdGljZU1lc3NhZ2UoY2F0ZWdvcnk6IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnksIGNvbnRleHQ6IEZhaWx1cmVDYXRlZ29yeUNvbnRleHQpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBQcmV2aWV3RmFpbHVyZVBvbGljeSBpbXBsZW1lbnRzIFByZXZpZXdGYWlsdXJlUG9saWN5Q29udHJhY3Qge1xuICBwdWJsaWMgY2xhc3NpZnkoZXJyb3I6IHVua25vd24sIGZhbGxiYWNrTWVzc2FnZTogc3RyaW5nKTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZXh0cmFjdE1lc3NhZ2UoZXJyb3IpO1xuXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiICYmXG4gICAgICBlcnJvciAhPT0gbnVsbCAmJlxuICAgICAgXCJjb2RlXCIgaW4gZXJyb3IgJiZcbiAgICAgIGVycm9yLmNvZGUgPT09IFwiRU5PRU5UXCJcbiAgICApIHtcbiAgICAgIHJldHVybiBcIkRFUEVOREVOQ1lfTUlTU0lOR1wiO1xuICAgIH1cblxuICAgIGlmIChtZXNzYWdlLmluY2x1ZGVzKFwidGltZW91dFwiKSkge1xuICAgICAgcmV0dXJuIFwiUFJPQ0VTU19USU1FT1VUXCI7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiICYmXG4gICAgICBlcnJvciAhPT0gbnVsbCAmJlxuICAgICAgXCJleGl0Q29kZVwiIGluIGVycm9yICYmXG4gICAgICAoZXJyb3IgYXMgeyBleGl0Q29kZTogbnVtYmVyIHwgbnVsbCB9KS5leGl0Q29kZSAhPT0gMFxuICAgICkge1xuICAgICAgcmV0dXJuIFwiUFJPQ0VTU19FWElUX0VSUk9SXCI7XG4gICAgfVxuXG4gICAgaWYgKGZhbGxiYWNrTWVzc2FnZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKFwidGltZW91dFwiKSkge1xuICAgICAgcmV0dXJuIFwiUFJPQ0VTU19USU1FT1VUXCI7XG4gICAgfVxuXG4gICAgaWYgKGZhbGxiYWNrTWVzc2FnZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKFwiYXJ0aWZhY3RcIikpIHtcbiAgICAgIHJldHVybiBcIkFSVElGQUNUX05PVF9GT1VORFwiO1xuICAgIH1cblxuICAgIGlmIChmYWxsYmFja01lc3NhZ2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhcIm9wZW5cIikpIHtcbiAgICAgIHJldHVybiBcIkFSVElGQUNUX09QRU5fRkFJTEVEXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiUFJPQ0VTU19GQUlMRURfVE9fU1RBUlRcIjtcbiAgfVxuXG4gIHB1YmxpYyBnZXROb3RpY2VNZXNzYWdlKFxuICAgIGNhdGVnb3J5OiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5LFxuICAgIGNvbnRleHQ6IEZhaWx1cmVDYXRlZ29yeUNvbnRleHQsXG4gICk6IHN0cmluZyB7XG4gICAgc3dpdGNoIChjYXRlZ29yeSkge1xuICAgICAgY2FzZSBcIkRFUEVOREVOQ1lfTUlTU0lOR1wiOlxuICAgICAgICByZXR1cm4gXCJUeXBzdCBDTEkgXHUzMDRDXHU4OThCXHUzMDY0XHUzMDRCXHUzMDhBXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDAyYHR5cHN0YCBcdTMwNEMgUEFUSCBcdTMwNEJcdTMwODlcdTVCOUZcdTg4NENcdTMwNjdcdTMwNERcdTMwOEJcdTMwNEJcdTc4QkFcdThBOERcdTMwNTdcdTMwNjZcdTMwNEZcdTMwNjBcdTMwNTVcdTMwNDRcdTMwMDJcIjtcbiAgICAgIGNhc2UgXCJQUk9DRVNTX1RJTUVPVVRcIjpcbiAgICAgICAgcmV0dXJuIFwiVHlwc3QgQ0xJIFx1MzA2RVx1NUI5Rlx1ODg0Q1x1MzA0Q1x1MzBCRlx1MzBBNFx1MzBFMFx1MzBBMlx1MzBBNlx1MzBDOFx1MzA1N1x1MzA3RVx1MzA1N1x1MzA1Rlx1MzAwMlx1NTE2NVx1NTI5Qlx1NTE4NVx1NUJCOVx1MzA5Mlx1NzhCQVx1OEE4RFx1MzA1N1x1MzA2Nlx1NTE4RFx1NUI5Rlx1ODg0Q1x1MzA1N1x1MzA2Nlx1MzA0Rlx1MzA2MFx1MzA1NVx1MzA0NFx1MzAwMlwiO1xuICAgICAgY2FzZSBcIlBST0NFU1NfRVhJVF9FUlJPUlwiOlxuICAgICAgICByZXR1cm4gYFR5cHN0IENMSSBcdTMwNEMgJHtjb250ZXh0LmNvbW1hbmQgPz8gXCJcdTMwQjNcdTMwREVcdTMwRjNcdTMwQzlcIn0gXHUzMDY3XHU1OTMxXHU2NTU3XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGXHUzMDAyYDtcbiAgICAgIGNhc2UgXCJBUlRJRkFDVF9OT1RfRk9VTkRcIjpcbiAgICAgICAgcmV0dXJuIGBQREYgXHU2MjEwXHU2NzlDXHU3MjY5XHUzMDRDXHU3NTFGXHU2MjEwXHUzMDU1XHUzMDhDXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDY3XHUzMDU3XHUzMDVGOiAke2NvbnRleHQucGF0aCA/PyBcIlx1NEUwRFx1NjYwRVwifWA7XG4gICAgICBjYXNlIFwiQVJUSUZBQ1RfT1BFTl9GQUlMRURcIjpcbiAgICAgICAgcmV0dXJuIGBQREYgXHUzMDkyXHU5NThCXHUzMDUxXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDY3XHUzMDU3XHUzMDVGOiAke2NvbnRleHQucGF0aCA/PyBcIlx1NEUwRFx1NjYwRVwifWA7XG4gICAgICBjYXNlIFwiUFJPQ0VTU19GQUlMRURfVE9fU1RBUlRcIjpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBcIlx1MzBEN1x1MzBFQ1x1MzBEM1x1MzBFNVx1MzBGQ1x1NUI5Rlx1ODg0Q1x1MzA5Mlx1OTU4Qlx1NTlDQlx1MzA2N1x1MzA0RFx1MzA3RVx1MzA1Qlx1MzA5M1x1MzA2N1x1MzA1N1x1MzA1Rlx1MzAwMlwiO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZXh0cmFjdE1lc3NhZ2UoZXJyb3I6IHVua25vd24pOiBzdHJpbmcge1xuICAgIGlmICh0eXBlb2YgZXJyb3IgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiBlcnJvci50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICByZXR1cm4gZXJyb3IubWVzc2FnZS50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBcIlwiO1xuICB9XG59XG4iLCAiaW1wb3J0IHsgQ2hpbGRQcm9jZXNzLCBTcGF3bk9wdGlvbnMsIHNwYXduIH0gZnJvbSBcIm5vZGU6Y2hpbGRfcHJvY2Vzc1wiO1xuXG5pbXBvcnQgeyBQcm9jZXNzUnVuUmVzdWx0IH0gZnJvbSBcIi4vY29udHJhY3RzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvY2Vzc1J1bk9wdGlvbnMge1xuICBjd2Q/OiBzdHJpbmc7XG4gIGVudj86IE5vZGVKUy5Qcm9jZXNzRW52O1xuICB0aW1lb3V0TXM/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0ZXJuYWxDbGlSdW5uZXIge1xuICBydW5XaXRoQXJncyhcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD47XG4gIHJ1bkNvbW1hbmRTdHJpbmcoXG4gICAgY29tbWFuZExpbmU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0Pjtcbn1cblxuZXhwb3J0IGNsYXNzIE5vZGVFeHRlcm5hbENsaVJ1bm5lciBpbXBsZW1lbnRzIEV4dGVybmFsQ2xpUnVubmVyIHtcbiAgcHVibGljIGFzeW5jIHJ1bldpdGhBcmdzKFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMucnVuUHJvY2Vzcyhjb21tYW5kLCBhcmdzLCBvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBydW5Db21tYW5kU3RyaW5nKFxuICAgIGNvbW1hbmRMaW5lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIGNvbnN0IGlzV2luZG93cyA9IHByb2Nlc3MucGxhdGZvcm0gPT09IFwid2luMzJcIjtcbiAgICByZXR1cm4gdGhpcy5ydW5Qcm9jZXNzKGlzV2luZG93cyA/IFwiY21kXCIgOiBcInNoXCIsIFtpc1dpbmRvd3MgPyBcIi9jXCIgOiBcIi1jXCIsIGNvbW1hbmRMaW5lXSwgb3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJ1blByb2Nlc3MoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbGV0IHNldHRsZWQgPSBmYWxzZTtcblxuICAgICAgY29uc3QgcHJvY2Vzc09wdGlvbnM6IFNwYXduT3B0aW9ucyA9IHtcbiAgICAgICAgY3dkOiBvcHRpb25zLmN3ZCxcbiAgICAgICAgZW52OiBvcHRpb25zLmVudixcbiAgICAgIH07XG5cbiAgICAgIGxldCBjaGlsZDogQ2hpbGRQcm9jZXNzO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY2hpbGQgPSBzcGF3bihjb21tYW5kLCBhcmdzLCB7XG4gICAgICAgICAgLi4ucHJvY2Vzc09wdGlvbnMsXG4gICAgICAgICAgc3RkaW86IFtcImlnbm9yZVwiLCBcInBpcGVcIiwgXCJwaXBlXCJdLFxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGV0IHN0ZG91dCA9IFwiXCI7XG4gICAgICBsZXQgc3RkZXJyID0gXCJcIjtcblxuICAgICAgY2hpbGQuc3Rkb3V0Py5zZXRFbmNvZGluZyhcInV0ZjhcIik7XG4gICAgICBjaGlsZC5zdGRlcnI/LnNldEVuY29kaW5nKFwidXRmOFwiKTtcbiAgICAgIGNoaWxkLnN0ZG91dD8ub24oXCJkYXRhXCIsIChjaHVuaykgPT4ge1xuICAgICAgICBzdGRvdXQgKz0gU3RyaW5nKGNodW5rKTtcbiAgICAgIH0pO1xuICAgICAgY2hpbGQuc3RkZXJyPy5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICAgIHN0ZGVyciArPSBTdHJpbmcoY2h1bmspO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHRpbWVvdXRNcyA9IG9wdGlvbnMudGltZW91dE1zO1xuICAgICAgbGV0IHRpbWVvdXRJZDogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQ7XG4gICAgICBpZiAodHlwZW9mIHRpbWVvdXRNcyA9PT0gXCJudW1iZXJcIiAmJiB0aW1lb3V0TXMgPiAwKSB7XG4gICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGlmIChzZXR0bGVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2V0dGxlZCA9IHRydWU7XG4gICAgICAgICAgdm9pZCBjaGlsZC5raWxsKCk7XG4gICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICBleGl0Q29kZTogbnVsbCxcbiAgICAgICAgICAgIHN0ZG91dCxcbiAgICAgICAgICAgIHN0ZGVycjogYCR7c3RkZXJyfVxcbnByb2Nlc3MgdGltZW91dCBhZnRlciAke3RpbWVvdXRNc31tc2AsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0sIHRpbWVvdXRNcyk7XG4gICAgICB9XG5cbiAgICAgIGNoaWxkLm9uKFwiZXJyb3JcIiwgKGVycm9yKSA9PiB7XG4gICAgICAgIGlmIChzZXR0bGVkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0dGxlZCA9IHRydWU7XG4gICAgICAgIGlmICh0aW1lb3V0SWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB9XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICB9KTtcblxuICAgICAgY2hpbGQub24oXCJjbG9zZVwiLCAoY29kZSkgPT4ge1xuICAgICAgICBpZiAoc2V0dGxlZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldHRsZWQgPSB0cnVlO1xuICAgICAgICBpZiAodGltZW91dElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc29sdmUoe1xuICAgICAgICAgIGV4aXRDb2RlOiBjb2RlLFxuICAgICAgICAgIHN0ZG91dCxcbiAgICAgICAgICBzdGRlcnIsXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vY2tFeHRlcm5hbENsaVJ1bm5lciBpbXBsZW1lbnRzIEV4dGVybmFsQ2xpUnVubmVyIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgaGFuZGxlcjogKFxuICAgICAgY29tbWFuZDogc3RyaW5nLFxuICAgICAgYXJnczogc3RyaW5nW10sXG4gICAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgICApID0+IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4sXG4gICkge31cblxuICBwdWJsaWMgcnVuV2l0aEFyZ3MoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5oYW5kbGVyKGNvbW1hbmQsIGFyZ3MsIG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIHJ1bkNvbW1hbmRTdHJpbmcoXG4gICAgY29tbWFuZExpbmU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PiB7XG4gICAgY29uc3QgaXNXaW5kb3dzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiO1xuICAgIHJldHVybiB0aGlzLmhhbmRsZXIoaXNXaW5kb3dzID8gXCJjbWRcIiA6IFwic2hcIiwgW2lzV2luZG93cyA/IFwiL2NcIiA6IFwiLWNcIiwgY29tbWFuZExpbmVdLCBvcHRpb25zKTtcbiAgfVxufVxuIiwgImV4cG9ydCBpbnRlcmZhY2UgUHJldmlld091dHB1dFByZXNlbnRlckNvbnRyYWN0IHtcbiAgb3BlbkFydGlmYWN0KHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG4gIHJldmVhbEluRm9sZGVyKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBjbGFzcyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIGltcGxlbWVudHMgUHJldmlld091dHB1dFByZXNlbnRlckNvbnRyYWN0IHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgb3BlbkluUGFuZTogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPixcbiAgICBwcml2YXRlIHJlYWRvbmx5IG9wZW5QYXRoOiAocGF0aDogc3RyaW5nKSA9PiBQcm9taXNlPHN0cmluZyB8IG51bGw+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcmV2ZWFsUGF0aDogKHBhdGg6IHN0cmluZykgPT4gdm9pZCxcbiAgKSB7fVxuXG4gIHB1YmxpYyBhc3luYyBvcGVuQXJ0aWZhY3QocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMub3BlbkluUGFuZShwYXRoKTtcbiAgICAgIHJldHVybjtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnN0IG9wZW5SZXN1bHQgPSBhd2FpdCB0aGlzLm9wZW5QYXRoKHBhdGgpO1xuICAgICAgaWYgKG9wZW5SZXN1bHQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG9wZW5SZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyBhc3luYyByZXZlYWxJbkZvbGRlcihwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnJldmVhbFBhdGgocGF0aCk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBpc0Fic29sdXRlLCBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuXG5pbXBvcnQge1xuICBQcmV2aWV3RXhlY3V0aW9uUmVzdWx0LFxuICBQcmV2aWV3VGFyZ2V0LFxufSBmcm9tIFwiLi9jb250cmFjdHNcIjtcbmltcG9ydCB7XG4gIEV4dGVybmFsQ2xpUnVubmVyLFxuICBQcm9jZXNzUnVuT3B0aW9ucyxcbn0gZnJvbSBcIi4vZXh0ZXJuYWxDbGlSdW5uZXJcIjtcbmltcG9ydCB7IFByZXZpZXdPdXRwdXRQdWJsaXNoZXIgfSBmcm9tIFwiLi9wcmV2aWV3T3V0cHV0UHVibGlzaGVyXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld0V4ZWN1dGlvblNlcnZpY2Uge1xuICBleGVjdXRlUHJldmlldyh0YXJnZXQ6IFByZXZpZXdUYXJnZXQsIGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8UHJldmlld0V4ZWN1dGlvblJlc3VsdD47XG59XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UgaW1wbGVtZW50cyBQcmV2aWV3RXhlY3V0aW9uU2VydmljZSB7XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJ1bm5lcjogRXh0ZXJuYWxDbGlSdW5uZXIsXG4gICAgcHJpdmF0ZSByZWFkb25seSBwdWJsaXNoZXI6IFByZXZpZXdPdXRwdXRQdWJsaXNoZXIsXG4gICAgcHJpdmF0ZSByZWFkb25seSBydW5PcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyA9IHsgdGltZW91dE1zOiAxMDAwMDAgfSxcbiAgKSB7fVxuXG4gIHB1YmxpYyBhc3luYyBleGVjdXRlUHJldmlldyhcbiAgICB0YXJnZXQ6IFByZXZpZXdUYXJnZXQsXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICApOiBQcm9taXNlPFByZXZpZXdFeGVjdXRpb25SZXN1bHQ+IHtcbiAgICBjb25zdCBhcnRpZmFjdFBhdGggPSB0aGlzLnB1Ymxpc2hlci5jb21wdXRlT3V0cHV0UGF0aCh0YXJnZXQpO1xuXG4gICAgY29uc3QgcnVuUmVzdWx0ID0gYXdhaXQgdGhpcy5ydW5uZXIucnVuV2l0aEFyZ3MoXG4gICAgICBjb21tYW5kLFxuICAgICAgW1wiY29tcGlsZVwiLCB0YXJnZXQuZmlsZVBhdGgsIGFydGlmYWN0UGF0aF0sXG4gICAgICB0aGlzLnJ1bk9wdGlvbnMsXG4gICAgKTtcblxuICAgIGlmIChydW5SZXN1bHQuZXhpdENvZGUgIT09IDApIHtcbiAgICAgIHRocm93IE9iamVjdC5hc3NpZ24obmV3IEVycm9yKHJ1blJlc3VsdC5zdGRlcnIgfHwgXCJwcmV2aWV3IGNvbW1hbmQgZmFpbGVkXCIpLCB7XG4gICAgICAgIGV4aXRDb2RlOiBydW5SZXN1bHQuZXhpdENvZGUsXG4gICAgICAgIHN0ZG91dDogcnVuUmVzdWx0LnN0ZG91dCxcbiAgICAgICAgc3RkZXJyOiBydW5SZXN1bHQuc3RkZXJyLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgYXJ0aWZhY3RQYXRoRm9yQ2hlY2sgPSB0aGlzLnJlc29sdmVBcnRpZmFjdFBhdGhGb3JDaGVjayhhcnRpZmFjdFBhdGgpO1xuICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRoaXMucHVibGlzaGVyLmVuc3VyZUFydGlmYWN0RXhpc3RzKGFydGlmYWN0UGF0aEZvckNoZWNrKTtcbiAgICBpZiAoIWV4aXN0cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhcnRpZmFjdCBub3QgZm91bmQ6ICR7YXJ0aWZhY3RQYXRoRm9yQ2hlY2t9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFydGlmYWN0UGF0aCxcbiAgICAgIGRldGVybWluaXN0aWNLZXk6IGFydGlmYWN0UGF0aCxcbiAgICAgIGNvbW1hbmRSdW5BdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgcHJvY2Vzc1J1bjogcnVuUmVzdWx0LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVBcnRpZmFjdFBhdGhGb3JDaGVjayhhcnRpZmFjdFBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKGlzQWJzb2x1dGUoYXJ0aWZhY3RQYXRoKSkge1xuICAgICAgcmV0dXJuIGFydGlmYWN0UGF0aDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRoaXMucnVuT3B0aW9ucy5jd2QgPT09IFwic3RyaW5nXCIgJiYgdGhpcy5ydW5PcHRpb25zLmN3ZC5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gam9pbih0aGlzLnJ1bk9wdGlvbnMuY3dkLCBhcnRpZmFjdFBhdGgpO1xuICAgIH1cblxuICAgIHJldHVybiBhcnRpZmFjdFBhdGg7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0dWJQcmV2aWV3RXhlY3V0aW9uU2VydmljZSBpbXBsZW1lbnRzIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2ltdWxhdGU6ICh0YXJnZXQ6IFByZXZpZXdUYXJnZXQsIGNvbW1hbmQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiA9IGFzeW5jICgpID0+IHtcbiAgICAgIHJldHVybjtcbiAgICB9LFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWN1dGVQcmV2aWV3KHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxQcmV2aWV3RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgYXdhaXQgdGhpcy5zaW11bGF0ZSh0YXJnZXQsIGNvbW1hbmQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFydGlmYWN0UGF0aDogam9pbih0YXJnZXQuZmlsZVBhdGgsIFwiLi5cIiwgXCJwcmV2aWV3LnBkZlwiKSxcbiAgICAgIGRldGVybWluaXN0aWNLZXk6IHRhcmdldC5maWxlUGF0aCxcbiAgICAgIGNvbW1hbmRSdW5BdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgcHJvY2Vzc1J1bjoge1xuICAgICAgICBleGl0Q29kZTogMCxcbiAgICAgICAgc3Rkb3V0OiBcIlwiLFxuICAgICAgICBzdGRlcnI6IFwiXCIsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBhY2Nlc3MgfSBmcm9tIFwibm9kZTpmcy9wcm9taXNlc1wiO1xuaW1wb3J0IHsgZGlybmFtZSwgZXh0bmFtZSwgYmFzZW5hbWUsIGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmltcG9ydCB7IFByZXZpZXdUYXJnZXQgfSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3T3V0cHV0UHVibGlzaENvbnRyYWN0IHtcbiAgY29tcHV0ZU91dHB1dFBhdGgodGFyZ2V0OiBQcmV2aWV3VGFyZ2V0KTogc3RyaW5nO1xuICBlbnN1cmVBcnRpZmFjdEV4aXN0cyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+O1xufVxuXG5leHBvcnQgY2xhc3MgUHJldmlld091dHB1dFB1Ymxpc2hlciBpbXBsZW1lbnRzIFByZXZpZXdPdXRwdXRQdWJsaXNoQ29udHJhY3Qge1xuICBwdWJsaWMgY29tcHV0ZU91dHB1dFBhdGgodGFyZ2V0OiBQcmV2aWV3VGFyZ2V0KTogc3RyaW5nIHtcbiAgICBjb25zdCByb290ID0gZGlybmFtZSh0YXJnZXQuZmlsZVBhdGgpO1xuICAgIGNvbnN0IG5hbWUgPSBiYXNlbmFtZSh0YXJnZXQuZmlsZVBhdGgpO1xuICAgIGNvbnN0IHN0ZW0gPSBuYW1lLnNsaWNlKDAsIG5hbWUubGVuZ3RoIC0gZXh0bmFtZShuYW1lKS5sZW5ndGgpO1xuXG4gICAgcmV0dXJuIGpvaW4ocm9vdCwgYCR7c3RlbX0ucGRmYCk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZW5zdXJlQXJ0aWZhY3RFeGlzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFjY2VzcyhwYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TdGF0ZUd1YXJkQ29udHJhY3Qge1xuICB3aXRoTGVhZlByZXNlcnZlZDxUPihhY3Rpb246ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+O1xuICByZXN0b3JlQWN0aXZlTGVhZklmTmVlZGVkKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBQbHVnaW5TdGF0ZUd1YXJkIGltcGxlbWVudHMgUGx1Z2luU3RhdGVHdWFyZENvbnRyYWN0IHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY3VycmVudExlYWZQcm92aWRlcjogKCkgPT4gV29ya3NwYWNlTGVhZiB8IG51bGwsXG4gICAgcHJpdmF0ZSByZWFkb25seSByZXN0b3JlTGVhZjogKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKSA9PiB2b2lkLFxuICApIHt9XG5cbiAgcHJpdmF0ZSBsZWFmVG9SZXN0b3JlOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCA9IG51bGw7XG5cbiAgcHVibGljIGFzeW5jIHdpdGhMZWFmUHJlc2VydmVkPFQ+KGFjdGlvbjogKCkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICAgIGNvbnN0IHByZXZpb3VzTGVhZiA9IHRoaXMuY3VycmVudExlYWZQcm92aWRlcigpO1xuICAgIHRoaXMubGVhZlRvUmVzdG9yZSA9IHByZXZpb3VzTGVhZjtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnJlc3RvcmVBY3RpdmVMZWFmSWZOZWVkZWQoKTtcbiAgICAgIHRoaXMubGVhZlRvUmVzdG9yZSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlc3RvcmVBY3RpdmVMZWFmSWZOZWVkZWQoKTogdm9pZCB7XG4gICAgdGhpcy5yZXN0b3JlSWZDaGFuZ2VkKHRoaXMubGVhZlRvUmVzdG9yZSk7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJZkNoYW5nZWQoZXhwZWN0ZWRMZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmIChleHBlY3RlZExlYWYgIT09IHRoaXMuY3VycmVudExlYWZQcm92aWRlcigpKSB7XG4gICAgICB0aGlzLnJlc3RvcmVMZWFmKGV4cGVjdGVkTGVhZik7XG4gICAgfVxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7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
