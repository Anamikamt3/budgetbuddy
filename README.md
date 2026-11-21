# 💰 BudgetBuddy – AI-Powered Budget Management Tool

[![Tests](https://github.com/Anamikamt3/BudgetBuddy-AI-Tool/actions/workflows/tests.yml/badge.svg)](https://github.com/Anamikamt3/BudgetBuddy-AI-Tool/actions/workflows/tests.yml)

BudgetBuddy is a full-stack budget management application designed to help students manage their personal finances efficiently. It provides features for tracking income and expenses, managing budgets and savings goals, analysing spending, and receiving alerts through an intuitive, responsive interface.

🌐 **Live App:** https://budgetbuddy-omega-blond.vercel.app 
⚙️ **API:**  https://budgetbuddy-api-mjtj.onrender.com

> **Note:** The API runs on a free hosting plan, so the first request after a quiet period can take about a minute.

---

## ✨ Features

- **User Authentication** – Registration and login with JWT tokens and automatic token refresh.
- **Dashboard** – Monthly income, expenses, balance, budget usage, and recent transactions.
- **Expenses and Income** – Add, edit, delete, and filter records with default and custom categories.
- **Budget Management** – Overall and per-category monthly budgets with progress bars.
- **Transaction History** – All income and expenses in one list, grouped by day.
- **Savings Goals** – Targets, deadlines, progress rings, adding and withdrawing money, and milestones.
- **Notifications** – Budget alerts (80% and over budget), goal milestones, savings reminders, and monthly report notices, shown in the app and sent by email.
- **Analytics** – Charts for monthly trends, spending by category, daily and weekday spending, income sources, and insights.
- **Reports and Exports** – Monthly PDF reports, plus Excel reports and CSV export for Premium users.
- **Profile** – Name, email, currency, monthly income, profile photo with click-to-enlarge view, and password change.
- **Premium User Features** – Free and Premium plans with server-enforced limits for goals, custom categories, analytics range, Excel exports, and CSV exports. An administrator changes a user's plan through the Django admin dashboard.
- **Responsive UI** – A clean, professional interface that works on desktop and mobile.

---

## 🛠️ Technologies Used

### Frontend

- React.js
- JavaScript
- HTML5
- CSS3
- Vite
- React Router
- Axios
- Recharts

### Backend

- Python
- Django
- Django REST Framework
- JWT Authentication (SimpleJWT)
- PostgreSQL
- ReportLab (PDF)
- openpyxl (Excel)
- Email API (EmailJS or Brevo)

### Testing and DevOps

- Django Test Runner
- Vitest
- React Testing Library
- GitHub Actions (Continuous Integration)
- Render (API and Database)
- Vercel (Frontend)

### Tools

- Git
- GitHub
- VS Code
- pgAdmin
- npm

---

## 📂 Project Structure

```text
BudgetBuddy-AI-Tool/
│
├── .github/
│   └── workflows/
│       └── tests.yml          # Runs all tests on every push
│
├── backend/
│   ├── accounts/              # Users, profile, login, plan changes
│   ├── config/                # Settings and URLs
│   ├── finance/               # Expenses, budgets, goals, alerts, reports, analytics
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example           # Template of required settings
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── styles/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

---

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Anamikamt3/BudgetBuddy-AI-Tool.git
cd BudgetBuddy-AI-Tool
```

### 2. Backend Setup — Django

Create and activate a virtual environment:

```bash
cd backend
python -m venv venv
```

#### Windows

```bash
venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Create a PostgreSQL database, then copy `.env.example` to `.env` and fill in your values:

- `SECRET_KEY`
- `DEBUG`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`

Apply the database migrations:

```bash
python manage.py migrate
```

Create an administrator account:

```bash
python manage.py createsuperuser
```

### Add Default Categories

Start the Django shell:

```bash
python manage.py shell
```

Then run:

```python
from finance.models import Category

for name in [
    'Food',
    'Travel',
    'Shopping',
    'Education',
    'Entertainment',
    'Miscellaneous'
]:
    Category.objects.get_or_create(name=name, user=None)
```

Exit the Django shell:

```python
exit()
```

Start the Django development server:

```bash
python manage.py runserver
```

---

### 3. Frontend Setup — React + Vite

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the application at:

```text
http://127.0.0.1:5500
```

---

## 🔐 Environment Variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY`, `DEBUG` | Django security settings |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | Local PostgreSQL settings |
| `DATABASE_URL` | PostgreSQL connection URL used on the server |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | Web addresses allowed to use the API |
| `FRONTEND_URL` | Used for buttons and links inside emails |
| `EMAIL_BACKEND`, `EMAIL_API_PROVIDER` | Email sending configuration |
| Provider API keys | Credentials required by the selected email provider |
| `PREMIUM_DEMO_UPGRADE` | Demo upgrade button; keep `False` in production |
| `VITE_API_URL` | Frontend API address, ending in `/api` |

See `backend/.env.example` for the complete list of environment variables.

> ⚠️ **Never commit your real `.env` file to GitHub.**

---

## ✅ Running the Tests

### Backend Tests

The backend currently contains 78 tests.

```bash
cd backend
python manage.py test --settings=config.test_settings
```

### Frontend Tests

```bash
cd frontend
npm test
```

Tests also run automatically through GitHub Actions on every push.

---

## 🚀 Deployment

### Backend and Database

The backend and PostgreSQL database are deployed using Render.

The backend uses:

- Gunicorn
- WhiteNoise
- PostgreSQL
- Environment variables for configuration

### Frontend

The React frontend is deployed using Vercel.

The frontend uses:

```text
VITE_API_URL
```

to connect to the deployed API.

### Security

BudgetBuddy includes:

- HTTPS
- Secure cookies
- CORS restricted to the frontend address
- Login rate limiting
- JWT authentication
- Server-enforced Premium plan limits

---

## ⚠️ Known Limitations

- On the free hosting plan, uploaded profile photos and saved reports are lost when the server restarts.
- The free database has a limited lifetime and should be backed up.
- Email notifications depend on the limits of the selected free email service.
- Premium plans are changed by an administrator.
- A payment provider would be required for real Premium plan upgrades.

---

## 📌 Development Milestones

| Milestone | Status |
|---|---|
| Milestone 1 – Setup, database and authentication | ✅ Completed |
| Milestone 2 – Expenses, income, budgets and dashboard | ✅ Completed |
| Milestone 3 – Goals, notifications, reports and profile | ✅ Completed |
| Milestone 4 – Analytics, testing and deployment | ✅ Completed |

---

## 🔭 Future Work

- Push notifications and scheduled reminder emails
- OAuth2 login with Google or GitHub
- Cloud storage for profile photos and reports
- Payment integration for Premium plans

---

## 🎯 Project Objective

To develop an intelligent and user-friendly budget management platform that simplifies personal financial tracking and helps users make better financial decisions.

---

## 👩‍💻 Developer

**Anamika M T**

GitHub: [Anamikamt3](https://github.com/Anamikamt3)

---

