// One script that powers BOTH the Expenses page and the Income page.
// The page tells us which one with <body data-kind="expense"> or "income".

const KIND = document.body.dataset.kind;

const SETTINGS = {
  expense: {
    endpoint: '/finance/expenses/',
    title: 'Expenses',
    intro: 'Track what you spend and sort it into categories.',
    noun: 'expense',
    fieldName: 'category',        // the name the API uses
    fieldLabel: 'Category',
    filterParam: 'category',
    show: (item) => item.category_name || 'Uncategorised',
    loadOptions: async () => {
      const list = await apiFetch('/finance/categories/');
      return list.map((c) => ({ value: String(c.id), label: c.name }));
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
}[KIND];

const $ = (id) => document.getElementById(id);
const form = $('txForm');
const dialog = $('formDialog');
const listBody = $('listBody');

let items = [];
let options = [];
let editingId = null;

/* ---------- Fill in the page texts ---------- */
document.title = `${SETTINGS.title} | BudgetBuddy`;
$('pageTitle').textContent = SETTINGS.title;
$('pageIntro').textContent = SETTINGS.intro;
$('addBtn').textContent = `+ Add ${SETTINGS.noun}`;
$('optionFilterLabel').textContent = SETTINGS.fieldLabel;
$('optionHeader').textContent = SETTINGS.fieldLabel;
$('optionLabel').textContent = SETTINGS.fieldLabel;
$('saveBtn').querySelector('.btn-label').textContent = `Save ${SETTINGS.noun}`;
$('addOptionBtn').hidden = !SETTINGS.canAddOption;
$('monthFilter').value = currentMonth();

/* ---------- Dropdowns ---------- */
function fillOptions() {
  const rows = options.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
  $('option').innerHTML = `<option value="">Choose...</option>${rows}`;

  const previous = $('optionFilter').value;
  $('optionFilter').innerHTML = `<option value="">All</option>${rows}`;
  $('optionFilter').value = previous;
}

/* ---------- Load and show the list ---------- */
async function loadItems() {
  const params = new URLSearchParams();
  if ($('monthFilter').value) params.set('month', $('monthFilter').value);
  if ($('optionFilter').value) params.set(SETTINGS.filterParam, $('optionFilter').value);

  try {
    items = await apiFetch(`${SETTINGS.endpoint}?${params}`);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function render() {
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  $('summaryLine').innerHTML =
    `<span><strong>${items.length}</strong> ${items.length === 1 ? 'entry' : 'entries'}</span>` +
    `<span>Total <strong>${formatMoney(total)}</strong></span>`;

  const hasItems = items.length > 0;
  $('dataTable').hidden = !hasItems;
  $('emptyBox').hidden = hasItems;

  if (!hasItems) {
    $('emptyBox').innerHTML = `<strong>Nothing here yet</strong>${SETTINGS.emptyText}
      <br><button type="button" class="button" id="emptyAdd">+ Add ${SETTINGS.noun}</button>`;
    $('emptyAdd').addEventListener('click', () => openForm());
    listBody.innerHTML = '';
    return;
  }

  listBody.innerHTML = items.map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td><span class="chip">${escapeHtml(SETTINGS.show(item))}</span></td>
      <td>${item.description ? escapeHtml(item.description) : '<span style="color:var(--muted)">-</span>'}</td>
      <td class="num">${formatMoney(item.amount)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="button secondary small" data-edit="${item.id}">Edit</button>
          <button type="button" class="button secondary small danger" data-delete="${item.id}">Delete</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ---------- Add / edit form ---------- */
function openForm(item) {
  clearErrors(form);
  editingId = item ? item.id : null;
  $('dialogTitle').textContent = item ? `Edit ${SETTINGS.noun}` : `Add ${SETTINGS.noun}`;

  form.elements.amount.value = item ? item.amount : '';
  form.elements.date.value = item ? item.date : todayISO();
  form.elements.option.value = item ? String(item[SETTINGS.fieldName]) : '';
  form.elements.description.value = item ? item.description : '';

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
  if (!form.elements.option.value) {
    showFieldError(form, 'option', `Choose a ${SETTINGS.fieldLabel.toLowerCase()}.`);
    return;
  }
  if (!form.elements.date.value) {
    showFieldError(form, 'date', 'Choose a date.');
    return;
  }

  const payload = {
    amount: amount,
    date: form.elements.date.value,
    description: form.elements.description.value.trim(),
    [SETTINGS.fieldName]: form.elements.option.value,
  };

  const button = $('saveBtn');
  setLoading(button, true, 'Saving');
  try {
    const url = editingId ? `${SETTINGS.endpoint}${editingId}/` : SETTINGS.endpoint;
    await apiFetch(url, { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    dialog.close();
    toast(editingId ? 'Changes saved' : `${SETTINGS.title.replace(/s$/, '')} added`);
    await loadItems();
  } catch (err) {
    // Show server messages under the right field
    let shown = false;
    Object.keys(err.data || {}).forEach((key) => {
      const name = key === SETTINGS.fieldName ? 'option' : key;
      if (form.elements[name]) {
        const value = err.data[key];
        showFieldError(form, name, Array.isArray(value) ? value[0] : String(value));
        shown = true;
      }
    });
    if (!shown) showFormAlert(form, err.message);
  }
  setLoading(button, false);
});

/* ---------- Buttons ---------- */
$('addBtn').addEventListener('click', () => openForm());
$('closeBtn').addEventListener('click', () => dialog.close());

$('monthFilter').addEventListener('change', loadItems);
$('optionFilter').addEventListener('change', loadItems);

listBody.addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const deleteId = e.target.dataset.delete;

  if (editId) {
    openForm(items.find((item) => String(item.id) === editId));
  }
  if (deleteId && confirm(`Delete this ${SETTINGS.noun}?`)) {
    try {
      await apiFetch(`${SETTINGS.endpoint}${deleteId}/`, { method: 'DELETE' });
      toast('Deleted');
      await loadItems();
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

// Expense page only: let the user create their own category.
$('addOptionBtn').addEventListener('click', async () => {
  const name = window.prompt('Name of the new category');
  if (!name || !name.trim()) return;
  try {
    const created = await apiFetch('/finance/categories/', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    });
    options = await SETTINGS.loadOptions();
    fillOptions();
    form.elements.option.value = String(created.id);
    toast('Category added');
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- Start ---------- */
appReady.then(async () => {
  options = await SETTINGS.loadOptions();
  fillOptions();
  await loadItems();
  // Coming from the dashboard button "+ Add expense"
  if (new URLSearchParams(window.location.search).get('new') === '1') openForm();
}).catch(() => {});