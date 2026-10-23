import React from "react";
import { Layers } from "lucide-react";
import { openDrivePreview } from "../../utils/driveUtils";

const money = (v) => {
  const n = parseFloat((v ?? "").toString().replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) && n !== 0 ? `₹${n.toLocaleString()}` : "-";
};

/**
 * Entry ke theek neeche slide hokar khulne wali row.
 * <tr> hai, isliye table ke <tbody> ke andar hi lagana hai.
 */
export const CommonTasksRow = ({ colSpan, parent, items }) => (
  <tr className="bg-indigo-50/40">
    <td colSpan={colSpan} className="p-0">
      <div className="animate-slideDown overflow-hidden border-l-4 border-indigo-400">
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-indigo-800 font-semibold mb-2">
            <Layers className="w-3.5 h-3.5" />
            Common bill — {parent.taskNo || parent.repairTaskNo}
            {parent.billNo ? <span className="text-gray-600 font-normal">· Bill No: {parent.billNo}</span> : null}
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-gray-500">No linked tasks found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white">
              <table className="min-w-full divide-y divide-gray-100 text-xs">
                <thead className="bg-indigo-50/70">
                  <tr>
                    {["Task No", "Machine Name", "Serial No", "Vendor", "Bill No", "Transportation Charges", "Total Bill", "To Be Paid", "Bill Image"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it) => (
                    <tr key={it.taskNo}>
                      <td className="px-3 py-2 font-semibold text-indigo-700 whitespace-nowrap">{it.taskNo}</td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{it.machineName}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{it.serialNo}</td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{it.vendorName}</td>
                      <td className="px-3 py-2 text-gray-800 whitespace-nowrap">{it.billNo}</td>
                      <td className="px-3 py-2 font-medium text-amber-700 whitespace-nowrap">{money(it.transportationCharges)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{money(it.totalBillAmount)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{money(it.toBePaid)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {it.billImage ? (
                          <button
                            type="button"
                            onClick={() => openDrivePreview(it.billImage)}
                            className="text-blue-600 underline font-medium hover:text-blue-800"
                          >
                            View Bill
                          </button>
                        ) : (
                          <span className="text-gray-400">No Bill</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </td>
  </tr>
);

export default CommonTasksRow;
