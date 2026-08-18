import React from 'react';

export const Table = ({ children, className = '', containerClassName = '' }) => {
  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white ${containerClassName}`}>
      <table className={`min-w-full divide-y divide-gray-200 text-left text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return (
    <thead className={`bg-gray-50 border-b border-gray-200 ${className}`}>
      <tr>
        {children}
      </tr>
    </thead>
  );
};

export const TableBody = ({ children, className = '' }) => {
  return (
    <tbody className={`divide-y divide-gray-200 bg-white ${className}`}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, className = '' }) => {
  return (
    <tr className={`hover:bg-blue-50/40 transition-colors duration-150 ${className}`}>
      {children}
    </tr>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return (
    <th className={`px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap bg-gray-50/90 ${className}`}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return (
    <td className={`px-4 py-3 text-sm text-gray-800 whitespace-nowrap ${className}`}>
      {children}
    </td>
  );
};