from django.core.files.base import ContentFile
from django.db.models import Sum
from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Budget, Expense, Income, Report
from .premium import require_premium
from .report_builders import build_pdf, build_xlsx
from .utils import month_bounds
def collect_report_data(user, start, end):
    """Gather everything the report needs into one plain dictionary."""
    expenses = Expense.objects.filter(user=user, date__gte=start, date__lt=end)
    incomes = Income.objects.filter(user=user, date__gte=start, date__lt=end)

    income_total = float(incomes.aggregate(t=Sum('amount'))['t'] or 0)
    expense_total = float(expenses.aggregate(t=Sum('amount'))['t'] or 0)

    category_rows = (expenses.values('category_id', 'category__name')
                     .annotate(total=Sum('amount')).order_by('-total'))
    categories, spent_by_id = [], {}
    for row in category_rows:
        total = float(row['total'])
        spent_by_id[row['category_id']] = total
        categories.append({
            'category': row['category__name'] or 'Uncategorised',
            'total': total,
            'percent': round(total / expense_total * 100, 1) if expense_total else 0,
        })

    labels = dict(Income.Source.choices)
    income_sources = [
        {'source': labels.get(row['source'], row['source']), 'total': float(row['total'])}
        for row in incomes.values('source').annotate(total=Sum('amount')).order_by('-total')
    ]

    budgets = []
    for b in Budget.objects.filter(user=user, month=start).select_related('category'):
        limit = float(b.amount)
        spent = expense_total if b.category_id is None else spent_by_id.get(b.category_id, 0)
        budgets.append({
            'name': 'Overall' if b.category_id is None else b.category.name,
            'budget': limit,
            'spent': spent,
            'percent': round(spent / limit * 100, 1) if limit else 0,
        })

    profile = getattr(user, 'profile', None)
    return {
        'username': user.username,
        'currency': profile.currency if profile else 'INR',
        'month_label': start.strftime('%B %Y'),
        'income_total': income_total,
        'expense_total': expense_total,
        'balance': round(income_total - expense_total, 2),
        'savings_rate': round((income_total - expense_total) / income_total * 100, 1)
                        if income_total else None,
        'categories': categories,
        'income_sources': income_sources,
        'budgets': budgets,
        'expenses': [
            {'date': e.date.isoformat(),
             'category': e.category.name if e.category else 'Uncategorised',
             'description': e.description, 'amount': float(e.amount)}
            for e in expenses.select_related('category').order_by('date', 'id')[:1000]
        ],
        'incomes': [
            {'date': i.date.isoformat(), 'source': i.get_source_display(),
             'description': i.description, 'amount': float(i.amount)}
            for i in incomes.order_by('date', 'id')[:1000]
        ],
    }


class MonthlyReportView(APIView):
    """Download a monthly report.
    ?month=2026-10     the month (default: this month)
    ?file=pdf | xlsx   the file type (default: pdf). Excel is a Premium feature.

    Every download is also saved in the Report table (with a copy of the file)."""

    def get(self, request):
        start, end = month_bounds(request.query_params.get('month'))

        # 1. Work out which file type was asked for (this line must come FIRST)
        kind = request.query_params.get('file', 'pdf')
        if kind not in ('pdf', 'xlsx'):
            return Response({'file': ['Use file=pdf or file=xlsx.']}, status=400)

        # 2. Excel is only for Premium users
        if kind == 'xlsx':
            require_premium(request.user, 'Excel reports')

        # 3. Build the file
        data = collect_report_data(request.user, start, end)
        stem = f"BudgetBuddy_Report_{start.strftime('%Y-%m')}"

        if kind == 'xlsx':
            content = build_xlsx(data)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:
            content = build_pdf(data)
            content_type = 'application/pdf'

        # 4. Keep a record: one row in finance_report plus a copy of the file
        report = Report(user=request.user, month=start)
        report.file.save(f'{stem}.{kind}', ContentFile(content), save=True)

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{stem}.{kind}"'
        return response