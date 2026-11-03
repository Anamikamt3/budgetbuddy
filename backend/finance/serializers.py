from datetime import date

from django.db.models import Q
from rest_framework import serializers

from .models import Budget, Category, Expense, Income, Notification, SavingsGoal
from .utils import month_bounds, total_spent


class CategorySerializer(serializers.ModelSerializer):
    is_default = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'is_default']

    def get_is_default(self, obj):
        return obj.user_id is None

    def validate_name(self, value):
        value = value.strip()
        user = self.context['request'].user
        already = Category.objects.filter(name__iexact=value).filter(
            Q(user=None) | Q(user=user)
        ).exists()
        if already:
            raise serializers.ValidationError('You already have a category with this name.')
        return value


class OwnCategoryMixin:
    """Stops a user from using another user's custom category."""

    def validate_category(self, category):
        user = self.context['request'].user
        if category is not None and category.user_id not in (None, user.id):
            raise serializers.ValidationError('Choose one of your own categories.')
        return category


class ExpenseSerializer(OwnCategoryMixin, serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Expense
        fields = ['id', 'category', 'category_name', 'amount', 'date', 'description']
        extra_kwargs = {'category': {'required': True, 'allow_null': False}}

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than 0.')
        return value


class IncomeSerializer(serializers.ModelSerializer):
    source_label = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = Income
        fields = ['id', 'source', 'source_label', 'amount', 'date', 'description']

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than 0.')
        return value


class BudgetSerializer(OwnCategoryMixin, serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    spent = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = ['id', 'category', 'category_name', 'month', 'amount', 'spent']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else 'Overall'

    def get_spent(self, obj):
        start, end = month_bounds(obj.month.strftime('%Y-%m'))
        return total_spent(obj.user, start, end, obj.category_id)

    def validate_month(self, value):
        return value.replace(day=1)      # always store the 1st of the month

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than 0.')
        return value


class SavingsGoalSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = SavingsGoal
        fields = ['id', 'name', 'target_amount', 'saved_amount', 'deadline',
                  'is_completed', 'progress', 'remaining', 'days_left', 'created_at']
        read_only_fields = ['is_completed', 'created_at']

    def get_progress(self, obj):
        target = float(obj.target_amount)
        return min(round(float(obj.saved_amount) / target * 100, 1), 100) if target else 0

    def get_remaining(self, obj):
        return max(float(obj.target_amount) - float(obj.saved_amount), 0)

    def get_days_left(self, obj):
        return (obj.deadline - date.today()).days if obj.deadline else None

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Give your goal a name.')
        return value

    def validate_target_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Target must be greater than 0.')
        return value

    def validate_saved_amount(self, value):
        if value < 0:
            raise serializers.ValidationError('Saved amount cannot be negative.')
        return value

    def validate_deadline(self, value):
        # only check new goals, so old goals can still be edited after their date
        if value and self.instance is None and value < date.today():
            raise serializers.ValidationError('The deadline cannot be in the past.')
        return value


class NotificationSerializer(serializers.ModelSerializer):
    type_label = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = ['id', 'type', 'type_label', 'message', 'is_read', 'created_at']