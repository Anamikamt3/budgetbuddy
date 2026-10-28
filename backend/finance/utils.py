from datetime import date

from django.db.models import Sum

from .models import Expense


def month_bounds(value=None):
    """Turn '2026-10' into (2026-10-01, 2026-11-01).
    If the value is missing or wrong, use the current month."""
    try:
        year, month = (int(part) for part in value.split('-'))
        start = date(year, month, 1)
    except (AttributeError, ValueError):
        start = date.today().replace(day=1)

    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)
    return start, end


def total_spent(user, start, end, category_id=None):
    """Add up a user's expenses between two dates (optionally one category)."""
    expenses = Expense.objects.filter(user=user, date__gte=start, date__lt=end)
    if category_id:
        expenses = expenses.filter(category_id=category_id)
    return float(expenses.aggregate(total=Sum('amount'))['total'] or 0)