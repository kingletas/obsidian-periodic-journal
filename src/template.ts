import { OFFSET_UNITS } from "./granularity";

// The core Templates `{{token}}` vocabulary; every date token resolves to the note's
// own date, and only `{{time}}` reads the clock.
export const TOKEN_PATTERN =
	/\{\{\s*(date|time|title|yesterday|tomorrow)((?:[+-]\d+[dwMQy])?)\s*(?::([^}]*))?\}\}/gi;

/** The units this file ever asks for. Narrower than moment's own union on
 * purpose: a structural interface typed with a bare `string` unit does not
 * accept a real `Moment`, because moment's own signature is narrower than
 * that -- so widening here would mean casting at every call site. */
export type OffsetUnit = "day" | "days" | "weeks" | "months" | "quarters" | "years";

export interface TemplateDate {
	clone(): TemplateDate;
	add(amount: number, unit: OffsetUnit): TemplateDate;
	subtract(amount: number, unit: OffsetUnit): TemplateDate;
	format(pattern: string): string;
}

export interface TemplateClock {
	(): { format(pattern: string): string };
}

/** Substitute the token vocabulary into a template's text, with `now` injected so `{{time}}` is testable. */
export function applyTemplate(
	content: string,
	date: TemplateDate,
	title: string,
	now: TemplateClock
): string {
	return content.replace(TOKEN_PATTERN, (_match, rawToken: string, rawOffset: string, rawFormat?: string) => {
		const token = rawToken.toLowerCase();
		if (token === "title") return title;

		const format = (rawFormat ?? "").trim();

		// `time` is the only token that means "now". Everything else is anchored
		// to the note's own date -- see the comment on TOKEN_PATTERN.
		if (token === "time") return now().format(format || "HH:mm");

		let value = date.clone();
		if (token === "yesterday") value = value.subtract(1, "day");
		if (token === "tomorrow") value = value.add(1, "day");

		if (rawOffset) {
			const amount = parseInt(rawOffset.slice(0, -1), 10);
			const unit = OFFSET_UNITS[rawOffset.slice(-1)];
			// A malformed offset leaves the date alone rather than throwing. The
			// alternative is a template that fails to render at all because of one
			// typo in one token, which loses the other forty lines of the note.
			if (unit && !Number.isNaN(amount)) value = value.add(amount, unit);
		}

		return value.format(format || "YYYY-MM-DD");
	});
}
