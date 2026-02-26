import esbuild from "esbuild";
import process from "node:process";
import builtins from "builtin-modules";

const args = process.argv.slice(2);
const watch = args.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "node:*",
    ...builtins
  ],
  format: "cjs",
  target: "es2022",
  outfile: "main.js",
  sourcemap: "inline",
  logLevel: "info"
});

if (watch) {
  await context.watch();
  console.log("[typsidian] watching src/main.ts -> main.js");
} else {
  await context.rebuild();
  await context.dispose();
  console.log("[typsidian] build complete");
}
