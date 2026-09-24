# Ordexa — Product Requirements & Roadmap (v2, for plan review)

**Date:** 2026-09-24 · **Version:** v2 (supersedes v1 in `64a78f6`)
**Status:** Proposed — *changes required before approving production use* (reviewer verdict on v1, accepted).
**Repo for review:** `D:\Claude-Phol\Claude_Code\sauce-cost-tracker`, branch `master`, **3 commits ahead of `origin/master`, not pushed**: `35f3156`, `8f5d47b`, `64a78f6` (+ this v2 commit). Review with `git log origin/master..master` and `git diff origin/master..master`.
**Inputs merged into v2:** (1) v1 of this PRD, (2) the owner-supplied requirements brief ("Evaluate Sauce Cost Tracker and create a PRD…"), (3) the reviewer's comments on v1. Decisions on each are logged in §11.
**Companion:** `docs/audit-2026-08.md` (F-numbers below).

---

## 0. Instructions for the reviewing agent

Planning/review only: **do not modify code, production data, or push/deploy.**

1. Read `AGENTS.md` and `docs/audit-2026-08.md`.
2. Verify every current-state claim against code (file:line) and, where you have read-only access, against the production schema. Mark each *confirmed / refuted / unverifiable*.
3. Separate **confirmed defects** from **assumptions** and **proposals**.
4. Constraints: `npm ci` fails on the owner's Windows machine (registry `ECONNRESET`), so the only build check is GitHub Actions `next build` on push/PR to `master` (`.github/workflows/build.yml`). No test runner exists. Next.js 16 — consult `node_modules/next/dist/docs/` before asserting API behaviour.
5. Deliver the review in the §12 format.

---

## 1. Product context

- **Business:** one small Thai sauce maker (bottled sauces), 1–2 people; sells in person, TikTok Shop, Shopee, Lazada. THB, Asia/Bangkok.
- **Direction:** run the owner's own shop dependably first; offer subscriptions to other small food makers later. Prepare the architecture for that, **defer billing and commercial features** until the owner's workflows are validated.
- **Hardware (confirmed by owner):** iPhone (orders keyed in the web app in Safari); **PeriPage A6, 203 dpi**, plain receipt paper; PeriPage iOS app over Bluetooth; a **Windows** shop computer; connecting the A6 to Windows **by USB is acceptable**.
- **Stack:** Next.js 16 (App Router, server actions), React 19, Supabase (Postgres, RLS, Auth: Google OAuth only), Tailwind 4, Recharts. Netlify auto-deploys `master`. `preview/` = no-build offline mockup.

## 2. Current-state assessment

### 2.1 Live on production (`origin/master` = `76b4e18`)
| Capability | Evidence |
|---|---|
| Ingredients, purchases (incl. purchase trips), recipes with costing (yield, evaporation, waste, labour, overhead, packaging, VAT, platform fee), batches + yield variance, finished-goods stock, sales, cash closing, expenses, analytics, CSV export, multiple businesses per login | `src/app/*`, `src/lib/costing.ts` |
| 5-tab phone navigation; Sell cart (tap-to-add, checkout sheet, one multi-row insert) | `src/components/tab-bar.tsx`, `src/app/sales/sell-cart.tsx`, `logCartSale` |
| Bangkok-time `todayISO()` | `src/lib/dates.ts` |
| PWA icons; manifest/icons excluded from auth proxy | `src/app/icons/[size]/route.tsx`, `src/proxy.ts` |
| **Workflow A (phone-assisted printing):** receipt/bag-label PNG with logo, shop contact, large customer name, items, total, thank-you; after Charge a *Print label* button opens the iOS Share Sheet; download fallback | `src/lib/receipt.ts`, `src/app/settings/*`, commit `7c02231` |

### 2.2 Local only (not pushed)
| Commit | Content |
|---|---|
| `35f3156` | **Workflow B prototype:** `print_jobs` table (migration 0021); checkout queues a job when *Print on = Shop computer*; `/print-station` page (Chrome/Edge on Windows) opens the A6 via **Web Serial**, gets jobs via Supabase realtime + 15 s poll, claims them with one `UPDATE … WHERE status='queued' RETURNING`, prints with a reverse-engineered A6 raster driver (`src/lib/peripage.ts`). |
| `8f5d47b` | `preview/print-test.html` stand-alone printer test (same renderer/driver). |
| `64a78f6` | PRD v1. |

### 2.3 Migrations
| File | State | Action |
|---|---|---|
| `0001`–`0015`, `0017`–`0019` | In repo; believed applied | Verify against prod `supabase_migrations` history (read-only). |
| **`0016_made_to_order_recipes.sql`** | **Absent from repo**; audit states it is applied in prod | **Blocker for new migrations.** Reconcile repo vs prod schema first. Do **not** recreate or re-run 0016 from the audit's description. |
| `0020_business_receipt_profile.sql` | In repo (pushed), **not applied** | Apply only after the reconciliation. Code tolerates absence. |
| `0021_print_jobs.sql` | Local only, **not applied**; depends on 0020 | Will be revised by §5.3 (status model, content snapshot, idempotency, stations) before anyone applies it. |

### 2.4 Verified gaps and defects
| # | Finding | Type | Evidence |
|---|---|---|---|
| G1 | Checkout has **no idempotency**: a retried request after a timeout can log the sale and deduct stock twice | Defect | `logCartSale` inserts without a client key (`src/app/sales/actions.ts`) |
| G2 | Cart = N `sales` rows with no order header/number | Design gap | same; audit F11 |
| G3 | Void sale deletes, then restores stock in a separate call | Defect | `deleteSale` → `delete()` then `rpc("adjust_finished_goods_stock")` (F2) |
| G4 | Batch delete restores ingredients with read-modify-write | Defect | `src/app/batches/actions.ts:169–178` (F3) |
| G5 | Recipe margin subtracts platform fee **and VAT**; sale margin subtracts fee only | Defect (inconsistent reporting) | `calcRecipeCost` vs `calcSaleMargin` in `src/lib/costing.ts` |
| G6 | Print job status `printed` claims physical output the system cannot observe; stuck `printing` has no recovery | Defect (prototype) | `print_jobs.status` check in 0021; `print-station.tsx` |
| G7 | Station merges the **current** shop profile at print time → a reprint after editing branding differs from the original | Defect (prototype) | `processQueue` in `src/app/print-station/print-station.tsx` |
| G8 | Jobs are scoped by user/business RLS but not bound to an approved station/device | Gap | 0021 |
| G9 | Access model is single-owner (`user_id = auth.uid()`) everywhere | Constraint for teams/subscription | `0005_businesses.sql` |
| G10 | Dashboard N+1 (F12); uncached business lookup per call (F13) | Performance | `dashboard.ts:155–157`; `businesses.ts` |
| G11 | No automated tests; costing untested (F10) | Gap | no runner in `package.json` |
| G12 | Platform fee presets duplicated | Tech debt | `PLATFORM_FEE_PRESETS` in `costing.ts` and `PLATFORM_OPTIONS` in `src/lib/platforms.ts` |

**Correction to v1:** v1 said CI "has no type check". `next build` type-checks (`tsconfig` `strict: true`; `next.config.ts` has no `ignoreBuildErrors`). What is missing is a fast standalone `tsc --noEmit` step and CI on non-`master` branches.

### 2.5 Not verified (needs hardware)
- Any print from the station prototype to a physical A6.
- Whether PeriPage appears as a target in the iOS Share Sheet for PNGs (Workflow A step 3).
- How Windows enumerates the A6 over USB (COM port vs printer class) and whether the official driver is required.
- Printable width/margins on the owner's paper (384 dots is the A6 head width per community docs — not yet measured).
- Whether the A6 can be used alternately by the iPhone app (Bluetooth) and Windows (USB/Bluetooth) without re-pairing.

---

## 3. Goals, non-goals, success measures

**Goals**
1. Orders are never lost or duplicated, and stock is deducted exactly once per order.
2. A common order takes ≤ 2 taps after item selection; the bag label prints without further interaction when the shop computer is available, and with ≤ 3 taps via the phone otherwise.
3. Every cost, margin, stock and cash number is consistent across screens and explainable.
4. A beginner reaches a correct cost-per-bottle in ≤ 5 minutes.
5. Business data is isolated so subscriptions can launch without re-architecture.

**Non-goals (now):** restaurant POS concepts (tables, modifiers, kitchen routing), billing/entitlements, native apps, marketplace APIs (CSV import later), general-ledger accounting, payroll.

**Measures:** duplicate-order count = 0 in pilot; print success without manual intervention ≥ 95% of station-mode orders during the limited rollout; zero orders lost on print failure; median taps per common order.

## 4. Users and workflows

| User | Now | Later (subscription) |
|---|---|---|
| Owner | Everything | Owner role per business |
| Helper/seller | — | Sell + Stock, no costs/profit |
| Print station (device) | Shop PC | Approved device per business |

Core workflows: ingredients & purchases → recipes & costing → batches & finished goods → **orders, payments, sales** → **receipt / bag-label printing** → stock, expenses, margins, daily closing.

---

## 5. Requirements

### 5.1 Orders (new foundation — prerequisite for reliable printing)
| ID | Requirement | Acceptance |
|---|---|---|
| ORD-01 | `orders` header (business, order number per business per day or sequence, customer name, customer instructions, platform, payment method/status, totals, `client_request_id` unique per business) + `order_items`; existing per-recipe `sales` rows become items or are linked by `order_id` | Checkout writes header + items + stock deduction in **one DB transaction (RPC)** |
| ORD-02 | **Idempotent checkout**: client generates `client_request_id` when the checkout sheet opens; a repeat with the same id returns the original order | Double tap, network drop + retry, and page reload → exactly one order, one deduction |
| ORD-03 | Backfill: existing `sales` get synthetic single-item orders (or remain orderless with a nullable `order_id`) — reviewer to choose | Reports unchanged before/after backfill |
| ORD-04 | Void is transactional (fixes G3) and never deletes history silently | Void restores stock exactly once; audit row kept |
| ORD-05 | Margin rules unified (fixes G5): one function for recipe (theoretical) and order (actual) with the same deductions; VAT captured per order if applicable | Same inputs → same margin on Recipe, Home, Financials |

### 5.2 Receipt and bag-label content
| ID | Requirement | Acceptance |
|---|---|---|
| LBL-01 | Business-configurable: monochrome-optimised logo, shop name, contacts, thank-you message | Exists (live); logo dithering at upload is in the local commit |
| LBL-02 | Two templates: **Receipt** (prices, total, payment status) and **Bag label** (large customer name, order number, packing instructions, prices optional) | Owner can choose default per business and per print |
| LBL-03 | Order number and date **and time** on both | Printed values match the order |
| LBL-04 | Thai + English, long names, wrapping, many items, Thai vowels/tone marks | Physical tests P-TH, P-LONG pass (§7) |
| LBL-05 | Printable width, margins, resolution **measured on the owner's A6 paper**, not inferred from nominal size | Calibration print recorded in repo |

### 5.3 Printing — shared job model
| ID | Requirement | Acceptance |
|---|---|---|
| PJ-01 | Order is committed **before** any print attempt; print failure never affects the order | Kill printer/station mid-print → order intact |
| PJ-02 | Job stores a **content snapshot** (rendered payload incl. branding version, or the PNG) at creation (fixes G7) | Reprint after branding edit reproduces the original |
| PJ-03 | One automatic job per order (unique `(order_id, kind='auto')`); reprints are explicit, separate jobs with `kind='reprint'` and actor | Repeated taps/reconnects never create a second auto job |
| PJ-04 | Status model: `queued → processing → sent → (failed | uncertain)`; `sent` = bytes accepted by the port/driver, **never** "printed". UI copy says "Sent to printer", not "Printed" | No screen claims physical output |
| PJ-05 | Claim is atomic and bound to a station (`claimed_by_station`, `claimed_at`); two tabs/devices cannot print the same job | Two station tabs open → each job prints once |
| PJ-06 | A job left `processing` past a timeout, or where the station died after sending but before recording, becomes **`uncertain`**; never auto-retried; user resolves with "Printed OK" / "Reprint" | Crash-after-send test → `uncertain`, no duplicate |
| PJ-07 | Jobs, stations and pairing scoped to the business via RLS | User of business B cannot see/claim A's jobs (automated test) |

### 5.4 Workflow A — phone-assisted printing (independent milestone)
| ID | Requirement | Acceptance |
|---|---|---|
| WA-01 | After save, generate the print-ready image; Share Sheet → PeriPage app; user confirms in PeriPage | **Verified on the owner's iPhone** that PeriPage is offered for PNG shares; if not, document the working route (Save to Photos → import in PeriPage) |
| WA-02 | Fallback: save/download image | Works when sharing is unavailable |
| WA-03 | Never labelled as printed; the app records "shared" only | — |

### 5.5 Workflow B — automatic printing via the shop computer (independent milestone)
| ID | Requirement | Acceptance |
|---|---|---|
| WB-01 | Transport chosen from the **hardware spike** (§6.2), not assumed | Decision record with test evidence |
| WB-02 | Station registration: a station is a named device approved by the owner in settings (stored `print_stations`, `last_seen_at`); only approved stations claim jobs (fixes G8). Full per-device tokens deferred to subscription phase | Unapproved browser cannot claim |
| WB-03 | Offline behaviour: jobs stay `queued` while no station is online; phone shows "Shop printer offline — will print when it's back" plus *Print from phone*; station heartbeat drives the indicator | PC asleep/closed → phone warns within 30 s; jobs print on return in order |
| WB-04 | Recovery: page reload, PC sleep/wake, USB unplug/replug, printer power cycle each have a documented, tested recovery path | Tests P-REC-* pass |
| WB-05 | Operates alongside Workflow A; the A6 used alternately by iPhone app and PC | Test P-SWITCH passes or limitation documented |

### 5.6 Correctness, beginner, operations, professional (unchanged intent, re-sequenced in §8)
- **Correctness:** unit tests for costing and order math (F10); F3 batch restore via RPC; F9/F7 purchase edits and price basis; F12/F13 performance; `tsc --noEmit` + CI on all branches.
- **Beginner:** first-run wizard; Thai UI default; explainers; empty states; undo; today-first Home; PromptPay QR; per-business feature toggles.
- **Operations:** days-of-stock and batch planning; best-before/expiry; receivables (marketplace payouts/COD); supplier price history; profit by channel.
- **Professional:** membership & roles (G9), audit log, recipe versions, suppliers, lots, locations, CSV marketplace import, tax invoices. **Business isolation is required from the start** (already per-owner via RLS; every new table must follow it). Invitations, complex roles and billing come after the owner's shop is stable.

---

## 6. Technical proposal

### 6.1 Order model
`orders(id, business_id, user_id, order_no, client_request_id unique(business_id, client_request_id), customer_name, instructions, platform, fee_pct, payment_method, payment_status, total, created_at)` + `order_items(order_id, recipe_id, qty, line_total, cost_per_bottle_snapshot)`. A `create_order` security-definer RPC performs insert + stock deduction + optional auto print job in one transaction and returns the existing order on a repeated `client_request_id`. `sales` either becomes a view over items or gains `order_id` (reviewer to recommend; prefer the smaller migration).

### 6.2 Printing transport — hardware spike (decide by evidence)
| Option | Install | Variable-length labels | Outcome visibility | Notes |
|---|---|---|---|---|
| B1 Web Serial over **Bluetooth** (prototype exists) | none | yes | sent/failed | Reverse-engineered protocol; Bluetooth may be held by the iPhone app |
| B2 Web Serial over **USB**, *only if* the A6 enumerates as a serial/COM device | none | yes | sent/failed | A COM port appearing is necessary, **not sufficient**: must confirm it is the A6, opens, and accepts the same framing/chunking |
| B3 **Official PeriPage Windows driver** + silent printing (Chrome `--kiosk-printing` on the station page, or a print bridge) | driver (+ bridge) | **limited** — driver requires a defined page size ([community report](https://github.com/eliasweingaertner/peripage-A6-bluetooth)); needs fixed-length template or custom sizes | sent to Windows spooler only | Uses the vendor path; installing the driver may claim the USB interface (rules out B2) |
| B4 Existing bridge (QZ Tray: free, silent printing needs a paid certificate + Java; PrintNode: monthly, volume-based) | agent install | depends on driver | spooler/agent | Evaluate licensing/recurring cost against subscription plans |
| B5 Custom Windows helper | our installer + updates | yes | best (can read port errors) | Only if B1–B4 fail; highest maintenance |

Spike procedure (≤ 1 hour on site): Device Manager check → `preview/print-test.html` over USB then Bluetooth → install vendor driver on a test basis and print a fixed-size PNG from the browser dialog → record results, paper width measurement, print time, Thai legibility.

### 6.3 Security and isolation
RLS on every new table; station approval (WB-02); jobs carry `business_id`; the realtime channel filter is advisory only — RLS is the guard. Later: `business_members` + `is_member(business_id, role)` helper replacing `user_id = auth.uid()`.

### 6.4 Deployment
Migrations are numbered, called out in commit messages, applied by the owner **after** repo/prod reconciliation (§2.3). Code must tolerate a not-yet-applied migration. Feature flag per business for station printing. Rollback: disable flag → Workflow A continues; migrations additive only in this phase.

---

## 7. Physical acceptance tests (run on the owner's hardware)
| ID | Test | Pass |
|---|---|---|
| P-TH | Thai with vowels/tone marks above and below, mixed Thai/English | Legible, no clipped marks |
| P-LOGO | Colour and B/W logos | Recognisable, no black blocks |
| P-LONG | 15-item order, 40-char customer name, 3-line instructions | Wraps correctly, nothing cut |
| P-DUP | Double-tap Charge; airplane-mode during save then retry; reload | One order, one label |
| P-TABS | Two station tabs/devices open | Each job prints once |
| P-CRASH | Close station right after sending | Job `uncertain`, no auto reprint |
| P-REC-USB / P-REC-PWR / P-REC-SLEEP / P-REC-PAPER | Unplug USB, power-cycle printer, sleep PC, paper out mid-job | Clear state + documented recovery; no lost orders |
| P-REPRINT | Deliberate reprint after editing branding | Original content reprinted, marked reprint |
| P-SWITCH | Print from iPhone app, then from PC, then iPhone again | Works or limitation documented |
| P-WA | Workflow A end-to-end on the owner's iPhone | PeriPage reachable from Share Sheet or documented alternative |

---

## 8. Phased plan (revised order)

| Phase | Milestone | Depends on | Exit criteria |
|---|---|---|---|
| **0 Baseline** | Read the 3 local commits; reconcile migrations incl. missing 0016 against prod (read-only); confirm §2 claims | — | Reconciliation note committed; blockers listed |
| **1 Hardware spike** | Workflow A on iPhone; B1/B2/B3 on Windows per §6.2; paper calibration | 0 | Transport decision + calibration recorded |
| **2 Reliable orders & queue** | ORD-01–05, PJ-01–07, station approval (WB-02), revised 0021; unit tests for order math/costing; RLS tests | 0 (1 for transport code) | P-DUP, P-TABS, P-CRASH pass in staging |
| **3 Workflow A polish** | LBL-02/03 templates, WA-01–03 | 2 | P-WA, P-TH, P-LONG pass |
| **4 Workflow B limited rollout** | Station with chosen transport, offline/recovery UX, flag on for owner's shop only; share fallback kept | 1, 2 | 2 weeks in-shop use, ≥ 95% hands-free, zero lost/duplicate orders |
| **5 Remaining correctness** | F3, F7/F9, F12/F13, `tsc --noEmit` + CI on branches | 2 | Tests green |
| **6 Beginner UX** | Wizard, Thai UI, explainers, today-first Home, PromptPay | 5 | Beginner reaches cost/bottle ≤ 5 min |
| **7 Operations** | Days-of-stock, expiry, receivables, supplier prices | 5 | — |
| **8 Teams → subscription** | Membership/roles, audit log, then billing/entitlements | 4–6 stable | RLS isolation suite green |

Each milestone ships as small reviewable commits; mobile-assisted and Windows-automatic printing remain independently testable (phases 3 and 4).

## 9. Release and push policy
- **Owner rule (current): nothing is pushed without the owner's explicit instruction.** Netlify deploys `master`.
- Reviewer proposal (awaiting owner decision): push work to a **review branch / draft PR** for backup and review once diff and checks pass, clearly marked "hardware untested"; **do not** merge to `master` while migrations are pending or hardware is unverified. Note: CI currently runs only on `master` push/PR, so a draft PR to `master` is what triggers it.
- Enabling automatic printing in the shop requires Phase 4 exit criteria.

## 10. Risks
| # | Risk | Mitigation |
|---|---|---|
| K1 | Unofficial A6 protocol; firmware/model variance | Hardware spike; keep Workflow A as permanent fallback |
| K2 | Driver path can't do variable-length labels | Fixed-length label template or custom page sizes; prefer B1/B2 if they work |
| K3 | Station depends on an awake, open browser on the PC | Heartbeat + phone warning + queue persistence |
| K4 | Missing 0016 → schema drift | Phase 0 reconciliation before any migration |
| K5 | Order-model migration touches money/stock | Transactional RPC, backfill verification, additive migrations, flag |
| K6 | No local build; CI only on `master` | Add CI on branches + `tsc --noEmit` in Phase 5 (or earlier if owner approves branch pushes) |
| K7 | Overengineering for a 1–2 person shop | Defer device tokens, bridges, billing; one station, one printer |

## 11. Review log — decisions on inputs
| Source | Point | Decision |
|---|---|---|
| Brief | Order header + order number | **Adopted** (ORD-01) |
| Brief | Two templates, time, instructions, payment status | **Adopted** (LBL-02/03) |
| Brief | Status incl. sent/uncertain; never claim physical print | **Adopted** (PJ-04/06); fixes G6 |
| Brief | Preserve job content | **Adopted** (PJ-02); fixes G7 |
| Brief | Workflow B via USB **driver** | **Modified**: driver is one option (B3) with a page-size limitation; decided by spike |
| Brief | Evaluate existing bridge vs custom helper | **Adopted** as B4/B5 in spike, lowest priority |
| Brief | Branding "missing" | **Refuted in part**: logo/contact/thank-you live since `7c02231` |
| Reviewer | COM port ≠ working protocol | **Adopted** (B2 wording) |
| Reviewer | Printer-class ≠ cannot print from web | **Adopted** (B3) |
| Reviewer | iPhone→PC path needs queue, pairing, recovery | **Adopted** (WB-02–04); queue exists in prototype |
| Reviewer | Order correctness before auto-print | **Adopted**: Phase 2 precedes rollout |
| Reviewer | 0016 missing — don't recreate from audit | **Adopted** (§2.3, Phase 0) |
| Reviewer | CI does type-check via build | **Adopted**; v1 corrected (§2.4) |
| Reviewer | Jobs bound to shop **and authorised device** from v1 | **Adopted in light form** (approved stations); tokens deferred |
| Reviewer | Test A6 switching between iPhone app and Windows | **Adopted** (P-SWITCH) |
| Reviewer | Revised phase order | **Adopted** (§8) |
| Reviewer | Push to review branch / draft PR | **Pending owner decision** (§9) |

## 12. Requested review output
1. Claim verification table for §2 (confirmed / refuted / unverifiable, with file:line).
2. Critical risks ranked with failure scenario and fix.
3. Challenges to §5–§8: feasibility, reliability, security, usability, cost, **overengineering** — what to cut.
4. Order-model recommendation (ORD-03: link vs replace `sales`) with migration/backfill/rollback.
5. Transport recommendation after reading `src/lib/peripage.ts` and `print-station.tsx`.
6. Go/no-go per item: review-branch push; merge to `master`; applying 0020; applying 0021 as-is (expected: **no** — to be revised).
7. Open questions — only those that change implementation.

## 13. Open questions for the owner
1. Push the local commits to a review branch / draft PR now (backup + CI), yes or no?
2. Order numbers: daily reset (e.g. `240924-003`) or running sequence?
3. Bag label: hide prices by default?
4. Is read-only production schema access available to the reviewer for the 0016 reconciliation?
