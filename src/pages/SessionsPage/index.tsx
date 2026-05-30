import { useParams } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';

export function SessionsPage() {
  const { id } = useParams<{ id?: string }>();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left column */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <span className="text-lg font-semibold text-gray-900">Sessions</span>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Log out
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* session list — next milestone */}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        {id ? (
          <div>{/* session charts — next milestone */}</div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-400">Select a session</span>
          </div>
        )}
      </div>
    </div>
  );
}
