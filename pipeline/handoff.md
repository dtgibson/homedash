# Handoff — homedash

## What We Accomplished

Set the project up as a git repo (initial commit `57be79d`, pushed to the
private GitHub repo `dtgibson/homedash`), and registered it with Weft. Started
a Weft session, chose the **New Feature** lane, and put a recommendation on the
table for what the first build should be. No build has been started yet — the
recommendation was not answered, so no feature name has been committed and no
stage has run.

## What Has Been Saved

- `.gitignore` — macOS, Node, build output, env, editor
- `pipeline/project.json` — project id `25e420bd-fe3b-489e-b011-b2fc34506b9b`,
  name `homedash`, entry path `new`
- `pipeline/handoff.md` — this file

Not written, because no build has started: `pipeline/session-state.json`,
`pipeline.config.json`, and any `pipeline/<feature>/` artifacts.

## Where We Are

At the Weft lane fork, one step past the lane choice. Lane picked: **New
Feature**. Still open: which build to run, and (Studio) the per-build execution
mode, which has not been asked yet.

The recommendation on the table was: build homedash v1 whole — both display
modes over all four widgets — on the reasoning that the four widgets share one
data layer and the mode switcher is a founding decision, so splitting the work
would build that data layer twice. The alternative offered was starting
narrower (one mode, two widgets) to get something onto the new-tab page sooner.
The user paused here to switch to a different model, without answering.

The seven questions `product-brief.md` deliberately leaves for Stage 1:
delivery (local server vs. browser extension), weather source, eBird stats and
source, mode persistence mechanism, bookmarks storage, deployment pattern, and
text mode's ground colour (dark vs. light). `design/design-notes.md` flags that
last one as needing a decision before the mode-switching model is settled,
because it decides whether the build carries one theme axis or two.

## Design files — state of play

All seven files under `design/` are present and readable:

| File | Lines | Note |
|---|---|---|
| `Main.dc.html` | 268 | Rich mode "Dawn", 1440x900 |
| `DenseDark.dc.html` | 100 | Text mode, dark ground, 820x620 |
| `DenseLight.dc.html` | 100 | Text mode, light ground, 820x620 |
| `AltQuiet.dc.html` | 44 | Dropped third direction, kept for the record |
| `browser-start-page.html` | 11009 | The published canvas, ~2.5MB, self-contained |
| `canvas.json` | 38 | Artboard layout and annotations |
| `design-notes.md` | 68 | What was fixed, what is still a build concern |

**One finding worth carrying forward:** all four `.dc.html` artboards reference
`./support.js`, which is not in the repo. They therefore will not render
standalone in a browser — consistent with `design-notes.md` saying they were
never rendered in one. `browser-start-page.html` is the viewable artefact, and
is also published at
https://claude.ai/code/artifact/50008524-97ca-4007-a11e-1aaf45b432d6

Treat the artboards as a visual spec read as markup, not as a runnable
reference implementation, and do not copy their fixed pixel heights — the real
page is fluid.

## Resume Prompt

To resume: run `/weft` in this project. Because no build was started, it will
land back at the lane fork rather than mid-build — pick **New Feature** again
and answer the build question above.

---

Project: homedash — a personal browser start page (weather, bookmarks, eBird
year stats, llmdash headroom), single user, tailnet-only, two display modes
over one data source. Full context in `product-brief.md`. No code exists yet.
