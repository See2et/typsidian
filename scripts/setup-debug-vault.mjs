import { mkdir, readFile, symlink, writeFile, lstat, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
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

/**
 * Write JSON-serializable data to a file, creating parent directories if necessary.
 * Creates the file's parent directory hierarchy (if missing) and writes the value
 * as pretty-printed JSON with a trailing newline using UTF-8 encoding.
 * @param {string} filePath - Path to the target JSON file.
 * @param {*} data - Value to serialize to JSON and write to the file.
 */
async function ensureJson(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Ensure the Obsidian community-plugins.json file exists in the configured obsidianDir.
 *
 * If the file does not exist or cannot be read, creates it containing an empty JSON array.
 */
async function ensureCommunityPluginsJson() {
  const filePath = resolve(obsidianDir, "community-plugins.json");
  try {
    await readFile(filePath, "utf8");
  } catch {
    await ensureJson(filePath, []);
  }
}

/**
 * Ensure the plugin symlink exists at the plugins directory and points to the repository root.
 *
 * If a symbolic link already exists at the target path, the function returns without changes.
 * If a non-symlink entity exists at the target path, it is removed and replaced with a directory symlink to the repository root.
 * If the target path does not exist, a directory symlink to the repository root is created.
 *
 * @throws {Error} Rethrows filesystem errors except for "ENOENT" (missing path), which is handled by creating the symlink.
 */
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
  resolve(root, ".hotreload"),
  "enabled\n",
  "utf8"
);

console.log("[typsidian] debug vault ready:", vaultDir);
console.log("[typsidian] plugin symlink:", pluginLinkPath, "->", root);
