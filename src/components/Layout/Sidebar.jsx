import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Send,
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
    { id: 'check-machine', label: 'Check Machine', icon: CheckCircle },
    { id: 'store-in', label: 'Store In', icon: Package },
    { id: 'posting', label: 'Posting', icon: ClipboardCheck },
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
    return (
      userAccess.includes(item.label.toLowerCase().trim()) ||
      userAccess.some((a) => item.label.toLowerCase().includes(a) || a.includes(item.label.toLowerCase()))
    );
  });

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-full object-cover" />
          <h1 className="text-2xl font-bold text-gray-800">Repair App</h1>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === item.id
                    ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 px-4 py-2">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-gray-800">{user?.name}</p>
            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      <div className="p-1 mb-10 border-t border-gray-200">
        <button
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded-lg transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;