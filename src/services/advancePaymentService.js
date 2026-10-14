/**
 * advancePaymentService.js
 * Service to read and update "Repair FMS Advance Payment" Google Sheet.
 * Row 6 is the header row. Data starts from row 7.
 */

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const ADVANCE_SHEET_NAME = "Repair FMS Advance Payment";

/**
 * Fetches all rows from "Repair FMS Advance Payment" sheet.
 * Returns objects keyed by Row 6 header names, with isAdvance: true flag.
 */
import {
  fetchAdvancePaymentsFromSupabase,
  updateAdvancePaymentInSupabase,
  matchesFirm,
} from "./supabaseRepairService.js";

let inFlightAdvancePayments = null;
const CACHE_TTL_MS = 60000;
let advancePaymentsCache = { data: null, ts: 0 };

export const invalidateAdvancePaymentsCache = () => {
  advancePaymentsCache = { data: null, ts: 0 };
};

export const filterAdvanceByFirm = (tasks, userFirmName = "") => {
  return (tasks || []).filter((t) => matchesFirm(t.firmName, userFirmName));
};

export const fetchAdvancePayments = (userFirmName = "", force = false) => {
  // Support calling fetchAdvancePayments(force) if first param is boolean
  if (typeof userFirmName === "boolean") {
    force = userFirmName;
    userFirmName = "";
  }

  const isFresh =
    advancePaymentsCache.data && Date.now() - advancePaymentsCache.ts < CACHE_TTL_MS;
  if (isFresh && !force) {
    return Promise.resolve(filterAdvanceByFirm(advancePaymentsCache.data, userFirmName));
  }

  if (!inFlightAdvancePayments) {
    inFlightAdvancePayments = fetchAdvancePaymentsFromSupabase()
      .then((data) => {
        advancePaymentsCache = { data, ts: Date.now() };
        return data;
      })
      .finally(() => {
        inFlightAdvancePayments = null;
      });
  }
  return inFlightAdvancePayments.then((data) => filterAdvanceByFirm(data, userFirmName));
};

/**
 * Updates specific fields in "Repair FMS Advance Payment" sheet
 * by matching Repair Task No natively in Supabase.
 */
export const updateAdvancePayment = async (repairTaskNo, fields) => {
  invalidateAdvancePaymentsCache();
  const result = await updateAdvancePaymentInSupabase(repairTaskNo, fields);
  return result;
};

/**
 * True when a "Repair System" sheet row is an Advance payment task
 * ("Payment Type" or "Payment type 2" is Advance). Such tasks continue
 * from the "Repair FMS Advance Payment" sheet after Management Approval,
 * so they must be excluded from the normal (Repair System) flow.
 */
export const isAdvanceRow = (row) =>
  ["Payment Type", "Payment type 2"].some(
    (key) => (row?.[key] || "").toString().trim().toLowerCase() === "advance"
  );

/** Returns current date-time in Indian format (DD/MM/YYYY, HH:MM:SS). */
export const getNowIST = () =>
  new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });

/** Returns current date in Indian format (DD/MM/YYYY). */
export const getTodayIST = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
