# Ordexa — Product Requirements & Roadmap (for plan review)

**Date:** 2026-09-24
**Status:** Proposed — awaiting an independent plan review before further build work.
**Repo state this describes:** `master` at `8f5d47b` locally; `origin/master` is 2 commits behind (`76b4e18`). The owner pushes manually — **do not push**.
**Companion doc:** `docs/audit-2026-08.md` (correctness/efficiency audit; several findings below reference it by F-number).

---

## 0. Instructions for the reviewing agent

You are asked to **evaluate this plan, not implement it**. Deliver a review (format in §10). Before judging anything:

1. Read `AGENTS.md` (multi-session rules, migration conventions) and `docs/audit-2026-08.md`.
2. **Verify claims against the code** — every "current state" statement below cites a file or commit. If a claim is wrong, say so; that is the most valuable finding you can make.
3. Treat this document's recommendations as proposals from one agent session. Challenge ordering, scope, and technical choices; propose alternatives with reasons.
4. Environment constraints you will hit: `npm ci` fails on the owner's Windows machine (registry `ECONNRESET`), so the only build check is GitHub Actions (`.github/workflows/build.yml`, runs `next build` on push/PR to `master`). There are no tests. Next.js is 16.x — read `node_modules/next/dist/docs/` before asserting API behaviour.

---

## 1. Product context

- **Business:** one small Thai sauce maker (bottled sauces), 1–2 people. Sells in person ("self"), and on TikTok Shop, Shopee, Lazada. Currency THB, timezone Asia/Bangkok.
- **Hardware in use:** iPhone (iOS Safari) to key orders; a Windows shop computer; **PeriPage A6 (203 dpi, 384 dots) thermal printer with plain receipt paper**, reachable by **Bluetooth or USB** from the computer.
- **Business goal:** run the owner's own shop well now; **offer Ordexa as a paid subscription to other small food makers later.** The app must be easy for a beginner and grow to professional use.
- **Stack:** Next.js 16 (App Router, server actions), React 19, Supabase (Postgres + RLS + Auth with Google OAuth), Tailwind 4, Recharts. Hosted on Netlify (auto-deploys `master`). `preview/` is a no-build offline HTML/JS mockup used to click through UI ideas.

## 2. Current state

### 2.1 Live on production (`origin/master`)
| Area | What | Where |
|---|---|---|
| Core | Ingredients, purchases (incl. multi-line "purchase trip"), recipes with costing (yield, evaporation, waste, labour, overhead, packaging, VAT, platform fee), batches with yield variance, finished-goods stock, sales, daily cash closing, expenses, analytics, CSV export, multiple businesses per login | `src/app/*`, `src/lib/costing.ts` |
| Phone UX | 5-tab bottom bar (Home · Sell · Make · Stock · More) with icons; Batches+Recipes under Make; Sign out moved to More; 44px tap targets | `src/components/tab-bar.tsx`, `make-switcher.tsx` |
| Sell | Tap-to-add cart → one checkout sheet (platform/payment chips, adjusted total spread across lines) → single multi-row insert so the stock trigger deducts all lines or none | `src/app/sales/sell-cart.tsx`, `logCartSale` in `src/app/sales/actions.ts` |
| Dates | "Today" computed in Asia/Bangkok everywhere (was UTC → early-morning sales landed on yesterday) | `src/lib/dates.ts` |
| PWA | 192/512 icons; manifest + icons excluded from the auth proxy | `src/app/icons/[size]/route.tsx`, `src/proxy.ts` |
| Bag label (phone path) | Shop profile (logo, address, phone, LINE, thank-you line) in More → Shop & label; label = logo + shop + customer name large + items + total; after Charge a **Print label** button opens the iOS Share Sheet → PeriPage app | `src/lib/receipt.ts`, `src/app/settings/*`, commit `7c02231` |

### 2.2 Committed locally, NOT pushed
| Commit | What |
|---|---|
| `35f3156` | **Print station**: checkout queues a `print_jobs` row when Shop & label → *Print on* = Shop computer; `/print-station` (Chrome/Edge on the Windows PC) connects to the A6 via **Web Serial**, receives jobs via Supabase realtime (+15 s poll), prints with no taps on the phone. A6 raster driver in `src/lib/peripage.ts`. |
| `8f5d47b` | `preview/print-test.html` — stand-alone printer test page (same renderer + driver, type-stripped copies). A bundled single-file copy was given to the owner. |

### 2.3 Migrations
| File | Status | Notes |
|---|---|---|
| `0001`–`0019` | Applied (per repo history) | **`0016_made_to_order_recipes.sql` is absent from the repo** although the audit says it was applied to production — reviewer: reconcile (prod schema vs repo). |
| `0020_business_receipt_profile.sql` | **Not yet applied** (owner action) | Code tolerates absence: name-only receipts. |
| `0021_print_jobs.sql` | **Not yet applied**, requires 0020 | Adds `print_jobs` (RLS `user_id = auth.uid()`), `businesses.print_target`, adds table to `supabase_realtime` publication. |

### 2.4 Unverified
- **Nothing in the print-station path has run against a physical printer.** Byte stream verified only structurally in a browser (e.g. 306-row label → blocks of 255 + 51 rows, 14.7 KB, correct headers).
- USB connection mode (owner's new information) has not been evaluated at all — see §6.3.

---

## 3. Goals and non-goals

**Goals**
1. A beginner gets a correct cost-per-bottle within 5 minutes of first sign-in.
2. A common sale takes ≤ 2 taps on the phone and prints a personalised bag label without further interaction.
3. Every number (cost, margin, stock, cash) is trustworthy and explainable — professionals leave the first time a number is wrong.
4. The data model supports multiple people per business and strict tenant isolation, so a subscription product can launch without a rewrite.

**Non-goals (for now):** restaurant POS concepts (table service, modifiers, kitchen routing, staff/manager dual UI), general-ledger accounting, payroll, native mobile apps, marketplace API integrations (CSV import first).

## 4. Product principles

1. **Simple by default, powerful when switched on.** New businesses see Sell, Stock, Recipes. Batches, best-before, platform fees, VAT, team accounts are per-business feature toggles the app suggests when relevant (e.g. offer platform fees after the first Shopee sale).
2. **Summary first, detail on demand.** Kitchen language, not accounting jargon; a "?" explainer on every derived number.
3. **Recover, don't confirm.** Prefer undo over "Are you sure?".
4. **Snapshot at write time.** Cost basis is frozen onto batches/sales when they happen (existing convention — keep it).
5. **Thai-first** copy for the owner's market, English available.

---

## 5. Roadmap and requirements

Priorities: **P0** must precede everything after it; later phases are ordered by the author's judgement — the reviewer should challenge this.

### P0-A — Finish and verify label printing (in progress)
| ID | Requirement | Acceptance |
|---|---|---|
| PRN-01 | Verify A6 prints over **Bluetooth** via `preview/print-test.html` on the Windows PC | Test label prints; Thai text legible; label length correct; ≤ 10 s |
| PRN-02 | Evaluate **USB** as the station transport (§6.3) and pick the default | Documented decision + working test print |
| PRN-03 | Owner applies 0020 then 0021; push `35f3156`/`8f5d47b` only after PRN-01/02 pass | Sale on iPhone → label prints on PC with no phone taps |
| PRN-04 | Station resilience | Printer off → job `failed` with message + Retry; PC asleep → jobs print on wake; duplicate prints impossible (claim is a single UPDATE … RETURNING) |
| PRN-05 | Tune print quality on real paper | `INK_THRESHOLD`, bold-at-1:1 and density byte adjusted from a real print |

### Phase 0 — Trustworthy numbers (from the audit; mostly invisible to users)
| ID | Requirement | Evidence it's still open |
|---|---|---|
| COR-01 | Unit tests for `calcRecipeCost` incl. zero-yield (F10) and a golden spreadsheet fixture | No test files or runner in `package.json` |
| COR-02 | Void sale: restore stock and delete atomically (F2) | `deleteSale` still deletes first, then calls `adjust_finished_goods_stock` |
| COR-03 | Batch delete: replace read-modify-write on `ingredients.qty_on_hand` with the existing `adjust_ingredient_stock` RPC pattern (F3) | `src/app/batches/actions.ts:169–178` |
| COR-04 | Purchase edit/delete keeps `qty_on_hand` and `avg_price_per_unit` correct (F9); decide lifetime vs recent weighted price (F7) | per audit |
| COR-05 | Dashboard N+1 (F12) and per-request business lookup (F13, wrap in `React.cache`) | `dashboard.ts:155–157` loop; no `cache(` in `businesses.ts` |
| COR-06 | `tsc --noEmit` step in CI (F14); error monitoring (e.g. Sentry) | `build.yml` has only `next build` |

### Phase 0.5 — Tenancy for teams and subscription (pulled forward on purpose)
| ID | Requirement | Acceptance |
|---|---|---|
| TEN-01 | `business_members(business_id, user_id, role)`; roles owner / manager / seller | Owner can invite by email; seller sees Sell + Stock only, no costs/profit |
| TEN-02 | Rewrite every RLS policy from `user_id = auth.uid()` to membership-based access (security-definer helper `is_member(business_id, min_role)`) | Automated RLS tests: user A cannot read/write business B in any table incl. `print_jobs` |
| TEN-03 | Replace the `business_id` cookie choice with membership-validated selection | Forged cookie cannot select a non-member business |
| TEN-04 | Email/password or magic-link sign-in alongside Google | New customers without Google can sign up |

*Rationale:* every table is keyed to a single login today (`0005_businesses.sql` policies). Each new table adds another policy to migrate; doing it before Phase 2 grows the schema is cheapest.

### Phase 1 — Beginner-friendly
| ID | Requirement |
|---|---|
| BEG-01 | First-run wizard: business name → starter recipe template → ingredient prices → shows cost & profit per bottle |
| BEG-02 | Thai UI by default (i18n), English toggle |
| BEG-03 | "?" explainers on cost/yield/margin/fee; actionable empty states on every list |
| BEG-04 | Undo for void/delete |
| BEG-05 | Today-first Home: today's sales, expected drawer cash, low stock, items needing attention |
| BEG-06 | PromptPay QR (EMVCo payload from the shop's PromptPay ID) on checkout for transfers |
| BEG-07 | Per-business feature toggles (principle 1) |

### Phase 2 — Daily operations
| ID | Requirement |
|---|---|
| OPS-01 | Days-of-stock per sauce from sales velocity; "Plan batch" → ingredient shortfall list |
| OPS-02 | Best-before per recipe → expiry per batch; expiring-soon alerts; FIFO hint |
| OPS-03 | Receivables: unpaid marketplace payouts / COD, "Mark as paid" |
| OPS-04 | Supplier price history + price-jump alerts; Stock search |
| OPS-05 | Profit by channel after fees |

### Phase 3 — Professional and subscription
| ID | Requirement |
|---|---|
| PRO-01 | Audit log for price, recipe, stock, and sale changes (who/when/before/after) |
| PRO-02 | Lot traceability: purchase lots → batch → sales (recall answer in seconds; Thai FDA context) |
| PRO-03 | Marketplace order CSV import (Shopee, Lazada, TikTok) |
| PRO-04 | VAT tax invoices, monthly P&L, accountant export |
| PRO-05 | Subscription billing (plans, trial, limits), tenant onboarding, data export/delete |
| PRO-06 | Offline sale queue; multi-location stock |

---

## 6. Printing architecture (detail for review)

### 6.1 Constraints discovered
- **PeriPage has no official API/SDK.** Protocol knowledge comes from community reverse engineering: [bitrate16/peripage-python](https://github.com/bitrate16/peripage-python), [eliasweingaertner/peripage-A6-bluetooth](https://github.com/eliasweingaertner/peripage-A6-bluetooth). The A6 does **not** speak ESC/POS generally, but accepts the GS v 0 raster command inside its own framing.
- The A6 uses **Bluetooth Classic (SPP/RFCOMM)**, not BLE → Web Bluetooth cannot reach it. **iOS Safari has neither Web Bluetooth nor Web Serial** → the iPhone cannot print directly from the web app.

### 6.2 Implemented design
```
iPhone (Sell → Charge) ──logCartSale──► sales rows + print_jobs row (queued)
                                              │ Supabase realtime INSERT (+15 s poll)
Windows PC: Chrome/Edge /print-station ◄──────┘
   claimPrintJobs(): UPDATE status queued→printing RETURNING  (single claim)
   buildReceiptCanvas(profile+payload, scale 1) → 384-px canvas
   canvasToRows(): luminance threshold 190 → 48 bytes/row, 1 = black
   buildPrintBytes(): [10ff100002 density] + per ≤255 rows: [10fffe01 + 12×00][1d 76 30 00 30 00 rows 00][data]
                      + [1b4a40 feed][10fffe45 end]
   writeToPrinter(): 122-byte writes, 20 ms apart (MessageChannel wait, immune to background-tab timer throttling)
   finishPrintJob(): printed | failed(error) → Retry in UI
```
Phone fallbacks remain: "Print again" (re-queue) and "Print from phone" (Share Sheet → PeriPage app).

### 6.3 Open: USB instead of Bluetooth (new owner input, not yet evaluated)
The owner can connect the A6 to the PC by **USB**. How Windows enumerates it decides the transport:
- **USB CDC/serial (appears as a COM port):** the existing Web Serial code should work unchanged — only the port picked differs. Likely more reliable than Bluetooth (no pairing drops, faster).
- **USB Printer Class with a Windows driver:** Web Serial won't see it; WebUSB cannot claim an interface the OS printer driver owns. Options then: (a) keep Bluetooth, (b) a tiny local helper (Node/PowerShell) that writes the same bytes to the device and exposes `http://localhost` to the station page, (c) print the rendered PNG through the Windows print dialog / driver (loses silent auto-print).
**Reviewer task:** state how to determine the enumeration (Device Manager → Ports vs Printers; `navigator.serial.requestPort()` listing) and recommend the default transport with a fallback.

### 6.4 Known risks in the print design
1. Protocol is unofficial; firmware/model variants (A6 vs A6+ vs A40) may differ — row width and framing are model-specific.
2. Background-tab behaviour: Chrome intensive throttling, Windows window occlusion, PC sleep. Mitigations: realtime worker heartbeat (`realtime: { worker: true }`), MessageChannel waits, Wake Lock request; still requires the window open and the PC awake.
3. A job claimed (`printing`) when the page crashes stays `printing`; UI offers Retry but there is no automatic stale-claim recovery yet.
4. Realtime delivery depends on RLS on `print_jobs` and the publication change in 0021.

---

## 7. Plan review (author's self-critique — reviewer should go further)

| # | Concern | Current stance | What would change it |
|---|---|---|---|
| R1 | Pulling tenancy (TEN) ahead of beginner features delays visible value | Cheaper now than after Phase 2 adds tables | If subscription is > 12 months away, defer and add RLS tests only |
| R2 | Print station needs an always-on PC | Owner has one; phone fallback exists | A BLE ESC/POS printer would allow Android-direct printing, but the owner uses iPhone, so no gain |
| R3 | Logo stored as data: URL in `businesses` (≤ 300 KB check) | Avoids a storage bucket + policies | Move to Supabase Storage when multi-tenant (row size, egress) |
| R4 | No tests exist, yet the plan adds money-critical features | COR-01 first | — |
| R5 | Local build impossible; CI only runs on `master` push/PR | Owner pushes manually | Add CI on all branches + `tsc --noEmit` so feature branches get checked before merge |
| R6 | `sales` is one recipe per row; cart = N rows with no order/cart id | Receipts reconstructed from payload, not from sales | An `orders` table (F11) before receivables, receipts reprint by order, and marketplace import |
| R7 | Feature-toggle UI could itself become complex | Toggles are suggested contextually, not a settings wall | Usability test with a real beginner |
| R8 | English-only UI today while users are Thai | Phase 1 | Could be first if onboarding other shops soon |

## 8. Open questions for the owner
1. PeriPage A6 over **USB**: does Windows Device Manager list it under *Ports (COM & LPT)* or under *Printers*?
2. Expected timeline for offering subscriptions (drives R1).
3. Will helpers/staff use the app soon (drives TEN-01 priority)?
4. Thai-only, or Thai + English for subscribers?
5. PromptPay ID type for QR (phone number vs national ID vs e-wallet).

## 9. Operating constraints (must hold for any implementation)
- Commit locally; **never push** until the owner says so (Netlify deploys `master`).
- Migrations: new numbered file in `supabase/migrations/`, call it out in the commit message; the owner applies them in Supabase; code must tolerate the migration not yet being applied.
- Match existing conventions (RLS shape, `business_id` scoping, snapshot-at-insert, `todayISO()` from `src/lib/dates.ts`, platform presets in `src/lib/platforms.ts`).
- Mirror UI changes in `preview/` when practical.
- Windows machine, CRLF working copy (`core.autocrlf=true`); no Python; npm install currently fails.

## 10. Requested review output
Return a markdown review with:
1. **Verified / refuted claims** — table of §2 claims checked against code (file:line), with any corrections.
2. **Critical risks** — ranked, each with concrete failure scenario and fix.
3. **Priority changes** — any reordering of P0/Phase 0/0.5/1/2/3 with justification.
4. **Printing transport recommendation** (§6.3) including how to test it in ≤ 10 minutes on-site.
5. **Missing requirements** — especially for subscription readiness (security, billing, data retention, PDPA — Thailand's Personal Data Protection Act — for customer names on labels and in `customer_ref`).
6. **Go / no-go** for pushing `35f3156` + `8f5d47b` before hardware verification.
