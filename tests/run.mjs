// Runs every *.test.cjs in this folder, in name order, in one process each.
import { execFileSync } from "child_process";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith(".test.cjs")).sort();

let failed = 0;
for (const file of files) {
	try {
		process.stdout.write(execFileSync(process.execPath, [join(here, file)], { encoding: "utf8" }));
	} catch (error) {
		failed++;
		process.stdout.write(error.stdout ?? "");
		process.stderr.write(error.stderr ?? "");
	}
}

if (failed) {
	console.error(`\n${failed} of ${files.length} suites FAILED`);
	process.exit(1);
}
console.log(`${files.length} suites passed`);
