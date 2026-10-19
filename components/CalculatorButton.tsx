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
  
  const baseStyles = "relative rounded-2xl font-semibold transition-all duration-75 flex items-center justify-center select-none w-full h-full min-h-[60px] active:translate-y-1 active:shadow-none border border-black/5";
  
  const variants = {
    // Dynamic theme button (White on Light themes, Slate on Dark)
    default: "bg-brand-btn-default hover:opacity-90 text-brand-btn-text text-3xl shadow-[0_4px_0_rgb(var(--color-btn-shadow))]",
    
    // Action operators (+, -, *, /)
    action: "bg-brand-card hover:opacity-90 text-brand-accent text-3xl shadow-[0_4px_0_rgb(var(--color-btn-shadow))]",
    
    // Accent (Enter / FIN)
    accent: "bg-brand-accent hover:opacity-90 text-brand-dark text-2xl font-bold uppercase tracking-wide shadow-[0_4px_0_rgb(var(--color-btn-shadow))]",
    
    // Push (Accent buttons)
    push: "bg-brand-push hover:opacity-90 text-white text-xl font-bold uppercase tracking-wide shadow-[0_4px_0_rgb(var(--color-btn-shadow))]",
    
    // Danger (AC / CE)
    danger: "bg-brand-btn-default hover:opacity-90 text-brand-danger text-2xl shadow-[0_4px_0_rgb(var(--color-btn-shadow))]",
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