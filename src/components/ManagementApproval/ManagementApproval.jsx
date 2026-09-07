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
        doerName: row["Doer Name"] || "",
        problem: row["Problem"] || "",
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
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
        toast.success("✅ Task approved successfully!");
        setIsModalOpen(false);
        fetchAllTasks();
      } else {
        toast.error("❌ Failed to approve: " + result.message);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Something went wrong while submitting");
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
                    <TableCell colSpan={13} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-gray-500">
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
                    <TableCell colSpan={12} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-3 text-sm text-gray-500 font-medium">Loading tasks...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedHistoryTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                      No approval history found
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedHistoryTasks.map((task) => (
                    <TableRow key={task.taskNo || Math.random()}>
                      <TableCell className="font-medium text-blue-600">{task.taskNo}</TableCell>
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
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task details (read-only) */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-500 font-medium">Task No:</span>
                <p className="font-bold text-blue-600">{selectedTask?.taskNo}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Machine:</span>
                <p className="font-semibold text-gray-800">{selectedTask?.machineName}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Vendor:</span>
                <p className="font-semibold text-gray-800">{selectedTask?.vendorName || "-"}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Payment Type:</span>
                <p className="font-semibold text-gray-800">{selectedTask?.paymentType || "-"}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Advance Amount:</span>
                <p className="font-bold text-orange-600">
                  {selectedTask?.howMuch ? `₹${Number(selectedTask.howMuch).toLocaleString()}` : "-"}
                </p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Department:</span>
                <p className="font-semibold text-gray-800">{selectedTask?.department || "-"}</p>
              </div>
            </div>
          </div>

          {/* Remark input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Management Remark
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter approval remarks (optional)..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
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
            >
              {loaderSubmit && <Loader2Icon className="animate-spin w-4 h-4" />}
              <ShieldCheck className="w-4 h-4" />
              Confirm Approve
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManagementApproval;
