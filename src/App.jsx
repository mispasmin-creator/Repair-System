import React, { useState, Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Layout/Sidebar";
import Login from "./components/Login/Login";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";

const Dashboard = lazy(() => import("./components/Dashboard/Dashboard"));
const Indent = lazy(() => import("./components/Indent/Indent"));
const SentMachine = lazy(() => import("./components/SentMachine/SentMachine"));
const CheckMachine = lazy(() => import("./components/CheckMachine/CheckMachine"));
const StoreIn = lazy(() => import("./components/StoreIn/StoreIn"));
const Posting = lazy(() => import("./components/Posting/Posting"));
const MakePayment = lazy(() => import("./components/MakePayment/MakePayment"));
const FullKitting = lazy(() => import("./components/FullKitting/FullKitting"));
const ManagementApproval = lazy(() => import("./components/ManagementApproval/ManagementApproval"));
const Users = lazy(() => import("./components/Users/Users"));
const Accounts = lazy(() => import("./components/Accounts/Accounts"));

// function AppContent() {
//   const { user } = useAuth();
//   const [activeTab, setActiveTab] = useState("dashboard");
//   const [sidebarOpen, setSidebarOpen] = useState(false);

//   const renderContent = () => {
//     switch (activeTab) {
//       case "dashboard":
//         return <Dashboard />;
//       case "indent":
//         return <Indent />;
//       case "sent-machine":
//         return <SentMachine />;
//       case "check-machine":
//         return <CheckMachine />;
//       case "store-in":
//         return <StoreIn />;
//       case "make-payment":
//         return <MakePayment />;
//       default:
//         return <Dashboard />;
//     }
//   };

//   if (!user) {
//     return <Login />;
//   }

//   return (
//     <div className="h-screen">
//     <div className="flex bg-gray-50 relative">
//       {/* Mobile Hamburger Icon - Right Side */}
//       <button
//         className="absolute top-4 right-4 z-50 md:hidden bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition"
//         onClick={() => setSidebarOpen(true)}
//       >
//         <MenuOutlined style={{ fontSize: "20px" }} />
//       </button>

//       {/* Sidebar */}
//       <div
//         className={`fixed inset-y-0 left-0 transform bg-white shadow-md z-50 w-64 transition-transform duration-300 md:relative md:translate-x-0 ${
//           sidebarOpen ? "translate-x-0" : "-translate-x-full"
//         }`}
//       >
//         {/* Close Icon (mobile) */}
//         <div className="flex justify-end p-4 md:hidden">
//           <button
//             className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
//             onClick={() => setSidebarOpen(false)}
//           >
//             <CloseOutlined style={{ fontSize: "18px" }} />
//           </button>
//         </div>

//         {/* Sidebar with click-to-close in mobile */}
//         <Sidebar
//           activeTab={activeTab}
//           setActiveTab={(tab) => {
//             setActiveTab(tab);
//             setSidebarOpen(false);
//           }}
//         />
//       </div>

//       {/* Overlay for mobile */}
//       {sidebarOpen && (
//         <div
//           className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
//           onClick={() => setSidebarOpen(false)}
//         ></div>
//       )}

//       {/* Main Content */}
//       <main className="flex-1 overflow-auto">
//         <div className="p-8 h-full">{renderContent()}</div>
//       </main>

//       {/* footer */}

//     </div>
//   );
// }


function AppContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard setActiveTab={setActiveTab} />;
      case "indent":
        return <Indent />;
      case "sent-machine":
        return <SentMachine />;
      case "management-approval":
        return <ManagementApproval />;
      case "check-machine":
        return <CheckMachine />;
      case "store-in":
        return <StoreIn />;
      case "posting":
        return <Posting />;
      case "make-payment":
        return <MakePayment />;
      case "full-kitting":
        return <FullKitting />;
      case "users":
        return <Users />;
      case "accounts":
        return <Accounts />;
      default:
        return <Dashboard />;
    }
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Hamburger Icon - Right Side */}
        <button
          className="absolute top-4 right-4 z-50 md:hidden bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuOutlined style={{ fontSize: "20px" }} />
        </button>

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 transform bg-white shadow-md z-50 w-64 transition-transform duration-300 md:relative md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Close Icon (mobile) */}
          <div className="flex justify-end p-4 md:hidden">
            <button
              className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
              onClick={() => setSidebarOpen(false)}
            >
              <CloseOutlined style={{ fontSize: "18px" }} />
            </button>
          </div>

          {/* Sidebar with click-to-close in mobile */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setSidebarOpen(false);
            }}
          />
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8 h-full">
            <Suspense fallback={null}>{renderContent()}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
