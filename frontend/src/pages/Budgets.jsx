import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../api.js';
import Field from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { barClass, currentMonth, monthLabel } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

/* ---------- The pop-up form ---------- */
function BudgetForm({ categories, month, initial, onSaved }) {
  const [categoryId, setCategoryId] = useState(initial.categoryId == null ? '' : String(initial.categoryId));
  const [amount, setAmount] = useState(initial.amount == null ? '' : String(initial.amount));
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert('');

    if (!(Number(amount) > 0)) {
      setErrors({ amount: 'Enter an amount greater than 0.' });
      return;
    }
    setErrors({});

    const payload = {
      category: categoryId ? Number(categoryId) : null,   // empty = overall budget
      month: `${month}-01`,                                // budgets live on the 1st of a month
      amount,
    };

    setSaving(true);
    try {
      // Saving again for the same month and category simply updates it.
      await api.post('/finance/budgets/', payload);
      onSaved();
    } catch (err) {
      const server = fieldErrors(err);
      const mapped = {};
      ['category', 'amount'].forEach((name) => {
        if (server[name]) mapped[name] = server[name];
      });
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) setAlert(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {alert && <div className="alert" role="alert">{alert}</div>}

      <Field id="category" label="Applies to" hint='Choose "Overall" for your total monthly limit.' error={errors.category}>
        <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Overall (all spending)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>

      <Field id="amount" label="Monthly limit" error={errors.amount}>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          placeholder="0.00"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={errors.amount ? 'true' : undefined}
        />
      </Field>

      <button type="submit" className={`btn${saving ? ' is-loading' : ''}`} disabled={saving}>
        <span className="btn-label">{saving ? 'Saving' : 'Save budget'}</span>
      </button>
    </form>
  );
}

/* ---------- The page ---------- */
export default function Budgets() {
  usePageTitle('Budgets');
  const money = useMoney();
  const toast = useToast();

  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [dialog, setDialog] = useState({ open: false, categoryId: '', amount: '' });

  const loadBudgets = useCallback(async () => {
    if (!month) return;
    try {
      const { data } = await api.get('/finance/budgets/', { params: { month } });
      setBudgets(data);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [month, toast]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  useEffect(() => {
    api.get('/finance/categories/')
      .then((res) => setCategories(res.data))
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [toast]);

  const openForm = (categoryId = '', amount = '') => setDialog({ open: true, categoryId, amount });
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  function handleSaved() {
    closeDialog();
    toast('Budget saved');
    loadBudgets();
  }

  async function handleDelete(budget) {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await api.delete(`/finance/budgets/${budget.id}/`);
      toast('Budget deleted');
      loadBudgets();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  const overall = budgets.find((b) => b.category === null);
  const others = budgets.filter((b) => b.category !== null);

  function remainingText(amount, spent) {
    const left = amount - spent;
    return left >= 0 ? `${money(left)} left` : `${money(Math.abs(left))} over budget`;
  }

  const overallAmount = overall ? Number(overall.amount) : 0;
  const overallPercent = overallAmount ? (overall.spent / overallAmount) * 100 : 0;

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Budgets</h1>
          <p>Set a monthly limit and watch it fill up as you spend.</p>
        </div>
        <div className="head-actions">
          <div className="field" style={{ margin: 0 }}>
            <label className="sr-only" htmlFor="month">Month</label>
            <input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <button type="button" className="button" onClick={() => openForm('')}>+ Set budget</button>
        </div>
      </header>

      {/* Big card: the overall budget */}
      <section className="budget-hero" aria-label="Overall budget">
        <div className="label">Overall budget for {month ? monthLabel(month) : 'this month'}</div>
        {overall ? (
          <>
            <div className="amount">{money(overallAmount)}</div>
            <div className={`bar ${barClass(overallPercent)}`}>
              <i style={{ width: `${Math.min(overallPercent, 100)}%` }} />
            </div>
            <div className="meta">
              <span>Spent {money(overall.spent)} ({Math.round(overallPercent)}%)</span>
              <span>{remainingText(overallAmount, overall.spent)}</span>
            </div>
            <button type="button" className="button secondary small" style={{ marginTop: 16 }}
              onClick={() => openForm('', overall.amount)}>
              Edit
            </button>{' '}
            <button type="button" className="button secondary small danger" style={{ marginTop: 16 }}
              onClick={() => handleDelete(overall)}>
              Delete
            </button>
          </>
        ) : (
          <>
            <div className="amount">Not set</div>
            <div className="meta"><span>Set a total monthly limit to keep your spending in check.</span></div>
            <button type="button" className="button" onClick={() => openForm('')}>+ Set overall budget</button>
          </>
        )}
      </section>

      {/* Category budgets */}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-head"><h2>Category budgets</h2></div>

        {others.length === 0 && (
          <div className="empty">
            <strong>No category budgets yet</strong>
            Give Food, Travel or any category its own limit.
            <br />
            <button type="button" className="button secondary"
              onClick={() => openForm(categories.length ? categories[0].id : '')}>
              + Add category budget
            </button>
          </div>
        )}

        {others.map((b) => {
          const amount = Number(b.amount);
          const percent = amount ? (b.spent / amount) * 100 : 0;
          return (
            <div className="b-row" key={b.id}>
              <div className="b-top">
                <div>
                  <div className="b-name">{b.category_name}</div>
                  <div className="b-nums">{money(b.spent)} of {money(amount)}</div>
                </div>
                <div className="row-actions">
                  <button type="button" className="button secondary small" onClick={() => openForm(b.category, b.amount)}>
                    Edit
                  </button>
                  <button type="button" className="button secondary small danger" onClick={() => handleDelete(b)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className={`bar ${barClass(percent)}`}>
                <i style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
              <div className={`b-foot${b.spent > amount ? ' over' : ''}`}>
                {remainingText(amount, b.spent)} · {Math.round(percent)}% used
              </div>
            </div>
          );
        })}
      </section>

      <Modal open={dialog.open} onClose={closeDialog} title={`Set budget for ${month ? monthLabel(month) : ''}`}>
        <BudgetForm
          categories={categories}
          month={month}
          initial={{ categoryId: dialog.categoryId, amount: dialog.amount }}
          onSaved={handleSaved}
        />
      </Modal>
    </>
  );
}
