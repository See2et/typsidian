import { Notice, Plugin } from "obsidian";

export default class TypsidianPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addRibbonIcon("sigma", "Typsidian: Debug ping", () => {
      new Notice("Typsidian loaded in debug vault");
    });

    this.addCommand({
      id: "typsidian-dev-ping",
      name: "Typsidian: Debug ping",
      callback: () => {
        new Notice("Typsidian command OK");
      },
    });

    console.info("[typsidian] plugin loaded");
  }

  onunload(): void {
    console.info("[typsidian] plugin unloaded");
  }
}
