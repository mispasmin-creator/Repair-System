import React, { useEffect, useState } from "react";
import { supabase } from "../../services/supabaseClient";
import { Plus, Search, Filter } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { PlannedActualHeads, PlannedActualCells } from "../ui/PlannedActualCells";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/Table";
import IndentForm from "./IndentForm";
import { mockRepairTasks } from "../../data/mockData";
import { useAuth } from "../../context/AuthContext";

const Indent = () => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  // Base accessible tasks based on user role and firm
  const accessibleTasks = tasks.filter((task) => {
    if (!user?.firmName || user.firmName.toLowerCase() === "all") return true;
    // Support multi-firm: "Rkl, Pmmpl"
    const allowedFirms = user.firmName
      .split(",")
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean);
    if (allowedFirms.includes("all")) return true;
    return allowedFirms.includes((task.firmName || "").toLowerCase().trim());
  });

  // Dynamically compute unique values for filters
  const uniqueFirms = ["All", ...new Set(accessibleTasks.map(t => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(accessibleTasks.map(t => t.department).filter(Boolean))];

  // Apply search term and dropdown filters
  const filteredTasks = accessibleTasks
    .filter((task) => selectedFirm === "All" || task.firmName === selectedFirm)
    .filter((task) => selectedDepartment === "All" || task.department === selectedDepartment)
    .filter((task) => selectedPriority === "All" || (task.priority || "").toLowerCase() === selectedPriority.toLowerCase())
    .filter((task) => selectedStatus === "All" || (task.status || "").toLowerCase() === selectedStatus.toLowerCase())
    .filter(
      (task) =>
        (task.machineName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.taskNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.serialNo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.doerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.machinePartName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.uom || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.quantity || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

  const fetchAllTasks = async () => {
    try {
      setLoadingTasks(true);
      const { data, error } = await supabase
        .from("indent")
        .select(`
          *,
          accounts (status_1),
          sent_to_vendor (payment_type_1)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedTasks = (data || []).map((row, index) => {
        const acc = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
        const status = (acc?.status_1 || "").toLowerCase() === "complete" ? "Complete" : "Pending";

        return {
          id: row.id || `task-${index}`,
          plannedDate: row.planned_sent_date || "",
          timestamp: row.created_at ? new Date(row.created_at).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }) : "",
          taskNo: row.task_no || "",
          firmName: row.firm_name || "",
          serialNo: row.serial_no || "",
          machineName: row.machine_name || "",
          machinePartName: row.machine_part_name || "",
          givenBy: row.given_by || "",
          doerName: row.indentor_name || "",
          uom: row.uom || "",
          quantity: row.quantity !== null && row.quantity !== undefined ? String(row.quantity) : "1",
          problem: row.problem_description || "",
          enableReminder: row.enable_reminders ? "Yes" : "No",
          requireAttachment: "No",
          taskStartDate: row.task_start_date ? new Date(row.task_start_date).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }) : "",
          taskEndDate: row.task_ending_date ? new Date(row.task_ending_date).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }) : "",
          priority: row.priority || "Medium",
          department: row.department || "",
          location: row.location || "",
          imageLink: row.machine_image_url || "",
          paymentType: (Array.isArray(row.sent_to_vendor) ? row.sent_to_vendor[0]?.payment_type_1 : row.sent_to_vendor?.payment_type_1) || "-",
          status: status,
        };
      });

      setTasks(formattedTasks);
    } catch (err) {
      console.error("Error fetching tasks from Supabase:", err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, [refreshTrigger]);

  const getPriorityColor = (priority) => {
    const priorityLower = (priority || "").toLowerCase();
    switch (priorityLower) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status) => {
    const statusLower = (status || "").toLowerCase();
    switch (statusLower) {
      case "complete":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const handleAddIndent = () => {
    // Trigger refresh by incrementing the trigger
    setRefreshTrigger(prev => prev + 1);
    setIsModalOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      let str = String(dateString).trim();
      // Remove trailing invalid ":00" like "2026-09-16 :00" or empty " :00"
      str = str.replace(/\s*:00$/, "").trim();
      if (!str) return "N/A";

      // If format is DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
      if (dmyMatch) {
        const [, d, m, y, rest] = dmyMatch;
        const dObj = new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}${rest}`);
        if (!isNaN(dObj.getTime())) {
          return dObj.toLocaleDateString("en-GB");
        }
      }

      const date = new Date(str);
      if (isNaN(date.getTime())) return "N/A";
      return date.toLocaleDateString("en-GB");
    } catch (error) {
      return "N/A";
    }
  };

  // Utility function to truncate text with ellipsis
  const truncateText = (text, maxLength = 20) => {
    if (!text || typeof text !== 'string') return "N/A";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Indent Management</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Indent
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by machine name or task number..."
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
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              disabled={loadingTasks}
            >
              {loadingTasks ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
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

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden">
          <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
            <TableHeader className="bg-white sticky top-0 z-10 shadow-sm">
              <TableHead className="min-w-[120px] whitespace-nowrap">Task Number</TableHead>
              <TableHead className="min-w-[130px]">Firm Name</TableHead>
              <TableHead className="min-w-[150px]">Machine Name</TableHead>
              <TableHead className="min-w-[120px]">Serial No</TableHead>
              <TableHead className="min-w-[140px]">Indentor Name</TableHead>
              <TableHead className="min-w-[120px]">Department</TableHead>
              <TableHead className="min-w-[160px]">Machine Part Name</TableHead>
              <TableHead className="min-w-[100px]">UOM</TableHead>
              <TableHead className="min-w-[100px]">Quantity</TableHead>
              <TableHead className="min-w-[130px]">Machine Image</TableHead>
              <TableHead className="min-w-[120px]">Payment Type</TableHead>
              <TableHead className="min-w-[100px]">Priority</TableHead>
              <TableHead className="min-w-[110px]">Start Date</TableHead>
              <TableHead className="min-w-[110px]">End Date</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <PlannedActualHeads />
            </TableHeader>
            <TableBody>
              {loadingTasks ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="mt-4 text-gray-600">Loading tasks...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={17} className="text-center py-8">
                    <p className="text-gray-500">No tasks found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id || task.taskNo || Math.random()} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-blue-600 min-w-[120px] whitespace-nowrap">
                      {task.taskNo || "N/A"}
                    </TableCell>
                    <TableCell className="min-w-[130px]">
                      <div className="break-words" title={task.firmName || ""}>
                        {truncateText(task.firmName, 20)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <div className="break-words" title={task.machineName || ""}>
                        {truncateText(task.machineName, 25)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="break-words" title={task.serialNo || ""}>
                        {truncateText(task.serialNo, 15)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="break-words" title={task.doerName || ""}>
                        {truncateText(task.doerName, 15)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="break-words" title={task.department || ""}>
                        {truncateText(task.department, 15)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="break-words" title={task.machinePartName || ""}>
                        {truncateText(task.machinePartName, 20)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      <div className="break-words" title={task.uom || ""}>
                        {task.uom || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      <div className="break-words" title={task.quantity || ""}>
                        {task.quantity || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[130px]">
                      {task.imageLink && task.imageLink !== "link not available" && (task.imageLink.startsWith("http://") || task.imageLink.startsWith("https://")) ? (
                        <button
                          type="button"
                          className="text-blue-600 underline text-sm hover:text-blue-800 font-medium"
                          onClick={() =>
                            window.open(
                              task.imageLink,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          View Image
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">No Image</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {task.paymentType || "-"}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getPriorityColor(
                          task.priority
                        )}`}
                      >
                        {task.priority || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[110px] whitespace-nowrap">
                      {formatDate(task.taskStartDate)}
                    </TableCell>
                    <TableCell className="min-w-[110px] whitespace-nowrap">
                      {formatDate(task.taskEndDate)}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize whitespace-nowrap ${getStatusColor(task.status)}`}>
                        {task.status || "N/A"}
                      </span>
                    </TableCell>
                    <PlannedActualCells planned={task.plannedDate} actual={task.timestamp} />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Indent"
        size="xl"
      >
        <IndentForm
          onSubmit={handleAddIndent}
          onCancel={() => setIsModalOpen(false)}
          taskList={tasks}
        />
      </Modal>
    </div>
  );
};

export default Indent;