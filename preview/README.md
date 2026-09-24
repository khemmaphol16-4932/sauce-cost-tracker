# Offline UI preview (not the real app)

Plain HTML/CSS/JS, no build step, no npm, no backend. Data lives in this
browser's `localStorage` only — nothing here talks to Supabase or Netlify.

**What it's for:** sketching and clicking through UI/UX ideas before building
them for real in the Next.js app (`../src`), so a change can be reviewed
without spending a Netlify build or waiting on this machine's local npm issues.
Costing math in `app.js` (`calcRecipeCost`) is ported from `../src/lib/costing.ts`
to keep numbers representative, but nothing here is wired to the real database
— treat anything built here as a mockup to copy the *idea* from, not code to
literally reuse.

**Run it:**
```bash
cd preview
python3 -m http.server 5504   # or any static file server
```
Or, in a Claude Code session with the Browser pane, `preview_start` with
`name: "ordexa-mockup"` — already registered in `.claude/launch.json` at the
repo root (spins up a small PowerShell static server, no Node/npm required,
since npm has been unreliable on some machines this project uses).

**Resetting data:** the Dashboard tab has a "Reset demo data" button.

**Printer test (`print-test.html`):** open on the shop computer in Chrome or
Edge to check the PeriPage A6 prints over Bluetooth (Web Serial) before relying
on the real app's Print station. Uses the same renderer and driver as the app
(`receipt.js` / `peripage.js` are type-stripped copies of `src/lib/receipt.ts`
and `src/lib/peripage.ts`).
