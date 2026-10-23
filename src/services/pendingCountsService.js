import { fetchRepairTasks } from "./repairService";
import { fetchAdvancePayments, isAdvanceRow } from "./advancePaymentService";
import {
  hasCompletedManagementApproval,
  hasCompletedSentToVendor,
  usesDirectStoreInFlow,
} from "../utils/firmFlow";

const hasValue = (value) => Boolean(String(value || "").trim());

const taskNoOf = (task) => task.taskNo || task.repairTaskNo || task["Task No"] || "";
const firmOf = (task) => task.firmName || task["Firm Name"] || "";

const countVisibleRows = (tasks) => {
  const keys = new Set();

  tasks.forEach((task, index) => {
    const billNo = task.billNo || task["Bill No."] || "";
    const taskNo = taskNoOf(task);
    const key = hasValue(billNo) && billNo !== "-"
      ? `bill:${firmOf(task).trim().toLowerCase()}:${billNo.trim().toLowerCase()}`
      : `task:${taskNo || index}`;
    keys.add(key);
  });

  return keys.size;
};

export const computePendingCounts = (rawTasks = [], advanceTasks = []) => {
  const advanceTaskNos = new Set(advanceTasks.map(taskNoOf).filter(Boolean));
  const normalFlowTasks = rawTasks.filter(
    (task) => !(isAdvanceRow(task) && advanceTaskNos.has(taskNoOf(task)))
  );

  const sentPending = rawTasks.filter(
    (task) => hasValue(task["Planned 1"]) && !hasCompletedSentToVendor(task)
  ).length;

  const managementPending = rawTasks.filter(
    (task) => hasValue(task["Actual 1"]) && !hasCompletedManagementApproval(task)
  ).length;

  const normalCheckPending = normalFlowTasks.filter(
    (task) =>
      hasValue(task["Management Approval Date"]) &&
      !hasValue(task["Actual 2"])
  );
  const advanceCheckPending = advanceTasks.filter((task) => {
    const prerequisiteComplete = usesDirectStoreInFlow(firmOf(task))
      ? task.managementApprovalDate
      : task.actualPaymentDate;
    return hasValue(prerequisiteComplete) && !hasValue(task.actualCheckMachineDate);
  });

  const normalPostingPending = normalFlowTasks.filter(
    (task) =>
      !usesDirectStoreInFlow(firmOf(task)) &&
      hasValue(task["Actual 2"]) &&
      !hasValue(task["Actual Posting"])
  );
  const advancePostingPending = advanceTasks.filter(
    (task) =>
      !usesDirectStoreInFlow(firmOf(task)) &&
      hasValue(task.managementApprovalDate) &&
      !hasValue(task.actualPosting)
  );

  const normalPaymentPending = normalFlowTasks.filter(
    (task) =>
      !usesDirectStoreInFlow(firmOf(task)) &&
      hasValue(task["Actual Posting"]) &&
      !hasValue(task["Actual 4"])
  );
  const advancePaymentPending = advanceTasks.filter(
    (task) =>
      !usesDirectStoreInFlow(firmOf(task)) &&
      hasValue(task.actualPosting) &&
      !hasValue(task.actualPaymentDate)
  );

  const normalStorePending = normalFlowTasks.filter((task) => {
    const prerequisiteComplete = usesDirectStoreInFlow(firmOf(task))
      ? task["Actual 2"]
      : task["Actual 4"];
    return hasValue(prerequisiteComplete) && !hasValue(task["Actual 3"]);
  });
  const advanceStorePending = advanceTasks.filter(
    (task) =>
      hasValue(task.actualCheckMachineDate) &&
      !hasValue(task.actualStoreInDate)
  );

  const accountsPending = rawTasks.filter(
    (task) => hasValue(task["Actual 3"]) && !hasValue(task["Accounts Actual 4"])
  ).length;

  return {
    "sent-machine": sentPending,
    "management-approval": managementPending,
    "check-machine":
      countVisibleRows(normalCheckPending) + countVisibleRows(advanceCheckPending),
    posting:
      countVisibleRows(normalPostingPending) + countVisibleRows(advancePostingPending),
    "make-payment":
      countVisibleRows(normalPaymentPending) + countVisibleRows(advancePaymentPending),
    "store-in":
      countVisibleRows(normalStorePending) + countVisibleRows(advanceStorePending),
    accounts: accountsPending,
  };
};

export const fetchPendingCounts = async (userFirmName = "") => {
  const [rawTasks, advanceTasks] = await Promise.all([
    fetchRepairTasks(userFirmName, { force: true }),
    fetchAdvancePayments(userFirmName, true),
  ]);

  return computePendingCounts(rawTasks, advanceTasks);
};
