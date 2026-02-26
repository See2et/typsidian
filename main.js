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
      this.logStartupState();
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange)
    );
    this.registerEvent(
      this.app.workspace.on("file-open", this.handleFileOpen)
    );
    this.addRibbonIcon("sigma", "Typsidian: Debug ping", () => {
      new import_obsidian.Notice("Typsidian loaded in debug vault");
    });
    this.addCommand({
      id: "typsidian-dev-ping",
      name: "Typsidian: Debug ping",
      callback: () => {
        new import_obsidian.Notice("Typsidian command OK");
      }
    });
    console.info("[typsidian] plugin loaded");
  }
  handleFileOpen = (file) => {
    if (!file || !this.isTypFile(file)) {
      return;
    }
    if (!this.isTypFileAccessible(file)) {
      this.restoreActiveLeaf(this.previousActiveLeaf);
      new import_obsidian.Notice(
        ".typ \u30D5\u30A1\u30A4\u30EB\u3092\u958B\u3051\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30D5\u30A1\u30A4\u30EB\u3092\u958B\u5C01\u3067\u304D\u308B\u72B6\u614B\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044"
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
    return file instanceof import_obsidian.TFile && file.extension === TYP_EXTENSION;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIE1hcmtkb3duVmlldyxcbiAgTWVudSxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFRBYnN0cmFjdEZpbGUsXG4gIFRGaWxlLFxuICBURm9sZGVyLFxuICBXb3Jrc3BhY2VMZWFmLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcblxuY29uc3QgVFlQX0VYVEVOU0lPTiA9IFwidHlwXCI7XG5jb25zdCBUWVBfVklFVyA9IFwibWFya2Rvd25cIjtcbmNvbnN0IE5FV19UWVBfTkFNRSA9IFwiVW50aXRsZWRcIjtcbmNvbnN0IE5FV19UWVBfRVhUID0gYC4ke1RZUF9FWFRFTlNJT059YDtcbmNvbnN0IFRZUF9GSUxFX0VYVEVOU0lPTlMgPSBbVFlQX0VYVEVOU0lPTiwgXCJUeXBcIiwgXCJUWVBcIl0gYXMgY29uc3Q7XG5cbmludGVyZmFjZSBUeXBMaWZlY3ljbGVFdmVudFRhcmdldCB7XG4gIHBhdGg6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUeXBzaWRpYW5QbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIHByZXZpb3VzQWN0aXZlTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGN1cnJlbnRBY3RpdmVMZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCA9IG51bGw7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY3VycmVudEFjdGl2ZUxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMucmVnaXN0ZXJFeHRlbnNpb25zKEFycmF5LmZyb20oVFlQX0ZJTEVfRVhURU5TSU9OUyksIFRZUF9WSUVXKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpO1xuICAgICAgdGhpcy5yZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpO1xuICAgICAgdGhpcy5sb2dTdGFydHVwU3RhdGUoKTtcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCB0aGlzLmhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UpLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHRoaXMuaGFuZGxlRmlsZU9wZW4pLFxuICAgICk7XG5cbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJzaWdtYVwiLCBcIlR5cHNpZGlhbjogRGVidWcgcGluZ1wiLCAoKSA9PiB7XG4gICAgICBuZXcgTm90aWNlKFwiVHlwc2lkaWFuIGxvYWRlZCBpbiBkZWJ1ZyB2YXVsdFwiKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJ0eXBzaWRpYW4tZGV2LXBpbmdcIixcbiAgICAgIG5hbWU6IFwiVHlwc2lkaWFuOiBEZWJ1ZyBwaW5nXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICBuZXcgTm90aWNlKFwiVHlwc2lkaWFuIGNvbW1hbmQgT0tcIik7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5pbmZvKFwiW3R5cHNpZGlhbl0gcGx1Z2luIGxvYWRlZFwiKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFuZGxlRmlsZU9wZW4gPSAoZmlsZTogVEZpbGUgfCBudWxsKTogdm9pZCA9PiB7XG4gICAgaWYgKCFmaWxlIHx8ICF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5pc1R5cEZpbGVBY2Nlc3NpYmxlKGZpbGUpKSB7XG4gICAgICB0aGlzLnJlc3RvcmVBY3RpdmVMZWFmKHRoaXMucHJldmlvdXNBY3RpdmVMZWFmKTtcbiAgICAgIG5ldyBOb3RpY2UoXG4gICAgICAgIFwiLnR5cCBcdTMwRDVcdTMwQTFcdTMwQTRcdTMwRUJcdTMwOTJcdTk1OEJcdTMwNTFcdTMwN0VcdTMwNUJcdTMwOTNcdTMwNjdcdTMwNTdcdTMwNUZcdTMwMDJcdTMwRDVcdTMwQTFcdTMwQTRcdTMwRUJcdTMwOTJcdTk1OEJcdTVDMDFcdTMwNjdcdTMwNERcdTMwOEJcdTcyQjZcdTYxNEJcdTMwOTJcdTc4QkFcdThBOERcdTMwNTdcdTMwNjZcdTMwNEZcdTMwNjBcdTMwNTVcdTMwNDRcIixcbiAgICAgICk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZXhpc3RpbmdMZWFmID0gdGhpcy5nZXRMZWFmQnlUeXBGaWxlKGZpbGUucGF0aCk7XG5cbiAgICBpZiAoIWV4aXN0aW5nTGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjdGl2ZUxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcbiAgICBpZiAoYWN0aXZlTGVhZiA9PT0gZXhpc3RpbmdMZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnNldEFjdGl2ZUxlYWYoZXhpc3RpbmdMZWFmLCB7IGZvY3VzOiB0cnVlIH0pO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlQWN0aXZlTGVhZkNoYW5nZSA9IChsZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCk6IHZvaWQgPT4ge1xuICAgIGlmIChsZWFmID09PSB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wcmV2aW91c0FjdGl2ZUxlYWYgPSB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmO1xuICAgIHRoaXMuY3VycmVudEFjdGl2ZUxlYWYgPSBsZWFmO1xuICB9O1xuXG4gIHByaXZhdGUgcmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJjcmVhdGVcIiwgdGhpcy5oYW5kbGVWYXVsdENyZWF0ZSkpO1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcInJlbmFtZVwiLCB0aGlzLmhhbmRsZVZhdWx0UmVuYW1lKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKFwiZGVsZXRlXCIsIHRoaXMuaGFuZGxlVmF1bHREZWxldGUpKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVnaXN0ZXJUeXBDb250ZXh0TWVudUFjdGlvbnMoKTogdm9pZCB7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1tZW51XCIsIChtZW51OiBNZW51LCBmaWxlOiBUQWJzdHJhY3RGaWxlKSA9PiB7XG4gICAgICAgIHRoaXMuYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnUsIHRoaXMuZ2V0VGFyZ2V0Rm9sZGVyKGZpbGUpKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXG4gICAgICAgIFwiZmlsZXMtbWVudVwiLFxuICAgICAgICAobWVudTogTWVudSwgZmlsZXM6IFRBYnN0cmFjdEZpbGVbXSB8IG51bGwpID0+IHtcbiAgICAgICAgICBjb25zdCB0YXJnZXRGaWxlID0gZmlsZXM/LlswXTtcbiAgICAgICAgICB0aGlzLmFkZE5ld1R5cENvbnRleHRNZW51SXRlbShtZW51LCB0aGlzLmdldFRhcmdldEZvbGRlcih0YXJnZXRGaWxlKSk7XG4gICAgICAgIH0sXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGFkZE5ld1R5cENvbnRleHRNZW51SXRlbShtZW51OiBNZW51LCB0YXJnZXQ6IFRGb2xkZXIpOiB2b2lkIHtcbiAgICBtZW51LmFkZEl0ZW0oKGl0ZW0pID0+IHtcbiAgICAgIGl0ZW1cbiAgICAgICAgLnNldFRpdGxlKFwiTmV3IFR5cHN0XCIpXG4gICAgICAgIC5zZXRJY29uKFwibmV3LWZpbGVcIilcbiAgICAgICAgLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gYXdhaXQgdGhpcy5yZXNvbHZlVW5pcXVlVHlwRmlsZU5hbWUodGFyZ2V0KTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0aGlzLmpvaW5QYXRoKHRhcmdldC5wYXRoLCBuYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUodGFyZ2V0UGF0aCwgXCJcIik7XG5cbiAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKGZhbHNlKS5vcGVuRmlsZShjcmVhdGVkKTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlt0eXBzaWRpYW5dIGZhaWxlZCB0byBjcmVhdGUgdHlwIGZpbGVcIiwgZXJyb3IpO1xuICAgICAgICAgICAgbmV3IE5vdGljZShcIi50eXAgXHUzMEQ1XHUzMEExXHUzMEE0XHUzMEVCXHUzMDZFXHU0RjVDXHU2MjEwXHUzMDZCXHU1OTMxXHU2NTU3XHUzMDU3XHUzMDdFXHUzMDU3XHUzMDVGXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHJlc29sdmVVbmlxdWVUeXBGaWxlTmFtZShmb2xkZXI6IFRGb2xkZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGluaXRpYWxOYW1lID0gYCR7TkVXX1RZUF9OQU1FfSR7TkVXX1RZUF9FWFR9YDtcbiAgICBpZiAoXG4gICAgICAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKFxuICAgICAgICB0aGlzLmpvaW5QYXRoKGZvbGRlci5wYXRoLCBpbml0aWFsTmFtZSksXG4gICAgICApXG4gICAgKSB7XG4gICAgICByZXR1cm4gaW5pdGlhbE5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvdW50ZXIgPSAxO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBuYW1lID0gYCR7TkVXX1RZUF9OQU1FfSAke2NvdW50ZXJ9JHtORVdfVFlQX0VYVH1gO1xuICAgICAgaWYgKFxuICAgICAgICAhdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRoaXMuam9pblBhdGgoZm9sZGVyLnBhdGgsIG5hbWUpKVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiBuYW1lO1xuICAgICAgfVxuICAgICAgY291bnRlciArPSAxO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2V0VGFyZ2V0Rm9sZGVyKGZpbGU/OiBUQWJzdHJhY3RGaWxlKTogVEZvbGRlciB7XG4gICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICByZXR1cm4gZmlsZTtcbiAgICB9XG5cbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICByZXR1cm4gZmlsZS5wYXJlbnQgPz8gdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG4gIH1cblxuICBwcml2YXRlIGlzVHlwRmlsZShmaWxlOiBUQWJzdHJhY3RGaWxlKTogZmlsZSBpcyBURmlsZSB7XG4gICAgcmV0dXJuIGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gVFlQX0VYVEVOU0lPTjtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TGVhZkJ5VHlwRmlsZShwYXRoOiBzdHJpbmcpOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZVxuICAgICAgICAuZ2V0TGVhdmVzT2ZUeXBlKFRZUF9WSUVXKVxuICAgICAgICAuZmluZCgobGVhZikgPT5cbiAgICAgICAgICBsZWFmLnZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcgJiYgbGVhZi52aWV3LmZpbGU/LnBhdGggPT09IHBhdGhcbiAgICAgICAgKSB8fFxuICAgICAgbnVsbFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGhhbmRsZVZhdWx0Q3JlYXRlID0gKGZpbGU6IFRBYnN0cmFjdEZpbGUpOiB2b2lkID0+IHtcbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sb2dMaWZlY3ljbGUoXCJjcmVhdGVcIiwgZmlsZSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVWYXVsdFJlbmFtZSA9IChmaWxlOiBUQWJzdHJhY3RGaWxlLCBvbGRQYXRoOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICBpZiAoIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5sb2dMaWZlY3ljbGUoXCJyZW5hbWVcIiwgZmlsZSwgb2xkUGF0aCk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVWYXVsdERlbGV0ZSA9IChmaWxlOiBUQWJzdHJhY3RGaWxlKTogdm9pZCA9PiB7XG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nTGlmZWN5Y2xlKFwiZGVsZXRlXCIsIGZpbGUpO1xuICB9O1xuXG4gIHByaXZhdGUgaXNUeXBGaWxlQWNjZXNzaWJsZShmaWxlOiBURmlsZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZS5wYXRoKSBpbnN0YW5jZW9mIFRGaWxlO1xuICB9XG5cbiAgcHJpdmF0ZSByZXN0b3JlQWN0aXZlTGVhZihsZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCk6IHZvaWQge1xuICAgIGlmICghbGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjdGl2ZUxlYWYgPSB0aGlzLmN1cnJlbnRBY3RpdmVMZWFmO1xuICAgIGlmIChhY3RpdmVMZWFmID09PSBsZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLnNldEFjdGl2ZUxlYWYobGVhZiwgeyBmb2N1czogdHJ1ZSB9KTtcbiAgfVxuXG4gIHByaXZhdGUgbG9nTGlmZWN5Y2xlKFxuICAgIGV2ZW50TmFtZTogXCJjcmVhdGVcIiB8IFwicmVuYW1lXCIgfCBcImRlbGV0ZVwiLFxuICAgIGZpbGU6IFR5cExpZmVjeWNsZUV2ZW50VGFyZ2V0LFxuICAgIG9sZFBhdGg/OiBzdHJpbmcsXG4gICk6IHZvaWQge1xuICAgIGlmIChvbGRQYXRoKSB7XG4gICAgICBjb25zb2xlLmluZm8oYFt0eXBzaWRpYW5dICR7ZXZlbnROYW1lfTogJHtvbGRQYXRofSAtPiAke2ZpbGUucGF0aH1gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zb2xlLmluZm8oYFt0eXBzaWRpYW5dICR7ZXZlbnROYW1lfTogJHtmaWxlLnBhdGh9YCk7XG4gIH1cblxuICBwcml2YXRlIGxvZ1N0YXJ0dXBTdGF0ZSgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmluZm8oXG4gICAgICBcIlt0eXBzaWRpYW5dIHN0YXJ0dXAgb2JzZXJ2ZXJzIGFuZCBjb250ZXh0IG1lbnUgYWN0aW9ucyByZWdpc3RlcmVkXCIsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgam9pblBhdGgoZm9sZGVyUGF0aDogc3RyaW5nLCBmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAoIWZvbGRlclBhdGgpIHtcbiAgICAgIHJldHVybiBmaWxlTmFtZTtcbiAgICB9XG5cbiAgICByZXR1cm4gYCR7Zm9sZGVyUGF0aH0vJHtmaWxlTmFtZX1gO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgY29uc29sZS5pbmZvKFwiW3R5cHNpZGlhbl0gcGx1Z2luIHVubG9hZGVkXCIpO1xuICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQVNPO0FBRVAsSUFBTSxnQkFBZ0I7QUFDdEIsSUFBTSxXQUFXO0FBQ2pCLElBQU0sZUFBZTtBQUNyQixJQUFNLGNBQWMsSUFBSSxhQUFhO0FBQ3JDLElBQU0sc0JBQXNCLENBQUMsZUFBZSxPQUFPLEtBQUs7QUFPeEQsSUFBcUIsa0JBQXJCLGNBQTZDLHVCQUFPO0FBQUEsRUFDMUMscUJBQTJDO0FBQUEsRUFDM0Msb0JBQTBDO0FBQUEsRUFFbEQsTUFBTSxTQUF3QjtBQUM1QixTQUFLLG9CQUFvQixLQUFLLElBQUksVUFBVSxrQkFBa0I7QUFFOUQsU0FBSyxJQUFJLFVBQVUsY0FBYyxNQUFNO0FBQ3JDLFdBQUssbUJBQW1CLE1BQU0sS0FBSyxtQkFBbUIsR0FBRyxRQUFRO0FBQ2pFLFdBQUssNkJBQTZCO0FBQ2xDLFdBQUssOEJBQThCO0FBQ25DLFdBQUssZ0JBQWdCO0FBQUEsSUFDdkIsQ0FBQztBQUVELFNBQUs7QUFBQSxNQUNILEtBQUssSUFBSSxVQUFVLEdBQUcsc0JBQXNCLEtBQUssc0JBQXNCO0FBQUEsSUFDekU7QUFDQSxTQUFLO0FBQUEsTUFDSCxLQUFLLElBQUksVUFBVSxHQUFHLGFBQWEsS0FBSyxjQUFjO0FBQUEsSUFDeEQ7QUFFQSxTQUFLLGNBQWMsU0FBUyx5QkFBeUIsTUFBTTtBQUN6RCxVQUFJLHVCQUFPLGlDQUFpQztBQUFBLElBQzlDLENBQUM7QUFFRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUNkLFlBQUksdUJBQU8sc0JBQXNCO0FBQUEsTUFDbkM7QUFBQSxJQUNGLENBQUM7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
