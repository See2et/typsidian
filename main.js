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
  constructor(openPath, revealPath) {
    this.openPath = openPath;
    this.revealPath = revealPath;
  }
  async openArtifact(path) {
    const openResult = await this.openPath(path);
    if (openResult) {
      throw new Error(openResult);
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
    const exists = await this.publisher.ensureArtifactExists(artifactPath);
    if (!exists) {
      throw new Error(`artifact not found: ${artifactPath}`);
    }
    return {
      artifactPath,
      deterministicKey: artifactPath,
      commandRunAt: (/* @__PURE__ */ new Date()).toISOString(),
      processRun: runResult
    };
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3ByZXZpZXcvY29udHJhY3RzLnRzIiwgInNyYy9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3Q29udGV4dFJlc29sdmVyLnRzIiwgInNyYy9wcmV2aWV3L3ByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2UudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld0ZhaWx1cmVQb2xpY3kudHMiLCAic3JjL3ByZXZpZXcvZXh0ZXJuYWxDbGlSdW5uZXIudHMiLCAic3JjL3ByZXZpZXcvcHJldmlld091dHB1dFByZXNlbnRlci50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3RXhlY3V0aW9uU2VydmljZS50cyIsICJzcmMvcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyLnRzIiwgInNyYy9wcmV2aWV3L3BsdWdpblN0YXRlR3VhcmQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIE1hcmtkb3duVmlldyxcbiAgTWVudSxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFRBYnN0cmFjdEZpbGUsXG4gIFRGaWxlLFxuICBURm9sZGVyLFxuICBXb3Jrc3BhY2VMZWFmLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IENoaWxkUHJvY2Vzcywgc3Bhd24gfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHtcbiAgUFJFVklFV19DT01NQU5EX0lELFxuICBQUkVWSUVXX0NPTU1BTkRfTkFNRSxcbn0gZnJvbSBcIi4vcHJldmlldy9jb250cmFjdHNcIjtcbmltcG9ydCB7IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdDb21tYW5kQ29udHJvbGxlclwiO1xuaW1wb3J0IHsgUHJldmlld0NvbnRleHRSZXNvbHZlciB9IGZyb20gXCIuL3ByZXZpZXcvcHJldmlld0NvbnRleHRSZXNvbHZlclwiO1xuaW1wb3J0IHsgUHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZSB9IGZyb20gXCIuL3ByZXZpZXcvcHJlcmVxdWlzaXRlRGlzY292ZXJ5U2VydmljZVwiO1xuaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVQb2xpY3kgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdGYWlsdXJlUG9saWN5XCI7XG5pbXBvcnQgeyBOb2RlRXh0ZXJuYWxDbGlSdW5uZXIgfSBmcm9tIFwiLi9wcmV2aWV3L2V4dGVybmFsQ2xpUnVubmVyXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHJlc2VudGVyXCI7XG5pbXBvcnQgeyBEZWZhdWx0UHJldmlld0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tIFwiLi9wcmV2aWV3L3ByZXZpZXdFeGVjdXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyIH0gZnJvbSBcIi4vcHJldmlldy9wcmV2aWV3T3V0cHV0UHVibGlzaGVyXCI7XG5pbXBvcnQgeyBQbHVnaW5TdGF0ZUd1YXJkIH0gZnJvbSBcIi4vcHJldmlldy9wbHVnaW5TdGF0ZUd1YXJkXCI7XG5cbmNvbnN0IFRZUF9FWFRFTlNJT04gPSBcInR5cFwiO1xuY29uc3QgVFlQX1ZJRVcgPSBcIm1hcmtkb3duXCI7XG5jb25zdCBORVdfVFlQX05BTUUgPSBcIlVudGl0bGVkXCI7XG5jb25zdCBORVdfVFlQX0VYVCA9IGAuJHtUWVBfRVhURU5TSU9OfWA7XG5jb25zdCBUWVBfRklMRV9FWFRFTlNJT05TID0gW1RZUF9FWFRFTlNJT04sIFwiVHlwXCIsIFwiVFlQXCJdIGFzIGNvbnN0O1xuXG5pbnRlcmZhY2UgVHlwTGlmZWN5Y2xlRXZlbnRUYXJnZXQge1xuICBwYXRoOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVHlwc2lkaWFuUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBwcmV2aW91c0FjdGl2ZUxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjdXJyZW50QWN0aXZlTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwgPSBudWxsO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldE1vc3RSZWNlbnRMZWFmKCk7XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB7XG4gICAgICB0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9ucyhBcnJheS5mcm9tKFRZUF9GSUxFX0VYVEVOU0lPTlMpLCBUWVBfVklFVyk7XG4gICAgICB0aGlzLnJlZ2lzdGVyVHlwTGlmZWN5Y2xlT2JzZXJ2ZXIoKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJUeXBDb250ZXh0TWVudUFjdGlvbnMoKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJQcmV2aWV3Q29tbWFuZCgpO1xuICAgICAgdGhpcy5sb2dTdGFydHVwU3RhdGUoKTtcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCB0aGlzLmhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UpLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHRoaXMuaGFuZGxlRmlsZU9wZW4pLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gbG9hZGVkXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVGaWxlT3BlbiA9IChmaWxlOiBURmlsZSB8IG51bGwpOiB2b2lkID0+IHtcbiAgICBpZiAoIWZpbGUgfHwgIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZUFjY2Vzc2libGUoZmlsZSkpIHtcbiAgICAgIHRoaXMucmVzdG9yZUFjdGl2ZUxlYWYodGhpcy5wcmV2aW91c0FjdGl2ZUxlYWYpO1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgXCIudHlwIFx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA5Mlx1OTU4Qlx1MzA1MVx1MzA3RVx1MzA1Qlx1MzA5M1x1MzA2N1x1MzA1N1x1MzA1Rlx1MzAwMlx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA0Q1x1OTU4Qlx1MzA1MVx1MzA4Qlx1NzJCNlx1NjE0Qlx1MzA0Qlx1NzhCQVx1OEE4RFx1MzA1N1x1MzA2Nlx1MzA0Rlx1MzA2MFx1MzA1NVx1MzA0NFwiLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdGluZ0xlYWYgPSB0aGlzLmdldExlYWZCeVR5cEZpbGUoZmlsZS5wYXRoKTtcblxuICAgIGlmICghZXhpc3RpbmdMZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlTGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgIGlmIChhY3RpdmVMZWFmID09PSBleGlzdGluZ0xlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uuc2V0QWN0aXZlTGVhZihleGlzdGluZ0xlYWYsIHsgZm9jdXM6IHRydWUgfSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVBY3RpdmVMZWFmQ2hhbmdlID0gKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCA9PiB7XG4gICAgaWYgKGxlYWYgPT09IHRoaXMuY3VycmVudEFjdGl2ZUxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnByZXZpb3VzQWN0aXZlTGVhZiA9IHRoaXMuY3VycmVudEFjdGl2ZUxlYWY7XG4gICAgdGhpcy5jdXJyZW50QWN0aXZlTGVhZiA9IGxlYWY7XG4gIH07XG5cbiAgcHJpdmF0ZSByZWdpc3RlclR5cExpZmVjeWNsZU9ic2VydmVyKCk6IHZvaWQge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCB0aGlzLmhhbmRsZVZhdWx0Q3JlYXRlKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIHRoaXMuaGFuZGxlVmF1bHRSZW5hbWUpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJkZWxldGVcIiwgdGhpcy5oYW5kbGVWYXVsdERlbGV0ZSkpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcbiAgICAgICAgdGhpcy5hZGROZXdUeXBDb250ZXh0TWVudUl0ZW0obWVudSwgdGhpcy5nZXRUYXJnZXRGb2xkZXIoZmlsZSkpO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJmaWxlcy1tZW51XCIsXG4gICAgICAgIChtZW51OiBNZW51LCBmaWxlczogVEFic3RyYWN0RmlsZVtdIHwgbnVsbCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSBmaWxlcz8uWzBdO1xuICAgICAgICAgIHRoaXMuYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnUsIHRoaXMuZ2V0VGFyZ2V0Rm9sZGVyKHRhcmdldEZpbGUpKTtcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJQcmV2aWV3Q29tbWFuZCgpOiB2b2lkIHtcbiAgICBjb25zdCBjb21tYW5kQ29udHJvbGxlciA9IHRoaXMuY3JlYXRlUHJldmlld0NvbW1hbmRDb250cm9sbGVyKCk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFBSRVZJRVdfQ09NTUFORF9JRCxcbiAgICAgIG5hbWU6IFBSRVZJRVdfQ09NTUFORF9OQU1FLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzQXZhaWxhYmxlID0gY29tbWFuZENvbnRyb2xsZXIuaXNDb21tYW5kQXZhaWxhYmxlKCk7XG5cbiAgICAgICAgaWYgKGNoZWNraW5nKSB7XG4gICAgICAgICAgcmV0dXJuIGlzQXZhaWxhYmxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0F2YWlsYWJsZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZvaWQgY29tbWFuZENvbnRyb2xsZXIucnVuRnJvbUN1cnJlbnRDb250ZXh0KCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUHJldmlld0NvbW1hbmRDb250cm9sbGVyKCk6IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIge1xuICAgIGNvbnN0IGdldEFjdGl2ZUxpa2UgPSAoKSA9PiB7XG4gICAgICBjb25zdCBhY3RpdmVGaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcbiAgICAgIGlmICghYWN0aXZlRmlsZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogYWN0aXZlRmlsZS5wYXRoLFxuICAgICAgICBleHRlbnNpb246IGFjdGl2ZUZpbGUuZXh0ZW5zaW9uLFxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgY29uc3QgdmF1bHRCYXNlUGF0aCA9IHRoaXMuZ2V0VmF1bHRCYXNlUGF0aCgpO1xuXG4gICAgY29uc3QgcnVubmVyID0gbmV3IE5vZGVFeHRlcm5hbENsaVJ1bm5lcigpO1xuICAgIGNvbnN0IG91dHB1dFB1Ymxpc2hlciA9IG5ldyBQcmV2aWV3T3V0cHV0UHVibGlzaGVyKCk7XG4gICAgY29uc3QgZXhlY3V0aW9uID0gbmV3IERlZmF1bHRQcmV2aWV3RXhlY3V0aW9uU2VydmljZShcbiAgICAgIHJ1bm5lcixcbiAgICAgIG91dHB1dFB1Ymxpc2hlcixcbiAgICAgIHZhdWx0QmFzZVBhdGggPyB7IGN3ZDogdmF1bHRCYXNlUGF0aCB9IDoge30sXG4gICAgKTtcbiAgICBjb25zdCBwcmVzZW50ZXIgPSBuZXcgUHJldmlld091dHB1dFByZXNlbnRlcihcbiAgICAgIChwYXRoKSA9PiB0aGlzLm9wZW5CeVN5c3RlbSh0aGlzLnJlc29sdmVWYXVsdFBhdGgocGF0aCkpLFxuICAgICAgKHBhdGgpID0+IHtcbiAgICAgICAgdm9pZCB0aGlzLnJldmVhbEluT3ModGhpcy5yZXNvbHZlVmF1bHRQYXRoKHBhdGgpKTtcbiAgICAgIH0sXG4gICAgKTtcbiAgICBjb25zdCBmYWlsdXJlUG9saWN5ID0gbmV3IFByZXZpZXdGYWlsdXJlUG9saWN5KCk7XG4gICAgY29uc3Qgc3RhdGVHdWFyZCA9IG5ldyBQbHVnaW5TdGF0ZUd1YXJkKFxuICAgICAgKCkgPT4gdGhpcy5jdXJyZW50QWN0aXZlTGVhZixcbiAgICAgIChsZWFmKSA9PiB0aGlzLnJlc3RvcmVBY3RpdmVMZWFmKGxlYWYpLFxuICAgICk7XG4gICAgY29uc3QgcnVudGltZSA9IG5ldyBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlKHtcbiAgICAgIHZlcmlmeTogKGNvbW1hbmROYW1lKSA9PlxuICAgICAgICBuZXcgUHJvbWlzZTxib29sZWFuPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRlc3RQcm9jZXNzID0gc3Bhd24oY29tbWFuZE5hbWUsIFtcIi0tdmVyc2lvblwiXSwge1xuICAgICAgICAgICAgc3RkaW86IFtcImlnbm9yZVwiLCBcImlnbm9yZVwiLCBcInBpcGVcIl0sXG4gICAgICAgICAgICBjd2Q6IHZhdWx0QmFzZVBhdGggPz8gdW5kZWZpbmVkLFxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgdGVzdFByb2Nlc3Mub24oXCJlcnJvclwiLCAoKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKGZhbHNlKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHRlc3RQcm9jZXNzLm9uKFwiY2xvc2VcIiwgKGNvZGUpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoY29kZSA9PT0gMCB8fCBjb2RlID09PSBudWxsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXIoe1xuICAgICAgcmVzb2x2ZXI6IG5ldyBQcmV2aWV3Q29udGV4dFJlc29sdmVyKGdldEFjdGl2ZUxpa2UpLFxuICAgICAgcnVudGltZSxcbiAgICAgIGV4ZWN1dGlvbixcbiAgICAgIHByZXNlbnRlcixcbiAgICAgIGZhaWx1cmVQb2xpY3ksXG4gICAgICBzdGF0ZUd1YXJkLFxuICAgICAgb25Ob3RpY2U6IChtZXNzYWdlKSA9PiBuZXcgTm90aWNlKG1lc3NhZ2UpLFxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvcGVuQnlTeXN0ZW0ocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZyB8IG51bGw+KChyZXNvbHZlKSA9PiB7XG4gICAgICBjb25zdCBjb21tYW5kID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJkYXJ3aW5cIiA/IFwib3BlblwiIDogcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiID8gXCJjbWRcIiA6IFwieGRnLW9wZW5cIjtcbiAgICAgIGNvbnN0IGFyZ3MgPVxuICAgICAgICBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCJcbiAgICAgICAgICA/IFtcIi9jXCIsIFwic3RhcnRcIiwgcGF0aF1cbiAgICAgICAgICA6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCJcbiAgICAgICAgICAgID8gW3BhdGhdXG4gICAgICAgICAgICA6IFtwYXRoXTtcblxuICAgICAgbGV0IGNoaWxkOiBDaGlsZFByb2Nlc3M7XG4gICAgICB0cnkge1xuICAgICAgICBjaGlsZCA9IHNwYXduKGNvbW1hbmQsIGFyZ3MsIHtcbiAgICAgICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwiaWdub3JlXCIsIFwicGlwZVwiXSxcbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXNvbHZlKGBvcGVuIGNvbW1hbmQgZmFpbGVkOiAke1N0cmluZyhlcnJvcil9YCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGV0IHN0ZGVyciA9IFwiXCI7XG4gICAgICBjaGlsZC5zdGRlcnI/Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgICAgc3RkZXJyICs9IFN0cmluZyhjaHVuayk7XG4gICAgICB9KTtcblxuICAgICAgY2hpbGQub24oXCJlcnJvclwiLCAoZXJyb3IpID0+IHtcbiAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZDogJHtTdHJpbmcoZXJyb3IpfWApO1xuICAgICAgfSk7XG5cbiAgICAgIGNoaWxkLm9uKFwiY2xvc2VcIiwgKGNvZGUpID0+IHtcbiAgICAgICAgaWYgKGNvZGUgPT09IDAgfHwgY29kZSA9PT0gbnVsbCkge1xuICAgICAgICAgIHJlc29sdmUobnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN0ZGVyci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZDogJHtzdGRlcnJ9YCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb2x2ZShgb3BlbiBjb21tYW5kIGZhaWxlZCB3aXRoIGV4aXQgY29kZSAke1N0cmluZyhjb2RlKX1gKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyByZXZlYWxJbk9zKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcImRhcndpblwiID8gXCJvcGVuXCIgOiBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCIgPyBcImNtZFwiIDogXCJ4ZGctb3BlblwiO1xuICAgIGNvbnN0IGFyZ3MgPVxuICAgICAgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiXG4gICAgICAgID8gW1wiL2NcIiwgXCJzdGFydFwiLCBwYXRoXVxuICAgICAgICA6IHByb2Nlc3MucGxhdGZvcm0gPT09IFwiZGFyd2luXCJcbiAgICAgICAgICA/IFtcIi1SXCIsIHBhdGhdXG4gICAgICAgICAgOiBbcGF0aF07XG5cbiAgICBhd2FpdCB0aGlzLm9wZW5CeVN5c3RlbVdpdGhBcmdzKGNvbW1hbmQsIGFyZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBvcGVuQnlTeXN0ZW1XaXRoQXJncyhjb21tYW5kOiBzdHJpbmcsIGFyZ3M6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICBsZXQgY2hpbGQ6IENoaWxkUHJvY2VzcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGNoaWxkID0gc3Bhd24oY29tbWFuZCwgYXJncywge1xuICAgICAgICAgIHN0ZGlvOiBbXCJpZ25vcmVcIiwgXCJpZ25vcmVcIiwgXCJpZ25vcmVcIl0sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsICgpID0+IHJlc29sdmUoKSk7XG4gICAgICBjaGlsZC5vbihcImVycm9yXCIsICgpID0+IHJlc29sdmUoKSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlc29sdmVWYXVsdFBhdGgocmVsYXRpdmVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHZhdWx0QmFzZVBhdGggPSB0aGlzLmdldFZhdWx0QmFzZVBhdGgoKTtcbiAgICBpZiAoIXZhdWx0QmFzZVBhdGgpIHtcbiAgICAgIHJldHVybiByZWxhdGl2ZVBhdGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGpvaW4odmF1bHRCYXNlUGF0aCwgcmVsYXRpdmVQYXRoKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VmF1bHRCYXNlUGF0aCgpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBhZGFwdGVyID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlcjtcbiAgICBjb25zdCBtYXliZUdldEJhc2VQYXRoID1cbiAgICAgIFwiZ2V0QmFzZVBhdGhcIiBpbiBhZGFwdGVyICYmIHR5cGVvZiBhZGFwdGVyLmdldEJhc2VQYXRoID09PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgPyBhZGFwdGVyLmdldEJhc2VQYXRoXG4gICAgICAgIDogbnVsbDtcblxuICAgIGlmICghbWF5YmVHZXRCYXNlUGF0aCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1heWJlR2V0QmFzZVBhdGguY2FsbChhZGFwdGVyKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnU6IE1lbnUsIHRhcmdldDogVEZvbGRlcik6IHZvaWQge1xuICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgaXRlbVxuICAgICAgICAuc2V0VGl0bGUoXCJOZXcgVHlwc3RcIilcbiAgICAgICAgLnNldEljb24oXCJuZXctZmlsZVwiKVxuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBhd2FpdCB0aGlzLnJlc29sdmVVbmlxdWVUeXBGaWxlTmFtZSh0YXJnZXQpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHRoaXMuam9pblBhdGgodGFyZ2V0LnBhdGgsIG5hbWUpO1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZSh0YXJnZXRQYXRoLCBcIlwiKTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoZmFsc2UpLm9wZW5GaWxlKGNyZWF0ZWQpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW3R5cHNpZGlhbl0gZmFpbGVkIHRvIGNyZWF0ZSB0eXAgZmlsZVwiLCBlcnJvcik7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFwiLnR5cCBcdTMwRDVcdTMwQTFcdTMwQTRcdTMwRUJcdTMwNkVcdTRGNUNcdTYyMTBcdTMwNkJcdTU5MzFcdTY1NTdcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUZcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVVuaXF1ZVR5cEZpbGVOYW1lKGZvbGRlcjogVEZvbGRlcik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaW5pdGlhbE5hbWUgPSBgJHtORVdfVFlQX05BTUV9JHtORVdfVFlQX0VYVH1gO1xuICAgIGlmIChcbiAgICAgICF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoXG4gICAgICAgIHRoaXMuam9pblBhdGgoZm9sZGVyLnBhdGgsIGluaXRpYWxOYW1lKSxcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHJldHVybiBpbml0aWFsTmFtZTtcbiAgICB9XG5cbiAgICBsZXQgY291bnRlciA9IDE7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBgJHtORVdfVFlQX05BTUV9ICR7Y291bnRlcn0ke05FV19UWVBfRVhUfWA7XG4gICAgICBpZiAoXG4gICAgICAgICF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5qb2luUGF0aChmb2xkZXIucGF0aCwgbmFtZSkpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICB9XG4gICAgICBjb3VudGVyICs9IDE7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRUYXJnZXRGb2xkZXIoZmlsZT86IFRBYnN0cmFjdEZpbGUpOiBURm9sZGVyIHtcbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIHJldHVybiBmaWxlLnBhcmVudCA/PyB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNUeXBGaWxlKGZpbGU6IFRBYnN0cmFjdEZpbGUpOiBmaWxlIGlzIFRGaWxlIHtcbiAgICByZXR1cm4gZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCkgPT09IFRZUF9FWFRFTlNJT047XG4gIH1cblxuICBwcml2YXRlIGdldExlYWZCeVR5cEZpbGUocGF0aDogc3RyaW5nKTogV29ya3NwYWNlTGVhZiB8IG51bGwge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2VcbiAgICAgICAgLmdldExlYXZlc09mVHlwZShUWVBfVklFVylcbiAgICAgICAgLmZpbmQoKGxlYWYpID0+XG4gICAgICAgICAgbGVhZi52aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3ICYmIGxlYWYudmlldy5maWxlPy5wYXRoID09PSBwYXRoXG4gICAgICAgICkgfHxcbiAgICAgIG51bGxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVWYXVsdENyZWF0ZSA9IChmaWxlOiBUQWJzdHJhY3RGaWxlKTogdm9pZCA9PiB7XG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nTGlmZWN5Y2xlKFwiY3JlYXRlXCIsIGZpbGUpO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlVmF1bHRSZW5hbWUgPSAoZmlsZTogVEFic3RyYWN0RmlsZSwgb2xkUGF0aDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nTGlmZWN5Y2xlKFwicmVuYW1lXCIsIGZpbGUsIG9sZFBhdGgpO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlVmF1bHREZWxldGUgPSAoZmlsZTogVEFic3RyYWN0RmlsZSk6IHZvaWQgPT4ge1xuICAgIGlmICghdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0xpZmVjeWNsZShcImRlbGV0ZVwiLCBmaWxlKTtcbiAgfTtcblxuICBwcml2YXRlIGlzVHlwRmlsZUFjY2Vzc2libGUoZmlsZTogVEZpbGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGUucGF0aCkgaW5zdGFuY2VvZiBURmlsZTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzdG9yZUFjdGl2ZUxlYWYobGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkIHtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY3RpdmVMZWFmID0gdGhpcy5jdXJyZW50QWN0aXZlTGVhZjtcbiAgICBpZiAoYWN0aXZlTGVhZiA9PT0gbGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5zZXRBY3RpdmVMZWFmKGxlYWYsIHsgZm9jdXM6IHRydWUgfSk7XG4gIH1cblxuICBwcml2YXRlIGxvZ0xpZmVjeWNsZShcbiAgICBldmVudE5hbWU6IFwiY3JlYXRlXCIgfCBcInJlbmFtZVwiIHwgXCJkZWxldGVcIixcbiAgICBmaWxlOiBUeXBMaWZlY3ljbGVFdmVudFRhcmdldCxcbiAgICBvbGRQYXRoPzogc3RyaW5nLFxuICApOiB2b2lkIHtcbiAgICBpZiAob2xkUGF0aCkge1xuICAgICAgY29uc29sZS5pbmZvKGBbdHlwc2lkaWFuXSAke2V2ZW50TmFtZX06ICR7b2xkUGF0aH0gLT4gJHtmaWxlLnBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5pbmZvKGBbdHlwc2lkaWFuXSAke2V2ZW50TmFtZX06ICR7ZmlsZS5wYXRofWApO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2dTdGFydHVwU3RhdGUoKTogdm9pZCB7XG4gICAgY29uc29sZS5pbmZvKFxuICAgICAgXCJbdHlwc2lkaWFuXSBzdGFydHVwIG9ic2VydmVycyBhbmQgY29udGV4dCBtZW51IGFjdGlvbnMgcmVnaXN0ZXJlZFwiLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGpvaW5QYXRoKGZvbGRlclBhdGg6IHN0cmluZywgZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKCFmb2xkZXJQYXRoKSB7XG4gICAgICByZXR1cm4gZmlsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGAke2ZvbGRlclBhdGh9LyR7ZmlsZU5hbWV9YDtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuaW5mbyhcIlt0eXBzaWRpYW5dIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxufVxuIiwgImV4cG9ydCBjb25zdCBUWVBfRklMRV9FWFRFTlNJT04gPSBcInR5cFwiO1xuZXhwb3J0IGNvbnN0IFBSRVZJRVdfQ09NTUFORF9OQU1FID0gXCJQcmV2aWV3IFR5cHN0XCI7XG5leHBvcnQgY29uc3QgUFJFVklFV19DT01NQU5EX0lEID0gXCJwcmV2aWV3LXR5cHN0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld0ZpbGVMaWtlIHtcbiAgcmVhZG9ubHkgcGF0aDogc3RyaW5nO1xuICByZWFkb25seSBleHRlbnNpb246IHN0cmluZztcbn1cblxuZXhwb3J0IHR5cGUgUHJldmlld1RhcmdldCA9IHtcbiAgZmlsZVBhdGg6IHN0cmluZztcbiAgZGlzcGxheU5hbWU6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdSZXNvbHZlRXJyb3IgPSBcIk5PX0FDVElWRV9UQVJHRVRcIjtcblxuZXhwb3J0IHR5cGUgUHJldmlld1Jlc29sdmVSZXN1bHQgPVxuICB8IHsgb2s6IHRydWU7IHRhcmdldDogUHJldmlld1RhcmdldCB9XG4gIHwgeyBvazogZmFsc2U7IHJlYXNvbjogUHJldmlld1Jlc29sdmVFcnJvciB9O1xuXG5leHBvcnQgdHlwZSBSdW50aW1lQ29tbWFuZCA9IHN0cmluZztcblxuZXhwb3J0IHR5cGUgUnVudGltZUNoZWNrUmVzdWx0ID1cbiAgfCB7XG4gICAgICBvazogdHJ1ZTtcbiAgICAgIHJlc29sdmVkQ29tbWFuZDogUnVudGltZUNvbW1hbmQ7XG4gICAgfVxuICB8IHtcbiAgICAgIG9rOiBmYWxzZTtcbiAgICAgIHJlYXNvbjogXCJNSVNTSU5HX1JVTlRJTUVcIiB8IFwiSU5WQUxJRF9QQVRIXCI7XG4gICAgfTtcblxuZXhwb3J0IHR5cGUgUHJvY2Vzc1J1blJlc3VsdCA9IHtcbiAgZXhpdENvZGU6IG51bWJlciB8IG51bGw7XG4gIHN0ZG91dDogc3RyaW5nO1xuICBzdGRlcnI6IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFByZXZpZXdFeGVjdXRpb25SZXN1bHQgPSB7XG4gIGFydGlmYWN0UGF0aDogc3RyaW5nO1xuICBjb21tYW5kUnVuQXQ6IHN0cmluZztcbiAgZGV0ZXJtaW5pc3RpY0tleTogc3RyaW5nO1xuICBwcm9jZXNzUnVuOiBQcm9jZXNzUnVuUmVzdWx0O1xufTtcblxuZXhwb3J0IHR5cGUgUHJldmlld0ZhaWx1cmVDYXRlZ29yeSA9XG4gIHwgXCJERVBFTkRFTkNZX01JU1NJTkdcIlxuICB8IFwiUFJPQ0VTU19GQUlMRURfVE9fU1RBUlRcIlxuICB8IFwiUFJPQ0VTU19USU1FT1VUXCJcbiAgfCBcIlBST0NFU1NfRVhJVF9FUlJPUlwiXG4gIHwgXCJBUlRJRkFDVF9OT1RfRk9VTkRcIlxuICB8IFwiQVJUSUZBQ1RfT1BFTl9GQUlMRURcIjtcblxuZXhwb3J0IHR5cGUgUHJldmlld0Zsb3dSZXN1bHQgPVxuICB8IHtcbiAgICAgIG9rOiB0cnVlO1xuICAgICAgbWVzc2FnZTogc3RyaW5nO1xuICAgICAgYXJ0aWZhY3RQYXRoOiBzdHJpbmc7XG4gICAgfVxuICB8IHtcbiAgICAgIG9rOiBmYWxzZTtcbiAgICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICB9O1xuIiwgImltcG9ydCB7XG4gIFByZXZpZXdGbG93UmVzdWx0LFxuICBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5LFxuICBSdW50aW1lQ2hlY2tSZXN1bHQsXG59IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuaW1wb3J0IHsgUHJldmlld0NvbnRleHRSZXNvbHZlciB9IGZyb20gXCIuL3ByZXZpZXdDb250ZXh0UmVzb2x2ZXJcIjtcbmltcG9ydCB7IFByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2UgfSBmcm9tIFwiLi9wcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlXCI7XG5pbXBvcnQgeyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyIH0gZnJvbSBcIi4vcHJldmlld091dHB1dFByZXNlbnRlclwiO1xuaW1wb3J0IHsgUHJldmlld0ZhaWx1cmVQb2xpY3kgfSBmcm9tIFwiLi9wcmV2aWV3RmFpbHVyZVBvbGljeVwiO1xuaW1wb3J0IHtcbiAgUHJldmlld0V4ZWN1dGlvblNlcnZpY2UsXG59IGZyb20gXCIuL3ByZXZpZXdFeGVjdXRpb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBQbHVnaW5TdGF0ZUd1YXJkIH0gZnJvbSBcIi4vcGx1Z2luU3RhdGVHdWFyZFwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByZXZpZXdDb21tYW5kQ29udHJvbGxlciB7XG4gIGlzQ29tbWFuZEF2YWlsYWJsZSgpOiBib29sZWFuO1xuICBydW5Gcm9tQ3VycmVudENvbnRleHQoKTogUHJvbWlzZTxQcmV2aWV3Rmxvd1Jlc3VsdD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld0NvbW1hbmRDb250cm9sbGVyRGVwcyB7XG4gIHJlc29sdmVyOiBQcmV2aWV3Q29udGV4dFJlc29sdmVyO1xuICBydW50aW1lOiBQcmVyZXF1aXNpdGVEaXNjb3ZlcnlTZXJ2aWNlO1xuICBleGVjdXRpb246IFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlO1xuICBwcmVzZW50ZXI6IFByZXZpZXdPdXRwdXRQcmVzZW50ZXI7XG4gIGZhaWx1cmVQb2xpY3k6IFByZXZpZXdGYWlsdXJlUG9saWN5O1xuICBzdGF0ZUd1YXJkOiBQbHVnaW5TdGF0ZUd1YXJkO1xuICBvbk5vdGljZTogKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXJcbiAgaW1wbGVtZW50cyBQcmV2aWV3Q29tbWFuZENvbnRyb2xsZXJcbntcbiAgcHVibGljIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZGVwczogUHJldmlld0NvbW1hbmRDb250cm9sbGVyRGVwcykge31cblxuICBwdWJsaWMgaXNDb21tYW5kQXZhaWxhYmxlKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHRhcmdldFJlc3VsdCA9IHRoaXMuZGVwcy5yZXNvbHZlci5yZXNvbHZlVGFyZ2V0Rm9yQ29tbWFuZCgpO1xuICAgIHJldHVybiB0YXJnZXRSZXN1bHQub2s7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgcnVuRnJvbUN1cnJlbnRDb250ZXh0KCk6IFByb21pc2U8UHJldmlld0Zsb3dSZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5kZXBzLnN0YXRlR3VhcmQud2l0aExlYWZQcmVzZXJ2ZWQoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFyZ2V0UmVzdWx0ID0gdGhpcy5kZXBzLnJlc29sdmVyLnJlc29sdmVUYXJnZXRGb3JDb21tYW5kKCk7XG4gICAgICBpZiAoIXRhcmdldFJlc3VsdC5vaykge1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gXCJUeXBzdCBcdTMwRDVcdTMwQTFcdTMwQTRcdTMwRUJcdTMwNENcdTkwNzhcdTYyOUVcdTMwNTVcdTMwOENcdTMwNjZcdTMwNDRcdTMwN0VcdTMwNUJcdTMwOTNcdTMwMDJcdTczRkVcdTU3MjhcdTMwNkVcdTdERThcdTk2QzZcdTVCRkVcdThDNjFcdTMwOTJcdTc4QkFcdThBOERcdTMwNTdcdTMwNjZcdTMwNEZcdTMwNjBcdTMwNTVcdTMwNDRcdTMwMDJcIjtcbiAgICAgICAgdGhpcy5kZXBzLm9uTm90aWNlKG1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBjb25zdCBydW50aW1lUmVzdWx0OiBSdW50aW1lQ2hlY2tSZXN1bHQgPVxuICAgICAgICBhd2FpdCB0aGlzLmRlcHMucnVudGltZS5lbnN1cmVSdW50aW1lQXZhaWxhYmxlKFwidHlwc3RcIik7XG4gICAgICBpZiAoIXJ1bnRpbWVSZXN1bHQub2spIHtcbiAgICAgICAgY29uc3QgcnVudGltZUNhdGVnb3J5ID1cbiAgICAgICAgICBydW50aW1lUmVzdWx0LnJlYXNvbiA9PT0gXCJNSVNTSU5HX1JVTlRJTUVcIlxuICAgICAgICAgICAgPyBcIkRFUEVOREVOQ1lfTUlTU0lOR1wiXG4gICAgICAgICAgICA6IFwiUFJPQ0VTU19GQUlMRURfVE9fU1RBUlRcIjtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJlc2VudEZhaWx1cmUocnVudGltZUNhdGVnb3J5LCBcIlR5cHN0IENMSSBcdTMwNENcdTg5OEJcdTMwNjRcdTMwNEJcdTMwOEFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwMDJcIiwge1xuICAgICAgICAgIGNvbW1hbmQ6IFwidHlwc3RcIixcbiAgICAgICAgICByZWFzb246IHJ1bnRpbWVSZXN1bHQucmVhc29uLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXhlY3V0aW9uUmVzdWx0ID0gYXdhaXQgdGhpcy5kZXBzLmV4ZWN1dGlvbi5leGVjdXRlUHJldmlldyhcbiAgICAgICAgICB0YXJnZXRSZXN1bHQudGFyZ2V0LFxuICAgICAgICAgIHJ1bnRpbWVSZXN1bHQucmVzb2x2ZWRDb21tYW5kLFxuICAgICAgICApO1xuICAgICAgICBhd2FpdCB0aGlzLmRlcHMucHJlc2VudGVyLm9wZW5BcnRpZmFjdChleGVjdXRpb25SZXN1bHQuYXJ0aWZhY3RQYXRoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6IFwiUHJldmlldyBUeXBzdCBcdTMwOTJcdTk1OEJcdTMwNERcdTMwN0VcdTMwNTdcdTMwNUZcdTMwMDJcIixcbiAgICAgICAgICBhcnRpZmFjdFBhdGg6IGV4ZWN1dGlvblJlc3VsdC5hcnRpZmFjdFBhdGgsXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBmYWxsYmFja01lc3NhZ2UgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwidW5rbm93blwiO1xuICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHRoaXMuZGVwcy5mYWlsdXJlUG9saWN5LmNsYXNzaWZ5KGVycm9yLCBmYWxsYmFja01lc3NhZ2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnByZXNlbnRGYWlsdXJlKGNhdGVnb3J5LCBmYWxsYmFja01lc3NhZ2UsIHtcbiAgICAgICAgICBjb21tYW5kOiBydW50aW1lUmVzdWx0LnJlc29sdmVkQ29tbWFuZCxcbiAgICAgICAgICBwYXRoOiB0YXJnZXRSZXN1bHQudGFyZ2V0LmZpbGVQYXRoLFxuICAgICAgICAgIHJlYXNvbjogZmFsbGJhY2tNZXNzYWdlLFxuICAgICAgICB9LFxuICAgICAgICBlcnJvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHByZXNlbnRGYWlsdXJlKFxuICAgIGNhdGVnb3J5OiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5LFxuICAgIGZhbGxiYWNrTWVzc2FnZTogc3RyaW5nLFxuICAgIGNvbnRleHQ6IHtcbiAgICAgIGNvbW1hbmQ/OiBzdHJpbmc7XG4gICAgICBwYXRoPzogc3RyaW5nO1xuICAgICAgcmVhc29uPzogc3RyaW5nO1xuICAgIH0sXG4gICAgZXJyb3I/OiB1bmtub3duLFxuICApOiBQcmV2aWV3Rmxvd1Jlc3VsdCB7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuZGVwcy5mYWlsdXJlUG9saWN5LmdldE5vdGljZU1lc3NhZ2UoY2F0ZWdvcnksIGNvbnRleHQpO1xuICAgIGNvbnN0IGxvZ0NvbnRleHQgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBjYXRlZ29yeSxcbiAgICAgIG1lc3NhZ2U6IGZhbGxiYWNrTWVzc2FnZSxcbiAgICAgIHJlYXNvbjogY29udGV4dC5yZWFzb24sXG4gICAgfSk7XG5cbiAgICBjb25zb2xlLndhcm4oXCJbdHlwc2lkaWFuXSBwcmV2aWV3IGZhaWxlZFwiLCBsb2dDb250ZXh0KTtcbiAgICB0aGlzLmRlcHMub25Ob3RpY2UobWVzc2FnZSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgb2s6IGZhbHNlLFxuICAgICAgbWVzc2FnZSxcbiAgICB9O1xuICB9XG59XG4iLCAiaW1wb3J0IHtcbiAgUHJldmlld0ZpbGVMaWtlLFxuICBQcmV2aWV3UmVzb2x2ZUVycm9yLFxuICBQcmV2aWV3UmVzb2x2ZVJlc3VsdCxcbiAgVFlQX0ZJTEVfRVhURU5TSU9OLFxufSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxudHlwZSBBY3RpdmVGaWxlUHJvdmlkZXIgPSAoKSA9PiBQcmV2aWV3RmlsZUxpa2UgfCBudWxsO1xuXG5leHBvcnQgY2xhc3MgUHJldmlld0NvbnRleHRSZXNvbHZlciB7XG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGdldEFjdGl2ZUZpbGU6IEFjdGl2ZUZpbGVQcm92aWRlcikge31cblxuICBwdWJsaWMgcmVzb2x2ZVRhcmdldEZvckNvbW1hbmQoKTogUHJldmlld1Jlc29sdmVSZXN1bHQge1xuICAgIGNvbnN0IGFjdGl2ZUZpbGUgPSB0aGlzLmdldEFjdGl2ZUZpbGUoKTtcblxuICAgIGlmICghYWN0aXZlRmlsZSB8fCAhdGhpcy5pc1R5cEZpbGUoYWN0aXZlRmlsZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLmZhaWwoXCJOT19BQ1RJVkVfVEFSR0VUXCIpO1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVOYW1lID0gdGhpcy5nZXRGaWxlTmFtZShhY3RpdmVGaWxlLnBhdGgpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG9rOiB0cnVlLFxuICAgICAgdGFyZ2V0OiB7XG4gICAgICAgIGZpbGVQYXRoOiBhY3RpdmVGaWxlLnBhdGgsXG4gICAgICAgIGRpc3BsYXlOYW1lOiBmaWxlTmFtZSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgaXNUeXBGaWxlKGZpbGU6IFByZXZpZXdGaWxlTGlrZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmaWxlLmV4dGVuc2lvbi50b0xvd2VyQ2FzZSgpID09PSBUWVBfRklMRV9FWFRFTlNJT047XG4gIH1cblxuICBwcml2YXRlIGdldEZpbGVOYW1lKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgaW5kZXggPSBwYXRoLmxhc3RJbmRleE9mKFwiL1wiKTtcbiAgICBpZiAoaW5kZXggPT09IC0xKSB7XG4gICAgICByZXR1cm4gcGF0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gcGF0aC5zbGljZShpbmRleCArIDEpO1xuICB9XG5cbiAgcHJpdmF0ZSBmYWlsKHJlYXNvbjogUHJldmlld1Jlc29sdmVFcnJvcik6IHsgb2s6IGZhbHNlOyByZWFzb246IFByZXZpZXdSZXNvbHZlRXJyb3IgfSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZWFzb24gfTtcbiAgfVxufVxuIiwgImltcG9ydCB7IFJ1bnRpbWVDaGVja1Jlc3VsdCB9IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJ1bnRpbWVWZXJpZmllciB7XG4gIHZlcmlmeShjb21tYW5kTmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPjtcbn1cblxuZXhwb3J0IGNsYXNzIFByZXJlcXVpc2l0ZURpc2NvdmVyeVNlcnZpY2Uge1xuICBwdWJsaWMgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB2ZXJpZmllcjogUnVudGltZVZlcmlmaWVyKSB7fVxuXG4gIHB1YmxpYyBhc3luYyBlbnN1cmVSdW50aW1lQXZhaWxhYmxlKGNvbW1hbmROYW1lOiBzdHJpbmcpOiBQcm9taXNlPFJ1bnRpbWVDaGVja1Jlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBhdmFpbGFibGUgPSBhd2FpdCB0aGlzLnZlcmlmaWVyLnZlcmlmeShjb21tYW5kTmFtZSk7XG4gICAgICBpZiAoIWF2YWlsYWJsZSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICByZWFzb246IFwiTUlTU0lOR19SVU5USU1FXCIsXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiB0cnVlLFxuICAgICAgICByZXNvbHZlZENvbW1hbmQ6IGNvbW1hbmROYW1lLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICByZWFzb246IHRoaXMuY2xhc3NpZnlFcnJvcihlcnJvciksXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHB1YmxpYyByZXNldFJ1bnRpbWVDYWNoZSgpOiB2b2lkIHtcbiAgfVxuXG4gIHByaXZhdGUgY2xhc3NpZnlFcnJvcihlcnJvcjogdW5rbm93bik6IFwiTUlTU0lOR19SVU5USU1FXCIgfCBcIklOVkFMSURfUEFUSFwiIHtcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICBcImNvZGVcIiBpbiBlcnJvciAmJlxuICAgICAgZXJyb3IuY29kZSA9PT0gXCJFTk9FTlRcIlxuICAgICkge1xuICAgICAgcmV0dXJuIFwiTUlTU0lOR19SVU5USU1FXCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiSU5WQUxJRF9QQVRIXCI7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5IH0gZnJvbSBcIi4vY29udHJhY3RzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmFpbHVyZUNhdGVnb3J5Q29udGV4dCB7XG4gIGNvbW1hbmQ/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG4gIHJlYXNvbj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3RmFpbHVyZVBvbGljeUNvbnRyYWN0IHtcbiAgY2xhc3NpZnkoZXJyb3I6IHVua25vd24sIGZhbGxiYWNrTWVzc2FnZTogc3RyaW5nKTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeTtcbiAgZ2V0Tm90aWNlTWVzc2FnZShjYXRlZ29yeTogUHJldmlld0ZhaWx1cmVDYXRlZ29yeSwgY29udGV4dDogRmFpbHVyZUNhdGVnb3J5Q29udGV4dCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFByZXZpZXdGYWlsdXJlUG9saWN5IGltcGxlbWVudHMgUHJldmlld0ZhaWx1cmVQb2xpY3lDb250cmFjdCB7XG4gIHB1YmxpYyBjbGFzc2lmeShlcnJvcjogdW5rbm93biwgZmFsbGJhY2tNZXNzYWdlOiBzdHJpbmcpOiBQcmV2aWV3RmFpbHVyZUNhdGVnb3J5IHtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5leHRyYWN0TWVzc2FnZShlcnJvcik7XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICBcImNvZGVcIiBpbiBlcnJvciAmJlxuICAgICAgZXJyb3IuY29kZSA9PT0gXCJFTk9FTlRcIlxuICAgICkge1xuICAgICAgcmV0dXJuIFwiREVQRU5ERU5DWV9NSVNTSU5HXCI7XG4gICAgfVxuXG4gICAgaWYgKG1lc3NhZ2UuaW5jbHVkZXMoXCJ0aW1lb3V0XCIpKSB7XG4gICAgICByZXR1cm4gXCJQUk9DRVNTX1RJTUVPVVRcIjtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZXJyb3IgPT09IFwib2JqZWN0XCIgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICBcImV4aXRDb2RlXCIgaW4gZXJyb3IgJiZcbiAgICAgIChlcnJvciBhcyB7IGV4aXRDb2RlOiBudW1iZXIgfCBudWxsIH0pLmV4aXRDb2RlICE9PSAwXG4gICAgKSB7XG4gICAgICByZXR1cm4gXCJQUk9DRVNTX0VYSVRfRVJST1JcIjtcbiAgICB9XG5cbiAgICBpZiAoZmFsbGJhY2tNZXNzYWdlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoXCJ0aW1lb3V0XCIpKSB7XG4gICAgICByZXR1cm4gXCJQUk9DRVNTX1RJTUVPVVRcIjtcbiAgICB9XG5cbiAgICBpZiAoZmFsbGJhY2tNZXNzYWdlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoXCJhcnRpZmFjdFwiKSkge1xuICAgICAgcmV0dXJuIFwiQVJUSUZBQ1RfTk9UX0ZPVU5EXCI7XG4gICAgfVxuXG4gICAgaWYgKGZhbGxiYWNrTWVzc2FnZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKFwib3BlblwiKSkge1xuICAgICAgcmV0dXJuIFwiQVJUSUZBQ1RfT1BFTl9GQUlMRURcIjtcbiAgICB9XG5cbiAgICByZXR1cm4gXCJQUk9DRVNTX0ZBSUxFRF9UT19TVEFSVFwiO1xuICB9XG5cbiAgcHVibGljIGdldE5vdGljZU1lc3NhZ2UoXG4gICAgY2F0ZWdvcnk6IFByZXZpZXdGYWlsdXJlQ2F0ZWdvcnksXG4gICAgY29udGV4dDogRmFpbHVyZUNhdGVnb3J5Q29udGV4dCxcbiAgKTogc3RyaW5nIHtcbiAgICBzd2l0Y2ggKGNhdGVnb3J5KSB7XG4gICAgICBjYXNlIFwiREVQRU5ERU5DWV9NSVNTSU5HXCI6XG4gICAgICAgIHJldHVybiBcIlR5cHN0IENMSSBcdTMwNENcdTg5OEJcdTMwNjRcdTMwNEJcdTMwOEFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwMDJgdHlwc3RgIFx1MzA0QyBQQVRIIFx1MzA0Qlx1MzA4OVx1NUI5Rlx1ODg0Q1x1MzA2N1x1MzA0RFx1MzA4Qlx1MzA0Qlx1NzhCQVx1OEE4RFx1MzA1N1x1MzA2Nlx1MzA0Rlx1MzA2MFx1MzA1NVx1MzA0NFx1MzAwMlwiO1xuICAgICAgY2FzZSBcIlBST0NFU1NfVElNRU9VVFwiOlxuICAgICAgICByZXR1cm4gXCJUeXBzdCBDTEkgXHUzMDZFXHU1QjlGXHU4ODRDXHUzMDRDXHUzMEJGXHUzMEE0XHUzMEUwXHUzMEEyXHUzMEE2XHUzMEM4XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGXHUzMDAyXHU1MTY1XHU1MjlCXHU1MTg1XHU1QkI5XHUzMDkyXHU3OEJBXHU4QThEXHUzMDU3XHUzMDY2XHU1MThEXHU1QjlGXHU4ODRDXHUzMDU3XHUzMDY2XHUzMDRGXHUzMDYwXHUzMDU1XHUzMDQ0XHUzMDAyXCI7XG4gICAgICBjYXNlIFwiUFJPQ0VTU19FWElUX0VSUk9SXCI6XG4gICAgICAgIHJldHVybiBgVHlwc3QgQ0xJIFx1MzA0QyAke2NvbnRleHQuY29tbWFuZCA/PyBcIlx1MzBCM1x1MzBERVx1MzBGM1x1MzBDOVwifSBcdTMwNjdcdTU5MzFcdTY1NTdcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUZcdTMwMDJgO1xuICAgICAgY2FzZSBcIkFSVElGQUNUX05PVF9GT1VORFwiOlxuICAgICAgICByZXR1cm4gYFBERiBcdTYyMTBcdTY3OUNcdTcyNjlcdTMwNENcdTc1MUZcdTYyMTBcdTMwNTVcdTMwOENcdTMwN0VcdTMwNUJcdTMwOTNcdTMwNjdcdTMwNTdcdTMwNUY6ICR7Y29udGV4dC5wYXRoID8/IFwiXHU0RTBEXHU2NjBFXCJ9YDtcbiAgICAgIGNhc2UgXCJBUlRJRkFDVF9PUEVOX0ZBSUxFRFwiOlxuICAgICAgICByZXR1cm4gYFBERiBcdTMwOTJcdTk1OEJcdTMwNTFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwNjdcdTMwNTdcdTMwNUY6ICR7Y29udGV4dC5wYXRoID8/IFwiXHU0RTBEXHU2NjBFXCJ9YDtcbiAgICAgIGNhc2UgXCJQUk9DRVNTX0ZBSUxFRF9UT19TVEFSVFwiOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIFwiXHUzMEQ3XHUzMEVDXHUzMEQzXHUzMEU1XHUzMEZDXHU1QjlGXHU4ODRDXHUzMDkyXHU5NThCXHU1OUNCXHUzMDY3XHUzMDREXHUzMDdFXHUzMDVCXHUzMDkzXHUzMDY3XHUzMDU3XHUzMDVGXHUzMDAyXCI7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBleHRyYWN0TWVzc2FnZShlcnJvcjogdW5rbm93bik6IHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiBlcnJvciA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgcmV0dXJuIGVycm9yLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgIHJldHVybiBlcnJvci5tZXNzYWdlLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBDaGlsZFByb2Nlc3MsIFNwYXduT3B0aW9ucywgc3Bhd24gfSBmcm9tIFwibm9kZTpjaGlsZF9wcm9jZXNzXCI7XG5cbmltcG9ydCB7IFByb2Nlc3NSdW5SZXN1bHQgfSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcm9jZXNzUnVuT3B0aW9ucyB7XG4gIGN3ZD86IHN0cmluZztcbiAgZW52PzogTm9kZUpTLlByb2Nlc3NFbnY7XG4gIHRpbWVvdXRNcz86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHRlcm5hbENsaVJ1bm5lciB7XG4gIHJ1bldpdGhBcmdzKFxuICAgIGNvbW1hbmQ6IHN0cmluZyxcbiAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PjtcbiAgcnVuQ29tbWFuZFN0cmluZyhcbiAgICBjb21tYW5kTGluZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+O1xufVxuXG5leHBvcnQgY2xhc3MgTm9kZUV4dGVybmFsQ2xpUnVubmVyIGltcGxlbWVudHMgRXh0ZXJuYWxDbGlSdW5uZXIge1xuICBwdWJsaWMgYXN5bmMgcnVuV2l0aEFyZ3MoXG4gICAgY29tbWFuZDogc3RyaW5nLFxuICAgIGFyZ3M6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5ydW5Qcm9jZXNzKGNvbW1hbmQsIGFyZ3MsIG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIHJ1bkNvbW1hbmRTdHJpbmcoXG4gICAgY29tbWFuZExpbmU6IHN0cmluZyxcbiAgICBvcHRpb25zOiBQcm9jZXNzUnVuT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PiB7XG4gICAgY29uc3QgaXNXaW5kb3dzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gXCJ3aW4zMlwiO1xuICAgIHJldHVybiB0aGlzLnJ1blByb2Nlc3MoaXNXaW5kb3dzID8gXCJjbWRcIiA6IFwic2hcIiwgW2lzV2luZG93cyA/IFwiL2NcIiA6IFwiLWNcIiwgY29tbWFuZExpbmVdLCBvcHRpb25zKTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcnVuUHJvY2VzcyhcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgc2V0dGxlZCA9IGZhbHNlO1xuXG4gICAgICBjb25zdCBwcm9jZXNzT3B0aW9uczogU3Bhd25PcHRpb25zID0ge1xuICAgICAgICBjd2Q6IG9wdGlvbnMuY3dkLFxuICAgICAgICBlbnY6IG9wdGlvbnMuZW52LFxuICAgICAgfTtcblxuICAgICAgbGV0IGNoaWxkOiBDaGlsZFByb2Nlc3M7XG4gICAgICB0cnkge1xuICAgICAgICBjaGlsZCA9IHNwYXduKGNvbW1hbmQsIGFyZ3MsIHtcbiAgICAgICAgICAuLi5wcm9jZXNzT3B0aW9ucyxcbiAgICAgICAgICBzdGRpbzogW1wiaWdub3JlXCIsIFwicGlwZVwiLCBcInBpcGVcIl0sXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsZXQgc3Rkb3V0ID0gXCJcIjtcbiAgICAgIGxldCBzdGRlcnIgPSBcIlwiO1xuXG4gICAgICBjaGlsZC5zdGRvdXQ/LnNldEVuY29kaW5nKFwidXRmOFwiKTtcbiAgICAgIGNoaWxkLnN0ZGVycj8uc2V0RW5jb2RpbmcoXCJ1dGY4XCIpO1xuICAgICAgY2hpbGQuc3Rkb3V0Py5vbihcImRhdGFcIiwgKGNodW5rKSA9PiB7XG4gICAgICAgIHN0ZG91dCArPSBTdHJpbmcoY2h1bmspO1xuICAgICAgfSk7XG4gICAgICBjaGlsZC5zdGRlcnI/Lm9uKFwiZGF0YVwiLCAoY2h1bmspID0+IHtcbiAgICAgICAgc3RkZXJyICs9IFN0cmluZyhjaHVuayk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgdGltZW91dE1zID0gb3B0aW9ucy50aW1lb3V0TXM7XG4gICAgICBsZXQgdGltZW91dElkOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0eXBlb2YgdGltZW91dE1zID09PSBcIm51bWJlclwiICYmIHRpbWVvdXRNcyA+IDApIHtcbiAgICAgICAgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgaWYgKHNldHRsZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcbiAgICAgICAgICB2b2lkIGNoaWxkLmtpbGwoKTtcbiAgICAgICAgICByZXNvbHZlKHtcbiAgICAgICAgICAgIGV4aXRDb2RlOiBudWxsLFxuICAgICAgICAgICAgc3Rkb3V0LFxuICAgICAgICAgICAgc3RkZXJyOiBgJHtzdGRlcnJ9XFxucHJvY2VzcyB0aW1lb3V0IGFmdGVyICR7dGltZW91dE1zfW1zYCxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSwgdGltZW91dE1zKTtcbiAgICAgIH1cblxuICAgICAgY2hpbGQub24oXCJlcnJvclwiLCAoZXJyb3IpID0+IHtcbiAgICAgICAgaWYgKHNldHRsZWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRpbWVvdXRJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH0pO1xuXG4gICAgICBjaGlsZC5vbihcImNsb3NlXCIsIChjb2RlKSA9PiB7XG4gICAgICAgIGlmIChzZXR0bGVkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0dGxlZCA9IHRydWU7XG4gICAgICAgIGlmICh0aW1lb3V0SWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgZXhpdENvZGU6IGNvZGUsXG4gICAgICAgICAgc3Rkb3V0LFxuICAgICAgICAgIHN0ZGVycixcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTW9ja0V4dGVybmFsQ2xpUnVubmVyIGltcGxlbWVudHMgRXh0ZXJuYWxDbGlSdW5uZXIge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBoYW5kbGVyOiAoXG4gICAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgICBhcmdzOiBzdHJpbmdbXSxcbiAgICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICAgICkgPT4gUHJvbWlzZTxQcm9jZXNzUnVuUmVzdWx0PixcbiAgKSB7fVxuXG4gIHB1YmxpYyBydW5XaXRoQXJncyhcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICAgYXJnczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogUHJvY2Vzc1J1bk9wdGlvbnMsXG4gICk6IFByb21pc2U8UHJvY2Vzc1J1blJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLmhhbmRsZXIoY29tbWFuZCwgYXJncywgb3B0aW9ucyk7XG4gIH1cblxuICBwdWJsaWMgcnVuQ29tbWFuZFN0cmluZyhcbiAgICBjb21tYW5kTGluZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zLFxuICApOiBQcm9taXNlPFByb2Nlc3NSdW5SZXN1bHQ+IHtcbiAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSBcIndpbjMyXCI7XG4gICAgcmV0dXJuIHRoaXMuaGFuZGxlcihpc1dpbmRvd3MgPyBcImNtZFwiIDogXCJzaFwiLCBbaXNXaW5kb3dzID8gXCIvY1wiIDogXCItY1wiLCBjb21tYW5kTGluZV0sIG9wdGlvbnMpO1xuICB9XG59XG4iLCAiZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3T3V0cHV0UHJlc2VudGVyQ29udHJhY3Qge1xuICBvcGVuQXJ0aWZhY3QocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbiAgcmV2ZWFsSW5Gb2xkZXIocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGNsYXNzIFByZXZpZXdPdXRwdXRQcmVzZW50ZXIgaW1wbGVtZW50cyBQcmV2aWV3T3V0cHV0UHJlc2VudGVyQ29udHJhY3Qge1xuICBwdWJsaWMgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBvcGVuUGF0aDogKHBhdGg6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmcgfCBudWxsPixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJldmVhbFBhdGg6IChwYXRoOiBzdHJpbmcpID0+IHZvaWQsXG4gICkge31cblxuICBwdWJsaWMgYXN5bmMgb3BlbkFydGlmYWN0KHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG9wZW5SZXN1bHQgPSBhd2FpdCB0aGlzLm9wZW5QYXRoKHBhdGgpO1xuICAgIGlmIChvcGVuUmVzdWx0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3Iob3BlblJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIGFzeW5jIHJldmVhbEluRm9sZGVyKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMucmV2ZWFsUGF0aChwYXRoKTtcbiAgfVxufVxuIiwgImltcG9ydCB7IGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmltcG9ydCB7XG4gIFByZXZpZXdFeGVjdXRpb25SZXN1bHQsXG4gIFByZXZpZXdUYXJnZXQsXG59IGZyb20gXCIuL2NvbnRyYWN0c1wiO1xuaW1wb3J0IHtcbiAgRXh0ZXJuYWxDbGlSdW5uZXIsXG4gIFByb2Nlc3NSdW5PcHRpb25zLFxufSBmcm9tIFwiLi9leHRlcm5hbENsaVJ1bm5lclwiO1xuaW1wb3J0IHsgUHJldmlld091dHB1dFB1Ymxpc2hlciB9IGZyb20gXCIuL3ByZXZpZXdPdXRwdXRQdWJsaXNoZXJcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3RXhlY3V0aW9uU2VydmljZSB7XG4gIGV4ZWN1dGVQcmV2aWV3KHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxQcmV2aWV3RXhlY3V0aW9uUmVzdWx0Pjtcbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRQcmV2aWV3RXhlY3V0aW9uU2VydmljZSBpbXBsZW1lbnRzIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcnVubmVyOiBFeHRlcm5hbENsaVJ1bm5lcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHB1Ymxpc2hlcjogUHJldmlld091dHB1dFB1Ymxpc2hlcixcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJ1bk9wdGlvbnM6IFByb2Nlc3NSdW5PcHRpb25zID0geyB0aW1lb3V0TXM6IDEwMDAwMCB9LFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWN1dGVQcmV2aWV3KFxuICAgIHRhcmdldDogUHJldmlld1RhcmdldCxcbiAgICBjb21tYW5kOiBzdHJpbmcsXG4gICk6IFByb21pc2U8UHJldmlld0V4ZWN1dGlvblJlc3VsdD4ge1xuICAgIGNvbnN0IGFydGlmYWN0UGF0aCA9IHRoaXMucHVibGlzaGVyLmNvbXB1dGVPdXRwdXRQYXRoKHRhcmdldCk7XG5cbiAgICBjb25zdCBydW5SZXN1bHQgPSBhd2FpdCB0aGlzLnJ1bm5lci5ydW5XaXRoQXJncyhcbiAgICAgIGNvbW1hbmQsXG4gICAgICBbXCJjb21waWxlXCIsIHRhcmdldC5maWxlUGF0aCwgYXJ0aWZhY3RQYXRoXSxcbiAgICAgIHRoaXMucnVuT3B0aW9ucyxcbiAgICApO1xuXG4gICAgaWYgKHJ1blJlc3VsdC5leGl0Q29kZSAhPT0gMCkge1xuICAgICAgdGhyb3cgT2JqZWN0LmFzc2lnbihuZXcgRXJyb3IocnVuUmVzdWx0LnN0ZGVyciB8fCBcInByZXZpZXcgY29tbWFuZCBmYWlsZWRcIiksIHtcbiAgICAgICAgZXhpdENvZGU6IHJ1blJlc3VsdC5leGl0Q29kZSxcbiAgICAgICAgc3Rkb3V0OiBydW5SZXN1bHQuc3Rkb3V0LFxuICAgICAgICBzdGRlcnI6IHJ1blJlc3VsdC5zdGRlcnIsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdHMgPSBhd2FpdCB0aGlzLnB1Ymxpc2hlci5lbnN1cmVBcnRpZmFjdEV4aXN0cyhhcnRpZmFjdFBhdGgpO1xuICAgIGlmICghZXhpc3RzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGFydGlmYWN0IG5vdCBmb3VuZDogJHthcnRpZmFjdFBhdGh9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFydGlmYWN0UGF0aCxcbiAgICAgIGRldGVybWluaXN0aWNLZXk6IGFydGlmYWN0UGF0aCxcbiAgICAgIGNvbW1hbmRSdW5BdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgcHJvY2Vzc1J1bjogcnVuUmVzdWx0LFxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0dWJQcmV2aWV3RXhlY3V0aW9uU2VydmljZSBpbXBsZW1lbnRzIFByZXZpZXdFeGVjdXRpb25TZXJ2aWNlIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc2ltdWxhdGU6ICh0YXJnZXQ6IFByZXZpZXdUYXJnZXQsIGNvbW1hbmQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiA9IGFzeW5jICgpID0+IHtcbiAgICAgIHJldHVybjtcbiAgICB9LFxuICApIHt9XG5cbiAgcHVibGljIGFzeW5jIGV4ZWN1dGVQcmV2aWV3KHRhcmdldDogUHJldmlld1RhcmdldCwgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxQcmV2aWV3RXhlY3V0aW9uUmVzdWx0PiB7XG4gICAgYXdhaXQgdGhpcy5zaW11bGF0ZSh0YXJnZXQsIGNvbW1hbmQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFydGlmYWN0UGF0aDogam9pbih0YXJnZXQuZmlsZVBhdGgsIFwiLi5cIiwgXCJwcmV2aWV3LnBkZlwiKSxcbiAgICAgIGRldGVybWluaXN0aWNLZXk6IHRhcmdldC5maWxlUGF0aCxcbiAgICAgIGNvbW1hbmRSdW5BdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgcHJvY2Vzc1J1bjoge1xuICAgICAgICBleGl0Q29kZTogMCxcbiAgICAgICAgc3Rkb3V0OiBcIlwiLFxuICAgICAgICBzdGRlcnI6IFwiXCIsXG4gICAgICB9LFxuICAgIH07XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBhY2Nlc3MgfSBmcm9tIFwibm9kZTpmcy9wcm9taXNlc1wiO1xuaW1wb3J0IHsgZGlybmFtZSwgZXh0bmFtZSwgYmFzZW5hbWUsIGpvaW4gfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5cbmltcG9ydCB7IFByZXZpZXdUYXJnZXQgfSBmcm9tIFwiLi9jb250cmFjdHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBQcmV2aWV3T3V0cHV0UHVibGlzaENvbnRyYWN0IHtcbiAgY29tcHV0ZU91dHB1dFBhdGgodGFyZ2V0OiBQcmV2aWV3VGFyZ2V0KTogc3RyaW5nO1xuICBlbnN1cmVBcnRpZmFjdEV4aXN0cyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+O1xufVxuXG5leHBvcnQgY2xhc3MgUHJldmlld091dHB1dFB1Ymxpc2hlciBpbXBsZW1lbnRzIFByZXZpZXdPdXRwdXRQdWJsaXNoQ29udHJhY3Qge1xuICBwdWJsaWMgY29tcHV0ZU91dHB1dFBhdGgodGFyZ2V0OiBQcmV2aWV3VGFyZ2V0KTogc3RyaW5nIHtcbiAgICBjb25zdCByb290ID0gZGlybmFtZSh0YXJnZXQuZmlsZVBhdGgpO1xuICAgIGNvbnN0IG5hbWUgPSBiYXNlbmFtZSh0YXJnZXQuZmlsZVBhdGgpO1xuICAgIGNvbnN0IHN0ZW0gPSBuYW1lLnNsaWNlKDAsIG5hbWUubGVuZ3RoIC0gZXh0bmFtZShuYW1lKS5sZW5ndGgpO1xuXG4gICAgcmV0dXJuIGpvaW4ocm9vdCwgYCR7c3RlbX0ucGRmYCk7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgZW5zdXJlQXJ0aWZhY3RFeGlzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFjY2VzcyhwYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IFdvcmtzcGFjZUxlYWYgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBQbHVnaW5TdGF0ZUd1YXJkQ29udHJhY3Qge1xuICB3aXRoTGVhZlByZXNlcnZlZDxUPihhY3Rpb246ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+O1xuICByZXN0b3JlQWN0aXZlTGVhZklmTmVlZGVkKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBQbHVnaW5TdGF0ZUd1YXJkIGltcGxlbWVudHMgUGx1Z2luU3RhdGVHdWFyZENvbnRyYWN0IHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY3VycmVudExlYWZQcm92aWRlcjogKCkgPT4gV29ya3NwYWNlTGVhZiB8IG51bGwsXG4gICAgcHJpdmF0ZSByZWFkb25seSByZXN0b3JlTGVhZjogKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKSA9PiB2b2lkLFxuICApIHt9XG5cbiAgcHJpdmF0ZSBsZWFmVG9SZXN0b3JlOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCA9IG51bGw7XG5cbiAgcHVibGljIGFzeW5jIHdpdGhMZWFmUHJlc2VydmVkPFQ+KGFjdGlvbjogKCkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuICAgIGNvbnN0IHByZXZpb3VzTGVhZiA9IHRoaXMuY3VycmVudExlYWZQcm92aWRlcigpO1xuICAgIHRoaXMubGVhZlRvUmVzdG9yZSA9IHByZXZpb3VzTGVhZjtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGFjdGlvbigpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLnJlc3RvcmVBY3RpdmVMZWFmSWZOZWVkZWQoKTtcbiAgICAgIHRoaXMubGVhZlRvUmVzdG9yZSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHJlc3RvcmVBY3RpdmVMZWFmSWZOZWVkZWQoKTogdm9pZCB7XG4gICAgdGhpcy5yZXN0b3JlSWZDaGFuZ2VkKHRoaXMubGVhZlRvUmVzdG9yZSk7XG4gIH1cblxuICBwcml2YXRlIHJlc3RvcmVJZkNoYW5nZWQoZXhwZWN0ZWRMZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmIChleHBlY3RlZExlYWYgIT09IHRoaXMuY3VycmVudExlYWZQcm92aWRlcigpKSB7XG4gICAgICB0aGlzLnJlc3RvcmVMZWFmKGV4cGVjdGVkTGVhZik7XG4gICAgfVxuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQVNPO0FBQ1AsSUFBQUEsNkJBQW9DO0FBQ3BDLElBQUFDLG9CQUFxQjs7O0FDWGQsSUFBTSxxQkFBcUI7QUFDM0IsSUFBTSx1QkFBdUI7QUFDN0IsSUFB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Q0FBZ0IsS0FBSyxLQUFLLE1BQU0sU0FBUztBQUFBLElBQ2hFLEtBQ0Y7QUFBQSxFQUVKO0FBQUEsRUFFUSxvQkFBb0IsQ0FBQyxTQUE4QjtBQUN6RCxRQUFJLENBQUMsS0FBSyxVQUFVLElBQUksR0FBRztBQUN6QjtBQUFBLElBQ0Y7QUFFQSxTQUFLLGFBQWEsVUFBVSxJQUFJO0FBQUEsRUFDbEM7QUFBQSxFQUVRLG9CQUFvQixDQUFDLE1BQXFCLFlBQTBCO0FBQzFFLFFBQUksQ0FBQyxLQUFLLFVBQVUsSUFBSSxHQUFHO0FBQ3pCO0FBQUEsSUFDRjtBQUVBLFNBQUssYUFBYSxVQUFVLE1BQU0sT0FBTztBQUFBLEVBQzNDO0FBQUEsRUFFUSxvQkFBb0IsQ0FBQyxTQUE4QjtBQUN6RCxRQUFJLENBQUMsS0FBSyxVQUFVLElBQUksR0FBRztBQUN6QjtBQUFBLElBQ0Y7QUFFQSxTQUFLLGFBQWEsVUFBVSxJQUFJO0FBQUEsRUFDbEM7QUFBQSxFQUVRLG9CQUFvQixNQUFzQjtBQUNoRCxXQUFPLEtBQUssSUFBSSxNQUFNLHNCQUFzQixLQUFLLElBQUksYUFBYTtBQUFBLEVBQ3BFO0FBQUEsRUFFUSxrQkFBa0IsTUFBa0M7QUFDMUQsUUFBSSxDQUFDLE1BQU07QUFDVDtBQUFBLElBQ0Y7QUFFQSxVQUFNLGFBQWEsS0FBSztBQUN4QixRQUFJLGVBQWUsTUFBTTtBQUN2QjtBQUFBLElBQ0Y7QUFFQSxTQUFLLElBQUksVUFBVSxjQUFjLE1BQU0sRUFBRSxPQUFPLEtBQUssQ0FBQztBQUFBLEVBQ3hEO0FBQUEsRUFFUSxhQUNOLFdBQ0EsTUFDQSxTQUNNO0FBQ04sUUFBSSxTQUFTO0FBQ1gsY0FBUSxLQUFLLGVBQWUsU0FBUyxLQUFLLE9BQU8sT0FBTyxLQUFLLElBQUksRUFBRTtBQUNuRTtBQUFBLElBQ0Y7QUFFQSxZQUFRLEtBQUssZUFBZSxTQUFTLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFBQSxFQUN2RDtBQUFBLEVBRVEsa0JBQXdCO0FBQzlCLFlBQVE7QUFBQSxNQUNOO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUVRLFNBQVMsWUFBb0IsVUFBMEI7QUFDN0QsUUFBSSxDQUFDLFlBQVk7QUFDZixhQUFPO0FBQUEsSUFDVDtBQUVBLFdBQU8sR0FBRyxVQUFVLElBQUksUUFBUTtBQUFBLEVBQ2xDO0FBQUEsRUFFQSxXQUFpQjtBQUNmLFlBQVEsS0FBSyw2QkFBNkI7QUFBQSxFQUM1QztBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfbm9kZV9jaGlsZF9wcm9jZXNzIiwgImltcG9ydF9ub2RlX3BhdGgiLCAiaW1wb3J0X25vZGVfcGF0aCJdCn0K
