'use client';

import { ReactNode, createContext, useContext } from 'react';

interface TabsContextType {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
}

export function Tabs({ value, onValueChange, className = '', children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`flex rounded-lg bg-gray-100 p-1 ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }

  const { value: activeValue, onValueChange } = context;
  const isActive = activeValue === value;

  return (
    <button
      onClick={() => onValueChange(value)}
      className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all duration-200 min-h-[48px] active:scale-95 ${
        className
      } ${
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50 active:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('TabsContent must be used within a Tabs component');
  }

  const { value: activeValue } = context;
  const isActive = activeValue === value;

  if (!isActive) {
    return null;
  }

  return <div>{children}</div>;
}