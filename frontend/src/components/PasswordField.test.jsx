import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import PasswordField from './PasswordField.jsx';

function Wrapper() {
  const [value, setValue] = useState('');
  return (
    <PasswordField id="pw" label="Password" value={value}
      onChange={(e) => setValue(e.target.value)} error="" />
  );
}

describe('PasswordField', () => {
  it('hides the password and can show it again', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows an error message and marks the field as invalid', () => {
    render(<PasswordField id="pw" label="Password" value="" onChange={() => {}} error="Too short" />);
    expect(screen.getByText('Too short')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });
});