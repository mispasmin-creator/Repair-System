/**
 * repairService.js
 * Shared utility to fetch Repair System tasks using header names (Row 6 of sheet).
 * All components should use this instead of hardcoded column indices.
 */

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;

// Concurrent callers share one network request (the Apps Script call is slow).
let inFlightRepairTasks = null;

// Short-lived client cache: lets fast page-to-page navigation reuse data another
// page just fetched. Any write goes through updateRepairTask(), which clears it,
// so the next fetch always sees the just-submitted change.
const CACHE_TTL_MS = 15000;
// Persisted copy survives page reloads; used instantly and refreshed in background-style fallback
const SNAPSHOT_KEY = "repairSheetSnapshot";
const SNAPSHOT_FRESH_MS = 120000;
const FETCH_TIMEOUT_MS = 25000;
let tasksCache = { data: null, ts: 0 };

const readSnapshot = () => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSnapshot = (data) => {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // quota exceeded or storage disabled — in-memory cache still works
  }
};

export const invalidateRepairTasksCache = () => {
  tasksCache = { data: null, ts: 0 };
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // storage unavailable
  }
};

// Server sends headers once and rows as arrays (empty rows already removed).
// Timeout only when a saved copy exists to fall back on; otherwise wait for the data
const fetchRepairSheetRaw = async (withTimeout) => {
  const controller = new AbortController();
  const timer = withTimeout ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    const res = await fetch(
      `${SCRIPT_URL}?action=getRepairTasks&sheetId=${SHEET_ID}`,
      { signal: controller.signal }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Apps Script sometimes returns a Google HTML error page instead of JSON
    const text = await res.text();
    if (text.trim().startsWith("<")) throw new Error("Server returned HTML");
    const result = JSON.parse(text);
    if (!result.success) throw new Error(result.error || "Failed to fetch tasks");

    const headers = result.headers || [];
    const rows = result.rows || [];
    const tasks = rows.map((row) => {
      const obj = {};
      headers.forEach((header, idx) => {
        if (header) obj[header] = row[idx] ?? "";
      });
      return obj;
    });
    return { headers, rows, tasks };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const getRepairSheetCached = async (force = false) => {
  const isFresh = tasksCache.data && Date.now() - tasksCache.ts < CACHE_TTL_MS;
  if (isFresh && !force) return tasksCache.data;

  if (!force) {
    const snap = readSnapshot();
    if (snap?.data && Date.now() - snap.ts < SNAPSHOT_FRESH_MS) {
      tasksCache = { data: snap.data, ts: snap.ts };
      return snap.data;
    }
  }

  if (!inFlightRepairTasks) {
    inFlightRepairTasks = fetchRepairSheetRaw(Boolean(readSnapshot()?.data))
      .then((data) => {
        tasksCache = { data, ts: Date.now() };
        writeSnapshot(data);
        return data;
      })
      .catch((err) => {
        // Network/Apps Script failed: show last known data instead of an empty screen
        const snap = readSnapshot();
        if (snap?.data) return snap.data;
        throw err;
      })
      .finally(() => {
        inFlightRepairTasks = null;
      });
  }
  return inFlightRepairTasks;
};

const matchesFirm = (firmValue, userFirmName) => {
  const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";
  if (isAllFirm) return true;

  // Parse comma-separated firm names
  const allowedFirms = userFirmName
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);

  const taskFirm = (firmValue || "").toLowerCase().trim();
  return allowedFirms.includes(taskFirm) || allowedFirms.includes("all");
};

/**
 * Returns { headers, rows, tasks } filtered by firm.
 * rows: raw arrays (index = sheet column index), tasks: objects keyed by header.
 */
export const fetchRepairSheet = async (userFirmName = "", { force = false } = {}) => {
  const { headers, rows, tasks } = await getRepairSheetCached(force);

  const keep = tasks.map((t) => matchesFirm(t["Firm Name"], userFirmName));
  return {
    headers,
    rows: rows.filter((_, i) => keep[i]),
    tasks: tasks.filter((_, i) => keep[i]),
  };
};

export const fetchRepairTasks = async (userFirmName = "", opts = {}) => {
  const { tasks } = await fetchRepairSheet(userFirmName, opts);
  return tasks;
};

/**
 * Updates specific fields of a task by Task No.
 * Uses action=update1 which matches by "Task No" column header in row 6.
 *
 * @param {string} sheetName - Sheet to update (e.g., "Repair System")
 * @param {string} taskNo - Task number to identify the row
 * @param {Object} fields - Key-value pairs where keys = exact sheet header names
 * @returns {Promise<Object>} Result from Apps Script
 */
export const updateRepairTask = async (sheetName, taskNo, fields) => {
  const payload = new URLSearchParams({
    action: "update1",
    sheetName,
    taskNo,
    ...fields,
  });

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  invalidateRepairTasksCache();
  return result;
};

/**
 * Returns current date string in Indian format (DD/MM/YYYY).
 */
export const getNowIST = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
