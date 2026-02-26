import { mkdir, readFile, symlink, writeFile, lstat, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const vaultDir = resolve(root, "debug-vault");
const obsidianDir = resolve(vaultDir, ".obsidian");
const pluginsDir = resolve(obsidianDir, "plugins");
const pluginId = "typsidian";
const pluginLinkPath = resolve(pluginsDir, pluginId);

const appJson = {
  "legacyEditor": false,
  "showLineNumber": true,
  "vimMode": false
};

async function ensureJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function ensureCommunityPluginsJson() {
  const filePath = resolve(obsidianDir, "community-plugins.json");
  try {
    await readFile(filePath, "utf8");
  } catch {
    await ensureJson(filePath, []);
  }
}

async function ensureSymlink() {
  try {
    const stats = await lstat(pluginLinkPath);
    if (stats.isSymbolicLink()) {
      return;
    }
    await rm(pluginLinkPath, { recursive: true, force: true });
    await symlink(root, pluginLinkPath, "dir");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
      throw error;
    }
    await symlink(root, pluginLinkPath, "dir");
  }
}

await mkdir(pluginsDir, { recursive: true });
await ensureJson(resolve(obsidianDir, "app.json"), appJson);
await ensureCommunityPluginsJson();
await ensureSymlink();

await writeFile(
  resolve(vaultDir, ".hotreload"),
  "enabled\n",
  "utf8"
);

console.log("[typsidian] debug vault ready:", vaultDir);
console.log("[typsidian] plugin symlink:", pluginLinkPath, "->", root);
