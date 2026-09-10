import { Notice, Plugin, TFile, TFolder, moment, normalizePath } from "obsidian";
import { GRANULARITIES, IDENTIFY_SPANS, granularityOf } from "./granularity";
import { basenameOf, parentFolderOf, resolvePath } from "./paths";
import { applyTemplate } from "./template";
import { detectConflicts } from "./conflicts";
import { PeriodicJournalSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type Granularity, type NoteType, type PeriodicJournalSettings } from "./types";

/** Obsidian's `moment` is typed loosely here on purpose: the plugin only ever
 * needs `startOf`, `clone`, `add`, `subtract` and `format`, and pinning a full
 * moment type would drag a dependency in for five methods. */
type Moment = ReturnType<typeof moment>;

export interface ActiveNote {
	type: NoteType;
	date: Moment;
}

export default class PeriodicJournalPlugin extends Plugin {
	settings!: PeriodicJournalSettings;
	private lastSeenDate = "";
	private ribbonEl: HTMLElement | null = null;
	private registeredCommandIds = new Set<string>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.lastSeenDate = moment().format("YYYY-MM-DD");

		this.addSettingTab(new PeriodicJournalSettingTab(this.app, this));
		this.registerCommands();
		this.refreshRibbon();

		this.app.workspace.onLayoutReady(() => {
			this.warnAboutConflicts();
			if (this.settings.autoCreateOnStartup) {
				const delay = Math.max(0, Number(this.settings.startupDelaySeconds) || 0) * 1000;
				this.registerTimeout(window.setTimeout(() => void this.createDueNotes("startup"), delay));
			}
		});

		// One minute is plenty: the point is to notice the day rolling over on a
		// machine that stays awake, not to be precise about midnight.
		this.registerInterval(window.setInterval(() => this.checkDateChange(), 60 * 1000));
	}

	private registerTimeout(id: number): number {
		this.register(() => window.clearTimeout(id));
		return id;
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<PeriodicJournalSettings> | null;
		const defaults: PeriodicJournalSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		this.settings = Object.assign({}, defaults, saved ?? {});

		// An empty list is treated as "never configured" rather than as "wanted
		// nothing". A settings file that lost its types -- a failed sync, a hand
		// edit -- would otherwise leave a plugin that silently does nothing at all.
		if (!Array.isArray(this.settings.noteTypes) || this.settings.noteTypes.length === 0) {
			this.settings.noteTypes = defaults.noteTypes;
		}

		// Fill in fields an older settings file lacks; `autoCreate` defaults to false so
		// an upgrade never starts creating files unasked.
		this.settings.noteTypes = this.settings.noteTypes.map((type) =>
			Object.assign({ granularity: "day", enabled: true, autoCreate: false, template: "", format: "" }, type)
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.registerCommands();
		this.refreshRibbon();
	}

	enabledTypes(): NoteType[] {
		return this.settings.noteTypes.filter((type) => type.enabled);
	}

	typeById(id: string): NoteType | null {
		return this.settings.noteTypes.find((type) => type.id === id) ?? null;
	}

	/** The date whose note is "current" for this type -- today, this week, this quarter. */
	currentDateFor(type: NoteType): Moment {
		return moment().startOf(granularityOf(type.granularity).unit);
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		if (!folderPath) return;
		let current = "";
		for (const segment of folderPath.split("/").filter(Boolean)) {
			current = current ? `${current}/${segment}` : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing instanceof TFolder) continue;
			if (existing) throw new Error(`"${current}" exists but is not a folder`);
			try {
				await this.app.vault.createFolder(current);
			} catch (error) {
				// A concurrent create -- a sync service, another command -- is not a
				// failure. Re-check rather than trusting the exception.
				if (!this.app.vault.getAbstractFileByPath(current)) throw error;
			}
		}
	}

	private async readTemplate(templatePath: string): Promise<string> {
		if (!templatePath) return "";
		const path = normalizePath(templatePath.endsWith(".md") ? templatePath : `${templatePath}.md`);
		const file = this.app.vault.getAbstractFileByPath(path);
		// A missing template creates an EMPTY note and says so, rather than
		// refusing. Losing today's note because a template moved is the worse
		// failure; an empty note is visible and one paste away from correct.
		if (!(file instanceof TFile)) {
			new Notice(`Periodic Journal: template not found — ${path}`, 8000);
			return "";
		}
		return this.app.vault.cachedRead(file);
	}

	existingNote(type: NoteType, date: Moment): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(resolvePath(type, date));
		return file instanceof TFile ? file : null;
	}

	/** Create the note if it is missing, landing it at its final path with the template already applied. */
	async ensureNote(type: NoteType, date: Moment): Promise<{ file: TFile; created: boolean }> {
		const existing = this.existingNote(type, date);
		if (existing) return { file: existing, created: false };

		const path = resolvePath(type, date);
		await this.ensureFolder(parentFolderOf(path));

		const raw = await this.readTemplate(type.template);
		const content = applyTemplate(raw, date, basenameOf(path), () => moment());

		try {
			const file = await this.app.vault.create(path, content);
			return { file, created: true };
		} catch (error) {
			// Lost a race with a sync service or a second window. The note exists,
			// which is what was wanted -- report it as found rather than failing.
			const raced = this.app.vault.getAbstractFileByPath(path);
			if (raced instanceof TFile) return { file: raced, created: false };
			throw error;
		}
	}

	async openNote(type: NoteType, date: Moment, newLeaf = false): Promise<TFile | null> {
		try {
			const { file, created } = await this.ensureNote(type, date);
			if (created && this.settings.notifyOnCreate) new Notice(`Created ${file.path}`);
			await this.app.workspace.getLeaf(newLeaf).openFile(file, { active: true });
			return file;
		} catch (error) {
			console.error("[Periodic Journal] failed to open note", error);
			new Notice(`Periodic Journal: ${(error as Error).message}`, 8000);
			return null;
		}
	}

	/** Create every enabled auto-create type whose current note is missing, without letting one failure stop the rest. */
	async createDueNotes(reason: string): Promise<string[]> {
		const created: string[] = [];
		for (const type of this.enabledTypes()) {
			if (!type.autoCreate) continue;
			try {
				const result = await this.ensureNote(type, this.currentDateFor(type));
				if (result.created) created.push(type.name);
			} catch (error) {
				console.error(`[Periodic Journal] auto-create failed for "${type.name}"`, error);
				new Notice(`Periodic Journal: could not create ${type.name} — ${(error as Error).message}`, 8000);
			}
		}
		if (created.length && this.settings.notifyOnCreate) {
			new Notice(`Periodic Journal (${reason}): created ${created.join(", ")}`, 6000);
		}
		return created;
	}

	private checkDateChange(): void {
		const today = moment().format("YYYY-MM-DD");
		if (today === this.lastSeenDate) return;
		this.lastSeenDate = today;
		if (this.settings.autoCreateOnDateChange) void this.createDueNotes("new day");
	}

	/** Which periodic note, if any, the active file is, found by comparing candidate paths within IDENTIFY_SPANS. */
	identifyActiveNote(): ActiveNote | null {
		const file = this.app.workspace.getActiveFile();
		if (!file) return null;

		for (const type of this.enabledTypes()) {
			const unit = granularityOf(type.granularity).unit;
			const span = IDENTIFY_SPANS[type.granularity as Granularity] ?? IDENTIFY_SPANS.day;
			const anchor = moment().startOf(unit);
			for (let offset = -span; offset <= span; offset++) {
				const date = anchor.clone().add(offset, unit);
				if (resolvePath(type, date) === file.path) return { type, date };
			}
		}
		return null;
	}

	private async step(direction: 1 | -1): Promise<void> {
		const active = this.identifyActiveNote();
		if (!active) {
			new Notice("Periodic Journal: the active note is not one of your periodic notes");
			return;
		}
		const unit = granularityOf(active.type.granularity).unit;
		await this.openNote(active.type, active.date.clone().add(direction, unit));
	}

	registerCommands(): void {
		const wanted = new Set<string>();

		for (const type of this.enabledTypes()) {
			const commandId = `open-${type.id}`;
			wanted.add(commandId);
			this.addCommand({
				id: commandId,
				name: `Open current ${type.name.toLowerCase()}`,
				callback: () => void this.openNote(type, this.currentDateFor(type)),
			});
		}

		const fixed: [string, string, () => void][] = [
			["create-due-notes", "Create all due notes now", () => void this.createDueNotes("manual")],
			["next-note", "Next note of this kind", () => void this.step(1)],
			["previous-note", "Previous note of this kind", () => void this.step(-1)],
		];
		for (const [id, name, callback] of fixed) {
			wanted.add(id);
			this.addCommand({ id, name, callback });
		}

		// Drop commands left by a disabled or removed type; `removeCommand` is not public
		// API, so a build without it keeps the stale command instead of throwing.
		for (const commandId of this.registeredCommandIds) {
			if (wanted.has(commandId)) continue;
			const commands = (this.app as unknown as { commands?: { removeCommand?: (id: string) => void } }).commands;
			commands?.removeCommand?.(`${this.manifest.id}:${commandId}`);
		}
		this.registeredCommandIds = wanted;
	}

	refreshRibbon(): void {
		if (this.ribbonEl) {
			this.ribbonEl.remove();
			this.ribbonEl = null;
		}
		const type = this.typeById(this.settings.ribbonTypeId);
		if (!type || !type.enabled) return;
		this.ribbonEl = this.addRibbonIcon("calendar-days", `Open current ${type.name.toLowerCase()}`, () => {
			void this.openNote(type, this.currentDateFor(type));
		});
	}

	/** Everything else that might be creating these notes. See conflicts.ts. */
	conflicts(): string[] {
		const app = this.app as unknown as {
			internalPlugins?: { getPluginById?: (id: string) => { enabled?: boolean } | null };
			plugins?: {
				enabledPlugins?: { has?: (id: string) => boolean };
				plugins?: Record<string, { settings?: { folder_templates?: { folder?: string }[] } }>;
			};
		};

		const templater = app.plugins?.plugins?.["templater-obsidian"];
		return detectConflicts({
			dailyNotesEnabled: Boolean(app.internalPlugins?.getPluginById?.("daily-notes")?.enabled),
			periodicNotesEnabled: Boolean(app.plugins?.enabledPlugins?.has?.("periodic-notes")),
			templaterFolders: (templater?.settings?.folder_templates ?? [])
				.map((rule) => (rule?.folder ? normalizePath(rule.folder) : ""))
				.filter(Boolean),
			ownedFolders: this.enabledTypes()
				.map((type) => parentFolderOf(resolvePath(type, this.currentDateFor(type))))
				.filter(Boolean),
		});
	}

	private warnAboutConflicts(): void {
		const conflicts = this.conflicts();
		if (!conflicts.length) return;
		console.warn("[Periodic Journal] conflicts detected:", conflicts);
		new Notice(
			`Periodic Journal found ${conflicts.length} conflicting setting${conflicts.length === 1 ? "" : "s"}. See its settings tab.`,
			10000
		);
	}

	granularityLabel(type: NoteType): string {
		return granularityOf(type.granularity).label;
	}

	allGranularities(): [string, string][] {
		return Object.entries(GRANULARITIES).map(([key, meta]) => [key, meta.label]);
	}
}
