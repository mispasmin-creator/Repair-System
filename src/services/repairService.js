/**
 * repairService.js
 * Shared utility to fetch Repair System tasks using header names (Row 6 of sheet).
 * All components should use this instead of hardcoded column indices.
 */

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;

import {
  fetchRepairTasksFromSupabase,
  updateRepairTaskInSupabase,
  matchesFirm,
} from "./supabaseRepairService.js";

let inFlightRepairTasks = null;
const CACHE_TTL_MS = 60000;
let tasksCache = { data: null, ts: 0 };

export const invalidateRepairTasksCache = () => {
  tasksCache = { data: null, ts: 0 };
};

export const fetchRepairSheet = async (userFirmName = "", { force = false } = {}) => {
  const tasks = await fetchRepairTasks(userFirmName, { force });
  const headers = tasks.length > 0 ? Object.keys(tasks[0]) : [];
  const rows = tasks.map((t) => headers.map((h) => t[h] ?? ""));
  return {
    headers,
    rows,
    tasks,
  };
};

export const fetchRepairTasks = async (userFirmName = "", { force = false } = {}) => {
  const isFresh = tasksCache.data && Date.now() - tasksCache.ts < CACHE_TTL_MS;
  if (isFresh && !force) {
    return filterByFirm(tasksCache.data, userFirmName);
  }

  if (!inFlightRepairTasks) {
    inFlightRepairTasks = fetchRepairTasksFromSupabase()
      .then((allTasks) => {
        tasksCache = { data: allTasks, ts: Date.now() };
        return allTasks;
      })
      .finally(() => {
        inFlightRepairTasks = null;
      });
  }

  const all = await inFlightRepairTasks;
  return filterByFirm(all, userFirmName);
};

export const filterByFirm = (tasks, userFirmName) => {
  return (tasks || []).filter((t) =>
    matchesFirm(t["Firm Name"] || t.firmName, userFirmName)
  );
};

/**
 * Updates specific fields of a task by Task No natively in Supabase.
 */
export const updateRepairTask = async (sheetName, taskNo, fields) => {
  invalidateRepairTasksCache();
  const result = await updateRepairTaskInSupabase(taskNo, fields);
  return result;
};

/**
 * Returns current date string in Indian format (DD/MM/YYYY).
 */
export const getNowIST = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
