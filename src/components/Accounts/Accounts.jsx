import React, { useEffect, useState } from "react";
import { Search, CheckSquare } from "lucide-react";
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

// The "Accounts" sheet repeats a Planned/Actual/Delay/Status/Remarks block
// four times, one block per audit step. Each step becomes a tab here.
const STEPS = [
  {
    key: "audit",
    label: "Audit Data",
    plannedIdx: 22,
    actualIdx: 23,
    delayIdx: 24,
    statusIdx: 25,
    remarksIdx: 26,
    actualHeader: "Actual 1",
    statusHeader: "Status 1",
    remarksHeader: "Remarks1",
  },
  {
    key: "rectify",
    label: "Rectify the Mistake",
    plannedIdx: 27,
    actualIdx: 28,
    delayIdx: 29,
    statusIdx: 30,
    remarksIdx: 31,
    actualHeader: "Actual 2",
    statusHeader: "Status 2",
    remarksHeader: "Remarks 2",
  },
  {
    key: "reaudit",
    label: "Reaudit Data",
    plannedIdx: 32,
    actualIdx: 33,
    delayIdx: 34,
    statusIdx: 35,
    remarksIdx: 36,
    actualHeader: "Actual 3",
    statusHeader: "Status 3",
    remarksHeader: "Remarks 3",
  },
  {
    key: "tally",
    label: "Take Entry By Tally",
    plannedIdx: 37,
    actualIdx: 38,
    delayIdx: 39,
    statusIdx: 40,
    remarksIdx: 41,
    actualHeader: "Actual 4",
    statusHeader: "Status 4",
    remarksHeader: "Remarks 4",
  },
];

const getStatusColor = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "complete" || s === "completed" || s === "matched" || s === "ok") {
    return "bg-green-100 text-green-800";
  }
  if (s === "mismatch" || s === "rejected") {
    return "bg-red-100 text-red-800";
  }
  if (!s) return "bg-gray-100 text-gray-500";
  return "bg-yellow-100 text-yellow-800";
};

const Accounts = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(STEPS[0].key);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [formData, setFormData] = useState({ status: "", remarks: "" });

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;

  const activeStep = STEPS.find((s) => s.key === activeTab);

  const fetchAllTasks = async () => {
    try {
      setLoadingTasks(true);
      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&&sheet=Accounts`
      );
      const result = await res.json();

      const allRows = result?.table?.rows || [];
      // Skip banner rows 1-5; real headers live on row 6 (same layout as "Repair System")
      const dataRows = allRows.slice(5);

      const formatted = dataRows.map((row) => {
        const cells = row.c || [];
        const v = (idx) => cells[idx]?.v || "";

        const steps = {};
        STEPS.forEach((step) => {
          steps[step.key] = {
            planned: v(step.plannedIdx),
            actual: v(step.actualIdx),
            delay: v(step.delayIdx),
            status: v(step.statusIdx),
            remarks: v(step.remarksIdx),
          };
        });

        return {
          timestamp: v(0),
          taskNo: v(1),
          firmName: v(2),
          serialNo: v(3),
          machineName: v(4),
          machinePartName: v(5),
          department: v(6),
          location: v(7),
          steps,
        };
      });

      const userFirmName = user?.firmName || "";
      const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";
      const filtered = formatted.filter((task) =>
        isAllFirm
          ? true
          : (task.firmName || "").toLowerCase() === userFirmName.toLowerCase()
      );

      setTasks(filtered);
    } catch (err) {
      console.error("Error fetching Accounts data:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const filteredTasks = tasks.filter((task) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (task.taskNo || "").toLowerCase().includes(term) ||
      (task.machineName || "").toLowerCase().includes(term) ||
      (task.serialNo || "").toLowerCase().includes(term) ||
      (task.department || "").toLowerCase().includes(term)
    );
  });

  const handleUpdateClick = (task) => {
    setSelectedTask(task);
    setFormData({
      status: task.steps[activeStep.key].status || "",
      remarks: task.steps[activeStep.key].remarks || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoaderSubmit(true);

      const payload = {
        action: "update1",
        sheetName: "Accounts",
        taskNo: selectedTask.taskNo,
        [activeStep.actualHeader]: new Date().toLocaleDateString("en-GB", {
          timeZone: "Asia/Kolkata",
        }),
        [activeStep.statusHeader]: formData.status,
        [activeStep.remarksHeader]: formData.remarks,
      };

      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString(),
      });

      const result = await response.json();

      if (result.success) {
        setIsModalOpen(false);
        fetchAllTasks();
      } else {
        alert("❌ Failed to update: " + (result.message || result.error));
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("❌ Something went wrong while submitting");
    } finally {
      setLoaderSubmit(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {STEPS.map((step) => (
              <button
                key={step.key}
                onClick={() => setActiveTab(step.key)}
                className={`py-4 px-1 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-200 ${
                  activeTab === step.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {step.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by task no, machine, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="relative">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white">
              <TableHead>Action</TableHead>
              <TableHead>Task No</TableHead>
              <TableHead>Firm Name</TableHead>
              <TableHead>Machine Name</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Planned</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Delay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Remarks</TableHead>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => {
                const step = task.steps[activeStep.key];
                const canUpdate = step.planned && !step.actual;
                return (
                  <TableRow key={task.taskNo}>
                    <TableCell>
                      {canUpdate ? (
                        <Button
                          size="sm"
                          onClick={() => handleUpdateClick(task)}
                          className="flex items-center"
                        >
                          <CheckSquare className="w-3 h-3 mr-1" />
                          Update
                        </Button>
                      ) : step.actual ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateClick(task)}
                        >
                          Edit
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Not reached
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-blue-600">
                      {task.taskNo}
                    </TableCell>
                    <TableCell>{task.firmName}</TableCell>
                    <TableCell>{task.machineName}</TableCell>
                    <TableCell>{task.machinePartName}</TableCell>
                    <TableCell>{task.department}</TableCell>
                    <TableCell>{step.planned || "-"}</TableCell>
                    <TableCell>{step.actual || "-"}</TableCell>
                    <TableCell>{step.delay || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          step.status
                        )}`}
                      >
                        {step.status || "Pending"}
                      </span>
                    </TableCell>
                    <TableCell>{step.remarks || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {loadingTasks && (
            <div className="flex flex-col items-center justify-center w-full mt-10">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading tasks...</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeStep?.label}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task No (Read-only)
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
              Status *
            </label>
            <input
              type="text"
              value={formData.status}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, status: e.target.value }))
              }
              placeholder="e.g. Complete / Mismatch"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, remarks: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loaderSubmit}>
              {loaderSubmit ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Accounts;
