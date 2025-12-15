import React from 'react';
import { ButtonVariant } from '../types';

interface CalculatorButtonProps {
  label: React.ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  className?: string;
  disabled?: boolean;
}

export const CalculatorButton: React.FC<CalculatorButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'default',
  className = '',
  disabled = false
}) => {
  
  // 3D Effect:
  // - box-shadow simulates depth (color matches darker shade of bg)
  // - active:translate-y-1 simulates pressing down
  // - active:shadow-none removes the depth shadow on press
  
  const baseStyles = "relative rounded-2xl font-semibold transition-all duration-75 flex items-center justify-center select-none w-full h-full min-h-[60px] active:translate-y-1 active:shadow-none mb-1";
  
  const variants = {
    // Slate 800 -> Shadow Slate 950 (#020617)
    default: "bg-slate-800 hover:bg-slate-700 text-white text-3xl shadow-[0_4px_0_#020617]",
    
    // Slate 700 -> Shadow Slate 900 (#0f172a)
    action: "bg-slate-700 hover:bg-slate-600 text-brand-accent text-3xl shadow-[0_4px_0_#0f172a]",
    
    // Emerald 500 -> Shadow Emerald 700 (#047857)
    accent: "bg-brand-accent hover:bg-emerald-400 text-brand-dark text-2xl font-bold uppercase tracking-wide shadow-[0_4px_0_#047857]",
    
    // Indigo 500 -> Shadow Indigo 700 (#4338ca)
    push: "bg-brand-push hover:bg-indigo-400 text-white text-xl font-bold uppercase tracking-wide shadow-[0_4px_0_#4338ca]",
    
    // Slate 800 (solid for 3D) -> Shadow Slate 950, Red Text
    danger: "bg-slate-800 hover:bg-slate-700 text-red-500 text-2xl shadow-[0_4px_0_#020617]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
};