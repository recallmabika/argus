import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minWidth?: string;
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className = '',
  minWidth = 'min-w-[180px]',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${minWidth} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium rounded-sm border transition bg-white dark:bg-cyber-900 border-slate-300 dark:border-cyber-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-slate-900 dark:focus:border-white ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-400 dark:hover:border-cyber-600'
        }`}
      >
        <span className="truncate flex items-center space-x-2">
          {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-2 text-slate-400 dark:text-slate-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto custom-scrollbar bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-cyber-700/40">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between transition ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-cyber-700/80 text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-cyber-700/40'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                  <div className="truncate">
                    <div>{opt.label}</div>
                    {opt.sublabel && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{opt.sublabel}</div>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white flex-shrink-0 ml-1.5" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
