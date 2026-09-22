import React, { useEffect, useState } from "react";
import { Search, Filter, CheckCircle, Loader2Icon, Layers, X, Check, Zap } from "lucide-react";
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
import { mockRepairTasks } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";
import useDataStore from "../../store/dataStore";
import toast from "react-hot-toast";
import { fetchRepairTasks as fetchRepairTasksSvc } from "../../services/repairService";
import { fetchAdvancePayments, updateAdvancePayment, getTodayIST } from "../../services/advancePaymentService";

const CheckMachine = () => {
  const { user } = useAuth();
  const {
    repairTasks,
    pendingRepairTasks,
    historyRepairTasks,
    setRepairTasks,
    setPendingRepairTasks,
    setHistoryRepairTasks,
    updateRepairTask,
    transporters
  } = useDataStore();

  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loaderSubmit, setLoaderSubmit] = useState(false);

  // Common Bill linking states
  const [selectedCommonTasks, setSelectedCommonTasks] = useState([]);
  const [commonSearchTerm, setCommonSearchTerm] = useState("");
  const [commonDetailModalOpen, setCommonDetailModalOpen] = useState(false);
  const [commonDetailParentTask, setCommonDetailParentTask] = useState(null);
  const [commonDetailTasksList, setCommonDetailTasksList] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  // Dynamically compute unique values for filters from repairTasks
  const uniqueFirms = ["All", ...new Set(repairTasks.map(t => t.firmName).filter(Boolean))];

  // Filter function
  const filterList = (list) => {
    return list
      .filter((task) => selectedFirm === "All" || task.firmName === selectedFirm)
      .filter((task) => selectedPriority === "All" || (task.priority || "").toLowerCase() === selectedPriority.toLowerCase())
      .filter((task) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          (task.machineName || "").toLowerCase().includes(term) ||
          (task.taskNo || "").toLowerCase().includes(term) ||
          (task.serialNo || "").toLowerCase().includes(term) ||
          (task.doerName || "").toLowerCase().includes(term) ||
          (task.department || "").toLowerCase().includes(term) ||
          (task.machinePartName || "").toLowerCase().includes(term) ||
          (task.vendorName || "").toLowerCase().includes(term)
        );
      });
  };

  const displayedPendingTasks = filterList(pendingRepairTasks);
  const displayedHistoryTasks = filterList(historyRepairTasks);

  const [formData, setFormData] = useState({
    billImage: null,
    billNo: "",
    typeOfBill: "",
    totalBillAmount: "",
    paymentType: "",
    toBePaidAmount: "",
    transporterName: "",
    transportationAmount: "",
  });

  const filteredTasks = repairTasks.filter(
    (task) => user?.role === "admin" || task.nameOfIndenter === user?.name
  );

  const handleMaterialClick = (task) => {
    setSelectedTask(task);
    setSelectedCommonTasks([]);
    setCommonSearchTerm("");
    setFormData({
      billImage: null,
      billNo: "",
      typeOfBill: "",
      totalBillAmount: "",
      paymentType: task.paymentType || "",
      toBePaidAmount: "",
      transporterName: task.transporterName || "",
      transportationAmount: "",
    });
    setIsModalOpen(true);
  };
  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      // Use shared service — returns objects keyed by sheet header names (Row 6)
      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => {
        // Parse Common Tasks Linked
        let commonLinked = [];
        const rawCommon = row["Common Bill Tasks"] || "";
        if (rawCommon) {
          try {
            commonLinked = Array.isArray(rawCommon)
              ? rawCommon
              : rawCommon.startsWith("[")
                ? JSON.parse(rawCommon)
                : rawCommon.split(",").map((s) => s.trim()).filter(Boolean);
          } catch (_) {
            commonLinked = rawCommon.split(",").map((s) => s.trim()).filter(Boolean);
          }
        } else if (row["Remark"] && row["Remark"].includes("Common Bill with:")) {
          const after = row["Remark"].split("Common Bill with:")[1] || "";
          commonLinked = after.split(",").map((s) => s.trim()).filter(Boolean);
        }

        let commonParent = row["Common Parent Task"] || "";
        if (!commonParent && row["Remark"] && row["Remark"].includes("Common Bill under:")) {
          commonParent = row["Remark"].split("Common Bill under:")[1]?.trim() || "";
        }

        return {
          id: `check-task-${index}`,
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
          // Sent Machine step
          planned: row["Planned 1"] || "",
          actual: row["Actual 1"] || "",
          vendorName: row["Vendor Name"] || "",
          leadTimeToDeliverDays: row["Lead Time To Deliver ( In No. Of Days)"] || "",
          transporterName: row["(Transporter Name)"] || row["Transporter Name"] || "",
          transportationCharges: row["Transportation Charges"] || "",
          weighmentSlip: row["Weighment Slip"] || "",
          paymentType: row["Payment Type"] || "",
          howMuch: row["How Much"] || "",
          // Check Machine step (Actual 2)
          planned1: row["Planned 2"] || "",
          actual1: row["Actual 2"] || "",         // Local name actual1 maps to sheet 'Actual 2'
          billImage: row["Bill Image"] || "",
          billNo: row["Bill No."] || "",
          typeOfBill: row["Type of Bill"] || "",
          totalBillAmount: row["Total Bill Amount"] || "",
          toBePaidAmount: row["To Be Paid Amount"] || "",
          // Management step
          managementApprovalDate: row["Management Approval Date"] || "",
          managementRemark: row["Management Remark"] || "",
          // Common bill link fields
          commonTasksLinked: commonLinked,
          commonParentTask: commonParent,
          remark: row["Remark"] || "",
        };
      });

      setRepairTasks(formattedTasks);

      // DEBUG: log common task linking data
      console.log("[CheckMachine] commonTasksLinked debug:");
      formattedTasks.forEach(t => {
        if (t.commonTasksLinked?.length > 0 || t.commonParentTask) {
          console.log(`  Task: "${t.taskNo}" | linked: ${JSON.stringify(t.commonTasksLinked)} | parent: "${t.commonParentTask}"`);
        }
      });

      // Helper: check if a taskNo is listed as a child in any other task's commonTasksLinked
      const isChildTask = (taskNo) => {
        const normalized = (taskNo || "").trim().toLowerCase();
        return formattedTasks.some((other) =>
          other.commonTasksLinked?.some(
            (childNo) => (childNo || "").trim().toLowerCase() === normalized
          )
        );
      };

      // Normal pending: Management Approval Date filled + Actual 2 empty
      // Tasks that are children of another (listed in someTask.commonTasksLinked) are hidden
      const normalPending = formattedTasks.filter(
        (t) => t.managementApprovalDate && !t.actual1 && !isChildTask(t.taskNo)
      );
      // Normal history: Actual 2 filled — child tasks also hidden (shown under parent)
      const normalHistory = formattedTasks.filter(
        (t) => t.managementApprovalDate && t.actual1 && !isChildTask(t.taskNo)
      );

      // Advance Step 4 pending: Actual Payment Date filled + Actual Check Machine Date empty
      let advPending = [];
      let advHistory = [];
      let advWithParentFlag = [];
      try {
        const advanceTasks = await fetchAdvancePayments();
        const userFirm = (user?.firmName || "").toLowerCase();
        const isAllFirm = !userFirm || userFirm === "all";
        const firmFiltered = isAllFirm
          ? advanceTasks
          : advanceTasks.filter((t) => (t.firmName || "").toLowerCase() === userFirm);

        // Mark child tasks for advance payments too (same Bill No. based grouping as Normal)
        advWithParentFlag = firmFiltered.map((task) => {
          if (!task.billNo || task.billNo === "-") {
            return { ...task, isChildTask: false, commonTasksLinked: [] };
          }
          const siblings = firmFiltered.filter(
            (other) => other.billNo === task.billNo && other.taskNo !== task.taskNo
          );
          if (siblings.length === 0) {
            return { ...task, isChildTask: false, commonTasksLinked: [] };
          }
          const group = firmFiltered.filter((other) => other.billNo === task.billNo);
          const isChildAdv = group[0]?.taskNo !== task.taskNo;
          return {
            ...task,
            isChildTask: isChildAdv,
            commonTasksLinked: isChildAdv ? [] : siblings.map((t) => t.taskNo),
          };
        });

        advPending = advWithParentFlag.filter(
          (t) => t.actualPaymentDate && !t.actualCheckMachineDate && !t.isChildTask
        );
        advHistory = advWithParentFlag.filter(
          (t) => t.actualPaymentDate && t.actualCheckMachineDate && !t.isChildTask
        );
      } catch (advErr) {
        console.warn("Could not fetch advance tasks for CheckMachine:", advErr);
      }

      setPendingRepairTasks([...normalPending, ...advPending]);
      setHistoryRepairTasks([...normalHistory, ...advHistory]);

      // Also merge advance tasks into `repairTasks` so the modal's common-task lookup
      // can resolve linked advance child tasks' machine names.
      setRepairTasks([...formattedTasks, ...advWithParentFlag]);

    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error("Failed to fetch tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  const [billTypes, setBillTypes] = useState(["Common", "Independent"]);
  const [loadingBillTypes, setLoadingBillTypes] = useState(false);

  const fetchBillTypes = async () => {
    try {
      setLoadingBillTypes(true);
      const SHEET_NAME_MASTER = "Master";
      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&sheet=${SHEET_NAME_MASTER}`
      );
      const result = await res.json();
      if (result && result.table && result.table.rows) {
        const headers = (result.table.cols || []).map((col) => (col.label || "").toString().trim());
        let bTypeColIdx = headers.findIndex(
          (h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === "typeofbill"
        );
        if (bTypeColIdx === -1) bTypeColIdx = 7;

        const seen = new Set();
        const types = [];
        result.table.rows.forEach((row) => {
          const cell = row.c && row.c[bTypeColIdx];
          if (cell && cell.v !== null && cell.v !== undefined) {
            const val = cell.v.toString().trim();
            if (val && !seen.has(val.toLowerCase())) {
              seen.add(val.toLowerCase());
              types.push(val);
            }
          }
        });

        if (types.length > 0) {
          setBillTypes(types);
        }
      }
    } catch (err) {
      console.error("Error fetching Type of Bill from Master sheet:", err);
    } finally {
      setLoadingBillTypes(false);
    }
  };

  useEffect(() => {
    const hasData = repairTasks && repairTasks.length > 0;
    fetchAllTasks(hasData);
    fetchBillTypes();
  }, []);

  const uploadFileToDrive = async (file) => {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        const base64Data = reader.result;

        try {
          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              action: "uploadFile",
              base64Data: base64Data,
              fileName: file.name,
              mimeType: file.type,
              folderId: FOLDER_ID,
            }).toString(),
          });

          const data = await res.json();

          if (data.success && data.fileUrl) {
            resolve(data.fileUrl);
          } else {
            toast.error("❌ File upload failed");
            resolve("");
          }
        } catch (err) {
          console.error("Upload error:", err);
          toast.error("❌ Upload failed due to network error");
          resolve("");
        }
      };

      reader.onerror = () => {
        reject("❌ Failed to read file");
      };

      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoaderSubmit(true);
      let billImageUrl = "";
      if (formData.billImage) {
        billImageUrl = await uploadFileToDrive(formData.billImage);
      }

      const nowFormatted = getTodayIST();
      const commonTasksStr = selectedCommonTasks.join(", ");

      if (selectedTask.isAdvance) {
        // ── ADVANCE TASK: Update "Repair FMS Advance Payment" sheet (Step 4) ──
        const result = await updateAdvancePayment(selectedTask.taskNo, {
          "Actual Check Machine Date": nowFormatted,
          "Bill Date": nowFormatted,
          "Bill Image Link": billImageUrl || "",
          "Checked By": user?.name || "",
          "Bill No.": formData.billNo || "",
          "Type of Bill": formData.typeOfBill || "",
        });

        if (result.success) {
          toast.success("✅ Advance machine check submitted successfully!");
          setIsModalOpen(false);
          fetchAllTasks(true);
        } else {
          toast.error("❌ Failed: " + (result.message || "Unknown error"));
        }
        return;
      }

      // ── NORMAL TASK: Update Repair System sheet ──
      const payload = {
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,
        "Actual 2": nowFormatted,
        "(Transporter Name)": formData.transporterName,
        "Transporter Name": formData.transporterName,
        "Transportation Amount": formData.transportationAmount,
        "Bill Image": billImageUrl,
        "Bill No.": formData.billNo,
        "Type of Bill": formData.typeOfBill,
        "Total Bill Amount": formData.totalBillAmount,
        "To Be Paid Amount": formData.toBePaidAmount || formData.totalBillAmount,
        "Common Bill Tasks": commonTasksStr,
        "Remark": commonTasksStr ? `Common Bill with: ${commonTasksStr}` : (selectedTask.remark || ""),
      };

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();

      if (result.success) {

        // Also update all linked child tasks for common bill
        if (selectedCommonTasks && selectedCommonTasks.length > 0) {
          for (const childTaskNo of selectedCommonTasks) {
            try {
              const childObj = pendingRepairTasks.find((t) => t.taskNo === childTaskNo);
              const childPayload = {
                action: "update1",
                sheetName: "Repair System",
                taskNo: childTaskNo,
                "Actual 2": nowFormatted,
                "(Transporter Name)": formData.transporterName || childObj?.transporterName || "",
                "Transporter Name": formData.transporterName || childObj?.transporterName || "",
                "Transportation Amount": "0",
                "Bill Image": billImageUrl,
                "Bill No.": formData.billNo,
                "Type of Bill": "Common",
                "Total Bill Amount": "0",
                "To Be Paid Amount": "0",
                "Common Parent Task": selectedTask.taskNo,
                "Remark": `Common Bill under: ${selectedTask.taskNo}`,
              };

              await fetch(SCRIPT_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(childPayload).toString(),
              });
            } catch (childErr) {
              console.error(`Error updating common child task ${childTaskNo}:`, childErr);
            }
          }
        }

        // Update the Zustand store
        updateRepairTask(selectedTask.taskNo, {
          actual1: nowFormatted,
          transporterName: formData.transporterName,
          transportationAmount: formData.transportationAmount,
          billImage: billImageUrl,
          billNo: formData.billNo,
          typeOfBill: formData.typeOfBill,
          totalBillAmount: formData.totalBillAmount,
          toBePaidAmount: formData.toBePaidAmount,
          commonTasksLinked: selectedCommonTasks,
        });

        for (const childTaskNo of selectedCommonTasks) {
          updateRepairTask(childTaskNo, {
            actual1: nowFormatted,
            transporterName: formData.transporterName,
            transportationAmount: "0",
            billImage: billImageUrl,
            billNo: formData.billNo,
            typeOfBill: "Common",
            totalBillAmount: "0",
            toBePaidAmount: "0",
            commonParentTask: selectedTask.taskNo,
          });
        }

        toast.success(
          selectedCommonTasks.length > 0
            ? `✅ Task ${selectedTask.taskNo} and ${selectedCommonTasks.length} common task(s) updated successfully`
            : "✅ Task updated successfully"
        );
        setIsModalOpen(false);
        fetchAllTasks(); // refresh the table
      } else {
        toast.error("❌ Failed to update task: " + (result.message || result.error));
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Something went wrong while submitting");
    } finally {
      setLoaderSubmit(false);
    }
  };

  const handleViewCommonTasks = (parentTask) => {
    setCommonDetailParentTask(parentTask);
    const linkedTaskNos = parentTask.commonTasksLinked || [];
    const list = linkedTaskNos.map((tNo) => {
      const found = repairTasks.find((t) => t.taskNo === tNo);
      return {
        taskNo: tNo,
        machineName: found?.machineName || "-",
        transporterName: found?.transporterName || parentTask.transporterName || "-",
        typeOfBill: "Common",
      };
    });
    setCommonDetailTasksList(list);
    setCommonDetailModalOpen(true);
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Check Machine</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              Pending ({displayedPendingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              History ({displayedHistoryTasks.length})
            </button>
          </nav>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
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

        {activeTab === "pending" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[100px] text-center">Action</TableHead>
                <TableHead className="min-w-[120px]">Task Number</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[110px]">Planned Date</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[140px]">Vendor</TableHead>
                <TableHead className="min-w-[140px]">Transporter Charges</TableHead>
                <TableHead className="min-w-[100px]">Lead Time</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[120px]">Advance Amount</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks && pendingRepairTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      No pending tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedPendingTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleMaterialClick(task)}
                          className="flex items-center mx-auto"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Material
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">
                        <div className="flex flex-col gap-1">
                          <span>{task.taskNo}</span>
                          {task.commonTasksLinked?.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 border border-green-300 w-fit">
                              <Layers className="w-3 h-3" />
                              {task.commonTasksLinked.length} Common
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.planned1 || "-"}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>
                        {task.transportationCharges ? `₹${Number(task.transportationCharges).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>{task.leadTimeToDeliverDays ? `${task.leadTimeToDeliverDays} Days` : "-"}</TableCell>
                      <TableCell>{task.paymentType || "-"}</TableCell>
                      <TableCell>{task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[120px]">Task Number</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[110px]">Planned Date</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[100px]">Lead Time</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[120px]">Advance Amount</TableHead>
                <TableHead className="min-w-[140px]">Transporter Name</TableHead>
                <TableHead className="min-w-[120px]">To Be Paid</TableHead>
                <TableHead className="min-w-[120px]">Bill No</TableHead>
                <TableHead className="min-w-[120px]">Bill Type</TableHead>
                <TableHead className="min-w-[120px]">Total Bill Amount</TableHead>
                <TableHead className="min-w-[120px]">Bill Image</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks && historyRepairTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-12 text-gray-500">
                      No history tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedHistoryTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="font-medium text-blue-600">
                        <div className="flex flex-col items-start gap-1">
                          <span>{task.taskNo}</span>
                          {task.commonTasksLinked && task.commonTasksLinked.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleViewCommonTasks(task)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-xs"
                              title="Click to view linked common tasks"
                            >
                              <Layers className="w-3 h-3 text-indigo-600" />
                              {task.commonTasksLinked.length} Common
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.planned1 || "-"}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>{task.leadTimeToDeliverDays ? `${task.leadTimeToDeliverDays} Days` : "-"}</TableCell>
                      <TableCell>{task.paymentType || "-"}</TableCell>
                      <TableCell>{task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}</TableCell>
                      <TableCell>{task.tranporterName || task.transporterName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {task.toBePaidAmount ? `₹${Number(task.toBePaidAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>{task.billNo || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${(task.typeOfBill || "").toLowerCase() === "common"
                            ? "bg-purple-100 text-purple-800"
                            : (task.typeOfBill || "").toLowerCase() === "independent"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                          {task.typeOfBill || "-"}
                        </span>
                        {task.commonParentTask && (
                          <span className="block text-[11px] text-gray-500 mt-0.5">
                            Under: <strong className="text-gray-700">{task.commonParentTask}</strong>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.totalBillAmount ? `₹${Number(task.totalBillAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        {task.billImage ? (
                          <button
                            type="button"
                            className="text-blue-600 underline text-sm hover:text-blue-800 font-medium"
                            onClick={() =>
                              window.open(
                                task.billImage,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            View Bill
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No Bill</span>
                        )}
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
        title="Check Material Details"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Linked Common Tasks Info Panel */}
          {selectedTask?.commonTasksLinked?.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">
                  This task has {selectedTask.commonTasksLinked.length} linked common task(s) — all will be processed together
                </span>
              </div>
              <div className="space-y-2">
                {/* Main (parent) task row */}
                <div className="flex items-center gap-3 bg-white rounded-md border border-blue-200 px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-600 text-white"></span>
                  <span className="font-semibold text-blue-700 text-sm">{selectedTask.taskNo}</span>
                  <span className="text-gray-500 text-sm">—</span>
                  <span className="text-gray-700 text-sm">{selectedTask.machineName || "-"}</span>
                </div>
                {/* Child task rows */}
                {selectedTask.commonTasksLinked.map((childNo) => {
                  const childTask = repairTasks.find((t) => t.taskNo === childNo);
                  return (
                    <div key={childNo} className="flex items-center gap-3 bg-white rounded-md border border-green-200 px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold rounded-full bg-green-100 text-green-700 border border-green-300">COMMON</span>
                      <span className="font-semibold text-green-700 text-sm">{childNo}</span>
                      <span className="text-gray-500 text-sm">—</span>
                      <span className="text-gray-700 text-sm">{childTask?.machineName || "-"}</span>
                      {childTask?.department && (
                        <span className="text-xs text-gray-400 ml-auto">{childTask.department}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repair Task Number (Read-only)
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
                Machine Name (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.machineName || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>

            {/* Existing fields... */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Type (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.paymentType || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>

            {/* ONLY show this field if paymentType is "Advance" */}
            {selectedTask?.paymentType === "Advance" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How Much (Advance Amount)
                </label>
                <input
                  type="text"
                  value={selectedTask?.howMuch || ""}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transporter Name *
              </label>
              <select
                value={formData.transporterName || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transporterName: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-800"
              >
                <option value="">Select Transporter Name</option>
                {transporters.map((transporter, index) => (
                  <option key={index} value={transporter}>
                    {transporter}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transportation Amount *
              </label>
              <input
                type="number"
                value={formData.transportationAmount || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transportationAmount: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bill No. *
              </label>
              <input
                type="text"
                value={formData.billNo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, billNo: e.target.value }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type of Bill *
              </label>
              <select
                value={formData.typeOfBill}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    typeOfBill: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">
                  {loadingBillTypes ? "Loading Bill Types..." : "Select Bill Type"}
                </option>
                {billTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {formData.typeOfBill && formData.typeOfBill.toLowerCase() === "independent" && (
              <div className="col-span-1 md:col-span-2 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      For Common Bill (Link Pending Tasks)
                    </label>
                    <p className="text-xs text-gray-500">
                      Select all pending machines covered under this bill:
                    </p>
                  </div>
                  <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-0.5 rounded-full">
                    {selectedCommonTasks.length} selected
                  </span>
                </div>

                {/* Search input for pending tasks */}
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

                {/* Pending Tasks Selectable List */}
                {(() => {
                  const availablePending = pendingRepairTasks
                    .filter((t) => t.taskNo !== selectedTask?.taskNo)
                    .filter((t) => {
                      if (!commonSearchTerm) return true;
                      const term = commonSearchTerm.toLowerCase();
                      return (
                        (t.taskNo || "").toLowerCase().includes(term) ||
                        (t.machineName || "").toLowerCase().includes(term) ||
                        (t.transporterName || "").toLowerCase().includes(term)
                      );
                    });

                  if (availablePending.length === 0) {
                    return (
                      <div className="p-3 bg-white rounded border border-dashed border-gray-300 text-center text-xs text-gray-500">
                        {commonSearchTerm ? "No matching pending tasks found" : "No other pending tasks available to link"}
                      </div>
                    );
                  }

                  return (
                    <div className="max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-md divide-y divide-gray-100 shadow-xs">
                      {availablePending.map((t) => {
                        const isChecked = selectedCommonTasks.includes(t.taskNo);
                        return (
                          <div
                            key={t.taskNo}
                            onClick={() => {
                              setSelectedCommonTasks((prev) =>
                                isChecked
                                  ? prev.filter((no) => no !== t.taskNo)
                                  : [...prev, t.taskNo]
                              );
                            }}
                            className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors ${isChecked ? "bg-indigo-50/80 font-medium" : "hover:bg-gray-50"
                              }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => { }} // handled by parent div onClick
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
                              <span>{t.transporterName || "-"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Selected tasks chips */}
                {selectedCommonTasks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedCommonTasks.map((tNo) => (
                      <span
                        key={tNo}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-semibold"
                      >
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Bill Amount *
              </label>
              <input
                type="number"
                value={formData.totalBillAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    totalBillAmount: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bill Image *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    billImage: e.target.files[0],
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* <div>
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
            </div> */}

            {formData.totalBillAmount && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Be Paid Amount
                </label>
                <input
                  type="number"
                  value={
                    selectedTask?.howMuch != null &&
                      formData.totalBillAmount - selectedTask.howMuch >= 0
                      ? formData.totalBillAmount - selectedTask.howMuch
                      : ""
                  }
                  readOnly
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md focus:outline-none"
                />
              </div>
            )}

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
              {loaderSubmit && <Loader2Icon className="animate-spin" />}
              Submit
            </Button>
          </div>
        </form>
      </Modal>

      {/* Common Bill Tasks Detail Modal */}
      <Modal
        isOpen={commonDetailModalOpen}
        onClose={() => setCommonDetailModalOpen(false)}
        title={`Common Bill Tasks for ${commonDetailParentTask?.taskNo || ""}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <span className="text-gray-500 font-medium">Independent Task: </span>
              <strong className="text-blue-700 text-base">{commonDetailParentTask?.taskNo}</strong>
              <span className="text-gray-600 ml-2 font-medium">({commonDetailParentTask?.machineName})</span>
            </div>
            <div className="text-xs text-gray-600">
              Bill No: <strong className="text-gray-900">{commonDetailParentTask?.billNo || "-"}</strong>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Repair Task Number
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Machine Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Transporter Name *
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Type of Bill
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {commonDetailTasksList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-sm">
                      No linked common tasks found.
                    </td>
                  </tr>
                ) : (
                  commonDetailTasksList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-blue-600">{item.taskNo}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{item.machineName}</td>
                      <td className="px-4 py-2.5 text-gray-600">{item.transporterName || "-"}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          {item.typeOfBill}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCommonDetailModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CheckMachine;
