import React, { useEffect, useState } from "react";
import { Search, CheckSquare } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/Table";
import { useAuth } from "../../context/AuthContext";

// Each step maps to exact column header names in the Accounts sheet
const STEPS = [
  {
    key: "audit",
    label: "Audit Data",
    plannedKey: "Planned 1",
    actualKey: "Actual 1",
    delayKey: "Delay 1",
    statusKey: "Status 1",
    remarksKey: "Remarks1",
    actualHeader: "Actual 1",
    statusHeader: "Status 1",
    remarksHeader: "Remarks1",
  },
  {
    key: "rectify",
    label: "Rectify the Mistake",
    plannedKey: "Planned 2",
    actualKey: "Actual 2",
    delayKey: "Delay 2",
    statusKey: "Status 2",
    remarksKey: "Remarks 2",
    actualHeader: "Actual 2",
    statusHeader: "Status 2",
    remarksHeader: "Remarks 2",
  },
  {
    key: "reaudit",
    label: "Reaudit Data",
    plannedKey: "Planned 3",
    actualKey: "Actual 3",
    delayKey: "Delay 3",
    statusKey: "Status 3",
    remarksKey: "Remarks 3",
    actualHeader: "Actual 3",
    statusHeader: "Status 3",
    remarksHeader: "Remarks 3",
  },
  {
    key: "tally",
    label: "Take Entry By Tally",
    plannedKey: "Planned 4",
    actualKey: "Actual 4",
    delayKey: "Delay 4",
    statusKey: "Status 4",
    remarksKey: "Remarks 4",
    actualHeader: "Actual 4",
    statusHeader: "Status 4",
    remarksHeader: "Remarks 4",
  },
];

const getStatusColor = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "complete" || s === "completed" || s === "matched" || s === "ok") {
    return "bg-green-100 text-green-800";
  }
  if (s === "mismatch" || s === "rejected") {
    return "bg-red-100 text-red-800";
  }
  if (!s) return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-800";
};

const Accounts = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(STEPS[0].key);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [formData, setFormData] = useState({ status: "", remarks: "" });

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;

  const activeStep = STEPS.find((s) => s.key === activeTab);

  const fetchAllTasks = async () => {
    try {
      setLoadingTasks(true);
      // Use existing GET endpoint (no redeployment needed)
      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&&sheet=Accounts`
      );
      const result = await res.json();

      const allRows = result?.table?.rows || [];

      // Accounts sheet:
      //   Sheet row 1   → allRows index 0 (banner)
      //   Sheet row 2   → allRows index 1 (banner)
      //   Sheet row 3   → allRows index 2 (banner)
      //   Sheet row 4   → allRows index 3 (banner)
      //   Sheet row 5   → allRows index 4 (banner)
      //   Sheet row 6   → allRows index 5 (ACTUAL HEADERS)
      //   Sheet row 7+  → allRows index 6+ (DATA)
      const headerRow = allRows[5];
      const actualHeaders = (headerRow?.c || []).map(
        (cell) => (cell?.v ?? cell?.f ?? "").toString().trim()
      );

      const dataRows = allRows.slice(6);

      const get = (cells, headerName) => {
        const idx = actualHeaders.indexOf(headerName);
        if (idx < 0) return "";
        const cell = cells[idx];
        return (cell?.v ?? cell?.f ?? "").toString().trim();
      };

      const formatted = dataRows
        .filter((row) => {
          // skip completely empty rows
          const cells = row.c || [];
          return cells.some((c) => c?.v || c?.f);
        })
        .map((row) => {
          const cells = row.c || [];

          const steps = {};
          STEPS.forEach((step) => {
            steps[step.key] = {
              planned: get(cells, step.plannedKey),
              actual: get(cells, step.actualKey),
              delay: get(cells, step.delayKey),
              status: get(cells, step.statusKey),
              remarks: get(cells, step.remarksKey),
            };
          });

          return {
            taskNo: get(cells, "Task No"),
            firmName: get(cells, "Firm Name"),
            serialNo: get(cells, "Serial No"),
            machineName: get(cells, "Machine Name"),
            machinePartName: get(cells, "Machine Part Name"),
            department: get(cells, "Department"),
            location: get(cells, "Location"),
            vendorName: get(cells, "Vendor Name"),
            transportationCharges: get(cells, "Transportation Charges"),
            weighmentSlip: get(cells, "Weighment Slip"),
            transportingImage: get(cells, "Transporting Image With Machine"),
            paymentType: get(cells, "Payment Type"),
            howMuch: get(cells, "How Much"),
            transporterName: get(cells, "Transporter Name"),
            transportationAmount: get(cells, "Transportation Amount"),
            billImage: get(cells, "Bill Image"),
            billNo: get(cells, "Bill No.") || get(cells, "Bill No"),
            typeOfBill: get(cells, "Type of Bill"),
            totalBillAmount: get(cells, "Total Bill Amount"),
            toBePaidAmount: get(cells, "To Be Paid Amount"),
            steps,
          };
        });

      // Filter by firm
      const userFirmName = user?.firmName || "";
      const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";
      const filtered = formatted.filter((task) =>
        isAllFirm
          ? true
          : (task.firmName || "").toLowerCase() === userFirmName.toLowerCase()
      );

      setTasks(filtered);
    } catch (err) {
      console.error("Error fetching Accounts data:", err);
    } finally {
      setLoadingTasks(false);
    }
  };


  useEffect(() => {
    fetchAllTasks();
  }, []);

  const filteredTasks = tasks.filter((task) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (task.taskNo || "").toLowerCase().includes(term) ||
      (task.machineName || "").toLowerCase().includes(term) ||
      (task.serialNo || "").toLowerCase().includes(term) ||
      (task.department || "").toLowerCase().includes(term) ||
      (task.firmName || "").toLowerCase().includes(term)
    );
  });

  const handleUpdateClick = (task) => {
    setSelectedTask(task);
    setFormData({
      status: task.steps[activeStep.key].status || "",
      remarks: task.steps[activeStep.key].remarks || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoaderSubmit(true);

      const payload = {
        action: "update1",
        sheetName: "Accounts",
        taskNo: selectedTask.taskNo,
        [activeStep.actualHeader]: new Date().toLocaleDateString("en-GB", {
          timeZone: "Asia/Kolkata",
        }),
        [activeStep.statusHeader]: formData.status,
        [activeStep.remarksHeader]: formData.remarks,
      };

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();

      if (result.success) {
        setIsModalOpen(false);
        fetchAllTasks();
      } else {
        alert("❌ Failed to update: " + (result.message || result.error));
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("❌ Something went wrong while submitting");
    } finally {
      setLoaderSubmit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {STEPS.map((step) => (
              <button
                key={step.key}
                onClick={() => setActiveTab(step.key)}
                className={`py-4 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-200 ${
                  activeTab === step.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {step.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by task no, machine, firm, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[100px] text-center">Action</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Task No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Firm Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Serial No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Machine Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">Machine Part Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Department</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Location</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[140px]">Vendor Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Transportation Charges</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[140px]">Weighment Slip</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Transporting Image</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Payment Type</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">How Much</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">Transporter Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Transportation Amount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Bill Image</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Bill No.</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Type of Bill</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">Total Bill Amount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">To Be Paid Amount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Planned</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Actual</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[90px]">Delay</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[180px]">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loadingTasks ? (
                <tr>
                  <td colSpan={26} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={26} className="text-center py-12 text-gray-500">No tasks found</td>
                </tr>
              ) : (
                filteredTasks.map((task, idx) => {
                  const step = task.steps[activeStep.key] || {};
                  const canUpdate = step.planned && !step.actual;
                  return (
                    <tr key={task.taskNo || idx} className="hover:bg-blue-50/40 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-center">
                        {canUpdate ? (
                          <button onClick={() => handleUpdateClick(task)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors">
                            <CheckSquare className="w-3.5 h-3.5" />
                            Update
                          </button>
                        ) : step.actual ? (
                          <button onClick={() => handleUpdateClick(task)} className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
                            Edit
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">Not reached</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-blue-600 whitespace-nowrap">{task.taskNo || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.firmName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.serialNo || "-"}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{task.machineName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.machinePartName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.department || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.location || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.vendorName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.transportationCharges ? `₹${Number(task.transportationCharges).toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {task.weighmentSlip ? (
                          <button type="button" onClick={() => window.open(task.weighmentSlip, "_blank", "noopener,noreferrer")} className="text-blue-600 underline text-xs hover:text-blue-800 font-medium">View Slip</button>
                        ) : <span className="text-gray-400 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {task.transportingImage ? (
                          <button type="button" onClick={() => window.open(task.transportingImage, "_blank", "noopener,noreferrer")} className="text-blue-600 underline text-xs hover:text-blue-800 font-medium">View Image</button>
                        ) : <span className="text-gray-400 text-xs">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.paymentType || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.transporterName || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.transportationAmount ? `₹${Number(task.transportationAmount).toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {task.billImage ? (
                          <button type="button" onClick={() => window.open(task.billImage, "_blank", "noopener,noreferrer")} className="text-blue-600 underline text-sm hover:text-blue-800 font-medium">View Bill</button>
                        ) : <span className="text-gray-400 text-xs">No Bill</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.billNo || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.typeOfBill || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.totalBillAmount ? `₹${Number(task.totalBillAmount).toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {task.toBePaidAmount ? `₹${Number(task.toBePaidAmount).toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{step.planned || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{step.actual || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{step.delay || "-"}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(step.status)}`}>
                          {step.status || "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{step.remarks || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeStep?.label}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task No (Read-only)
            </label>
            <input
              type="text"
              value={selectedTask?.taskNo || ""}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <input
              type="text"
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value }))
              }
              placeholder="e.g. Complete / Mismatch"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, remarks: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loaderSubmit}>
              {loaderSubmit ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Accounts;

