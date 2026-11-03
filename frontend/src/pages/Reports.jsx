import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api.js';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { downloadFile } from '../download.js';
import { currentMonth, monthLabel } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

const REPORTS = [
  {
    file: 'pdf',
    title: 'PDF report',
    description: 'A clean, printable summary you can share or keep.',
    includes: ['Income, expenses, balance and savings rate', 'Spending by category', 'Budgets vs what you spent', 'Full expense history'],
  },
  {
    file: 'xlsx',
    title: 'Excel workbook',
    description: 'Every number in a spreadsheet, ready for your own analysis.',
    includes: ['Summary sheet', 'Expenses and Income sheets with totals', 'Category and Budget sheets', 'Works in Excel and Google Sheets'],
  },
];

export default function Reports() {
  usePageTitle('Reports');
  const money = useMoney();
  const toast = useToast();

  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState('');           // which download is running

  useEffect(() => {
    if (!month) return undefined;
    let cancelled = false;
    api
      .get('/finance/summary/', { params: { month } })
      .then((res) => { if (!cancelled) setSummary(res.data); })
      .catch((err) => toast(errorMessage(err), 'error'));
    return () => { cancelled = true; };
  }, [month, toast]);

  async function handleDownload(report) {
    setBusy(report.file);
    try {
      await downloadFile(
        '/finance/reports/monthly/',
        { month, file: report.file },
        `BudgetBuddy_Report_${month}.${report.file}`
      );
      toast(`${report.title} downloaded`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy('');
    }
  }

  const empty = summary && summary.income_total === 0 && summary.expense_total === 0;

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Reports</h1>
          <p>Download a full report for any month.</p>
        </div>
        <div className="head-actions">
          <div className="field" style={{ margin: 0 }}>
            <label className="sr-only" htmlFor="month">Month</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
        </div>
      </header>

      <section className="stats" aria-label="Month at a glance">
        <div className="stat">
          <div className="label">Month</div>
          <div className="value small">{month ? monthLabel(month) : '--'}</div>
          <div className="sub">The report covers this month</div>
        </div>
        <div className="stat">
          <div className="label">Income</div>
          <div className="value">{summary ? money(summary.income_total) : '--'}</div>
        </div>
        <div className="stat">
          <div className="label">Expenses</div>
          <div className="value">{summary ? money(summary.expense_total) : '--'}</div>
        </div>
        <div className="stat">
          <div className="label">Balance</div>
          <div className={`value ${summary ? (summary.balance < 0 ? 'neg' : summary.balance > 0 ? 'pos' : '') : ''}`}>
            {summary ? money(summary.balance) : '--'}
          </div>
        </div>
      </section>

      {empty && (
        <div className="notice" style={{ marginTop: 20 }} role="status">
          There is no income or spending recorded for this month, so the report will be mostly empty.
        </div>
      )}

      <section className="grid-2">
        {REPORTS.map((report) => (
          <div className="panel report-card" key={report.file}>
            <div className="report-icon"><Icon name="reports" /></div>
            <h2>{report.title}</h2>
            <p className="panel-note">{report.description}</p>
            <ul className="report-list">
              {report.includes.map((line) => (
                <li key={line}><Icon name="check" />{line}</li>
              ))}
            </ul>
            <button type="button" className="button" onClick={() => handleDownload(report)} disabled={busy !== ''}>
              <Icon name="download" />
              {busy === report.file ? 'Preparing...' : `Download ${report.file.toUpperCase()}`}
            </button>
          </div>
        ))}
      </section>
    </>
  );
}