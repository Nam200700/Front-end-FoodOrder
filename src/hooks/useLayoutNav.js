import { useState, useCallback } from 'react';

/**
 * Quản lý trạng thái navigation của layout.
 * @param {string} storageKey - key để persist sidebar state (vd: 'admin-sidebar')
 *
 * LƯU Ý: các hàm dưới được bọc useCallback để GIỮ ỔN ĐỊNH identity giữa các lần
 * render. Nếu không, effect "đóng drawer khi đổi trang" ở các Layout (phụ thuộc
 * closeDrawer) sẽ chạy lại mỗi render và đóng drawer ngay khi vừa mở (bug "giật
 * rồi không hiện" trên mobile).
 */
export function useLayoutNav(storageKey = 'sidebar-collapsed') {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(storageKey) === 'true'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return { sidebarCollapsed, drawerOpen, toggleSidebar, openDrawer, closeDrawer };
}
