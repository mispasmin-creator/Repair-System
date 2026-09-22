import React, { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  DollarSign,
  BarChart3,
  TrendingUp,
  CreditCard,
  Building,
  PlusCircle,
  Users,
  Truck,
  Plus,
  Clock,
  Package
} from "lucide-react";
import MetricCard from "./MetricCard";
import ChartCard from "./ChartCard";
import { mockDashboardMetrics } from "../../data/mockData";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { useAuth } from "../../context/AuthContext";
import useDataStore from "../../store/dataStore";
import Button from "../ui/Button";
import toast from "react-hot-toast";

// Skeleton Loader Components
const MetricCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
      <div className="h-8 bg-gray-200 rounded-full w-8"></div>
    </div>
    <div className="mt-4">
      <div className="h-8 bg-gray-200 rounded w-2/3"></div>
    </div>
    <div className="mt-4 h-2 bg-gray-200 rounded"></div>
  </div>
);

const BarChartSkeleton = () => (
  <div className="h-64 w-full animate-pulse">
    <div className="h-full bg-gray-200 rounded"></div>
  </div>
);

const ListItemSkeleton = () => (
  <div className="flex items-center justify-between py-2 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
    <div className="flex items-center space-x-3">
      <div className="w-20 bg-gray-200 rounded-full h-2"></div>
      <div className="h-4 bg-gray-200 rounded w-8"></div>
    </div>
  </div>
);

const Dashboard = ({ setActiveTab }) => {
  const { user } = useAuth();
  const { vendors, transporters, setVendors, setTransporters, setPaymentTypes } = useDataStore();

  const [masterType, setMasterType] = useState("vendor");
  const [masterValue, setMasterValue] = useState("");
  const [masterSubmitting, setMasterSubmitting] = useState(false);

  const metrics = mockDashboardMetrics;

  const [tasks, setTasks] = useState(() => {
    const cachedTasks = useDataStore.getState().repairTasks;
    return cachedTasks || [];
  });
  const [pendingTasks, setPendingTasks] = useState([]);
  const [totalCompletedTask, setTotalCompletedTask] = useState([]);
  const [totalRepairBill, setTotalRepairBill] = useState(0);
  const [repairStatusByDepartment, setRepairStatusByDepartment] = useState([]);
  const [paymentTypeDistribution, setPaymentTypeDistribution] = useState([]);
  const [vendorWiseRepairCosts, setVendorWiseRepairCosts] = useState([]);

  const [loading, setLoading] = useState(() => {
    const cachedTasks = useDataStore.getState().repairTasks;
    return !cachedTasks || cachedTasks.length === 0;
  });

  const [loadingMaster, setLoadingMaster] = useState(() => {
    const state = useDataStore.getState();
    const hasMaster = (state.vendors && state.vendors.length > 0) || (state.transporters && state.transporters.length > 0);
    return !hasMaster;
  });

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;
  const FOLDER_ID = import.meta.env.VITE_FOLDER_ID;

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
      if (!isBackground) {
        setLoading(true);
      }
      const SHEET_NAME_TASK = "Repair System";

      const result = await safeFetchJson(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&sheet=${SHEET_NAME_TASK}`
      );

      const allRows = result?.table?.rows || [];
      const taskRows = allRows.slice(5);

      const formattedTasks = taskRows.map((row) => {
        const cells = row.c;

        return {
          status: cells[47]?.v || "",
          totalBillRepair: cells[36]?.v || "",
          department: cells[14]?.v || "",
          paymentType: cells[26]?.v || "",
          vendorName: cells[20]?.v || "",
          firmName: cells[2]?.v || "",
        };
      });

      const userFirmName = user?.firmName || "";
      const isAllFirm = !userFirmName || userFirmName.toLowerCase() === "all";

      const filtered = formattedTasks.filter((task) => {
        if (isAllFirm) return true;
        return (task.firmName || "").toLowerCase() === userFirmName.toLowerCase();
      });

      setTasks(filtered);
      useDataStore.setState({ repairTasks: filtered });

    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingMaster(true);
      }
      const SHEET_NAME_MASTER = "Master";
      const result = await safeFetchJson(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&sheet=${SHEET_NAME_MASTER}`
      );
      if (result && result.table && result.table.rows) {
        const rows = result.table.rows;
        const cols = result.table.cols || [];

        // Resolve Vendor Name / Transporter Name columns by header text,
        // falling back to the original fixed positions (0, 1) if not found.
        const vendorColIdx = cols.findIndex(
          (c) => (c.label || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "vendorname"
        );
        const resolvedVendorIdx = vendorColIdx !== -1 ? vendorColIdx : 0;

        const transporterColIdx = cols.findIndex(
          (c) => (c.label || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "transportername"
        );
        const resolvedTransporterIdx = transporterColIdx !== -1 ? transporterColIdx : 1;

        const loadedVendors = rows
          .map((row) => row.c[resolvedVendorIdx]?.v)
          .filter((v) => v !== null && v !== undefined && v.toString().trim() !== "");
        const loadedTransporters = rows
          .map((row) => row.c[resolvedTransporterIdx]?.v)
          .filter((v) => v !== null && v !== undefined && v.toString().trim() !== "");

        setVendors(loadedVendors);
        setTransporters(loadedTransporters);

        const pTypeColIdx = (result.table.cols || []).findIndex(
          (c) => (c.label || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "paymenttype"
        );
        const resolvedPTypeIdx = pTypeColIdx !== -1 ? pTypeColIdx : 6;
        const loadedPaymentTypes = [
          ...new Set(
            rows
              .map((row) => row.c[resolvedPTypeIdx]?.v)
              .filter((v) => v !== null && v !== undefined && v.toString().trim() !== "")
              .map((v) => v.toString().trim())
          ),
        ];
        if (loadedPaymentTypes.length > 0) {
          setPaymentTypes(loadedPaymentTypes);
        }
      }
    } catch (err) {
      console.error("Error fetching master lists:", err);
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleMasterSubmit = async (e) => {
    e.preventDefault();
    if (!masterValue.trim()) return;

    try {
      setMasterSubmitting(true);
      const formPayload = new FormData();
      formPayload.append("sheetName", "Master");
      formPayload.append("action", "insert");

      if (masterType === "vendor") {
        formPayload.append("Vendor Name", masterValue.trim());
      } else {
        formPayload.append("Transporter Name", masterValue.trim());
      }

      const response = await fetch(`${SCRIPT_URL}?headerRow=1`, {
        method: "POST",
        body: formPayload,
      });

      const result = await response.json();
      if (result.success || response.ok) {
        toast.success(`Successfully added ${masterType === "vendor" ? "Vendor" : "Transporter"}!`);
        setMasterValue("");
        fetchMasterData();
      } else {
        toast.error("Failed to add to master lists");
      }
    } catch (error) {
      console.error("Error submitting master:", error);
      toast.error("Error submitting to master");
    } finally {
      setMasterSubmitting(false);
    }
  };

  useEffect(() => {
    if (tasks.length > 0) {
      const pending = tasks.filter((task) => task.status === "Pending");
      setPendingTasks(pending);

      const compeletedTask = tasks.filter((task) => task.status === "Completed");
      setTotalCompletedTask(compeletedTask);

      const totalRepairBill = tasks.reduce((sum, item) => {
        return sum + Number(item.totalBillRepair || 0);
      }, 0);
      setTotalRepairBill(totalRepairBill);

      const departmentCounts = tasks.reduce((acc, task) => {
        const dept = task.department;
        if (dept) {
          acc[dept] = (acc[dept] || 0) + 1;
        }
        return acc;
      }, {});

      const repairStatusByDepartment = Object.entries(departmentCounts).map(
        ([department, count]) => ({
          department,
          count,
        })
      );
      setRepairStatusByDepartment(repairStatusByDepartment);

      const paymentTypeTotals = tasks.reduce((acc, task) => {
        const type = task.paymentType === "undefined" ? "Unknown" : task.paymentType;
        if (!acc[type]) {
          acc[type] = 0;
        }
        acc[type] += Number(task.totalBillRepair || 0);
        return acc;
      }, {});

      const paymentTypeDistribution = Object.entries(paymentTypeTotals).map(
        ([type, amount]) => ({
          type,
          amount,
        })
      );
      setPaymentTypeDistribution(paymentTypeDistribution);

      const topRepairs = [...tasks]
        .sort((a, b) => Number(b.totalBillRepair || 0) - Number(a.totalBillRepair || 0))
        .slice(0, 5)
        .map(task => ({
          vendor: task.vendorName,
          cost: Number(task.totalBillRepair || 0)
        }));
      setVendorWiseRepairCosts(topRepairs);
    }
  }, [tasks]);

  useEffect(() => {
    const cachedTasks = useDataStore.getState().repairTasks;
    const hasTasks = cachedTasks && cachedTasks.length > 0;
    const hasMaster = (vendors && vendors.length > 0) || (transporters && transporters.length > 0);

    const init = async () => {
      await fetchAllTasks(hasTasks);
      setTimeout(() => {
        fetchMasterData(hasMaster);
      }, 400);
    };
    init();
  }, []);


  // console.log("vendorWiseRepairCosts",vendorWiseRepairCosts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Indents"
              value={tasks?.length}
              icon={FileText}
              gradient="from-blue-600 via-indigo-600 to-violet-600"
              trend="All Registered Tasks"
            />
            <MetricCard
              title="Repairs Completed"
              value={totalCompletedTask?.length}
              icon={CheckCircle}
              gradient="from-emerald-400 via-teal-500 to-cyan-600"
              trend={`${((totalCompletedTask?.length / Math.max(tasks?.length, 1)) * 100).toFixed(0)}% Completion Rate`}
            />
            <MetricCard
              title="Pending Repairs"
              value={pendingTasks?.length}
              icon={Clock}
              gradient="from-violet-500 via-purple-500 to-pink-500"
              trend={`${((pendingTasks?.length / Math.max(tasks?.length, 1)) * 100).toFixed(0)}% Active Queue`}
            />
            <MetricCard
              title="Total Repair Cost"
              value={`₹${totalRepairBill.toLocaleString()}`}
              icon={DollarSign}
              gradient="from-amber-500 via-orange-500 to-rose-500"
              trend={`Average ₹${(totalRepairBill / Math.max(tasks?.length, 1)).toFixed(0)} per task`}
            />
          </>
        )}
      </div>

      {/* Quick Operation's Panel */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Operations</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <button
            onClick={() => setActiveTab && setActiveTab("indent")}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-blue-100/30 border border-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200/30 hover:scale-105 active:scale-[0.98] transition-all duration-200 group text-blue-700 font-bold text-sm shadow-sm"
          >
            <FileText className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
            New Indent
          </button>
          
          <button
            onClick={() => setActiveTab && setActiveTab("sent-machine")}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-amber-50 to-amber-100/30 border border-amber-100 rounded-xl hover:from-amber-100 hover:to-amber-200/30 hover:scale-105 active:scale-[0.98] transition-all duration-200 group text-amber-700 font-bold text-sm shadow-sm"
          >
            <Truck className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
            Sent to Vendor
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("check-machine")}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-teal-100/30 border border-teal-100 rounded-xl hover:from-teal-100 hover:to-teal-200/30 hover:scale-105 active:scale-[0.98] transition-all duration-200 group text-teal-700 font-bold text-sm shadow-sm"
          >
            <CheckCircle className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
            Check Machine
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("store-in")}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/30 border border-emerald-100 rounded-xl hover:from-emerald-100 hover:to-emerald-200/30 hover:scale-105 active:scale-[0.98] transition-all duration-200 group text-emerald-700 font-bold text-sm shadow-sm"
          >
            <Package className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
            Store In
          </button>

          <button
            onClick={() => setActiveTab && setActiveTab("make-payment")}
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-rose-50 to-rose-100/30 border border-rose-100 rounded-xl hover:from-rose-100 hover:to-rose-200/30 hover:scale-105 active:scale-[0.98] transition-all duration-200 group text-rose-700 font-bold text-sm shadow-sm"
          >
            <CreditCard className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
            Make Payment
          </button>

          {user?.role === "admin" && (
            <button
              onClick={() => setActiveTab && setActiveTab("users")}
              className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-purple-100/30 border border-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200/30 hover:scale-105 active:scale-[0.98] transition-all duration-200 group text-purple-700 font-bold text-sm shadow-sm"
            >
              <Users className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform duration-200" />
              Manage Users
            </button>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repair Status by Department */}
        <ChartCard
          title={
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span>Repair Status by Department</span>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {repairStatusByDepartment.map((dept, index) => (
                <div
                  key={dept.department}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {dept.department}
                  </span>
                  <div className="flex items-center space-x-3">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            (dept.count /
                              Math.max(
                                ...repairStatusByDepartment.map(
                                  (d) => d.count
                                )
                              )) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8">
                      {dept.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Task Status Overview */}
        <ChartCard
          title={
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Task Status Overview</span>
            </div>
          }
        >
          {loading ? (
            <BarChartSkeleton />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Pending', value: pendingTasks.length },
                    { name: 'Completed', value: totalCompletedTask.length },
                  ]}
                  margin={{
                    top: 20,
                    right: 20,
                    left: 0,
                    bottom: 20,
                  }}
                >
                  <defs>
                    <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.4}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[8, 8, 0, 0]}
                    animationDuration={1500}
                  >
                    <LabelList dataKey="value" position="top" style={{ fill: '#374151', fontWeight: 600, fontSize: 12 }} />
                    <Cell fill="url(#colorPending)" />
                    <Cell fill="url(#colorCompleted)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Payment Type Distribution */}
        <ChartCard
          title={
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              <span>Payment Type Distribution</span>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {paymentTypeDistribution.map((payment, index) => {
                const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500"];
                const textColors = ["text-indigo-700", "text-emerald-700", "text-amber-700", "text-purple-700"];
                const bgColors = ["bg-indigo-50", "bg-emerald-50", "bg-amber-50", "bg-purple-50"];
                const pct = totalRepairBill > 0 ? (payment.amount / totalRepairBill) * 100 : 0;
                
                return (
                  <div key={payment.type} className="space-y-2 p-3 rounded-xl hover:bg-gray-50/50 transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${bgColors[index % bgColors.length]} ${textColors[index % textColors.length]}`}>
                        {payment.type}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{payment.amount.toLocaleString()} <span className="text-xs font-normal text-gray-400 ml-1">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`${colors[index % colors.length]} h-2 rounded-full transition-all duration-1000`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        {/* Vendor-Wise Repair Costs */}
        <ChartCard
          title={
            <div className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-orange-600" />
              <span>Vendor-Wise Repair Costs</span>
            </div>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <ListItemSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {vendorWiseRepairCosts.map((vendor, index) => {
                const maxCost = Math.max(...vendorWiseRepairCosts.map(v => v.cost), 1);
                const pct = (vendor.cost / maxCost) * 100;
                
                return (
                  <div key={index} className="space-y-2 p-3 rounded-xl hover:bg-gray-50/50 transition-colors duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 capitalize">
                        {vendor.vendor || "Unknown Vendor"}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        ₹{vendor.cost.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-rose-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Master Lists Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <PlusCircle className="w-6 h-6 text-blue-600" />
              <span>Add to Master Lists</span>
            </h3>
            <form onSubmit={handleMasterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Type
                </label>
                <div className="flex space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="masterType"
                      value="vendor"
                      checked={masterType === "vendor"}
                      onChange={() => setMasterType("vendor")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Vendor</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="masterType"
                      value="transporter"
                      checked={masterType === "transporter"}
                      onChange={() => setMasterType("transporter")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Transporter</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {masterType === "vendor" ? "Vendor Name *" : "Transporter Name *"}
                </label>
                <input
                  type="text"
                  value={masterValue}
                  onChange={(e) => setMasterValue(e.target.value)}
                  placeholder={masterType === "vendor" ? "e.g. Acme Repairs" : "e.g. DHL"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <Button type="submit" variant="primary" disabled={masterSubmitting} className="w-full">
                {masterSubmitting ? "Saving..." : "Add to Master"}
              </Button>
            </form>
          </div>
        </div>

        {/* Vendors Preview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-600" />
            <span>Current Vendors</span>
          </h3>
          <div className="overflow-y-auto max-h-[220px] divide-y divide-gray-100 pr-2">
            {loadingMaster ? (
              <p className="text-sm text-gray-500 py-2">Loading vendors...</p>
            ) : vendors.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No vendors added yet</p>
            ) : (
              vendors.map((vendor, idx) => (
                <div key={idx} className="py-2 text-sm text-gray-700 font-medium capitalize">
                  {vendor}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transporters Preview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-6 h-6 text-green-600" />
            <span>Current Transporters</span>
          </h3>
          <div className="overflow-y-auto max-h-[220px] divide-y divide-gray-100 pr-2">
            {loadingMaster ? (
              <p className="text-sm text-gray-500 py-2">Loading transporters...</p>
            ) : transporters.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No transporters added yet</p>
            ) : (
              transporters.map((transporter, idx) => (
                <div key={idx} className="py-2 text-sm text-gray-700 font-medium capitalize">
                  {transporter}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;