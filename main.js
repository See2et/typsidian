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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gIE1hcmtkb3duVmlldyxcbiAgTWVudSxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFRBYnN0cmFjdEZpbGUsXG4gIFRGaWxlLFxuICBURm9sZGVyLFxuICBXb3Jrc3BhY2VMZWFmLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcblxuY29uc3QgVFlQX0VYVEVOU0lPTiA9IFwidHlwXCI7XG5jb25zdCBUWVBfVklFVyA9IFwibWFya2Rvd25cIjtcbmNvbnN0IE5FV19UWVBfTkFNRSA9IFwiVW50aXRsZWRcIjtcbmNvbnN0IE5FV19UWVBfRVhUID0gYC4ke1RZUF9FWFRFTlNJT059YDtcbmNvbnN0IFRZUF9GSUxFX0VYVEVOU0lPTlMgPSBbVFlQX0VYVEVOU0lPTiwgXCJUeXBcIiwgXCJUWVBcIl0gYXMgY29uc3Q7XG5cbmludGVyZmFjZSBUeXBMaWZlY3ljbGVFdmVudFRhcmdldCB7XG4gIHBhdGg6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBUeXBzaWRpYW5QbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIHByZXZpb3VzQWN0aXZlTGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGN1cnJlbnRBY3RpdmVMZWFmOiBXb3Jrc3BhY2VMZWFmIHwgbnVsbCA9IG51bGw7XG5cbiAgYXN5bmMgb25sb2FkKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY3VycmVudEFjdGl2ZUxlYWYgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TW9zdFJlY2VudExlYWYoKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMucmVnaXN0ZXJFeHRlbnNpb25zKEFycmF5LmZyb20oVFlQX0ZJTEVfRVhURU5TSU9OUyksIFRZUF9WSUVXKTtcbiAgICAgIHRoaXMucmVnaXN0ZXJUeXBMaWZlY3ljbGVPYnNlcnZlcigpO1xuICAgICAgdGhpcy5yZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpO1xuICAgICAgdGhpcy5sb2dTdGFydHVwU3RhdGUoKTtcbiAgICB9KTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcImFjdGl2ZS1sZWFmLWNoYW5nZVwiLCB0aGlzLmhhbmRsZUFjdGl2ZUxlYWZDaGFuZ2UpLFxuICAgICk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KFxuICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsIHRoaXMuaGFuZGxlRmlsZU9wZW4pLFxuICAgICk7XG5cbiAgICBjb25zb2xlLmluZm8oXCJbdHlwc2lkaWFuXSBwbHVnaW4gbG9hZGVkXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVGaWxlT3BlbiA9IChmaWxlOiBURmlsZSB8IG51bGwpOiB2b2lkID0+IHtcbiAgICBpZiAoIWZpbGUgfHwgIXRoaXMuaXNUeXBGaWxlKGZpbGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZUFjY2Vzc2libGUoZmlsZSkpIHtcbiAgICAgIHRoaXMucmVzdG9yZUFjdGl2ZUxlYWYodGhpcy5wcmV2aW91c0FjdGl2ZUxlYWYpO1xuICAgICAgbmV3IE5vdGljZShcbiAgICAgICAgXCIudHlwIFx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA5Mlx1OTU4Qlx1MzA1MVx1MzA3RVx1MzA1Qlx1MzA5M1x1MzA2N1x1MzA1N1x1MzA1Rlx1MzAwMlx1MzBENVx1MzBBMVx1MzBBNFx1MzBFQlx1MzA5Mlx1OTU4Qlx1NUMwMVx1MzA2N1x1MzA0RFx1MzA4Qlx1NzJCNlx1NjE0Qlx1MzA5Mlx1NzhCQVx1OEE4RFx1MzA1N1x1MzA2Nlx1MzA0Rlx1MzA2MFx1MzA1NVx1MzA0NFwiLFxuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBleGlzdGluZ0xlYWYgPSB0aGlzLmdldExlYWZCeVR5cEZpbGUoZmlsZS5wYXRoKTtcblxuICAgIGlmICghZXhpc3RpbmdMZWFmKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgYWN0aXZlTGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRNb3N0UmVjZW50TGVhZigpO1xuICAgIGlmIChhY3RpdmVMZWFmID09PSBleGlzdGluZ0xlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmFwcC53b3Jrc3BhY2Uuc2V0QWN0aXZlTGVhZihleGlzdGluZ0xlYWYsIHsgZm9jdXM6IHRydWUgfSk7XG4gIH07XG5cbiAgcHJpdmF0ZSBoYW5kbGVBY3RpdmVMZWFmQ2hhbmdlID0gKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCA9PiB7XG4gICAgaWYgKGxlYWYgPT09IHRoaXMuY3VycmVudEFjdGl2ZUxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnByZXZpb3VzQWN0aXZlTGVhZiA9IHRoaXMuY3VycmVudEFjdGl2ZUxlYWY7XG4gICAgdGhpcy5jdXJyZW50QWN0aXZlTGVhZiA9IGxlYWY7XG4gIH07XG5cbiAgcHJpdmF0ZSByZWdpc3RlclR5cExpZmVjeWNsZU9ic2VydmVyKCk6IHZvaWQge1xuICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbihcImNyZWF0ZVwiLCB0aGlzLmhhbmRsZVZhdWx0Q3JlYXRlKSk7XG4gICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKFwicmVuYW1lXCIsIHRoaXMuaGFuZGxlVmF1bHRSZW5hbWUpKTtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oXCJkZWxldGVcIiwgdGhpcy5oYW5kbGVWYXVsdERlbGV0ZSkpO1xuICB9XG5cbiAgcHJpdmF0ZSByZWdpc3RlclR5cENvbnRleHRNZW51QWN0aW9ucygpOiB2b2lkIHtcbiAgICB0aGlzLnJlZ2lzdGVyRXZlbnQoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJmaWxlLW1lbnVcIiwgKG1lbnU6IE1lbnUsIGZpbGU6IFRBYnN0cmFjdEZpbGUpID0+IHtcbiAgICAgICAgdGhpcy5hZGROZXdUeXBDb250ZXh0TWVudUl0ZW0obWVudSwgdGhpcy5nZXRUYXJnZXRGb2xkZXIoZmlsZSkpO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbihcbiAgICAgICAgXCJmaWxlcy1tZW51XCIsXG4gICAgICAgIChtZW51OiBNZW51LCBmaWxlczogVEFic3RyYWN0RmlsZVtdIHwgbnVsbCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRhcmdldEZpbGUgPSBmaWxlcz8uWzBdO1xuICAgICAgICAgIHRoaXMuYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnUsIHRoaXMuZ2V0VGFyZ2V0Rm9sZGVyKHRhcmdldEZpbGUpKTtcbiAgICAgICAgfSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgYWRkTmV3VHlwQ29udGV4dE1lbnVJdGVtKG1lbnU6IE1lbnUsIHRhcmdldDogVEZvbGRlcik6IHZvaWQge1xuICAgIG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuICAgICAgaXRlbVxuICAgICAgICAuc2V0VGl0bGUoXCJOZXcgVHlwc3RcIilcbiAgICAgICAgLnNldEljb24oXCJuZXctZmlsZVwiKVxuICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBhd2FpdCB0aGlzLnJlc29sdmVVbmlxdWVUeXBGaWxlTmFtZSh0YXJnZXQpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHRoaXMuam9pblBhdGgodGFyZ2V0LnBhdGgsIG5hbWUpO1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZSh0YXJnZXRQYXRoLCBcIlwiKTtcblxuICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoZmFsc2UpLm9wZW5GaWxlKGNyZWF0ZWQpO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW3R5cHNpZGlhbl0gZmFpbGVkIHRvIGNyZWF0ZSB0eXAgZmlsZVwiLCBlcnJvcik7XG4gICAgICAgICAgICBuZXcgTm90aWNlKFwiLnR5cCBcdTMwRDVcdTMwQTFcdTMwQTRcdTMwRUJcdTMwNkVcdTRGNUNcdTYyMTBcdTMwNkJcdTU5MzFcdTY1NTdcdTMwNTdcdTMwN0VcdTMwNTdcdTMwNUZcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVVuaXF1ZVR5cEZpbGVOYW1lKGZvbGRlcjogVEZvbGRlcik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaW5pdGlhbE5hbWUgPSBgJHtORVdfVFlQX05BTUV9JHtORVdfVFlQX0VYVH1gO1xuICAgIGlmIChcbiAgICAgICF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoXG4gICAgICAgIHRoaXMuam9pblBhdGgoZm9sZGVyLnBhdGgsIGluaXRpYWxOYW1lKSxcbiAgICAgIClcbiAgICApIHtcbiAgICAgIHJldHVybiBpbml0aWFsTmFtZTtcbiAgICB9XG5cbiAgICBsZXQgY291bnRlciA9IDE7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSBgJHtORVdfVFlQX05BTUV9ICR7Y291bnRlcn0ke05FV19UWVBfRVhUfWA7XG4gICAgICBpZiAoXG4gICAgICAgICF0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5qb2luUGF0aChmb2xkZXIucGF0aCwgbmFtZSkpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICB9XG4gICAgICBjb3VudGVyICs9IDE7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBnZXRUYXJnZXRGb2xkZXIoZmlsZT86IFRBYnN0cmFjdEZpbGUpOiBURm9sZGVyIHtcbiAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgIHJldHVybiBmaWxlO1xuICAgIH1cblxuICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgIHJldHVybiBmaWxlLnBhcmVudCA/PyB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNUeXBGaWxlKGZpbGU6IFRBYnN0cmFjdEZpbGUpOiBmaWxlIGlzIFRGaWxlIHtcbiAgICByZXR1cm4gZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCkgPT09IFRZUF9FWFRFTlNJT047XG4gIH1cblxuICBwcml2YXRlIGdldExlYWZCeVR5cEZpbGUocGF0aDogc3RyaW5nKTogV29ya3NwYWNlTGVhZiB8IG51bGwge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmFwcC53b3Jrc3BhY2VcbiAgICAgICAgLmdldExlYXZlc09mVHlwZShUWVBfVklFVylcbiAgICAgICAgLmZpbmQoKGxlYWYpID0+XG4gICAgICAgICAgbGVhZi52aWV3IGluc3RhbmNlb2YgTWFya2Rvd25WaWV3ICYmIGxlYWYudmlldy5maWxlPy5wYXRoID09PSBwYXRoXG4gICAgICAgICkgfHxcbiAgICAgIG51bGxcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBoYW5kbGVWYXVsdENyZWF0ZSA9IChmaWxlOiBUQWJzdHJhY3RGaWxlKTogdm9pZCA9PiB7XG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nTGlmZWN5Y2xlKFwiY3JlYXRlXCIsIGZpbGUpO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlVmF1bHRSZW5hbWUgPSAoZmlsZTogVEFic3RyYWN0RmlsZSwgb2xkUGF0aDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgaWYgKCF0aGlzLmlzVHlwRmlsZShmaWxlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMubG9nTGlmZWN5Y2xlKFwicmVuYW1lXCIsIGZpbGUsIG9sZFBhdGgpO1xuICB9O1xuXG4gIHByaXZhdGUgaGFuZGxlVmF1bHREZWxldGUgPSAoZmlsZTogVEFic3RyYWN0RmlsZSk6IHZvaWQgPT4ge1xuICAgIGlmICghdGhpcy5pc1R5cEZpbGUoZmlsZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0xpZmVjeWNsZShcImRlbGV0ZVwiLCBmaWxlKTtcbiAgfTtcblxuICBwcml2YXRlIGlzVHlwRmlsZUFjY2Vzc2libGUoZmlsZTogVEZpbGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGZpbGUucGF0aCkgaW5zdGFuY2VvZiBURmlsZTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzdG9yZUFjdGl2ZUxlYWYobGVhZjogV29ya3NwYWNlTGVhZiB8IG51bGwpOiB2b2lkIHtcbiAgICBpZiAoIWxlYWYpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY3RpdmVMZWFmID0gdGhpcy5jdXJyZW50QWN0aXZlTGVhZjtcbiAgICBpZiAoYWN0aXZlTGVhZiA9PT0gbGVhZikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5zZXRBY3RpdmVMZWFmKGxlYWYsIHsgZm9jdXM6IHRydWUgfSk7XG4gIH1cblxuICBwcml2YXRlIGxvZ0xpZmVjeWNsZShcbiAgICBldmVudE5hbWU6IFwiY3JlYXRlXCIgfCBcInJlbmFtZVwiIHwgXCJkZWxldGVcIixcbiAgICBmaWxlOiBUeXBMaWZlY3ljbGVFdmVudFRhcmdldCxcbiAgICBvbGRQYXRoPzogc3RyaW5nLFxuICApOiB2b2lkIHtcbiAgICBpZiAob2xkUGF0aCkge1xuICAgICAgY29uc29sZS5pbmZvKGBbdHlwc2lkaWFuXSAke2V2ZW50TmFtZX06ICR7b2xkUGF0aH0gLT4gJHtmaWxlLnBhdGh9YCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5pbmZvKGBbdHlwc2lkaWFuXSAke2V2ZW50TmFtZX06ICR7ZmlsZS5wYXRofWApO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2dTdGFydHVwU3RhdGUoKTogdm9pZCB7XG4gICAgY29uc29sZS5pbmZvKFxuICAgICAgXCJbdHlwc2lkaWFuXSBzdGFydHVwIG9ic2VydmVycyBhbmQgY29udGV4dCBtZW51IGFjdGlvbnMgcmVnaXN0ZXJlZFwiLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIGpvaW5QYXRoKGZvbGRlclBhdGg6IHN0cmluZywgZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKCFmb2xkZXJQYXRoKSB7XG4gICAgICByZXR1cm4gZmlsZU5hbWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGAke2ZvbGRlclBhdGh9LyR7ZmlsZU5hbWV9YDtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuaW5mbyhcIlt0eXBzaWRpYW5dIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFTTztBQUVQLElBQU0sZ0JBQWdCO0FBQ3RCLElBQU0sV0FBVztBQUNqQixJQUFNLGVBQWU7QUFDckIsSUFBTSxjQUFjLElBQUksYUFBYTtBQUNyQyxJQUFNLHNCQUFzQixDQUFDLGVBQWUsT0FBTyxLQUFLO0FBT3hELElBQXFC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
