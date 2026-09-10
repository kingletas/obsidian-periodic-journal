import type { Granularity } from "./types";

export interface GranularityMeta {
	label: string;
	/** The moment.js unit, used for both `startOf` and stepping. */
	unit: "day" | "week" | "month" | "quarter" | "year";
}

export const GRANULARITIES: Record<Granularity, GranularityMeta> = {
	day: { label: "Daily", unit: "day" },
	week: { label: "Weekly", unit: "week" },
	month: { label: "Monthly", unit: "month" },
	quarter: { label: "Quarterly", unit: "quarter" },
	year: { label: "Yearly", unit: "year" },
};

/** Falls back to `day` rather than throwing. A settings file can carry a
 * granularity this build does not know -- an older plugin version wrote it, or
 * somebody hand-edited `data.json` -- and refusing to load at all would lose the
 * other six note types over one bad string. */
export function granularityOf(value: string | undefined): GranularityMeta {
	return GRANULARITIES[value as Granularity] ?? GRANULARITIES.day;
}

/** Suffixes accepted in a template offset: `{{date+1w}}`, `{{date-2M}}`. */
export const OFFSET_UNITS: Record<string, "days" | "weeks" | "months" | "quarters" | "years" | undefined> = {
	d: "days",
	w: "weeks",
	M: "months",
	Q: "quarters",
	y: "years",
};

// How many periods either side of today `identifyActiveNote` generates candidate
// paths for, since a moment format cannot be parsed back into a date.
export const IDENTIFY_SPANS: Record<Granularity, number> = {
	day: 400,
	week: 60,
	month: 15,
	quarter: 6,
	year: 3,
};
