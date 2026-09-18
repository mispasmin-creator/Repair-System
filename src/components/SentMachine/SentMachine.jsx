import React, { useEffect, useState, useMemo } from "react";
import { Search, Filter, Send, Loader2Icon, X, ChevronsUpDown } from "lucide-react";
import Button from "../ui/Button";
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

const createEmptyVendorForm = (defaultName = "") => ({
  vendorName: defaultName,
  transporterName: "",
  transportationCharges: "",
  weighmentSlip: "",
  leadTimeToDeliver: "",
  transportingImage: null,
  paymentType: "",
  advancePayment: "",
});

const SentMachine = () => {
  const { user } = useAuth();
  const {
    vendors,
    transporters,
    paymentTypes: storePaymentTypes,
    setPaymentTypes: setStorePaymentTypes,
    repairTasks,
    setRepairTasks,
  } = useDataStore();
  const [paymentTypes, setPaymentTypes] = useState(storePaymentTypes || []);
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [loaderSubmit, setLoaderSubmit] = useState(false);

  const [vendorForms, setVendorForms] = useState([
    createEmptyVendorForm(),
    createEmptyVendorForm(),
    createEmptyVendorForm(),
  ]);
  const [selectedVendorIndex, setSelectedVendorIndex] = useState(0);

  const filteredTasks = tasks.filter(
    (task) => user?.role === "admin" || task.nameOfIndenter === user?.name || task.doerName === user?.name
  );

  const handleSentClick = (task) => {
    setSelectedTask(task);
    setVendorForms([
      createEmptyVendorForm(task.vendorName || ""),
      createEmptyVendorForm(""),
      createEmptyVendorForm(""),
    ]);
    setSelectedVendorIndex(0);
    setIsModalOpen(true);
  };

  const [loadingTasks, setLoadingTasks] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  // Dynamically compute unique values for filters from accessible tasks
  const uniqueFirms = ["All", ...new Set(filteredTasks.map((t) => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(filteredTasks.map((t) => t.department).filter(Boolean))];

  // Filter function
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
          (task.machinePartName || "").toLowerCase().includes(term)
        );
      });
  };

  const displayedPendingTasks = filterList(pendingTasks);
  const displayedHistoryTasks = filterList(historyTasks);

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => ({
        id: `sent-task-${index}`,
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
        imageUrl: row["Image Link"] || "",
        // Sent Machine columns
        planned: row["Planned 1"] || "",
        actual: row["Actual 1"] || "",
        delay: row["Delay 1"] || "",
        vendorName: row["Vendor Name"] || "",
        leadTimeToDeliverDays: row["Lead Time To Deliver ( In No. Of Days)"] || "",
        transporterName: row["(Transporter Name)"] || "",
        transportationCharges: row["Transportation Charges"] || "",
        weighmentSlip: row["Weighment Slip"] || "",
        transportingImageWithMachine: row["Transporting Image With Machine"] || "",
        paymentType: row["Payment Type"] || "",
        howMuch: row["How Much"] || "",
        amount: row["Amount"] || "",
      }));

      setTasks(formattedTasks);
      setRepairTasks(formattedTasks);

      // Pending: Planned 1 filled + Actual 1 empty
      setPendingTasks(formattedTasks.filter((t) => t.planned && !t.actual));

      // History: Both filled
      setHistoryTasks(formattedTasks.filter((t) => t.planned && t.actual));
    } catch (err) {
      console.error("Error fetching tasks:", err);
      toast.error("Failed to fetch tasks");
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchPaymentTypes = async () => {
    try {
      const SHEET_NAME_MASTER = "Master";
      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${import.meta.env.VITE_SHEET_ID}&sheet=${SHEET_NAME_MASTER}`
      );
      const result = await res.json();
      if (result && result.table && result.table.rows) {
        const headers = (result.table.cols || []).map((col) => (col.label || "").toString().trim());
        let pTypeColIdx = headers.findIndex(
          (h) => h.toLowerCase().replace(/[^a-z0-9]/g, "") === "paymenttype"
        );
        if (pTypeColIdx === -1) pTypeColIdx = 6;

        const seen = new Set();
        const types = [];
        result.table.rows.forEach((row) => {
          const cell = row.c && row.c[pTypeColIdx];
          if (cell && cell.v !== null && cell.v !== undefined) {
            const val = cell.v.toString().trim();
            if (val && !seen.has(val.toLowerCase())) {
              seen.add(val.toLowerCase());
              types.push(val);
            }
          }
        });

        if (types.length > 0) {
          setPaymentTypes(types);
          if (setStorePaymentTypes) setStorePaymentTypes(types);
        }
      }
    } catch (err) {
      console.error("Error fetching Payment Type from Master sheet:", err);
    }
  };

  useEffect(() => {
    const hasData = repairTasks && repairTasks.length > 0;
    fetchAllTasks(hasData);
    fetchPaymentTypes();
  }, []);

  useEffect(() => {
    if (storePaymentTypes && storePaymentTypes.length > 0) {
      setPaymentTypes(storePaymentTypes);
    }
  }, [storePaymentTypes]);

  const uploadFileToDrive = async (file) => {
    if (!file) return "";
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
            toast.error("File upload failed");
            resolve("");
          }
        } catch (err) {
          console.error("Upload error:", err);
          toast.error("Upload failed due to network error");
          resolve("");
        }
      };

      reader.onerror = () => {
        reject("Failed to read file");
      };

      reader.readAsDataURL(file);
    });
  };

  const updateVendorForm = (index, field, value) => {
    if (field === "transportationCharges" || field === "leadTimeToDeliver" || field === "advancePayment") {
      value = value.replace(/[^0-9.]/g, "");
    }

    setVendorForms((prev) => {
      const newForms = [...prev];
      newForms[index] = { ...newForms[index], [field]: value };
      return newForms;
    });
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedTask) return;

    const selectedVendor =
      vendorForms[selectedVendorIndex] ||
      vendorForms.find((v) => v.vendorName) ||
      vendorForms[0];

    if (!selectedVendor.vendorName) {
      toast.error("Please select a vendor name for the selected vendor");
      return;
    }

    if (!selectedVendor.paymentType) {
      toast.error("Please select a payment type for the selected vendor");
      return;
    }

    if (!selectedVendor.advancePayment) {
      toast.error(
        (selectedVendor.paymentType || "").toLowerCase() === "advance"
          ? "Please enter advance payment amount"
          : "Please enter amount"
      );
      return;
    }

    setLoaderSubmit(true);
    try {
      let imageUrl = "";
      const imgToUpload = selectedVendor.transportingImage || vendorForms.find((v) => v.transportingImage)?.transportingImage;
      if (imgToUpload) {
        imageUrl = await uploadFileToDrive(imgToUpload);
      }

      const nowTimestamp = new Date().toLocaleString("en-GB", {
        timeZone: "Asia/Kolkata",
      });
      const nowFormatted = new Date().toLocaleDateString("en-GB", {
        timeZone: "Asia/Kolkata",
      });

      const v1 = vendorForms[0];
      const v2 = vendorForms[1];
      const v3 = vendorForms[2];

      const payload = {
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,

        Actual: nowTimestamp,
        "Actual 1": nowFormatted,

        // Core fields for Repair System
        "Vendor Name": selectedVendor.vendorName,
        "(Transporter Name)": selectedVendor.transporterName || "",
        "Transportation Charges": selectedVendor.transportationCharges || "",
        "Weighment Slip": selectedVendor.weighmentSlip || "",
        "Transporting Image With Machine": imageUrl || "",
        "Lead Time To Deliver ( In No. Of Days)": selectedVendor.leadTimeToDeliver || "",
        "Payment Type": selectedVendor.paymentType || "",
        "How Much":
          (selectedVendor.paymentType || "").toLowerCase() === "advance"
            ? selectedVendor.advancePayment
            : "",
        "Amount": selectedVendor.advancePayment || "",
        "Approved Vendor Name": selectedVendor.vendorName,
        "Approved Payment Term": selectedVendor.paymentType || "",
        ThreePartyStatus: "Approved",

        // Separate Vendor 1, 2, 3 fields
        "Vendor Name 1": v1.vendorName || "",
        "(Transporter Name) 1": v1.transporterName || "",
        "Transportation Charges 1": v1.transportationCharges || "",
        "Weighment Slip 1": v1.weighmentSlip || "",
        "Lead Time To Deliver 1": v1.leadTimeToDeliver || "",
        "Vendor 1 Payment Type": v1.paymentType || "",
        "Advance Payment 1": v1.advancePayment || "",

        "Vendor Name 2": v2.vendorName || "",
        "(Transporter Name) 2": v2.transporterName || "",
        "Transportation Charges 2": v2.transportationCharges || "",
        "Weighment Slip 2": v2.weighmentSlip || "",
        "Lead Time To Deliver 2": v2.leadTimeToDeliver || "",
        "Vendor 2 Payment Type": v2.paymentType || "",
        "Advance Payment 2": v2.advancePayment || "",

        "Vendor Name 3": v3.vendorName || "",
        "(Transporter Name) 3": v3.transporterName || "",
        "Transportation Charges 3": v3.transportationCharges || "",
        "Weighment Slip 3": v3.weighmentSlip || "",
        "Lead Time To Deliver 3": v3.leadTimeToDeliver || "",
        "Vendor 3 Payment Type": v3.paymentType || "",
        "Advance Payment 3": v3.advancePayment || "",
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
        toast.success(`Task ${selectedTask.taskNo} submitted successfully`);
        setIsModalOpen(false);
        fetchAllTasks();
      } else {
        toast.error("Failed to update task: " + (result.message || result.error || "Unknown error"));
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
      case "Critical":
        return "bg-red-100 text-red-800";
      case "High":
        return "bg-orange-100 text-orange-800";
      case "Medium":
        return "bg-yellow-100 text-yellow-800";
      case "Low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sent to Vendor</h1>
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
              Pending ({pendingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              History ({historyTasks.length})
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

        {activeTab === "pending" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[90px] text-center">Action</TableHead>
                <TableHead className="min-w-[120px]">Task Number</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[110px]">Planned Date</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[120px]">Department</TableHead>
                <TableHead className="min-w-[150px]">Part Name</TableHead>
                <TableHead className="min-w-[100px]">Priority</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                      No pending tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedPendingTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleSentClick(task)}
                          className="flex items-center mx-auto"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Sent
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">
                        {task.taskNo}
                      </TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell>
                        {task.planned ? new Date(task.planned).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.doerName || task.nameOfIndenter || "-"}</TableCell>
                      <TableCell>{task.department}</TableCell>
                      <TableCell>{task.machinePartName || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(
                            task.priority
                          )}`}
                        >
                          {task.priority || "Normal"}
                        </span>
                      </TableCell>
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
                <TableHead className="min-w-[110px]">Planned Date</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[120px]">Department</TableHead>
                <TableHead className="min-w-[150px]">Part Name</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[100px]">Lead Time</TableHead>
                <TableHead className="min-w-[140px]">Transporter</TableHead>
                <TableHead className="min-w-[130px]">Transport Charges</TableHead>
                <TableHead className="min-w-[130px]">Weighment Slip</TableHead>
                <TableHead className="min-w-[130px]">Machine Image</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[120px]">Payment Amount</TableHead>
              </TableHeader>
              <TableBody>
                {loadingTasks ? (
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
                        {task.taskNo}
                      </TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell>
                        {task.planned ? new Date(task.planned).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.doerName || task.nameOfIndenter || "-"}</TableCell>
                      <TableCell>{task.department}</TableCell>
                      <TableCell>{task.machinePartName || "-"}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>{task.leadTimeToDeliverDays ? `${task.leadTimeToDeliverDays} Days` : "-"}</TableCell>
                      <TableCell>{task.transporterName || "-"}</TableCell>
                      <TableCell>
                        {task.transportationCharges ? `₹${Number(task.transportationCharges).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>{task.weighmentSlip || "-"}</TableCell>
                      <TableCell>
                        {task.transportingImageWithMachine ? (
                          <button
                            type="button"
                            className="text-blue-600 underline text-sm hover:text-blue-800 font-medium"
                            onClick={() =>
                              window.open(
                                task.transportingImageWithMachine,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            View Image
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">No Image</span>
                        )}
                      </TableCell>
                      <TableCell>{task.paymentType || "-"}</TableCell>
                      <TableCell>
                        {task.amount || task.howMuch
                          ? `₹${Number(task.amount || task.howMuch).toLocaleString()}`
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Send Machine to Vendor Dialog */}
      {isModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-[1360px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-gray-100 animate-fadeIn">
            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 tracking-tight">Send Machine to Vendor</h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub-header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 mt-3 bg-gray-50/80 rounded-xl border border-gray-100 text-xs">
                <div>
                  <span className="block text-[11px] text-gray-400 font-medium uppercase tracking-wider">Repair Task Number (Read-only)</span>
                  <span className="font-semibold text-gray-800 text-sm">{selectedTask?.taskNo || "-"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-gray-400 font-medium uppercase tracking-wider">Machine Name (Read-only)</span>
                  <span className="font-semibold text-gray-800 text-sm">{selectedTask?.machineName || "-"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-gray-400 font-medium uppercase tracking-wider">Department</span>
                  <span className="font-semibold text-gray-800 text-sm">{selectedTask?.department || "-"}</span>
                </div>
              </div>
            </div>

            {/* Comparison Ribbon */}
            <div className="px-6 pt-4 flex-shrink-0">
              <div className="grid grid-cols-3 gap-4 mb-3">
                {vendorForms.map((v, i) => {
                  const isSelected = selectedVendorIndex === i;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedVendorIndex(i)}
                      className={`p-3.5 rounded-xl border text-center cursor-pointer transition-all ${
                        isSelected
                          ? "border-2 border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500/20"
                          : "border border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="text-xs text-gray-400 font-medium">Vendor {i + 1}</div>
                      <div className="text-base font-bold text-gray-800 truncate mt-0.5">
                        {v.vendorName || `Vendor ${i + 1}`}
                      </div>
                      <div className="text-xs font-semibold text-emerald-600 mt-1">
                        {v.transportationCharges
                          ? `Charges: ₹${Number(v.transportationCharges).toLocaleString()}`
                          : "Charges: ₹0"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body: 3 Columns Form */}
            <div className="flex-1 px-6 pb-4 overflow-y-auto space-y-4" style={{ scrollbarWidth: 'thin' }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {vendorForms.map((currentVendor, idx) => (
                  <div
                    key={idx}
                    className={`p-5 border rounded-2xl bg-white space-y-4 shadow-sm transition-all ${
                      selectedVendorIndex === idx
                        ? "border-emerald-500 ring-1 ring-emerald-500/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <span className="text-sm font-bold text-gray-800">Vendor {idx + 1} Details</span>
                      {selectedVendorIndex === idx ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Selected
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedVendorIndex(idx)}
                          className="text-[11px] font-medium text-gray-500 hover:text-emerald-600 underline"
                        >
                          Select this vendor
                        </button>
                      )}
                    </div>

                    {/* Vendor Name * */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Vendor Name *
                      </label>
                      <div className="relative">
                        <select
                          value={currentVendor.vendorName}
                          onChange={(e) => updateVendorForm(idx, "vendorName", e.target.value)}
                          className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none text-gray-800 pr-8 font-medium"
                        >
                          <option value="">Select Vendor Name</option>
                          {vendors && vendors.map((vendor, vIdx) => (
                            <option key={vIdx} value={vendor}>
                              {vendor}
                            </option>
                          ))}
                        </select>
                        <ChevronsUpDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Transporter Name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Transporter Name
                      </label>
                      <div className="relative">
                        <select
                          value={currentVendor.transporterName}
                          onChange={(e) => updateVendorForm(idx, "transporterName", e.target.value)}
                          className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none text-gray-800 pr-8"
                        >
                          <option value="">Select Transporter Name</option>
                          {transporters && transporters.map((transporter, tIdx) => (
                            <option key={tIdx} value={transporter}>
                              {transporter}
                            </option>
                          ))}
                        </select>
                        <ChevronsUpDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Transportation Charges */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Transportation Charges
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={currentVendor.transportationCharges}
                        onChange={(e) => updateVendorForm(idx, "transportationCharges", e.target.value)}
                        className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-gray-800"
                        placeholder="Enter transportation charges"
                      />
                    </div>

                    {/* Weighment Slip */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Weighment Slip
                      </label>
                      <input
                        type="text"
                        value={currentVendor.weighmentSlip}
                        onChange={(e) => updateVendorForm(idx, "weighmentSlip", e.target.value)}
                        className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-gray-800"
                        placeholder="Enter weighment slip"
                      />
                    </div>

                    {/* Lead Time To Deliver ( In No. Of Days) */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Lead Time To Deliver ( In No. Of Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={currentVendor.leadTimeToDeliver}
                        onChange={(e) => updateVendorForm(idx, "leadTimeToDeliver", e.target.value)}
                        className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-gray-800"
                        placeholder="Enter lead time (in days)"
                      />
                    </div>

                    {/* Transporting Image With Machine */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Transporting Image With Machine
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => updateVendorForm(idx, "transportingImage", e.target.files?.[0] || null)}
                        className="w-full h-10 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                      />
                    </div>

                    {/* Payment Type * */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Payment Type *
                      </label>
                      <div className="relative">
                        <select
                          value={currentVendor.paymentType}
                          onChange={(e) => updateVendorForm(idx, "paymentType", e.target.value)}
                          className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none text-gray-800 pr-8"
                        >
                          <option value="">Select Payment Type</option>
                          {paymentTypes && paymentTypes.map((type, ptIdx) => (
                            <option key={ptIdx} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <ChevronsUpDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Render Amount Input for all Payment Types */}
                    {Boolean(currentVendor.paymentType) && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                          {(currentVendor.paymentType || "").toLowerCase() === "advance"
                            ? "Advance Payment Amount *"
                            : "Amount *"}
                        </label>
                        <input
                          type="number"
                          value={currentVendor.advancePayment}
                          onChange={(e) => updateVendorForm(idx, "advancePayment", e.target.value)}
                          className="w-full h-10 px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-gray-800"
                          placeholder={
                            (currentVendor.paymentType || "").toLowerCase() === "advance"
                              ? "Enter advance payment amount"
                              : "Enter amount"
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-white px-6 py-3.5 flex items-center justify-end space-x-3 rounded-b-2xl flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loaderSubmit}
                className="px-6 py-2 text-xs font-semibold text-white bg-[#b4cf82] hover:bg-[#a1bf6d] rounded-lg transition shadow-xs flex items-center"
              >
                {loaderSubmit && <Loader2Icon className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Submit to Factory Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentMachine;


