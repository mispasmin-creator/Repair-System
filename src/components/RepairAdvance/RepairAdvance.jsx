import React, { useEffect, useState } from "react";
import { Search, Filter, CreditCard } from "lucide-react";
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

const RepairAdvance = () => {
  const { user } = useAuth();
  const { repairTasks, setRepairTasks } = useDataStore();
  const [activeTab, setActiveTab] = useState("pending");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState(mockRepairTasks);

  const [pendingTasks, setPendingTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [formData, setFormData] = useState({
    totalBillAmount: "",
    paymentType: "",
    toBePaidAmount: "",
  });

  const filteredTasks = tasks.filter(
    (task) => user?.role === "admin" || task.nameOfIndenter === user?.name
  );

  // const pendingTasks = filteredTasks.filter((task) => task.status === "stored");
  // const historyTasks = filteredTasks.filter(
  //   (task) => task.status === "advanced"
  // );

  const handleMaterialClick = (task) => {
    setSelectedTask(task);
    setFormData({
      totalBillAmount: task.totalBillAmount?.toString() || "",
      paymentType: task.paymentType || "",
      toBePaidAmount: task.toBePaidAmount?.toString() || "",
    });
    setIsModalOpen(true);
  };

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

  const fetchAllTasks = async (isBackground = false) => {
    // console.log("selectedTaskType", selectedTaskType);
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

      // Skip first 5 rows (index 0 to 4)
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
          planned1: cells[26]?.v || "",
          actual1: cells[27]?.v || "",
          billNo: cells[32]?.v || "",
          typeOfBill: cells[33]?.v || "",
          totalBillAmount: cells[34]?.v || "",
          paymentType: cells[35]?.v || "",
          toBePaidAmount: cells[36]?.v || "",
          planned2: cells[37]?.v || "",
          actual2: cells[38]?.v || "",
          delay2: cells[39]?.v || "",
          receivedQuantity: cells[40]?.v || "",
          billMatch: cells[41]?.v === "TRUE" || false,
          productImage: cells[42]?.v || "",
        };
      });

      // Planned2	,Actual2	,Delay2,	Received Quantity,	Bill Match,	Product Image,

      const userFirmName = user?.firmName || "";
      const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";

      const filtered = formattedTasks.filter((task) => {
        if (isAllFirm) return true;
        return (task.firmName || "").toLowerCase() === userFirmName.toLowerCase();
      });

      setTasks(filtered);
      setRepairTasks(filtered);

      // Set pending tasks

      const pendingTasks = filtered.filter((task) => task.actual2 === "");
      setPendingTasks(pendingTasks);

      // Set history tasks
      const historyTasks = filtered.filter(
        (task) => task.actual2 !== "" && task.planned2 !== ""
      );
      setHistoryTasks(historyTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    const hasData = repairTasks && repairTasks.length > 0;
    fetchAllTasks(hasData);
  }, []);

  // const handleSubmit = (e) => {
  //   e.preventDefault();
  //   if (selectedTask) {
  //     setTasks((prev) =>
  //       prev.map((task) =>
  //         task.id === selectedTask.id
  //           ? {
  //               ...task,
  //               status: "advanced",
  //               totalBillAmount: Number(formData.totalBillAmount),
  //               paymentType: formData.paymentType,
  //               toBePaidAmount: Number(formData.toBePaidAmount),
  //             }
  //           : task
  //       )
  //     );
  //     setIsModalOpen(false);
  //   }
  // };

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

        // Required Headers:
        Actual2: new Date().toLocaleString("en-GB", {
          timeZone: "Asia/Kolkata",
        }),
        "Received Quantity": formData.receivedQuantity,
        "Bill Match": formData.billMatch,
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
      setSubmitLoading(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Repair Advance</h1>
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button variant="secondary" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {activeTab === "pending" && (
          <div>
          <Table>
            <TableHeader>
              <TableHead>Action</TableHead>
              <TableHead>Task Number</TableHead>
              <TableHead>Firm Name</TableHead>
              <TableHead>Machine Name</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Received Qty</TableHead>
              <TableHead>Bill Match</TableHead>
            </TableHeader>
            <TableBody>
              {pendingTasks.map((task) => (
                <TableRow key={task.taskNo}>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleMaterialClick(task)}
                      className="flex items-center"
                    >
                      <CreditCard className="w-3 h-3 mr-1" />
                      Material
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">
                    {task.taskNo}
                  </TableCell>
                  <TableCell>{task.firmName || "-"}</TableCell>
                  <TableCell>{task.machineName}</TableCell>
                  <TableCell>{task.machinePartName}</TableCell>
                  <TableCell>{task.vendorName || "-"}</TableCell>
                  <TableCell>{task.receivedQuantity || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.billMatch
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {task.billMatch ? "Matched" : "Not Matched"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loadingTasks && (
              <div className="flex flex-col items-center justify-center w-[75vw] mt-10">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">Loading tasks...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
          <Table>
            <TableHeader>
              <TableHead>Task Number</TableHead>
              <TableHead>Firm Name</TableHead>
              <TableHead>Machine Name</TableHead>
              <TableHead>Part Name</TableHead>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Payment Type</TableHead>
              <TableHead>To Be Paid</TableHead>
            </TableHeader>
            <TableBody>
              {historyTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium text-blue-600">
                    {task.taskNo}
                  </TableCell>
                  <TableCell>{task.firmName || "-"}</TableCell>
                  <TableCell>{task.machineName}</TableCell>
                  <TableCell>{task.machinePartName}</TableCell>
                  <TableCell>{task.vendorName || "-"}</TableCell>
                  <TableCell>
                    ₹{task.totalBillAmount?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell>{task.paymentType || "-"}</TableCell>
                  <TableCell>
                    ₹{task.toBePaidAmount?.toLocaleString() || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loadingTasks && (
              <div className="flex flex-col items-center justify-center w-[75vw] mt-10">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-600">Loading tasks...</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Repair Advance Details"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Bill Amount *
              </label>
              <input
                type="number"
                value={selectedTask?.totalBillAmount}
                readOnly
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    totalBillAmount: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Be Paid Amount *
              </label>
              <input
                type="number"
                value={formData.toBePaidAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    toBePaidAmount: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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
              Submit
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RepairAdvance;
