// import React, { createContext, useContext, useState } from 'react';

// const AuthContext = createContext(undefined);

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   } 
//   return context;
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState({
//     id: '1',
//     name: 'John Doe',
//     role: 'admin',
//     department: 'IT'
//   });

//   const login = (user) => {
//     setUser(user);
//   };

//   const logout = () => {
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, login, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };




// import React, { createContext, useContext, useState } from 'react';

// const AuthContext = createContext(undefined);

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null); // Changed this line

//   const login = (user) => {
//     setUser(user);
//   };

//   const logout = () => {
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, login, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };



import React, { createContext, useContext, useState, useEffect } from 'react';
import { authenticateUser } from '../services/authService';

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // Load user from localStorage when app initializes
  useEffect(() => {
    const storedUser = localStorage.getItem('repairSystemUser');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        // Re-sync role/permissions from the DB so a stale or tampered
        // localStorage session cannot keep old (or elevated) access.
        authenticateUser(parsed.name, parsed.credential)
          .then((fresh) => {
            const merged = { ...parsed, ...fresh };
            localStorage.setItem('repairSystemUser', JSON.stringify(merged));
            setUser(merged);
          })
          .catch((err) => {
            // Only drop the session when credentials are really rejected,
            // not on network errors.
            if (err?.message === 'Invalid credentials') {
              setUser(null);
              localStorage.removeItem('repairSystemUser');
            }
          });
      } catch (error) {
        localStorage.removeItem('repairSystemUser');
      }
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('repairSystemUser', JSON.stringify(userData));
  };

  // Update currently logged-in user's data (e.g. after admin edits their own account)
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem('repairSystemUser', JSON.stringify(merged));
      return merged;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('repairSystemUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};