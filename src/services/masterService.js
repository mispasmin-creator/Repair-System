/**
 * masterService.js
 * Centralized service to manage and query Master data directly from Supabase 'master' table
 * in Column-wise format (matching Google Sheets).
 */

import { supabase } from "./supabaseClient";
import localMasterData from "../data/masterData.json";

// In-memory cache
let masterCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Returns clean fallback data structure from local JSON
 */
const getFallbackData = () => {
  return {
    indentor_name: localMasterData["Indentor Name "] || localMasterData["Indentor Name"] || [],
    authorized_name: localMasterData["Authorized Name"] || ["Self"],
    machine_name: localMasterData["Machine Name"] || [],
    department: localMasterData["Department"] || [],
    uom: localMasterData["UOM"] || [],
    firm_name: localMasterData["Firm Name"] || ["Pmmpl", "Purab", "Refrasynth", "Rkl", "Refratech"],
    payment_type: localMasterData["Payment Type"] || ["Advance", "Full", "Cash"],
    type_of_bill: localMasterData["Type of Bill"] || ["Common", "Independent"],
    vendor_name: localMasterData["Vendor Name"] || [],
    transporter_name: localMasterData["Transporter Name"] || ["Self", "Boby Cargo", "Gagan Roadways", "OM Logistics", "V-Trans"],
  };
};

/**
 * Fetch all active master options from Supabase (Column-wise table)
 */
export const fetchMasterDataFromSupabase = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && masterCache && now - lastFetchTime < CACHE_TTL_MS) {
    return masterCache;
  }

  try {
    const { data, error } = await supabase
      .from("master")
      .select("*")
      .order("id", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) {
        console.warn("Supabase master table read warning (using fallback):", error.message);
      }
      masterCache = getFallbackData();
      lastFetchTime = now;
      return masterCache;
    }

    const extractUnique = (colName) => {
      const seen = new Set();
      const list = [];
      data.forEach((row) => {
        const val = row[colName];
        if (val !== null && val !== undefined) {
          const str = String(val).trim();
          const lower = str.toLowerCase();
          if (str && !seen.has(lower)) {
            seen.add(lower);
            list.push(str);
          }
        }
      });
      return list;
    };

    const grouped = {
      indentor_name: extractUnique("indentor_name"),
      authorized_name: extractUnique("authorized_name"),
      machine_name: extractUnique("machine_name"),
      department: extractUnique("department"),
      uom: extractUnique("uom"),
      firm_name: extractUnique("firm_name"),
      payment_type: extractUnique("payment_type"),
      type_of_bill: extractUnique("type_of_bill"),
      vendor_name: extractUnique("vendor_name"),
      transporter_name: extractUnique("transporter_name"),
    };

    // Ensure vital defaults are present if empty
    if (!grouped.payment_type.length) grouped.payment_type = ["Advance", "Full", "Cash"];
    if (!grouped.type_of_bill.length) grouped.type_of_bill = ["Common", "Independent"];
    if (!grouped.transporter_name.length) {
      grouped.transporter_name = ["Self", "Boby Cargo", "Gagan Roadways", "OM Logistics", "V-Trans"];
    }
    if (!grouped.firm_name.length) {
      grouped.firm_name = ["Pmmpl", "Purab", "Refrasynth", "Rkl", "Refratech"];
    }

    masterCache = grouped;
    lastFetchTime = now;
    return masterCache;
  } catch (err) {
    console.error("fetchMasterDataFromSupabase error:", err);
    masterCache = getFallbackData();
    lastFetchTime = now;
    return masterCache;
  }
};

/**
 * Add / Insert an item to Supabase Master column
 */
export const addMasterItem = async (columnName, value) => {
  const trimmed = (value || "").trim();
  if (!columnName || !trimmed) return { success: false, error: "Empty value" };

  try {
    // 1. Try to find a row where this column is NULL to fill the empty cell
    const { data: emptyRows } = await supabase
      .from("master")
      .select("id")
      .is(columnName, null)
      .limit(1);

    let insertOrUpdateError = null;

    if (emptyRows && emptyRows.length > 0) {
      const targetId = emptyRows[0].id;
      const { error } = await supabase
        .from("master")
        .update({ [columnName]: trimmed })
        .eq("id", targetId);
      insertOrUpdateError = error;
    } else {
      // Otherwise insert a new row
      const { error } = await supabase
        .from("master")
        .insert([{ [columnName]: trimmed }]);
      insertOrUpdateError = error;
    }

    if (insertOrUpdateError) {
      console.error(`Error adding ${columnName} to master:`, insertOrUpdateError);
      return { success: false, error: insertOrUpdateError.message };
    }

    // Update in-memory cache immediately so UI reflects change instantly
    if (masterCache) {
      if (!masterCache[columnName]) masterCache[columnName] = [];
      if (!masterCache[columnName].some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
        masterCache[columnName].push(trimmed);
        masterCache[columnName].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
        );
      }
    }

    return { success: true };
  } catch (err) {
    console.error("addMasterItem exception:", err);
    return { success: false, error: err.message };
  }
};

/**
 * Invalidate cache
 */
export const invalidateMasterCache = () => {
  masterCache = null;
  lastFetchTime = 0;
};
