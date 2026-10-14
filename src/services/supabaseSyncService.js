/**
 * supabaseSyncService.js
 * Dual-write synchronization service.
 * Automatically mirrors every Google Sheet update into Supabase tables in the background.
 */

import { supabase } from "./supabaseClient.js";

// Helper to safely format dates for Supabase timestamp columns
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

/**
 * Syncs any update to "Repair FMS Advance Payment" sheet directly to public.repair_advance table
 */
export const syncAdvancePaymentToSupabase = async (repairTaskNo, fields = {}) => {
  if (!repairTaskNo) return;
  try {
    const record = { repair_task_no: repairTaskNo.trim() };

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
    if (fields["Bill No."] !== undefined) record.bill_no = fields["Bill No."];
    if (fields["Bill Date"] !== undefined) record.bill_date = toISOOrNull(fields["Bill Date"])?.slice(0, 10) || null;
    if (fields["Bill Image Link"] !== undefined) record.bill_image_link = fields["Bill Image Link"];
    if (fields["Checked By"] !== undefined) record.checked_by = fields["Checked By"];

    // Step 5: Store In
    if (fields["Planned Store In"] !== undefined) record.planned_store_in = toISOOrNull(fields["Planned Store In"]);
    if (fields["Actual Store In Date"] !== undefined) record.actual_store_in_date = toISOOrNull(fields["Actual Store In Date"]);
    if (fields["Received Quantity"] !== undefined) record.received_quantity = toNumOrNull(fields["Received Quantity"]);
    if (fields["Store In Done By"] !== undefined) record.store_in_done_by = fields["Store In Done By"];

    const { error } = await supabase.from("repair_advance").upsert(record, { onConflict: "repair_task_no" });
    if (error) console.warn("Supabase advance sync error:", error);
  } catch (err) {
    console.warn("Supabase advance sync failed:", err);
  }
};

/**
 * Syncs any update to "Repair System" sheet directly to the corresponding Supabase tables
 */
export const syncRepairTaskToSupabase = async (taskNo, fields = {}) => {
  if (!taskNo) return;
  const cleanTaskNo = taskNo.trim();
  try {
    // 1. Sent to Vendor
    if (fields["Actual 1"] || fields["Vendor Name"] || fields["Vendor Name 1"]) {
      const svData = {
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
      };
      await supabase.from("sent_to_vendor").upsert(svData, { onConflict: "task_no" });
    }

    // 2. Management Approval
    if (fields["Management Approval Date"] || fields["Approved Vendor Name"]) {
      const maData = {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Management Pending Date"]),
        actual_date: toISOOrNull(fields["Management Approval Date"]),
        approved_vendor_name: fields["Approved Vendor Name"] || fields["Vendor Name"] || "Approved",
        approved_payment_term: fields["Approved Payment Term"] || fields["Payment Type"] || "Normal",
        advance_amount: toNumOrNull(fields["Advance Payment 1"] || fields["How Much"]) || 0,
        management_remark: fields["Management Remark"] || null,
        approval_status: fields["ThreePartyStatus"] || "Approved",
      };
      await supabase.from("management_approval").upsert(maData, { onConflict: "task_no" });
    }

    // 3. Check Machine
    if (fields["Actual 2"] || fields["Bill No."]) {
      const cmData = {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 2"]),
        actual_date: toISOOrNull(fields["Actual 2"]),
        bill_no: fields["Bill No."] || null,
        bill_date: toISOOrNull(fields["Actual 2"])?.slice(0, 10) || null,
        type_of_bill: fields["Type of Bill"] || null,
        total_bill_amount: toNumOrNull(fields["Total Bill Amount"]),
        bill_image_url: fields["Bill Image"] || null,
      };
      await supabase.from("check_machine").upsert(cmData, { onConflict: "task_no" });
    }

    // 4. Store In
    if (fields["Actual 3"] || fields["Received Quantity"]) {
      const siData = {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 3"]),
        actual_date: toISOOrNull(fields["Actual 3"]),
        received_quantity: toNumOrNull(fields["Received Quantity"]) || 1,
        bill_match: String(fields["Bill Match"]).toLowerCase() !== "no",
        store_image_url: fields["Product Image"] || null,
      };
      await supabase.from("store_in").upsert(siData, { onConflict: "task_no" });
    }

    // 5. Posting
    if (fields["Actual Posting"]) {
      const pData = {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned Posting"]),
        actual_date: toISOOrNull(fields["Actual Posting"]),
        posting_voucher_no: fields["Posting Voucher No"] || "AUTO-VOUCHER",
        process_remark: fields["Remark"] || null,
      };
      await supabase.from("posting").upsert(pData, { onConflict: "task_no" });
    }

    // 6. Make Payment
    if (fields["Actual 4"]) {
      const mpData = {
        task_no: cleanTaskNo,
        planned_date: toISOOrNull(fields["Planned 4"]),
        actual_date: toISOOrNull(fields["Actual 4"]),
        payment_type: fields["Payment Type"] || "Final",
        payment_utr_no: fields["UTR / Cheque No"] || "PAID",
        amount_paid: toNumOrNull(fields["To Be Paid Amount"] || fields["Total Bill Amount"]) || 0,
      };
      await supabase.from("make_payment").upsert(mpData, { onConflict: "task_no" });
    }
  } catch (err) {
    console.warn("Supabase task sync failed:", err);
  }
};
