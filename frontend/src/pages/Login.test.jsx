import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login.jsx';

const auth = vi.hoisted(() => ({ user: null, login: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login page', () => {
  beforeEach(() => {
    auth.login.mockReset();
  });

  it('asks for a username and password when the form is empty', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('sends the username and password when the form is filled in', async () => {
    auth.login.mockResolvedValue();
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Username'), 'anu');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(auth.login).toHaveBeenCalledWith('anu', 'StrongPass123');
  });

  it('shows a friendly message when the password is wrong', async () => {
    auth.login.mockRejectedValue({ response: { status: 401 } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Username'), 'anu');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
  });

  it('links to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });
});