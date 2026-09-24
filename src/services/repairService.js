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

export const fetchRepairTasks = async (userFirmName = "") => {
  if (!inFlightRepairTasks) {
    inFlightRepairTasks = fetchRepairTasksRaw().finally(() => {
      inFlightRepairTasks = null;
    });
  }
  const tasks = await inFlightRepairTasks;

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
  return await res.json();
};

/**
 * Returns current date string in Indian format (DD/MM/YYYY).
 */
export const getNowIST = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
