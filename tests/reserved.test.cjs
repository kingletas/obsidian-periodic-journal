// Nothing this plugin declares may shadow a member of the Obsidian class it extends.
// The lists are kept by hand and over-broad, because the internal members are absent from the public typings.
const { suite, test, assert, done, load } = require("./harness.cjs");

/** Members of Component -> Plugin, documented and undocumented. */
const PLUGIN_RESERVED = new Set([
	// Component
	"load", "onload", "unload", "onunload", "addChild", "removeChild", "register",
	"registerEvent", "registerDomEvent", "registerInterval", "registerScopeEvent",
	// Plugin, public
	"app", "manifest", "addRibbonIcon", "addStatusBarItem", "addCommand", "removeCommand",
	"addSettingTab", "registerView", "registerHoverLinkSource", "registerExtensions",
	"registerMarkdownPostProcessor", "registerMarkdownCodeBlockProcessor", "registerCodeMirror",
	"registerEditorExtension", "registerObsidianProtocolHandler", "registerEditorSuggest",
	"loadData", "saveData",
	// Plugin, internal but real
	"_loaded", "_children", "_events", "onExternalSettingsChange", "onUserEnable",
]);

/** Members of Component -> PluginSettingTab. */
const TAB_RESERVED = new Set([
	"load", "onload", "unload", "onunload", "addChild", "removeChild", "register",
	"registerEvent", "registerDomEvent", "registerInterval", "registerScopeEvent",
	"app", "plugin", "containerEl", "display", "hide",
]);

/** The overrides that are the whole point of subclassing, and must not be flagged. */
const PLUGIN_INTENDED = new Set(["onload", "onunload", "loadData", "saveData"]);
const TAB_INTENDED = new Set(["display", "hide"]);

const members = (cls) => Object.getOwnPropertyNames(cls.prototype).filter((n) => n !== "constructor");
const clashes = (cls, reserved, intended) => members(cls).filter((n) => reserved.has(n) && !intended.has(n));

const PeriodicJournalPlugin = load("main").default;
const { PeriodicJournalSettingTab } = load("settings");

suite("reserved names");

test("the plugin shadows no Obsidian Plugin member", () => {
	assert.deepStrictEqual(clashes(PeriodicJournalPlugin, PLUGIN_RESERVED, PLUGIN_INTENDED), []);
});

test("the settings tab shadows no PluginSettingTab member", () => {
	assert.ok(PeriodicJournalSettingTab, "the settings tab must be exported, or this test checks nothing");
	assert.deepStrictEqual(clashes(PeriodicJournalSettingTab, TAB_RESERVED, TAB_INTENDED), []);
});

// The guard is only worth having if it fires. `open` is the name that cost two
// sibling plugins their releases; `addCommand` is a Plugin member that would be
// just as quiet.
test("the guard would catch `open`", () => {
	class Bad { open() {} onload() {} }
	assert.deepStrictEqual(
		clashes(Bad, new Set([...PLUGIN_RESERVED, "open"]), PLUGIN_INTENDED),
		["open"]
	);
});

test("the guard would catch a shadowed Plugin member", () => {
	class Bad { addCommand() {} }
	assert.deepStrictEqual(clashes(Bad, PLUGIN_RESERVED, PLUGIN_INTENDED), ["addCommand"]);
});

test("the intended overrides are still declared", () => {
	const declared = members(PeriodicJournalPlugin);
	for (const name of ["onload", "loadSettings", "saveSettings"]) {
		assert.ok(declared.includes(name), `missing ${name}`);
	}
});

console.log(`  (checked ${members(PeriodicJournalPlugin).length} plugin members, ${members(PeriodicJournalSettingTab).length} settings-tab members)`);
done();
