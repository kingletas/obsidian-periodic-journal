# Architecture

About 900 lines of TypeScript in seven modules, no runtime dependencies. One idea holds it together: **there are no fixed granularities — there is a list of note types.**

## The shape

```text
                 settings.ts  ── the list, edited
                      │
                      ▼
   types.ts  ── NoteType[]  ← the whole model
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
 granularity.ts   paths.ts     template.ts
  which date?    which path?   which content?
        └─────────────┼──────────────┘
                      ▼
                  main.ts
          ensureFolder → readTemplate → create
                      │
                      ▼
              conflicts.ts  ── who else is writing here?
```

| File | Responsibility |
|---|---|
| `types.ts` | `NoteType`, the settings shape, and the shipped defaults |
| `granularity.ts` | The five granularities, offset units, and the identify bounds |
| `paths.ts` | Format string to path; folder/basename splitting; id derivation |
| `template.ts` | The `{{token}}` vocabulary |
| `conflicts.ts` | What else might be creating these notes |
| `settings.ts` | The settings tab, including the live path preview |
| `main.ts` | The plugin: creation, the sweeps, commands, the ribbon |

## Five decisions worth knowing

### A list, not five slots

The plugins this replaces modelled the world as five hard-coded granularities, each with its own settings block. **That shape has no room for a second daily note** — and a vault wanting a work journal and a personal journal on the same day has to keep one of them by hand. It equally has no room for a mood tracker, a habit log, or a gratitude page: each is a daily note by every meaningful definition, and none of them is *the* daily note.

Here a note type is data. Adding an eighth recurring note is a settings action rather than a release, and the daily note is not privileged over the tracker.

### One format string for the whole path

`[Journal/Daily]/YYYY/MM/YYYY-MM-DD` covers folder and filename together, with `[literal]` escaping carrying the folder.

This is **deliberately the convention the core Daily Notes plugin and Periodic Notes already use.** Inventing a cleaner split — a folder field and a filename field — would have been marginally tidier and would have meant every existing format string had to be rewritten, and every existing note re-found. Migration costs nothing precisely because nothing changed shape.

The consequence is that the format is **one-way**: a moment format string is not a parser. Working out which periodic note you are standing in means generating candidates around today and comparing them, which is what `IDENTIFY_SPANS` bounds.

### Creation is one step

The folder is made, the template is read and substituted, and the file lands **at its final path, already filled in.**

Never at the vault root to be moved afterwards. That matters beyond tidiness: a note created at the root and moved is not a *creation* event in the folder it ends up in, which is why a Templater folder rule can appear to coexist with the old workflow and then fire the moment this plugin starts creating in place.

### `{{date}}` is the note's date, not now

The template vocabulary matches the core Templates plugin, because that is what existing templates are already written against — adopting a new syntax would mean rewriting every template in a vault to install one plugin.

**The one substantive difference is that `{{date}}` anchors to the note's own date.** Creating Monday's note on Tuesday happens every time a machine is asleep at midnight, and every time somebody backfills. A `{{date}}` meaning *now* would stamp the wrong day into the file, and stamp it invisibly.

`{{time}}` is the only token that means now, and it takes an injected clock rather than reading a global — a token that can only be checked against the real wall clock is a token nobody writes a test for.

### Everything fails soft, in one direction

This plugin writes files on a schedule, so the failure modes worth designing for are the quiet ones:

- **An existing note is never touched.** The sweep asks whether the current note exists and stops if it does, which is what makes running it three times a day safe.
- **A create that loses a race falls back to the file that won.** A sync service or a second window creating the note first is not an error — the note exists, which is what was wanted.
- **A concurrent folder create is re-checked rather than trusted to throw meaningfully.**
- **A missing template creates an empty note and says so.** Losing today's note because a template moved is the worse failure.
- **One failing type does not stop the others.** A bad format string on the quarterly note is no reason to lose today's daily note.
- **A malformed template offset leaves the date alone rather than throwing.** One typo in one token must not cost the other forty lines of the note.
- **An unknown granularity falls back to `day`.** A settings file can carry a string this build does not know; refusing to load would lose the other six types over one bad value.

## Conflict detection

This plugin is meant to be the **only** thing creating these notes. If the core Daily Notes plugin, Periodic Notes, or a Templater folder template still covers the same ground, two things write the same file — and the result looks exactly like a bug in here.

`conflicts.ts` is pure and takes a `ConflictProbe` rather than an `App`. Every input it needs is an **undocumented internal** — `app.internalPlugins`, `app.plugins.enabledPlugins`, another plugin's `settings.folder_templates` — and typing them as `App` would claim a stability none of them has. Reading them lives in `main.ts`, in one clearly-marked cast; deciding lives here, where it can be tested.

**The Templater case is the subtle one and the one that actually happened.** A folder rule fires on file *creation*, so it inserts its template a second time, **unsubstituted**, because Templater never sees the `{{date:…}}` syntax these templates use. The note reads as corrupted rather than as duplicated. A rule on a *parent* folder reaches everything below it, so the match is a prefix test — with a trailing-slash guard so `Journal` does not match `Journal Archive`.

## Testing

The suite `require()`s an esbuild bundle rather than the TypeScript sources, because the bundle is the only thing Obsidian ever loads.

**`moment` is deliberately not stubbed as a working clock.** The plugin gets its moment from Obsidian at runtime, so a test that pulled its own copy in would be testing a different library than the one that ships. The stub throws, and anything needing a date takes an injected one — `tests/harness.cjs` carries a small stand-in with only the methods this plugin uses.

`tests/reserved.test.cjs` is here even though this plugin has no view. Two sibling plugins lost releases to a method silently shadowing an undocumented Obsidian internal — `View.open`, which `tsc` cannot catch because it is absent from the public typings. **The day this plugin grows its first view is the day the guard needs to already exist**; porting it after the fact is exactly what did not happen the second time.
