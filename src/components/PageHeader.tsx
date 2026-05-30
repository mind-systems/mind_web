import { useAuth } from '@/core/auth/AuthContext';

interface PageHeaderProps {
  title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  const { logout } = useAuth();

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
      <span className="text-lg font-semibold text-gray-900">{title}</span>
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
