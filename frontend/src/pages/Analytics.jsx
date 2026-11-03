import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import api, { errorMessage } from '../api.js';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { barClass, currentMonth, formatDate, monthLabel, shortMonth } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

// Chart colours (same palette as the rest of the app)
const COLORS = ['#2d5bff', '#f2b138', '#16866a', '#e5566d', '#8b6cf0', '#5b6578'];
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const axisTick = { fill: '#5b6578', fontSize: 12 };
const tooltipStyle = {
  borderRadius: 12, border: '1px solid #e3e7ef', fontSize: 13,
  boxShadow: '0 8px 24px rgba(21, 32, 58, 0.12)',
};

export default function Analytics() {
  usePageTitle('Analytics');
  const money = useMoney();
  const toast = useToast();

  const [month, setMonth] = useState(currentMonth());
  const [span, setSpan] = useState(6);          // how many months the trend shows
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!month) return undefined;
    let cancelled = false;
    api
      .get('/finance/analytics/', { params: { month, months: span } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => toast(errorMessage(err), 'error'));
    return () => { cancelled = true; };
  }, [month, span, toast]);

  // Shape the numbers for the charts
  const trend = (data?.trend || []).map((row) => ({ ...row, label: shortMonth(row.month) }));
  const daily = (data?.daily || []).map((row) => ({ ...row, day: Number(row.date.slice(8)) }));
  const insights = data?.insights;
  const weekdayMax = Math.max(0, ...(data?.weekdays || []).map((w) => w.total));
  const hasSpending = data && data.expense_total > 0;
  const hasAnyTrend = trend.some((row) => row.income > 0 || row.expense > 0);

  // The four insight cards
  const savings = insights?.savings_rate;
  const change = insights?.vs_last_month;
  const topCategory = insights?.top_category;

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Analytics</h1>
          <p>See where your money goes and how it changes over time.</p>
        </div>
        <div className="head-actions">
          <div className="field" style={{ margin: 0 }}>
            <label className="sr-only" htmlFor="month">Month</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="sr-only" htmlFor="span">Trend length</label>
            <select id="span" className="range-select" value={span} onChange={(e) => setSpan(Number(e.target.value))}>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>
        </div>
      </header>

      {/* ---------- Insight cards ---------- */}
      <section className="stats" aria-label="Insights">
        <div className="stat">
          <div className="label">Savings rate</div>
          <div className={`value ${savings == null ? '' : savings < 0 ? 'neg' : 'pos'}`}>
            {!data ? '--' : savings == null ? 'No income' : `${savings}%`}
          </div>
          <div className="sub">Share of income you kept</div>
        </div>
        <div className="stat">
          <div className="label">Average daily spending</div>
          <div className="value">{data ? money(insights.avg_daily_spend) : '--'}</div>
          <div className="sub">Across {data ? daily.length : '--'} days</div>
        </div>
        <div className="stat">
          <div className="label">Spending vs last month</div>
          <div className={`value ${change == null ? '' : change > 0 ? 'neg' : 'pos'}`}>
            {!data ? '--' : change == null ? 'No data' : `${change > 0 ? '+' : ''}${change}%`}
          </div>
          <div className="sub">{change == null ? 'Nothing recorded last month' : change > 0 ? 'You spent more' : 'You spent less'}</div>
        </div>
        <div className="stat">
          <div className="label">Top category</div>
          <div className="value small">{!data ? '--' : topCategory ? topCategory.category : 'None yet'}</div>
          <div className="sub">
            {topCategory ? `${money(topCategory.total)} (${topCategory.percent}%)` : 'No expenses this month'}
          </div>
        </div>
      </section>

      {/* ---------- Trend over the months ---------- */}
      <section className="panel wide">
        <div className="panel-head"><h2>Income vs expenses</h2></div>
        <p className="panel-note">Month by month. The line shows what was left over (income minus expenses).</p>
        {data && !hasAnyTrend ? (
          <div className="empty"><strong>No data yet</strong>Add income and expenses to see your trend.</div>
        ) : (
          <div className="chart-box" role="img" aria-label="Bar chart of income and expenses per month">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e7ef" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
                <YAxis tickFormatter={(v) => compact.format(v)} tickLine={false} axisLine={false} width={48} tick={axisTick} />
                <Tooltip
                  formatter={(value, name) => [money(value), name]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(45, 91, 255, 0.06)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="income" name="Income" fill="#16866a" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Expenses" fill="#2d5bff" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Line dataKey="net" name="Left over" type="monotone" stroke="#f2b138" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ---------- Category donut and daily spending ---------- */}
      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Spending by category</h2></div>
          <p className="panel-note">{month ? monthLabel(month) : ''}</p>
          {data && !hasSpending ? (
            <div className="empty">
              <strong>No expenses this month</strong>
              <Link className="button" to="/expenses?new=1">+ Add expense</Link>
            </div>
          ) : (
            <div className="donut-layout">
              <div className="chart-box" role="img" aria-label="Donut chart of spending by category">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.categories || []}
                      dataKey="total"
                      nameKey="category"
                      innerRadius="62%"
                      outerRadius="100%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {(data?.categories || []).map((row, index) => (
                        <Cell key={row.category} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [money(value), name]} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{data ? money(data.expense_total) : ''}</strong>
                  <span>spent</span>
                </div>
              </div>

              <ul className="legend-list">
                {(data?.categories || []).map((row, index) => (
                  <li key={row.category} style={{ '--c': COLORS[index % COLORS.length] }}>
                    <span className="name">{row.category}</span>
                    <span className="pct">{row.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Daily spending</h2></div>
          <p className="panel-note">How much you spent each day of the month.</p>
          {data && !hasSpending ? (
            <div className="empty"><strong>No expenses this month</strong>Your daily chart will appear here.</div>
          ) : (
            <div className="chart-box" role="img" aria-label="Area chart of spending per day">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d5bff" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2d5bff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e7ef" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axisTick} minTickGap={16} />
                  <YAxis tickFormatter={(v) => compact.format(v)} tickLine={false} axisLine={false} width={48} tick={axisTick} />
                  <Tooltip
                    formatter={(value) => [money(value), 'Spent']}
                    labelFormatter={(label, payload) => (payload && payload[0] ? formatDate(payload[0].payload.date) : label)}
                    contentStyle={tooltipStyle}
                  />
                  <Area type="monotone" dataKey="total" stroke="#2d5bff" strokeWidth={2.5} fill="url(#spendFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Weekdays and income sources ---------- */}
      <section className="grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Spending by day of the week</h2></div>
          <p className="panel-note">The busiest day is highlighted.</p>
          {data && !hasSpending ? (
            <div className="empty"><strong>No expenses this month</strong></div>
          ) : (
            <div className="chart-box short" role="img" aria-label="Bar chart of spending by weekday">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.weekdays || []} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e7ef" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis tickFormatter={(v) => compact.format(v)} tickLine={false} axisLine={false} width={48} tick={axisTick} />
                  <Tooltip
                    formatter={(value) => [money(value), 'Spent']}
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'rgba(45, 91, 255, 0.06)' }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {(data?.weekdays || []).map((row) => (
                      <Cell key={row.day} fill={row.total === weekdayMax && weekdayMax > 0 ? '#2d5bff' : '#c9d6ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Income by source</h2></div>
          <p className="panel-note">Where your money came from this month.</p>
          {data && data.income_sources.length === 0 ? (
            <div className="empty">
              <strong>No income this month</strong>
              <Link className="button" to="/income?new=1">+ Add income</Link>
            </div>
          ) : (
            <div className="chart-box short" role="img" aria-label="Bar chart of income by source">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.income_sources || []} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="source" tickLine={false} axisLine={false} width={110} tick={axisTick} />
                  <Tooltip
                    formatter={(value) => [money(value), 'Income']}
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'rgba(22, 134, 106, 0.06)' }}
                  />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={22}>
                    {(data?.income_sources || []).map((row, index) => (
                      <Cell key={row.source} fill={['#16866a', '#3dd6a5', '#8fdcc4', '#c4eee0'][index % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ---------- Budgets and biggest expenses ---------- */}
      <section className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h2>Budget vs actual</h2>
            <Link to="/budgets">Manage</Link>
          </div>
          {data && data.budgets.length === 0 && (
            <div className="empty">
              <strong>No budgets for this month</strong>
              <Link className="button" to="/budgets">Set a budget</Link>
            </div>
          )}
          {(data?.budgets || []).map((row) => (
            <div className="cat-row" key={row.name}>
              <div className="top">
                <span>{row.name}</span>
                <span>{money(row.spent)} of {money(row.budget)}</span>
              </div>
              <div className={`bar ${barClass(row.percent)}`}>
                <i style={{ width: `${Math.min(row.percent, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Biggest expenses</h2></div>
          <p className="panel-note">The five largest this month.</p>
          {data && data.top_expenses.length === 0 && (
            <div className="empty"><strong>No expenses this month</strong></div>
          )}
          {(data?.top_expenses || []).map((item) => (
            <div className="tx" key={item.id}>
              <div className="tx-icon out"><Icon name="down" /></div>
              <div className="tx-main">
                <div className="tx-title">{item.title}</div>
                <div className="tx-sub">
                  {formatDate(item.date)}{item.description ? ` · ${item.description}` : ''}
                </div>
              </div>
              <div className="tx-amount">-{money(item.amount)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}