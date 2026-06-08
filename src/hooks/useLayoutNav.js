import { useState } from 'react';

/**
 * Quản lý trạng thái navigation của layout.
 * @param {string} storageKey - key để persist sidebar state (vd: 'admin-sidebar')
 */
export function useLayoutNav(storageKey = 'sidebar-collapsed') {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(storageKey) === 'true'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, next);
      return next;
    });
  };

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  return { sidebarCollapsed, drawerOpen, toggleSidebar, openDrawer, closeDrawer };
}
