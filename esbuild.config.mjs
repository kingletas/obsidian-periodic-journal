import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const production = process.argv[2] === "production";

// `obsidian` and `electron` come from the app; keep `fs` and child processes out of
// the bundle so the manifest's `isDesktopOnly: false` stays true.
const external = ["obsidian", "electron", ...builtins];

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external,
	format: "cjs",
	platform: "browser",
	target: "es2018",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: production,
});

if (production) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
