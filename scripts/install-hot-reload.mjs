import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = resolve(new URL("..", import.meta.url).pathname);
const vaultPluginsDir = resolve(root, "debug-vault", ".obsidian", "plugins");
const hotReloadDir = resolve(vaultPluginsDir, "hot-reload");
const communityPluginsPath = resolve(root, "debug-vault", ".obsidian", "community-plugins.json");

/**
 * Ensure the hot-reload plugin repository exists under the vault plugins directory and is up to date.
 *
 * Creates the plugins directory if missing. If a Git work tree exists at the hot-reload path, performs a fast-forward pull to update it; otherwise clones the hot-reload repository from GitHub into the target directory.
 */
async function ensureHotReloadRepo() {
  await mkdir(vaultPluginsDir, { recursive: true });
  try {
    await execFileAsync("git", ["-C", hotReloadDir, "rev-parse", "--is-inside-work-tree"]);
    await execFileAsync("git", ["-C", hotReloadDir, "pull", "--ff-only"]);
    console.log("[typsidian] hot-reload updated");
  } catch {
    await execFileAsync("git", ["clone", "https://github.com/pjeby/hot-reload.git", hotReloadDir]);
    console.log("[typsidian] hot-reload installed");
  }
}

/**
 * Ensures "hot-reload" is listed in the vault's community-plugins.json, creating or updating the file as needed.
 *
 * If the file is missing or contains invalid JSON, it is treated as an empty plugin list. If "hot-reload" is not already present, the function appends it and writes the updated JSON back to community-plugins.json with pretty formatting and a trailing newline.
 */
async function enableInCommunityPlugins() {
  let current = [];
  try {
    const raw = await readFile(communityPluginsPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      current = parsed;
    }
  } catch {
    current = [];
  }

  if (!current.includes("hot-reload")) {
    current.push("hot-reload");
    await writeFile(communityPluginsPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  }
}

await ensureHotReloadRepo();
await enableInCommunityPlugins();

console.log("[typsidian] hot-reload registered in debug-vault/.obsidian/community-plugins.json");
console.log("[typsidian] open Obsidian -> debug-vault and enable community plugins if restricted mode is on");
