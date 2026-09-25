# Ordexa — Consolidated PRD, Technical Proposal & Plan Review (v3.1)

**Date:** 2026-09-24 · **Version:** v3.1 — single source of truth; supersedes the separate requirements brief and PRD v1 (`64a78f6`) / v2 (`9700628`) / v3 (`a86a64f`). v3.1 folds in review round 3 (a code-level review of v2 + `35f3156`); its six Print Station findings were re-verified against the code (§2.2, G13–G18).
**Status:** Proposed — *changes required before approving production use.*
**Scope of this revision:** documentation only. No code changed, nothing pushed, no migration run, production untouched.

> **สรุปภาษาไทย:** เอกสารนี้รวม brief กับ PRD เป็นฉบับเดียว ตรวจของที่มีอยู่แล้วก่อนเสนอสร้างใหม่ (Print Station ที่ยังไม่ push และ branch `codex/delivery-today` ที่มีระบบออเดอร์เดลิเวอรี + test อยู่แล้ว) พบว่า **เลข migration 0020 ชนกันสองไฟล์** และ 0016 อยู่ใน branch อื่น ไม่ใช่ `master` จึงห้าม rollout จนกว่าจะเคลียร์ migration เรื่อง driver / USB / ความยาวงานพิมพ์ ปรับเป็น "สมมติฐานที่ต้องทดสอบกับเครื่องจริง" พร้อมเกณฑ์เลือกวิธีเชื่อมต่อ
>
> **v3.1:** เพิ่มข้อบกพร่อง Print Station 6 ข้อจากรีวิวรอบ 3 (ตรวจกับโค้ดแล้วจริงทุกข้อ) กำหนด state machine ของงานพิมพ์ใหม่ ให้ key กันออเดอร์ซ้ำอยู่รอดหลัง reload แยก pilot กับการอนุมัติใช้จริง และแก้ข้อความ CI ที่ผิด (PR เข้า master มีการตรวจอยู่แล้ว)

---

## 0. How to use this document

**Reviewing agent:** planning/review only — do not modify code or production data, do not push or deploy, do not run migrations.
1. Read `AGENTS.md`, `docs/audit-2026-08.md`, `DELIVERY-SETUP.md` on branch `origin/codex/delivery-today`.
2. Verify each claim in §2 against the cited commit/file:line; mark *confirmed / refuted / unverifiable*.
3. Keep **confirmed defects**, **assumptions/hypotheses** (§6), and **proposals** separate.
4. Return the review in the §13 format.

**Where the work is:**
| Location | Contents |
|---|---|
| `origin/master` (`76b4e18`, deployed by Netlify) | Live app |
| Local `master` in `D:\Claude-Phol\Claude_Code\sauce-cost-tracker` — ahead of origin, **not pushed** | `35f3156` Print Station, `8f5d47b` printer test page, `64a78f6`/`9700628` PRD v1/v2, `a86a64f` v3, this v3.1 |
| `origin/codex/delivery-today` (`f011a36`, 2026-09-13, based on `66a5b4e`) | Made-to-order (0016), Thai delivery queue `/today`, atomic booking RPC, PGlite DB tests in CI (0020_delivery_orders) — **not merged, migrations not applied** per its `DELIVERY-SETUP.md` |
| `origin/mobile-ux` | Already merged into master; stale |
| Review package | `D:\Claude-Phol\Claude_Code\ordexa-review\` (PRD + patches of local commits) |

**Environment constraints:** `npm ci` fails on the owner's Windows machine (registry `ECONNRESET`); CI (`.github/workflows/build.yml:3–7`) runs `npm ci` + `next build` on **push to `master` and on pull requests targeting `master`** — so a Draft PR from a review branch is checked (v3 wrongly said "only on master"). `next build` type-checks (`tsconfig` `strict: true`, no `ignoreBuildErrors`). Next.js 16 — consult `node_modules/next/dist/docs/` before asserting API behaviour.

---

## 1. Product context and direction

- **Business:** owner-operated Thai food business (bottled sauces sold in person and on TikTok Shop / Shopee / Lazada; the delivery branch adds a made-to-order food line on Grab / LINE MAN). THB, Asia/Bangkok. 1–2 people.
- **Direction:** dependable daily operation first; **subscriptions to other businesses later**. Prepare the architecture (business isolation, membership-ready access, configurable branding, entitlement boundaries) but **defer billing and commercial features** until the owner's workflows are validated.
- **Priorities, in order:** (1) correctness — costing consistency, stock reconciliation, historical snapshots, transactional operations, validation, critical automated tests; (2) beginner experience; (3) daily efficiency — mobile order entry, production, purchasing, printing, closing; (4) professional capabilities — permissions, audit history, recipe versions, suppliers, lots, expiry, locations; (5) subscription readiness.
- **Core workflows:** ingredients & purchases → recipes & product cost → production batches & finished goods → customer orders, payments, sales → personalised receipts / bag labels → stock, expenses, margins, daily closing. **Retain useful existing functionality; evaluate before replacing.**
- **Confirmed hardware:** orders keyed in the web app on an **iPhone** (Safari); **PeriPage A6, 203 dpi**, plain receipt paper; PeriPage **iOS app over Bluetooth**; a **Windows** computer at the shop; connecting the A6 to Windows **by USB is acceptable**.
- **Stack:** Next.js 16, React 19, Supabase (Postgres, RLS, Google OAuth), Tailwind 4, Recharts, Netlify.

---

## 2. Current-state assessment (evidence-based)

### 2.1 Implementation status matrix
Legend: ✅ yes · ❌ no · ◐ partial · — n/a

| Capability | Written | Automated test | Hardware-tested | Deployed | Active in prod | Evidence |
|---|---|---|---|---|---|---|
| Costing, stock, batches, sales, closing, expenses, analytics, export | ✅ | ❌ | — | ✅ | ✅ | `src/lib/costing.ts`, `src/app/*` |
| 5-tab phone nav, Sell cart, one multi-row insert | ✅ | ❌ | — | ✅ | ✅ | `78e4ced`, `7ca2264` |
| Bangkok `todayISO()` | ✅ | ❌ | — | ✅ | ✅ | `src/lib/dates.ts` |
| PWA icons / public manifest | ✅ | ❌ | ❌ (install not verified on device) | ✅ | ✅ | `745b56d` |
| Receipt/label **image** + iOS Share Sheet + download fallback | ✅ | ❌ | ❌ | ✅ | ✅ (name-only content) | `src/lib/receipt.ts` (`7c02231`) |
| **Branding** (logo, address, phone, LINE, thank-you, print-after-sale toggle) + Shop & label settings | ✅ | ❌ | ❌ | ✅ | **❌ — migration 0020 not applied**; code falls back to name-only, settings save returns "run 0020" | `7c02231`: `0020_business_receipt_profile.sql:15–23`, `src/lib/data/receipt-profile.ts` |
| Logo dithering at upload; bold text at 1:1 | ✅ | ❌ | ❌ | ❌ | ❌ | `35f3156` (local) |
| **Print Station** (queue, Web Serial, A6 driver) | ✅ | ❌ | **❌** | ❌ | ❌ | `35f3156` (local), migration 0021 |
| Printer test page | ✅ | ❌ | ❌ | ❌ | ❌ | `8f5d47b` (local) |
| Made-to-order recipes | ✅ | ◐ (PGlite) | — | ❌ | **unknown** (audit says 0016 applied; branch docs say verify) | `origin/codex/delivery-today` `7b587d3` |
| Delivery queue `/today`, atomic booking, retry-safe, cross-user RLS | ✅ | ✅ PGlite in CI | — | ❌ (Netlify branch preview only, if any) | ❌ | `9d45d90`, `tests/delivery-orders.mjs`, `40d70c7` |

### 2.2 Evaluation of the existing Print Station (`35f3156`) — reuse before rebuilding
| Aspect | Finding | Verdict |
|---|---|---|
| Queue table | `print_jobs` with `payload jsonb`, RLS by `user_id` (`0021_print_jobs.sql:16`) | **Reuse**, revise columns |
| Status model | `queued/printing/printed/failed` (`0021:18`); `finishPrintJob` sets `printed` after bytes are written (`print-station/actions.ts:55`) — claims physical output it cannot observe | **Defect** → sent/uncertain model (PJ-04/06) |
| Claiming | Single `UPDATE … SET status='printing' WHERE business_id=… AND status='queued' RETURNING` (`actions.ts:34–45`) — row-level atomic in Postgres, but **not bound to a station**, no `claimed_at`, no lease/timeout | **Reuse pattern**, add station + lease (PJ-05/06); prove with a PGlite concurrency test |
| Stuck jobs | A job left `printing` has only manual Retry, which re-queues and can duplicate (`actions.ts:62–66`) | **Defect** → `uncertain`, no blind retry |
| Content | Job stores lines/total/customer; station merges the **current** profile at print time (`print-station.tsx:77`) | **Defect** → immutable snapshot (PJ-02) |
| Duplicate auto jobs | Auto job inserted inside `logCartSale` after the sale insert (`sales/actions.ts:149–166`); a retried checkout creates a second sale **and** second job | **Defect** → order idempotency + unique auto job (ORD-02, PJ-03) |
| Transport | Web Serial, reverse-engineered A6 framing (`peripage.ts:14–20, 99–113`), MessageChannel pacing (`:115`), threshold 190 (`:41`) | **Unverified hypothesis** — keep as candidate B1/B2 (§6), not the decision |
| Wake-up | Realtime with `worker: true` + 15 s poll (`print-station.tsx:12, 126–132`); Wake Lock best-effort (`:151`) | Reuse; needs offline/heartbeat UX (WB-03) |
| Device auth | Any signed-in browser of the owner can claim | **Gap** → approved stations (WB-02) |
| Business binding (review r3) | `claimPrintJobs` resolves the business from the **cookie on every claim** (`actions.ts:36` → `businesses.ts:26–32`), but branding is the `profile` prop loaded **once at page load** → switching business in another tab makes the station claim business B's jobs and print them with business A's logo | **Defect (high)** → station bound to a fixed `business_id`, checked server-side (G13) |
| Retry (review r3) | `retryPrintJob` sets `queued` with **no status guard** (`actions.ts:62–68`); UI offers Retry while a job is still `printing` (`print-station.tsx:281`) → another station/tab can claim and print it again | **Defect (high)** → retry only from `failed` (or resolved `uncertain`) enforced in SQL (G14) |
| Result recording (review r3) | `await finishPrintJob(job.id, null)` result is **ignored**; UI marks `printed` even if the write failed (`print-station.tsx:78,82`) | **Defect (high)** → unconfirmed record ⇒ `uncertain` (G15) |
| RLS (review r3) | `print_jobs` policies check only `user_id = auth.uid()` (`0021_print_jobs.sql:29–36`), not that `business_id` belongs to that user | **Defect (high)** → branch pattern: `user_id = auth.uid() AND exists(business owned by auth.uid())` on insert/update (G16) |
| Claim size (review r3) | Claims **all** queued jobs at once, then prints serially (`print-station.tsx:69–83`); closing the page strands unstarted jobs in `printing` | **Defect (medium)** → claim one (or N small) with lease (G17) |
| Port lock (review r3) | *Test print* calls the printer directly (`print-station.tsx:170–179`), bypassing the `busy` guard used by the queue (`:61–65`) → two writers on one port | **Defect (medium)** → single serialized print path for test/auto/reprint (G18) |

### 2.3 Evaluation of `codex/delivery-today` — overlaps this plan
| Asset | Relevance |
|---|---|
| `delivery_orders` with **client-generated UUID primary key**, items jsonb (≤50, validated by trigger), status machine via `advance_delivery_order` | Already an **order header**; the client-supplied `id` gives idempotent creation. Candidate basis for ORD-01 instead of a new `orders` table. |
| `book_delivery_order`: row locks (`for update`) on order, finished goods, ingredients; inserts all sales in one transaction; `booked_at` marker makes retry a no-op | The **transactional + retry-safe** pattern this PRD requires for checkout (ORD-02). |
| `protect_delivery_sale` trigger blocks deleting/changing linked sales | Addresses void-restore races for linked sales (G3) — until a transactional refund exists. |
| `tests/delivery-orders.mjs` on **PGlite** (in-memory Postgres), wired into CI (`npm run test:delivery`) | Solves "no DB tests / no local DB": runs SQL migrations in Node without Supabase. **Adopt as the test harness** for print jobs and orders. |
| Thai-first `/today` UI; tab-bar/nav changes | **Conflicts** with master's 5-tab phone nav (`7ca2264`) — merge needs design decision. |
| **Migration `0020_delivery_orders.sql`** | **Number collision** with master's `0020_business_receipt_profile.sql`. |

### 2.4 Migration audit (must be resolved before any rollout)
| Migration | In `master` repo | Elsewhere | Applied to prod? | Finding |
|---|---|---|---|---|
| 0001–0015, 0017–0019 | ✅ | — | believed ✅ (verify) | — |
| **0016_made_to_order_recipes** | **❌** | `origin/codex/delivery-today` (`7b587d3`, 2026-08-17) | **Conflicting sources**: audit (2026-08-18, `docs/audit-2026-08.md:15,24`) says applied; `DELIVERY-SETUP.md` says verify before running, do not re-run | Master's history lacks a migration that prod may contain → **schema drift risk**. Read prod `supabase_migrations.schema_migrations` / inspect `recipes.is_made_to_order` read-only. Never recreate 0016 from the audit text. |
| **0020_business_receipt_profile** | ✅ (pushed, `7c02231`) | — | ❌ (owner not yet run) | Code deployed and tolerant; feature inactive. |
| **0020_delivery_orders** | ❌ | `codex/delivery-today` | ❌ (per its doc) | **Collides with the above.** Renumber one before either is applied. |
| 0021_print_jobs | local only | — | ❌ | Will be **revised** (§5.4) before anyone applies it; also depends on 0020 receipt profile. |

**Rule proposed:** migrations are numbered at merge time, unique across all branches; a migration is applied only from `master` after merge; the prod `schema_migrations` list is the source of truth and is recorded in `docs/` after each apply.

### 2.5 Confirmed defects / gaps (master)
| # | Finding | Evidence |
|---|---|---|
| G1 | Checkout not idempotent — retried request double-books sale + stock (+ print job) | `logCartSale`, `src/app/sales/actions.ts` |
| G2 | Cart = N `sales` rows, no order header/number | same; audit F11 |
| G3 | Void deletes then restores in a separate call | `deleteSale` → `delete()` then `rpc("adjust_finished_goods_stock")` (F2) |
| G4 | Batch delete restores ingredients read-modify-write | `src/app/batches/actions.ts:169–178` (F3) |
| G5 | Recipe margin deducts fee **and VAT**; sale margin deducts fee only | `calcRecipeCost` vs `calcSaleMargin`, `src/lib/costing.ts` |
| G6–G8 | Print Station status overclaim, mutable content, no station binding | §2.2 |
| G9 | Single-owner RLS (`user_id = auth.uid()`) everywhere | `0005_businesses.sql` |
| G10 | Dashboard N+1; uncached business lookup | `dashboard.ts:155–157` (F12), `businesses.ts` (F13) |
| G11 | No tests on master; costing untested (F10) | `package.json` |
| G12 | Duplicate platform fee presets | `costing.ts` `PLATFORM_FEE_PRESETS`, `src/lib/platforms.ts` |
| G13–G18 | Print Station: cookie-bound business vs page-load branding; unguarded retry; ignored finish result; RLS without business ownership; claim-all; test print bypasses port lock | §2.2 (review round 3, re-verified) |

---

## 3. Goals, non-goals, success measures
**Goals:** (1) no lost or duplicated orders; stock deducted exactly once; (2) common order ≤ 2 taps after item selection; label prints hands-free when the station is available, ≤ 3 taps via phone otherwise; (3) consistent, explainable numbers; (4) beginner reaches correct cost-per-unit ≤ 5 min; (5) business isolation ready for subscriptions.
**Non-goals now:** billing/entitlements, restaurant table/kitchen features, marketplace/delivery APIs, native apps, general ledger, payroll.
**Measures (limited rollout):** duplicate orders = 0; lost orders on print failure = 0; station-mode labels printed without manual intervention ≥ 95%; every `uncertain` job resolved by a person.

## 4. Users and workflows
Owner (all); helper/seller (later: Sell + Stock, no costs); print station (device). Printing workflows:

**Workflow A — mobile-assisted printing (PeriPage iOS app).** 1) user saves order; 2) app renders print-ready image; 3) user shares it to PeriPage *if the installed app accepts it*; 4) user confirms printing inside PeriPage; 5) fallback: save/download image for manual import. *Assisted, not unattended.* Do not assume Safari or a PWA can control the printer over Bluetooth.

**Workflow B — automatic printing via the shop computer.** 1) user saves order on the iPhone and requests shop printing; 2) server creates a durable print job for that business; 3) an approved Windows station retrieves it; 4) station sends it to the A6 by the transport chosen in §6; 5) app shows job status and recovery actions. The computer must be on and connected; behaviour when offline/sleeping/disconnected is specified (WB-03/04).

---

## 5. Requirements

### 5.1 Orders (foundation for reliable printing)
| ID | Requirement | Acceptance |
|---|---|---|
| ORD-01 | **Order header** + items with order number, customer name, customer instructions, channel/platform, payment method/status, totals. **Evaluate extending `delivery_orders` (branch) before creating a new `orders` table.** | Decision record; one header per checkout |
| ORD-02 | **Idempotent checkout**: client-generated order id (the branch's UUID-PK pattern) or `client_request_id` unique per business; header + items + stock deduction (+ auto print job) in **one transactional RPC** with row locks. The key is created when the checkout is first submitted and **persisted on the device (with a hash of the cart) until a definitive result** — surviving reload/app switch — then cleared. The same key with a **different payload is rejected** (conflict), never silently merged | Double tap, network drop + retry, reload mid-save, reopen after crash → one order, one deduction, one auto job; same key + changed cart → explicit error (PGlite test + physical P-DUP) |
| ORD-03 | Backfill/compatibility for existing `sales` (nullable `order_id` vs synthetic orders) | Reports identical before/after |
| ORD-04 | Transactional void/refund; linked sales protected (branch `protect_delivery_sale` pattern) | Stock restored exactly once; history kept |
| ORD-05 | One margin function for recipe (theoretical) and order (actual) with identical deductions | Same inputs → same margin on every screen |

### 5.2 Receipt and bag-label content
| ID | Requirement |
|---|---|
| LBL-01 | Business-configurable: logo optimised for monochrome, shop name, contact details, personalised thank-you (**exists in code, inactive until 0020**) |
| LBL-02 | Two templates: **Receipt** (prices, total, payment status) and **Bag label** (prominent customer name, order number, packing instructions; prices optional) |
| LBL-03 | Order number and date **and time**; items, quantities, customer instructions |
| LBL-04 | Thai + English, long names, wrapping, multiple items, Thai vowels/tone marks |
| LBL-05 | Printable width, margins, resolution **measured on the owner's A6 paper**; not inferred from nominal paper size |

### 5.3 Reliability (both workflows)
- Order persisted **before** any print attempt; print failure never loses or alters the order.
- Retrying printing never creates another sale or deducts stock again.
- Repeated taps/reconnects never create duplicate automatic jobs.
- Receipt content used for each job is preserved **immutably**.
- Intentional reprints require an explicit action and are recorded as reprints.
- Status distinguishes **queued, processing, sent, failed, uncertain**; a share or driver/port submission is never shown as confirmed physical printing.
- Ambiguous outcomes are resolved by a person; no blind automatic retry.
- Printer pairing, stations, and jobs are scoped to the correct business.

### 5.4 Print jobs (revise 0021 before it is applied)
| ID | Requirement | Acceptance |
|---|---|---|
| PJ-01 | Created only after the order commits (inside the order RPC for auto jobs) | Order intact when printing fails |
| PJ-02 | **Immutable receipt snapshot**: full render input incl. branding version (or the rendered PNG) stored on the job; never re-read from current settings | Reprint after branding edit reproduces the original |
| PJ-03 | One `auto` job per order (unique `(order_id) where kind='auto'`); `reprint` jobs explicit with actor | Repeated taps/reconnects → one auto job |
| PJ-04 | **State machine** (enforced in SQL, not UI):<br>`queued → processing` (claim) · `queued → cancelled` (phone fallback / user)<br>`processing → sent` (port/driver accepted all bytes) · `processing → failed` (error **before** any byte was sent) · `processing → uncertain` (error or crash **after** sending started, lease expiry, or result not recorded)<br>`failed → queued` (explicit retry) · `uncertain → resolved_ok` / `uncertain → reprint job` (person decides)<br>`sent` never means "physically printed"; UI says "Sent to printer" | Illegal transitions rejected by the DB; no "Printed" wording |
| PJ-05 | **Atomic claim bound to a station and a fixed business**: claim RPC takes the station id (whose `business_id` is fixed at approval, never the cookie), claims **one** job (`… for update skip locked limit 1`), sets `processing, station_id, claimed_at, lease_expires_at` | Two tabs/devices → each job printed once; switching business in another tab doesn't change what the station prints (PGlite concurrency test + P-TABS) |
| PJ-06 | Lease expiry or unrecorded result → **`uncertain`**, never auto-retried; recording the result is checked — if `finish` fails, the station shows `uncertain` locally and re-reports | P-CRASH → `uncertain`, no duplicate |
| PJ-07 | RLS: `user_id = auth.uid()` **and** `business_id` owned by `auth.uid()` on select/insert/update (branch `delivery_orders` pattern); retry allowed only from `failed` | Cross-business and wrong-state updates denied (PGlite tests) |
| PJ-08 | **One serialized print path** per station: test print, automatic jobs and reprints share one queue/lock on the port | Test print during an automatic job waits; never two writers |

### 5.5 Workflow A — independent milestone
| ID | Requirement | Acceptance |
|---|---|---|
| WA-01 | Image → Share Sheet → PeriPage → confirm | **Verified on owner's iPhone** that PeriPage accepts shared PNGs; else document the working route (Save to Photos → import) |
| WA-02 | Save/download fallback | Works when sharing is unavailable |
| WA-03 | Records "shared", never "printed" | — |

### 5.6 Workflow B — independent milestone
| ID | Requirement | Acceptance |
|---|---|---|
| WB-01 | Transport chosen by §6 criteria from hardware evidence | Decision record |
| WB-02 | Station approval: named device approved by owner (`print_stations`, `last_seen_at`); only approved stations claim; per-device tokens deferred to subscription phase | Unapproved browser cannot claim |
| WB-03 | Offline: jobs stay queued; phone shows "Shop printer offline — prints when it's back" + *Print from phone*; heartbeat drives indicator. **Choosing *Print from phone* atomically cancels the station job if it is still `queued`**; if it is already `processing`/`sent`/`uncertain`, the phone warns "The shop printer may have printed this — check before printing here" and records a reprint only on confirmation | Station offline → phone warns ≤ 30 s; phone fallback + station return → exactly one label unless the user confirms a reprint |
| WB-04 | Documented, tested recovery: page close/reload, PC sleep/wake, USB unplug/replug, printer power cycle, paper out | P-REC-* pass |
| WB-05 | Coexists with Workflow A; A6 alternates between iPhone app and PC | P-SWITCH pass or limitation documented |

---

## 6. Printing transport — hypotheses to test (no decision yet)

**Principle:** the existence of Print Station code is **not** evidence that its transport is right. Choose by the criteria below after the hardware spike.

### 6.1 Hypotheses
| # | Hypothesis | Source / basis | Test | If false |
|---|---|---|---|---|
| H1 | PeriPage iOS app accepts PNGs from the iOS Share Sheet | Assumed; not verified | Share a test PNG on the owner's iPhone | Workflow A uses Save to Photos → import |
| H2 | A6 over **Bluetooth** exposes a serial (SPP/RFCOMM) port that Chrome/Edge Web Serial can open on Windows | Chrome docs: [Web Serial](https://developer.chrome.com/docs/capabilities/serial), [Serial over Bluetooth RFCOMM](https://developer.chrome.com/blog/serial-over-bluetooth); community: A6 uses SPP/RFCOMM ([eliasweingaertner/peripage-A6-bluetooth](https://github.com/eliasweingaertner/peripage-A6-bluetooth)) | `preview/print-test.html` → Connect over BT | Drop B1 |
| H3 | Over **USB**, the A6 enumerates as a serial/COM device | Unknown | Device Manager: *Ports (COM & LPT)* vs *Printers*/*USB* | Drop B2 |
| H4 | A visible COM port accepts the **same** framing: reset `10fffe01+00×12`, `GS v 0` blocks ≤ 255 rows × 48 bytes, `1b4a40`, `10fffe45`, 122-byte writes / 20 ms | Community reverse engineering ([bitrate16/peripage-python](https://github.com/bitrate16/peripage-python), [eliasweingaertner](https://github.com/eliasweingaertner/peripage-A6-bluetooth)); **not vendor-documented** | Test print; vary chunk/delay; long label | B1/B2 unusable → B3+ |
| H5 | Printable width = 384 dots (48 mm) with usable side margins on the owner's paper | Community docs for A6 at 203 dpi | Calibration print with ruler marks | Adjust renderer width/margins |
| H6 | **Official Windows driver** exists and prints from Windows apps | Vendor: [PeriPage app & PC driver page](https://www.peripageglobal.com/pages/try-on-app); third-party instructions reference a USB driver | Install on test basis; print PNG from browser dialog | Drop B3 |
| H7 | Driver path **cannot** handle variable-length labels without a fixed page size | Community report: driver "needs a page size defined before printing" ([eliasweingaertner](https://github.com/eliasweingaertner/peripage-A6-bluetooth)); not vendor-confirmed | Print 2 lengths with custom page sizes / "auto" | If false, B3 becomes strong |
| H8 | Silent printing without dialog is possible (Chrome `--kiosk-printing`, or a bridge) | Chrome command-line switch; QZ Tray / PrintNode docs ([QZ FAQ](https://qz.io/docs/faq)) | Station page with `--kiosk-printing` to default printer | B3 needs a bridge (B4) |
| H9 | Installing the driver takes the USB interface away from Web Serial | Typical Windows printer-class behaviour; unverified | After H6, re-check H3 | Both paths may coexist |
| H10 | The A6 can alternate between iPhone app (BT) and PC (USB or BT) without re-pairing each time | Unknown | P-SWITCH | Dedicate A6 to one host or accept manual switching |

### 6.2 Candidate transports
| Option | Summary |
|---|---|
| B1 | Web Serial over Bluetooth (prototype exists) |
| B2 | Web Serial over USB (only if H3 **and** H4 hold) |
| B3 | Vendor driver + silent browser printing (`--kiosk-printing`). Whether the driver handles variable-length labels is **H7 (untested)** — a community report says a page size must be defined; that is a hypothesis, not a conclusion |
| B4 | Existing print bridge + vendor driver. **Unverified vendor claims, to confirm in the spike:** QZ Tray — its FAQ states silent printing requires buying a certificate or supplying your own root certificate ([QZ FAQ](https://qz.io/docs/faq)); current price, runtime requirements and licence terms for a future multi-tenant product not checked. PrintNode — cloud agent with usage-based plans per a third-party comparison ([odooskillz](https://www.odooskillz.com/blog/odoo-skillz-insights-1/best-qz-tray-alternatives-odoo-pos-2026-426)); pricing not checked with the vendor. |
| B5 | Custom Windows helper (our installer, updates, signing) |

### 6.3 Selection criteria (score each option 0–3 from spike evidence; weights proposed)
| Criterion | Weight |
|---|---|
| Unattended reliability over 2 weeks (no manual reconnects) | 5 |
| Variable-length label support without waste/clipping | 4 |
| Outcome visibility (can distinguish sent/failed; detect disconnect) | 3 |
| Dependence on unofficial protocol (lower is better) | 3 |
| Install + update burden on the shop PC | 3 |
| Coexistence with Workflow A on the same A6 | 2 |
| Recurring cost / licensing | 2 |
| Suitability for future subscribers (support burden, per-tenant cost) | 2 |
Tie-break: prefer zero-install options (B1/B2/B3 without bridge); B5 only if all others fail.

---

## 7. Technical proposal (summary)
- **Order model:** extend or generalise `delivery_orders` (client UUID PK, items, status machine, booking RPC) to cover walk-in/marketplace checkout; otherwise new `orders` + `order_items` with the same transactional RPC. Auto print job created inside the same transaction when enabled.
- **Print jobs:** revised 0021 — `order_id`, `kind (auto|reprint)`, `snapshot jsonb` (immutable), `status (queued|processing|sent|failed|uncertain)`, `station_id`, `claimed_at`, `lease_expires_at`, `sent_at`, `resolved_by/at`; unique auto job per order; RLS by business.
- **Stations:** `print_stations(id, business_id, name, approved, last_seen_at)`; claim RPC requires an approved station.
- **Isolation:** every new table RLS-scoped by business; membership (`business_members`, `is_member()`) introduced before any staff access; the branch's policies already check both `user_id` and business ownership — use as the interim pattern.
- **Deployment:** per-business flag for station printing; additive migrations only; rollback = flag off → Workflow A continues.

---

## 8. Pre-merge checks (required before anything reaches `master`)
**Automated (CI):**
1. Checks run on every PR into `master` (already configured, `build.yml:3–7`); work goes through a **Draft PR from a review branch** so checks run before merge. Optionally add `push` on review branches. Check the Netlify deploy-preview settings for PRs (a preview deploy must not touch production data).
2. `npm ci` → `npx tsc --noEmit` → `npm run lint` (scoped to changed paths initially) → **PGlite DB tests** (`tests/*.mjs`: existing delivery tests + new tests for order idempotency, print-job claim concurrency, stuck-lease → uncertain, cross-business RLS) → `next build`.
3. Migration lint: numbers unique across the branch vs `master`; no gaps/duplicates; each new migration applies cleanly in PGlite on top of the full chain.

**Manual:**
4. Migration review: applied-state checked against prod `schema_migrations` (read-only); additive; backfill verified; rollback noted in the commit message (existing AGENTS.md convention).
5. Reviewer sign-off on the diff; "hardware untested" stated when applicable.
6. For printing changes: the relevant physical tests in §9 recorded in `docs/`.

---

## 9. Physical acceptance tests (owner's hardware)
| ID | Test | Pass |
|---|---|---|
| P-CAL | Calibration print: width, margins, ruler marks | Measured values recorded |
| P-TH | Thai vowels/tone marks above/below, mixed Thai/English | Legible, nothing clipped |
| P-LOGO | Colour and B/W logos | Recognisable, no black blocks |
| P-LONG | 15 items, 40-char name, 3-line instructions | Wraps, nothing cut |
| P-DUP | Double-tap Charge; network drop during save then retry; reload | One order, one label |
| P-TABS | Two station tabs/devices | Each job printed once |
| P-CRASH | Close station right after sending | `uncertain`, no auto reprint |
| P-REC-USB / -PWR / -SLEEP / -PAPER | Unplug USB, power-cycle printer, sleep PC, paper out mid-job | Clear state, documented recovery, no lost orders |
| P-REPRINT | Reprint after branding edit | Original content, marked reprint |
| P-SWITCH | iPhone app → PC → iPhone app | Works or limitation documented |
| P-WA | Workflow A end-to-end on owner's iPhone | H1 confirmed or alternative documented |

---

## 10. Phased plan
| Phase | Milestone | Depends on | Exit criteria |
|---|---|---|---|
| **0 Baseline** | Verify §2; reconcile **0016** with prod (read-only); resolve **0020 collision** (renumber plan); decide how `codex/delivery-today` and master's phone UI merge | — | Reconciliation note in `docs/`; migration numbering plan approved |
| **1 CI & test harness** (before any order/stock change) | §8 automated checks incl. `tsc --noEmit` and PGlite on the Draft-PR path; adopt PGlite harness on master | 0 | CI green on a Draft PR from a review branch |
| **2 Hardware spike** | H1–H10; P-CAL; score §6.3 | 0 (can run in parallel with 1) | Transport decision record |
| **3 Reliable orders** | ORD-01–05 (reusing branch patterns) | 0, 1 | P-DUP logic tests green in PGlite |
| **4 Print jobs v2** | PJ-01–08 (fixes G6–G8, G13–G18), stations (WB-02), revised 0021 | 1, 3 | P-TABS / P-CRASH / wrong-state / cross-business logic tests green |
| **5 Workflow A** | LBL-02/03 templates, WA-01–03 | 2, 3 | P-WA, P-TH, P-LONG pass |
| **6a Workflow B pilot — entry** | Chosen transport, WB-03/04, flag on for the owner's shop only; share fallback kept | 2, 4 | **Entry criteria:** migrations reconciled & applied; all §8 checks green; P-CAL, P-TH, P-LONG, P-DUP, P-TABS, P-CRASH, P-REC-* passed once on the shop hardware; owner briefed on `uncertain` handling |
| **6b Workflow B — general approval** | Pilot runs in daily use | 6a | **Exit criteria:** ≥ 2 weeks of daily use, ≥ 95% of station-mode labels without intervention, 0 lost orders, 0 duplicate orders, every `uncertain` resolved, no open high-severity defect |
| **7 Remaining correctness** | G4, F7/F9, G5, G10, G12, costing unit tests | 1 | Tests green |
| **8 Beginner UX** | Wizard, Thai UI (reuse branch Thai copy), explainers, today-first home, PromptPay | 7 | Beginner ≤ 5 min to cost/unit |
| **9 Operations** | Days-of-stock, expiry, receivables, suppliers | 7 | — |
| **10 Teams → subscription** | Membership/roles, audit log; billing last | 6–8 stable | RLS isolation suite green |

Workflow A (phase 5) and Workflow B (phase 6) remain independently testable and releasable.

---

## 11. Release and push policy
- **Owner rule (current): nothing is pushed without the owner's explicit instruction.**
- Separate **backup/review** from **release**: pushing to a review branch or draft PR (after §8 checks can run) is recommended by the reviewer and **awaits the owner's decision**; merging to `master` (auto-deploys via Netlify) requires §8 checks, migration reconciliation, and — for printing — the relevant physical tests.
- Migrations are applied by the owner only after merge and reconciliation, in the numbered order recorded in `docs/`.

## 12. Risks
| # | Risk | Mitigation |
|---|---|---|
| K1 | Schema drift (0016) and 0020 collision | Phase 0 before any migration |
| K2 | Unofficial A6 protocol | Hypothesis testing; Workflow A as permanent fallback |
| K3 | Driver path can't do variable length | H7 test; fixed-length template if B3 wins |
| K4 | Station needs awake PC with open browser | Heartbeat, phone warning, durable queue |
| K5 | Two parallel streams (master phone UX vs delivery branch) diverge further | Merge decision in Phase 0; single roadmap (this doc) |
| K6 | Order-model change touches money/stock | Transactional RPC, PGlite tests, additive migrations, flag |
| K7 | Overengineering for a 1–2 person shop | Defer device tokens, bridges, billing, complex roles |

## 13. Requested review output
1. §2 claim verification (confirmed / refuted / unverifiable, file:line).
2. Critical risks ranked with failure scenario and fix.
3. Challenges to §5–§10 incl. what to cut as overengineering.
4. ORD-01 recommendation: extend `delivery_orders` vs new `orders`; migration/backfill/rollback.
5. Migration plan for 0016 / 0020 collision / 0021 revision.
6. Transport scoring template to fill after the spike (§6.3).
7. Go/no-go: review-branch push; merge to `master`; applying 0020 (receipt profile); applying 0021 as-is (expected no).
8. Only decision-changing open questions.

## 14. Decisions
**Recommended defaults (review round 3) — adopted unless the owner overrides:**
- Order number: **display number per business per Bangkok day**, e.g. `20260924-003`, backed by an internal UUID and a unique constraint `(business_id, order_date, seq)`.
- Bag label **hides prices by default**; the Receipt template shows them.
- Production schema access for the reviewer: **read-only, structure and migration history only** — no customer data.

**Go / no-go (current):**
| Item | Status |
|---|---|
| Push to a review branch / Draft PR | **Declined by owner (2026-09-25) — review stays local.** Reviewers read the local repo or the patch package in `ordexa-review`; backup is a local `git bundle` there. Consequence: CI cannot run until something is pushed, so every §8 check that needs CI stays pending |
| Merge to `master` | **No-go** |
| Apply `0021` as written | **No-go** — revise per PJ-04–08 |
| Apply `0020` (receipt profile) | **Undecided** — after prod schema check, 0016 reconciliation and 0020 renumbering |

**Owner decisions (2026-09-25):**
1. Review-branch push: **no — keep review local** (above).
2. Schema access: **approved**, read-only, structure + migration history only. Method: the **owner runs the queries in Appendix A** in the Supabase SQL editor and shares the output; no credentials are given to agents.
3. `codex/delivery-today`: owner asked for an explanation before deciding — options in Appendix B.

## Appendix A — read-only schema check (owner runs in the Supabase SQL editor)
```sql
-- 1. Migration history (may be empty if migrations were pasted into the SQL editor instead of run by the CLI)
select version, name from supabase_migrations.schema_migrations order by version;

-- 2. Which migrations' objects exist (structure only; no customer data is read)
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('delivery_orders','print_jobs','sale_ingredient_usage','cash_reconciliations','stock_adjustments')
 order by 1;

select table_name, column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'recipes'    and column_name = 'is_made_to_order')
     or (table_name = 'businesses' and column_name in ('logo_data_url','print_after_sale','print_target'))
     or (table_name = 'sales'      and column_name = 'delivery_order_id'))
 order by 1, 2;

select event_object_table, trigger_name from information_schema.triggers
 where trigger_schema = 'public' order by 1, 2;
```
Interpretation: `recipes.is_made_to_order` + table `sale_ingredient_usage` ⇒ 0016 applied · table `delivery_orders` ⇒ branch 0020 applied · `businesses.logo_data_url` ⇒ master 0020 applied · table `print_jobs` ⇒ 0021 applied.

## Appendix B — what "merging `codex/delivery-today`" means
The branch (Codex agent, 2026-09-13) adds a **made-to-order food line** (0016: a sale deducts ingredients directly, no batch step) and a Thai **`/today` delivery board** (orders from Grab / LINE MAN / direct → cooking → ready → delivered → booked as sales in one transaction). It was built on `66a5b4e`, **before** master's phone navigation, Sell cart, label printing and Print Station. Merging means renumbering its 0020, resolving conflicts in `tab-bar.tsx`, `nav.tsx`, `more/page.tsx`, `page.tsx`, `sales/actions.ts`, `proxy.ts`, and choosing one navigation:
- **B1 — don't merge now:** keep the sauce-only scope; reuse only the PGlite test harness and the idempotent order/booking pattern.
- **B2 — merge, `/today` becomes the home screen:** fits if the made-to-order / delivery food line is the main daily job.
- **B3 — merge into the 5-tab bar (recommended if both lines are active):** Home = today summary; the **Sell** tab gets two modes — *Walk-in* (current cart) and *Orders* (the `/today` queue); a per-business setting picks the default (sauce business → Walk-in, food business → Orders).

Deciding factor: does the owner run the made-to-order / Grab / LINE MAN business day to day?

## 15. Review log
| Source | Point | Decision |
|---|---|---|
| Brief | Order header, number, instructions, time, payment status | Adopted (ORD-01, LBL-02/03) |
| Brief | Two templates | Adopted (LBL-02) |
| Brief | Status incl. sent/uncertain; never claim physical print | Adopted (PJ-04/06) |
| Brief | Preserve job content | Adopted as immutable snapshot (PJ-02) |
| Brief | Workflow B via USB driver | Reframed as hypotheses H3/H6–H9 |
| Brief | Existing bridge vs custom helper | B4/B5 with criteria |
| Brief | "Branding missing" | Refined: code deployed (`7c02231`), **inactive in prod until 0020** |
| Reviewer | COM port ≠ compatible protocol | H4 |
| Reviewer | Printer class ≠ no web printing | B3/H6/H8 |
| Reviewer | Queue, pairing, recovery for iPhone→PC | WB-02–04; queue exists (§2.2) |
| Reviewer | Order correctness before auto-print | Phases 3–4 precede 6 |
| Reviewer | 0016 missing; don't recreate | §2.4 — found on `codex/delivery-today`; plus 0020 collision |
| Reviewer | CI type-check accuracy | Corrected (§0, §8) |
| Reviewer | Station/device binding from v1 | WB-02 (light), tokens deferred |
| Reviewer | A6 switching iPhone ↔ Windows | H10, P-SWITCH |
| Reviewer | Revised phase order; separate backup from release | §10, §11 |
| Reviewer r3 | G13 business from cookie vs page-load branding | Confirmed; PJ-05 station bound to fixed business |
| Reviewer r3 | G14 unguarded retry while printing | Confirmed; PJ-04 state machine, PJ-07 retry only from `failed` |
| Reviewer r3 | G15 finish result ignored | Confirmed; PJ-06 unrecorded ⇒ `uncertain` |
| Reviewer r3 | G16 RLS lacks business ownership | Confirmed; PJ-07 |
| Reviewer r3 | G17 claim-all strands jobs | Confirmed; PJ-05 claim one with lease |
| Reviewer r3 | G18 test print bypasses port lock | Confirmed; PJ-08 |
| Reviewer r3 | Idempotency key must survive reload; same key + different cart | Adopted (ORD-02) |
| Reviewer r3 | Phone fallback can double print | Adopted (WB-03 atomic cancel / warn) |
| Reviewer r3 | State diagram implied errors only after send | Adopted (PJ-04 explicit transitions) |
| Reviewer r3 | Checks before order work; PR trigger already exists | Adopted; v3 CI statement corrected (§0, §8, Phase 1) |
| Reviewer r3 | Separate pilot entry from general approval | Adopted (Phases 6a/6b) |
| Reviewer r3 | Driver fixed-page and QZ Tray statements still read as facts | Reworded as unverified (§6.2 B3/B4) |
| Reviewer r3 | Order number `YYYYMMDD-NNN` Bangkok + UUID; hide prices on bag label; read-only schema access | Adopted as defaults (§14) |
| Owner (v3 instruction) | Merge docs; evaluate Print Station first; hypotheses with sources & criteria; status matrix; migration checks; pre-merge checks; docs-only local commit | Done in this version |

## 16. Task list (derived from findings; ordered; docs-only until authorised)
| # | Task | Phase | Blocks |
|---|---|---|---|
| T1 | Read-only check of prod `schema_migrations` + `recipes.is_made_to_order`; write `docs/migration-reconciliation.md` | 0 | all migrations |
| T2 | Decide 0020 renumbering (receipt profile vs delivery orders) and branch merge order | 0 | T8, T12 |
| T3 | Decide navigation merge (`/today` vs 5-tab) | 0 | branch merge |
| T4 | (On authorisation) push review branch; open Draft PR; confirm CI + deploy-preview behaviour | 1 | T5 |
| T5 | Add `tsc --noEmit` + PGlite test step on master's CI path | 1 | T8–T12 |
| T6 | Hardware spike H1–H10, P-CAL; fill §6.3 scores | 2 | T13 |
| T7 | ORD-01 decision: extend `delivery_orders` vs new `orders` | 3 | T8 |
| T8 | Order RPC with persisted idempotency key + payload hash (ORD-02) + PGlite tests | 3 | T10 |
| T9 | Transactional void (ORD-04), unified margin (ORD-05, G5) | 3 | — |
| T10 | Revise 0021: state machine, snapshot, `kind`, station, lease, business-owned RLS, retry guard (PJ-01–07) + PGlite tests (concurrency, wrong state, cross-business, lease → uncertain) | 4 | T11 |
| T11 | Station: fixed business binding, claim-one, checked result recording, single print path (G13–G18, PJ-08), approval UI (WB-02), heartbeat/offline + phone fallback cancel (WB-03) | 4 | T13 |
| T12 | Templates Receipt/Bag label, order number/time/instructions (LBL-02/03) | 5 | T13 |
| T13 | Pilot entry checklist (6a) on shop hardware | 6a | T14 |
| T14 | Two-week pilot metrics → general approval (6b) | 6b | — |
