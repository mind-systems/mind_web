import { NavLink } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';

export function PageHeader() {
  const { logout } = useAuth();

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
      <nav className="flex items-center gap-6">
        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            isActive
              ? 'text-gray-900 font-semibold text-sm dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 text-sm dark:text-gray-400 dark:hover:text-gray-300'
          }
        >
          Sessions
        </NavLink>
        <NavLink
          to="/calibrations"
          className={({ isActive }) =>
            isActive
              ? 'text-gray-900 font-semibold text-sm dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 text-sm dark:text-gray-400 dark:hover:text-gray-300'
          }
        >
          Calibrations
        </NavLink>
      </nav>
      <button
        type="button"
        onClick={logout}
        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        Log out
      </button>
    </div>
  );
}
