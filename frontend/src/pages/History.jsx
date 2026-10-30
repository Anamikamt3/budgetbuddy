import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api.js';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { currentMonth, dayLabel } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
];

export default function History() {
  usePageTitle('Transactions');
  const money = useMoney();
  const toast = useToast();

  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState('all');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const params = { type };
    if (month) params.month = month;
    api
      .get('/finance/transactions/', { params })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => toast(errorMessage(err), 'error'));
    return () => { cancelled = true; };
  }, [month, type, toast]);

  // Group the list by day (the API already sorts it newest first)
  const days = useMemo(() => {
    const groups = [];
    (data?.results || []).forEach((item) => {
      let day = groups[groups.length - 1];
      if (!day || day.date !== item.date) {
        day = { date: item.date, rows: [], net: 0 };
        groups.push(day);
      }
      day.rows.push(item);
      day.net += item.type === 'income' ? item.amount : -item.amount;
    });
    return groups;
  }, [data]);

  const balance = data ? data.income_total - data.expense_total : 0;
  const balanceClass = !data ? '' : balance < 0 ? 'neg' : balance > 0 ? 'pos' : '';

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Transactions</h1>
          <p>Your complete money history, day by day.</p>
        </div>
        <div className="head-actions">
          <Link className="button" to="/expenses?new=1">+ Add expense</Link>
          <Link className="button secondary" to="/income?new=1">+ Add income</Link>
        </div>
      </header>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="month">Month</label>
          <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="field">
          <label id="showLabel">Show</label>
          <div className="segmented" role="group" aria-labelledby="showLabel">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={type === t.value}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="stats" aria-label="Month totals">
        <div className="stat">
          <div className="label">Income</div>
          <div className="value">{data ? money(data.income_total) : '--'}</div>
        </div>
        <div className="stat">
          <div className="label">Expenses</div>
          <div className="value">{data ? money(data.expense_total) : '--'}</div>
        </div>
        <div className="stat">
          <div className="label">Balance</div>
          <div className={`value ${balanceClass}`}>{data ? money(balance) : '--'}</div>
        </div>
        <div className="stat">
          <div className="label">Transactions</div>
          <div className="value">{data ? data.count : '--'}</div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }} aria-label="Transaction history">
        {data && days.length === 0 && (
          <div className="empty">
            <strong>No transactions found</strong>
            Try another month, or add something new.
          </div>
        )}
        {days.map((day) => (
          <section className="day" key={day.date}>
            <div className="day-head">
              <span>{dayLabel(day.date)}</span>
              <span className={day.net < 0 ? 'neg' : 'pos'}>
                {day.net < 0 ? '-' : '+'}{money(Math.abs(day.net))}
              </span>
            </div>
            {day.rows.map((item) => {
              const isIncome = item.type === 'income';
              const style = isIncome ? 'in' : 'out';
              return (
                <div className="tx" key={`${item.type}-${item.id}`}>
                  <div className={`tx-icon ${style}`}><Icon name={isIncome ? 'up' : 'down'} /></div>
                  <div className="tx-main">
                    <div className="tx-title">{item.title}</div>
                    <div className="tx-sub">
                      {item.description || (isIncome ? 'Income' : 'Expense')}
                    </div>
                  </div>
                  <div className={`tx-amount ${style}`}>{isIncome ? '+' : '-'}{money(item.amount)}</div>
                </div>
              );
            })}
          </section>
        ))}
      </section>
    </>
  );
}
