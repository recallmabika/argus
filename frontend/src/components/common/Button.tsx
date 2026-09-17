import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition focus:outline-none rounded-sm select-none';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs min-w-[75px]',
    md: 'px-4 py-2 text-xs min-w-[95px]',
    lg: 'px-5 py-2.5 text-sm min-w-[125px]'
  };

  const variantClasses = {
    primary: 'bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black shadow-xs font-semibold',
    secondary: 'bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-cyber-600 font-semibold',
    outline: 'border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white',
    ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-cyber-700/50 hover:text-slate-900 dark:hover:text-white',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs font-semibold'
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center space-x-1.5">
          <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
