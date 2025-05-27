 import React from 'react';
 
 interface ProgressProps {
   value: number; // 0-100 사이의 값
   className?: string;
   color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
 }
 
 export const Progress: React.FC<ProgressProps> = ({
   value,
   className = '',
   color = 'blue'
 }) => {
   // 값이 0-100 범위 내에 있도록 보장
   const clampedValue = Math.max(0, Math.min(100, value));
   
   const colorClasses = {
     blue: 'bg-blue-500',
     green: 'bg-green-500',
     red: 'bg-red-500',
     yellow: 'bg-yellow-500',
     purple: 'bg-purple-500'
   };
   
   return (
     <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${className}`}>
       <div 
         className={`h-full transition-all duration-300 ease-out ${colorClasses[color]}`}
         style={{ width: `${clampedValue}%` }}
       />
     </div>
   );
 };
