import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Pages inside this component need a logged-in user.
export default function ProtectedRoute({ children }) {
  const { user, loading, error, reload } = useAuth();

  if (loading) {
    return <div className="boot">Loading...</div>;
  }
  if (!user && error) {
    return (
      <div className="boot">
        <p>{error}</p>
        <button type="button" className="button" onClick={reload}>Try again</button>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
