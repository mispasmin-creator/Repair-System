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
export const fetchAdvancePayments = async () => {
  const res = await fetch(
    `${SCRIPT_URL}?action=getAdvancePayments&sheetId=${SHEET_ID}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  if (!result.success) throw new Error(result.error || "Failed to fetch advance payments");

  const raw = result.data || [];

  return raw
    .filter((row) => Object.values(row).some((v) => v !== "" && v !== null && v !== undefined))
    .map((row) => ({
      isAdvance: true,
      taskNo: row["Repair Task No"] || "",
      repairTaskNo: row["Repair Task No"] || "",
      firmName: row["Firm Name"] || "",
      serialNo: row["Serial No"] || "",
      machineName: row["Machine Name"] || row["Machine Name "] || "",
      machinePartName: row["Machine Part Name"] || "",
      department: row["Department"] || "",
      vendorName: row["Vendor Name"] || row["Vendor Name "] || "",
      paymentType: row["Payment Type"] || "Advance",
      toBePaidAmount: row["To Be Paid Amount"] || "",

      // Management Approval
      managementApprovalDate: row["Management Approval Date"] || "",
      managementRemark: row["Management Remark"] || "",

      // Step 2: Posting
      plannedPosting: row["Planned Posting"] || "",
      actualPosting: row["Actual Posting"] || "",
      postingVoucherNo: row["Posting Voucher No"] || "",
      postingDoneBy: row["Posting Done By"] || "",

      // Step 3: Make Payment (Advance Release)
      plannedPayment: row["Planned Payment"] || "",
      actualPaymentDate: row["Actual Payment Date"] || "",
      advancePaymentUTR: row["Advance Payment UTR / Cheque No"] || "",
      advanceAmountPaid: row["Advance Amount Paid"] || "",
      paymentDoneBy: row["Payment Done By"] || "",

      // Step 4: Check Machine
      plannedCheckMachine: row["Planned Check Machine"] || "",
      actualCheckMachineDate: row["Actual Check Machine Date"] || "",
      billDate: row["Bill Date"] || "",
      billImageLink: row["Bill Image Link"] || "",
      checkedBy: row["Checked By"] || "",

      // Step 5: Store In
      plannedStoreIn: row["Planned Store In"] || "",
      actualStoreInDate: row["Actual Store In Date"] || "",
      receivedQuantity: row["Received Quantity"] || "",
      storeInDoneBy: row["Store In Done By"] || "",

      // Step 6: Full Billing
      plannedFullBilling: row["Planned Full Billing"] || "",
      actualFullBillingDate: row["Actual Full Billing Date"] || "",
      balanceAmountToPay: row["Balance Amount To Pay"] || "",
      balancePaymentUTR: row["Balance Payment UTR / Cheque No"] || "",
      billingStatus: row["Billing Status"] || "",

      // Step 7: Accounts
      plannedAccounts: row["Planned Accounts"] || "",
      actualAccountsDate: row["Actual Accounts Date"] || "",
      accountsStatus: row["Accounts Status"] || "",
      accountsRemark: row["Accounts Remark"] || "",
    }));
};

/**
 * Updates specific fields in "Repair FMS Advance Payment" sheet
 * by matching Repair Task No (uses update1 action).
 * Keys must match exact sheet Row 6 header names.
 */
export const updateAdvancePayment = async (repairTaskNo, fields) => {
  const payload = new URLSearchParams({
    action: "update1",
    sheetName: ADVANCE_SHEET_NAME,
    taskNo: repairTaskNo,
    ...fields,
  });

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

/** Returns current date-time in Indian format (DD/MM/YYYY, HH:MM:SS). */
export const getNowIST = () =>
  new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });

/** Returns current date in Indian format (DD/MM/YYYY). */
export const getTodayIST = () =>
  new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
