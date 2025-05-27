 import React from 'react';
 
 // Card 컴포넌트
 export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
   children, 
   className = '' 
 }) => {
   return (
     <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
       {children}
     </div>
   );
 };
 
 // CardHeader 컴포넌트
 export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
   children, 
   className = '' 
 }) => {
   return (
     <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
       {children}
     </div>
   );
 };
 
 // CardTitle 컴포넌트
 export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
   children, 
   className = '' 
 }) => {
   return (
     <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
       {children}
     </h3>
   );
 };
 
 // CardContent 컴포넌트
 export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
   children, 
   className = '' 
 }) => {
   return (
     <div className={`px-6 py-4 ${className}`}>
       {children}
     </div>
   );
 };
