import { Link } from 'react-router-dom';
import { BrandMark } from './Icon.jsx';

// Sample spending split for the decorative ring (dash = share of 100)
const SEGMENTS = [
  { name: 'Food', pct: 32, color: '#6c8bff', dash: '31 69', offset: 0, delay: '0ms' },
  { name: 'Travel', pct: 14, color: '#f2b138', dash: '13 87', offset: -32, delay: '140ms' },
  { name: 'Shopping', pct: 18, color: '#3dd6a5', dash: '17 83', offset: -46, delay: '280ms' },
  { name: 'Education', pct: 20, color: '#ff8fa3', dash: '19 81', offset: -64, delay: '420ms' },
  { name: 'Entertainment', pct: 10, color: '#a78bfa', dash: '9 91', offset: -84, delay: '560ms' },
  { name: 'Miscellaneous', pct: 6, color: '#8fa3c0', dash: '5 95', offset: -94, delay: '700ms' },
];

// The two-column layout used by the Login and Register pages.
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <main className="auth">
      <aside className="auth-art" aria-label="About BudgetBuddy">
        <Link className="brand" to="/login" aria-label="BudgetBuddy home">
          <BrandMark />
          BudgetBuddy
        </Link>

        <div>
          <h2>Know where your money goes.</h2>
          <p className="lede">
            Track spending, plan a monthly budget and save for the things you want.
          </p>
        </div>

        <figure className="sample">
          <svg
            className="ring"
            viewBox="0 0 200 200"
            role="img"
            aria-label="A sample month of spending split across six categories"
          >
            <g transform="rotate(-90 100 100)" fill="none" strokeWidth="22">
              {SEGMENTS.map((s) => (
                <circle
                  key={s.name}
                  className="seg"
                  cx="100"
                  cy="100"
                  r="80"
                  pathLength="100"
                  stroke={s.color}
                  strokeDasharray={s.dash}
                  strokeDashoffset={s.offset}
                  style={{ '--d': s.delay }}
                />
              ))}
            </g>
            <text className="ring-label" x="100" y="97" textAnchor="middle">A sample</text>
            <text className="ring-label" x="100" y="116" textAnchor="middle">month</text>
          </svg>

          <ul className="legend">
            {SEGMENTS.map((s) => (
              <li key={s.name} style={{ '--c': s.color }}>
                {s.name} <span>{s.pct}%</span>
              </li>
            ))}
          </ul>
          <figcaption className="sample-note">Sample figures for illustration.</figcaption>
        </figure>
      </aside>

      <section className="auth-panel">
        <div className="auth-box">
          <Link className="brand mobile-brand" to="/login">
            <BrandMark />
            BudgetBuddy
          </Link>

          <h1>{title}</h1>
          <p className="sub">{subtitle}</p>

          {children}

          <p className="auth-switch">{footer}</p>
        </div>
      </section>
    </main>
  );
}
