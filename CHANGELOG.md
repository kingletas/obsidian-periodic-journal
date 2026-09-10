# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **A release workflow.** Pushing a tag equal to the manifest's version, such as `1.2.0`, builds and tests that commit, then publishes a GitHub release with `main.js`, `manifest.json` and `styles.css` attached, and the matching CHANGELOG section as its notes. It refuses a tag that disagrees with `manifest.json`, `package.json` or `versions.json`.

### Changed

- **CI runs `make check`**, the same gate a commit runs, on Ubuntu with Node 20 and 22. The macOS and Windows jobs are gone.
- **`make install` and `make plan` need a vault named.** They used to default to a folder on the author's machine, which doesn't exist anywhere else. Run `make install VAULT=/path/to/test-vault`; without `VAULT` both stop with a usage message.

## [1.1.0]

### Changed

- **The plugin has a source tree again.** 1.0.0 shipped as a single hand-written `main.js` with no build, no types and no tests — the file Obsidian loads *was* the source, so there was nothing to review and nothing to check. It is now TypeScript in six modules, bundled by esbuild, type-checked strict, and covered by **51 assertions across five suites**.
  - `types.ts` · `granularity.ts` · `paths.ts` · `template.ts` · `conflicts.ts` · `settings.ts` · `main.ts`
  - The pure half — path resolution, the token vocabulary, conflict detection — is now testable without a running Obsidian, which is most of the logic that can be wrong.
- **No default names one vault's folders any more.** The shipped types are five generic ones, one per granularity, with no template paths. **This plugin writes files**, so a folder name shipped as a default is a tree appearing in somebody's vault on first launch — worse than a default that merely misleads.
- **Only one shipped type creates notes without being asked.** A fresh install should not start writing five notes a day.
- **A new note type ships disabled**, rather than active with a placeholder path.
- **Note-type ids are derived from the name** — `open-morning-pages` rather than `open-custom-m0x2k`. The id is what a command keys on, and a command somebody might bind a hotkey to should be recognisable a year later. Collisions get a numeric suffix; two note types called "Journal" is an ordinary thing to want.

### Added

- A licence, a contributing guide, a security policy, an architecture document, a `versions.json`, and CI that builds and checks the three files Obsidian actually loads.
- **`tests/reserved.test.cjs`**, even though this plugin has no view. Two sibling plugins lost releases to a method silently shadowing an undocumented Obsidian internal, and the day this one grows its first view is the day the guard needs to already exist. Porting it after the fact is exactly what did not happen the second time.

### Fixed

- **`slugify` was dead code.** It was written, never called, and the *Add note type* button used a timestamp instead. It now does the job it was written for.

### Security

- **`autoCreate` is not inherited on upgrade.** A stored type missing the field gets `false`, even where a shipped default says `true`. Picking up a new *writing* behaviour silently is not something to do to somebody's vault.

## [1.0.0]

### Added

- **Periodic Journal** — one plugin for every recurring note.
  - **There are no fixed granularities; there is a list of note types.** Each carries its own granularity, path format, template and auto-create flag, so every note is the same kind of object and nothing is privileged. The model it replaces had five fixed slots and therefore **no room for a second daily note** — split a journal into work and personal and one of them has no automation at all.
  - **One format string covers the whole vault-relative path**, with the folder carried in `[square brackets]`. Deliberately the same convention the core Daily Notes plugin and Periodic Notes already use, so every existing format string carries over verbatim and nothing moves.
  - **Creation is one step.** The folder is made, the template is read and substituted, and the file lands at its final path already filled in — never at the vault root to be moved afterwards.
  - **`{{date}}` is the note's own date, not the wall clock.** Creating Monday's note on Tuesday happens every time a machine is asleep at midnight, and every time somebody backfills.
  - **Conflict detection for the three things that also create these notes**: the core Daily Notes plugin, Periodic Notes, and a Templater folder rule. Two things writing one file looks exactly like a bug in here, so it is named at the top of the settings tab and once as a notice on load.
  - Automatic creation on startup (after a configurable delay, so a sync service settles first), at date rollover, and on demand.
  - Next/previous stepping by the active note's own granularity.
