from decimal import Decimal, InvalidOperation
from .emails import send_test_email
from django.db.models import Q, Sum
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Budget, Category, Expense, Income, Notification, SavingsGoal
from .notifications import check_budget_alerts, run_reminders, sync_goal
from .serializers import (
    BudgetSerializer, CategorySerializer, ExpenseSerializer, IncomeSerializer,
    NotificationSerializer, SavingsGoalSerializer,
)
from .utils import month_bounds

from rest_framework.exceptions import PermissionDenied

from .premium import limits_for


class CategoryListCreateView(generics.ListCreateAPIView):
    """List default + own categories. Users can add their own."""
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(
            Q(user=None) | Q(user=self.request.user)
        ).order_by('name')

    def perform_create(self, serializer):
        limit = limits_for(self.request.user)['custom_categories']
        if limit is not None and Category.objects.filter(user=self.request.user).count() >= limit:
            raise PermissionDenied(
                f'The Free plan allows {limit} custom categories. '
                'Upgrade to Premium for unlimited categories.')
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

    def perform_create(self, serializer):
        expense = serializer.save(user=self.request.user)
        check_budget_alerts(self.request.user, expense.date)      # budget alerts

    def perform_update(self, serializer):
        expense = serializer.save()
        check_budget_alerts(self.request.user, expense.date)


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
        check_budget_alerts(request.user, budget.month)           # budget alerts
        output = self.get_serializer(budget)
        return Response(
            output.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SavingsGoalViewSet(OwnedViewSet):
    queryset = SavingsGoal.objects.order_by('is_completed', 'deadline', '-id')
    serializer_class = SavingsGoalSerializer

    def perform_create(self, serializer):
        limit = limits_for(self.request.user)['goals']
        active = SavingsGoal.objects.filter(user=self.request.user, is_completed=False).count()
        if limit is not None and active >= limit:
            raise PermissionDenied(
                f'The Free plan allows {limit} active savings goals. '
                'Upgrade to Premium for unlimited goals.')
        goal = serializer.save(user=self.request.user)
        sync_goal(goal)

    def perform_update(self, serializer):
        goal = serializer.save()
        sync_goal(goal)

    @action(detail=True, methods=['post'])
    def contribute(self, request, pk=None):
        """Add money to a goal (positive amount) or take money out (negative)."""
        goal = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount')))
        except InvalidOperation:
            amount = None
        if amount is None or not amount.is_finite() or amount == 0:
            return Response({'amount': ['Enter an amount other than 0.']},
                            status=status.HTTP_400_BAD_REQUEST)

        new_total = goal.saved_amount + amount
        if new_total < 0:
            return Response({'amount': ['You cannot take out more than you have saved.']},
                            status=status.HTTP_400_BAD_REQUEST)

        goal.saved_amount = new_total
        goal.save(update_fields=['saved_amount'])
        sync_goal(goal)
        return Response(self.get_serializer(goal).data)


class NotificationViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin,
                          viewsets.GenericViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at', '-id')

    def list(self, request, *args, **kwargs):
        run_reminders(request.user)          # create any reminders that are due today
        serializer = self.get_serializer(self.get_queryset()[:50], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['post'], url_path='read-all')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'updated': updated})

    @action(detail=False, methods=['post'], url_path='test-email')
    def test_email(self, request):
        """Sends a test email to the logged-in user (used by the Profile page)."""
        if not request.user.email:
            return Response({'detail': 'Add an email address to your profile first.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            send_test_email(request.user)
        except Exception as error:
            return Response({'detail': f'The email could not be sent: {error}'},
                            status=status.HTTP_502_BAD_GATEWAY)
        return Response({'detail': f'A test email was sent to {request.user.email}.'})


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
    """Income and expenses mixed into ONE list, newest first.
    Options:  ?month=2026-10   ?type=all | expense | income"""

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