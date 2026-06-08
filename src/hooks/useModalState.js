import { useState, useCallback } from 'react';

/**
 * Quản lý trạng thái đóng/mở và dữ liệu truyền cho modal.
 * @template T
 * @param {T} initialData - Dữ liệu ban đầu của modal
 * @returns {{
 *   isOpen: boolean,
 *   data: T,
 *   open: (data?: T) => void,
 *   close: () => void
 * }}
 */
export function useModalState(initialData = null) {
  const [state, setState] = useState({ isOpen: false, data: initialData });

  const open = useCallback((data = null) => {
    setState({ isOpen: true, data });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, data: null });
  }, []);

  return {
    isOpen: state.isOpen,
    data: state.data,
    open,
    close,
  };
}
