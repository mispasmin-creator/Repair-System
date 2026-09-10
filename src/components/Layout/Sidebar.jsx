import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Send,
  ShieldCheck,
  CheckCircle,
  Package,
  CreditCard,
  DollarSign,
  LogOut,
  User,
  Users,
  Calculator,
  BoxSelect,
  ClipboardCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'indent', label: 'Indent', icon: FileText },
    { id: 'sent-machine', label: 'Sent to Vendor', icon: Send },
    { id: 'management-approval', label: 'Management Approval', icon: ShieldCheck },
    { id: 'check-machine', label: 'Check Machine', icon: CheckCircle },
    { id: 'store-in', label: 'Store In', icon: Package },
    { id: 'posting', label: 'Process for payment', icon: ClipboardCheck },
    // { id: 'repair-advance', label: 'Repair Advance', icon: CreditCard },
    { id: 'make-payment', label: 'Make Payment', icon: DollarSign },
    { id: 'full-kitting', label: 'Full Kitting', icon: BoxSelect },
    { id: 'accounts', label: 'Accounts', icon: Calculator },
  ];

  if (user?.role === 'admin') {
    menuItems.push({ id: 'users', label: 'Users', icon: Users });
  }

  const userAccess = Array.isArray(user?.access)
    ? user.access.map((a) => a.toLowerCase().trim())
    : [];

  const visibleMenuItems = menuItems.filter((item) => {
    if (user?.role === 'admin') return true;
    if (item.id === 'users') return false;
    if (userAccess.length === 0) return true;
    const labelLower = item.label.toLowerCase().trim();
    const idLower = item.id.toLowerCase().trim();
    return (
      userAccess.includes(labelLower) ||
      userAccess.includes(idLower) ||
      (item.id === 'posting' && (userAccess.includes('posting') || userAccess.includes('process for payment'))) ||
      userAccess.some((a) => labelLower.includes(a) || a.includes(labelLower))
    );
  });

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col">
      {/* Logo Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <h1 className="text-xl font-bold text-gray-800 truncate">Repair App</h1>
        </div>
      </div>

      {/* Scrollable Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}
      >
        <ul className="space-y-1">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate leading-tight">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="px-3 pb-4 flex-shrink-0 border-t border-gray-200">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-3 py-2.5 mt-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;