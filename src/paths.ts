import { normalizePath } from "obsidian";
import type { NoteType } from "./types";

interface DateLike {
	format(pattern: string): string;
}

/** The whole vault-relative path for a type's note on a given date, with `[literal]` escaping carrying the folder. */
export function resolvePath(type: NoteType, date: DateLike): string {
	return normalizePath(`${date.format(type.format)}.md`);
}

export function parentFolderOf(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

export function basenameOf(path: string): string {
	const withoutExtension = path.replace(/\.md$/, "");
	const index = withoutExtension.lastIndexOf("/");
	return index === -1 ? withoutExtension : withoutExtension.slice(index + 1);
}

export function slugify(value: string): string {
	return (
		String(value)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "note-type"
	);
}

/** A readable id derived from the name, suffixed until no existing type uses it. */
export function uniqueId(name: string, taken: Iterable<string>): string {
	const used = new Set(taken);
	const base = slugify(name);
	if (!used.has(base)) return base;
	for (let n = 2; ; n++) {
		const candidate = `${base}-${n}`;
		if (!used.has(candidate)) return candidate;
	}
}
