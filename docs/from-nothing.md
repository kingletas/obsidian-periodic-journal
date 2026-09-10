# From nothing to a working Periodic Journal

By the end of this page you'll have built the plugin from source, installed it in a throwaway vault, and watched it create its first daily note.

## Contents

- [What this is](#what-this-is)
- [What you need](#what-you-need)
- [Step 1: get the code and build it](#step-1-get-the-code-and-build-it)
- [Step 2: make a throwaway vault](#step-2-make-a-throwaway-vault)
- [Step 3: install the plugin into it](#step-3-install-the-plugin-into-it)
- [Step 4: turn it on and make your first note](#step-4-turn-it-on-and-make-your-first-note)
- [Where to go next](#where-to-go-next)

## What this is

Periodic Journal is an Obsidian plugin that creates your recurring notes for you: a daily note, a weekly note, or any other note that belongs to a day, week, month, quarter or year.

It replaces Obsidian's core Daily Notes plugin and the Periodic Notes plugin. The difference is that it has no fixed slots. Each kind of note is an entry in a list, so a second daily note, such as one for work and one for home, is just another entry.

## What you need

- Obsidian 1.4 or newer.
- git, Node.js 20 or 22 with npm, and GNU make.

Check the command-line tools are there:

```bash
node --version && npm --version && make --version | head -1 && git --version
```

```text
v20.20.2
10.8.2
GNU Make 4.3
git version 2.43.0
```

Your version numbers will differ. What matters is that Node starts with `v20` or `v22`, and none of the four says `command not found`.

## Step 1: get the code and build it

```bash
git clone https://github.com/kingletas/obsidian-periodic-journal
cd obsidian-periodic-journal
npm ci
```

The clone from GitHub is not verified: the repository wasn't published when this page was written, so the run below cloned a local copy instead. Everything after the clone was run for real.

`npm ci` installs exactly the package versions recorded in `package-lock.json`. It should end like this:

```text
added 17 packages, and audited 18 packages in 3s

1 package is looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Now build the plugin and run its tests:

```bash
make check
```

This type-checks the code, bundles it into `main.js`, and runs the test suite against that bundle. The end of a good run looks like this:

```text
template
  ok  {{title}} is the note's basename
  ok  {{date}} is the NOTE's date, not the current moment
  ...
  ok  every token in a document is substituted, not just the first
template: 14 passed
5 suites passed

  the bundle builds and the suite passes
```

If it stops with `sh: 1: tsc: not found`, you skipped `npm ci`. Run it and try again.

## Step 2: make a throwaway vault

This plugin creates files on its own, on a schedule. That's its job, so try it in a vault you don't care about before pointing it at your real notes.

1. Open Obsidian and choose **Create new vault**.
2. Call it `obsidian-sandbox` and put it in your home folder.

Obsidian creates a hidden `.obsidian` folder inside it. That's where plugins live.

This step is not verified here: it happens in Obsidian's window, which this page's test run didn't open.

## Step 3: install the plugin into it

Obsidian loads a plugin from `<vault>/.obsidian/plugins/<plugin id>/`, and it needs three files there: `main.js`, `manifest.json` and `styles.css`. From the `obsidian-periodic-journal` folder, copy them in:

```bash
VAULT=~/obsidian-sandbox
mkdir -p "$VAULT/.obsidian/plugins/periodic-journal"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/periodic-journal/"
ls "$VAULT/.obsidian/plugins/periodic-journal"
```

```text
main.js
manifest.json
styles.css
```

If you see those three names, the files are in place.

You may notice a `make install` target. It hands the copy to a helper script that isn't part of this repository, so on your machine the copy above is the way to do it.

## Step 4: turn it on and make your first note

1. In Obsidian, open **Settings → Community plugins**.
2. If you see **Restricted mode**, turn it off.
3. Find **Periodic Journal** in the list of installed plugins and switch it on.
4. Open **Settings → Periodic Journal**.

Turn plugins on through Obsidian's settings, not by editing `community-plugins.json`. Obsidian rewrites that file from memory when it quits, so a hand edit can vanish.

The plugin ships five note types. Only **Daily note** creates itself; the others wait until you ask. A few seconds after the plugin starts, you should see a new file named for today, such as `Journal/Daily/2026/03/2026-03-14.md`.

If nothing appears, open the command palette and run **Periodic Journal: Create all due notes now**.

If the settings page shows a warning at the top, another plugin is also creating daily notes. Turn that one off, because two plugins writing the same file looks like a bug in both.

This step is not verified here either. The test suite checks the default note types and how a format becomes a path, but nobody watched Obsidian create the file during this page's test run.

## Where to go next

- [README](../README.md) explains note types, template tokens and the known gotchas.
- [docs/architecture.md](architecture.md) explains how the pieces fit together.
- [CONTRIBUTING.md](../CONTRIBUTING.md) covers development and pull requests.
