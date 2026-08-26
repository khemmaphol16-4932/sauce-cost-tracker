// ---- Daily closing (mirrors cash_reconciliations in the real app) ----
const CLOSING_REASONS = ["Counting error", "Petty cash / expense paid from drawer"];

function computeExpectedCash(date) {
  return sales
    .filter(
      (s) =>
        s.sale_date === date &&
        s.payment_status === "paid" &&
        (s.payment_method || "").toLowerCase() === "cash"
    )
    .reduce((sum, s) => sum + s.price_charged_total, 0);
}

function render_closing() {
  const el = document.getElementById("section-closing");
  const date = todayISO();
  const expected = computeExpectedCash(date);
  const existing = cashReconciliations.find((c) => c.reconciliation_date === date);

  el.innerHTML = `
    <div class="section-header"><div><h1>Daily closing</h1><p>Count the drawer, compare to expected cash</p></div></div>

    <div class="card">
      <p class="card-sub">Expected cash (${date})</p>
      <p style="font-family:var(--font-mono);font-size:28px;font-weight:700;color:var(--color-text);margin:4px 0">
        ${money(expected)}
      </p>
      <p class="card-sub">Sum of paid cash sales today</p>
    </div>

    <div class="card">
      <div class="field">
        <label>Counted cash (฿)</label>
        <input id="cl-counted" type="number" inputmode="decimal" min="0"
               value="${existing ? existing.counted_cash : ""}"
               oninput="updateClosingHint(${expected})">
        <p id="cl-hint" style="margin:4px 0 0;font-size:12px;color:var(--color-text-secondary)"></p>
      </div>
      <div class="field" id="cl-reason-field" style="display:none">
        <label>Reason</label>
        <div id="cl-reason-pills" style="display:flex;flex-wrap:wrap;gap:8px">
          ${CLOSING_REASONS.map(
            (r) => `
            <button type="button" class="btn btn-sm ${existing && existing.reason === r ? "btn-primary" : "btn-ghost"}"
                    data-reason="${r}" onclick="selectClosingReason('${r}')">${r}</button>
          `
          ).join("")}
        </div>
        <input type="hidden" id="cl-reason" value="${existing && existing.reason ? existing.reason : ""}">
      </div>
      <div class="field">
        <label>Note (optional)</label>
        <input id="cl-notes" value="${existing && existing.notes ? existing.notes : ""}">
      </div>
      <button class="btn btn-primary" style="margin-top:10px" onclick="submitClosing('${date}', ${expected})">
        ${existing ? "Update closing" : "Save closing"}
      </button>
    </div>
  `;

  updateClosingHint(expected);
}

function updateClosingHint(expected) {
  const input = document.getElementById("cl-counted");
  const hint = document.getElementById("cl-hint");
  const reasonField = document.getElementById("cl-reason-field");
  const raw = input.value;
  const val = Number(raw);

  if (raw === "" || !Number.isFinite(val)) {
    hint.textContent = "";
    reasonField.style.display = "none";
    return;
  }

  const variance = val - expected;
  if (variance === 0) {
    hint.textContent = "";
    reasonField.style.display = "none";
  } else {
    hint.style.color = variance < 0 ? "var(--color-alert)" : "var(--color-text-secondary)";
    hint.textContent = `${variance > 0 ? "Over" : "Short"} by ${money(Math.abs(variance))}`;
    reasonField.style.display = "block";
  }
}

function selectClosingReason(reason) {
  document.getElementById("cl-reason").value = reason;
  document.querySelectorAll("#cl-reason-pills button").forEach((btn) => {
    const active = btn.dataset.reason === reason;
    btn.className = "btn btn-sm " + (active ? "btn-primary" : "btn-ghost");
  });
}

function submitClosing(date, expected) {
  const counted = Number(document.getElementById("cl-counted").value);
  const reason = document.getElementById("cl-reason").value;
  const notes = document.getElementById("cl-notes").value.trim();

  if (!Number.isFinite(counted) || counted < 0) {
    return showToast("Enter the amount you counted (0 or more)", true);
  }
  const variance = counted - expected;
  if (variance !== 0 && !reason) {
    return showToast("Pick a reason for the variance", true);
  }

  const existingIdx = cashReconciliations.findIndex((c) => c.reconciliation_date === date);
  const row = {
    id: existingIdx >= 0 ? cashReconciliations[existingIdx].id : uid(),
    reconciliation_date: date,
    expected_cash: expected,
    counted_cash: counted,
    reason: reason || null,
    notes: notes || null,
  };
  if (existingIdx >= 0) cashReconciliations[existingIdx] = row;
  else cashReconciliations.push(row);

  saveAll();
  showToast("Closing saved — you can re-close later if the count changes");
  render_closing();
}
