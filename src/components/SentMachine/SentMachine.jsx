import React, { useEffect, useState } from "react";
import { Search, Filter, Send, Loader2Icon } from "lucide-react";
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
import { fetchRepairTasks as fetchRepairTasksSvc } from "../../services/repairService";

const SentMachine = () => {
  const { user } = useAuth();
  const { vendors, transporters, repairTasks, setRepairTasks } = useDataStore();
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [formData, setFormData] = useState({
    vendorName: "",
    transporterName: "",
    transportationCharges: "",
    weighmentSlip: "",
    transportingImage: "",
    leadTimeToDeliver: "",
    paymentType: "",
    advancePayment: "",
  });

  const filteredTasks = tasks.filter(
    (task) => user?.role === "admin" || task.nameOfIndenter === user?.name
  );

  const handleSentClick = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const [loadingTasks, setLoadingTasks] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  // Dynamically compute unique values for filters from accessible tasks
  const uniqueFirms = ["All", ...new Set(filteredTasks.map(t => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(filteredTasks.map(t => t.department).filter(Boolean))];

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
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      // Use shared service — returns objects keyed by sheet header names (Row 6)
      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => ({
        id: `sent-task-${index}`,
        taskNo: row["Task No"] || "",
        firmName: row["Firm Name"] || "",
        serialNo: row["Serial No"] || "",
        machineName: row["Machine Name"] || "",
        machinePartName: row["Machine Part Name"] || "",
        doerName: row["Doer Name"] || "",
        problem: row["Problem"] || "",
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
        paymentType: row["Payment Type"] || "",
        howMuch: row["How Much"] || "",
      }));

      setTasks(formattedTasks);
      setRepairTasks(formattedTasks);

      // ✅ PENDING: Planned 1 bhari ho + Actual 1 KHALI ho
      setPendingTasks(formattedTasks.filter((t) => t.planned && !t.actual));

      // ✅ HISTORY: Dono bhari hoon
      setHistoryTasks(formattedTasks.filter((t) => t.planned && t.actual));

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

        // console.log("base64Data", base64Data);
        // console.log("file.name", file.name);
        // console.log("file.type", file.type);
        // console.log("FOLDER_ID", FOLDER_ID);

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

          console.log("FileUploadData", data);

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
    console.log(
      "form",
      formData.paymentType === "Advance" ? formData.advancePayment : "6"
    );
    try {
      let imageUrl = "";
      setLoaderSubmit(true);
      if (formData.transportingImage) {
        imageUrl = await uploadFileToDrive(formData.transportingImage);
      }

    const payload = {
  action: "update1",
  sheetName: "Repair System",
  taskNo: selectedTask.taskNo,

  Actual: new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
  }),

  // 👇 header जैसा ही key लिखो ("Actual 1")
  "Actual 1": new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
  }),

  "Vendor Name": formData.vendorName,
  "(Transporter Name)": formData.transporterName,
  "Transportation Charges": formData.transportationCharges,
  "Weighment Slip": formData.weighmentSlip,
  "Transporting Image With Machine": imageUrl,
  "Lead Time To Deliver ( In No. Of Days)": formData.leadTimeToDeliver,
  "Payment Type": formData.paymentType,
  "How Much": formData.paymentType === "Advance" ? formData.advancePayment : "",
};
      console.log("payload", payload);

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();
      console.log("Update result:", result);

      if (result.success) {
        alert("✅ Task updated successfully");
        setIsModalOpen(false);
        fetchAllTasks(); // refresh the table
      } else {
        alert("❌ Failed to update task: " + result.message);
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("❌ Something went wrong while submitting");
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

  console.log("history", historyTasks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Sent Machine</h1>
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
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-gray-500">
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
                      <TableCell>
                        {task.taskStartDate ? new Date(task.taskStartDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
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
                <TableHead className="min-w-[120px]">Advance Amount</TableHead>
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
                      <TableCell>
                        {task.taskStartDate ? new Date(task.taskStartDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>{task.serialNo}</TableCell>
                      <TableCell className="font-medium text-gray-900">{task.machineName}</TableCell>
                      <TableCell>{task.doerName}</TableCell>
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
                        {task.howMuch ? `₹${Number(task.howMuch).toLocaleString()}` : "-"}
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
        title="Send Machine to Vendor"
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
                Vendor Name *
              </label>
              <select
                value={formData.vendorName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    vendorName: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-800"
              >
                <option value="">Select Vendor Name</option>
                {vendors.map((vendor, index) => (
                  <option key={index} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transporter Name
              </label>
              <select
                value={formData.transporterName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transporterName: e.target.value,
                  }))
                }
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
                Transportation Charges
              </label>
              <input
                type="number"
                value={formData.transportationCharges}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transportationCharges: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weighment Slip
              </label>
              <input
                type="text"
                value={formData.weighmentSlip}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    weighmentSlip: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lead Time To Deliver ( In No. Of Days)
            </label>
            <input
              type="number"
              value={formData.leadTimeToDeliver}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  leadTimeToDeliver: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transporting Image With Machine
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  transportingImage: e.target.files[0],
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Add Payment Type dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Type *
            </label>
            <select
              value={formData.paymentType || ""}
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
              <option value="Advance">Advance</option>
              <option value="Full">Full</option>
              <option value="Warrenty/Garentie">Warrenty/Garentie</option>
            </select>
          </div>

          {/* Conditionally render Advance Payment input */}
          {formData.paymentType === "Advance" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advance Payment Amount *
              </label>
              <input
                type="number"
                value={formData.advancePayment || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    advancePayment: e.target.value,
                  }))
                }
                required={formData.paymentType === "Advance"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

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

export default SentMachine;
