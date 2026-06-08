import { NavLink } from 'react-router-dom';

/**
 * Render danh sách menu items. Không có container, không có màu sắc — caller tự quyết.
 *
 * Props:
 * - items: Array<{ path, label || name, icon: LucideIcon, badge?: number, end?: boolean }>
 * - collapsed: boolean         — ẩn label, chỉ hiện icon
 * - itemClass: string          — base className cho mỗi item
 * - activeClass: string        — className bổ sung khi item active
 * - inactiveClass: string      — className bổ sung khi item inactive
 * - iconSize?: number          — mặc định 20
 * - onItemClick?: () => void   — callback sau khi click (dùng để đóng drawer)
 * - tooltipClass: string       — class cho tooltip khi collapsed
 */
export default function NavMenuList({
  items,
  collapsed = false,
  itemClass = '',
  activeClass = '',
  inactiveClass = '',
  iconSize = 20,
  onItemClick,
  tooltipClass = '',
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(({ path, label, name, icon: Icon, badge, end }) => (
        <NavLink
          key={path}
          to={path}
          end={end}
          onClick={onItemClick}
          className={({ isActive }) =>
            `${itemClass} ${isActive ? activeClass : inactiveClass}`.trim()
          }
        >
          <span className="relative flex-shrink-0">
            <Icon size={iconSize} />
            {badge > 0 && (
              <span className="absolute -top-2.5 -right-2.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          {!collapsed && <span className="truncate">{label || name}</span>}
          {collapsed && tooltipClass && (
            <div className={tooltipClass}>
              {label || name}
            </div>
          )}
        </NavLink>
      ))}
    </div>
  );
}

