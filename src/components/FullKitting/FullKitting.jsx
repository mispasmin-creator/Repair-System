import React, { useEffect, useState, useMemo } from "react";
import { Search, Filter, Package, CheckCircle2, Loader2 } from "lucide-react";
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
import useDataStore from "../../store/dataStore";
import toast from "react-hot-toast";
import { fetchRepairTasks as fetchRepairTasksSvc } from "../../services/repairService";

const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

const FullKitting = () => {
  const { user } = useAuth();
  const { repairTasks, setRepairTasks } = useDataStore();

  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");

  const [formData, setFormData] = useState({
    kittingDoneBy: "",
    kittingRemark: "",
    kittingDate: new Date().toISOString().slice(0, 10),
  });

  // ✅ PENDING: Actual 4 bhari ho + Actual 5 KHALI ho
  const pendingTasks = useMemo(
    () => repairTasks.filter((t) => t.actual4 && !t.actual5),
    [repairTasks]
  );

  // ✅ HISTORY: Actual 5 bhari ho (kitting done)
  const historyTasks = useMemo(
    () => repairTasks.filter((t) => t.actual5),
    [repairTasks]
  );

  const filterList = (list) =>
    list
      .filter((t) => selectedFirm === "All" || t.firmName === selectedFirm)
      .filter((t) => selectedDepartment === "All" || t.department === selectedDepartment)
      .filter((t) => {
        if (!searchTerm) return true;
        const s = searchTerm.toLowerCase();
        return (
          (t.taskNo || "").toLowerCase().includes(s) ||
          (t.machineName || "").toLowerCase().includes(s) ||
          (t.serialNo || "").toLowerCase().includes(s) ||
          (t.vendorName || "").toLowerCase().includes(s) ||
          (t.department || "").toLowerCase().includes(s)
        );
      });

  const displayedPending = filterList(pendingTasks);
  const displayedHistory = filterList(historyTasks);

  const uniqueFirms = useMemo(
    () => ["All", ...new Set(repairTasks.map((t) => t.firmName).filter(Boolean))],
    [repairTasks]
  );
  const uniqueDepartments = useMemo(
    () => ["All", ...new Set(repairTasks.map((t) => t.department).filter(Boolean))],
    [repairTasks]
  );

  useEffect(() => {
    if (repairTasks.length > 0) return;
    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        // Use shared service — returns objects keyed by sheet header names (Row 6)
        const rawTasks = await fetchRepairTasksSvc(user?.firmName);

        const formattedTasks = rawTasks.map((row, index) => ({
          id: `kitting-task-${index}`,
          taskNo: row["Task No"] || "",
          firmName: row["Firm Name"] || "",
          serialNo: row["Serial No"] || "",
          machineName: row["Machine Name"] || "",
          machinePartName: row["Machine Part Name"] || "",
          doerName: row["Indentor Name"] || row["Doer Name"] || row["Authorized Name"] || "",
          nameOfIndenter: row["Indentor Name"] || row["Doer Name"] || row["Authorized Name"] || "",
          priority: row["Priority"] || "",
          department: row["Department"] || "",
          vendorName: row["Vendor Name"] || "",
          billNo: row["Bill No."] || "",
          totalBillAmount: row["Total Bill Amount"] || "",
          // Make Payment step
          actual4: row["Actual 4"] || "",
          // Full Kitting step
          actual5: row["Actual 5"] || "",
        }));

        setRepairTasks(formattedTasks);
      } catch {
        toast.error("Error fetching tasks");
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchTasks();
  }, []);

  const handleKittingClick = (task) => {
    setSelectedTask(task);
    setFormData({
      kittingDoneBy: user?.name || "",
      kittingRemark: "",
      kittingDate: new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.kittingDoneBy.trim()) {
      toast.error("Kitting Done By is required");
      return;
    }
    setSubmitLoading(true);
    try {
      // ✅ FIXED: use update1 action with correct header name 'Actual 5'
      const payload = new URLSearchParams({
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,
        "Actual 5": formData.kittingDate,
        "Kitting Done By": formData.kittingDoneBy,
        "Kitting Remark": formData.kittingRemark,
      });
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload.toString(),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state optimistically
        const updated = repairTasks.map((t) =>
          t.taskNo === selectedTask.taskNo
            ? { ...t, actual5: formData.kittingDate }
            : t
        );
        setRepairTasks(updated);
        toast.success("Full Kitting marked successfully!");
        setIsModalOpen(false);
        setSelectedTask(null);
      } else {
        toast.error(data.message || "Failed to update");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Full Kitting</h2>
              <p className="text-sm text-gray-500 mt-0.5">Mark machines as fully kitted after payment</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-center px-4 py-2 bg-white border border-emerald-200 rounded-xl shadow-sm">
              <p className="text-xs text-gray-500 font-medium">Pending</p>
              <p className="text-lg font-bold text-emerald-600">{pendingTasks.length}</p>
            </div>
            <div className="text-center px-4 py-2 bg-white border border-teal-200 rounded-xl shadow-sm">
              <p className="text-xs text-gray-500 font-medium">Done</p>
              <p className="text-lg font-bold text-teal-600">{historyTasks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6">
        <nav className="flex space-x-6">
          {["pending", "history"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 capitalize ${
                activeTab === tab
                  ? "border-emerald-500 text-emerald-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "pending" ? `Pending (${displayedPending.length})` : `History (${displayedHistory.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Search & Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by task no, machine, serial, vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
          </div>
          <Button variant={showFilters ? "primary" : "secondary"} size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Firm</label>
              <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm">
                {uniqueFirms.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Department</label>
              <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm">
                {uniqueDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tables */}
      {loadingTasks ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="ml-3 text-gray-500 text-sm">Loading tasks...</span>
        </div>
      ) : activeTab === "pending" ? (
        <div className="overflow-auto max-h-[calc(100vh-340px)]">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap w-12">#</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Task No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Machine Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Serial No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Firm Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Department</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Vendor</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Bill No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Bill Image</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Payment Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Bill Amount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[100px]">Priority</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {displayedPending.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-16 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No pending kitting tasks found
                  </td>
                </tr>
              ) : (
                displayedPending.map((task, idx) => (
                  <tr key={task.taskNo} className="hover:bg-emerald-50/30 transition-colors duration-150">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 whitespace-nowrap">{task.taskNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.machineName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.serialNo || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.firmName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.department || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.vendorName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.billNo || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {task.billImage ? (
                        <button
                          type="button"
                          onClick={() => window.open(task.billImage, "_blank", "noopener,noreferrer")}
                          className="text-blue-600 underline text-xs hover:text-blue-800 font-medium"
                        >
                          View Bill
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No Bill</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.actual4 || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                      {task.totalBillAmount ? `₹${Number(task.totalBillAmount).toLocaleString("en-IN")}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        task.priority === "Critical" ? "bg-red-100 text-red-700" :
                        task.priority === "High" ? "bg-orange-100 text-orange-700" :
                        task.priority === "Medium" ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {task.priority || "Normal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-center">
                      <button
                        onClick={() => handleKittingClick(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors duration-150"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Done
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-340px)]">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap w-12">#</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">Task No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">Machine Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Serial No</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Firm Name</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Department</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Vendor</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Payment Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">Bill Image</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">Kitting Date</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">Kitting Done By</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[180px]">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {displayedHistory.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-16 text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No kitting history found
                  </td>
                </tr>
              ) : (
                displayedHistory.map((task, idx) => (
                  <tr key={task.taskNo} className="hover:bg-teal-50/30 transition-colors duration-150">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-teal-700 whitespace-nowrap">{task.taskNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.machineName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.serialNo || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.firmName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.department || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.vendorName || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.actual4 || "-"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {task.billImage ? (
                        <button
                          type="button"
                          onClick={() => window.open(task.billImage, "_blank", "noopener,noreferrer")}
                          className="text-blue-600 underline text-xs hover:text-blue-800 font-medium"
                        >
                          View Bill
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No Bill</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                        {task.actual5 || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.fullKittingDoneBy || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{task.fullKittingRemark || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTask(null); }} title="Mark Full Kitting Done">
        {selectedTask && (
          <div className="space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Task No</span>
                <span className="font-semibold text-emerald-700">{selectedTask.taskNo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Machine</span>
                <span className="font-medium">{selectedTask.machineName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Vendor</span>
                <span className="font-medium">{selectedTask.vendorName || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Payment Date</span>
                <span className="font-medium">{selectedTask.actual4 || "-"}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Kitting Date <span className="text-red-500">*</span></label>
              <input type="date" value={formData.kittingDate} onChange={(e) => setFormData((prev) => ({ ...prev, kittingDate: e.target.value }))} className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Kitting Done By <span className="text-red-500">*</span></label>
              <input type="text" value={formData.kittingDoneBy} onChange={(e) => setFormData((prev) => ({ ...prev, kittingDoneBy: e.target.value }))} placeholder="Enter name" className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Remark (Optional)</label>
              <textarea value={formData.kittingRemark} onChange={(e) => setFormData((prev) => ({ ...prev, kittingRemark: e.target.value }))} placeholder="Any remarks..." rows={3} className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setIsModalOpen(false); setSelectedTask(null); }}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit} disabled={submitLoading}>
                {submitLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving...</span>
                ) : (
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Mark as Done</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FullKitting;
