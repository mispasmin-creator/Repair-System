export const buildCommonItems = (parent, findTask) => {
  const taskNos = [parent.taskNo || parent.repairTaskNo, ...(parent.commonTasksLinked || [])].filter(Boolean);
  return taskNos.map((taskNo, index) => {
    const found = index === 0 ? parent : findTask(taskNo) || {};
    return {
      taskNo,
      machineName: found.machineName || "-",
      serialNo: found.serialNo || "-",
      vendorName: found.vendorName || parent.vendorName || "-",
      billNo: found.billNo || parent.billNo || "-",
      transportationCharges: found.transportationCharges,
      totalBillAmount: found.totalBillAmount,
      toBePaid: found.toBePaidAmount,
      billImage:
        (found.isAdvance ? found.billImageLink : found.billImage) ||
        (parent.isAdvance ? parent.billImageLink : parent.billImage) ||
        "",
    };
  });
};
