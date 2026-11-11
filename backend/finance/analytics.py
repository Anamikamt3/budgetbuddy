from datetime import date, timedelta

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Budget, Expense, Income
from .utils import month_bounds

from .premium import limits_for

WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def add_months(first_day, count):
    """first_day is the 1st of a month. count can be negative.
    add_months(date(2026, 1, 1), -2) -> date(2025, 11, 1)"""
    index = first_day.year * 12 + (first_day.month - 1) + count
    return date(index // 12, index % 12 + 1, 1)


def money(value):
    return float(value or 0)


class AnalyticsView(APIView):
    """Everything the Analytics page needs in ONE request.

    ?month=2026-10   the month to analyse (default: this month)
    ?months=6        how many months the trend chart covers (2 to 24, default 6)
    """

    def get(self, request):
        user = request.user
        start, end = month_bounds(request.query_params.get('month'))

        try:
            span = int(request.query_params.get('months', 6))
        except ValueError:
            span = 6
        span = max(2, min(span, limits_for(user)['trend_months']))
        
        incomes = Income.objects.filter(user=user)
        expenses = Expense.objects.filter(user=user)

        # ---------- 1. Monthly trend (income, expenses, net) ----------
        first = add_months(start, -(span - 1))

        def totals_by_month(queryset):
            rows = (queryset.filter(date__gte=first, date__lt=end)
                    .annotate(m=TruncMonth('date'))
                    .values('m')
                    .annotate(total=Sum('amount'))
                    .order_by('m'))
            return {row['m'].strftime('%Y-%m'): money(row['total']) for row in rows}

        income_by_month = totals_by_month(incomes)
        expense_by_month = totals_by_month(expenses)

        trend = []
        for i in range(span):
            key = add_months(first, i).strftime('%Y-%m')
            inc = income_by_month.get(key, 0)
            exp = expense_by_month.get(key, 0)
            trend.append({'month': key, 'income': inc, 'expense': exp,
                          'net': round(inc - exp, 2)})

        # ---------- 2. The chosen month ----------
        month_expenses = expenses.filter(date__gte=start, date__lt=end)
        month_incomes = incomes.filter(date__gte=start, date__lt=end)

        income_total = money(month_incomes.aggregate(t=Sum('amount'))['t'])
        expense_total = money(month_expenses.aggregate(t=Sum('amount'))['t'])

        # spending by category
        category_rows = (month_expenses.values('category_id', 'category__name')
                         .annotate(total=Sum('amount')).order_by('-total'))
        categories = []
        spent_by_category_id = {}
        for row in category_rows:
            total = money(row['total'])
            spent_by_category_id[row['category_id']] = total
            categories.append({
                'category': row['category__name'] or 'Uncategorised',
                'total': total,
                'percent': round(total / expense_total * 100, 1) if expense_total else 0,
            })

        # income by source
        labels = dict(Income.Source.choices)
        income_sources = [
            {'source': labels.get(row['source'], row['source']), 'total': money(row['total'])}
            for row in month_incomes.values('source')
                                    .annotate(total=Sum('amount')).order_by('-total')
        ]

        # spending per day (a continuous list, days with no spending are 0)
        per_day = {row['date']: money(row['total'])
                   for row in month_expenses.values('date')
                                            .annotate(total=Sum('amount')).order_by('date')}
        last_day = min(end - timedelta(days=1), date.today())
        daily = []
        day = start
        while day <= last_day:
            daily.append({'date': day.isoformat(), 'total': per_day.get(day, 0)})
            day += timedelta(days=1)

        # spending by day of the week
        weekday_totals = [0.0] * 7
        for day_value, total in per_day.items():
            weekday_totals[day_value.weekday()] += total
        weekdays = [{'day': WEEKDAYS[i], 'total': round(weekday_totals[i], 2)}
                    for i in range(7)]

        # ---------- 3. Budgets versus what was really spent ----------
        budget_rows = []
        budgets = Budget.objects.filter(user=user, month=start).select_related('category')
        for b in budgets:
            limit = money(b.amount)
            spent = expense_total if b.category_id is None \
                else spent_by_category_id.get(b.category_id, 0)
            budget_rows.append({
                'name': 'Overall' if b.category_id is None else b.category.name,
                'budget': limit,
                'spent': spent,
                'percent': round(spent / limit * 100, 1) if limit else 0,
            })
        budget_rows.sort(key=lambda row: (row['name'] != 'Overall', -row['percent']))

        # ---------- 4. Biggest expenses ----------
        top_expenses = [
            {
                'id': e.id,
                'title': e.category.name if e.category else 'Expense',
                'description': e.description,
                'amount': money(e.amount),
                'date': e.date.isoformat(),
            }
            for e in month_expenses.select_related('category').order_by('-amount')[:5]
        ]

        # ---------- 5. Insights ----------
        previous_total = money(
            expenses.filter(date__gte=add_months(start, -1), date__lt=start)
                    .aggregate(t=Sum('amount'))['t']
        )
        biggest_day = max(daily, key=lambda d: d['total']) if daily else None
        insights = {
            'savings_rate': round((income_total - expense_total) / income_total * 100, 1)
                            if income_total else None,
            'avg_daily_spend': round(expense_total / max(len(daily), 1), 2),
            'vs_last_month': round((expense_total - previous_total) / previous_total * 100, 1)
                             if previous_total else None,
            'top_category': categories[0] if categories else None,
            'biggest_day': biggest_day if biggest_day and biggest_day['total'] > 0 else None,
        }

        return Response({
            'month': start.strftime('%Y-%m'),
            'income_total': income_total,
            'expense_total': expense_total,
            'balance': round(income_total - expense_total, 2),
            'trend': trend,
            'categories': categories,
            'income_sources': income_sources,
            'daily': daily,
            'weekdays': weekdays,
            'budgets': budget_rows,
            'top_expenses': top_expenses,
            'insights': insights,
        })