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
var TypsidianPlugin = class extends import_obsidian.Plugin {
  async onload() {
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
  onunload() {
    console.info("[typsidian] plugin unloaded");
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IE5vdGljZSwgUGx1Z2luIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFR5cHNpZGlhblBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmFkZFJpYmJvbkljb24oXCJzaWdtYVwiLCBcIlR5cHNpZGlhbjogRGVidWcgcGluZ1wiLCAoKSA9PiB7XG4gICAgICBuZXcgTm90aWNlKFwiVHlwc2lkaWFuIGxvYWRlZCBpbiBkZWJ1ZyB2YXVsdFwiKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJ0eXBzaWRpYW4tZGV2LXBpbmdcIixcbiAgICAgIG5hbWU6IFwiVHlwc2lkaWFuOiBEZWJ1ZyBwaW5nXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4ge1xuICAgICAgICBuZXcgTm90aWNlKFwiVHlwc2lkaWFuIGNvbW1hbmQgT0tcIik7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc29sZS5pbmZvKFwiW3R5cHNpZGlhbl0gcGx1Z2luIGxvYWRlZFwiKTtcbiAgfVxuXG4gIG9udW5sb2FkKCk6IHZvaWQge1xuICAgIGNvbnNvbGUuaW5mbyhcIlt0eXBzaWRpYW5dIHBsdWdpbiB1bmxvYWRlZFwiKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBK0I7QUFFL0IsSUFBcUIsa0JBQXJCLGNBQTZDLHVCQUFPO0FBQUEsRUFDbEQsTUFBTSxTQUF3QjtBQUM1QixTQUFLLGNBQWMsU0FBUyx5QkFBeUIsTUFBTTtBQUN6RCxVQUFJLHVCQUFPLGlDQUFpQztBQUFBLElBQzlDLENBQUM7QUFFRCxTQUFLLFdBQVc7QUFBQSxNQUNkLElBQUk7QUFBQSxNQUNKLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTTtBQUNkLFlBQUksdUJBQU8sc0JBQXNCO0FBQUEsTUFDbkM7QUFBQSxJQUNGLENBQUM7QUFFRCxZQUFRLEtBQUssMkJBQTJCO0FBQUEsRUFDMUM7QUFBQSxFQUVBLFdBQWlCO0FBQ2YsWUFBUSxLQUFLLDZCQUE2QjtBQUFBLEVBQzVDO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
