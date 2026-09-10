// Detects other plugins that also create these notes, since two writers on one file
// look like a bug in this one.

/** The shape this needs off the app object. Declared structurally rather than
 * imported, because every one of these is an undocumented internal: typing them
 * as `App` would claim a stability none of them has, and testing them would need
 * a running Obsidian. */
export interface ConflictProbe {
	dailyNotesEnabled: boolean;
	periodicNotesEnabled: boolean;
	/** Folders carrying a Templater folder template. */
	templaterFolders: string[];
	/** Folders this plugin writes into. */
	ownedFolders: string[];
}

export function detectConflicts(probe: ConflictProbe): string[] {
	const conflicts: string[] = [];

	if (probe.dailyNotesEnabled) {
		conflicts.push(
			"The core **Daily Notes** plugin is still enabled. Turn it off in Settings → Core plugins, or it will keep creating a daily note on its own schedule."
		);
	}

	if (probe.periodicNotesEnabled) {
		conflicts.push(
			"**Periodic Notes** is still enabled. Turn it off in Settings → Community plugins — this plugin covers weekly, monthly, quarterly and yearly."
		);
	}

	for (const folder of probe.templaterFolders) {
		if (!folder) continue;
		// A rule on a parent folder reaches every note below it, so a prefix match
		// is the right test -- an exact match would miss the common case of one
		// rule on `Journal` covering `Journal/Daily`.
		const clash = probe.ownedFolders.some((owned) => owned === folder || owned.startsWith(`${folder}/`));
		if (clash) {
			conflicts.push(
				`**Templater** has a folder template on \`${folder}\`, which this plugin also writes into. Templater fires on creation and inserts the template a second time, unsubstituted. Remove that rule in Settings → Templater → Folder templates.`
			);
		}
	}

	return conflicts;
}
