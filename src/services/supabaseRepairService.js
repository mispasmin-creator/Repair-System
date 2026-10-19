/**
 * supabaseRepairService.js
 * Native Supabase adapter for all Repair System tasks and Advance payments.
 * Completely replaces slow Google Sheets API with ultra-fast PostgreSQL queries.
 */

import { supabase } from "./supabaseClient.js";

const formatDateIST = (isoStr) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }).replace(",", "");
};

const formatCurrency = (val) => {
  if (val === null || val === undefined) return "";
  return String(val);
};

const toISOOrNull = (val) => {
  if (!val || val === "-" || val === "") return null;
  val = String(val).trim();
  if (val.includes("T") && !isNaN(Date.parse(val))) return new Date(val).toISOString();

  const dmyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hour, min, sec));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toNumOrNull = (val) => {
  if (val === null || val === undefined || val === "" || val === "-") return null;
  const clean = String(val).replace(/[^0-9.-]+/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
};

export const matchesFirm = (firmValue, userFirmName) => {
  const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";
  if (isAllFirm) return true;

  const allowedFirms = userFirmName
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);

  if (allowedFirms.includes("all")) return true;

  const taskFirm = (firmValue || "").toLowerCase().trim();
  if (!taskFirm) return false;

  return allowedFirms.includes(taskFirm) || taskFirm === "all";
};

/**
 * Maps a joined Supabase task to the exact sheet header format
 * that all components (Indent, SentMachine, StoreIn, Posting, MakePayment, Dashboard) expect.
 */
export const mapSupabaseTaskToSheetFormat = (item) => {
  const sv = Array.isArray(item.sent_to_vendor) ? item.sent_to_vendor[0] : item.sent_to_vendor;
  const ma = Array.isArray(item.management_approval) ? item.management_approval[0] : item.management_approval;
  const cm = Array.isArray(item.check_machine) ? item.check_machine[0] : item.check_machine;
  const si = Array.isArray(item.store_in) ? item.store_in[0] : item.store_in;
  const p = Array.isArray(item.posting) ? item.posting[0] : item.posting;
  const mp = Array.isArray(item.make_payment) ? item.make_payment[0] : item.make_payment;
  const acc = Array.isArray(item.accounts) ? item.accounts[0] : item.accounts;
  // Audit me "Not Done" (purana naam "Mismatch") = Rectify me jayega, Tally me nahi.
  const auditNotDone = ["not done", "mismatch", "rejected"].includes(
    String(acc?.status_1 || "").trim().toLowerCase()
  );

  return {
    "Time Stemp": formatDateIST(item.created_at),
    "Task No": item.task_no || "",
    "Firm Name": item.firm_name || "",
    "Serial No": item.serial_no || "",
    "Machine Name": item.machine_name || "",
    "Machine Part Name": item.machine_part_name || "",
    "Authorized Name": item.given_by || "",
    "Indentor Name": item.indentor_name || "",
    "Problem With Machine": item.problem_description || "",
    "Enable Reminders": item.enable_reminders ? "Yes" : "No",
    "Require Attachment": "No",
    "Task Start Date": formatDateIST(item.task_start_date),
    "Task Ending Date": formatDateIST(item.task_ending_date),
    Priority: item.priority || "Medium",
    Department: item.department || "",
    Location: item.location || "",
    "Image Link": item.machine_image_url || "",
    UOM: item.uom || "",
    Quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : "1",

    // Step 1: Sent to Vendor
    "Planned 1": formatDateIST(sv?.planned_date || item.planned_sent_date),
    "Actual 1": formatDateIST(sv?.actual_date),
    "Vendor Name": sv?.vendor_name_1 || "",
    "Vendor Name 1": sv?.vendor_name_1 || "",
    "(Transporter Name)": sv?.transporter_name_1 || "",
    "(Transporter Name) 1": sv?.transporter_name_1 || "",
    "Transportation Charges": formatCurrency(sv?.charges_1),
    "Transportation Charges 1": formatCurrency(sv?.charges_1),
    "Weighment Slip": sv?.weighment_slip_1 || "",
    "Weighment Slip 1": sv?.weighment_slip_1 || "",
    "Lead Time To Deliver ( In No. Of Days)": sv?.lead_time_1 || "",
    "Lead Time To Deliver 1": sv?.lead_time_1 || "",
    "Payment Type": sv?.payment_type_1 || "",
    "Vendor 1 Payment Type": sv?.payment_type_1 || "",
    "How Much": formatCurrency(sv?.advance_1),
    "Advance Payment 1": formatCurrency(sv?.advance_1),
    "Transporting Image With Machine": sv?.transport_image_url || "",

    // Step 2: Management Approval
    "Management Pending Date": formatDateIST(ma?.planned_date),
    "Management Approval Date": formatDateIST(ma?.actual_date),
    "Approved Vendor Name": ma?.approved_vendor_name || "",
    "Approved Payment Term": ma?.approved_payment_term || "",
    "Management Remark": ma?.management_remark || "",
    ThreePartyStatus: ma?.approval_status || "",

    // Step 3: Check Machine
    "Planned 2": formatDateIST(cm?.planned_date),
    "Actual 2": formatDateIST(cm?.actual_date),
    "Bill No.": cm?.bill_no || "",
    "Type of Bill": cm?.type_of_bill || "",
    "Total Bill Amount": formatCurrency(cm?.total_bill_amount),
    "Bill Image": cm?.bill_image_url || "",

    // Step 4: Store In
    "Planned 3": formatDateIST(si?.planned_date),
    "Actual 3": formatDateIST(si?.actual_date),
    "Received Quantity": formatCurrency(si?.received_quantity),
    "Bill Match": si?.bill_match ? "Yes" : "No",
    "Product Image": si?.store_image_url || "",

    // Step 5: Posting
    "Planned Posting": formatDateIST(p?.planned_date),
    "Actual Posting": formatDateIST(p?.actual_date),
    "Posting Voucher No": p?.posting_voucher_no || "",

    // Step 6: Make Payment
    "Planned 4": formatDateIST(mp?.planned_date),
    "Actual 4": formatDateIST(mp?.actual_date),
    "UTR / Cheque No": mp?.payment_utr_no || "",

    // Step 7: Accounts
    "Planned 5": formatDateIST(acc?.planned_1 || si?.actual_date),
    "Actual 5": formatDateIST(acc?.actual_1),
    Status:
      (acc?.status_1 && acc.status_1.toLowerCase() !== "pending") || si?.actual_date
        ? "Complete"
        : "Pending",
    Remark: acc?.remarks_1 || "",

    // Accounts specific columns for Accounts page
    "Accounts Planned 1": formatDateIST(acc?.planned_1 || si?.actual_date),
    "Accounts Actual 1": formatDateIST(acc?.actual_1),
    "Accounts Status 1": acc?.status_1 || "",
    "Accounts Remarks 1": acc?.remarks_1 || "",

    "Accounts Planned 2": formatDateIST(acc?.planned_2 || (acc?.actual_1 && auditNotDone ? acc?.actual_1 : "")),
    "Accounts Actual 2": formatDateIST(acc?.actual_2),
    "Accounts Status 2": acc?.status_2 || "",
    "Accounts Remarks 2": acc?.remarks_2 || "",

    "Accounts Planned 3": formatDateIST(acc?.planned_3 || acc?.actual_2),
    "Accounts Actual 3": formatDateIST(acc?.actual_3),
    "Accounts Status 3": acc?.status_3 || "",
    "Accounts Remarks 3": acc?.remarks_3 || "",

    "Accounts Planned 4": formatDateIST(
      acc?.planned_4 || acc?.actual_3 || (acc?.actual_1 && !auditNotDone ? acc?.actual_1 : "")
    ),
    "Accounts Actual 4": formatDateIST(acc?.actual_4),
    "Accounts Status 4": acc?.status_4 || "",
    "Accounts Remarks 4": acc?.remarks_4 || "",
  };
};

/**
 * Fetches all repair tasks directly from Supabase in milliseconds.
 */
export const fetchRepairTasksFromSupabase = async (userFirmName = "") => {
  const { data: indents, error } = await supabase
    .from("indent")
    .select(`
      *,
      sent_to_vendor (*),
      management_approval (*),
      check_machine (*),
      store_in (*),
      posting (*),
      make_payment (*),
      accounts (*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetchRepairTasks error:", error);
    throw error;
  }

  const tasks = (indents || []).map(mapSupabaseTaskToSheetFormat);
  return tasks.filter((t) => matchesFirm(t["Firm Name"], userFirmName));
};

/**
 * Accounts steps (Audit / Rectify / Reaudit / Tally) sirf `accounts` table me likhta hai.
 * Dusre step ke tables (sent_to_vendor, check_machine, ...) ko nahi chhuta, kyunki
 * Accounts ke "Actual 1..4" ke naam un steps ke fields se milte-julte hain.
 */
const upsertAccountsRecord = async (cleanTaskNo, fields) => {
  const accRecord = { task_no: cleanTaskNo };
  if (fields["Actual 1"] !== undefined) accRecord.actual_1 = toISOOrNull(fields["Actual 1"]);
  if (fields["Status 1"] !== undefined) accRecord.status_1 = fields["Status 1"];
  if (fields["Remarks1"] !== undefined) accRecord.remarks_1 = fields["Remarks1"];

  if (fields["Actual 2"] !== undefined) accRecord.actual_2 = toISOOrNull(fields["Actual 2"]);
  if (fields["Status 2"] !== undefined) accRecord.status_2 = fields["Status 2"];
  if (fields["Remarks 2"] !== undefined) accRecord.remarks_2 = fields["Remarks 2"];

  if (fields["Actual 3"] !== undefined) accRecord.actual_3 = toISOOrNull(fields["Actual 3"]);
  if (fields["Status 3"] !== undefined) accRecord.status_3 = fields["Status 3"];
  if (fields["Remarks 3"] !== undefined) accRecord.remarks_3 = fields["Remarks 3"];

  if (fields["Actual 4"] !== undefined) accRecord.actual_4 = toISOOrNull(fields["Actual 4"]);
  if (fields["Status 4"] !== undefined) accRecord.status_4 = fields["Status 4"];
  if (fields["Remarks 4"] !== undefined) accRecord.remarks_4 = fields["Remarks 4"];

  if (accRecord.actual_1 && (accRecord.status_1 === "Done" || accRecord.status_1 === "Complete" || accRecord.status_1 === "Matched" || accRecord.status_1 === "OK")) {
    accRecord.planned_4 = accRecord.actual_1;
  } else if (accRecord.actual_1 && (accRecord.status_1 === "Not Done" || accRecord.status_1 === "Mismatch" || accRecord.status_1 === "Rejected")) {
    accRecord.planned_2 = accRecord.actual_1;
  }

  const { error } = await supabase.from("accounts").upsert(accRecord, { onConflict: "task_no" });
  if (error) {
    console.error("Supabase accounts upsert error:", error);
    return { success: false, message: error.message };
  }
  return { success: true, taskNo: cleanTaskNo };
};

/**
 * Updates any task step directly in Supabase.
 */
export const updateRepairTaskInSupabase = async (taskNo, fields = {}) => {
  if (!taskNo) return { success: false };
  const cleanTaskNo = taskNo.trim();

  // Accounts page: sirf accounts table update ho, baaki steps ko mat chhuo.
  if (fields.sheetName === "Accounts") {
    return upsertAccountsRecord(cleanTaskNo, fields);
  }

  // Sent to Vendor
  if (fields["Actual 1"] || fields["Vendor Name"] || fields["Vendor Name 1"]) {
    await supabase.from("sent_to_vendor").upsert(
      {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 1"]),
        actual_date: toISOOrNull(fields["Actual 1"]),
        vendor_name_1: fields["Vendor Name 1"] || fields["Vendor Name"] || null,
        transporter_name_1: fields["(Transporter Name) 1"] || fields["(Transporter Name)"] || null,
        charges_1: toNumOrNull(fields["Transportation Charges 1"] || fields["Transportation Charges"]),
        weighment_slip_1: fields["Weighment Slip 1"] || fields["Weighment Slip"] || null,
        lead_time_1: fields["Lead Time To Deliver 1"] || fields["Lead Time To Deliver ( In No. Of Days)"] || null,
        payment_type_1: fields["Vendor 1 Payment Type"] || fields["Payment Type"] || null,
        advance_1: toNumOrNull(fields["Advance Payment 1"] || fields["How Much"]),
        transport_image_url: fields["Transporting Image With Machine"] || null,
      },
      { onConflict: "task_no" }
    );
  }

  // Management Approval
  if (fields["Management Approval Date"] || fields["Approved Vendor Name"]) {
    const paymentTerm = fields["Approved Payment Term"] || fields["Payment Type"] || "Normal";
    const advAmount = toNumOrNull(fields["Advance Payment 1"] || fields["How Much"]) || 0;
    const vendorName = fields["Approved Vendor Name"] || fields["Vendor Name"] || "Approved";

    await supabase.from("management_approval").upsert(
      {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Management Pending Date"]),
        actual_date: toISOOrNull(fields["Management Approval Date"]),
        approved_vendor_name: vendorName,
        approved_payment_term: paymentTerm,
        advance_amount: advAmount,
        management_remark: fields["Management Remark"] || null,
        approval_status: fields["ThreePartyStatus"] || "Approved",
      },
      { onConflict: "task_no" }
    );

    if (paymentTerm.toLowerCase().includes("advance")) {
      await supabase.from("repair_advance").upsert(
        {
          repair_task_no: cleanTaskNo,
          vendor_name: vendorName,
          to_be_paid_amount: advAmount,
          firm_name: fields["Firm Name"] || null,
        },
        { onConflict: "repair_task_no" }
      );
    }
  }

  // Check Machine
  const isCheckMachineUpdate =
    fields["Actual 2"] ||
    fields["Bill Image"] !== undefined ||
    (fields["Bill No."] && !fields["Actual 3"] && !fields["Received Quantity"]);

  if (isCheckMachineUpdate) {
    if (fields["Bill Image"] !== undefined) {
      const { data: existing } = await supabase
        .from("check_machine")
        .select("id")
        .eq("task_no", cleanTaskNo)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("check_machine")
          .update({ bill_image_url: fields["Bill Image"] || null })
          .eq("task_no", cleanTaskNo);
      } else {
        await supabase
          .from("check_machine")
          .upsert(
            { task_no: cleanTaskNo, bill_image_url: fields["Bill Image"] || null },
            { onConflict: "task_no" }
          );
      }
    }

    if (fields["Actual 2"] || fields["Bill No."]) {
      const cmUpdate = {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 2"]),
        actual_date: toISOOrNull(fields["Actual 2"]),
        bill_no: fields["Bill No."] || null,
        bill_date: toISOOrNull(fields["Actual 2"])?.slice(0, 10) || null,
        type_of_bill: fields["Type of Bill"] || null,
        total_bill_amount: toNumOrNull(fields["Total Bill Amount"]),
      };
      if (fields["Bill Image"] !== undefined) {
        cmUpdate.bill_image_url = fields["Bill Image"] || null;
      }
      await supabase.from("check_machine").upsert(cmUpdate, { onConflict: "task_no" });
    }
  }

  // Store In
  if (fields["Actual 3"] || fields["Received Quantity"]) {
    await supabase.from("store_in").upsert(
      {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 3"]),
        actual_date: toISOOrNull(fields["Actual 3"]),
        received_quantity: toNumOrNull(fields["Received Quantity"]) || 1,
        bill_match: String(fields["Bill Match"]).toLowerCase() !== "no",
        store_image_url: fields["Product Image"] || null,
      },
      { onConflict: "task_no" }
    );
  }

  // Posting
  if (fields["Actual Posting"]) {
    await supabase.from("posting").upsert(
      {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned Posting"]),
        actual_date: toISOOrNull(fields["Actual Posting"]),
        posting_voucher_no: fields["Posting Voucher No"] || "AUTO-VOUCHER",
        process_remark: fields["Remark"] || null,
      },
      { onConflict: "task_no" }
    );
  }

  // Make Payment
  if (fields["Actual 4"]) {
    await supabase.from("make_payment").upsert(
      {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 4"]),
        actual_date: toISOOrNull(fields["Actual 4"]),
        payment_type: fields["Payment Type"] || "Final",
        payment_utr_no: fields["UTR / Cheque No"] || "PAID",
        amount_paid: toNumOrNull(fields["To Be Paid Amount"] || fields["Total Bill Amount"]) || 0,
      },
      { onConflict: "task_no" }
    );
  }

  // Accounts (dusre pages se aaye Status/Remarks fields ke liye)
  const isAccountsUpdate =
    fields["Status 1"] ||
    fields["Status 2"] ||
    fields["Status 3"] ||
    fields["Status 4"] ||
    fields["Remarks1"] ||
    fields["Remarks 2"] ||
    fields["Remarks 3"] ||
    fields["Remarks 4"];

  if (isAccountsUpdate) {
    return upsertAccountsRecord(cleanTaskNo, fields);
  }

  return { success: true, taskNo: cleanTaskNo };
};

/**
 * Fetches all advance payments directly from Supabase.
 */
export const fetchAdvancePaymentsFromSupabase = async (userFirmName = "") => {
  const { data: advanceRows, error } = await supabase
    .from("repair_advance")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetchAdvancePayments error:", error);
    throw error;
  }

  if (!advanceRows || advanceRows.length === 0) return [];

  const taskNos = advanceRows
    .map((r) => r.repair_task_no)
    .filter(Boolean);

  const [{ data: indents }, { data: approvals }] = await Promise.all([
    taskNos.length > 0
      ? supabase
          .from("indent")
          .select("task_no, firm_name, department, machine_name, machine_part_name")
          .in("task_no", taskNos)
      : Promise.resolve({ data: [] }),
    taskNos.length > 0
      ? supabase
          .from("management_approval")
          .select("task_no, actual_date, management_remark, approved_vendor_name, advance_amount")
          .in("task_no", taskNos)
      : Promise.resolve({ data: [] }),
  ]);

  const indentMap = new Map((indents || []).map((i) => [i.task_no, i]));
  const approvalMap = new Map((approvals || []).map((a) => [a.task_no, a]));

  return advanceRows.map((row) => {
    const indent = indentMap.get(row.repair_task_no) || {};
    const approval = approvalMap.get(row.repair_task_no) || {};

    const firmName = row.firm_name || indent.firm_name || "";
    const machineName = row.machine_name || indent.machine_name || "";
    const machinePartName = row.machine_part_name || indent.machine_part_name || "";
    const department = row.department || indent.department || "";
    const vendorName = row.vendor_name || approval.approved_vendor_name || "";
    const managementApprovalDate = formatDateIST(
      row.management_approval_date || approval.actual_date
    );
    const managementRemark = row.management_remark || approval.management_remark || "";
    const toBePaid =
      row.to_be_paid_amount !== null && row.to_be_paid_amount !== undefined
        ? String(row.to_be_paid_amount)
        : approval.advance_amount !== null && approval.advance_amount !== undefined
        ? String(approval.advance_amount)
        : "";

    return {
      isAdvance: true,
      taskNo: row.repair_task_no || "",
      repairTaskNo: row.repair_task_no || "",
      firmName,
      serialNo: row.serial_no || "",
      machineName,
      machinePartName,
      department,
      vendorName,
      paymentType: row.payment_type || "Advance",
      toBePaidAmount: toBePaid,
      billNo: row.bill_no || "",
      typeOfBill: row.type_of_bill || "",
      totalBillAmount: row.total_bill_amount != null ? String(row.total_bill_amount) : "",

      // Management Approval
      managementApprovalDate,
      managementRemark,

      // Step 2: Posting
      plannedPosting: formatDateIST(row.planned_posting),
      actualPosting: formatDateIST(row.actual_posting),
      postingVoucherNo: row.posting_voucher_no || "",
      postingDoneBy: row.posting_done_by || "",

      // Step 3: Make Payment
      plannedPayment: formatDateIST(row.planned_payment),
      actualPaymentDate: formatDateIST(row.actual_payment_date),
      advancePaymentUTR: row.advance_payment_utr || "",
      advanceAmountPaid: row.advance_amount_paid !== null ? String(row.advance_amount_paid) : "",
      paymentDoneBy: row.payment_done_by || "",

      // Step 4: Check Machine
      plannedCheckMachine: formatDateIST(row.planned_check_machine),
      actualCheckMachineDate: formatDateIST(row.actual_check_machine_date),
      billNo: row.bill_no || "",
      billDate: formatDateIST(row.bill_date),
      billImageLink: row.bill_image_link || "",
      checkedBy: row.checked_by || "",

      // Step 5: Store In
      plannedStoreIn: formatDateIST(row.planned_store_in),
      actualStoreInDate: formatDateIST(row.actual_store_in_date),
      receivedQuantity: row.received_quantity !== null ? String(row.received_quantity) : "",
      storeInDoneBy: row.store_in_done_by || "",

      // Step 6: Full Billing
      plannedFullBilling: formatDateIST(row.planned_full_billing),
      actualFullBillingDate: formatDateIST(row.actual_full_billing_date),
      balanceAmountToPay: row.balance_amount_to_pay !== null ? String(row.balance_amount_to_pay) : "",
      balancePaymentUTR: row.balance_payment_utr || "",
      billingStatus: row.billing_status || "",

      // Step 7: Accounts
      plannedAccounts: formatDateIST(row.planned_accounts),
      actualAccountsDate: formatDateIST(row.actual_accounts_date),
      accountsStatus: row.accounts_status || "",
      accountsRemark: row.accounts_remark || "",
    };
  });

  return allRows.filter((t) => matchesFirm(t.firmName, userFirmName));
};

/**
 * Updates specific fields in public.repair_advance table in Supabase.
 */
export const updateAdvancePaymentInSupabase = async (repairTaskNo, fields = {}) => {
  if (!repairTaskNo) return { success: false };
  const cleanNo = repairTaskNo.trim();

  const record = { repair_task_no: cleanNo };

  if (fields["Firm Name"] !== undefined) record.firm_name = fields["Firm Name"];
  if (fields["Machine Name"] !== undefined) record.machine_name = fields["Machine Name"];
  if (fields["Vendor Name"] !== undefined || fields["Vendor Name "] !== undefined) {
    record.vendor_name = fields["Vendor Name"] || fields["Vendor Name "];
  }
  if (fields["To Be Paid Amount"] !== undefined) record.to_be_paid_amount = toNumOrNull(fields["To Be Paid Amount"]);

  // Step 2: Posting
  if (fields["Planned Posting"] !== undefined) record.planned_posting = toISOOrNull(fields["Planned Posting"]);
  if (fields["Actual Posting"] !== undefined) record.actual_posting = toISOOrNull(fields["Actual Posting"]);
  if (fields["Posting Voucher No"] !== undefined) record.posting_voucher_no = fields["Posting Voucher No"];
  if (fields["Posting Done By"] !== undefined) record.posting_done_by = fields["Posting Done By"];

  // Step 3: Make Payment
  if (fields["Planned Payment"] !== undefined) record.planned_payment = toISOOrNull(fields["Planned Payment"]);
  if (fields["Actual Payment Date"] !== undefined) record.actual_payment_date = toISOOrNull(fields["Actual Payment Date"]);
  if (fields["Advance Payment UTR / Cheque No"] !== undefined) record.advance_payment_utr = fields["Advance Payment UTR / Cheque No"];
  if (fields["Advance Amount Paid"] !== undefined) record.advance_amount_paid = toNumOrNull(fields["Advance Amount Paid"]);
  if (fields["Payment Done By"] !== undefined) record.payment_done_by = fields["Payment Done By"];

  // Step 4: Check Machine
  if (fields["Planned Check Machine"] !== undefined) record.planned_check_machine = toISOOrNull(fields["Planned Check Machine"]);
  if (fields["Actual Check Machine Date"] !== undefined) record.actual_check_machine_date = toISOOrNull(fields["Actual Check Machine Date"]);
  if (fields["Bill No."] !== undefined || fields["Bill No"] !== undefined) {
    record.bill_no = fields["Bill No."] || fields["Bill No"];
  }
  if (fields["Bill Date"] !== undefined) record.bill_date = toISOOrNull(fields["Bill Date"])?.slice(0, 10) || null;
  if (fields["Bill Image Link"] !== undefined || fields["Bill Image"] !== undefined) {
    record.bill_image_link = fields["Bill Image Link"] || fields["Bill Image"];
  }
  if (fields["Checked By"] !== undefined) record.checked_by = fields["Checked By"];

  // Step 5: Store In
  if (fields["Planned Store In"] !== undefined) record.planned_store_in = toISOOrNull(fields["Planned Store In"]);
  if (fields["Actual Store In Date"] !== undefined) record.actual_store_in_date = toISOOrNull(fields["Actual Store In Date"]);
  if (fields["Received Quantity"] !== undefined) record.received_quantity = toNumOrNull(fields["Received Quantity"]);
  if (fields["Store In Done By"] !== undefined) record.store_in_done_by = fields["Store In Done By"];

  const { error } = await supabase.from("repair_advance").upsert(record, { onConflict: "repair_task_no" });
  if (error) {
    console.error("Supabase advance update error:", error);
    throw error;
  }

  return { success: true, taskNo: cleanNo };
};
