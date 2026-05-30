import { useParams } from 'react-router-dom';

export function SessionsPage() {
  const { id } = useParams<{ id?: string }>();
  return (
    <div className="flex h-screen items-center justify-center">
      {id ? `Session: ${id}` : 'Sessions'}
    </div>
  );
}
