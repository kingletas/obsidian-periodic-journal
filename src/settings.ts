import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type PeriodicJournalPlugin from "./main";
import { resolvePath, uniqueId } from "./paths";
import { DEFAULT_SETTINGS, type Granularity, type NoteType } from "./types";

/** Renders the bold and inline-code spans the conflict messages use, which `setText` would show as literal markup. */
function renderInline(el: HTMLElement, text: string): void {
	const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
	let cursor = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > cursor) el.appendText(text.slice(cursor, match.index));
		const token = match[0];
		if (token.startsWith("**")) el.createEl("strong", { text: token.slice(2, -2) });
		else el.createEl("code", { text: token.slice(1, -1) });
		cursor = match.index + token.length;
	}
	if (cursor < text.length) el.appendText(text.slice(cursor));
}

class TemplateSuggest extends AbstractInputSuggest<TFile> {
	constructor(app: App, private readonly input: HTMLInputElement) {
		super(app, input);
	}

	getSuggestions(query: string): TFile[] {
		const needle = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.toLowerCase().includes(needle))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.input.value = file.path;
		this.input.trigger("input");
		this.close();
	}
}

export class PeriodicJournalSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: PeriodicJournalPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderConflicts(containerEl);
		this.renderActions(containerEl);
		this.renderGlobalSettings(containerEl);

		new Setting(containerEl).setName("Note types").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text:
				"The format is a moment.js pattern covering the whole vault-relative path without the .md extension. " +
				"Anything in square brackets is literal — that is how the folder is carried, e.g. [Journal/Daily]/YYYY/MM/YYYY-MM-DD.",
		});

		this.plugin.settings.noteTypes.forEach((type, index) => this.renderType(containerEl, type, index));

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Add note type")
				.setCta()
				.onClick(async () => {
					const name = "New note type";
					this.plugin.settings.noteTypes.push({
						// Derived from the name, not from a timestamp: the id is what a
						// command keys on, and `open-morning-pages` is a command somebody
						// can bind a hotkey to and recognise later.
						id: uniqueId(name, this.plugin.settings.noteTypes.map((t) => t.id)),
						name,
						granularity: "day",
						format: "[Folder]/YYYY-MM-DD",
						template: "",
						// Off, and not creating anything, until it has been looked at. A
						// new type appearing and immediately writing a file into a folder
						// the person has not chosen is the wrong first impression.
						enabled: false,
						autoCreate: false,
					});
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}

	private renderConflicts(containerEl: HTMLElement): void {
		const conflicts = this.plugin.conflicts();
		if (!conflicts.length) return;
		const box = containerEl.createDiv({ cls: "periodic-journal-warning" });
		box.createEl("div", {
			text: "Something else is still creating these notes",
			cls: "periodic-journal-heading",
		});
		const list = box.createEl("ul");
		for (const conflict of conflicts) renderInline(list.createEl("li"), conflict);
	}

	private renderActions(containerEl: HTMLElement): void {
		const actions = containerEl.createDiv({ cls: "periodic-journal-actions" });

		actions.createEl("button", { text: "Create all due notes now" }).addEventListener("click", async () => {
			const created = await this.plugin.createDueNotes("manual");
			if (!created.length) new Notice("Periodic Journal: everything already exists");
			this.display();
		});

		actions.createEl("button", { text: "Restore default note types" }).addEventListener("click", async () => {
			this.plugin.settings.noteTypes = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.noteTypes));
			await this.plugin.saveSettings();
			this.display();
		});
	}

	private renderGlobalSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Automation").setHeading();

		new Setting(containerEl)
			.setName("Create due notes on startup")
			.setDesc("When Obsidian opens, create any missing note for the current period.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoCreateOnStartup).onChange(async (value) => {
					this.plugin.settings.autoCreateOnStartup = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Startup delay")
			.setDesc(
				"Seconds to wait after layout is ready. A few seconds lets a sync service settle first, so a note that already exists on another device is not created twice."
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 30, 1)
					.setValue(Number(this.plugin.settings.startupDelaySeconds) || 0)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.startupDelaySeconds = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Create due notes when the date rolls over")
			.setDesc("Checks every minute, so leaving Obsidian open overnight still produces the next day's notes.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoCreateOnDateChange).onChange(async (value) => {
					this.plugin.settings.autoCreateOnDateChange = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Show a notice when notes are created").addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.notifyOnCreate).onChange(async (value) => {
				this.plugin.settings.notifyOnCreate = value;
				await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl)
			.setName("Ribbon icon opens")
			.setDesc("Which note the calendar icon in the left ribbon opens.")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "No ribbon icon");
				for (const type of this.plugin.enabledTypes()) dropdown.addOption(type.id, type.name);
				dropdown.setValue(this.plugin.settings.ribbonTypeId || "");
				dropdown.onChange(async (value) => {
					this.plugin.settings.ribbonTypeId = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderType(containerEl: HTMLElement, type: NoteType, index: number): void {
		const box = containerEl.createDiv({
			cls: `periodic-journal-type${type.enabled ? "" : " is-disabled"}`,
		});

		const heading = box.createDiv({ cls: "periodic-journal-heading" });
		heading.createSpan({ text: type.name || "(unnamed)" });
		heading.createSpan({ cls: "periodic-journal-badge", text: this.plugin.granularityLabel(type) });
		if (type.autoCreate && type.enabled) heading.createSpan({ cls: "periodic-journal-badge", text: "auto" });

		new Setting(box).setName("Enabled").addToggle((toggle) =>
			toggle.setValue(type.enabled).onChange(async (value) => {
				type.enabled = value;
				await this.plugin.saveSettings();
				this.display();
			})
		);

		new Setting(box).setName("Name").addText((text) =>
			text.setValue(type.name).onChange(async (value) => {
				type.name = value;
				await this.plugin.saveSettings();
			})
		);

		new Setting(box)
			.setName("Repeats")
			.setDesc("Decides which date the note belongs to, and what next/previous step through.")
			.addDropdown((dropdown) => {
				for (const [key, label] of this.plugin.allGranularities()) dropdown.addOption(key, label);
				dropdown.setValue(type.granularity);
				dropdown.onChange(async (value) => {
					type.granularity = value as Granularity;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		// The preview is the whole reason a format string is editable here rather
		// than in data.json: a moment pattern is easy to get subtly wrong, and the
		// mistake otherwise shows up tomorrow as a note in the wrong folder.
		let previewEl: HTMLElement | null = null;
		const updatePreview = (): void => {
			if (!previewEl) return;
			previewEl.empty();
			previewEl.removeClass("is-error");
			previewEl.removeClass("is-ok");
			try {
				const date = this.plugin.currentDateFor(type);
				const path = resolvePath(type, date);
				const exists = Boolean(this.plugin.existingNote(type, date));
				if (exists) previewEl.addClass("is-ok");
				previewEl.setText(`${path}${exists ? "  ✓ exists" : "  — will be created"}`);
			} catch (error) {
				previewEl.addClass("is-error");
				previewEl.setText((error as Error).message);
			}
		};

		new Setting(box)
			.setName("Path format")
			.setDesc("moment.js format for the full path, no extension. Square brackets are literal text.")
			.addText((text) => {
				text.inputEl.style.width = "100%";
				text.setValue(type.format).onChange(async (value) => {
					type.format = value;
					updatePreview();
					await this.plugin.saveSettings();
				});
			});

		const preview = new Setting(box).setName("Resolves to");
		previewEl = preview.descEl.createDiv({ cls: "periodic-journal-preview" });
		updatePreview();

		new Setting(box)
			.setName("Template")
			.setDesc(
				"Vault path to the template. {{title}}, {{date}}, {{time}}, {{yesterday}}, {{tomorrow}} and offsets like {{date+1w:gggg-[W]ww}} are substituted."
			)
			.addText((text) => {
				text.inputEl.style.width = "100%";
				text.setPlaceholder("Templates/Daily.md");
				text.setValue(type.template).onChange(async (value) => {
					type.template = value;
					await this.plugin.saveSettings();
				});
				new TemplateSuggest(this.app, text.inputEl);
			});

		new Setting(box)
			.setName("Create automatically")
			.setDesc("Include this type when notes are created on startup and at date rollover.")
			.addToggle((toggle) =>
				toggle.setValue(type.autoCreate).onChange(async (value) => {
					type.autoCreate = value;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		new Setting(box)
			.addExtraButton((button) =>
				button
					.setIcon("lucide-file-plus")
					.setTooltip("Open the current note of this type")
					.onClick(() => void this.plugin.openNote(type, this.plugin.currentDateFor(type)))
			)
			.addExtraButton((button) =>
				button
					.setIcon("lucide-arrow-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(async () => {
						const types = this.plugin.settings.noteTypes;
						[types[index - 1], types[index]] = [types[index], types[index - 1]];
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon("lucide-arrow-down")
					.setTooltip("Move down")
					.setDisabled(index === this.plugin.settings.noteTypes.length - 1)
					.onClick(async () => {
						const types = this.plugin.settings.noteTypes;
						[types[index + 1], types[index]] = [types[index], types[index + 1]];
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addExtraButton((button) =>
				button
					.setIcon("lucide-trash-2")
					.setTooltip("Remove this note type")
					.onClick(async () => {
						this.plugin.settings.noteTypes.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}
}
