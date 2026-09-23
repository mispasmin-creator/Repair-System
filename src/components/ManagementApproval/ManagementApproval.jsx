import React, { useEffect, useState } from "react";
import { Search, Filter, ShieldCheck, Loader2Icon, Clock, CheckCircle2 } from "lucide-react";
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

const ManagementApproval = () => {
  const { user } = useAuth();
  const { repairTasks, setRepairTasks } = useDataStore();

  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loaderSubmit, setLoaderSubmit] = useState(false);

  const [allTasks, setAllTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);

  const [remark, setRemark] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;

  const [selectedVendorIndex, setSelectedVendorIndex] = useState(0);

  // Unique filter values
  const uniqueFirms = ["All", ...new Set(allTasks.map((t) => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(allTasks.map((t) => t.department).filter(Boolean))];

  const filterList = (list) => {
    return list
      .filter((task) => selectedFirm === "All" || task.firmName === selectedFirm)
      .filter((task) => selectedDepartment === "All" || task.department === selectedDepartment)
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
          (task.vendorName || "").toLowerCase().includes(term)
        );
      });
  };

  const displayedPendingTasks = filterList(pendingTasks);
  const displayedHistoryTasks = filterList(historyTasks);

  const getVendorsForTask = (task) => {
    if (!task) return [];
    const list = [];

    // Vendor 1
    if (task.vendorName1 && task.vendorName1.trim()) {
      list.push({
        num: 1,
        title: "Vendor 1",
        vendorName: task.vendorName1.trim(),
        transporterName: task.transporterName1 || "",
        transportationCharges: task.transportationCharges1 || "",
        weighmentSlip: task.weighmentSlip1 || "",
        leadTimeToDeliver: task.leadTimeToDeliver1 || "",
        paymentType: task.paymentType1 || "",
        advancePayment: task.advancePayment1 || "",
      });
    }

    // Vendor 2
    if (task.vendorName2 && task.vendorName2.trim()) {
      list.push({
        num: 2,
        title: "Vendor 2",
        vendorName: task.vendorName2.trim(),
        transporterName: task.transporterName2 || "",
        transportationCharges: task.transportationCharges2 || "",
        weighmentSlip: task.weighmentSlip2 || "",
        leadTimeToDeliver: task.leadTimeToDeliver2 || "",
        paymentType: task.paymentType2 || "",
        advancePayment: task.advancePayment2 || "",
      });
    }

    // Vendor 3
    if (task.vendorName3 && task.vendorName3.trim()) {
      list.push({
        num: 3,
        title: "Vendor 3",
        vendorName: task.vendorName3.trim(),
        transporterName: task.transporterName3 || "",
        transportationCharges: task.transportationCharges3 || "",
        weighmentSlip: task.weighmentSlip3 || "",
        leadTimeToDeliver: task.leadTimeToDeliver3 || "",
        paymentType: task.paymentType3 || "",
        advancePayment: task.advancePayment3 || "",
      });
    }

    // Fallback: If no Vendor 1/2/3 data exists (for older entries), use main vendor columns
    if (list.length === 0 && task.vendorName && task.vendorName.trim()) {
      list.push({
        num: 1,
        title: "Vendor 1 (Default)",
        vendorName: task.vendorName.trim(),
        transporterName: task.transporterName || "",
        transportationCharges: task.transportationCharges || "",
        weighmentSlip: task.weighmentSlip || "",
        leadTimeToDeliver: task.leadTimeToDeliverDays || "",
        paymentType: task.paymentType || "",
        advancePayment: task.howMuch || "",
      });
    }

    return list;
  };

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      // Use shared service — returns objects keyed by sheet header names (Row 6)
      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => ({
        id: `mgmt-task-${index}`,
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
        taskStartDate: row["Task Start Date"] || "",
        taskEndDate: row["Task End Date"] || "",
        planned: row["Planned 1"] || "",
        actual: row["Actual 1"] || "",          // Sent to vendor date
        vendorName: row["Vendor Name"] || "",
        leadTimeToDeliverDays: row["Lead Time To Deliver ( In No. Of Days)"] || "",
        transporterName: row["(Transporter Name)"] || "",
        transportationCharges: row["Transportation Charges"] || "",
        paymentType: row["Payment Type"] || "",
        howMuch: row["How Much"] || "",
        managementApprovalDate: row["Management Approval Date"] || "",
        managementRemark: row["Management Remark"] || "",

        // 3-Vendor Comparison Fields
        vendorName1: row["Vendor Name 1"] || "",
        transporterName1: row["(Transporter Name) 1"] || "",
        transportationCharges1: row["Transportation Charges 1"] || "",
        weighmentSlip1: row["Weighment Slip 1"] || "",
        leadTimeToDeliver1: row["Lead Time To Deliver 1"] || "",
        paymentType1: row["Vendor 1 Payment Type"] || "",
        advancePayment1: row["Advance Payment 1"] || "",

        vendorName2: row["Vendor Name 2"] || "",
        transporterName2: row["(Transporter Name) 2"] || "",
        transportationCharges2: row["Transportation Charges 2"] || "",
        weighmentSlip2: row["Weighment Slip 2"] || "",
        leadTimeToDeliver2: row["Lead Time To Deliver 2"] || "",
        paymentType2: row["Vendor 2 Payment Type"] || "",
        advancePayment2: row["Advance Payment 2"] || "",

        vendorName3: row["Vendor Name 3"] || "",
        transporterName3: row["(Transporter Name) 3"] || "",
        transportationCharges3: row["Transportation Charges 3"] || "",
        weighmentSlip3: row["Weighment Slip 3"] || "",
        leadTimeToDeliver3: row["Lead Time To Deliver 3"] || "",
        paymentType3: row["Vendor 3 Payment Type"] || "",
        advancePayment3: row["Advance Payment 3"] || "",

        approvedVendorName: row["Approved Vendor Name"] || "",
        approvedPaymentTerm: row["Approved Payment Term"] || "",
        threePartyStatus: row["ThreePartyStatus"] || "",
      }));

      setAllTasks(formattedTasks);
      setRepairTasks(formattedTasks);

      // ✅ PENDING: Actual 1 bhari ho + Management Approval Date KHALI ho
      setPendingTasks(formattedTasks.filter((t) => t.actual && !t.managementApprovalDate));

      // ✅ HISTORY: Management Approval Date bhari ho
      setHistoryTasks(formattedTasks.filter((t) => t.managementApprovalDate));

    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error("Failed to fetch tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    const hasData = repairTasks && repairTasks.length > 0;
    fetchAllTasks(hasData);
  }, []);

  const handleApproveClick = (task) => {
    setSelectedTask(task);
    setRemark("");
    const vendors = getVendorsForTask(task);
    const preferredName = (task.approvedVendorName || task.vendorName || "").toLowerCase().trim();
    const foundIdx = vendors.findIndex(
      (v) => (v.vendorName || "").toLowerCase().trim() === preferredName
    );
    setSelectedVendorIndex(foundIdx !== -1 ? foundIdx : 0);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;

    const vendors = getVendorsForTask(selectedTask);
    const chosenVendor = vendors[selectedVendorIndex] || vendors[0];

    if (!chosenVendor || !chosenVendor.vendorName) {
      toast.error("Please select a vendor to approve");
      return;
    }

    try {
      setLoaderSubmit(true);

      const approvalDate = new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Kolkata",
      });

      const payload = {
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,
        "Management Approval Date": approvalDate,
        "Management Remark": remark,

        // Approved Vendor details
        "Approved Vendor Name": chosenVendor.vendorName,
        "Approved Payment Term": chosenVendor.paymentType || "",
        ThreePartyStatus: "Approved",

        // Update core columns with approved vendor
        "Vendor Name": chosenVendor.vendorName,
        "(Transporter Name)": chosenVendor.transporterName || "",
        "Transportation Charges": chosenVendor.transportationCharges || "",
        "Weighment Slip": chosenVendor.weighmentSlip || "",
        "Lead Time To Deliver ( In No. Of Days)": chosenVendor.leadTimeToDeliver || "",
        "Payment Type": chosenVendor.paymentType || "",
        "Payment type 2": chosenVendor.paymentType || "",
        "How Much":
          (chosenVendor.paymentType || "").toLowerCase() === "advance"
            ? chosenVendor.advancePayment || ""
            : "",
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
        // If paymentType is Advance, also insert into Repair FMS Advance Payment tab
        if ((chosenVendor.paymentType || "").toLowerCase() === "advance") {
          try {
            const advancePayload = {
              action: "insert1",
              sheetName: "Repair FMS Advance Payment",
              "Timestamp": approvalDate,
              "Repair Task No": selectedTask.taskNo,
              "Firm Name": selectedTask.firmName || "",
              "Serial No": selectedTask.serialNo || "",
              "Machine Name": selectedTask.machineName || "",
              "Machine Part Name": selectedTask.machinePartName || "",
              "Department": selectedTask.department || "",
              "Vendor Name ": chosenVendor.vendorName || "",
              "Payment Type": chosenVendor.paymentType || "Advance",
              "To Be Paid Amount": chosenVendor.advancePayment || "",
              "Total Bill Amount": selectedTask.totalBillAmount || chosenVendor.totalBillAmount || chosenVendor.totalAmount || "",
              "Management Approval Date": approvalDate,
              "Management Remark": remark,
            };
            await fetch(SCRIPT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams(advancePayload).toString(),
            });
          } catch (advErr) {
            console.error("Error inserting into Repair FMS Advance Payment:", advErr);
          }
        }

        toast.success(`Task ${selectedTask.taskNo} approved successfully!`);
        setIsModalOpen(false);
        fetchAllTasks();
      } else {
        toast.error("Failed to approve: " + (result.message || result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Something went wrong while submitting");
    } finally {
      setLoaderSubmit(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "Critical": return "bg-red-100 text-red-800";
      case "High": return "bg-orange-100 text-orange-800";
      case "Medium": return "bg-yellow-100 text-yellow-800";
      case "Low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Management Approval</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tabs */}
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
              <Clock className="w-4 h-4 inline mr-1" />
              Pending Approvals ({displayedPendingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Approval History ({displayedHistoryTasks.length})
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
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* PENDING TAB */}
        {activeTab === "pending" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[100px] text-center">Action</TableHead>
                <TableHead className="min-w-[120px]">Task No</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[130px]">Part Name</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[120px]">Department</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[130px]">Advance Amount</TableHead>
                <TableHead className="min-w-[100px]">Priority</TableHead>
                <TableHead className="min-w-[140px]">Sent Date</TableHead>
                <TableHead className="min-w-[140px]">Pending Since</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-gray-500">
                      No pending approvals found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedPendingTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleApproveClick(task)}
                          className="flex items-center mx-auto bg-green-600 hover:bg-green-700"
                        >
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">{task.taskNo}</TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.machinePartName || "-"}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
                      <TableCell>{task.department}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          task.paymentType === "Advance"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {task.paymentType || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority || "Normal"}
                        </span>
                      </TableCell>
                      <TableCell>{task.actual || "-"}</TableCell>
                      <TableCell>{task.managementPendingDate || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[120px]">Task No</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[130px]">Part Name</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[120px]">Department</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[130px]">Advance Amount</TableHead>
                <TableHead className="min-w-[100px]">Priority</TableHead>
                <TableHead className="min-w-[150px]">Approved Date</TableHead>
                <TableHead className="min-w-[200px]">Management Remark</TableHead>
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
                ) : displayedHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-gray-500">
                      No approval history found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedHistoryTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="font-medium text-blue-600">{task.taskNo}</TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.machinePartName || "-"}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
                      <TableCell>{task.department}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          task.paymentType === "Advance"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {task.paymentType || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority || "Normal"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center text-green-700 font-medium text-sm">
                          <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                          {task.managementApprovalDate}
                        </span>
                      </TableCell>
                      <TableCell>{task.managementRemark || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Approve Management Request"
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Compact Task Info Bar */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <span className="text-gray-500 font-medium block">Task No</span>
              <span className="font-bold text-blue-600 text-sm">{selectedTask?.taskNo}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">Machine</span>
              <span className="font-semibold text-gray-800 text-sm truncate block" title={selectedTask?.machineName}>
                {selectedTask?.machineName}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">Department</span>
              <span className="font-semibold text-gray-800 text-sm truncate block">
                {selectedTask?.department || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">Priority</span>
              <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full mt-0.5 ${getPriorityColor(selectedTask?.priority)}`}>
                {selectedTask?.priority || "Normal"}
              </span>
            </div>
            {selectedTask?.problem && (
              <div className="col-span-2 sm:col-span-4 pt-1.5 border-t border-slate-200 text-gray-600">
                <span className="font-medium text-gray-700">Problem: </span>
                {selectedTask.problem}
              </div>
            )}
          </div>

          {/* 3-Vendor Comparison & Selection Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <label className="block text-sm font-bold text-gray-800">
                  Vendor Comparison & Approval Selection
                </label>
                <p className="text-xs text-gray-500">
                  Select the vendor quotation you want to approve:
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {getVendorsForTask(selectedTask).length} Vendor Quotation(s)
              </span>
            </div>

            {getVendorsForTask(selectedTask).length === 0 ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 text-center">
                No vendor quotations found for this task.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {getVendorsForTask(selectedTask).map((vendor, idx) => {
                  const isSelected = selectedVendorIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedVendorIndex(idx)}
                      className={`relative rounded-xl p-3.5 cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? "border-2 border-green-600 bg-green-50/40 shadow-md ring-2 ring-green-500/20"
                          : "border border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm"
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {vendor.title}
                          </span>
                          <div className="flex items-center">
                            {isSelected ? (
                              <span className="flex items-center text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" />
                                Selected
                              </span>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>
                            )}
                          </div>
                        </div>

                        {/* Vendor Name */}
                        <h4 className="font-bold text-gray-900 text-sm mb-2.5 truncate" title={vendor.vendorName}>
                          {vendor.vendorName}
                        </h4>

                        {/* Detailed breakdown */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center py-0.5 border-b border-gray-100">
                            <span className="text-gray-500">Transporter:</span>
                            <span className="font-medium text-gray-800 text-right truncate max-w-[110px]" title={vendor.transporterName}>
                              {vendor.transporterName || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-gray-100">
                            <span className="text-gray-500">Transport Charges:</span>
                            <span className="font-semibold text-gray-800">
                              {vendor.transportationCharges ? `₹${Number(vendor.transportationCharges).toLocaleString()}` : "-"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-gray-100">
                            <span className="text-gray-500">Lead Time:</span>
                            <span className="font-semibold text-gray-800">
                              {vendor.leadTimeToDeliver ? `${vendor.leadTimeToDeliver} Days` : "-"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-gray-100">
                            <span className="text-gray-500">Payment Type:</span>
                            <span className={`px-1.5 py-0.5 text-[11px] font-semibold rounded ${
                              (vendor.paymentType || "").toLowerCase() === "advance"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {vendor.paymentType || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-gray-100">
                            <span className="text-gray-500">Advance Amount:</span>
                            <span className={`font-bold ${
                              vendor.advancePayment ? "text-orange-600" : "text-gray-700"
                            }`}>
                              {vendor.advancePayment ? `₹${Number(vendor.advancePayment).toLocaleString()}` : "-"}
                            </span>
                          </div>
                          {vendor.weighmentSlip && (
                            <div className="flex justify-between items-center py-0.5">
                              <span className="text-gray-500">Weighment Slip:</span>
                              <span className="font-medium text-gray-800 truncate max-w-[110px]" title={vendor.weighmentSlip}>
                                {vendor.weighmentSlip}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Bottom CTA */}
                      <div className="mt-3 pt-2 border-t border-gray-100 text-center">
                        <span className={`text-[11px] font-semibold block ${
                          isSelected ? "text-green-700 font-bold" : "text-gray-400 group-hover:text-gray-600"
                        }`}>
                          {isSelected ? "✓ Chosen for Approval" : "Click to select this vendor"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Remark input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Management Approval Remark
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter approval remarks (e.g. Approved best quotation, OK for advance payment)..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              {getVendorsForTask(selectedTask)[selectedVendorIndex]?.vendorName && (
                <span>
                  Approving: <strong className="text-gray-900 font-bold">{getVendorsForTask(selectedTask)[selectedVendorIndex]?.vendorName}</strong>
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                disabled={loaderSubmit || getVendorsForTask(selectedTask).length === 0}
              >
                {loaderSubmit && <Loader2Icon className="animate-spin w-4 h-4" />}
                <ShieldCheck className="w-4 h-4" />
                Confirm Approve
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManagementApproval;
