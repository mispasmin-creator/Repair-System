import React, { useEffect, useState } from "react";
import {
  Search,
  CheckSquare,
  Send,
  ShieldCheck,
  CheckCircle2,
  FileText,
  CreditCard,
  PackageCheck,
  Calculator,
  Layers,
  ArrowRight,
} from "lucide-react";
import Button from "../ui/Button";
import { PlannedActualHeads, PlannedActualCells } from "../ui/PlannedActualCells";
import Modal from "../ui/Modal";
import { useAuth } from "../../context/AuthContext";
import { fetchRepairTasks as fetchRepairTasksSvc } from "../../services/repairService";
import { fetchAdvancePaymentsFromSupabase } from "../../services/supabaseRepairService";
import { openDrivePreview } from "../../utils/driveUtils";

// Steps in Accounts workflow
const STEPS = [
  {
    key: "audit",
    label: "Audit Data",
    plannedKey: "Accounts Planned 1",
    actualKey: "Accounts Actual 1",
    delayKey: "Accounts Delay 1",
    statusKey: "Accounts Status 1",
    remarksKey: "Accounts Remarks 1",
    actualHeader: "Actual 1",
    statusHeader: "Status 1",
    remarksHeader: "Remarks1",
  },
  {
    key: "rectify",
    label: "Rectify the Mistake",
    plannedKey: "Accounts Planned 2",
    actualKey: "Accounts Actual 2",
    delayKey: "Accounts Delay 2",
    statusKey: "Accounts Status 2",
    remarksKey: "Accounts Remarks 2",
    actualHeader: "Actual 2",
    statusHeader: "Status 2",
    remarksHeader: "Remarks 2",
  },
  {
    key: "reaudit",
    label: "Reaudit Data",
    plannedKey: "Accounts Planned 3",
    actualKey: "Accounts Actual 3",
    delayKey: "Accounts Delay 3",
    statusKey: "Accounts Status 3",
    remarksKey: "Accounts Remarks 3",
    actualHeader: "Actual 3",
    statusHeader: "Status 3",
    remarksHeader: "Remarks 3",
  },
  {
    key: "tally",
    label: "Take Entry By Tally",
    plannedKey: "Accounts Planned 4",
    actualKey: "Accounts Actual 4",
    delayKey: "Accounts Delay 4",
    statusKey: "Accounts Status 4",
    remarksKey: "Accounts Remarks 4",
    actualHeader: "Actual 4",
    statusHeader: "Status 4",
    remarksHeader: "Remarks 4",
  },
  {
    key: "completed",
    label: "Completed",
    plannedKey: "Accounts Planned 4",
    actualKey: "Accounts Actual 4",
    delayKey: "Accounts Delay 4",
    statusKey: "Accounts Status 4",
    remarksKey: "Accounts Remarks 4",
    actualHeader: "Actual 4",
    statusHeader: "Status 4",
    remarksHeader: "Remarks 4",
    isReadOnly: true,
  },
];

const Accounts = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(STEPS[0].key);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFirm, setSelectedFirm] = useState("All");

  const [pipelineStats, setPipelineStats] = useState({
    sentPending: 0,
    mgmtPending: 0,
    checkPending: 0,
    postingPending: 0,
    paymentPending: 0,
    storeInPending: 0,
    accountsPending: 0,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [formData, setFormData] = useState({ status: "", remarks: "" });

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

  const activeStep = STEPS.find((s) => s.key === activeTab);

  // Compute pending counts for all 7 pipeline stages
  const computePipelineStats = (allRawTasks, advList = []) => {
    const isAdv = (t) =>
      (t["Payment Type"] || t["Vendor 1 Payment Type"] || "").toLowerCase() === "advance";

    // 1. Sent to Vendor: Planned 1 present, Actual 1 empty
    const sentPending = allRawTasks.filter((t) => t["Planned 1"] && !t["Actual 1"]).length;

    // 2. Management Approval: Actual 1 done, Mgmt Approval Date empty
    const mgmtPending = allRawTasks.filter(
      (t) => t["Actual 1"] && !t["Management Approval Date"]
    ).length;

    // 3. Check Machine:
    // Normal: Mgmt approval done, Check Machine empty
    // Advance: Advance payment done (Actual 4), Check Machine empty
    const checkPending = allRawTasks.filter((t) => {
      if (isAdv(t)) {
        return Boolean(t["Actual 4"]) && !t["Actual 2"];
      }
      return Boolean(t["Management Approval Date"]) && !t["Actual 2"];
    }).length;

    // 4. Process for Payment (Posting):
    // Normal: Check Machine done (Actual 2), Posting empty
    // Advance: Mgmt approval done, Posting empty
    const postingPending = allRawTasks.filter((t) => {
      if (isAdv(t)) {
        return Boolean(t["Management Approval Date"]) && !t["Actual Posting"];
      }
      return Boolean(t["Actual 2"]) && !t["Actual Posting"];
    }).length;

    // 5. Make Payment:
    // Normal: Posting done (Actual Posting), Payment empty (Actual 4)
    // Advance: Pending advance records in repair_advance
    const normalPaymentPending = allRawTasks.filter(
      (t) => !isAdv(t) && Boolean(t["Actual Posting"]) && !t["Actual 4"]
    ).length;
    const advPaymentPending = (advList || []).filter((a) => {
      const isPaid = Boolean(
        a.utr_no || a.payment_utr_no || (a.status && a.status.toLowerCase() === "approved")
      );
      return !isPaid;
    }).length;
    const paymentPending = normalPaymentPending + advPaymentPending;

    // 6. Store In:
    // Normal: Payment done (Actual 4), Store In empty (Actual 3)
    // Advance: Check Machine done (Actual 2), Store In empty (Actual 3)
    const storeInPending = allRawTasks.filter((t) => {
      if (isAdv(t)) {
        return Boolean(t["Actual 2"]) && !t["Actual 3"];
      }
      return Boolean(t["Actual 4"]) && !t["Actual 3"];
    }).length;

    // 7. Accounts:
    // Store In completed (Actual 3), Accounts Tally (Accounts Actual 4) empty
    const accountsPending = allRawTasks.filter(
      (t) => Boolean(t["Actual 3"]) && !t["Accounts Actual 4"]
    ).length;

    return {
      sentPending,
      mgmtPending,
      checkPending,
      postingPending,
      paymentPending,
      storeInPending,
      accountsPending,
    };
  };

  const fetchAllTasks = async () => {
    try {
      setLoadingTasks(true);

      const [rawTasks, advList] = await Promise.all([
        fetchRepairTasksSvc(user?.firmName),
        fetchAdvancePaymentsFromSupabase(user?.firmName).catch(() => []),
      ]);

      // Calculate pipeline stage pending counts
      const stats = computePipelineStats(rawTasks, advList);
      setPipelineStats(stats);

      // Rule: In Accounts page, ONLY entries that have completed Store In are shown!
      const storeInDoneTasks = rawTasks.filter((t) => Boolean(t["Actual 3"]));

      const formatted = storeInDoneTasks.map((t) => {
        const steps = {
          audit: {
            planned: t["Accounts Planned 1"] || t["Actual 3"],
            actual: t["Accounts Actual 1"] || "",
            status: t["Accounts Status 1"] || "",
            remarks: t["Accounts Remarks 1"] || "",
          },
          rectify: {
            planned: t["Accounts Planned 2"] || "",
            actual: t["Accounts Actual 2"] || "",
            status: t["Accounts Status 2"] || "",
            remarks: t["Accounts Remarks 2"] || "",
          },
          reaudit: {
            planned: t["Accounts Planned 3"] || "",
            actual: t["Accounts Actual 3"] || "",
            status: t["Accounts Status 3"] || "",
            remarks: t["Accounts Remarks 3"] || "",
          },
          tally: {
            planned: t["Accounts Planned 4"] || "",
            actual: t["Accounts Actual 4"] || "",
            status: t["Accounts Status 4"] || "",
            remarks: t["Accounts Remarks 4"] || "",
          },
          completed: {
            planned: t["Accounts Planned 4"] || "",
            actual: t["Accounts Actual 4"] || "",
            status: t["Accounts Status 4"] || "",
            remarks: t["Accounts Remarks 4"] || "",
          },
        };

        return {
          taskNo: t["Task No"] || t.taskNo,
          firmName: t["Firm Name"] || t.firmName,
          serialNo: t["Serial No"] || t.serialNo,
          machineName: t["Machine Name"] || t.machineName,
          machinePartName: t["Machine Part Name"] || t.machinePartName,
          department: t["Department"] || t.department,
          location: t["Location"] || t.location,
          vendorName: t["Vendor Name"] || t.vendorName,
          transportationCharges: t["Transportation Charges"],
          weighmentSlip: t["Weighment Slip"],
          transportingImage: t["Transporting Image With Machine"],
          paymentType: t["Payment Type"] || t["Vendor 1 Payment Type"],
          howMuch: t["How Much"],
          transporterName: t["(Transporter Name)"] || t["Transporter Name"],
          transportationAmount: t["Transportation Amount"],
          billImage: t["Bill Image"],
          billNo: t["Bill No."] || t["Bill No"],
          typeOfBill: t["Type of Bill"],
          totalBillAmount: t["Total Bill Amount"],
          toBePaidAmount: t["To Be Paid Amount"],
          actualStoreIn: t["Actual 3"],
          steps,
        };
      });

      setTasks(formatted);
    } catch (err) {
      console.error("Error fetching Accounts data:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, [user?.firmName]);

  const uniqueFirms = [
    "All",
    ...new Set(tasks.map((t) => t.firmName).filter((f) => f && f !== "All")),
  ];
  const firmTasks = tasks.filter(
    (t) => selectedFirm === "All" || t.firmName === selectedFirm
  );

  // Tab count helper
  const getTabCount = (stepKey) => {
    return firmTasks.filter((task) => {
      if (stepKey === "completed") {
        return Boolean(task.steps.tally?.actual);
      }
      if (stepKey === "tally") {
        return Boolean(task.steps.tally?.planned) && !task.steps.tally?.actual;
      }
      return Boolean(task.steps[stepKey]?.planned) && !task.steps[stepKey]?.actual;
    }).length;
  };

  const filteredTasks = firmTasks.filter((task) => {
    // Completed tab: show entries where Tally (Actual 4) is filled
    if (activeTab === "completed") {
      if (!task.steps.tally?.actual) return false;
    } else {
      // Step tab: row's Planned date must exist, and its Actual date must be empty
      if (!task.steps[activeStep.key]?.planned) return false;
      if (task.steps[activeStep.key]?.actual) return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (task.taskNo || "").toLowerCase().includes(term) ||
      (task.machineName || "").toLowerCase().includes(term) ||
      (task.serialNo || "").toLowerCase().includes(term) ||
      (task.department || "").toLowerCase().includes(term) ||
      (task.firmName || "").toLowerCase().includes(term) ||
      (task.vendorName || "").toLowerCase().includes(term) ||
      (task.billNo || "").toLowerCase().includes(term)
    );
  });

  const handleUpdateClick = (task) => {
    setSelectedTask(task);
    setFormData({
      status: task.steps[activeStep.key]?.status || (activeTab === "audit" ? "Done" : "Done"),
      remarks: task.steps[activeStep.key]?.remarks || "",
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

  // Pipeline stage cards definition
  const pipelineStages = [
    {
      id: "sent",
      step: "Step 1",
      name: "Sent to Vendor",
      count: pipelineStats.sentPending,
      icon: Send,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-800",
    },
    {
      id: "mgmt",
      step: "Step 2",
      name: "Mgmt Approval",
      count: pipelineStats.mgmtPending,
      icon: ShieldCheck,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200",
      badge: "bg-purple-100 text-purple-800",
    },
    {
      id: "check",
      step: "Step 3",
      name: "Check Machine",
      count: pipelineStats.checkPending,
      icon: CheckCircle2,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      badge: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "posting",
      step: "Step 4",
      name: "Process Payment",
      count: pipelineStats.postingPending,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-100 text-blue-800",
    },
    {
      id: "payment",
      step: "Step 5",
      name: "Make Payment",
      count: pipelineStats.paymentPending,
      icon: CreditCard,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      badge: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "store_in",
      step: "Step 6",
      name: "Store In",
      count: pipelineStats.storeInPending,
      icon: PackageCheck,
      color: "text-teal-600",
      bg: "bg-teal-50",
      border: "border-teal-200",
      badge: "bg-teal-100 text-teal-800",
    },
    {
      id: "accounts",
      step: "Step 7",
      name: "Accounts / Tally",
      count: pipelineStats.accountsPending,
      icon: Calculator,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200",
      badge: "bg-rose-100 text-rose-800",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Entries are audited and posted to Tally after completing Store In
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Post-Store In Stage Active</span>
        </div>
      </div>

      {/* Accounts Main Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6 px-6 overflow-x-auto">
            {STEPS.map((step) => {
              const count = getTabCount(step.key);
              const isActive = activeTab === step.key;
              return (
                <button
                  key={step.key}
                  onClick={() => setActiveTab(step.key)}
                  className={`py-4 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-200 flex items-center gap-2 ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>{step.label}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Search */}
        <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by task no, machine, vendor, firm, bill no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              />
            </div>
            <select
              value={selectedFirm}
              onChange={(e) => setSelectedFirm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
            >
              {uniqueFirms.map((firm) => (
                <option key={firm} value={firm}>
                  {firm === "All" ? "All Firms" : firm}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(100vh-320px)]">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-gray-50 w-[110px] min-w-[110px] max-w-[110px] px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap text-center">
                  Action
                </th>
                <th className="sticky top-0 left-[110px] z-30 bg-gray-50 min-w-[120px] px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap border-r border-gray-200">
                  Task No
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">
                  Firm Name
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                  Serial No
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                  Machine Name
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">
                  Machine Part Name
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                  Department
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[110px]">
                  Location
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[140px]">
                  Vendor Name
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                  Payment Type
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">
                  Store In Date
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                  Bill No.
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[130px]">
                  Type of Bill
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">
                  Total Bill Amount
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[150px]">
                  To Be Paid Amount
                </th>
                <th className="px-4 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                  Bill Image
                </th>
                <PlannedActualHeads raw />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loadingTasks ? (
                <tr>
                  <td colSpan={18} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="mt-3 text-sm text-gray-500 font-medium">Loading accounts tasks...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={18} className="text-center py-12 text-gray-500">
                    No tasks found in this tab
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, idx) => {
                  const step = task.steps[activeStep.key] || {};
                  return (
                    <tr
                      key={task.taskNo || idx}
                      className="hover:bg-blue-50/40 transition-colors duration-150"
                    >
                      <td className="sticky left-0 z-10 bg-white w-[110px] min-w-[110px] max-w-[110px] px-4 py-3 text-sm whitespace-nowrap text-center">
                        {activeTab === "completed" ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">
                            ✓ Done
                          </span>
                        ) : (
                          <button
                            onClick={() => handleUpdateClick(task)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            Update
                          </button>
                        )}
                      </td>
                      <td className="sticky left-[110px] z-10 bg-white min-w-[120px] px-4 py-3 text-sm font-semibold text-blue-600 whitespace-nowrap border-r border-gray-200">
                        {task.taskNo || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.firmName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {task.serialNo || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {task.machineName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {task.machinePartName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.department || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.location || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.vendorName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.paymentType || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-emerald-700 font-medium whitespace-nowrap">
                        {task.actualStoreIn || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.billNo || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {task.typeOfBill || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap font-medium">
                        {task.totalBillAmount
                          ? `₹${Number(task.totalBillAmount).toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 whitespace-nowrap">
                        {task.toBePaidAmount
                          ? `₹${Number(task.toBePaidAmount).toLocaleString()}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {task.billImage ? (
                          <button
                            type="button"
                            onClick={() => openDrivePreview(task.billImage)}
                            className="text-blue-600 underline text-xs hover:text-blue-800 font-medium"
                          >
                            View Bill
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No Bill</span>
                        )}
                      </td>
                      <PlannedActualCells raw planned={step.planned} actual={step.actual} />
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${activeStep?.label} — Update`}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Task Details */}
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm border border-gray-200">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Task No</p>
              <p className="text-gray-900 font-semibold mt-0.5">{selectedTask?.taskNo || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Firm Name</p>
              <p className="text-gray-800 mt-0.5">{selectedTask?.firmName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Machine Name</p>
              <p className="text-gray-800 mt-0.5">{selectedTask?.machineName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Store In Date</p>
              <p className="text-emerald-700 font-semibold mt-0.5">{selectedTask?.actualStoreIn || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Vendor Name</p>
              <p className="text-gray-800 mt-0.5">{selectedTask?.vendorName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bill No</p>
              <p className="text-gray-800 mt-0.5">{selectedTask?.billNo || "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Planned Date</p>
              <p className="text-blue-600 font-semibold mt-0.5">
                {selectedTask && activeStep
                  ? selectedTask.steps[activeStep.key]?.planned || "-"
                  : "-"}
              </p>
            </div>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-800"
            >
              <option value="">-- Select Status --</option>
              <option value="Done">Done (Approved)</option>
              {activeTab === "audit" && (
                <>
                  <option value="Not Done">Not Done</option>
                </>
              )}
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
              rows={3}
              placeholder="Add audit/tally remarks here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
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
