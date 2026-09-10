const { assert, suite, test, done, load, day } = require("./harness.cjs");
const { resolvePath, parentFolderOf, basenameOf, slugify, uniqueId } = load("paths");

suite("paths");

const type = (format) => ({ id: "t", name: "T", granularity: "day", format, template: "", enabled: true, autoCreate: false });

// One format string covers folder and filename, with [literal] escaping carrying the folder.
test("a format covers the whole vault-relative path, folder included", () => {
	assert.strictEqual(resolvePath(type("[Journal/Daily]/YYYY/MM/YYYY-MM-DD"), day("2026-03-15")), "Journal/Daily/2026/03/2026-03-15.md");
});

test("a literal segment may sit in the filename too", () => {
	assert.strictEqual(resolvePath(type("[Journal]/[Reading Log — ]YYYY-MM-DD"), day("2026-03-15")), "Journal/Reading Log — 2026-03-15.md");
});

test("a format with no folder resolves at the vault root", () => {
	assert.strictEqual(resolvePath(type("YYYY-MM-DD"), day("2026-03-15")), "2026-03-15.md");
});

test("parentFolderOf and basenameOf split a resolved path", () => {
	assert.strictEqual(parentFolderOf("Journal/Daily/2026/03/2026-03-15.md"), "Journal/Daily/2026/03");
	assert.strictEqual(basenameOf("Journal/Daily/2026/03/2026-03-15.md"), "2026-03-15");
});

test("a root-level note has no parent folder and still has a basename", () => {
	assert.strictEqual(parentFolderOf("2026-03-15.md"), "");
	assert.strictEqual(basenameOf("2026-03-15.md"), "2026-03-15");
});

suite("ids");

test("a slug is lowercase, hyphenated, and free of punctuation", () => {
	assert.strictEqual(slugify("Morning Pages"), "morning-pages");
	assert.strictEqual(slugify("Weekly — Review!"), "weekly-review");
});

test("a name with nothing sluggable still yields a usable id", () => {
	assert.strictEqual(slugify("!!!"), "note-type");
	assert.strictEqual(slugify(""), "note-type");
});

// An id is what a command keys on, so it has to be both stable and readable:
// `open-morning-pages` is a command somebody can bind a hotkey to and recognise
// a year later, and a timestamped id is not.
test("an id is derived from the name", () => {
	assert.strictEqual(uniqueId("Morning Pages", []), "morning-pages");
});

test("a colliding name gets a suffix rather than overwriting the first", () => {
	assert.strictEqual(uniqueId("Journal", ["journal"]), "journal-2");
	assert.strictEqual(uniqueId("Journal", ["journal", "journal-2"]), "journal-3");
});

done();
