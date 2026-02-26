import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const vaultPluginsDir = resolve(root, "debug-vault", ".obsidian", "plugins");
const hotReloadDir = resolve(vaultPluginsDir, "hot-reload");
const communityPluginsPath = resolve(root, "debug-vault", ".obsidian", "community-plugins.json");

async function ensureHotReloadRepo() {
  await mkdir(vaultPluginsDir, { recursive: true });
  try {
    await execFileAsync("git", ["-C", hotReloadDir, "rev-parse", "--is-inside-work-tree"]);
  } catch {
    await execFileAsync("git", ["clone", "https://github.com/pjeby/hot-reload.git", hotReloadDir]);
    console.log("[typsidian] hot-reload installed");
    return;
  }

  try {
    await execFileAsync("git", ["-C", hotReloadDir, "pull", "--ff-only"]);
    console.log("[typsidian] hot-reload updated");
  } catch (error) {
    console.error("[typsidian] failed to update hot-reload", error);
  }
}

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
