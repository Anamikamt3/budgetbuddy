
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .analytics import AnalyticsView
from .exports import TransactionsCsvView
from .premium import PlanView
from .reports import MonthlyReportView
from .views import (
    BudgetViewSet, CategoryListCreateView, ExpenseViewSet, IncomeViewSet,
    NotificationViewSet, SavingsGoalViewSet, SummaryView, TransactionListView,
)

router = DefaultRouter()
router.register('expenses', ExpenseViewSet, basename='expense')
router.register('incomes', IncomeViewSet, basename='income')
router.register('budgets', BudgetViewSet, basename='budget')
router.register('goals', SavingsGoalViewSet, basename='goal')
router.register('notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view()),
    path('summary/', SummaryView.as_view()),
    path('transactions/', TransactionListView.as_view()),
    path('analytics/', AnalyticsView.as_view()),
    path('reports/monthly/', MonthlyReportView.as_view()),
    path('plan/', PlanView.as_view()),
    path('export/transactions/', TransactionsCsvView.as_view()),
    path('', include(router.urls)),
]