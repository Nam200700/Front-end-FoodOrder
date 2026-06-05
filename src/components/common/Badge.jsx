import React from 'react';

export default function Badge({
  children,
  variant = 'status', // status, count, role
  status = 'PENDING', // PENDING, CONFIRMED, PREPARING, READY_FOR_PICKUP, PICKED_UP, DELIVERING, COMPLETED, CANCELLED
  role = 'CUSTOMER', // CUSTOMER, MERCHANT, SHIPPER, ADMIN
  className = '',
  ...props
}) {
  if (variant === 'count') {
    return (
      <span 
        className={`inline-flex items-center justify-center bg-md-error text-white text-[10px] font-extrabold h-4.5 min-w-4.5 px-1 rounded-full shadow-shadow-1 border border-white ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }

  if (variant === 'role') {
    const roles = {
      CUSTOMER: 'bg-md-primary/10 text-md-primary border-md-primary/15',
      MERCHANT: 'bg-md-secondary/10 text-md-secondary border-md-secondary/15',
      SHIPPER: 'bg-md-tertiary/10 text-md-tertiary border-md-tertiary/15',
      ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return (
      <span 
        className={`inline-flex items-center justify-center text-[10px] md:text-xs font-extrabold px-2.5 py-0.5 rounded border uppercase tracking-wider ${roles[role]} ${className}`}
        {...props}
      >
        {children || role}
      </span>
    );
  }

  // Mặc định là status đơn hàng
  const statuses = {
    PENDING: 'bg-slate-100 text-slate-700 border-slate-200',
    CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-100',
    PREPARING: 'bg-amber-50 text-amber-700 border-amber-100',
    READY_FOR_PICKUP: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    PICKED_UP: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    DELIVERING: 'bg-sky-50 text-sky-700 border-sky-100',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    CANCELLED: 'bg-red-50 text-red-700 border-red-100',
  };

  const statusLabels = {
    PENDING: 'Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận',
    PREPARING: 'Đang chuẩn bị',
    READY_FOR_PICKUP: 'Chờ lấy hàng',
    PICKED_UP: 'Đã lấy hàng',
    DELIVERING: 'Đang giao hàng',
    COMPLETED: 'Đã giao thành công',
    CANCELLED: 'Đã hủy đơn',
  };

  return (
    <span 
      className={`inline-flex items-center justify-center text-xs font-bold px-2.5 py-1 rounded border ${statuses[status]} ${className}`}
      {...props}
    >
      {children || statusLabels[status] || status}
    </span>
  );
}
