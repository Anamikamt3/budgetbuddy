const PATHS = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  history: <path d="M7 4v14M3 14l4 4 4-4M17 20V6M13 10l4-4 4 4" />,
  expenses: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  income: <path d="M12 19V5M5 12l7-7 7 7" />,
  budgets: <path d="M12 3a9 9 0 1 0 9 9h-9V3z" />,
  up: <path d="M12 19V5M5 12l7-7 7 7" />,
  down: <path d="M12 5v14M5 12l7 7 7-7" />,
};

export default function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#2d5bff" />
      <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="16" cy="16" r="2.5" fill="#f2b138" />
    </svg>
  );
}
