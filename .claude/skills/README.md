# Agent skills for limna-web

Vendored Claude Code skills, picked up automatically by any Claude Code session opened in this repo.
`.claude/` starts with a dot, so GitHub Pages (Jekyll) does not publish it to limna.se.

| Skill folder | What it does | Source (commit) | License |
|---|---|---|---|
| `design-taste-frontend/` | "taste-skill" 2.5.1: rules + browser checks for non-generic sites, with a finish gate | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/taste-skill` (6c0b5c7) | MIT |
| `image-to-code/` | Design an image first, then build the page to match it | [Leonxlnx/imagegen-skills](https://github.com/Leonxlnx/imagegen-skills) `skills/image-to-code` (beb16b0) | MIT |
| `web-design-guidelines/` | Audit UI code against Vercel's Web Interface Guidelines (bundled, offline) | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` (5a37a63) | MIT |
| `playwright-cli/` | Drive a real browser from the shell: open, click, snapshot, screenshot | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) `skills/playwright-cli` (c872a33) | Apache-2.0 |
| `design-md-library/` | 84 DESIGN.md design-system write-ups as reference, wrapped in a small skill | [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) `design-md/` (fcc7028) | MIT |

Each folder keeps its upstream LICENSE. Files are unmodified copies except the new `design-md-library/SKILL.md`
and `web-design-guidelines/LICENSE` (upstream states MIT only in its README).

## Setup a session needs

- **Node 22+** for taste-skill scripts (`node -v`).
- **Chrome/Chromium** for taste-skill's checkers. Set `CHROME_PATH` if it is not found
  (in Claude Code cloud: `export CHROME_PATH=/opt/pw-browsers/chromium` or the binary inside it). ffmpeg is optional.
- **playwright-cli**: `npm install -g @playwright/cli@latest`, then `playwright-cli open http://localhost:8000`.
  Serve the site first with `python3 -m http.server 8000` from the repo root.
- No API keys anywhere.

## Things to know

- **taste-skill Stop hook.** While the skill is in use, its frontmatter registers a Stop hook that runs
  `scripts/gate.mjs --hook claude`. It only does anything after a build has been armed with
  `gate.mjs --start` (state in `.taste-skill/`, git-ignored); otherwise it exits at once. It may block a stop
  a few times while its checks FAIL, then gives up by design. `node <skill>/scripts/gate.mjs --done "<reason>"`
  ends a build. No extra `settings.json` is needed: the folder is named `design-taste-frontend` so the hook's
  `$CLAUDE_PROJECT_DIR/.claude/skills/design-taste-frontend/...` path resolves.
- **taste-skill's own taste vs. Limna's.** It pushes "real photographs", "one section per screen" and
  "scroll scenes only for tech sites". Limna's filmed-field scroll scene is a deliberate choice by the team;
  where the skill's rules clash with it, the team's direction wins (waive in `.taste-skill/waivers.json`).
- **Network use (reviewed).** No telemetry. Scripts only reach: local headless Chrome (127.0.0.1),
  Wikimedia Commons / picsum.photos (`photos.mjs`, stock photos), jsDelivr icon sets (`icons.mjs`),
  Google Fonts (`start.mjs`). playwright-cli output goes to `.playwright-cli/` (git-ignored; may hold cookies).
- **image-to-code** was written for Codex, which can generate images. Claude Code sessions here have no image
  generator, so use it with images you supply (screenshots, sketches, AI renders you made elsewhere).

## Updating

Re-copy the folder from upstream at a newer commit, keep the LICENSE file, and update the table above.
