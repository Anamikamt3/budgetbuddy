import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api.js';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { barClass, currentMonth, formatDate, greetingFor } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

const COLORS = ['#2d5bff', '#f2b138', '#16866a', '#e5566d', '#8b6cf0', '#5b6578'];

export default function Dashboard() {
  usePageTitle('Overview');
  const { displayName } = useAuth();
  const money = useMoney();
  const toast = useToast();

  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);

  // Load the summary again every time the month changes
  useEffect(() => {
    if (!month) return undefined;
    let cancelled = false;
    api
      .get('/finance/summary/', { params: { month } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => toast(errorMessage(err), 'error'));
    return () => { cancelled = true; };
  }, [month, toast]);

  const budget = data?.budget;
  const balanceClass = !data ? '' : data.balance < 0 ? 'neg' : data.balance > 0 ? 'pos' : '';
  const topTotal = data?.by_category[0]?.total || 1;

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>{greetingFor(displayName)}</h1>
          <p>Here is how your money looks this month.</p>
        </div>
        <div className="head-actions">
          <div className="field" style={{ margin: 0 }}>
            <label className="sr-only" htmlFor="month">Month</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Link className="button" to="/expenses?new=1">+ Add expense</Link>
          <Link className="button secondary" to="/income?new=1">+ Add income</Link>
        </div>
      </header>

      <section className="stats" aria-label="Month summary">
        <div className="stat">
          <div className="label">Income</div>
          <div className="value">{data ? money(data.income_total) : '--'}</div>
          <div className="sub">Money received</div>
        </div>
        <div className="stat">
          <div className="label">Expenses</div>
          <div className="value">{data ? money(data.expense_total) : '--'}</div>
          <div className="sub">Money spent</div>
        </div>
        <div className="stat">
          <div className="label">Balance</div>
          <div className={`value ${balanceClass}`}>{data ? money(data.balance) : '--'}</div>
          <div className="sub">Income minus expenses</div>
        </div>
        <div className="stat">
          <div className="label">Budget used</div>
          <div className="value">{!data ? '--' : budget ? `${Math.round(budget.percent)}%` : 'Not set'}</div>
          {data && budget && (
            <>
              <div className={`bar ${barClass(budget.percent)}`}>
                <i style={{ width: `${Math.min(budget.percent, 100)}%` }} />
              </div>
              <div className="sub">{money(budget.spent)} of {money(budget.amount)}</div>
            </>
          )}
          {data && !budget && (
            <div className="sub"><Link to="/budgets">Set a monthly budget</Link></div>
          )}
        </div>
      </section>

      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Spending by category</h2></div>
          {data && data.by_category.length === 0 && (
            <div className="empty">
              <strong>No expenses this month</strong>
              Add your first expense to see where your money goes.
              <br />
              <Link className="button" to="/expenses?new=1">+ Add expense</Link>
            </div>
          )}
          {data && data.by_category.map((row, index) => (
            <div className="cat-row" key={row.category}>
              <div className="top"><span>{row.category}</span><span>{money(row.total)}</span></div>
              <div className="bar">
                <i style={{ width: `${(row.total / topTotal) * 100}%`, '--c': COLORS[index % COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Recent transactions</h2>
            <Link to="/transactions">View all</Link>
          </div>
          {data && data.recent.length === 0 && (
            <div className="empty">
              <strong>No transactions yet</strong>
              Your latest income and expenses will appear here.
            </div>
          )}
          {data && data.recent.map((item) => {
            const isIncome = item.type === 'income';
            const style = isIncome ? 'in' : 'out';
            return (
              <div className="tx" key={`${item.type}-${item.id}`}>
                <div className={`tx-icon ${style}`}><Icon name={isIncome ? 'up' : 'down'} /></div>
                <div className="tx-main">
                  <div className="tx-title">{item.title}</div>
                  <div className="tx-sub">
                    {formatDate(item.date)}{item.description ? ` · ${item.description}` : ''}
                  </div>
                </div>
                <div className={`tx-amount ${style}`}>{isIncome ? '+' : '-'}{money(item.amount)}</div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
