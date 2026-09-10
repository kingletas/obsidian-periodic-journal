// The smallest test harness that prints like the other plugins here.
const assert = require("assert");
const { join } = require("path");

let passed = 0;
let failed = 0;
let name = "";

function suite(title) {
	name = title;
	console.log(`\n${title}`);
}

function test(label, fn) {
	try {
		fn();
		passed++;
		console.log(`  ok  ${label}`);
	} catch (error) {
		failed++;
		console.log(`  FAIL ${label}`);
		console.log(String(error.message).split("\n").map((l) => `       ${l}`).join("\n"));
	}
}

function done() {
	console.log(`${name}: ${passed} passed${failed ? `, ${failed} FAILED` : ""}`);
	if (failed) process.exit(1);
}

const load = (mod) => require(join(__dirname, "build", `${mod}.cjs`));

// A minimal moment stand-in; the plugin takes moment from Obsidian at runtime, so the
// tests carry no copy of their own.
function day(iso) {
	const ms = Date.parse(`${iso}T00:00:00Z`);
	const UNITS = { day: 864e5, days: 864e5, weeks: 7 * 864e5 };
	const api = {
		_ms: ms,
		clone: () => day(new Date(api._ms).toISOString().slice(0, 10)),
		add(amount, unit) {
			if (UNITS[unit]) return day(new Date(api._ms + amount * UNITS[unit]).toISOString().slice(0, 10));
			const d = new Date(api._ms);
			if (unit === "months") d.setUTCMonth(d.getUTCMonth() + amount);
			if (unit === "quarters") d.setUTCMonth(d.getUTCMonth() + amount * 3);
			if (unit === "years") d.setUTCFullYear(d.getUTCFullYear() + amount);
			return day(d.toISOString().slice(0, 10));
		},
		subtract: (amount, unit) => api.add(-amount, unit),
		// Enough of moment's vocabulary for these tests: [literal] escaping, and
		// the tokens the default formats use.
		format(pattern) {
			const d = new Date(api._ms);
			const pad = (n) => String(n).padStart(2, "0");
			const parts = {
				YYYY: String(d.getUTCFullYear()),
				YY: pad(d.getUTCFullYear() % 100),
				MM: pad(d.getUTCMonth() + 1),
				DD: pad(d.getUTCDate()),
				Q: String(Math.floor(d.getUTCMonth() / 3) + 1),
			};
			let out = "";
			for (let i = 0; i < pattern.length; ) {
				if (pattern[i] === "[") {
					const end = pattern.indexOf("]", i);
					out += pattern.slice(i + 1, end);
					i = end + 1;
					continue;
				}
				const key = Object.keys(parts).find((k) => pattern.startsWith(k, i));
				if (key) {
					out += parts[key];
					i += key.length;
					continue;
				}
				out += pattern[i];
				i++;
			}
			return out;
		},
	};
	return api;
}

const clock = (hhmm) => () => ({ format: (pattern) => (pattern === "HH:mm" ? hhmm : `<${pattern}>`) });

module.exports = { assert, suite, test, done, load, day, clock };
