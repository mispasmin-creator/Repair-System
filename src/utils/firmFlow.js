const DIRECT_STORE_IN_FIRMS = new Set(["pmmpl", "refrasynth"]);

export const usesDirectStoreInFlow = (firmName) =>
  DIRECT_STORE_IN_FIRMS.has(String(firmName || "").trim().toLowerCase());

