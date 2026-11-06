/**
 * Repair FMS - Planned / Actual / Delay report  (v4)
 *
 * App me har page ka "Pending" us task ka hota hai jiska PICHLA step ho chuka
 * hai aur ye step abhi baaki hai (step ki row tab tak bani hi nahi hoti).
 * Isliye ye script indent se shuru karke har task ka flow nikalti hai aur
 * wahi Pending / History gino deti hai jo app ke page me dikhta hai
 * (common bill ke child tasks hide, advance tasks alag flow me,
 * Pmmpl / Refrasynth me Posting + Payment skip hote hain).
 *
 * v4: sirf zaroori columns fetch hote hain, saari tables ek saath (parallel)
 * aur ek hi baar me aati hain -> Supabase egress bahut kam.
 *
 * Setup: poora code paste karo, refreshReport() run karo.
 * Roz auto-refresh ke liye installDailyTrigger() ek baar run karo.
 */

const SUPABASE_URL = "https://jfwruwrpjrbhcvtlqire.supabase.co";
// Supabase anon (public) key - wahi jo app ke frontend me use hoti hai.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmd3J1d3JwanJiaGN2dGxxaXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODc0MTksImV4cCI6MjEwNzQ2MzQxOX0.J4K_CbUke5x2mq6L3JkfzIbL0R5-u-1lNXSoz3BmUDU";
const TZ = "Asia/Kolkata";
const PAGE_SIZE = 1000; // Supabase ka default max rows per request
const DATE_FORMAT = "MM/dd/yyyy HH:mm:ss";

// App me har user apni firm(s) tak limited hota hai (Users > Firm Name), isliye app ke numbers
// sheet ke "saari firms" wale numbers se kam dikhte hain. Sheet ko kisi login jaisa banana ho to
// yahan wahi firms likho, e.g. "Pmmpl, Refrasynth" ("All" firm ke tasks hamesha aate hain).
// Khali ("") = saari firms.
const FIRM_SCOPE = "";

// Ye firms Check Machine ke baad seedha Store In jaati hain (src/utils/firmFlow.js jaisa).
const DIRECT_STORE_IN_FIRMS = ["pmmpl", "refrasynth"];

// Sirf wahi columns jo report me use hote hain (select=* se kai guna kam data).
// table: asli table; cols: select list; order: row order.
// indent / repair_advance ka order bilkul app jaisa (created_at desc) rakhna zaroori hai: common-bill
// me parent/child "pehla row" se tay hota hai aur migrated rows ka created_at same hota hai,
// isliye tie-break (jaise id) lagane se parent badal jata hai aur page ka data alag aata hai.
const SOURCES = {
  indent: { table: "indent", order: "created_at.desc",
    cols: "task_no,firm_name,machine_name,department,priority,indentor_name,planned_sent_date,created_at" },
  sv: { table: "sent_to_vendor", order: "id.asc",
    cols: "task_no,planned_date,actual_date,vendor_name_1,vendor_name_2,vendor_name_3,transporter_name_1,payment_type_1" },
  ma: { table: "management_approval", order: "id.asc",
    cols: "task_no,planned_date,actual_date,approved_vendor_name,approved_payment_term,advance_amount,approval_status" },
  cm: { table: "check_machine", order: "id.asc",
    cols: "task_no,planned_date,actual_date,bill_no,type_of_bill,total_bill_amount,checked_by" },
  si: { table: "store_in", order: "id.asc",
    cols: "task_no,planned_date,actual_date,received_quantity,bill_match,store_in_done_by" },
  p: { table: "posting", order: "id.asc",
    cols: "task_no,planned_date,actual_date,posting_voucher_no,posting_done_by" },
  mp: { table: "make_payment", order: "id.asc",
    cols: "task_no,planned_date,actual_date,payment_type,payment_utr_no,amount_paid,payment_done_by" },
  acc: { table: "accounts", order: "id.asc",
    cols: "task_no,voucher_no,planned_1,actual_1,status_1,remarks_1,planned_2,actual_2,status_2,remarks_2," +
      "planned_3,actual_3,status_3,remarks_3,planned_4,actual_4,status_4,remarks_4" },
  adv: { table: "repair_advance", order: "created_at.desc",
    cols: "repair_task_no,firm_name,machine_name,vendor_name,bill_no,advance_amount_paid,checked_by," +
      "planned_posting,actual_posting,posting_voucher_no,posting_done_by," +
      "planned_payment,actual_payment_date,advance_payment_utr,payment_done_by," +
      "planned_check_machine,actual_check_machine_date," +
      "planned_store_in,actual_store_in_date,received_quantity,store_in_done_by," +
      "planned_full_billing,actual_full_billing_date,planned_accounts,actual_accounts_date" },
};

// ───────────────────────── Entry points ─────────────────────────

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Repair FMS Report")
      .addItem("Refresh report", "refreshReport")
      .addItem("Install daily auto-refresh", "installDailyTrigger")
      .addToUi();
  } catch (e) {
    // standalone script: menu nahi banta
  }
}

function refreshReport() {
  // Do runs ek saath na chalein (double click / trigger overlap) -> double fetch nahi.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("Dusra refresh already chal raha hai, skip.");
    return;
  }
  try {
    const ss = getSpreadsheet_();
    ss.setSpreadsheetTimeZone(TZ);
    const data = applyFirmScope_(fetchTables_(SOURCES));
    const pages = buildPages_(data, todayStr_());

    // Replace the old combined Accounts report with a current stage summary.
    const legacyAccounts = ss.getSheetByName("Accounts");
    if (legacyAccounts) {
      writeSummary_(getSheet_(ss, "Accounts", 0), pages.filter((pg) =>
        ["Audit Data", "Rectify the Mistake", "Reaudit Data", "Take Entry By Tally"].includes(pg.name)));
      legacyAccounts.getRange(1, 1).setValue("Accounts - separate step reports; open the four stage tabs");
    }
    writeSummary_(getSheet_(ss, "Summary", 0), pages);
    pages.forEach((pg, i) => writeTab_(getSheet_(ss, pg.name, i + 1), pg));

    const blank = ss.getSheetByName("Sheet1");
    if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

    Logger.log("Report updated: " + ss.getUrl());
  } finally {
    lock.releaseLock();
  }
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "refreshReport")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("refreshReport").timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
}

// ───────────────────────── Supabase fetch ─────────────────────────

function requestFor_(src, offset) {
  return {
    url: SUPABASE_URL + "/rest/v1/" + src.table +
      "?select=" + encodeURIComponent(src.cols) +
      "&order=" + encodeURIComponent(src.order) +
      "&limit=" + PAGE_SIZE + "&offset=" + offset,
    method: "get",
    muteHttpExceptions: true,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Accept-Encoding": "gzip",
    },
  };
}

// Saari tables ek saath (UrlFetchApp.fetchAll). Agla page sirf tab mangta hai
// jab pichla page poora (PAGE_SIZE rows) bhara ho - extra khali request nahi.
function fetchTables_(sources) {
  const out = {};
  let pending = Object.keys(sources);
  pending.forEach((k) => { out[k] = []; });
  let offset = 0;
  while (pending.length) {
    const responses = UrlFetchApp.fetchAll(pending.map((k) => requestFor_(sources[k], offset)));
    const next = [];
    responses.forEach((res, i) => {
      const key = pending[i];
      const code = res.getResponseCode();
      if (code !== 200 && code !== 206) {
        throw new Error(sources[key].table + " fetch failed (" + code + "): " + res.getContentText().slice(0, 200));
      }
      const batch = JSON.parse(res.getContentText());
      if (!Array.isArray(batch)) throw new Error(sources[key].table + ": unexpected response");
      batch.forEach((r) => out[key].push(r));
      if (batch.length === PAGE_SIZE) next.push(key);
    });
    pending = next;
    offset += PAGE_SIZE;
  }
  return out;
}

// Supabase se saari firms aati hain; FIRM_SCOPE set ho to app ke matchesFirm jaisa filter.
function applyFirmScope_(data) {
  const allowed = String(FIRM_SCOPE).split(",").map((f) => f.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || allowed.indexOf("all") !== -1) return data;
  const ok = (firm) => {
    const f = String(firm || "").trim().toLowerCase();
    return Boolean(f) && (f === "all" || allowed.indexOf(f) !== -1);
  };
  const firmOfTask = {};
  data.indent.forEach((i) => { firmOfTask[String(i.task_no || "").trim()] = i.firm_name; });
  data.adv = data.adv.filter((a) => ok(a.firm_name || firmOfTask[String(a.repair_task_no || "").trim()]));
  data.indent = data.indent.filter((i) => ok(i.firm_name));
  return data;
}

// ───────────────────────── Date / delay maths ─────────────────────────

function todayStr_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
}

// Keep timestamps as Date objects so Google Sheets can calculate with them.
// Supabase timestamptz is an instant; date-only / zone-less values use IST.
function toDate_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error("Invalid Date object");
    return value;
  }
  let text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(text)) {
    throw new Error("Expected Supabase ISO date: " + text);
  }
  text = text.replace(" ", "T");
  if (text.length === 10) text += "T00:00:00";
  if (!/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(text)) text += "+05:30";
  text = text.replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(text);
  if (isNaN(date.getTime())) throw new Error("Invalid source date: " + text);
  return date;
}

function toDay_(value) {
  const date = toDate_(value);
  return date ? Utilities.formatDate(date, TZ, "yyyy-MM-dd") : "";
}

function dayNum_(d) {
  const p = d.split("-");
  return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000;
}

function diffDays_(from, to) {
  return Math.round(dayNum_(to) - dayNum_(from));
}

// Ek step: planned / actual / pichle step ki date (planned missing ho to React jaisa fallback).
// forceDone: step ki apni date nahi hai par task aage badh chuka hai (app ise Pending nahi ginta).
function calc_(planned, actual, since, today, forceDone) {
  planned = planned || since || "";
  const p = toDay_(planned);
  const a = toDay_(actual);
  let delay = "";
  let status;
  if (a) {
    status = "Done";
    if (p) {
      delay = Math.max(0, diffDays_(p, a));
      if (delay > 0) status = "Done (Delayed)";
    }
  } else if (forceDone) {
    status = "Done (date missing)";
  } else {
    status = "Pending";
    if (p) {
      const d = diffDays_(p, today);
      delay = Math.max(0, d);
      if (d > 0) status = "Pending (Delayed)";
    }
  }
  return {
    planned: toDate_(planned), actual: toDate_(actual), delay: delay, status: status,
    done: Boolean(a) || Boolean(forceDone),
  };
}

function statsOf_(list) {
  const delayed = list.filter((x) => x.delay > 0);
  const avg = delayed.length
    ? Math.round((delayed.reduce((s, x) => s + x.delay, 0) / delayed.length) * 10) / 10
    : 0;
  return {
    total: list.length,
    done: list.filter((x) => x.done).length,
    pending: list.filter((x) => !x.done).length,
    delayed: delayed.length,
    avg: avg,
  };
}

// App ka user apni firm(s) tak limited hota hai, isliye har stage ke stats firm-wise bhi nikalte hain
// (sheet me saari firms ka total hota hai; app me sirf login user ki firm ka).
function stageStats_(label, items) {
  const groups = {};
  items.forEach((x) => {
    const firm = String(x.firm || "").trim() || "(blank)";
    (groups[firm] = groups[firm] || []).push(x.calc);
  });
  return {
    label: label,
    stats: statsOf_(items.map((x) => x.calc)),
    byFirm: Object.keys(groups).sort().map((firm) => ({ firm: firm, stats: statsOf_(groups[firm]) })),
  };
}

// ───────────────────────── Flow logic (app jaisa) ─────────────────────────

const has_ = (v) => v !== null && v !== undefined && v !== "";
const blank_ = (v) => (v === null || v === undefined ? "" : v);
const billOk_ = (b) => has_(b) && String(b).trim() !== "-";
const money_ = (v) => {
  const n = parseFloat(String(v === null || v === undefined ? "" : v).replace(/[^0-9.-]+/g, ""));
  return isFinite(n) ? n : 0;
};
const isDirectFirm_ = (firm) => DIRECT_STORE_IN_FIRMS.indexOf(String(firm || "").trim().toLowerCase()) !== -1;

function buildPages_(data, today) {
  const byTask = (rows, key) => {
    const m = {};
    rows.forEach((r) => {
      const k = (r[key] || "").trim();
      if (k && !m[k]) m[k] = r;
    });
    return m;
  };
  const svM = byTask(data.sv, "task_no");
  const maM = byTask(data.ma, "task_no");
  const cmM = byTask(data.cm, "task_no");
  const siM = byTask(data.si, "task_no");
  const pM = byTask(data.p, "task_no");
  const mpM = byTask(data.mp, "task_no");
  const accM = byTask(data.acc, "task_no");
  const indM = byTask(data.indent, "task_no");

  // Normal tasks (indent order = created_at desc, jaise app me)
  const tasks = data.indent.map((i) => {
    const no = (i.task_no || "").trim();
    const sv = svM[no] || {}, ma = maM[no] || {}, cm = cmM[no] || {};
    const si = siM[no] || {}, p = pM[no] || {}, mp = mpM[no] || {}, acc = accM[no] || {};
    // Aage ka koi bhi step ho chuka ho to pichla step "complete" mana jata hai (firmFlow.js).
    const mgmtDone = has_(ma.actual_date) || has_(cm.actual_date) || has_(p.actual_date) ||
      has_(mp.actual_date) || has_(si.actual_date) || has_(acc.actual_1);
    return {
      no: no, i: i, sv: sv, ma: ma, cm: cm, si: si, p: p, mp: mp, acc: acc,
      firm: i.firm_name || "", machine: i.machine_name || "",
      direct: isDirectFirm_(i.firm_name),
      isAdvPay: String(sv.payment_type_1 || "").trim().toLowerCase() === "advance",
      bill: cm.bill_no || "",
      typeOfBill: cm.type_of_bill || "",
      totalBill: cm.total_bill_amount,
      sentPlanned: sv.planned_date || i.planned_sent_date,
      mgmtDone: mgmtDone,
      sentDone: has_(sv.actual_date) || mgmtDone,
    };
  });

  // Advance tasks (repair_advance, created_at desc)
  const advs = data.adv.map((r) => {
    const no = (r.repair_task_no || "").trim();
    const ind = indM[no] || {};
    const ma = maM[no] || {};
    const firm = r.firm_name || ind.firm_name || "";
    return {
      no: no, r: r, ma: ma,
      firm: firm,
      direct: isDirectFirm_(firm),
      machine: r.machine_name || ind.machine_name || "",
      vendor: r.vendor_name || ma.approved_vendor_name || "",
      bill: r.bill_no || "",
      mgmtDate: ma.actual_date,
    };
  });
  const advNos = {};
  advs.forEach((a) => { advNos[a.no] = true; });
  const inNormalFlow = (t) => !(t.isAdvPay && advNos[t.no]);

  // ── Child (common bill) detection ──
  // Normal: Bill No se group; Posting me pehla task parent.
  const normGroups = {};
  tasks.forEach((t) => {
    if (billOk_(t.bill)) (normGroups[t.bill] = normGroups[t.bill] || []).push(t);
  });
  // Posting.jsx aur MakePayment.jsx: exact Bill No (firm ke bina) group; parent = independent / amount > 0 wala, warna pehla.
  const isChildBill = (t) => {
    if (!billOk_(t.bill)) return false;
    const g = normGroups[t.bill];
    if (g.length < 2) return false;
    const parent = g.find((x) =>
      String(x.typeOfBill).toLowerCase().trim() === "independent" || (parseFloat(x.totalBill) || 0) > 0
    ) || g[0];
    return parent.no !== t.no;
  };
  // Common-bill child: commonBill.js ka attachCommonBillMetadata - Firm + Bill No group, "Common" type wala combined.
  // Check Machine, Store In aur Accounts pages child tasks ko hide karte hain (parent ke andar dikhte hain).
  const commonChild = {};
  const commonGroups = {};
  tasks.forEach((t) => {
    if (!billOk_(t.bill)) return;
    const key = String(t.firm).trim().toLowerCase() + "::" + String(t.bill).trim().toLowerCase();
    (commonGroups[key] = commonGroups[key] || []).push(t);
  });
  Object.keys(commonGroups).forEach((key) => {
    const members = commonGroups[key];
    const isCommon = (t) => String(t.typeOfBill).trim().toLowerCase() === "common";
    if (members.length < 2 || !members.some(isCommon)) return;
    const parent = members.find((t) => !isCommon(t) && money_(t.totalBill) > 0) ||
      members.find((t) => !isCommon(t)) || members[0];
    members.forEach((t) => { if (t !== parent) commonChild[t.no] = true; });
  });
  // Advance: Firm + Bill No group, pehla = parent.
  const advGroupKey = (a) => String(a.firm).toLowerCase().trim() + "||" + a.bill;
  const advGroups = {};
  advs.forEach((a) => {
    if (billOk_(a.bill)) (advGroups[advGroupKey(a)] = advGroups[advGroupKey(a)] || []).push(a);
  });
  const isChildAdv = (a) => {
    if (!billOk_(a.bill)) return false;
    const g = advGroups[advGroupKey(a)];
    return g.length > 1 && g[0].no !== a.no;
  };

  const pages = [];
  const E = (arr) => arr.map((x) => blank_(x));

  // Common row helper
  const mk = (flow, t, extras, planned, actual, since, forceDone) => ({
    t: t, flow: flow, extras: extras, calc: calc_(planned, actual, since, today, forceDone),
  });

  // ── 1. Indent ──
  pages.push(simplePage_("Indent", ["Department", "Priority", "Indentor"],
    tasks.map((t) => mk("Normal", t,
      E([t.i.department, t.i.priority, t.i.indentor_name]),
      t.i.planned_sent_date, t.i.created_at, t.i.created_at))
  ));

  // ── 2. Sent to Vendor ──
  pages.push(simplePage_("Sent to Vendor",
    ["Vendor 1", "Vendor 2", "Vendor 3", "Transporter", "Payment Type"],
    tasks.filter((t) => has_(t.sentPlanned)).map((t) => mk("Normal", t,
      E([t.sv.vendor_name_1, t.sv.vendor_name_2, t.sv.vendor_name_3, t.sv.transporter_name_1, t.sv.payment_type_1]),
      t.sentPlanned, t.sv.actual_date, t.i.created_at, t.sentDone))
  ));

  // ── 3. Management Approval ──
  pages.push(simplePage_("Management Approval",
    ["Approved Vendor", "Payment Term", "Advance Amount", "Approval Status"],
    tasks.filter((t) => has_(t.sv.actual_date) || t.mgmtDone).map((t) => mk("Normal", t,
      E([t.ma.approved_vendor_name, t.ma.approved_payment_term, t.ma.advance_amount, t.ma.approval_status]),
      t.ma.planned_date || t.sv.actual_date, t.ma.actual_date, t.sv.actual_date, t.mgmtDone))
  ));

  // ── 4. Check Machine ──
  const cmRows = [];
  tasks.filter((t) => inNormalFlow(t) && !commonChild[t.no] && has_(t.ma.actual_date)).forEach((t) =>
    cmRows.push(mk("Normal", t, E([t.bill, t.totalBill, t.cm.checked_by]),
      t.cm.planned_date || t.ma.actual_date, t.cm.actual_date, t.ma.actual_date)));
  // Advance: direct firm me Management Approval ke baad, baaki me Advance Payment ke baad.
  const advCheckPrev = (a) => (a.direct ? a.mgmtDate : a.r.actual_payment_date);
  advs.filter((a) => !isChildAdv(a) && has_(advCheckPrev(a))).forEach((a) =>
    cmRows.push(mk("Advance", advRowT_(a), E([a.bill, "", a.r.checked_by]),
      a.r.planned_check_machine || advCheckPrev(a), a.r.actual_check_machine_date, advCheckPrev(a))));
  pages.push(simplePage_("Check Machine", ["Bill No", "Total Bill Amount", "Checked By"], cmRows));

  // ── 5. Process for Payment (Posting) ── direct firms is page me aati hi nahi (pending ya history)
  const poRows = [];
  tasks.filter((t) => inNormalFlow(t) && !t.direct && !isChildBill(t) &&
    (has_(t.cm.actual_date) || has_(t.p.actual_date)))
    .forEach((t) => poRows.push(mk("Normal", t, E([t.p.posting_voucher_no, t.p.posting_done_by]),
      t.p.planned_date || t.cm.actual_date, t.p.actual_date, t.cm.actual_date)));
  advs.filter((a) => !a.direct && !isChildAdv(a) && has_(a.mgmtDate)).forEach((a) =>
    poRows.push(mk("Advance", advRowT_(a), E([a.r.posting_voucher_no, a.r.posting_done_by]),
      a.r.planned_posting || a.mgmtDate, a.r.actual_posting, a.mgmtDate)));
  pages.push(simplePage_("Process for Payment", ["Voucher No", "Posting Done By"], poRows));

  // ── 6. Make Payment ── direct firms is page me aati hi nahi
  const mpRows = [];
  tasks.filter((t) => inNormalFlow(t) && !t.direct && !isChildBill(t) &&
    (has_(t.p.actual_date) || has_(t.mp.actual_date)))
    .forEach((t) => mpRows.push(mk("Normal", t,
      E([t.mp.payment_type, t.mp.payment_utr_no, t.mp.amount_paid, t.mp.payment_done_by]),
      t.mp.planned_date || t.p.actual_date, t.mp.actual_date, t.p.actual_date)));
  advs.filter((a) => !a.direct && !isChildAdv(a) && has_(a.r.actual_posting)).forEach((a) =>
    mpRows.push(mk("Advance", advRowT_(a),
      E(["Advance", a.r.advance_payment_utr, a.r.advance_amount_paid, a.r.payment_done_by]),
      a.r.planned_payment || a.r.actual_posting, a.r.actual_payment_date, a.r.actual_posting)));
  pages.push(simplePage_("Make Payment", ["Payment Type", "UTR No", "Amount Paid", "Paid By"], mpRows));

  // ── 7. Store In ── direct firm me Check Machine ke baad, baaki me Payment ke baad
  const storePrev = (t) => (t.direct ? t.cm.actual_date : t.mp.actual_date);
  const siRows = [];
  tasks.filter((t) => inNormalFlow(t) && !commonChild[t.no] &&
    (has_(storePrev(t)) || has_(t.si.actual_date))).forEach((t) =>
    siRows.push(mk("Normal", t,
      E([t.si.received_quantity, t.si.bill_match === null || t.si.bill_match === undefined ? "" : (t.si.bill_match ? "Yes" : "No"), t.si.store_in_done_by]),
      t.si.planned_date, t.si.actual_date, storePrev(t))));
  advs.filter((a) => !isChildAdv(a) && has_(a.r.actual_check_machine_date)).forEach((a) =>
    siRows.push(mk("Advance", advRowT_(a), E([a.r.received_quantity, "", a.r.store_in_done_by]),
      a.r.planned_store_in, a.r.actual_store_in_date, a.r.actual_check_machine_date)));
  pages.push(simplePage_("Store In", ["Received Qty", "Bill Match", "Store In Done By"], siRows));

  // ── 8. Accounts (4 stages) ── Accounts.jsx jaisa: Store In ho chuka + common child nahi
  pages.push.apply(pages,
    accountsPages_(tasks.filter((t) => has_(t.si.actual_date) && !commonChild[t.no]), today));

  // ── 9. Advance Flow (repair_advance ke saare steps) ──
  pages.push(advanceFlowPage_(advs, today));

  return pages;
}

// repair_advance row ko tasks jaisa shape dena (firm/machine/no ke liye)
function advRowT_(a) {
  return { no: a.no, firm: a.firm, machine: a.machine };
}

// ───────────────────────── Page builders ─────────────────────────

function simplePage_(name, extraHeaders, rows) {
  const headers = ["Task No", "Firm", "Machine", "Flow"]
    .concat(extraHeaders)
    .concat(["Planned", "Actual", "Delay (days)", "Status"]);

  // Pending pehle (zyada delay upar), phir Done
  rows.sort((x, y) => {
    const xp = x.calc.done ? 1 : 0, yp = y.calc.done ? 1 : 0;
    if (xp !== yp) return xp - yp;
    return (Number(y.calc.delay) || 0) - (Number(x.calc.delay) || 0);
  });

  const body = rows.map((r) => {
    const c = r.calc;
    return [r.t.no, r.t.firm, r.t.machine, r.flow]
      .concat(r.extras)
      .concat([c.planned, c.actual, c.delay, c.status]);
  });

  return {
    name: name,
    headers: headers,
    body: body,
    delayCols: [headers.indexOf("Delay (days)") + 1],
    stages: [stageStats_(name, rows.map((r) => ({ calc: r.calc, firm: r.t.firm })))],
  };
}

// Same planned fallbacks as supabaseRepairService.js (Accounts Planned 1..4) and Accounts.jsx.
// A status such as "Done" without actual_N is still pending in React.
// A skipped stage with neither planned nor actual is not a pending entry.
function accountsPages_(taskList, today) {
  const auditNotDone = (t) =>
    ["not done", "mismatch", "rejected"].indexOf(String(t.acc.status_1 || "").trim().toLowerCase()) !== -1;
  const defs = [
    { name: "Audit Data", n: 1, planned: (t) => t.acc.planned_1 || t.si.actual_date },
    { name: "Rectify the Mistake", n: 2, planned: (t) =>
      t.acc.planned_2 || (t.acc.actual_1 && auditNotDone(t) ? t.acc.actual_1 : "") },
    { name: "Reaudit Data", n: 3, planned: (t) => t.acc.planned_3 || t.acc.actual_2 },
    { name: "Take Entry By Tally", n: 4, planned: (t) =>
      t.acc.planned_4 || t.acc.actual_3 || (t.acc.actual_1 && !auditNotDone(t) ? t.acc.actual_1 : "") },
  ];
  return defs.map((def) => {
    const rows = [];
    taskList.forEach((t) => {
      const planned = def.planned(t), actual = t.acc["actual_" + def.n];
      if (!has_(planned) && !has_(actual)) return;
      rows.push({ t: t, flow: "Normal",
        extras: [t.bill, blank_(t.acc.voucher_no || t.p.posting_voucher_no),
          blank_(t.acc["status_" + def.n]), blank_(t.acc["remarks_" + def.n])],
        calc: calc_(planned, actual, null, today) });
    });
    return simplePage_(def.name, ["Bill No", "Voucher No", "Source Status", "Remarks"], rows);
  });
}

function advanceFlowPage_(advs, today) {
  const stageDefs = [
    { label: "Posting", p: "planned_posting", a: "actual_posting", prev: (a) => a.mgmtDate, skipDirect: true },
    { label: "Payment", p: "planned_payment", a: "actual_payment_date", prev: (a) => a.r.actual_posting, skipDirect: true },
    { label: "Check Machine", p: "planned_check_machine", a: "actual_check_machine_date",
      prev: (a) => (a.direct ? a.mgmtDate : a.r.actual_payment_date) },
    { label: "Store In", p: "planned_store_in", a: "actual_store_in_date", prev: (a) => a.r.actual_check_machine_date },
    { label: "Full Billing", p: "planned_full_billing", a: "actual_full_billing_date", prev: (a) => a.r.actual_store_in_date },
    { label: "Accounts", p: "planned_accounts", a: "actual_accounts_date", prev: (a) => a.r.actual_full_billing_date },
  ];
  const headers = ["Task No", "Firm", "Machine", "Vendor", "Bill No", "Advance Paid"];
  const delayCols = [];
  stageDefs.forEach((s) => {
    headers.push("Planned (" + s.label + ")", "Actual (" + s.label + ")");
    delayCols.push(headers.length + 1);
    headers.push("Delay (" + s.label + ")", "Status (" + s.label + ")");
  });
  const perStage = stageDefs.map(() => []);
  const body = advs.map((a) => {
    const line = [a.no, a.firm, a.machine, a.vendor, a.bill, blank_(a.r.advance_amount_paid)];
    stageDefs.forEach((s, i) => {
      const prev = s.prev(a);
      const ac = a.r[s.a];
      // Stage tabhi gino jab pichla step ho chuka ho (ya ye khud ho chuka ho).
      // Direct firms me Posting / Payment hota hi nahi.
      if ((s.skipDirect && a.direct) || (!has_(prev) && !has_(ac))) { line.push("", "", "", ""); return; }
      const c = calc_(a.r[s.p], ac, prev, today);
      perStage[i].push({ calc: c, firm: a.firm });
      line.push(c.planned, c.actual, c.delay, c.status);
    });
    return line;
  });
  return {
    name: "Advance Flow",
    headers: headers,
    body: body,
    delayCols: delayCols,
    stages: stageDefs.map((s, i) => stageStats_(s.label, perStage[i])),
  };
}

// ───────────────────────── Sheet writers ─────────────────────────

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("REPORT_SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* naya banayenge */ }
  }
  const ss = SpreadsheetApp.create("Repair FMS - Planned vs Actual Report");
  props.setProperty("REPORT_SHEET_ID", ss.getId());
  Logger.log("Naya sheet bana: " + ss.getUrl());
  return ss;
}

function getSheet_(ss, name, position) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name, position);
  const f = sh.getFilter();
  if (f) f.remove();
  sh.clear();
  sh.clearConditionalFormatRules();
  return sh;
}

const STATS_HEADER = ["Firm", "Total Entry", "Done / History", "Pending", "Delayed", "Avg Delay (days, delayed only)"];

function statsRow_(label, firm, s) {
  return [label, firm, s.total, s.done, s.pending, s.delayed, s.avg];
}

// Har stage ke liye: "All firms" row + har firm ki row.
function statLines_(stages, labelOf) {
  const lines = [];
  stages.forEach((st) => {
    const label = labelOf(st);
    lines.push(statsRow_(label, "All firms", st.stats));
    st.byFirm.forEach((f) => lines.push(statsRow_(label, f.firm, f.stats)));
  });
  return lines;
}

function styleHeader_(range) {
  range.setBackground("#1f2937").setFontColor("#ffffff").setFontWeight("bold").setWrap(true);
}

function stamp_() {
  return "Updated: " + Utilities.formatDate(new Date(), TZ, "MM/dd/yyyy HH:mm:ss") +
    "  |  Firms: " + (String(FIRM_SCOPE).trim() || "All");
}

function writeSummary_(sh, pages) {
  sh.getRange(1, 1).setValue("Repair FMS - Summary").setFontSize(14).setFontWeight("bold");
  sh.getRange(2, 1).setValue(stamp_());
  const header = ["Page / Stage"].concat(STATS_HEADER);
  sh.getRange(4, 1, 1, header.length).setValues([header]);
  styleHeader_(sh.getRange(4, 1, 1, header.length));
  let lines = [];
  pages.forEach((pg) => {
    lines = lines.concat(statLines_(pg.stages, (s) => (pg.stages.length === 1 ? pg.name : pg.name + " - " + s.label)));
  });
  if (lines.length) sh.getRange(5, 1, lines.length, header.length).setValues(lines);
  sh.setColumnWidth(1, 260);
  sh.setFrozenRows(4);
}

function writeTab_(sh, pg) {
  sh.getRange(1, 1).setValue(pg.name).setFontSize(14).setFontWeight("bold");
  sh.getRange(2, 1).setValue(stamp_());

  const sumHeader = ["Stage"].concat(STATS_HEADER);
  sh.getRange(4, 1, 1, sumHeader.length).setValues([sumHeader]);
  styleHeader_(sh.getRange(4, 1, 1, sumHeader.length));
  const statLines = statLines_(pg.stages, (s) => s.label);
  sh.getRange(5, 1, statLines.length, sumHeader.length).setValues(statLines);

  const top = 5 + statLines.length + 2;
  sh.getRange(top, 1, 1, pg.headers.length).setValues([pg.headers]);
  styleHeader_(sh.getRange(top, 1, 1, pg.headers.length));

  if (pg.body.length) {
    sh.getRange(top + 1, 1, pg.body.length, pg.headers.length).setValues(pg.body);
    pg.headers.forEach((header, index) => {
      if (/^(Planned|Actual)(?:$| \()/.test(header)) {
        sh.getRange(top + 1, index + 1, pg.body.length, 1).setNumberFormat(DATE_FORMAT);
        sh.setColumnWidth(index + 1, 180);
      }
    });
    sh.getRange(top, 1, pg.body.length + 1, pg.headers.length).createFilter();
    const rules = pg.delayCols.map((c) =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setFontColor("#b91c1c")
        .setBold(true)
        .setRanges([sh.getRange(top + 1, c, pg.body.length, 1)])
        .build()
    );
    sh.setConditionalFormatRules(rules);
  }
  sh.setFrozenRows(top);
}
