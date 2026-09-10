const { assert, suite, test, done, load } = require("./harness.cjs");
const { detectConflicts } = load("conflicts");

suite("conflicts");

const probe = (over = {}) =>
	Object.assign({ dailyNotesEnabled: false, periodicNotesEnabled: false, templaterFolders: [], ownedFolders: [] }, over);

test("a clean vault reports nothing", () => {
	assert.deepStrictEqual(detectConflicts(probe()), []);
});

test("the core Daily Notes plugin is named", () => {
	const found = detectConflicts(probe({ dailyNotesEnabled: true }));
	assert.strictEqual(found.length, 1);
	assert.ok(found[0].includes("Daily Notes"));
	assert.ok(found[0].includes("Core plugins"), "the message says where to turn it off");
});

test("Periodic Notes is named", () => {
	const found = detectConflicts(probe({ periodicNotesEnabled: true }));
	assert.strictEqual(found.length, 1);
	assert.ok(found[0].includes("Periodic Notes"));
});

// A Templater folder rule re-inserts its template, unsubstituted, when the note is created.
test("a Templater folder rule on an owned folder is a conflict", () => {
	const found = detectConflicts(probe({ templaterFolders: ["Journal/Daily"], ownedFolders: ["Journal/Daily"] }));
	assert.strictEqual(found.length, 1);
	assert.ok(found[0].includes("Templater"));
	assert.ok(found[0].includes("unsubstituted"), "the message says what the damage looks like");
});

// A rule on a parent reaches every note below it, so an exact match would miss
// the commonest case of all.
test("a Templater rule on a PARENT of an owned folder is a conflict", () => {
	const found = detectConflicts(probe({ templaterFolders: ["Journal"], ownedFolders: ["Journal/Daily"] }));
	assert.strictEqual(found.length, 1);
});

test("a Templater rule on an unrelated folder is not a conflict", () => {
	assert.deepStrictEqual(detectConflicts(probe({ templaterFolders: ["Reference"], ownedFolders: ["Journal/Daily"] })), []);
});

// The guard that stops `Journal` matching `Journal Archive`.
test("a folder that merely shares a prefix is not a conflict", () => {
	assert.deepStrictEqual(detectConflicts(probe({ templaterFolders: ["Journal"], ownedFolders: ["Journal Archive"] })), []);
});

test("an empty folder in the rule list is ignored rather than matching everything", () => {
	assert.deepStrictEqual(detectConflicts(probe({ templaterFolders: [""], ownedFolders: ["Journal"] })), []);
});

test("every conflict is reported, not just the first", () => {
	const found = detectConflicts(
		probe({ dailyNotesEnabled: true, periodicNotesEnabled: true, templaterFolders: ["Journal"], ownedFolders: ["Journal"] })
	);
	assert.strictEqual(found.length, 3);
});

done();
