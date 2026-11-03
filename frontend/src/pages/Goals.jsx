import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage, fieldErrors } from '../api.js';
import Field from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDate, todayISO } from '../format.js';
import useMoney from '../hooks/useMoney.js';
import usePageTitle from '../hooks/usePageTitle.js';

// The example goals from the project plan, as one-click starters
const IDEAS = ['New Laptop Fund', 'Japan Trip Fund', 'Emergency Savings'];

/* ---------- Circle that fills up as you save ---------- */
function ProgressRing({ percent, done }) {
  return (
    <div className={`goal-ring${done ? ' done' : ''}`} role="img" aria-label={`${Math.round(percent)} percent saved`}>
      <svg viewBox="0 0 36 36">
        <circle className="track" cx="18" cy="18" r="15.9155" pathLength="100" />
        <circle
          className="value"
          cx="18"
          cy="18"
          r="15.9155"
          pathLength="100"
          strokeDasharray={`${percent} ${100 - percent}`}
        />
      </svg>
      <span>{Math.round(percent)}%</span>
    </div>
  );
}

// Text and colour for the deadline label on each card
function deadlineInfo(goal) {
  if (goal.is_completed) return { text: 'Goal reached', tone: 'ok' };
  if (goal.days_left == null) return { text: 'No deadline', tone: '' };
  if (goal.days_left < 0) {
    const days = -goal.days_left;
    return { text: `Overdue by ${days} day${days === 1 ? '' : 's'}`, tone: 'bad' };
  }
  if (goal.days_left === 0) return { text: 'Due today', tone: 'warn' };
  return { text: `${goal.days_left} days left`, tone: goal.days_left <= 14 ? 'warn' : '' };
}

/* ---------- Create / edit form ---------- */
function GoalForm({ goal, initialName, onSaved }) {
  const [values, setValues] = useState({
    name: goal ? goal.name : initialName || '',
    target_amount: goal ? goal.target_amount : '',
    saved_amount: goal ? goal.saved_amount : '',
    deadline: goal && goal.deadline ? goal.deadline : '',
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
    if (!values.name.trim()) found.name = 'Give your goal a name.';
    if (!(Number(values.target_amount) > 0)) found.target_amount = 'Enter a target greater than 0.';
    if (values.saved_amount !== '' && Number(values.saved_amount) < 0) found.saved_amount = 'This cannot be negative.';
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      name: values.name.trim(),
      target_amount: values.target_amount,
      saved_amount: values.saved_amount === '' ? '0' : values.saved_amount,
      deadline: values.deadline || null,
    };

    setSaving(true);
    try {
      if (goal) await api.patch(`/finance/goals/${goal.id}/`, payload);
      else await api.post('/finance/goals/', payload);
      onSaved(Boolean(goal));
    } catch (err) {
      const server = fieldErrors(err);
      const mapped = {};
      ['name', 'target_amount', 'saved_amount', 'deadline'].forEach((key) => {
        if (server[key]) mapped[key] = server[key];
      });
      setErrors(mapped);
      if (Object.keys(mapped).length === 0) setAlert(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {alert && <div className="alert" role="alert">{alert}</div>}

      <Field id="goalName" label="Goal name" error={errors.name}>
        <input id="goalName" type="text" maxLength={100} placeholder="e.g. New Laptop Fund" autoFocus
          value={values.name} onChange={set('name')} aria-invalid={invalid('name')} />
      </Field>

      <div className="field-row">
        <Field id="goalTarget" label="Target amount" error={errors.target_amount}>
          <input id="goalTarget" type="number" step="0.01" min="0.01" inputMode="decimal" placeholder="0.00"
            value={values.target_amount} onChange={set('target_amount')} aria-invalid={invalid('target_amount')} />
        </Field>
        <Field id="goalSaved" label="Already saved" error={errors.saved_amount}>
          <input id="goalSaved" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
            value={values.saved_amount} onChange={set('saved_amount')} aria-invalid={invalid('saved_amount')} />
        </Field>
      </div>

      <Field id="goalDeadline" label="Deadline (optional)" error={errors.deadline}>
        <input id="goalDeadline" type="date" min={goal ? undefined : todayISO()}
          value={values.deadline} onChange={set('deadline')} aria-invalid={invalid('deadline')} />
      </Field>

      <button type="submit" className={`btn${saving ? ' is-loading' : ''}`} disabled={saving}>
        <span className="btn-label">{saving ? 'Saving' : goal ? 'Save changes' : 'Create goal'}</span>
      </button>
    </form>
  );
}

/* ---------- Add money / take money out ---------- */
function FundForm({ goal, mode: startMode, money, onSaved }) {
  const [mode, setMode] = useState(startMode);        // 'add' or 'withdraw'
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const quick = mode === 'add' ? [100, 500, 1000] : [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!(Number(amount) > 0)) {
      setError('Enter an amount greater than 0.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const signed = mode === 'add' ? amount : `-${amount}`;
      await api.post(`/finance/goals/${goal.id}/contribute/`, { amount: signed });
      onSaved(mode);
    } catch (err) {
      setError(fieldErrors(err).amount || errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="panel-note" style={{ marginBottom: 14 }}>
        {goal.name}: {money(goal.saved_amount)} saved of {money(goal.target_amount)}
      </p>

      <div className="segmented" role="group" aria-label="Action" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={mode === 'add'} onClick={() => setMode('add')}>Add money</button>
        <button type="button" aria-pressed={mode === 'withdraw'} onClick={() => setMode('withdraw')}>Take out</button>
      </div>

      <Field id="fundAmount" label="Amount" error={error}>
        <input id="fundAmount" type="number" step="0.01" min="0.01" inputMode="decimal" placeholder="0.00" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={error ? 'true' : undefined} />
        {mode === 'add' && (
          <div className="chips">
            {quick.map((n) => (
              <button key={n} type="button" className="chip-button" onClick={() => setAmount(String(n))}>
                +{n}
              </button>
            ))}
            {goal.remaining > 0 && (
              <button type="button" className="chip-button" onClick={() => setAmount(String(goal.remaining))}>
                Finish it ({money(goal.remaining)})
              </button>
            )}
          </div>
        )}
      </Field>

      <button type="submit" className={`btn${saving ? ' is-loading' : ''}`} disabled={saving}>
        <span className="btn-label">{saving ? 'Saving' : mode === 'add' ? 'Add to goal' : 'Take out'}</span>
      </button>
    </form>
  );
}

/* ---------- The page ---------- */
export default function Goals() {
  usePageTitle('Savings goals');
  const money = useMoney();
  const toast = useToast();

  const [goals, setGoals] = useState(null);
  const [goalDialog, setGoalDialog] = useState({ open: false, goal: null, name: '' });
  const [fundDialog, setFundDialog] = useState({ open: false, goal: null, mode: 'add' });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/finance/goals/');
      setGoals(data);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const closeGoal = () => setGoalDialog((d) => ({ ...d, open: false }));
  const closeFund = () => setFundDialog((d) => ({ ...d, open: false }));

  function handleGoalSaved(wasEdit) {
    closeGoal();
    toast(wasEdit ? 'Goal updated' : 'Goal created');
    load();
  }

  function handleFundSaved(mode) {
    closeFund();
    toast(mode === 'add' ? 'Money added to your goal' : 'Money taken out');
    load();
  }

  async function handleDelete(goal) {
    if (!window.confirm(`Delete "${goal.name}"? Its savings record will be removed.`)) return;
    try {
      await api.delete(`/finance/goals/${goal.id}/`);
      toast('Goal deleted');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  const list = goals || [];
  const totalSaved = list.reduce((sum, g) => sum + Number(g.saved_amount), 0);
  const totalTarget = list.reduce((sum, g) => sum + Number(g.target_amount), 0);
  const active = list.filter((g) => !g.is_completed).length;
  const completed = list.filter((g) => g.is_completed).length;

  return (
    <>
      <header className="page-head with-actions">
        <div>
          <h1>Savings goals</h1>
          <p>Save towards the things you want and watch your progress grow.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="button" onClick={() => setGoalDialog({ open: true, goal: null, name: '' })}>
            + New goal
          </button>
        </div>
      </header>

      <section className="stats" aria-label="Goal totals">
        <div className="stat">
          <div className="label">Total saved</div>
          <div className="value">{goals ? money(totalSaved) : '--'}</div>
          <div className="sub">Across all goals</div>
        </div>
        <div className="stat">
          <div className="label">Total target</div>
          <div className="value">{goals ? money(totalTarget) : '--'}</div>
          <div className="sub">What you are saving for</div>
        </div>
        <div className="stat">
          <div className="label">Active goals</div>
          <div className="value">{goals ? active : '--'}</div>
          <div className="sub">Still in progress</div>
        </div>
        <div className="stat">
          <div className="label">Completed</div>
          <div className={`value ${completed > 0 ? 'pos' : ''}`}>{goals ? completed : '--'}</div>
          <div className="sub">Goals reached</div>
        </div>
      </section>

      {goals && goals.length === 0 && (
        <section className="panel wide">
          <div className="empty">
            <strong>No savings goals yet</strong>
            Pick an idea below or create your own.
            <div className="chips" style={{ justifyContent: 'center', marginTop: 16 }}>
              {IDEAS.map((idea) => (
                <button key={idea} type="button" className="chip-button"
                  onClick={() => setGoalDialog({ open: true, goal: null, name: idea })}>
                  {idea}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="goal-grid" aria-label="Your goals">
        {list.map((goal) => {
          const info = deadlineInfo(goal);
          const months = goal.days_left > 0 ? Math.max(1, Math.ceil(goal.days_left / 30)) : 0;
          const perMonth = months ? goal.remaining / months : 0;
          return (
            <article className={`goal-card${goal.is_completed ? ' completed' : ''}`} key={goal.id}>
              <div className="goal-top">
                <ProgressRing percent={goal.progress} done={goal.is_completed} />
                <div className="goal-title">
                  <h2>{goal.name}</h2>
                  <span className={`pill ${info.tone}`}>{info.text}</span>
                  {goal.deadline && <span className="goal-date">by {formatDate(goal.deadline)}</span>}
                </div>
              </div>

              <div className="goal-amounts">
                <strong>{money(goal.saved_amount)}</strong>
                <span>of {money(goal.target_amount)}</span>
              </div>
              <div className="bar" style={{ '--c': goal.is_completed ? '#16866a' : '#2d5bff' }}>
                <i style={{ width: `${goal.progress}%` }} />
              </div>
              <p className="goal-hint">
                {goal.is_completed
                  ? 'You reached this goal. Well done!'
                  : perMonth > 0
                    ? `Save ${money(perMonth)} a month to finish on time.`
                    : `${money(goal.remaining)} still to go.`}
              </p>

              <div className="goal-actions">
                {!goal.is_completed && (
                  <button type="button" className="button small"
                    onClick={() => setFundDialog({ open: true, goal, mode: 'add' })}>
                    Add money
                  </button>
                )}
                {Number(goal.saved_amount) > 0 && (
                  <button type="button" className="button secondary small"
                    onClick={() => setFundDialog({ open: true, goal, mode: 'withdraw' })}>
                    Take out
                  </button>
                )}
                <button type="button" className="button secondary small"
                  onClick={() => setGoalDialog({ open: true, goal, name: '' })}>
                  Edit
                </button>
                <button type="button" className="button secondary small danger" onClick={() => handleDelete(goal)}>
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <Modal open={goalDialog.open} onClose={closeGoal} title={goalDialog.goal ? 'Edit goal' : 'New savings goal'}>
        <GoalForm goal={goalDialog.goal} initialName={goalDialog.name} onSaved={handleGoalSaved} />
      </Modal>

      <Modal open={fundDialog.open} onClose={closeFund} title={fundDialog.mode === 'add' ? 'Add money' : 'Take money out'}>
        {fundDialog.goal && (
          <FundForm goal={fundDialog.goal} mode={fundDialog.mode} money={money} onSaved={handleFundSaved} />
        )}
      </Modal>
    </>
  );
}