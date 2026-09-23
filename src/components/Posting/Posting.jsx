import React, { useEffect, useState } from "react";
import { Search, Filter, ClipboardCheck, Calendar, CheckCircle2, ExternalLink, Zap } from "lucide-react";
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
import toast from "react-hot-toast";
import { fetchRepairTasks as fetchRepairTasksSvc } from "../../services/repairService";
import { fetchAdvancePayments, updateAdvancePayment, getTodayIST, getNowIST } from "../../services/advancePaymentService";

const Posting = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    remark: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  const uniqueFirms = ["All", ...new Set(tasks.map((t) => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(tasks.map((t) => t.department).filter(Boolean))];

  const filterList = (list) => {
    return list
      .filter((task) => selectedFirm === "All" || task.firmName === selectedFirm)
      .filter((task) => selectedDepartment === "All" || task.department === selectedDepartment)
      .filter((task) => selectedPriority === "All" || (task.priority || "").toLowerCase() === selectedPriority.toLowerCase())
      .filter((task) =>
        (task.taskNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.machineName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.serialNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.vendorName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.billNo || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const filteredPendingTasks = filterList(pendingTasks);
  const filteredHistoryTasks = filterList(historyTasks);

  const handlePostingClick = (task) => {
    setSelectedTask(task);
    setFormData({
      remark: "",
    });
    setIsModalOpen(true);
  };

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;

  const formatDate = (val) => {
    if (!val) return "-";
    if (typeof val === "string" && val.includes("T")) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB");
      }
    }
    return val;
  };

  const formatCurrency = (amount) => {
    if (!amount) return "-";
    const cleaned = amount.toString().replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? amount : `₹${num.toLocaleString("en-IN")}`;
  };

  // For a task, returns the Total Bill Amount to display:
  // - Normal: its own "Total Bill Amount".
  // - Advance: sum of "To Be Paid Amount" across itself + all Firm Name + Bill No.
  //   matched linked tasks (commonTasksLinked), since advance amounts are split per task.
  const getDisplayTotalAmount = (task) => {
    if (!task) return null;
    if (!task.isAdvance) return task.totalBillAmount;

    // Check if totalBillAmount is populated for advance task
    const totalAmt = parseFloat((task.totalBillAmount || "0").toString().replace(/[^0-9.-]+/g, "")) || 0;
    const linkedTotal = (task.commonTasksLinked || []).reduce((sum, childNo) => {
      const childTask = tasks.find((t) => t.taskNo === childNo);
      const amt = parseFloat((childTask?.totalBillAmount || childTask?.toBePaidAmount || "0").toString().replace(/[^0-9.-]+/g, "")) || 0;
      return sum + amt;
    }, 0);
    const combinedTotal = totalAmt + linkedTotal;
    if (combinedTotal > 0) return combinedTotal;

    // Fallback to toBePaidAmount if totalBillAmount is not set
    const ownAmt = parseFloat((task.toBePaidAmount || "0").toString().replace(/[^0-9.-]+/g, "")) || 0;
    const linkedAmt = (task.commonTasksLinked || []).reduce((sum, childNo) => {
      const childTask = tasks.find((t) => t.taskNo === childNo);
      const amt = parseFloat((childTask?.toBePaidAmount || "0").toString().replace(/[^0-9.-]+/g, "")) || 0;
      return sum + amt;
    }, 0);
    const combined = ownAmt + linkedAmt;
    return combined > 0 ? combined : "";
  };

  const safeFetchJson = async (url, retries = 2, delayMs = 800) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (text.trim().startsWith("<")) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw new Error("Server returned HTML response");
        }
        return JSON.parse(text);
      } catch (err) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
  };

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      // ── Normal (Non-Advance) tasks from Repair System sheet ──────────────
      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => {
        return {
          id: `posting-task-${index}`,
          isAdvance: false,
          taskNo: row["Task No"] || "",
          firmName: row["Firm Name"] || "",
          serialNo: row["Serial No"] || "",
          machineName: row["Machine Name"] || "",
          machinePartName: row["Machine Part Name"] || "",
          doerName: row["Indentor Name"] || row["Doer Name"] || row["Authorized Name"] || "",
          nameOfIndenter: row["Indentor Name"] || row["Doer Name"] || row["Authorized Name"] || "",
          problem: row["Problem With Machine"] || row["Problem"] || "",
          priority: row["Priority"] || "",
          department: row["Department"] || "",
          location: row["Location"] || "",
          vendorName: row["Vendor Name"] || "",
          actual1: row["Actual 1"] || "",
          actual2: row["Actual 2"] || "",
          actual3: row["Actual 3"] || "",
          billNo: row["Bill No."] || "",
          typeOfBill: row["Type of Bill"] || "",
          totalBillAmount: row["Total Bill Amount"] || "",
          receivedQuantity: row["Received Quantity"] || "",
          plannedPosting: row["Planned Posting"] || "",
          actualPosting: row["Actual Posting"] || "",
          delayPosting: row["Delay Posting"] || "",
          processRemark: row["Process Remark"] || row["Remark"] || "",
        };
      });

      // Calculate common bills based on Bill No - tasks with same bill no are common
      const tasksWithCommonBills = formattedTasks.map((task) => {
        if (!task.billNo || task.billNo === "-") {
          return { ...task, commonTasksLinked: [], isChildTask: false };
        }
        const siblingTasks = formattedTasks.filter(
          (other) => other.billNo === task.billNo && other.taskNo !== task.taskNo
        );
        return {
          ...task,
          commonTasksLinked: siblingTasks.map((t) => t.taskNo),
        };
      });

      // Mark child tasks - only first task with each Bill No is parent, rest are children
      const billNoGroups = {};
      tasksWithCommonBills.forEach((task) => {
        if (task.billNo && task.billNo !== "-") {
          if (!billNoGroups[task.billNo]) {
            billNoGroups[task.billNo] = [];
          }
          billNoGroups[task.billNo].push(task);
        }
      });

      const tasksWithParentFlag = tasksWithCommonBills.map((task) => {
        if (!task.billNo || task.billNo === "-" || task.commonTasksLinked.length === 0) {
          return { ...task, isChildTask: false };
        }
        const group = billNoGroups[task.billNo] || [];
        const isChild = group[0]?.taskNo !== task.taskNo;
        return { ...task, isChildTask: isChild };
      });

      setTasks(tasksWithParentFlag);

      // Normal pending: Actual 3 filled + Posting not done - hide child tasks
      const normalPending = tasksWithParentFlag.filter(
        (t) => t.actual3 && !t.actualPosting && !t.isChildTask
      );
      // Normal history: Posting done - hide child tasks
      const normalHistory = tasksWithParentFlag.filter(
        (t) => t.actual3 && t.actualPosting && !t.isChildTask
      );

      // ── Advance tasks from Repair FMS Advance Payment sheet ──────────────
      // Step 2 for Advance: Management Approval Date filled + Actual Posting empty
      let advPending = [];
      let advHistory = [];
      let advWithParentFlag = [];
      try {
        const advanceTasks = await fetchAdvancePayments();
        // Filter by firm if user is not all-firm
        const userFirm = (user?.firmName || "").toLowerCase();
        const isAllFirm = !userFirm || userFirm === "all";
        const firmFiltered = isAllFirm
          ? advanceTasks
          : advanceTasks.filter((t) => (t.firmName || "").toLowerCase() === userFirm);

        // Mark child tasks for advance payments too (same logic as Normal tasks)
        // Grouped by Firm Name + Bill No. together so different firms with a
        // coincidentally-same Bill No. never get mixed into one group.
        advWithParentFlag = firmFiltered.map((task) => {
          if (!task.billNo || task.billNo === "-") {
            return { ...task, isChildTask: false, commonTasksLinked: [] };
          }
          const sameGroup = (other) =>
            other.billNo === task.billNo &&
            (other.firmName || "").toLowerCase().trim() === (task.firmName || "").toLowerCase().trim();
          const siblings = firmFiltered.filter(
            (other) => sameGroup(other) && other.taskNo !== task.taskNo
          );
          if (siblings.length === 0) {
            return { ...task, isChildTask: false, commonTasksLinked: [] };
          }
          const group = firmFiltered.filter(sameGroup);
          const isChild = group[0]?.taskNo !== task.taskNo;
          return {
            ...task,
            isChildTask: isChild,
            commonTasksLinked: isChild ? [] : siblings.map((t) => t.taskNo),
          };
        });

        advPending = advWithParentFlag.filter(
          (t) => t.managementApprovalDate && !t.actualPosting && !t.isChildTask
        );
        advHistory = advWithParentFlag.filter(
          (t) => t.managementApprovalDate && t.actualPosting && !t.isChildTask
        );
      } catch (advErr) {
        console.warn("Could not fetch advance tasks for posting:", advErr);
      }


      // Merge both lists
      setPendingTasks([...normalPending, ...advPending]);
      setHistoryTasks([...normalHistory, ...advHistory]);

      // Also merge advance tasks into `tasks` so the modal's common-task lookup
      // (tasks.find) can resolve linked advance child tasks' machine names.
      setTasks([...tasksWithParentFlag, ...advWithParentFlag]);

    } catch (err) {
      console.error("Error fetching tasks for posting:", err);
      toast.error("Failed to fetch posting tasks");
      setTasks([]);
      setPendingTasks([]);
      setHistoryTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedTask) return;

    if (!formData.remark.trim()) {
      toast.error("Please enter a process remark");
      return;
    }

    try {
      setSubmitLoading(true);
      const todayIST = getTodayIST();

      if (selectedTask.isAdvance) {
        // ── ADVANCE: Update "Repair FMS Advance Payment" sheet ─────────────
        const result = await updateAdvancePayment(selectedTask.taskNo, {
          "Actual Posting": todayIST,
          "Process Remark": formData.remark.trim(),
        });
        if (result.success) {
          toast.success("✅ Advance posting processed successfully");
          setIsModalOpen(false);
          await fetchAllTasks(true);
        } else {
          toast.error("❌ Failed: " + (result.message || "Unknown error"));
        }
      } else {
        // ── NORMAL: Update "Repair System" sheet ────────────────────────────
        const payload = {
          action: "update1",
          sheetName: "Repair System",
          taskNo: selectedTask.taskNo,
          "Actual Posting": todayIST,
          "Process Remark": formData.remark.trim(),
          "Remark": formData.remark.trim(),
        };
        const response = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(payload).toString(),
        });
        const result = await response.json();
        if (result.success) {
          toast.success("✅ Processed for payment successfully");
          setIsModalOpen(false);
          await fetchAllTasks(true);
        } else {
          toast.error("❌ Failed to process: " + (result.message || "Unknown error"));
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Network error while submitting posting");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Top Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ClipboardCheck className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Process for payment</h1>
              <p className="text-gray-600">Manage and confirm payment processing records</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              Pending ({filteredPendingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              History ({filteredHistoryTasks.length})
            </button>
          </nav>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks, machines, vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <Button
              variant={showFilters ? "primary" : "secondary"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchAllTasks()}
              disabled={loadingTasks}
            >
              {loadingTasks ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Firm Name</label>
                <select
                  value={selectedFirm}
                  onChange={(e) => setSelectedFirm(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  {uniqueFirms.map((firm) => (
                    <option key={firm} value={firm}>{firm}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* PENDING TABLE */}
        {activeTab === "pending" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[170px] text-center whitespace-nowrap">Action</TableHead>
                <TableHead className="min-w-[100px] whitespace-nowrap">Type</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Task Number</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Machine Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Serial No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Firm Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Department</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Vendor Name</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Bill No / Advance Amt</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Total Bill Amount</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Planned Posting</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-gray-500">
                      No pending posting tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPendingTasks.map((task) => (
                    <TableRow key={task.id || task.taskNo} className={`hover:bg-gray-50 transition-colors ${task.isAdvance ? "bg-orange-50/40" : ""}`}>
                      <TableCell className="text-center whitespace-nowrap">
                        <Button
                          size="sm"
                          onClick={() => handlePostingClick(task)}
                          className="flex items-center mx-auto"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                          Process
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {task.isAdvance ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                            <Zap className="w-3 h-3" /> ADVANCE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-100 text-blue-700">
                            NORMAL
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span>{task.taskNo || "-"}</span>
                          {task.commonTasksLinked?.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 border border-green-300 w-fit">
                              🔗 {task.commonTasksLinked.length} Common
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                        {task.machineName || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{task.serialNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.firmName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.department || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.vendorName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {task.isAdvance
                          ? (task.toBePaidAmount ? `₹${Number(task.toBePaidAmount).toLocaleString()}` : "-")
                          : (task.billNo || "-")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-gray-900">
                        {formatCurrency(getDisplayTotalAmount(task))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(task.plannedPosting)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* HISTORY TABLE */}
        {activeTab === "history" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[120px] whitespace-nowrap">Task Number</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Machine Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Serial No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Firm Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Department</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Vendor Name</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Bill No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Total Bill Amount</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Planned Posting</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Actual Posting</TableHead>
                <TableHead className="min-w-[100px] text-center whitespace-nowrap">Delay</TableHead>
                <TableHead className="min-w-[160px] whitespace-nowrap">Process Remark</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      No history posting tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistoryTasks.map((task) => (
                    <TableRow key={task.id || task.taskNo} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                        {task.taskNo || "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                        {task.machineName || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{task.serialNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.firmName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.department || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.vendorName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.billNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-gray-900">
                        {formatCurrency(getDisplayTotalAmount(task))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(task.plannedPosting)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {formatDate(task.actualPosting)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${task.delayPosting && parseInt(task.delayPosting) > 0
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                            }`}
                        >
                          {task.delayPosting || "0"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-gray-700">
                        {task.processRemark || task.remark || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Process for payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Confirm Process for Payment: ${selectedTask?.taskNo || ""}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-1.5 text-sm">
            <p><strong className="text-gray-700">Machine:</strong> {selectedTask?.machineName} ({selectedTask?.serialNo})</p>
            <p><strong className="text-gray-700">Vendor:</strong> {selectedTask?.vendorName || "-"}</p>
            <p><strong className="text-gray-700">Bill No:</strong> {selectedTask?.billNo || "-"}</p>
            <p>
              <strong className="text-gray-700">Total Amount:</strong>{" "}
              {formatCurrency(getDisplayTotalAmount(selectedTask))}
              {selectedTask?.commonTasksLinked?.length > 0 && (
                <span className="text-gray-500 font-normal"> (combined for {selectedTask.commonTasksLinked.length + 1} linked task(s))</span>
              )}
            </p>
            <p><strong className="text-gray-700">Planned Posting Date:</strong> {formatDate(selectedTask?.plannedPosting)}</p>
          </div>

          {/* Linked Common Tasks Panel */}
          {selectedTask?.commonTasksLinked?.length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-800 mb-2">
                🔗 {selectedTask.commonTasksLinked.length} linked task(s) will also be processed:
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 bg-white rounded border border-blue-200 px-2.5 py-1.5 text-xs">
                  <span className="font-bold text-blue-700 px-1.5 py-0.5 bg-blue-100 rounded-full">INDEPENDENT</span>
                  <span className="font-semibold text-blue-700">{selectedTask.taskNo}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-gray-600">{selectedTask.machineName}</span>
                </div>
                {selectedTask.commonTasksLinked.map((childNo) => {
                  const childTask = tasks.find((t) => t.taskNo === childNo);
                  return (
                    <div key={childNo} className="flex items-center gap-2 bg-white rounded border border-green-200 px-2.5 py-1.5 text-xs">
                      <span className="font-bold text-green-700 px-1.5 py-0.5 bg-green-100 rounded-full border border-green-300">COMMON</span>
                      <span className="font-semibold text-green-700">{childNo}</span>
                      <span className="text-gray-400">—</span>
                      <span className="text-gray-600">{childTask?.machineName || "-"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Process Remark <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Enter process remark..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitLoading ? "Submitting..." : "Confirm Process"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Posting;
