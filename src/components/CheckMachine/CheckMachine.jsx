import React, { useEffect, useState } from "react";
import { Search, Filter, CheckCircle, Loader2Icon } from "lucide-react";
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
    setIsModalOpen(true);
  };
  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingTasks(true);
      }
      const SHEET_NAME_TASK = "Repair System";

      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&&sheet=${SHEET_NAME_TASK}`
      );
      const result = await res.json();

      const allRows = result?.table?.rows || [];
      const taskRows = allRows.slice(5);

      const formattedTasks = taskRows.map((row) => {
        const cells = row.c;

        return {
          timestamp: cells[0]?.v || "",
          taskNo: cells[1]?.v || "",
          firmName: cells[2]?.v || "",
          serialNo: cells[3]?.v || "",
          machineName: cells[4]?.v || "",
          machinePartName: cells[5]?.v || "",
          givenBy: cells[6]?.v || "",
          doerName: cells[7]?.v || "",
          problem: cells[8]?.v || "",
          enableReminder: cells[9]?.v || "",
          requireAttachment: cells[10]?.v || "",
          taskStartDate: cells[11]?.v || "",
          taskEndDate: cells[12]?.v || "",
          priority: cells[13]?.v || "",
          department: cells[14]?.v || "",
          location: cells[15]?.v || "",
          imageUrl: cells[16]?.v || "",
          planned: cells[17]?.v || "",
          actual: cells[18]?.v || "",
          delay: cells[19]?.v || "",
          vendorName: cells[20]?.v || "",
          leadTimeToDeliverDays: cells[21]?.v || "",
          transporterName: cells[22]?.v || "",
          transportationCharges: cells[23]?.v || "",
          weighmentSlip: cells[24]?.v || "",
          transportingImageWithMachine: cells[25]?.v || "",
          paymentType: cells[26]?.v || "",
          howMuch: cells[27]?.v || "",
          planned1: cells[28]?.v || "",
          actual1: cells[29]?.v || "",
          tranporterName: cells[31]?.v || "",
          billImage: cells[33]?.v || "",
          billNo: cells[34]?.v || "",
          typeOfBill: cells[35]?.v || "",
          totalBillAmount: cells[36]?.v || "",
          toBePaidAmount: cells[37]?.v || "",
        };
      });

      const userFirmName = user?.firmName || "";
      const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";

      const filtered = formattedTasks.filter((task) => {
        if (isAllFirm) return true;
        return (task.firmName || "").toLowerCase() === userFirmName.toLowerCase();
      });

      setRepairTasks(filtered);

      // Set pending tasks - where AB (planned1) is not empty and AC (actual1) is empty
      const pendingTasks = filtered.filter(
        (task) => task.planned1 && !task.actual1
      );
      setPendingRepairTasks(pendingTasks);

      // Set history tasks - where both AB (planned1) and AC (actual1) are not empty
      const historyTasks = filtered.filter(
        (task) => task.planned1 && task.actual1
      );
      setHistoryRepairTasks(historyTasks);
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

      const payload = {
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,
         "Actual 2": new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
  }),
        "Transporter Name": formData.transporterName,
        "Transportation Amount": formData.transportationAmount,
        "Bill Image": billImageUrl,
        "Bill No.": formData.billNo,
        "Type of Bill": formData.typeOfBill,
        "Total Bill Amount": formData.totalBillAmount,
        "To Be Paid Amount": formData.toBePaidAmount,
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
        // Update the Zustand store
        updateRepairTask(selectedTask.taskNo, {
          actual1: payload.Actual1,
          transporterName: formData.transporterName,
          transportationAmount: formData.transportationAmount,
          billImage: billImageUrl,
          billNo: formData.billNo,
          typeOfBill: formData.typeOfBill,
          totalBillAmount: formData.totalBillAmount,
          toBePaidAmount: formData.toBePaidAmount
        });
        
        toast.success("✅ Task updated successfully");
        setIsModalOpen(false);
        fetchAllTasks(); // refresh the table
      } else {
        toast.error("❌ Failed to update task: " + result.message);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Something went wrong while submitting");
    } finally {
      setLoaderSubmit(false);
    }
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
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Pending ({displayedPendingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "history"
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
                    <TableCell colSpan={11} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-gray-500">
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
                        {task.taskNo}
                      </TableCell>
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
                    <TableCell colSpan={15} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12 text-gray-500">
                      No history tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedHistoryTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="font-medium text-blue-600">
                        {task.taskNo}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.planned1 || "-"}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>{task.leadTimeToDeliverDays ? `${task.leadTimeToDeliverDays} Days` : "-"}</TableCell>
                      <TableCell>{task.paymentType || "-"}</TableCell>
                      <TableCell>{task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}</TableCell>
                      <TableCell>{task.tranporterName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {task.toBePaidAmount ? `₹${Number(task.toBePaidAmount).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>{task.billNo || "-"}</TableCell>
                      <TableCell>{task.typeOfBill || "-"}</TableCell>
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
                <option value="">Select Bill Type</option>
                <option value="Service Bill">Service Bill</option>
                <option value="Material Bill">Material Bill</option>
                <option value="Labor Bill">Labor Bill</option>
                <option value="Combined Bill">Combined Bill</option>
              </select>
            </div>

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
    </div>
  );
};

export default CheckMachine;
