'use client';

import { ReactNode } from 'react';

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
    <div className={className} data-value={value} data-on-value-change={onValueChange}>
      {children}
    </div>
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
  // Accéder au contexte parent pour obtenir la valeur active et la fonction de changement
  const handleClick = () => {
    // Chercher l'élément parent Tabs et extraire les données
    const tabsElement = document.querySelector(`[data-value]`) as HTMLElement;
    if (tabsElement) {
      const currentValue = tabsElement.getAttribute('data-value');
      if (currentValue !== value) {
        // Simuler le changement de valeur
        const event = new CustomEvent('tabchange', { detail: { value } });
        window.dispatchEvent(event);
      }
    }
  };

  const isActive = typeof window !== 'undefined' && 
    document.querySelector(`[data-value="${value}"]`) !== null;

  return (
    <button
      onClick={handleClick}
      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
        className
      } ${
        isActive
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: TabsContentProps) {
  // Vérifier si cet onglet est actif
  const isActive = typeof window !== 'undefined' && 
    document.querySelector(`[data-value="${value}"]`) !== null;

  if (!isActive) {
    return null;
  }

  return <div>{children}</div>;
}