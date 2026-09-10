import React, { useEffect, useState } from "react";
import { Search, Filter, ClipboardCheck, Calendar, CheckCircle2, ExternalLink } from "lucide-react";
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
import toast from "react-hot-toast";
import { fetchRepairTasks as fetchRepairTasksSvc } from "../../services/repairService";

const FIRM_FORM_URLS = {
  pmmpl: "https://docs.google.com/forms/d/e/1FAIpQLScn8tHEUldlOM_8DKpHUfHHiRImDVjkpkhhfduaZUIxpxlJrA/viewform",
  purab: "https://docs.google.com/forms/d/e/1FAIpQLSdLWKfGPNXK62Orndb137GPKadFiRQZS8W_MM0c11HvdR4KkA/viewform",
  rkl: "https://docs.google.com/forms/d/e/1FAIpQLScJJFvh6zchRosSzX0mU-u7-oeMaQW6iv1osE70hRDoE-uVrg/viewform",
  refrasynth: "https://docs.google.com/forms/d/e/1FAIpQLSdHF5shP_liUbm1tsyOS3nrEmNUY9Y5zl4y2odXK0weaDjcpA/viewform",
  refratech: "https://docs.google.com/forms/d/e/1FAIpQLScTunRezHE3TKtNpXjISVWjnywDwUcT6F62DYtkLlgXL6MMaQ/viewform",
};

const Posting = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    postingDate: new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }),
    voucherNo: "",
    remark: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");
  const [selectedDepartment, setSelectedDepartment] = useState("All");

  const uniqueFirms = ["All", ...new Set(tasks.map((t) => t.firmName).filter(Boolean))];
  const uniqueDepartments = ["All", ...new Set(tasks.map((t) => t.department).filter(Boolean))];

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
        (task.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.billNo || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const filteredPendingTasks = filterList(pendingTasks);
  const filteredHistoryTasks = filterList(historyTasks);

  const handlePostingClick = (task) => {
    setSelectedTask(task);
    setFormData({
      postingDate: new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }),
      voucherNo: "",
      remark: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenForm = (task) => {
    const firmKey = (task.firmName || "").toLowerCase().trim();
    const baseUrl = FIRM_FORM_URLS[firmKey];
    if (!baseUrl) {
      toast.error(`No Google Form configured for firm: "${task.firmName || "Unknown"}"`);
      return;
    }

    const params = new URLSearchParams();
    params.set("usp", "pp_url");
    if (task.taskNo) {
      params.set("entry.1200639812", task.taskNo);
    }
    params.set("entry.604194301", "Repair FMS");
    params.set("entry.1358288895", "Yes");
    if (task.problem || task.machineName) {
      params.set("entry.1091308719", task.problem || task.machineName);
    }

    const fullUrl = `${baseUrl}?${params.toString()}`;
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;

  const formatDate = (val) => {
    if (!val) return "-";
    if (typeof val === "string" && val.includes("T")) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-GB");
      }
    }
    return val;
  };

  const formatCurrency = (amount) => {
    if (!amount) return "-";
    const cleaned = amount.toString().replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? amount : `₹${num.toLocaleString("en-IN")}`;
  };

  const safeFetchJson = async (url, retries = 2, delayMs = 800) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (text.trim().startsWith("<")) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw new Error("Server returned HTML response");
        }
        return JSON.parse(text);
      } catch (err) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
  };

  const fetchAllTasks = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingTasks(true);

      // Use shared service — returns objects keyed by sheet header names (Row 6)
      const rawTasks = await fetchRepairTasksSvc(user?.firmName);

      const formattedTasks = rawTasks.map((row, index) => ({
        id: `posting-task-${index}`,
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
        vendorName: row["Vendor Name"] || "",
        // Previous steps
        actual1: row["Actual 1"] || "",
        actual2: row["Actual 2"] || "",
        actual3: row["Actual 3"] || "",        // Store In done date
        billNo: row["Bill No."] || "",
        typeOfBill: row["Type of Bill"] || "",
        totalBillAmount: row["Total Bill Amount"] || "",
        receivedQuantity: row["Received Quantity"] || "",
        // Posting step
        plannedPosting: row["Planned Posting"] || "",
        actualPosting: row["Actual Posting"] || "",
        delayPosting: row["Delay Posting"] || "",
      }));

      setTasks(formattedTasks);

      // ✅ PENDING: Actual 3 bhari ho + Actual Posting KHALI ho
      setPendingTasks(formattedTasks.filter((t) => t.actual3 && !t.actualPosting));

      // ✅ HISTORY: Actual 3 bhari ho + Actual Posting bhari ho
      setHistoryTasks(formattedTasks.filter((t) => t.actual3 && t.actualPosting));

    } catch (err) {
      console.error("Error fetching tasks for posting:", err);
      toast.error("Failed to fetch posting tasks");
      setTasks([]);
      setPendingTasks([]);
      setHistoryTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedTask) return;

    try {
      setSubmitLoading(true);

      const payload = {
        action: "update1",
        sheetName: "Repair System",
        taskNo: selectedTask.taskNo,
        "Actual Posting": formData.postingDate,
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
        toast.success("✅ Posting completed successfully");
        setIsModalOpen(false);
        await fetchAllTasks(true);
      } else {
        toast.error("❌ Failed to update posting: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("❌ Network error while submitting posting");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Top Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <ClipboardCheck className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Posting</h1>
              <p className="text-gray-600">Manage and confirm machine posting records</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
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

        {/* Search & Filter Bar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks, machines, vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              onClick={() => fetchAllTasks()}
              disabled={loadingTasks}
            >
              {loadingTasks ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Filter Options */}
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
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* PENDING TABLE */}
        {activeTab === "pending" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[170px] text-center whitespace-nowrap">Action</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Task Number</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Machine Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Serial No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Firm Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Department</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Vendor Name</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Bill No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Bill Amount</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Planned Posting</TableHead>
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
                ) : filteredPendingTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-gray-500">
                      No pending posting tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPendingTasks.map((task) => (
                    <TableRow key={task.id || task.taskNo} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handlePostingClick(task)}
                            className="flex items-center"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                            Posting
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenForm(task)}
                            className="flex items-center border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 font-medium"
                            title={`Open Google Form for ${task.firmName || "Firm"}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1 text-purple-600" />
                            Form
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                        {task.taskNo || "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                        {task.machineName || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{task.serialNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.firmName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.department || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.vendorName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.billNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(task.totalBillAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(task.plannedPosting)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* HISTORY TABLE */}
        {activeTab === "history" && (
          <div>
            <Table containerClassName="max-h-[calc(100vh-260px)] overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 bg-gray-50">
                <TableHead className="min-w-[120px] whitespace-nowrap">Task Number</TableHead>
                <TableHead className="min-w-[150px] whitespace-nowrap">Machine Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Serial No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Firm Name</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Department</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Vendor Name</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Bill No</TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">Bill Amount</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Planned Posting</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Actual Posting</TableHead>
                <TableHead className="min-w-[100px] text-center whitespace-nowrap">Delay</TableHead>
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
                      No history posting tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistoryTasks.map((task) => (
                    <TableRow key={task.id || task.taskNo} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="font-medium text-blue-600 whitespace-nowrap">
                        {task.taskNo || "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 whitespace-nowrap">
                        {task.machineName || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{task.serialNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.firmName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.department || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.vendorName || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{task.billNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(task.totalBillAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(task.plannedPosting)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {formatDate(task.actualPosting)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            task.delayPosting && parseInt(task.delayPosting) > 0
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {task.delayPosting || "0"}
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

      {/* Posting Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Confirm Posting: ${selectedTask?.taskNo || ""}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 space-y-1.5 text-sm">
            <p><strong className="text-gray-700">Machine:</strong> {selectedTask?.machineName} ({selectedTask?.serialNo})</p>
            <p><strong className="text-gray-700">Vendor:</strong> {selectedTask?.vendorName || "-"}</p>
            <p><strong className="text-gray-700">Bill No:</strong> {selectedTask?.billNo || "-"}</p>
            <p><strong className="text-gray-700">Total Amount:</strong> {formatCurrency(selectedTask?.totalBillAmount)}</p>
            <p><strong className="text-gray-700">Planned Posting Date:</strong> {formatDate(selectedTask?.plannedPosting)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Posting Date <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.postingDate}
              onChange={(e) => setFormData({ ...formData, postingDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="DD/MM/YYYY"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitLoading ? "Submitting..." : "Confirm Posting"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Posting;
