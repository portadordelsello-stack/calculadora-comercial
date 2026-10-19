import React from 'react';

interface DisplayProps {
  value: string;
  previousValue: string;
  operator: string;
}

export const Display: React.FC<DisplayProps> = ({ value, previousValue, operator }) => {
  // Format numbers with commas for thousands
  const formatNumber = (num: string) => {
    if (!num) return '';
    const parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  return (
    <div className="bg-brand-display-bg p-6 rounded-2xl shadow-inner border border-white/10 relative overflow-hidden h-full flex flex-col justify-between transition-colors duration-200">
      {/* Operation History / Previous Value */}
      <div className="text-brand-text-muted text-sm h-6 flex justify-end font-mono items-center z-10 relative">
        {previousValue && (
          <>
            <span>{formatNumber(previousValue)}</span>
            <span className="mx-2 text-brand-accent">{operator}</span>
          </>
        )}
      </div>
      
      {/* Main Display */}
      <div className="text-right z-10 relative">
        <span className="text-5xl md:text-6xl font-bold tracking-tight text-brand-display-text font-mono break-all">
          {formatNumber(value) || '0'}
        </span>
      </div>
      
      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-accent opacity-80"></div>
    </div>
  );
};