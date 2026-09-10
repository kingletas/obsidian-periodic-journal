const { assert, suite, test, done, load, day, clock } = require("./harness.cjs");
const { applyTemplate } = load("template");

suite("template");

const NOTE_DAY = () => day("2026-03-15");
const NOW = clock("09:41");

test("{{title}} is the note's basename", () => {
	assert.strictEqual(applyTemplate("# {{title}}", NOTE_DAY(), "2026-03-15", NOW), "# 2026-03-15");
});

// The token that matters most. Creating Monday's note on Tuesday happens every
// time a machine is asleep at midnight, and every time somebody backfills -- and
// a {{date}} meaning "now" would stamp the wrong day into the file invisibly.
test("{{date}} is the NOTE's date, not the current moment", () => {
	assert.strictEqual(applyTemplate("{{date}}", NOTE_DAY(), "t", NOW), "2026-03-15");
});

test("{{date}} takes a format", () => {
	assert.strictEqual(applyTemplate("{{date:YYYY/MM}}", NOTE_DAY(), "t", NOW), "2026/03");
});

test("{{time}} is the wall clock, and is the only token that means now", () => {
	assert.strictEqual(applyTemplate("{{time}}", NOTE_DAY(), "t", NOW), "09:41");
});

test("{{yesterday}} and {{tomorrow}} are relative to the note's date", () => {
	assert.strictEqual(applyTemplate("{{yesterday}}", NOTE_DAY(), "t", NOW), "2026-03-14");
	assert.strictEqual(applyTemplate("{{tomorrow}}", NOTE_DAY(), "t", NOW), "2026-03-16");
});

test("offsets step by d, w, M, Q and y", () => {
	assert.strictEqual(applyTemplate("{{date+1d}}", NOTE_DAY(), "t", NOW), "2026-03-16");
	assert.strictEqual(applyTemplate("{{date+1w}}", NOTE_DAY(), "t", NOW), "2026-03-22");
	assert.strictEqual(applyTemplate("{{date+1M}}", NOTE_DAY(), "t", NOW), "2026-04-15");
	assert.strictEqual(applyTemplate("{{date+1Q}}", NOTE_DAY(), "t", NOW), "2026-06-15");
	assert.strictEqual(applyTemplate("{{date+1y}}", NOTE_DAY(), "t", NOW), "2027-03-15");
});

test("a negative offset goes backwards", () => {
	assert.strictEqual(applyTemplate("{{date-2d}}", NOTE_DAY(), "t", NOW), "2026-03-13");
});

test("an offset combines with a format", () => {
	assert.strictEqual(applyTemplate("{{date+1M:YYYY-MM}}", NOTE_DAY(), "t", NOW), "2026-04");
});

test("whitespace inside the braces is tolerated", () => {
	assert.strictEqual(applyTemplate("{{ date }}", NOTE_DAY(), "t", NOW), "2026-03-15");
});

test("token names are case-insensitive", () => {
	assert.strictEqual(applyTemplate("{{DATE}}", NOTE_DAY(), "t", NOW), "2026-03-15");
});

// One typo in one token must not cost the other forty lines of the note.
test("a malformed offset leaves the date alone rather than throwing", () => {
	assert.strictEqual(applyTemplate("{{date+9z}}", NOTE_DAY(), "t", NOW), "{{date+9z}}");
});

test("an unknown token is left untouched", () => {
	assert.strictEqual(applyTemplate("{{weather}}", NOTE_DAY(), "t", NOW), "{{weather}}");
});

test("text around the tokens is preserved exactly", () => {
	const out = applyTemplate("---\ndate: {{date}}\n---\n\n# {{title}}\n", NOTE_DAY(), "Log", NOW);
	assert.strictEqual(out, "---\ndate: 2026-03-15\n---\n\n# Log\n");
});

test("every token in a document is substituted, not just the first", () => {
	assert.strictEqual(applyTemplate("{{date}} {{date}}", NOTE_DAY(), "t", NOW), "2026-03-15 2026-03-15");
});

done();
