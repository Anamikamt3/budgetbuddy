from datetime import date

from .analytics import add_months
from .models import Budget, Expense, Income, Notification, SavingsGoal
from .utils import month_bounds, total_spent
from .emails import send_notification_email

MILESTONES = (25, 50, 75, 100)     # goal progress that triggers a message
REMINDER_DAYS = (3, 7, 14)         # "due within N days" reminders


def create_once(user, kind, message):
    """Create a notification unless the same message already exists.
    This stops the same alert from appearing again and again."""
    if Notification.objects.filter(user=user, type=kind, message=message).exists():
        return None
    notification = Notification.objects.create(user=user, type=kind, message=message)
    send_notification_email(notification)       # also email the user
    return notification


def check_budget_alerts(user, any_date):
    """Call this after an expense or a budget is saved.
    Creates an alert at 80 percent used and another when the budget is exceeded."""
    start, end = month_bounds(any_date.strftime('%Y-%m'))
    label = start.strftime('%B %Y')

    for budget in Budget.objects.filter(user=user, month=start).select_related('category'):
        limit = float(budget.amount)
        if limit <= 0:
            continue

        # category_id None means the overall budget, so it adds up all spending
        spent = total_spent(user, start, end, budget.category_id)
        percent = spent / limit * 100
        name = 'overall' if budget.category_id is None else budget.category.name

        if percent >= 100:
            message = f'You have gone over your {name} budget for {label}.'
        elif percent >= 80:
            message = f'You have used 80% of your {name} budget for {label}.'
        else:
            continue
        create_once(user, Notification.Type.BUDGET_ALERT, message)


def sync_goal(goal):
    """Call this after a savings goal changes.
    Updates is_completed and creates a message at 25, 50, 75 and 100 percent."""
    target = goal.target_amount
    percent = float(goal.saved_amount / target * 100) if target else 0
    completed = goal.saved_amount >= target

    if goal.is_completed != completed:
        goal.is_completed = completed
        goal.save(update_fields=['is_completed'])

    reached = [m for m in MILESTONES if percent >= m]
    if reached:
        top = reached[-1]
        if top == 100:
            message = f'Congratulations! You completed your "{goal.name}" goal.'
        else:
            message = f'Your "{goal.name}" goal is {top}% funded.'
        create_once(goal.user, Notification.Type.GOAL_MILESTONE, message)


def run_reminders(user):
    """Create reminders that are due today. It runs every time the user opens
    their notifications, so no background scheduler is needed."""
    today = date.today()

    # 1. Savings goals with a deadline that is close (or already passed)
    goals = SavingsGoal.objects.filter(user=user, is_completed=False, deadline__isnull=False)
    for goal in goals:
        days_left = (goal.deadline - today).days
        if days_left < 0:
            message = f'The deadline for "{goal.name}" has passed. Update the date or keep saving.'
        else:
            bucket = next((d for d in REMINDER_DAYS if days_left <= d), None)
            if bucket is None:
                continue
            message = f'Reminder: "{goal.name}" is due within {bucket} days.'
        create_once(user, Notification.Type.SAVINGS_REMINDER, message)

    # 2. A new month started: tell the user that last month's report is ready
    this_month, _ = month_bounds(None)
    last_month = add_months(this_month, -1)
    had_activity = (
        Expense.objects.filter(user=user, date__gte=last_month, date__lt=this_month).exists()
        or Income.objects.filter(user=user, date__gte=last_month, date__lt=this_month).exists()
    )
    if had_activity:
        message = (f'Your {last_month.strftime("%B %Y")} report is ready. '
                   'Download it from the Reports page.')
        create_once(user, Notification.Type.MONTHLY_REPORT, message)