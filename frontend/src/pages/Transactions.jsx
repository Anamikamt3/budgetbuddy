import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage, fieldErrors } from '../api.js';
import Field from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { currentMonth, formatDate, todayISO } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

// One page component serves BOTH Expenses and Income.
// The "kind" prop picks which of these settings to use.
const SETTINGS = {
  expense: {
    endpoint: '/finance/expenses/',
    title: 'Expenses',
    intro: 'Track what you spend and sort it into categories.',
    noun: 'expense',
    fieldName: 'category',
    fieldLabel: 'Category',
    filterParam: 'category',
    show: (item) => item.category_name || 'Uncategorised',
    loadOptions: async () => {
      const { data } = await api.get('/finance/categories/');
      return data.map((c) => ({ value: String(c.id), label: c.name }));
    },
    canAddOption: true,
    emptyText: 'Add your first expense to start tracking your spending.',
  },
  income: {
    endpoint: '/finance/incomes/',
    title: 'Income',
    intro: 'Record pocket money, scholarships and freelance earnings.',
    noun: 'income',
    fieldName: 'source',
    fieldLabel: 'Source',
    filterParam: 'source',
    show: (item) => item.source_label,
    loadOptions: async () => [
      { value: 'pocket_money', label: 'Pocket money' },
      { value: 'scholarship', label: 'Scholarship' },
      { value: 'freelance', label: 'Freelance' },
      { value: 'other', label: 'Other' },
    ],
    canAddOption: false,
    emptyText: 'Add your first income to see your balance.',
  },
};

/* ---------- The add / edit form that appears in the pop-up ---------- */
function TransactionForm({ settings, options, item, onSaved, onAddOption }) {
  const [values, setValues] = useState({
    amount: item ? item.amount : '',
    date: item ? item.date : todayISO(),
    option: item ? String(item[settings.fieldName]) : '',
    description: item ? item.description : '',
  });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));
  const invalid = (name) => (errors[name] ? 'true' : undefined);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert('');

    const found = {};
    if (!(Number(values.amount) > 0)) found.amount = 'Enter an amount greater than 0.';
    if (!values.option) found.option = `Choose a ${settings.fieldLabel.toLowerCase()}.`;
    if (!values.date) found.date = 'Choose a date.';
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      amount: values.amount,
      date: values.date,
      description: values.description.trim(),
      [settings.fieldName]: values.option,
    };

    setSaving(true);
    try {
      if (item) await api.patch(`${settings.endpoint}${item.id}/`, payload);
      else await api.post(settings.endpoint, payload);
      onSaved(Boolean(item));
    } catch (err) {
      // Show the server's messages under the matching fields
      const server = fieldErrors(err);
      const mapped = {};
      Object.entries(server).forEach(([key, message]) => {
        const name = key === settings.fieldName ? 'option' : key;
        if (['amount', 'date', 'option', 'description'].includes(name)) mapped[name] = message;
      });
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) setAlert(errorMessage(err));
      setSaving(false);
    }
  }

  async function handleAddOption() {
    const id = await onAddOption();
    if (id) setValues((v) => ({ ...v, option: id }));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {alert && <div className="alert" role="alert">{alert}</div>}

      <div className="field-row">
        <Field id="amount" label="Amount" error={errors.amount}>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            placeholder="0.00"
            autoFocus
            value={values.amount}
            onChange={set('amount')}
            aria-invalid={invalid('amount')}
          />
        </Field>
        <Field id="date" label="Date" error={errors.date}>
          <input id="date" type="date" value={values.date} onChange={set('date')} aria-invalid={invalid('date')} />
        </Field>
      </div>

      <Field id="option" label={settings.fieldLabel} error={errors.option}>
        <select id="option" value={values.option} onChange={set('option')} aria-invalid={invalid('option')}>
          <option value="">Choose...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {settings.canAddOption && (
          <button type="button" className="inline-link" onClick={handleAddOption}>
            + New category
          </button>
        )}
      </Field>

      <Field id="description" label="Note (optional)" error={errors.description}>
        <input
          id="description"
          type="text"
          maxLength={200}
          placeholder="e.g. Lunch with friends"
          value={values.description}
          onChange={set('description')}
        />
      </Field>

      <button type="submit" className={`btn${saving ? ' is-loading' : ''}`} disabled={saving}>
        <span className="btn-label">{saving ? 'Saving' : `Save ${settings.noun}`}</span>
      </button>
    </form>
  );
}

/* ---------- The page ---------- */
export default function Transactions({ kind }) {
  const settings = SETTINGS[kind];
  usePageTitle(settings.title);
  const money = useMoney();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [options, setOptions] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState('');
  const [dialog, setDialog] = useState({ open: false, item: null });

  const loadItems = useCallback(async () => {
    const params = {};
    if (month) params.month = month;
    if (filter) params[settings.filterParam] = filter;
    try {
      const { data } = await api.get(settings.endpoint, { params });
      setItems(data);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [month, filter, settings, toast]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    settings.loadOptions().then(setOptions).catch((err) => toast(errorMessage(err), 'error'));
  }, [settings, toast]);

  // Coming from the dashboard button "+ Add expense" (?new=1)
  useEffect(() => {
    if (searchParams.get('new') === '1') setDialog({ open: true, item: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDialog = () => setDialog({ open: false, item: null });

  function handleSaved(wasEdit) {
    closeDialog();
    toast(wasEdit ? 'Changes saved' : `${settings.title.replace(/s$/, '')} added`);
    loadItems();
  }

  async function handleDelete(item) {
    if (!window.confirm(`Delete this ${settings.noun}?`)) return;
    try {
      await api.delete(`${settings.endpoint}${item.id}/`);
      toast('Deleted');
      loadItems();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  // Expense page only: create your own category
  async function handleAddCategory() {
    const name = window.prompt('Name of the new category');
    if (!name || !name.trim()) return null;
    try {
      const { data } = await api.post('/finance/categories/', { name: name.trim() });
      setOptions(await settings.loadOptions());
      toast('Category added');
      return String(data.id);
    } catch (err) {
      toast(errorMessage(err), 'error');
      return null;
    }
  }

  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);

  // Income page only: how much came from each source
  const bySource = {};
  if (kind === 'income') {
    items.forEach((item) => {
      bySource[item.source_label] = (bySource[item.source_label] || 0) + Number(item.amount);
    });
  }

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>{settings.title}</h1>
          <p>{settings.intro}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="button" onClick={() => setDialog({ open: true, item: null })}>
            + Add {settings.noun}
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="monthFilter">Month</label>
          <input id="monthFilter" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="optionFilter">{settings.fieldLabel}</label>
          <select id="optionFilter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="summary-line">
        <span><strong>{items.length}</strong> {items.length === 1 ? 'entry' : 'entries'}</span>
        <span>Total <strong>{money(total)}</strong></span>
        {Object.entries(bySource).map(([name, sum]) => (
          <span key={name}>{name} <strong>{money(sum)}</strong></span>
        ))}
      </div>

      <div className="table-wrap">
        {items.length > 0 ? (
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>{settings.fieldLabel}</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td><span className="chip">{settings.show(item)}</span></td>
                  <td>{item.description || <span style={{ color: 'var(--muted)' }}>-</span>}</td>
                  <td className="num">{money(item.amount)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="button secondary small" onClick={() => setDialog({ open: true, item })}>
                        Edit
                      </button>
                      <button type="button" className="button secondary small danger" onClick={() => handleDelete(item)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <strong>Nothing here yet</strong>
            {settings.emptyText}
            <br />
            <button type="button" className="button" onClick={() => setDialog({ open: true, item: null })}>
              + Add {settings.noun}
            </button>
          </div>
        )}
      </div>

      <Modal
        open={dialog.open}
        onClose={closeDialog}
        title={dialog.item ? `Edit ${settings.noun}` : `Add ${settings.noun}`}
      >
        <TransactionForm
          settings={settings}
          options={options}
          item={dialog.item}
          onSaved={handleSaved}
          onAddOption={handleAddCategory}
        />
      </Modal>
    </>
  );
}
