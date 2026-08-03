import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Lock } from 'lucide-react';
import { authenticateUser } from '../../services/authService';

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Optional: Load remembered username
  useEffect(() => {
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
      setUsername(rememberedUser);
      setRemember(true);
    }
  }, []);

  

  // In your handleSubmit function in Login.js
const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  setError('');

  try {
    const userData = await authenticateUser(username, password);
    
    login({
      id: userData.id,
      name: userData.name,
      role: userData.role,
      access: userData.access,
      department: userData.department,
      firmName: userData.firmName
    });

    // Store the remember preference
    if (remember) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }
  } catch (err) {
    setError(err.message || 'Invalid username or password.');
  } finally {
    setIsLoading(false);
  }
};

  return (
    // <>
    // <div className="min-h-screen flex items-center justify-center bg-white">
    //   <div className="bg-blue-300 border border-blue-500 p-8 rounded-xl shadow-lg w-full max-w-sm flex flex-col items-center">
    //     <div className="flex flex-col items-center mb-4">
    //       <div className="bg-blue-200 rounded-full p-4 mb-2">
    //         <User className="w-10 h-10 text-blue-500" />
    //       </div>
    //       <h2 className="text-xl font-bold text-blue-700 tracking-widest mb-2">Repair Management</h2>
    //     </div>
    //     <form onSubmit={handleSubmit} className="w-full space-y-4">
    //       <div className="relative">
    //         <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
    //           <User className="w-5 h-5" />
    //         </span>
    //         <input
    //           type="text"
    //           placeholder="Username"
    //           className="w-full pl-10 pr-4 py-2 border bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
    //           value={username}
    //           onChange={(e) => setUsername(e.target.value)}
    //           autoFocus
    //           required
    //         />
    //       </div>
    //       <div className="relative">
    //         <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
    //           <Lock className="w-5 h-5" />
    //         </span>
    //         <input
    //           type="password"
    //           placeholder="Password"
    //           className="w-full pl-10 pr-4 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
    //           value={password}
    //           onChange={(e) => setPassword(e.target.value)}
    //           required
    //         />
    //       </div>
          
    //       {error && <div className="text-red-500 text-xs text-center">{error}</div>}
    //       <button
    //         type="submit"
    //         className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold text-lg hover:bg-blue-700 transition duration-200 mt-2 flex justify-center items-center"
    //         disabled={isLoading}
    //       >
    //         {isLoading ? (
    //           <>
    //             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    //               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    //               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    //             </svg>
    //             PROCESSING...
    //           </>
    //         ) : (
    //           'LOGIN'
    //         )}
    //       </button>
    //     </form>

        
    //   </div>
    // </div>



   <>
  <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-blue-100">
    {/* Main Content */}
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="bg-white border border-blue-200 p-8 rounded-2xl shadow-xl w-full max-w-md">
        {/* Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute -inset-2 bg-blue-400 rounded-full blur-md opacity-20"></div>
            <img src="/logo.png" alt="Logo" className="relative w-20 h-20 rounded-full object-cover shadow-lg" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-1">Repair Management</h2>
          <p className="text-blue-500 text-sm">Sign in to your account</p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {/* Username Field */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                placeholder="Enter your username"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
          
          {/* Password Field */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                placeholder="Enter your password"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 py-2 px-4 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {/* Login Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold text-lg transition-all duration-200 flex justify-center items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  </div>
</>
  );
};

export default Login;