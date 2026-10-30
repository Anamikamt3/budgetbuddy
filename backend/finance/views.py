from django.db.models import Q, Sum
from rest_framework import generics, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Income, Expense, Budget
from .serializers import (
    CategorySerializer, IncomeSerializer, ExpenseSerializer, BudgetSerializer,
)
from .utils import month_bounds


class CategoryListCreateView(generics.ListCreateAPIView):
    """List default + own categories. Users can add their own."""
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(
            Q(user=None) | Q(user=self.request.user)
        ).order_by('name')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class OwnedViewSet(viewsets.ModelViewSet):
    """Base class: users only ever see and change their OWN rows.
    Supports ?month=2026-10 to filter by month."""
    month_field = 'date'

    def get_queryset(self):
        queryset = super().get_queryset().filter(user=self.request.user)
        month = self.request.query_params.get('month')
        if month:
            start, end = month_bounds(month)
            queryset = queryset.filter(**{
                f'{self.month_field}__gte': start,
                f'{self.month_field}__lt': end,
            })
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ExpenseViewSet(OwnedViewSet):
    queryset = Expense.objects.select_related('category').order_by('-date', '-id')
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category and category.isdigit():
            queryset = queryset.filter(category_id=category)
        return queryset


class IncomeViewSet(OwnedViewSet):
    queryset = Income.objects.order_by('-date', '-id')
    serializer_class = IncomeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        source = self.request.query_params.get('source')
        if source:
            queryset = queryset.filter(source=source)
        return queryset


class BudgetViewSet(OwnedViewSet):
    queryset = Budget.objects.select_related('category').order_by('category_id', 'id')
    serializer_class = BudgetSerializer
    month_field = 'month'

    def create(self, request, *args, **kwargs):
        """Setting a budget twice for the same month and category
        updates the first one instead of making a duplicate."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        budget, created = Budget.objects.update_or_create(
            user=request.user,
            category=data.get('category'),
            month=data['month'],
            defaults={'amount': data['amount']},
        )
        output = self.get_serializer(budget)
        return Response(
            output.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SummaryView(APIView):
    """One call that gives the dashboard everything it needs for a month."""

    def get(self, request):
        user = request.user
        start, end = month_bounds(request.query_params.get('month'))

        incomes = Income.objects.filter(user=user, date__gte=start, date__lt=end)
        expenses = Expense.objects.filter(user=user, date__gte=start, date__lt=end)

        income_total = float(incomes.aggregate(t=Sum('amount'))['t'] or 0)
        expense_total = float(expenses.aggregate(t=Sum('amount'))['t'] or 0)

        by_category = [
            {
                'category': row['category__name'] or 'Uncategorised',
                'total': float(row['total']),
            }
            for row in expenses.values('category__name')
                               .annotate(total=Sum('amount'))
                               .order_by('-total')
        ]

        budget = None
        overall = Budget.objects.filter(user=user, category=None, month=start).first()
        if overall:
            limit = float(overall.amount)
            budget = {
                'amount': limit,
                'spent': expense_total,
                'percent': round(expense_total / limit * 100, 1) if limit else 0,
            }

        # Latest transactions: mix incomes and expenses, newest first
        items = []
        for e in expenses.select_related('category').order_by('-date', '-created_at')[:8]:
            items.append((e.date, e.created_at, {
                'type': 'expense', 'id': e.id,
                'title': e.category.name if e.category else 'Expense',
                'description': e.description, 'amount': float(e.amount),
                'date': e.date.isoformat(),
            }))
        for i in incomes.order_by('-date', '-created_at')[:8]:
            items.append((i.date, i.created_at, {
                'type': 'income', 'id': i.id,
                'title': i.get_source_display(),
                'description': i.description, 'amount': float(i.amount),
                'date': i.date.isoformat(),
            }))
        items.sort(key=lambda item: (item[0], item[1]), reverse=True)

        return Response({
            'month': start.strftime('%Y-%m'),
            'income_total': income_total,
            'expense_total': expense_total,
            'balance': round(income_total - expense_total, 2),
            'by_category': by_category,
            'budget': budget,
            'recent': [item[2] for item in items[:8]],
        })

class TransactionListView(APIView):
    def get(self, request):
        user = request.user
        kind = request.query_params.get('type', 'all')
        month = request.query_params.get('month')

        incomes = Income.objects.filter(user=user)
        expenses = Expense.objects.filter(user=user).select_related('category')
        if month:
            start, end = month_bounds(month)
            incomes = incomes.filter(date__gte=start, date__lt=end)
            expenses = expenses.filter(date__gte=start, date__lt=end)

        # Totals always cover the whole month, whatever "type" is chosen
        income_total = float(incomes.aggregate(t=Sum('amount'))['t'] or 0)
        expense_total = float(expenses.aggregate(t=Sum('amount'))['t'] or 0)

        items = []
        if kind in ('all', 'expense'):
            for e in expenses:
                items.append((e.date, e.created_at, {
                    'type': 'expense', 'id': e.id,
                    'title': e.category.name if e.category else 'Expense',
                    'description': e.description, 'amount': float(e.amount),
                    'date': e.date.isoformat(),
                }))
        if kind in ('all', 'income'):
            for i in incomes:
                items.append((i.date, i.created_at, {
                    'type': 'income', 'id': i.id,
                    'title': i.get_source_display(),
                    'description': i.description, 'amount': float(i.amount),
                    'date': i.date.isoformat(),
                }))
        items.sort(key=lambda item: (item[0], item[1]), reverse=True)

        return Response({
            'count': len(items),
            'income_total': income_total,
            'expense_total': expense_total,
            'results': [item[2] for item in items[:500]],    # safety limit
        })