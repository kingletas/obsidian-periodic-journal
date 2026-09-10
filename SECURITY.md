# Security Policy

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private vulnerability reporting on this repository (*Security* → *Report a vulnerability*), or email **code@kingletas.com**.

Include what you did, what happened, and what you expected. A proof of concept is welcome but not required — a clear description of the flaw is more useful than a working exploit.

This is a personal project maintained by one person, so please expect a first response in days rather than hours. You will get an acknowledgement, an assessment, and credit in the changelog unless you would rather not be named.

## Supported versions

The latest release on `main` is the supported version. There are no long-term support branches; fixes ship forward.

## What it touches

This plugin **creates files in your vault, on a schedule, without being asked.** That is its entire purpose, and it is the right place to start an audit.

| Surface | What it means |
|---|---|
| **Note creation** | New notes at paths your format strings resolve to, on startup and at date rollover. Folders are created as needed |
| **Templates** | Any note you name as a template is read and substituted into the new note |
| **Path formats** | A moment.js pattern that decides where a file lands. Anything that can write `data.json` decides where this plugin writes |
| **Other plugins' config** | Read-only, and only to detect a conflict — the core Daily Notes plugin's enabled state, Periodic Notes', and Templater's folder rules |
| **The network** | Nothing. There is no network code in the bundle |

Four properties exist deliberately and should not be quietly removed:

- **Nothing is ever overwritten.** The sweep asks whether the current note exists and stops if it does. A create that loses a race to a sync service falls back to the file that won rather than replacing it. **An existing note is never touched**, which is what makes running the sweep three times a day safe.
- **A missing template creates an empty note and says so**, rather than refusing. Losing today's note because a template moved is the worse failure; an empty note is visible and one paste away from correct.
- **One failing type does not stop the others.** A bad format string on the quarterly note is no reason to lose today's daily note, so each type is created inside its own try.
- **`autoCreate` defaults to false when a stored type is missing the field**, even where a shipped default says true. Inheriting a new *writing* behaviour on upgrade is not something to do to somebody's vault quietly.

## In scope

- A write reaching a path the configured format does not resolve to, including path traversal out of the vault through a format string or a literal segment
- An existing note being overwritten, truncated, or replaced by the creation sweep
- Template content being read from outside the vault
- A creation happening when every type is disabled or auto-create is off
- Any network call reaching the bundle, by any path including a dependency
- Reading more of another plugin's configuration than the conflict check needs

## Out of scope

- Vulnerabilities in Obsidian itself, or in its plugin model. Report those to Obsidian
- Findings that require an attacker who already has your filesystem or write access to your vault — at that point the plugin is the least of it
- The plugin declining to do something you enabled deliberately
- A deleted note being recreated by the next sweep. That is what auto-create means; turn it off for that type

## If you are running it

- **A format string decides where files land.** Treat `data.json` as configuration that writes: anything that can edit it can make this plugin create notes anywhere in your vault.
- **Check the conflict banner before trusting anything.** If the core Daily Notes plugin, Periodic Notes or a Templater folder rule still covers the same ground, two things are writing one file — and a Templater folder rule in particular inserts its template a second time, unsubstituted, which reads as a corrupted note rather than a duplicated one.
- **Turn off _Create automatically_ for anything you would rather opt into by hand.** A deleted note comes back on the next sweep.
