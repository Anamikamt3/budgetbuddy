from django.conf import settings
from django.db import models

User = settings.AUTH_USER_MODEL


class Category(models.Model):
    name = models.CharField(max_length=50)
    # user=None means a default category shared by everyone
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)

    class Meta:
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Income(models.Model):
    class Source(models.TextChoices):
        POCKET_MONEY = 'pocket_money', 'Pocket Money'
        SCHOLARSHIP = 'scholarship', 'Scholarship'
        FREELANCE = 'freelance', 'Freelance'
        OTHER = 'other', 'Other'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incomes')
    source = models.CharField(max_length=20, choices=Source.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.source}: {self.amount}'


class Expense(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    description = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.category}: {self.amount}'


class Budget(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='budgets')
    # category=None means the overall monthly budget
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.CASCADE)
    month = models.DateField(help_text='Use the 1st of the month, e.g. 2026-10-01')
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('user', 'category', 'month')

    def __str__(self):
        return f'{self.month:%b %Y}: {self.amount}'


class SavingsGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='goals')
    name = models.CharField(max_length=100)            # e.g. "New Laptop Fund"
    target_amount = models.DecimalField(max_digits=10, decimal_places=2)
    saved_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deadline = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Notification(models.Model):
    class Type(models.TextChoices):
        BUDGET_ALERT = 'budget_alert', 'Budget Alert'
        SAVINGS_REMINDER = 'savings_reminder', 'Savings Reminder'
        GOAL_MILESTONE = 'goal_milestone', 'Goal Milestone'
        MONTHLY_REPORT = 'monthly_report', 'Monthly Report'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=Type.choices)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.message


class Report(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports')
    month = models.DateField()
    file = models.FileField(upload_to='reports/', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Report {self.month:%b %Y}'