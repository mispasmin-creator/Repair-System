import React from 'react';

const ChartCard = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-200/80 hover:shadow-md hover:border-gray-300 transition-shadow duration-150 ${className}`}>
      <h3 className="text-lg font-bold text-gray-800 mb-5 border-b border-gray-100 pb-3">{title}</h3>
      <div>
        {children}
      </div>
    </div>
  );
};

export default ChartCard;