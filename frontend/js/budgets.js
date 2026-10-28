const $ = (id) => document.getElementById(id);
const monthInput = $('month');
const form = $('budgetForm');
const dialog = $('formDialog');

let budgets = [];
let categories = [];

monthInput.value = currentMonth();

function monthLabel() {
  const [year, month] = monthInput.value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function barClass(percent) {
  return percent >= 100 ? 'over' : percent >= 80 ? 'warn' : '';
}

function remainingText(budget) {
  const left = budget.amount - budget.spent;
  return left >= 0
    ? `${formatMoney(left)} left`
    : `${formatMoney(Math.abs(left))} over budget`;
}

/* ---------- Show the page ---------- */
function render() {
  const overall = budgets.find((b) => b.category === null);
  const others = budgets.filter((b) => b.category !== null);

  // Big card at the top: the overall budget
  if (overall) {
    const amount = Number(overall.amount);
    const percent = amount ? (overall.spent / amount) * 100 : 0;
    $('hero').innerHTML = `
      <div class="label">Overall budget for ${monthLabel()}</div>
      <div class="amount">${formatMoney(amount)}</div>
      <div class="bar ${barClass(percent)}"><i style="width:${Math.min(percent, 100)}%"></i></div>
      <div class="meta">
        <span>Spent ${formatMoney(overall.spent)} (${Math.round(percent)}%)</span>
        <span>${remainingText({ amount, spent: overall.spent })}</span>
      </div>
      <button type="button" class="button secondary small" data-edit="${overall.id}" style="margin-top:16px">Edit</button>
      <button type="button" class="button secondary small danger" data-delete="${overall.id}" style="margin-top:16px">Delete</button>`;
  } else {
    $('hero').innerHTML = `
      <div class="label">Overall budget for ${monthLabel()}</div>
      <div class="amount">Not set</div>
      <div class="meta"><span>Set a total monthly limit to keep your spending in check.</span></div>
      <button type="button" class="button" data-new-overall="1">+ Set overall budget</button>`;
  }

  // Category budgets
  const list = $('categoryList');
  if (others.length === 0) {
    list.innerHTML = `<div class="empty"><strong>No category budgets yet</strong>
      Give Food, Travel or any category its own limit.
      <br><button type="button" class="button secondary" data-new-category="1">+ Add category budget</button></div>`;
    return;
  }
  list.innerHTML = others.map((b) => {
    const amount = Number(b.amount);
    const percent = amount ? (b.spent / amount) * 100 : 0;
    const over = b.spent > amount;
    return `
      <div class="b-row">
        <div class="b-top">
          <div>
            <div class="b-name">${escapeHtml(b.category_name)}</div>
            <div class="b-nums">${formatMoney(b.spent)} of ${formatMoney(amount)}</div>
          </div>
          <div class="row-actions">
            <button type="button" class="button secondary small" data-edit="${b.id}">Edit</button>
            <button type="button" class="button secondary small danger" data-delete="${b.id}">Delete</button>
          </div>
        </div>
        <div class="bar ${barClass(percent)}"><i style="width:${Math.min(percent, 100)}%"></i></div>
        <div class="b-foot ${over ? 'over' : ''}">${remainingText({ amount, spent: b.spent })} · ${Math.round(percent)}% used</div>
      </div>`;
  }).join('');
}

async function loadBudgets() {
  try {
    budgets = await apiFetch(`/finance/budgets/?month=${monthInput.value}`);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ---------- Pop-up form ---------- */
function fillCategories() {
  const rows = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  $('category').innerHTML = `<option value="">Overall (all spending)</option>${rows}`;
}

// categoryId: pre-select a category. Pass "" for the overall budget.
function openForm(categoryId, amount) {
  clearErrors(form);
  $('dialogTitle').textContent = `Set budget for ${monthLabel()}`;
  form.elements.category.value = categoryId == null ? '' : String(categoryId);
  form.elements.amount.value = amount == null ? '' : amount;
  dialog.showModal();
  form.elements.amount.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(form);

  const amount = form.elements.amount.value;
  if (!(Number(amount) > 0)) {
    showFieldError(form, 'amount', 'Enter an amount greater than 0.');
    return;
  }

  const category = form.elements.category.value;
  const payload = {
    category: category ? Number(category) : null,
    month: `${monthInput.value}-01`,       // budgets are stored on the 1st of the month
    amount: amount,
  };

  const button = $('saveBtn');
  setLoading(button, true, 'Saving');
  try {
    // Saving again for the same month and category simply updates it.
    await apiFetch('/finance/budgets/', { method: 'POST', body: JSON.stringify(payload) });
    dialog.close();
    toast('Budget saved');
    await loadBudgets();
  } catch (err) {
    let shown = false;
    Object.keys(err.data || {}).forEach((key) => {
      if (form.elements[key]) {
        const value = err.data[key];
        showFieldError(form, key, Array.isArray(value) ? value[0] : String(value));
        shown = true;
      }
    });
    if (!shown) showFormAlert(form, err.message);
  }
  setLoading(button, false);
});

/* ---------- Buttons ---------- */
$('addBtn').addEventListener('click', () => openForm(''));
$('closeBtn').addEventListener('click', () => dialog.close());
monthInput.addEventListener('change', () => {
  if (monthInput.value) loadBudgets();
});

// One click handler for every button inside the hero card and the list
document.querySelector('main').addEventListener('click', async (e) => {
  const { edit, delete: del, newOverall, newCategory } = e.target.dataset;

  if (edit) {
    const budget = budgets.find((b) => String(b.id) === edit);
    openForm(budget.category, budget.amount);
  }
  if (newOverall) openForm('');
  if (newCategory) openForm(categories.length ? categories[0].id : '');

  if (del && confirm('Delete this budget?')) {
    try {
      await apiFetch(`/finance/budgets/${del}/`, { method: 'DELETE' });
      toast('Budget deleted');
      await loadBudgets();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

/* ---------- Start ---------- */
appReady.then(async () => {
  categories = await apiFetch('/finance/categories/');
  fillCategories();
  await loadBudgets();
}).catch(() => {});