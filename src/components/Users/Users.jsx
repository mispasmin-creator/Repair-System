import React, { useEffect, useState } from "react";
import { Plus, Search, Loader2Icon, ShieldAlert, Edit, Filter } from "lucide-react";
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
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

const Users = () => {
  const { user: loggedInUser, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loaderSubmit, setLoaderSubmit] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedFirmFilter, setSelectedFirmFilter] = useState("All");

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [firmName, setFirmName] = useState(["Pmmpl"]);
  const [selectedPages, setSelectedPages] = useState({
    Dashboard: true,
    Indent: true,
    "Sent to Vendor": false,
    "Management Approval": false,
    "Check Machin": false,
    "Store In": false,
    Posting: false,
    "Make Payment": false,
    "Full Kitting": false,
    Accounts: false,
  });

  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
  const SHEET_Id = import.meta.env.VITE_SHEET_ID;

  const pageOptions = [
    { key: "Dashboard", label: "Dashboard" },
    { key: "Indent", label: "Indent" },
    { key: "Sent to Vendor", label: "Sent to Vendor" },
    { key: "Management Approval", label: "Management Approval" },
    { key: "Check Machin", label: "Check Machine" },
    { key: "Store In", label: "Store In" },
    { key: "Posting", label: "Posting" },
    { key: "Make Payment", label: "Make Payment" },
    { key: "Full Kitting", label: "Full Kitting" },
    { key: "Accounts", label: "Accounts" },
  ];

  const firmOptions = ["All", "Pmmpl", "Purab", "Rkl", "Refrasynth", "Refratech"];
  const FIRM_OPTIONS_WITHOUT_ALL = ["Pmmpl", "Purab", "Rkl", "Refrasynth", "Refratech"];

  const handleFirmToggle = (firm) => {
    if (firm === "All") {
      setFirmName(["All"]);
    } else {
      setFirmName((prev) => {
        const withoutAll = prev.filter((f) => f !== "All");
        if (withoutAll.includes(firm)) {
          const next = withoutAll.filter((f) => f !== firm);
          return next.length === 0 ? ["Pmmpl"] : next;
        } else {
          return [...withoutAll, firm];
        }
      });
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${SCRIPT_URL}?sheetId=${SHEET_Id}&sheet=Repair%20Login`
      );
      const result = await res.json();

      if (result.success && result.table && result.table.rows) {
        const mappedUsers = result.table.rows.map((row, idx) => {
          const cells = row.c || [];
          return {
            id: `user-${idx}`,
            username: (cells[0]?.v || "").toString().trim(),
            password: (cells[1]?.v || "").toString().trim(),
            role: (cells[2]?.v || "").toString().trim(),
            access: (cells[3]?.v || "").toString().trim(),
            firmName: (cells[4]?.v || "").toString().trim(),
          };
        }).filter(u => u.username !== ""); // Filter out empty rows

        const viewerFirm = loggedInUser?.firmName || "";
        const isAllFirm = !viewerFirm || viewerFirm.toLowerCase() === "all";
        const scopedUsers = isAllFirm
          ? mappedUsers
          : mappedUsers.filter(
              (u) => (u.firmName || "").toLowerCase() === viewerFirm.toLowerCase()
            );

        setUsers(scopedUsers);
      } else {
        console.error("Failed to load users:", result);
        toast.error("❌ Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("❌ Error fetching users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loggedInUser) {
      fetchUsers();
    }
  }, [loggedInUser?.firmName]);

  const handleAddClick = () => {
    setIsEditMode(false);
    setUsername("");
    setPassword("");
    setRole("user");
    setFirmName(["Pmmpl"]);
    setSelectedPages({
      Dashboard: true,
      Indent: true,
      "Sent to Vendor": false,
      "Management Approval": false,
      "Check Machin": false,
      "Store In": false,
      Posting: false,
      "Make Payment": false,
      "Full Kitting": false,
      Accounts: false,
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (userRow) => {
    setIsEditMode(true);
    setUsername(userRow.username);
    setPassword(userRow.password);
    setRole(userRow.role || "user");
    setFirmName(userRow.firmName
      ? userRow.firmName.split(",").map((f) => f.trim()).filter(Boolean)
      : ["Pmmpl"]
    );
    
    const accessArray = (userRow.access || "").split(",").map(p => p.trim());
    const initialPages = {
      Dashboard: accessArray.some(p => p.toLowerCase() === "dashboard"),
      Indent: accessArray.some(p => p.toLowerCase() === "indent"),
      "Sent to Vendor": accessArray.some(p => p.toLowerCase().includes("vendor")),
      "Management Approval": accessArray.some(p => p.toLowerCase().includes("management") || p.toLowerCase().includes("approval")),
      "Check Machin": accessArray.some(p => p.toLowerCase().includes("check")),
      "Store In": accessArray.some(p => p.toLowerCase().includes("store")),
      Posting: accessArray.some(p => p.toLowerCase().includes("posting")),
      "Make Payment": accessArray.some(p => p.toLowerCase().includes("payment")),
      "Full Kitting": accessArray.some(p => p.toLowerCase().includes("kitting")),
      Accounts: accessArray.some(p => p.toLowerCase().includes("account")),
    };
    setSelectedPages(initialPages);
    setIsModalOpen(true);
  };

  const handlePageAccessChange = (pageKey) => {
    setSelectedPages((prev) => ({
      ...prev,
      [pageKey]: !prev[pageKey],
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error("❌ Username and Password are required");
      return;
    }

    const accessList = Object.entries(selectedPages)
      .filter(([_, allowed]) => allowed)
      .map(([pageKey]) => pageKey)
      .join(", ");

    try {
      setLoaderSubmit(true);

      const formPayload = new FormData();
      formPayload.append("sheetName", "Repair Login");

      if (isEditMode) {
        formPayload.append("action", "updateRow");
        formPayload.append("keyColumn", "User Name");
        formPayload.append("keyValue", username.trim());
        
        formPayload.append("Password", password.trim());
        formPayload.append("Role", role);
        formPayload.append("Page Access", accessList);
        formPayload.append("Firm Name", Array.isArray(firmName) ? firmName.join(", ") : firmName);
      } else {
        formPayload.append("action", "insert");
        
        const userData = {
          "User Name": username.trim(),
          Password: password.trim(),
          Role: role,
          "Page Access": accessList,
          "Firm Name": Array.isArray(firmName) ? firmName.join(", ") : firmName,
        };

        Object.entries(userData).forEach(([key, val]) => {
          formPayload.append(key, val);
        });
      }

      const response = await fetch(`${SCRIPT_URL}?headerRow=1`, {
        method: "POST",
        body: formPayload,
      });

      const result = await response.json();

      if (result.success || response.ok) {
        toast.success(isEditMode ? "✅ User updated successfully!" : "✅ User created successfully!");
        
        // If the edited user is the currently logged-in user, update their session too
        if (isEditMode && loggedInUser?.name?.toLowerCase() === username.trim().toLowerCase()) {
          const newAccessList = accessList.split(", ").map(a => a.trim()).filter(Boolean);
          updateUser({
            role: role,
            access: newAccessList,
            firmName: Array.isArray(firmName) ? firmName.join(", ") : firmName,
          });
        }

        setUsername("");
        setPassword("");
        setRole("user");
        setFirmName(["Pmmpl"]);
        setSelectedPages({
          Dashboard: true,
          Indent: true,
          "Sent to Vendor": false,
          "Management Approval": false,
          "Check Machin": false,
          "Store In": false,
          Posting: false,
          "Make Payment": false,
          "Full Kitting": false,
          Accounts: false,
        });

        setIsModalOpen(false);
        fetchUsers();
      } else {
        throw new Error(result.message || "Failed to save user");
      }
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error(isEditMode ? "❌ Failed to update user" : "❌ Failed to add user");
    } finally {
      setLoaderSubmit(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (u.username || "").toLowerCase().includes(search) ||
      (u.firmName || "").toLowerCase().includes(search) ||
      (u.role || "").toLowerCase().includes(search);

    const matchesRole = selectedRole === "All" || (u.role || "").toLowerCase() === selectedRole.toLowerCase();
    // Support multi-firm: check if any of user's firms matches the filter
    const userFirms = (u.firmName || "").split(",").map((f) => f.trim().toLowerCase());
    const matchesFirm =
      selectedFirmFilter === "All" ||
      userFirms.includes(selectedFirmFilter.toLowerCase()) ||
      userFirms.includes("all");

    return matchesSearch && matchesRole && matchesFirm;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage users, roles, firm access and page permissions
          </p>
        </div>
        <Button onClick={handleAddClick} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Stats row */}
      {!loading && loggedInUser && users.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Users", value: users.length, color: "bg-blue-50 text-blue-700 border-blue-100" },
            { label: "Admins", value: users.filter(u => u.role === "admin").length, color: "bg-purple-50 text-purple-700 border-purple-100" },
            { label: "Regular Users", value: users.filter(u => u.role !== "admin").length, color: "bg-green-50 text-green-700 border-green-100" },
            { label: "Shown", value: filteredUsers.length, color: "bg-orange-50 text-orange-700 border-orange-100" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border p-3 flex flex-col ${stat.color}`}>
              <span className="text-xs font-medium opacity-70">{stat.label}</span>
              <span className="text-2xl font-bold mt-0.5">{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Search & Filter Bar */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search username, firm or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            />
          </div>
          <Button
            variant={showFilters ? "primary" : "secondary"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1.5" />
            {showFilters ? "Hide Filters" : "Filter"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="User">User</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Firm Name</label>
              <select
                value={selectedFirmFilter}
                onChange={(e) => setSelectedFirmFilter(e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="All">All Firms</option>
                <option value="Pmmpl">Pmmpl</option>
                <option value="Purab">Purab</option>
                <option value="Rkl">Rkl</option>
                <option value="Refrasynth">Refrasynth</option>
                <option value="Refratech">Refratech</option>
              </select>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-[160px]">User Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-[140px]">Password</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-[100px]">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-[150px]">Firm Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Page Access</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(loading || !loggedInUser) ? (
                <tr>
                  <td colSpan={6} className="text-center py-14">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2Icon className="w-8 h-8 animate-spin text-blue-500" />
                      <p className="text-gray-500 text-sm">Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-14">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="w-10 h-10 text-gray-300" />
                      <p className="text-gray-400 font-medium">No users found</p>
                      <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-blue-50/40 transition-colors group">
                    {/* Username */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(u.username || "?")[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 truncate max-w-[100px]" title={u.username}>
                          {u.username}
                        </span>
                      </div>
                    </td>
                    {/* Password */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {u.password}
                      </span>
                    </td>
                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    {/* Firm Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(u.firmName || "").split(",").map((f) => f.trim()).filter(Boolean).map((firm) => (
                          <span key={firm} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            firm.toLowerCase() === "all"
                              ? "bg-green-100 text-green-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {firm}
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* Page Access */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {(u.access || "").split(",").map((p) => p.trim()).filter(Boolean).map((page) => (
                          <span key={page} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {page}
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg transition-all duration-150 inline-flex items-center gap-1 border border-blue-200 hover:border-blue-600"
                        title="Edit User"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!loading && loggedInUser && filteredUsers.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? "Edit User Details" : "Add New User"}
        size="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Username & Password side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Subhash"
                className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isEditMode ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
                }`}
                required
                disabled={isEditMode}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="e.g. Subhash123"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Firm Name — multi-select checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Firm Name
              {Array.isArray(firmName) && firmName.length > 0 && (
                <span className="ml-2 text-xs font-normal text-blue-600">
                  ({firmName.join(", ")})
                </span>
              )}
            </label>
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {firmOptions.map((firm) => (
                <label key={firm} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={Array.isArray(firmName) ? firmName.includes(firm) : firmName === firm}
                    onChange={() => handleFirmToggle(firm)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{firm}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Page Access */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Page Access
            </label>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {pageOptions.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedPages[opt.key]}
                    onChange={() => handlePageAccessChange(opt.key)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loaderSubmit}>
              {loaderSubmit && <Loader2Icon className="animate-spin w-4 h-4 mr-2" />}
              {isEditMode ? "Update User" : "Save User"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Users;
