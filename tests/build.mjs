// Bundles each module into CJS under tests/build/ so the tests can require() it,
// with `obsidian` replaced by a stub of no-ops at bundle time.

import { build } from "esbuild";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const out = join(here, "build");
mkdirSync(out, { recursive: true });

const ENTRIES = ["types.ts", "granularity.ts", "paths.ts", "template.ts", "conflicts.ts", "settings.ts", "main.ts"];

const stubObsidian = {
	name: "stub-obsidian",
	setup(b) {
		b.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "stub" }));
		b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
			contents: `
				export class Setting { setName() { return this; } setDesc() { return this; } setHeading() { return this; } addText() { return this; } addSlider() { return this; } addDropdown() { return this; } addButton() { return this; } addToggle() { return this; } addExtraButton() { return this; } }
				export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
				export class AbstractInputSuggest { constructor(app, el) { this.app = app; this.el = el; } close() {} }
				export class Notice {}
				// Structural hasInstance, because each entry point bundles its own copy of this stub.
				export class TFile { static [Symbol.hasInstance](x) { return Boolean(x && typeof x.path === "string" && typeof x.extension === "string"); } }
				export class TFolder { static [Symbol.hasInstance](x) { return Boolean(x && typeof x.path === "string" && Array.isArray(x.children)); } }
				export class Plugin { register() {} registerInterval() {} addCommand() {} addRibbonIcon() { return { remove() {} }; } addSettingTab() {} }
				// normalizePath collapses repeated slashes and trims the edges, which is
				// what the real one does to the parts this plugin depends on. A pass-through
				// stub would hide a doubled slash that the real app would have cleaned up.
				export const normalizePath = (p) => String(p).replace(/\\\\/g, "/").replace(/\\/{2,}/g, "/").replace(/^\\/+|\\/+$/g, "");
				export const moment = () => { throw new Error("moment is not stubbed: inject a clock instead of reaching for the global"); };
			`,
			loader: "js",
		}));
	},
};

for (const entry of ENTRIES) {
	const name = entry.replace(/[/]/g, "-").replace(/\.ts$/, "");
	await build({
		entryPoints: [join(root, "src", entry)],
		bundle: true,
		format: "cjs",
		platform: "node",
		target: "es2018",
		outfile: join(out, `${name}.cjs`),
		logLevel: "error",
		plugins: [stubObsidian],
	});
}

console.log(`build\n  ok  ${ENTRIES.length} modules bundled\n`);
