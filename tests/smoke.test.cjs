// The built bundle, not the sources: main.js is the only file Obsidian ever loads.
const { assert, suite, test, done } = require("./harness.cjs");
const { readFileSync } = require("fs");
const { join } = require("path");

const bundle = readFileSync(join(__dirname, "..", "main.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(__dirname, "..", "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
const versions = JSON.parse(readFileSync(join(__dirname, "..", "versions.json"), "utf8"));
const { DEFAULT_SETTINGS } = require("./build/types.cjs");

suite("smoke");

test("the bundle exists and is CommonJS, which is what Obsidian requires", () => {
	assert.ok(bundle.length > 1000, "main.js looks empty");
	assert.ok(/module\.exports|exports\./.test(bundle), "the bundle exports nothing");
});

test("obsidian stays external rather than being bundled in", () => {
	assert.ok(/require\(["']obsidian["']\)/.test(bundle), "obsidian must come from the app, not the bundle");
});

// A version mismatch is invisible until a release, when Obsidian shows one number
// and npm another. Only the manifest is authoritative for Obsidian.
test("manifest, package.json and versions.json agree", () => {
	assert.strictEqual(manifest.version, pkg.version);
	assert.ok(manifest.version in versions, "versions.json does not carry the current version");
	assert.strictEqual(versions[manifest.version], manifest.minAppVersion);
});

test("the manifest carries everything Obsidian needs to install it", () => {
	for (const key of ["id", "name", "version", "minAppVersion", "description", "author"]) {
		assert.ok(manifest[key], `manifest.json is missing ${key}`);
	}
});

// This plugin creates files. A default folder shipped to every install is a tree
// somebody did not ask for, appearing in their vault on first launch.
test("no default path names a real person's vault", () => {
	for (const type of DEFAULT_SETTINGS.noteTypes) {
		assert.ok(!/\d\d [A-Z]/.test(type.format), `${type.id}: format looks like one vault's numbered folders`);
		assert.strictEqual(type.template, "", `${type.id}: a shipped template path points at a file nobody has`);
	}
});

test("only one default type creates notes without being asked", () => {
	const auto = DEFAULT_SETTINGS.noteTypes.filter((t) => t.autoCreate);
	assert.strictEqual(auto.length, 1, "a fresh install should not start writing five notes a day");
	assert.strictEqual(auto[0].granularity, "day");
});

test("every default type has a unique id and a format", () => {
	const ids = DEFAULT_SETTINGS.noteTypes.map((t) => t.id);
	assert.strictEqual(new Set(ids).size, ids.length, "duplicate ids would collide as command ids");
	for (const type of DEFAULT_SETTINGS.noteTypes) assert.ok(type.format, `${type.id} has no format`);
});

test("the ribbon default points at a type that exists and is enabled", () => {
	const target = DEFAULT_SETTINGS.noteTypes.find((t) => t.id === DEFAULT_SETTINGS.ribbonTypeId);
	assert.ok(target, "ribbonTypeId names a type that is not in the list");
	assert.ok(target.enabled, "the ribbon would be invisible on a fresh install");
});

done();
