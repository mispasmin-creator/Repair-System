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
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem('repairSystemUser');
      }
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('repairSystemUser', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('repairSystemUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};