// Note types are a list, each with its own granularity, path format, template and
// auto-create flag, so any number of them can share one granularity.

/** How often a note recurs, and therefore which date it belongs to. */
export type Granularity = "day" | "week" | "month" | "quarter" | "year";

export interface NoteType {
	/** Stable across renames -- commands and the ribbon setting key on it. */
	id: string;
	name: string;
	granularity: Granularity;
	/** A moment.js format for the whole vault-relative path minus the extension, folder in square brackets:
	 * `[Journal/Daily]/YYYY/MM/YYYY-MM-DD`, compatible with Daily Notes and Periodic Notes format strings. */
	format: string;
	/** Vault path to a template. Empty means create an empty note. */
	template: string;
	enabled: boolean;
	autoCreate: boolean;
}

export interface PeriodicJournalSettings {
	autoCreateOnStartup: boolean;
	autoCreateOnDateChange: boolean;
	/** Seconds to wait after layout is ready before creating anything. A few
	 * seconds lets a sync service settle first, so a note that already exists
	 * on another device is not created a second time here. */
	startupDelaySeconds: number;
	notifyOnCreate: boolean;
	/** Which type the ribbon icon opens. Empty means no ribbon icon. */
	ribbonTypeId: string;
	noteTypes: NoteType[];
}

// Five types, one per granularity, with generic paths and no templates, since a
// default path is written into every install.
export const DEFAULT_SETTINGS: PeriodicJournalSettings = {
	autoCreateOnStartup: true,
	autoCreateOnDateChange: true,
	startupDelaySeconds: 3,
	notifyOnCreate: true,
	ribbonTypeId: "daily",
	noteTypes: [
		{
			id: "daily",
			name: "Daily note",
			granularity: "day",
			format: "[Journal/Daily]/YYYY/MM/YYYY-MM-DD",
			template: "",
			enabled: true,
			autoCreate: true,
		},
		{
			id: "weekly",
			name: "Weekly note",
			granularity: "week",
			format: "[Journal/Weekly]/gggg-[W]ww",
			template: "",
			enabled: true,
			autoCreate: false,
		},
		{
			id: "monthly",
			name: "Monthly note",
			granularity: "month",
			format: "[Journal/Monthly]/YYYY-MM",
			template: "",
			enabled: true,
			autoCreate: false,
		},
		{
			id: "quarterly",
			name: "Quarterly note",
			granularity: "quarter",
			format: "[Journal/Quarterly]/YYYY [Q]Q",
			template: "",
			enabled: false,
			autoCreate: false,
		},
		{
			id: "yearly",
			name: "Yearly note",
			granularity: "year",
			format: "[Journal/Yearly]/YYYY",
			template: "",
			enabled: false,
			autoCreate: false,
		},
	],
};
