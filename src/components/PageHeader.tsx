import { NavLink } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';

export function PageHeader() {
  const { logout } = useAuth();

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
      <nav className="flex items-center gap-6">
        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            isActive
              ? 'text-gray-900 font-semibold text-sm'
              : 'text-gray-500 hover:text-gray-700 text-sm'
          }
        >
          Sessions
        </NavLink>
        <NavLink
          to="/calibrations"
          className={({ isActive }) =>
            isActive
              ? 'text-gray-900 font-semibold text-sm'
              : 'text-gray-500 hover:text-gray-700 text-sm'
          }
        >
          Calibrations
        </NavLink>
      </nav>
      <button
        type="button"
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Log out
      </button>
    </div>
  );
}
