import React, { useEffect, useState } from "react";
import { CommonTasksRow } from "../ui/CommonTasksRow";
import { buildCommonItems } from "../../utils/commonTasks";
import { cachedFetch } from "../../services/sheetCache";
import { Search, Filter, ClipboardCheck, CheckCircle2, ExternalLink, Layers, X } from "lucide-react";
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
import { fetchAdvancePayments, updateAdvancePayment, getTodayIST, getNowIST, isAdvanceRow } from "../../services/advancePaymentService";
import { uploadFileToSupabase } from "../../services/storageService";
import { openDrivePreview } from "../../utils/driveUtils";
import { usesDirectStoreInFlow } from "../../utils/firmFlow";
import { notifyPendingCountsChanged } from "../../utils/pendingCountEvents";
import { PlannedActualHeads, PlannedActualCells } from "../ui/PlannedActualCells";

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
  const [selectedCommonTasks, setSelectedCommonTasks] = useState([]);
  const [commonSearchTerm, setCommonSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    remark: "",
    billReceived: "no",
    billNo: "",
    typeOfBill: "",
    totalBillAmount: "",
    billImage: null,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  // Common bill wali entry par click karne se usi row ke neeche detail slide hokar khulti hai.
  const [expandedCommon, setExpandedCommon] = useState({});
  const commonKey = (task) => `${activeTab}-${task.taskNo || task.repairTaskNo}`;
  const handleViewCommonTasks = (task) =>
    setExpandedCommon((prev) => ({ ...prev, [commonKey(task)]: !prev[commonKey(task)] }));
  // Combined entry me row par kahin bhi click karne se detail khulti/band hoti hai
  // (button, link, input par click ko chhodkar).
  const handleRowClick = (e, task) => {
    if (!task.commonTasksLinked?.length) return;
    if (e.target.closest("button, a, input, select, textarea, label")) return;
    handleViewCommonTasks(task);
  };
  const rowProps = (task) => ({
    onClick: (e) => handleRowClick(e, task),
    style: task.commonTasksLinked?.length > 0 ? { cursor: "pointer" } : undefined,
  });
  const findCommonTask = (tNo) => tasks.find((t) => t.taskNo === tNo);

  const uniqueFirms = [
    "All",
    ...new Set(tasks.map((t) => t.firmName).filter((firm) => firm && firm !== "All")),
  ];
  const uniqueDepartments = [
    "All",
    ...new Set(tasks.map((t) => t.department).filter((department) => department && department !== "All")),
  ];

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
      billReceived: "no",
      billNo: "",
      typeOfBill: "",
      totalBillAmount: "",
      billImage: null,
    });
    setSelectedCommonTasks([]);
    setCommonSearchTerm("");
    setIsModalOpen(true);
  };

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const uploadFile = async (file, prefix = "posting_bill") => {
    if (!file) return "";
    try {
      const url = await uploadFileToSupabase(file, prefix);
      return url;
    } catch (err) {
      console.error("Supabase Storage error:", err);
      toast.error(err.message || "❌ Bill image upload failed");
      return "";
    }
  };

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
        const res = await cachedFetch(url);
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

      // Start the Advance sheet request in parallel with the Repair System one
      const advancePromise = fetchAdvancePayments(user?.firmName);
      advancePromise.catch(() => {});

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
          paymentType: row["Payment Type"] || row["Approved Payment Term"] || (isAdvanceRow(row) ? "Advance" : "Credit"),
          isAdvancePayment: isAdvanceRow(row),
          actual1: row["Actual 1"] || "",
          actual2: row["Actual 2"] || "",
          actual3: row["Actual 3"] || "",
          billNo: row["Bill No."] || "",
          typeOfBill: row["Type of Bill"] || "",
          billImage: row["Bill Image"] || "",
          totalBillAmount: row["Total Bill Amount"] || "",
          transportationCharges: row["Transportation Charges"] || "",
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
        const parent = group.find(
          (t) =>
            (t.typeOfBill || "").toLowerCase().trim() === "independent" ||
            parseFloat((t.totalBillAmount || "0").toString().replace(/[^0-9.-]+/g, "")) > 0
        ) || group[0];
        const isChild = parent?.taskNo !== task.taskNo;
        return { ...task, isChildTask: isChild };
      });

      setTasks(tasksWithParentFlag);

      // Normal pending: Check Machine done (Actual 2) + Posting not done - hide child tasks
      const normalPending = tasksWithParentFlag.filter(
        (t) =>
          !usesDirectStoreInFlow(t.firmName) &&
          t.actual2 &&
          !t.actualPosting &&
          !t.isChildTask
      );
      // Normal history: Posting done - hide child tasks
      const normalHistory = tasksWithParentFlag.filter(
        (t) => t.actualPosting && !t.isChildTask
      );

      // ── Advance tasks from Repair FMS Advance Payment sheet ──────────────
      // Step 2 for Advance: Management Approval Date filled + Actual Posting empty
      let advPending = [];
      let advHistory = [];
      let advWithParentFlag = [];
      try {
        const firmFiltered = await advancePromise;

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
          (t) =>
            !usesDirectStoreInFlow(t.firmName) &&
            t.managementApprovalDate &&
            !t.actualPosting &&
            !t.isChildTask
        );
        advHistory = advWithParentFlag.filter(
          (t) => t.managementApprovalDate && t.actualPosting && !t.isChildTask
        );
      } catch (advErr) {
        console.warn("Could not fetch advance tasks for posting:", advErr);
      }


      // Merge both lists
      // Advance tasks already moved to the Advance sheet continue from there,
      // so hide them from the normal (Repair System) lists.
      const advTaskNos = new Set(advWithParentFlag.map((t) => (t.taskNo || "").trim()));
      const inNormalFlow = (t) => !(t.isAdvancePayment && advTaskNos.has((t.taskNo || "").trim()));

      setPendingTasks([...normalPending.filter(inNormalFlow), ...advPending]);
      setHistoryTasks([...normalHistory.filter(inNormalFlow), ...advHistory]);

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

    const billReceivedNow = selectedTask.isAdvance && formData.billReceived === "yes";
    if (billReceivedNow) {
      if (!formData.billNo.trim() || !formData.typeOfBill || !formData.totalBillAmount || !formData.billImage) {
        toast.error("Please fill all bill details (Bill No, Type of Bill, Total Bill Amount, Bill Image)");
        return;
      }
    }

    try {
      setSubmitLoading(true);
      const todayIST = getTodayIST();

      if (selectedTask.isAdvance) {
        // ── ADVANCE: Update "Repair FMS Advance Payment" sheet ─────────────
        let billImageUrl = "";
        if (billReceivedNow && formData.billImage) {
          billImageUrl = await uploadFile(formData.billImage, "advance_posting_bill");
        }

        const advanceFields = {
          "Actual Posting": todayIST,
          "Process Remark": formData.remark.trim(),
        };
        if (billReceivedNow) {
          advanceFields["Bill No."] = formData.billNo.trim();
          advanceFields["Type of Bill"] = formData.typeOfBill;
          advanceFields["Total Bill Amount"] = formData.totalBillAmount;
          advanceFields["Bill Image Link"] = billImageUrl || "";
          advanceFields["Bill Date"] = todayIST;
        }

        // Child tasks share the same Bill No. but their own portion is 0 and
        // their Type of Bill becomes "Common" — matching Check Machine's
        // normal-flow convention. Downstream pages group them automatically
        // by matching Firm Name + Bill No., no extra link column needed.
        const childFields = billReceivedNow
          ? { ...advanceFields, "Type of Bill": "Common", "Total Bill Amount": "0" }
          : advanceFields;

        const existingLinked = selectedTask.commonTasksLinked || [];
        const newlyLinked = billReceivedNow ? selectedCommonTasks : [];
        const childTaskNos = Array.from(new Set([...existingLinked, ...newlyLinked]));

        const updateResults = await Promise.allSettled([
          updateAdvancePayment(selectedTask.taskNo, advanceFields),
          ...childTaskNos.map((tNo) => updateAdvancePayment(tNo, childFields)),
        ]);
        const anySuccess = updateResults.some((r) => r.status === "fulfilled" && r.value?.success);
        if (anySuccess) {
          if (childTaskNos.length > 0) {
            toast.success(`✅ Advance posting processed! ${childTaskNos.length} common bill(s) also updated.`);
          } else {
            toast.success("✅ Advance posting processed successfully");
          }
          notifyPendingCountsChanged();
          setIsModalOpen(false);
          await fetchAllTasks(true);
        } else {
          toast.error("❌ Failed to process advance posting");
        }
      } else {
        // ── NORMAL: Update "Repair System" sheet for main task AND all linked tasks ──
        const tasksToUpdate = [selectedTask.taskNo, ...(selectedTask.commonTasksLinked || [])];
        await Promise.allSettled(
          tasksToUpdate.map((tNo) => {
            const payload = {
              action: "update1",
              sheetName: "Repair System",
              taskNo: tNo,
              "Actual Posting": todayIST,
              "Process Remark": formData.remark.trim(),
              "Remark": formData.remark.trim(),
            };
            return fetch(SCRIPT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams(payload).toString(),
            });
          })
        );
        const commonCount = selectedTask?.commonTasksLinked?.length || 0;
        if (commonCount > 0) {
          toast.success(`✅ Processed for payment! ${commonCount} common bill(s) also updated.`);
        } else {
          toast.success("✅ Processed for payment successfully");
        }
        notifyPendingCountsChanged();
        setIsModalOpen(false);
        await fetchAllTasks(true);
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
                <TableHead className="min-w-[120px] whitespace-nowrap">Task Number</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Machine Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Serial No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Firm Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Department</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Vendor Name</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Payment Type</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Bill No / Advance Amt</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Total Bill Amount</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Transportation Charges</TableHead>
                <PlannedActualHeads />
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-gray-500">
                      No pending posting tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPendingTasks.map((task) => (
                    <React.Fragment key={task.id || task.taskNo}>
                      <TableRow {...rowProps(task)} className={`hover:bg-gray-50 transition-colors ${task.isAdvance ? "bg-orange-50/40" : ""}`}>
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
                        <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span>{task.taskNo || "-"}</span>
                            {task.commonTasksLinked?.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleViewCommonTasks(task)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 w-fit cursor-pointer transition-colors"
                                title="Click to view linked common tasks"
                              >
                                🔗 {task.commonTasksLinked.length} Common
                              </button>
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
                        <TableCell className="whitespace-nowrap">{task.paymentType || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {task.isAdvance
                            ? (task.toBePaidAmount ? `₹${Number(task.toBePaidAmount).toLocaleString()}` : "-")
                            : (task.billNo || "-")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-gray-900">
                          {formatCurrency(getDisplayTotalAmount(task))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {task.transportationCharges
                            ? `₹${Number(task.transportationCharges).toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <PlannedActualCells planned={task.plannedPosting} actual={task.actualPosting} />
                      </TableRow>
                      {expandedCommon[commonKey(task)] && task.commonTasksLinked?.length > 0 && (
                        <CommonTasksRow colSpan={13} parent={task} items={buildCommonItems(task, findCommonTask)} />
                      )}
                    </React.Fragment>
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
                <TableHead className="min-w-[120px] whitespace-nowrap">Payment Type</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Bill No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Total Bill Amount</TableHead>
                <TableHead className="min-w-[110px] whitespace-nowrap">Bill Image</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Transportation Charges</TableHead>
                <TableHead className="min-w-[100px] text-center whitespace-nowrap">Delay</TableHead>
                <TableHead className="min-w-[160px] whitespace-nowrap">Process Remark</TableHead>
                <PlannedActualHeads />
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12 text-gray-500">
                      No history posting tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistoryTasks.map((task) => (
                    <React.Fragment key={task.id || task.taskNo}>
                      <TableRow {...rowProps(task)} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span>{task.taskNo || "-"}</span>
                            {task.commonTasksLinked?.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleViewCommonTasks(task)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 w-fit cursor-pointer transition-colors"
                                title="Click to view linked common tasks"
                              >
                                🔗 {task.commonTasksLinked.length} Common
                              </button>
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
                        <TableCell className="whitespace-nowrap">{task.paymentType || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{task.billNo || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-gray-900">
                          {formatCurrency(getDisplayTotalAmount(task))}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {(() => {
                            const url = task.isAdvance ? task.billImageLink : task.billImage;
                            return url ? (
                              <button
                                type="button"
                                onClick={() => openDrivePreview(url)}
                                className="text-blue-600 underline text-sm hover:text-blue-800 font-medium"
                              >
                                View Bill
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">No Bill</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {task.transportationCharges
                            ? `₹${Number(task.transportationCharges).toLocaleString()}`
                            : "-"}
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
                        <PlannedActualCells planned={task.plannedPosting} actual={task.actualPosting} />
                      </TableRow>
                      {expandedCommon[commonKey(task)] && task.commonTasksLinked?.length > 0 && (
                        <CommonTasksRow colSpan={15} parent={task} items={buildCommonItems(task, findCommonTask)} />
                      )}
                    </React.Fragment>
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
            <p>
              <strong className="text-gray-700">Transportation Charges:</strong>{" "}
              {selectedTask?.transportationCharges
                ? `₹${Number(selectedTask.transportationCharges).toLocaleString()}`
                : "-"}
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

          {/* Advance-only: Bill Received toggle + bill detail fields */}
          {selectedTask?.isAdvance && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3.5 space-y-3">
              <label className="block text-sm font-semibold text-gray-800">
                Bill Received? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="billReceived"
                    value="no"
                    checked={formData.billReceived === "no"}
                    onChange={() => setFormData((prev) => ({ ...prev, billReceived: "no" }))}
                  />
                  No — will add at Check Machine step
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="billReceived"
                    value="yes"
                    checked={formData.billReceived === "yes"}
                    onChange={() => setFormData((prev) => ({ ...prev, billReceived: "yes" }))}
                  />
                  Yes — enter bill details now
                </label>
              </div>

              {formData.billReceived === "yes" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Bill No. <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.billNo}
                      onChange={(e) => setFormData((prev) => ({ ...prev, billNo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Type of Bill <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.typeOfBill}
                      onChange={(e) => setFormData((prev) => ({ ...prev, typeOfBill: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Bill Type</option>
                      <option value="Common">Common</option>
                      <option value="Independent">Independent</option>
                    </select>
                  </div>

                  {/* Independent bill: let it also cover other pending advance tasks */}
                  {formData.typeOfBill && formData.typeOfBill.toLowerCase() === "independent" && (
                    <div className="col-span-1 md:col-span-2 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            For Common Bill (Link Pending Advance Tasks)
                          </label>
                          <p className="text-xs text-gray-500">
                            Select other pending advance machines covered under this same bill:
                          </p>
                        </div>
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-0.5 rounded-full">
                          {selectedCommonTasks.length} selected
                        </span>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search pending task no, machine name..."
                          value={commonSearchTerm}
                          onChange={(e) => setCommonSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {(() => {
                        const availablePending = pendingTasks
                          .filter((t) => t.isAdvance && t.taskNo !== selectedTask?.taskNo)
                          .filter((t) => {
                            if (!commonSearchTerm) return true;
                            const term = commonSearchTerm.toLowerCase();
                            return (
                              (t.taskNo || "").toLowerCase().includes(term) ||
                              (t.machineName || "").toLowerCase().includes(term) ||
                              (t.vendorName || "").toLowerCase().includes(term)
                            );
                          });

                        if (availablePending.length === 0) {
                          return (
                            <div className="p-3 bg-white rounded border border-dashed border-gray-300 text-center text-xs text-gray-500">
                              {commonSearchTerm ? "No matching pending tasks found" : "No other pending advance tasks available to link"}
                            </div>
                          );
                        }

                        return (
                          <div className="max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-md divide-y divide-gray-100">
                            {availablePending.map((t) => {
                              const isChecked = selectedCommonTasks.includes(t.taskNo);
                              return (
                                <div
                                  key={t.taskNo}
                                  onClick={() =>
                                    setSelectedCommonTasks((prev) =>
                                      isChecked ? prev.filter((no) => no !== t.taskNo) : [...prev, t.taskNo]
                                    )
                                  }
                                  className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors ${isChecked ? "bg-indigo-50/80 font-medium" : "hover:bg-gray-50"}`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <div className="min-w-0">
                                      <span className="font-bold text-blue-600 block">{t.taskNo}</span>
                                      <span className="text-gray-800 truncate block font-medium" title={t.machineName}>
                                        {t.machineName}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0 text-gray-500 text-[11px] ml-2">
                                    <span>{t.vendorName || "-"}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {selectedCommonTasks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {selectedCommonTasks.map((tNo) => (
                            <span key={tNo} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-semibold">
                              {tNo}
                              <button
                                type="button"
                                onClick={() => setSelectedCommonTasks((prev) => prev.filter((no) => no !== tNo))}
                                className="hover:text-red-600 ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Total Bill Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.totalBillAmount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, totalBillAmount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Bill Image <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => setFormData((prev) => ({ ...prev, billImage: e.target.files[0] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
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
