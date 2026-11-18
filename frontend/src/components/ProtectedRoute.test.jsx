import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute.jsx';

// A fake "who is logged in" that each test can change
const auth = vi.hoisted(() => ({ user: null, loading: false, error: '', reload: () => {} }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));

function renderAtSecretPage() {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/secret" element={<ProtectedRoute><div>Secret page</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    Object.assign(auth, { user: null, loading: false, error: '' });
  });

  it('sends a logged-out visitor to the login page', () => {
    renderAtSecretPage();
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret page')).not.toBeInTheDocument();
  });

  it('shows the page to a logged-in user', () => {
    auth.user = { id: 1, username: 'anu' };
    renderAtSecretPage();
    expect(screen.getByText('Secret page')).toBeInTheDocument();
  });

  it('shows a loading message while the user is being checked', () => {
    auth.loading = true;
    renderAtSecretPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows a retry button when the server cannot be reached', () => {
    auth.error = "Can't reach the server.";
    renderAtSecretPage();
    expect(screen.getByText("Can't reach the server.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});