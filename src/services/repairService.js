/**
 * repairService.js
 * Shared utility to fetch Repair System tasks using header names (Row 6 of sheet).
 * All components should use this instead of hardcoded column indices.
 */

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;

/**
 * Fetches all repair tasks from the "Repair System" sheet.
 * Returns objects keyed by exact sheet header names (e.g., "Actual 1", "Planned 1", etc.)
 *
 * @param {string} userFirmName - Filter by firm. Pass "" or "all" to get all firms.
 * @returns {Promise<Array>} Array of task objects with header-name keys
 */
// Concurrent callers share one network request (the Apps Script call is slow).
let inFlightRepairTasks = null;

// Short-lived client cache: every page mount was re-hitting the network even
// when another page had just fetched the same data seconds earlier (the
// Apps Script round-trip is the slow part, not just the sheet read). A small
// TTL lets fast page-to-page navigation reuse the in-memory copy instead of
// re-fetching. Any write goes through updateRepairTask(), which clears this
// cache so the very next fetch always sees the just-submitted change.
const CACHE_TTL_MS = 15000;
let tasksCache = { data: null, ts: 0 };

export const invalidateRepairTasksCache = () => {
  tasksCache = { data: null, ts: 0 };
};

const fetchRepairTasksRaw = async () => {
  const res = await fetch(
    `${SCRIPT_URL}?action=getRepairTasks&sheetId=${SHEET_ID}`
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const result = await res.json();
  if (!result.success) throw new Error(result.error || "Failed to fetch tasks");

  // Filter out completely empty rows
  return (result.data || []).filter((row) =>
    Object.values(row).some((v) => v !== "" && v !== null && v !== undefined)
  );
};

const getRepairTasksCached = async (force = false) => {
  const isFresh = tasksCache.data && Date.now() - tasksCache.ts < CACHE_TTL_MS;
  if (isFresh && !force) return tasksCache.data;

  if (!inFlightRepairTasks) {
    inFlightRepairTasks = fetchRepairTasksRaw()
      .then((data) => {
        tasksCache = { data, ts: Date.now() };
        return data;
      })
      .finally(() => {
        inFlightRepairTasks = null;
      });
  }
  return inFlightRepairTasks;
};

export const fetchRepairTasks = async (userFirmName = "", { force = false } = {}) => {
  const tasks = await getRepairTasksCached(force);

  // Filter by firm — support multiple firms (comma-separated, e.g. "Rkl, Pmmpl")
  const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";
  if (isAllFirm) return tasks;

  // Parse comma-separated firm names
  const allowedFirms = userFirmName
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);

  return tasks.filter((t) => {
    const taskFirm = (t["Firm Name"] || "").toLowerCase().trim();
    return allowedFirms.includes(taskFirm) || allowedFirms.includes("all");
  });
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
