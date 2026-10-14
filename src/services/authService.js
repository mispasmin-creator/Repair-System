import { supabase } from "./supabaseClient.js";

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

export const authenticateUser = async (username, password) => {
  const cleanUsername = (username || "").trim();
  const cleanPassword = (password || "").trim();

  // 1. Try Supabase authentication first (ultra fast <50ms)
  try {
    const { data: supaUser, error } = await supabase
      .from("users")
      .select("*")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (supaUser && !error) {
      if (supaUser.password === cleanPassword) {
        let accessList = ["Dashboard"];
        if (supaUser.page_access && typeof supaUser.page_access === "object") {
          accessList = Object.entries(supaUser.page_access)
            .filter(([_, level]) => level && level !== "none")
            .map(([page]) => page);
        } else if (typeof supaUser.page_access === "string") {
          accessList = supaUser.page_access.split(",").map((s) => s.trim()).filter(Boolean);
        }

        return {
          id: supaUser.id || supaUser.username,
          name: supaUser.username,
          username: supaUser.username,
          role: supaUser.role || "user",
          access: accessList.length > 0 ? accessList : ["Dashboard"],
          firmName: supaUser.firm_name || "All",
          manual: supaUser.manual || "",
        };
      } else {
        throw new Error("Invalid credentials");
      }
    } else {
      throw new Error("Invalid credentials");
    }
  } catch (supaErr) {
    throw supaErr;
  }
};
