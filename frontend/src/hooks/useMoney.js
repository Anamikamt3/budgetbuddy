import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { formatMoney } from '../format.js';

// Returns a function: money(1500) -> "₹1,500.00" in the user's currency
export default function useMoney() {
  const { currency } = useAuth();
  return useCallback((amount) => formatMoney(amount, currency), [currency]);
}
