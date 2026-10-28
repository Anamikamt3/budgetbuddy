from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BudgetViewSet, CategoryListCreateView, ExpenseViewSet,
    IncomeViewSet, SummaryView,
)

router = DefaultRouter()
router.register('expenses', ExpenseViewSet, basename='expense')
router.register('incomes', IncomeViewSet, basename='income')
router.register('budgets', BudgetViewSet, basename='budget')

urlpatterns = [
    path('categories/', CategoryListCreateView.as_view()),
    path('summary/', SummaryView.as_view()),
    path('', include(router.urls)),
]