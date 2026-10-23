const DIRECT_STORE_IN_FIRMS = new Set(["pmmpl", "refrasynth"]);

export const usesDirectStoreInFlow = (firmName) =>
  DIRECT_STORE_IN_FIRMS.has(String(firmName || "").trim().toLowerCase());

const hasValue = (value) => Boolean(String(value || "").trim());

// A downstream completion is also proof that every prerequisite stage was
// completed. This keeps older/migrated rows out of an earlier Pending tab when
// a legacy field such as "Actual 1" is missing but the task has already moved on.
export const hasCompletedSentToVendor = (task = {}) =>
  [
    "Actual 1",
    "Management Approval Date",
    "Actual 2",
    "Actual Posting",
    "Actual 4",
    "Actual 3",
    "Accounts Actual 1",
  ].some((key) => hasValue(task[key]));

export const hasCompletedManagementApproval = (task = {}) =>
  [
    "Management Approval Date",
    "Actual 2",
    "Actual Posting",
    "Actual 4",
    "Actual 3",
    "Accounts Actual 1",
  ].some((key) => hasValue(task[key]));
