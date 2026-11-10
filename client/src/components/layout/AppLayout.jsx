import React, { useEffect } from 'react';
import { useLayout } from '../../context/LayoutContext';

export default function AppLayout({ children, title = 'Dashboard', icon: Icon }) {
  const { setTitle, setIcon } = useLayout();

  useEffect(() => {
    setTitle(title);
    setIcon(Icon || null);
  }, [title, Icon, setTitle, setIcon]);

  return (
    <div className="page-transition" style={{ width: '100%' }}>
      {children}
    </div>
  );
}

