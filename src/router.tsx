import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/core/auth/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { MagicLinkPage } from '@/pages/MagicLinkPage';
import { GoogleCallbackPage } from '@/pages/GoogleCallbackPage';
import { SessionsPage } from '@/pages/SessionsPage';
import { CalibrationPage } from '@/pages/CalibrationPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// eslint-disable-next-line react-refresh/only-export-components
function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/',
        element: <Navigate to="/sessions" replace />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/deeplink-auth',
        element: <MagicLinkPage />,
      },
      {
        path: '/auth/google/callback',
        element: <GoogleCallbackPage />,
      },
      {
        path: '/sessions',
        element: (
          <ProtectedRoute>
            <SessionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/sessions/:id',
        element: (
          <ProtectedRoute>
            <SessionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/calibrations',
        element: (
          <ProtectedRoute>
            <CalibrationPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
