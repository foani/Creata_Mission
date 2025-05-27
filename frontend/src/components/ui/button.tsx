 import React from 'react';
 
 interface ButtonProps {
   children: React.ReactNode;
   onClick?: () => void;
   className?: string;
   size?: 'sm' | 'md' | 'lg';
   variant?: 'primary' | 'secondary' | 'danger';
   disabled?: boolean;
 }
 
 export const Button: React.FC<ButtonProps> = ({
   children,
   onClick,
   className = '',
   size = 'md',
   variant = 'primary',
   disabled = false
 }) => {
   const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
   
   const sizeClasses = {
     sm: 'px-3 py-2 text-sm',
     md: 'px-4 py-2 text-base',
     lg: 'px-6 py-3 text-lg'
   };
   
   const variantClasses = {
     primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
     secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
     danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
   };
   
   return (
     <button
       onClick={onClick}
       disabled={disabled}
       className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
     >
       {children}
     </button>
   );
 };
