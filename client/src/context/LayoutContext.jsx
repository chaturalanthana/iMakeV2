import React, { createContext, useContext, useState } from 'react';

const LayoutContext = createContext(null);

export function LayoutProvider({ children }) {
  const [title, setTitle] = useState('Dashboard');
  const [icon, setIcon] = useState(null);

  return (
    <LayoutContext.Provider value={{ title, setTitle, icon, setIcon }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
