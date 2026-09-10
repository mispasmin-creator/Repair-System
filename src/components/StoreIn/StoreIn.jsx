import React, { useEffect, useState } from "react";
import { Search, Filter, Package, Loader2Icon } from "lucide-react";
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

const StoreIn = () => {
  const { user } = useAuth();
  const {
    repairTasks,
    pendingRepairTasks,
    historyRepairTasks,
    setRepairTasks,
    setPendingRepairTasks,
    setHistoryRepairTasks,
    updateRepairTask
  } = useDataStore();
  
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    receivedQuantity: "",
    billMatch: false,
    productImage: "",
    billNo: ""
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");

  // Dynamically compute unique values for filters from repairTasks
  const uniqueFirms = ["All", ...new Set(repairTasks.map(t => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(repairTasks.map(t => t.department).filter(Boolean))];

  // Safe filtering with search and dropdown filters
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
        (task.department || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const filteredPendingTasks = filterList(pendingRepairTasks);
  const filteredHistoryTasks = filterList(historyRepairTasks);

  const handleMaterialClick = (task) => {
    setSelectedTask(task);
    setFormData({
      receivedQuantity: task.receivedQuantity || "",
      billMatch: task.billMatch === "Yes",
      productImage: "",
      billNo: task.billNo || ""
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

      const formattedTasks = rawTasks.map((row, index) => ({
        id: `store-task-${index}`,
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
        transporterName: row["(Transporter Name)"] || "",
        transportationCharges: row["Transportation Charges"] || "",
        paymentType: row["Payment Type"] || "",
        howMuch: row["How Much"] || "",
        // Check Machine step
        planned1: row["Planned 2"] || "",
        actual1: row["Actual 2"] || "",
        billImage: row["Bill Image"] || "",
        billNo: row["Bill No."] || "",
        typeOfBill: row["Type of Bill"] || "",
        totalBillAmount: row["Total Bill Amount"] || "",
        toBePaidAmount: row["To Be Paid Amount"] || "",
        // Store In step (Actual 3)
        planned2: row["Planned 3"] || "",
        actual2: row["Actual 3"] || "",        // Local name actual2 maps to sheet 'Actual 3'
        receivedQuantity: row["Received Quantity"] || "",
        billMatch: row["Bill Match"] || "",
        productImage: row["Product Image"] || "",
      }));

      setRepairTasks(formattedTasks);

      // ✅ PENDING: Actual 2 bhari ho + Actual 3 KHALI ho
      setPendingRepairTasks(formattedTasks.filter((t) => t.actual1 && !t.actual2));

      // ✅ HISTORY: Dono bhari hoon
      setHistoryRepairTasks(formattedTasks.filter((t) => t.actual1 && t.actual2));

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
      setSubmitLoading(true);
      let billImageUrl = "";
      if (formData.productImage) {
        billImageUrl = await uploadFileToDrive(formData.productImage);
      }

      const payload = {
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,
        "Actual 3": new Date().toLocaleDateString("en-GB", {
          timeZone: "Asia/Kolkata",
        }),
        "Received Quantity": formData.receivedQuantity,
        "Bill Match": formData.billMatch ? "Yes" : "No",
        "Bill Image": billImageUrl,
        "Bill No.": formData.billNo,
        "Product Image": billImageUrl,
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
          actual2: payload.Actual2,
          receivedQuantity: formData.receivedQuantity,
          billMatch: formData.billMatch ? "Yes" : "No",
          billImage: billImageUrl,
          billNo: formData.billNo,
          productImage: billImageUrl
        });
        
        // Refresh data after successful update
        await fetchAllTasks();
        
        toast.success("✅ Task updated successfully");
        setIsModalOpen(false);
      } else {
        toast.error("❌ Failed to update task: " + result.message);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Something went wrong while submitting");
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(Number(amount))) return "-";
    return `₹${Number(amount).toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Store In</h1>
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
              Pending ({filteredPendingTasks.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`py-4 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              History ({filteredHistoryTasks.length})
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
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={fetchAllTasks}
              disabled={loadingTasks}
            >
              {loadingTasks ? "Refreshing..." : "Refresh"}
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
                <TableHead className="min-w-[100px] text-center">Action</TableHead>
                <TableHead className="min-w-[120px]">Task Number</TableHead>
                <TableHead className="min-w-[130px]">Firm Name</TableHead>
                <TableHead className="min-w-[150px]">Machine Name</TableHead>
                <TableHead className="min-w-[120px]">Serial No</TableHead>
                <TableHead className="min-w-[110px]">Planned Date</TableHead>
                <TableHead className="min-w-[130px]">Indentor Name</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[100px]">Lead Time</TableHead>
                <TableHead className="min-w-[120px]">Payment Type</TableHead>
                <TableHead className="min-w-[140px]">Transporter Amount</TableHead>
                <TableHead className="min-w-[120px]">Bill Image</TableHead>
                <TableHead className="min-w-[120px]">Bill No</TableHead>
                <TableHead className="min-w-[120px]">Total Bill Amount</TableHead>
                <TableHead className="min-w-[120px]">To Be Paid</TableHead>
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
                ) : filteredPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-12 text-gray-500">
                      No pending tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPendingTasks.map((task) => (
                    <TableRow key={task.id || task.taskNo}>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleMaterialClick(task)}
                          className="flex items-center mx-auto"
                        >
                          <Package className="w-3.5 h-3.5 mr-1" />
                          Material
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600">
                        {task.taskNo || "-"}
                      </TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName || "-"}</TableCell>
                      <TableCell>{task.serialNo || "-"}</TableCell>
                      <TableCell>{task.planned2 || "-"}</TableCell>
                      <TableCell>{task.doerName || "-"}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>{task.leadTimeToDeliverDays ? `${task.leadTimeToDeliverDays} Days` : "-"}</TableCell>
                      <TableCell>{task.paymentType || "-"}</TableCell>
                      <TableCell>{task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}</TableCell>
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
                      <TableCell>{task.billNo || "-"}</TableCell>
                      <TableCell>{formatCurrency(task.totalBillAmount)}</TableCell>
                      <TableCell className="font-medium text-gray-900">{formatCurrency(task.toBePaidAmount)}</TableCell>
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
                <TableHead className="min-w-[140px]">Part Name</TableHead>
                <TableHead className="min-w-[140px]">Vendor Name</TableHead>
                <TableHead className="min-w-[130px]">Received Quantity</TableHead>
                <TableHead className="min-w-[120px]">Bill Image</TableHead>
                <TableHead className="min-w-[120px]">Bill Amount</TableHead>
                <TableHead className="min-w-[120px]">To Be Paid</TableHead>
                <TableHead className="min-w-[120px]">Bill Match</TableHead>
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
                ) : filteredHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-gray-500">
                      No history tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistoryTasks.map((task) => (
                    <TableRow key={task.id || task.taskNo}>
                      <TableCell className="font-medium text-blue-600">
                        {task.taskNo || "-"}
                      </TableCell>
                      <TableCell>{task.firmName || "-"}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName || "-"}</TableCell>
                      <TableCell>{task.serialNo || "-"}</TableCell>
                      <TableCell>{task.machinePartName || "-"}</TableCell>
                      <TableCell>{task.vendorName || "-"}</TableCell>
                      <TableCell>{task.receivedQuantity || "-"}</TableCell>
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
                      <TableCell>{formatCurrency(task.totalBillAmount)}</TableCell>
                      <TableCell className="font-medium text-gray-900">{formatCurrency(task.toBePaidAmount)}</TableCell>
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
        title="Store In Material"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor Name (Read-only)
              </label>
              <input
                type="text"
                value={selectedTask?.vendorName || ""}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Received *
              </label>
              <select
                value={formData.receivedQuantity}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    receivedQuantity: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Product Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  productImage: e.target.files[0] || "",
                }))
              }
              className="block w-full text-sm text-gray-500
               file:mr-4 file:py-2 file:px-4
               file:rounded-full file:border-0
               file:text-sm file:font-semibold
               file:bg-blue-50 file:text-blue-700
               hover:file:bg-blue-100"
            />
          </div>

          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.billMatch}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    billMatch: e.target.checked,
                  }))
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Bill Match</span>
            </label>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitLoading}>
              {submitLoading && <Loader2Icon className="animate-spin mr-2" />}
              Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StoreIn;