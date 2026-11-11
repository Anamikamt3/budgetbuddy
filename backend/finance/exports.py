import csv

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .models import Expense, Income
from .premium import IsPremium
from .utils import month_bounds


class TransactionsCsvView(APIView):
    """Premium: download every income and expense as a CSV file.
    ?month=2026-10 limits it to one month (optional)."""
    permission_classes = [IsAuthenticated, IsPremium]

    def get(self, request):
        user = request.user
        expenses = Expense.objects.filter(user=user).select_related('category')
        incomes = Income.objects.filter(user=user)

        month = request.query_params.get('month')
        if month:
            start, end = month_bounds(month)
            expenses = expenses.filter(date__gte=start, date__lt=end)
            incomes = incomes.filter(date__gte=start, date__lt=end)

        rows = [
            (e.date, 'Expense', e.category.name if e.category else 'Uncategorised',
             e.description, f'-{e.amount}')
            for e in expenses
        ] + [
            (i.date, 'Income', i.get_source_display(), i.description, f'{i.amount}')
            for i in incomes
        ]
        rows.sort(key=lambda row: row[0], reverse=True)

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="BudgetBuddy_Transactions.csv"'
        response.write('\ufeff')                    # lets Excel read the file as UTF-8
        writer = csv.writer(response)
        writer.writerow(['Date', 'Type', 'Category or source', 'Note', 'Amount'])
        for date_value, kind, label, note, amount in rows:
            writer.writerow([date_value.isoformat(), kind, label, note, amount])
        return response