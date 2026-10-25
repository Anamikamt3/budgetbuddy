# BudgetBuddy – Personal Budget Planning and Expense Management Platform

BudgetBuddy is a web application that helps students plan their budgets and track their daily expenses in one place. It is being built step by step as part of the Infosys Internship Program.

## Tech Stack

| Layer           | Technology            |
|-----------------|-----------------------|
| Frontend        | HTML, CSS, JavaScript |
| Backend         | Python, Django        |
| Database        | PostgreSQL            |
| Authentication  | JWT (JSON Web Tokens) |
| Version Control | Git and GitHub        |

## Features

Completed so far:

- Django and PostgreSQL project setup
- Database schema design
- JWT-based user authentication (register and login)
- Frontend pages: login, register and dashboard

Planned (following the 8-week project plan):

- Expense tracking
- Budget planning
- Reports and summaries

## Project Structure

```
BudgetBuddy-AI-Tool/
├── README.md
├── .gitignore
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env                 # local only, never committed
│   ├── venv/                # virtual environment, never committed
│   ├── config/              # Django project settings and main URLs
│   ├── accounts/            # user registration, login and JWT authentication
│   └── finance/             # budget and expense features
└── frontend/
    ├── index.html           # login page
    ├── register.html        # registration page
    ├── dashboard.html       # user dashboard
    ├── css/
    │   └── style.css
    └── js/
        ├── api.js           # shared API request helpers
        ├── login.js
        ├── register.js
        └── dashboard.js
```

## Getting Started

### Prerequisites

- Python 3.10 or newer
- PostgreSQL (with pgAdmin, optional)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/springboardmentor184-png/BudgetBuddy-AI-Tool.git
cd BudgetBuddy-AI-Tool
git checkout your-name-budgetbuddy
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Create the database

Create a PostgreSQL database (for example `budget_buddy`) using pgAdmin or `psql`.

### 4. Configure environment variables

Create a `.env` file inside `backend/` (this file is never committed):

```
SECRET_KEY=your-django-secret-key
DEBUG=True
DB_NAME=budget_buddy
DB_USER=your-postgres-user
DB_PASSWORD=your-postgres-password
DB_HOST=localhost
DB_PORT=5432
```

### 5. Run migrations and start the server

```bash
python manage.py migrate
python manage.py runserver
```

The backend will run at http://127.0.0.1:8000/

### 6. Run the frontend

Open `frontend/index.html` in your browser, or serve the `frontend` folder with a simple server such as the VS Code Live Server extension.

## Git Workflow

- Work only on your own branch (`your-name-budgetbuddy`), never directly on `main`.
- Commit regularly with meaningful messages.
- Push with `git push` after the first `git push -u origin your-name-budgetbuddy`.
- Never commit `.env`, `venv`, `node_modules`, passwords, API keys or tokens.

