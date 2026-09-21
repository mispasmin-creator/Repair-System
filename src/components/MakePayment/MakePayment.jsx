import React, { useEffect, useState, useMemo } from "react";
import { Search, Filter, Package, ExternalLink, Zap } from "lucide-react";
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
import { fetchAdvancePayments, updateAdvancePayment, getTodayIST, getNowIST } from "../../services/advancePaymentService";

// Google Form URLs mapped by firm name
const FIRM_FORM_URLS = {
  pmmpl: "https://docs.google.com/forms/d/e/1FAIpQLScn8tHEUldlOM_8DKpHUfHHiRImDVjkpkhhfduaZUIxpxlJrA/viewform",
  purab: "https://docs.google.com/forms/d/e/1FAIpQLSdLWKfGPNXK62Orndb137GPKadFiRQZS8W_MM0c11HvdR4KkA/viewform",
  rkl: "https://docs.google.com/forms/d/e/1FAIpQLScJJFvh6zchRosSzX0mU-u7-oeMaQW6iv1osE70hRDoE-uVrg/viewform",
  refrasynth: "https://docs.google.com/forms/d/e/1FAIpQLSdHF5shP_liUbm1tsyOS3nrEmNUY9Y5zl4y2odXK0weaDjcpA/viewform",
  refratech: "https://docs.google.com/forms/d/e/1FAIpQLScTunRezHE3TKtNpXjISVWjnywDwUcT6F62DYtkLlgXL6MMaQ/viewform",
};

const MakePayment = () => {
  const { user } = useAuth();
  const {
    repairTasks,
    setRepairTasks,
    repairPayments,
    pendingRepairPayments,
    historyRepairPayments,
    setRepairPayments,
    setPendingRepairPayments,
    setHistoryRepairPayments,
    addRepairPayment
  } = useDataStore();
  
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");

  const handleOpenForm = (task) => {
    const firmKey = (task.firmName || "").toLowerCase().trim();
    const baseUrl = FIRM_FORM_URLS[firmKey] || FIRM_FORM_URLS.refrasynth;
    const taskNumber = task.taskNo || task.repairTaskNo || "";
    const description = task.problem || task.machineName || "";

    const params = new URLSearchParams({
      "usp": "pp_url",
      "entry.1200639812": taskNumber,
      "entry.604194301": "Repair FMS",
      "entry.1358288895": "Yes",
      "entry.1091308719": description,
    });

    window.open(`${baseUrl}?${params.toString()}`, "_blank");
  };
  const [selectedPaymentType, setSelectedPaymentType] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  const taskMap = useMemo(() => new Map(repairTasks.map(t => [t.taskNo, t])), [repairTasks]);

  const historyWithFirm = useMemo(() => {
    return historyRepairPayments.map(payment => {
      const task = taskMap.get(payment.repairTaskNo);
      return {
        ...payment,
        firmName: task?.firmName || "",
        priority: task?.priority || ""
      };
    });
  }, [historyRepairPayments, taskMap]);

  // Combine unique values for filters
  const uniqueFirms = useMemo(() => {
    const firms = new Set([
      ...pendingRepairPayments.map(t => t.firmName),
      ...historyWithFirm.map(t => t.firmName)
    ]);
    return ["All", ...firms].filter(Boolean);
  }, [pendingRepairPayments, historyWithFirm]);

  const uniquePaymentTypes = useMemo(() => {
    const types = new Set([
      "Cash",
      "Online",
      "Cheque",
      "Advance",
      ...pendingRepairPayments.map(t => t.paymentType).filter(Boolean),
      ...historyWithFirm.map(t => t.paymentType).filter(Boolean)
    ]);
    return ["All", ...types].filter(Boolean);
  }, [pendingRepairPayments, historyWithFirm]);

  const filterPending = (list) => {
    return list
      .filter((task) => selectedFirm === "All" || task.firmName === selectedFirm)
      .filter((task) => selectedPaymentType === "All" || (task.paymentType || "").toString().trim().toLowerCase() === selectedPaymentType.toString().trim().toLowerCase())
      .filter((task) => selectedPriority === "All" || (task.priority || "").toString().trim().toLowerCase() === selectedPriority.toString().trim().toLowerCase())
      .filter((task) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (task.machineName || "").toLowerCase().includes(term) ||
          (task.taskNo || "").toLowerCase().includes(term) ||
          (task.serialNo || "").toLowerCase().includes(term) ||
          (task.doerName || "").toLowerCase().includes(term) ||
          (task.vendorName || "").toLowerCase().includes(term) ||
          (task.billNo || "").toLowerCase().includes(term)
        );
      });
  };

  const filterHistory = (list) => {
    return list
      .filter((task) => selectedFirm === "All" || task.firmName === selectedFirm)
      .filter((task) => selectedPaymentType === "All" || (task.paymentType || "").toString().trim().toLowerCase() === selectedPaymentType.toString().trim().toLowerCase())
      .filter((task) => selectedPriority === "All" || (task.priority || "").toString().trim().toLowerCase() === selectedPriority.toString().trim().toLowerCase())
      .filter((task) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (task.machineName || "").toLowerCase().includes(term) ||
          (task.repairTaskNo || "").toLowerCase().includes(term) ||
          (task.serialNo || "").toLowerCase().includes(term) ||
          (task.vendorName || "").toLowerCase().includes(term) ||
          (task.billNo || "").toLowerCase().includes(term) ||
          (task.paymentNo || "").toLowerCase().includes(term)
        );
      });
  };

  const displayedPending = filterPending(pendingRepairPayments);
  const displayedHistory = filterHistory(historyWithFirm);

  const totalBillAmountSum = useMemo(() => {
    const currentList = activeTab === "pending" ? displayedPending : displayedHistory;
    return currentList.reduce((sum, task) => {
      const rawVal = (task.totalBillAmount || "").toString().replace(/[^0-9.-]+/g, "");
      const amount = parseFloat(rawVal) || 0;
      return sum + amount;
    }, 0);
  }, [activeTab, displayedPending, displayedHistory]);

  const [formData, setFormData] = useState({
    totalBillAmount: "",
    paymentType: "",
    toBePaidAmount: "",
    utrChequeNo: "",
  });

  // const filteredTasks = tasks.filter(
  //   (task) => user?.role === "admin" || task.nameOfIndenter === user?.name
  // );


  
  // const pendingTasks = filteredTasks.filter((task) => task.status === "stored");
  // const historyTasks = filteredTasks.filter(
  //   (task) => task.status === "advanced"
  // );

  const handleMaterialClick = (task) => {
    setSelectedTask(task);
    setFormData({
      totalBillAmount: task.totalBillAmount?.toString() || task.toBePaidAmount?.toString() || "",
      paymentType: task.paymentType || "",
      toBePaidAmount: task.toBePaidAmount?.toString() || "",
      utrChequeNo: "",
    });
    setIsModalOpen(true);
  };

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => ({
        id: `payment-task-${index}`,
        isAdvance: false,
        taskNo: row["Task No"] || "",
        firmName: row["Firm Name"] || "",
        serialNo: row["Serial No"] || "",
        machineName: row["Machine Name"] || "",
        machinePartName: row["Machine Part Name"] || "",
        doerName: row["Doer Name"] || "",
        problem: row["Problem"] || "",
        priority: row["Priority"] || "",
        department: row["Department"] || "",
        vendorName: row["Vendor Name"] || "",
        paymentType: row["Payment Type"] || "",
        howMuch: row["How Much"] || "",
        billImage: row["Bill Image"] || "",
        billNo: row["Bill No."] || "",
        typeOfBill: row["Type of Bill"] || "",
        totalBillAmount: row["Total Bill Amount"] || "",
        toBePaidAmount: row["To Be Paid Amount"] || "",
        actualPosting: row["Actual Posting"] || "",
        planned4: row["Planned 4"] || "",
        actual4: row["Actual 4"] || "",
      }));

      setRepairTasks(formattedTasks);

      // Normal pending: Actual Posting filled + Actual 4 empty (non-advance)
      const normalPending = formattedTasks.filter(
        (task) => task.actualPosting && !task.actual4
      );
      const normalHistory = formattedTasks.filter((task) => task.actual4);

      // Advance Step 3 pending: Actual Posting filled + Actual Payment Date empty
      let advPending = [];
      let advHistory = [];
      try {
        const advanceTasks = await fetchAdvancePayments();
        const userFirm = (user?.firmName || "").toLowerCase();
        const isAllFirm = !userFirm || userFirm === "all";
        const firmFiltered = isAllFirm
          ? advanceTasks
          : advanceTasks.filter((t) => (t.firmName || "").toLowerCase() === userFirm);

        advPending = firmFiltered.filter((t) => t.actualPosting && !t.actualPaymentDate);
        advHistory = firmFiltered.filter((t) => t.actualPosting && t.actualPaymentDate);
      } catch (advErr) {
        console.warn("Could not fetch advance tasks for MakePayment:", advErr);
      }

      setPendingRepairPayments([...normalPending, ...advPending]);
      setHistoryRepairPayments([...normalHistory, ...advHistory]);

    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error("Failed to fetch tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  // fetchPayments is kept for submitting new payment entries to Advance Payment sheet
  // History is now sourced from Repair System sheet (Actual 4 filled) via fetchAllTasks
  const fetchPayments = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);
      const SHEET_NAME_PAYMENTS = "Repair FMS Advance Payment";
      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&&sheet=${SHEET_NAME_PAYMENTS}`
      );
      const result = await res.json();
      const allRows = result?.table?.rows || [];
      const paymentRows = allRows.slice(5);
      const formattedPayments = paymentRows.map((row) => {
        const cells = row.c;
        return {
          timestamp: cells[0]?.v || "",
          paymentNo: cells[1]?.v || "",
          repairTaskNo: cells[2]?.v || "",
          serialNo: cells[3]?.v || "",
          machineName: cells[4]?.v || "",
          vendorName: cells[5]?.v || "",
          billNo: cells[6]?.v || "",
          totalBillAmount: cells[7]?.v || "",
          paymentType: cells[8]?.v || "",
          toBePaidAmount: cells[9]?.v || "",
        };
      });
      // Only used for payment number generation, not for history display
      const seenKeys = new Set();
      const deduped = formattedPayments.filter((p) => {
        const key = `${p.repairTaskNo}_${p.billNo}_${p.totalBillAmount}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });
      setRepairPayments(deduped);
      // ❌ DO NOT set historyRepairPayments here — history comes from Repair System sheet
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    const hasData = repairTasks && repairTasks.length > 0;
    const init = async () => {
      await fetchAllTasks(hasData);
      await fetchPayments(hasData);
    };
    init();
  }, []);

 const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedTask) return;

    if (!formData.paymentType) {
      toast.error("Please select a payment type");
      return;
    }
    if (!formData.toBePaidAmount) {
      toast.error("Please enter the amount to be paid");
      return;
    }

    try {
      setSubmitLoading(true);
      const nowIST = getNowIST();
      const todayIST = getTodayIST();

      if (selectedTask.isAdvance) {
        // ── ADVANCE TASK: Update "Repair FMS Advance Payment" sheet (Step 3) ──
        const result = await updateAdvancePayment(selectedTask.taskNo, {
          "Actual Payment Date": todayIST,
          "Advance Payment UTR / Cheque No": formData.utrChequeNo || "",
          "Advance Amount Paid": formData.toBePaidAmount || "",
          "Payment Done By": user?.name || "",
        });

        if (result.success) {
          toast.success("✅ Advance payment released successfully!");
          setIsModalOpen(false);
          await fetchAllTasks(true);
          await fetchPayments(true);
        } else {
          toast.error("❌ Failed: " + (result.message || "Unknown error"));
        }
      } else {
        // ── NORMAL TASK: Insert into Repair FMS Advance Payment + update Repair System ──
        const lastPaymentNo = repairPayments
          .filter((p) => p.paymentNo?.startsWith("PN-"))
          .map((p) => parseInt(p.paymentNo.replace("PN-", ""), 10))
          .filter((n) => !isNaN(n))
          .sort((a, b) => b - a)[0] || 0;
        const nextPaymentNo = `PN-${String(lastPaymentNo + 1).padStart(3, "0")}`;

        // Step 1: Insert into Repair FMS Advance Payment sheet
        const insertPayload = {
          action: "insert1",
          sheetName: "Repair FMS Advance Payment",
          Timestamp: nowIST,
          "Repair Task No": selectedTask.taskNo,
          "Serial No": selectedTask.serialNo || "",
          "Machine Name": selectedTask.machineName || "",
          "Vendor Name ": selectedTask.vendorName || "",
          "Bill No.": selectedTask.billNo || "",
          "Total Bill Amount": selectedTask.totalBillAmount || "",
          "Payment Type": formData.paymentType,
          "To Be Paid Amount": formData.toBePaidAmount,
        };
        const insertResp = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(insertPayload).toString(),
        });
        const insertResult = await insertResp.json();

        if (!insertResult.success) {
          toast.error("❌ Failed to record payment: " + (insertResult.message || "Unknown error"));
          return;
        }

        // Step 2: Update Actual 4 in Repair System sheet
        const updatePayload = {
          action: "update1",
          sheetName: "Repair System",
          taskNo: selectedTask.taskNo,
          "Actual 4": todayIST,
        };
        const updateResp = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(updatePayload).toString(),
        });
        const updateResult = await updateResp.json();

        if (updateResult.success) {
          toast.success("✅ Payment submitted successfully!");
          setIsModalOpen(false);
          await fetchAllTasks(true);
          await fetchPayments(true);
        } else {
          toast.error("❌ Payment recorded but Repair System not updated.");
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Network error while submitting payment");
    } finally {
      setSubmitLoading(false);
    }
  };


  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   try {
  //     setSubmitLoading(true);
  //     let billImageUrl = "";
  //     if (formData.productImage) {
  //       billImageUrl = await uploadFileToDrive(formData.productImage);
  //     }

  //     const payload = {
  //       action: "update1",
  //       sheetName: "Repair System",
  //       taskNo: selectedTask.taskNo,

  //       // Required Headers:
  //       Actual2: new Date().toLocaleString("en-GB", {
  //         timeZone: "Asia/Kolkata",
  //       }),
  //       "Received Quantity": formData.receivedQuantity,
  //       "Bill Match": formData.billMatch,
  //       "Bill Image": billImageUrl,
  //       "Bill No.": formData.billNo,
  //       "Product Image": billImageUrl,
  //     };

  //     const response = await fetch(SCRIPT_URL, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/x-www-form-urlencoded",
  //       },
  //       body: new URLSearchParams(payload).toString(),
  //     });

  //     const result = await response.json();
  //     console.log("Update result:", result);

  //     if (result.success) {
  //       alert("✅ Task updated successfully");
  //       setIsModalOpen(false);
  //       fetchAllTasks(); // refresh the table
  //     } else {
  //       alert("❌ Failed to update task: " + result.message);
  //     }
  //   } catch (error) {
  //     console.error("Submit error:", error);
  //     alert("❌ Something went wrong while submitting");
  //   } finally {
  //     setSubmitLoading(false);
  //   }
  // };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Repair Advance</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Pending ({displayedPending.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              History ({displayedHistory.length})
            </button>
          </nav>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Direct Payment Type Filter */}
              <div className="w-44">
                <select
                  value={selectedPaymentType}
                  onChange={(e) => setSelectedPaymentType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium text-gray-700"
                >
                  {uniquePaymentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All Payment Types" : type}
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                variant={showFilters ? "primary" : "secondary"} 
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>

            {/* Total Bill Amount display on the top right */}
            <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl px-5 py-2.5 shadow-sm self-start lg:self-auto">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                  Total Bill Amount
                </span>
                <span className="text-lg font-bold text-gray-900 leading-tight">
                  ₹{totalBillAmountSum.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
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
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Type</label>
                <select
                  value={selectedPaymentType}
                  onChange={(e) => setSelectedPaymentType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  {uniquePaymentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type === "All" ? "All Types" : type}
                    </option>
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
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* {activeTab === "pending" && (
          <div>
          <Table>
            <TableHeader>
              <TableHead>Action</TableHead>
              <TableHead>Task Number</TableHead>
              <TableHead>Machine Name</TableHead>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Bill No</TableHead>
              <TableHead>Total Bill Amount</TableHead>
              <TableHead>Payment Type</TableHead>
              <TableHead>To Be Paid Amount</TableHead>
            </TableHeader>
            <TableBody>
              {pendingTasks.map((task) => (
                <TableRow key={task.taskNo}>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleMaterialClick(task)}
                      className="flex items-center"
                    >
                      <CreditCard className="w-3 h-3 mr-1" />
                      Material
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">
                    {task.taskNo}
                  </TableCell>
                  <TableCell>{task.machineName}</TableCell>
                  <TableCell>{task.vendorName || "-"}</TableCell>
                  <TableCell>{task.billNo}</TableCell>
                  <TableCell>{task.totalBillAmount || "-"}</TableCell>
                  <TableCell>{task.paymentType || "-"}</TableCell>
                  <TableCell>{task.toBePaidAmount || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loadingTasks && (
              <div className="flex flex-col items-center justify-center w-[75vw] mt-10">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">Loading tasks...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
          <Table>
            <TableHeader>
              
              <TableHead>Task Number</TableHead>
              <TableHead>Machine Name</TableHead>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Bill No</TableHead>
              <TableHead>Total Bill Amount</TableHead>
              <TableHead>Payment Type</TableHead>
              <TableHead>To Be Paid Amount</TableHead>
            </TableHeader>
            <TableBody>
              {historyTasks.map((task) => (
                <TableRow key={task.taskNo}>
                  <TableCell className="font-medium text-blue-600">
                    {task.taskNo}
                  </TableCell>
                  <TableCell>{task.machineName}</TableCell>
                  <TableCell>{task.vendorName || "-"}</TableCell>
                  <TableCell>{task.billNo}</TableCell>
                  <TableCell>{task.totalBillAmount || "-"}</TableCell>
                  <TableCell>{task.paymentType || "-"}</TableCell>
                  <TableCell>{task.toBePaidAmount || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loadingTasks && (
              <div className="flex flex-col items-center justify-center w-[75vw] mt-10">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">Loading tasks...</p>
              </div>
            )}
          </div>
        )} */}

        {activeTab === "pending" && (
          <div>
            <div className="overflow-auto max-h-[calc(100vh-260px)]">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loadingTasks && pendingRepairPayments.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                        </div>
                      </td>
                    </tr>
                  ) : displayedPending.length === 0 ? (
                    <tr>
                      <td colSpan={21} className="text-center py-12 text-gray-500">No pending payments found</td>
                    </tr>
                  ) : (
                    displayedPending.map((task) => (
                      <tr key={task.taskNo || Math.random()} className="hover:bg-blue-50/40 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button size="sm" onClick={() => handleMaterialClick(task)} className="flex items-center">
                              <Package className="w-3.5 h-3.5 mr-1" />
                              Material
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleOpenForm(task)}
                              className="flex items-center text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                              title="Open Google Form"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              Form
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-blue-600 whitespace-nowrap">{task.taskNo}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.firmName || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{task.serialNo || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{task.machineName}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">{task.machinePartName || "-"}</td>
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
                          {task.transportationAmount ? `₹${Number(task.transportationAmount).toLocaleString()}` : task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[120px]">Payment No.</TableHead>
                <TableHead className="min-w-[130px]">Repair Task No.</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[120px]">Bill No.</TableHead>
                <TableHead className="min-w-[130px]">Total Bill Amount</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[130px]">To Be Paid Amount</TableHead>
                <TableHead className="min-w-[120px]">Bill Image</TableHead>
                <TableHead className="min-w-[120px]">Bill Match</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks && historyRepairPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading payment history...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      No payment history found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedHistory.map((task, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-blue-600">
                        {task.paymentNo || task.taskNo}
                      </TableCell>
                      <TableCell>{task.repairTaskNo || task.taskNo}</TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>{task.billNo || "-"}</TableCell>
                      <TableCell>
                        {task.totalBillAmount ? `₹${Number(task.totalBillAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>{task.paymentType || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {task.toBePaidAmount ? `₹${Number(task.toBePaidAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        {task.billImage ? (
                          <button
                            type="button"
                            className="text-blue-600 underline text-sm hover:text-blue-800 font-medium"
                            onClick={() => window.open(task.billImage, "_blank", "noopener,noreferrer")}
                          >
                            View Bill
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No Bill</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            task.billMatch === "Yes"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {task.billMatch === "Yes" ? "Matched" : "Not Matched"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Repair Advance Details"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment No. (Read-only)
              </label>
              <input
                type="text"
                value={"PN-001" || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
               Serial No (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.serialNo || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bill No. (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.billNo || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repair Task Number (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.taskNo || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Machine Name (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.machineName || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Name (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.vendorName || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Bill Amount *
              </label>
              <input
                type="number"
                value={selectedTask?.totalBillAmount}
                readOnly
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    totalBillAmount: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type *
              </label>
              <select
                value={formData.paymentType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    paymentType: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Payment Type</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Be Paid Amount *
              </label>
              <input
                type="number"
                value={formData.toBePaidAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    toBePaidAmount: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MakePayment;
