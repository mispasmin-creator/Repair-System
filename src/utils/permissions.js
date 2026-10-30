// Central permission helper. Levels: "none" < "view" < "full".
// Keep the rules here identical to rbac_user_level() in supabase_users_rbac.sql.

const RESOURCE_KEYS = {
  user_management: "Users",
  // DB has both spellings for this page key.
  check_machine: ["Check Machin", "Check Machine"],
};

const ACTION_MIN_LEVEL = { read: "view", write: "full" };
const LEVEL_RANK = { none: 0, view: 1, full: 2 };

export const getPermissionLevel = (user, resource) => {
  if (!user) return "none";
  const keys = [].concat(RESOURCE_KEYS[resource] || resource);
  const role = (user.role || "").toLowerCase();
  const storedKey = keys.find((k) => user.permissions?.[k] !== undefined);
  const stored = storedKey ? user.permissions[storedKey] : undefined;

  let level;
  if (role === "admin") {
    // Admin = all access; only an explicit "view" restricts it.
    level = stored === "view" ? "view" : "full";
  } else {
    level = stored in LEVEL_RANK ? stored : "none";
  }

  // The "viewer" role is read-only everywhere.
  if (role === "viewer" && level === "full") level = "view";
  return level;
};

export const hasPermission = (user, resource, action = "read") =>
  LEVEL_RANK[getPermissionLevel(user, resource)] >=
  LEVEL_RANK[ACTION_MIN_LEVEL[action] ?? "full"];
