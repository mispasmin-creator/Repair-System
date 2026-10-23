const parseMoney = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Rebuild common-bill links from persisted bill data. Older records only keep
 * the shared firm/bill number plus a "Common" type on child rows.
 */
export const attachCommonBillMetadata = (tasks = []) => {
  const enriched = tasks.map((task) => {
    const ownGrandTotal =
      parseMoney(task["Total Bill Amount"]) + parseMoney(task["Transportation Charges"]);
    return {
      ...task,
      "Common Bill Tasks": [],
      "Common Parent Task": "",
      "Total Bill With Transportation": ownGrandTotal > 0 ? String(ownGrandTotal) : "",
    };
  });
  const groups = new Map();

  enriched.forEach((task) => {
    const billNo = String(task["Bill No."] || "").trim().toLowerCase();
    if (!billNo || billNo === "-") return;
    const firm = String(task["Firm Name"] || "").trim().toLowerCase();
    const key = `${firm}::${billNo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  });

  groups.forEach((members) => {
    const isCombined =
      members.length > 1 &&
      members.some((task) => String(task["Type of Bill"] || "").trim().toLowerCase() === "common");
    if (!isCombined) return;

    const parent =
      members.find(
        (task) =>
          String(task["Type of Bill"] || "").trim().toLowerCase() !== "common" &&
          parseMoney(task["Total Bill Amount"]) > 0
      ) ||
      members.find((task) => String(task["Type of Bill"] || "").trim().toLowerCase() !== "common") ||
      members[0];
    const children = members.filter((task) => task !== parent);
    const sharedBillImage = members.find((task) => task["Bill Image"])?.["Bill Image"] || "";
    const grandTotal = members.reduce(
      (sum, task) =>
        sum + parseMoney(task["Total Bill Amount"]) + parseMoney(task["Transportation Charges"]),
      0
    );

    parent["Common Bill Tasks"] = children.map((task) => task["Task No"]);
    members.forEach((task) => {
      task["Bill Image"] = task["Bill Image"] || sharedBillImage;
      task["Total Bill With Transportation"] = String(grandTotal);
      if (task !== parent) task["Common Parent Task"] = parent["Task No"];
    });
  });

  return enriched;
};
