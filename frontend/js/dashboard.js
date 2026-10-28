const $ = (id) => document.getElementById(id);
const monthInput = $('month');
const COLORS = ['#2d5bff', '#f2b138', '#16866a', '#e5566d', '#8b6cf0', '#5b6578'];

const ICON_UP = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

function greetingFor(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}`;
}

function renderStats(data) {
  $('statIncome').textContent = formatMoney(data.income_total);
  $('statExpenses').textContent = formatMoney(data.expense_total);

  const balance = $('statBalance');
  balance.textContent = formatMoney(data.balance);
  balance.className = 'value ' + (data.balance < 0 ? 'neg' : data.balance > 0 ? 'pos' : '');

  const budget = data.budget;
  if (budget) {
    const barClass = budget.percent >= 100 ? 'over' : budget.percent >= 80 ? 'warn' : '';
    $('statBudget').textContent = `${Math.round(budget.percent)}%`;
    $('statBudgetExtra').innerHTML = `
      <div class="bar ${barClass}"><i style="width:${Math.min(budget.percent, 100)}%"></i></div>
      <div class="sub">${formatMoney(budget.spent)} of ${formatMoney(budget.amount)}</div>`;
  } else {
    $('statBudget').textContent = 'Not set';
    $('statBudgetExtra').innerHTML = '<div class="sub"><a href="budgets.html">Set a monthly budget</a></div>';
  }
}

function renderCategories(data) {
  const box = $('categories');
  if (data.by_category.length === 0) {
    box.innerHTML = `<div class="empty"><strong>No expenses this month</strong>
      Add your first expense to see where your money goes.
      <br><a class="button" href="expenses.html?new=1">+ Add expense</a></div>`;
    return;
  }
  const top = data.by_category[0].total;
  box.innerHTML = data.by_category.map((row, index) => `
    <div class="cat-row">
      <div class="top"><span>${escapeHtml(row.category)}</span><span>${formatMoney(row.total)}</span></div>
      <div class="bar"><i style="width:${(row.total / top) * 100}%; --c:${COLORS[index % COLORS.length]}"></i></div>
    </div>`).join('');
}

function renderRecent(data) {
  const box = $('recent');
  if (data.recent.length === 0) {
    box.innerHTML = `<div class="empty"><strong>No transactions yet</strong>
      Your latest income and expenses will appear here.</div>`;
    return;
  }
  box.innerHTML = data.recent.map((item) => {
    const isIncome = item.type === 'income';
    const kind = isIncome ? 'in' : 'out';
    return `
      <div class="tx">
        <div class="tx-icon ${kind}">${isIncome ? ICON_UP : ICON_DOWN}</div>
        <div class="tx-main">
          <div class="tx-title">${escapeHtml(item.title)}</div>
          <div class="tx-sub">${formatDate(item.date)}${item.description ? ' · ' + escapeHtml(item.description) : ''}</div>
        </div>
        <div class="tx-amount ${kind}">${isIncome ? '+' : '-'}${formatMoney(item.amount)}</div>
      </div>`;
  }).join('');
}

async function loadSummary() {
  try {
    const data = await apiFetch(`/finance/summary/?month=${monthInput.value}`);
    renderStats(data);
    renderCategories(data);
    renderRecent(data);
  } catch (err) {
    toast(err.message, 'error');
  }
}

monthInput.value = currentMonth();
monthInput.addEventListener('change', () => {
  if (monthInput.value) loadSummary();
});

appReady.then(() => {
  $('greeting').textContent = greetingFor(BB.displayName);
  loadSummary();
}).catch(() => {});