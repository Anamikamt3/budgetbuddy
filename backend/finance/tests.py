import shutil
import tempfile
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import Profile, User
from .emails import build_email, send_notification_email
from .models import Budget, Category, Expense, Income, Notification, Report, SavingsGoal

PASSWORD = 'StrongPass123'
TEMP_MEDIA = tempfile.mkdtemp()           # report files made during tests go here


def tearDownModule():
    shutil.rmtree(TEMP_MEDIA, ignore_errors=True)


def make_user(username='anu', role='student', email=None):
    user = User.objects.create_user(
        username=username, email=email or f'{username}@example.com', password=PASSWORD)
    if role != 'student':
        user.role = role
        user.save(update_fields=['role'])
    return user


class BaseTest(APITestCase):
    """Two users, two default categories, and no real emails."""

    def setUp(self):
        patcher = patch('finance.notifications.send_notification_email')
        self.email_mock = patcher.start()
        self.addCleanup(patcher.stop)

        self.user = make_user('anu')
        self.other = make_user('ravi')
        self.client.force_authenticate(self.user)

        self.food = Category.objects.create(name='Food', user=None)
        self.travel = Category.objects.create(name='Travel', user=None)
        self.today = date.today()
        self.this_month = self.today.strftime('%Y-%m')

    def make_premium(self):
        self.user.role = 'premium'
        self.user.save(update_fields=['role'])
        self.client.force_authenticate(self.user)

    def add_expense(self, amount, category=None, when=None):
        return self.client.post('/api/finance/expenses/', {
            'category': (category or self.food).id,
            'amount': str(amount),
            'date': (when or self.today).isoformat(),
            'description': 'Test',
        }, format='json')


# ---------------------------------------------------------------- expenses
class ExpenseTests(BaseTest):
    def test_create_and_list(self):
        response = self.add_expense('250.00')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['category_name'], 'Food')
        self.assertEqual(len(self.client.get('/api/finance/expenses/').data), 1)

    def test_amount_must_be_positive(self):
        response = self.add_expense('0')
        self.assertEqual(response.status_code, 400)
        self.assertIn('amount', response.data)

    def test_login_is_required(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/finance/expenses/').status_code, 401)

    def test_users_only_see_their_own_expenses(self):
        Expense.objects.create(user=self.other, category=self.food, amount=Decimal('99'), date=self.today)
        self.assertEqual(len(self.client.get('/api/finance/expenses/').data), 0)

    def test_cannot_edit_someone_elses_expense(self):
        theirs = Expense.objects.create(user=self.other, category=self.food, amount=Decimal('99'), date=self.today)
        response = self.client.patch(f'/api/finance/expenses/{theirs.id}/', {'amount': '1.00'}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_cannot_delete_someone_elses_expense(self):
        theirs = Expense.objects.create(user=self.other, category=self.food, amount=Decimal('99'), date=self.today)
        self.assertEqual(self.client.delete(f'/api/finance/expenses/{theirs.id}/').status_code, 404)
        self.assertTrue(Expense.objects.filter(id=theirs.id).exists())

    def test_cannot_use_another_users_category(self):
        secret = Category.objects.create(name='Secret', user=self.other)
        response = self.add_expense('10', category=secret)
        self.assertEqual(response.status_code, 400)
        self.assertIn('category', response.data)

    def test_edit_and_delete_own_expense(self):
        expense_id = self.add_expense('100').data['id']
        edited = self.client.patch(f'/api/finance/expenses/{expense_id}/', {'amount': '120.00'}, format='json')
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(Expense.objects.get(id=expense_id).amount, Decimal('120.00'))
        self.assertEqual(self.client.delete(f'/api/finance/expenses/{expense_id}/').status_code, 204)

    def test_month_filter(self):
        self.add_expense('10', when=date(2026, 9, 15))
        self.add_expense('20', when=date(2026, 10, 5))
        response = self.client.get('/api/finance/expenses/?month=2026-10')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['date'], '2026-10-05')

    def test_category_filter(self):
        self.add_expense('10', category=self.food)
        self.add_expense('20', category=self.travel)
        response = self.client.get(f'/api/finance/expenses/?category={self.travel.id}')
        self.assertEqual(len(response.data), 1)


# ---------------------------------------------------------------- categories
class CategoryTests(BaseTest):
    def test_lists_default_and_own_but_not_others(self):
        Category.objects.create(name='Mine', user=self.user)
        Category.objects.create(name='Theirs', user=self.other)
        names = [c['name'] for c in self.client.get('/api/finance/categories/').data]
        self.assertIn('Food', names)
        self.assertIn('Mine', names)
        self.assertNotIn('Theirs', names)

    def test_duplicate_name_is_rejected(self):
        response = self.client.post('/api/finance/categories/', {'name': 'food'}, format='json')
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------- income
class IncomeTests(BaseTest):
    def test_create_and_filter_by_source(self):
        for source in ('pocket_money', 'freelance'):
            response = self.client.post('/api/finance/incomes/', {
                'source': source, 'amount': '500', 'date': self.today.isoformat(),
            }, format='json')
            self.assertEqual(response.status_code, 201)
        response = self.client.get('/api/finance/incomes/?source=freelance')
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['source_label'], 'Freelance')

    def test_amount_must_be_positive(self):
        response = self.client.post('/api/finance/incomes/', {
            'source': 'other', 'amount': '-5', 'date': self.today.isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------- budgets
class BudgetTests(BaseTest):
    def first_of_month(self):
        return self.today.replace(day=1).isoformat()

    def test_saving_a_budget_twice_updates_it(self):
        data = {'category': self.food.id, 'month': self.first_of_month(), 'amount': '1000'}
        first = self.client.post('/api/finance/budgets/', data, format='json')
        data['amount'] = '1500'
        second = self.client.post('/api/finance/budgets/', data, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Budget.objects.filter(user=self.user).count(), 1)
        self.assertEqual(Budget.objects.get(user=self.user).amount, Decimal('1500'))

    def test_overall_budget_has_no_category(self):
        response = self.client.post('/api/finance/budgets/', {
            'category': None, 'month': self.first_of_month(), 'amount': '5000',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['category_name'], 'Overall')

    def test_month_is_moved_to_the_first_day(self):
        middle = self.today.replace(day=15).isoformat()
        response = self.client.post('/api/finance/budgets/', {
            'category': self.food.id, 'month': middle, 'amount': '100',
        }, format='json')
        self.assertEqual(Budget.objects.get(user=self.user).month.day, 1)
        self.assertEqual(response.status_code, 201)

    def test_spent_is_calculated(self):
        Budget.objects.create(user=self.user, category=self.food,
                              month=self.today.replace(day=1), amount=Decimal('1000'))
        self.add_expense('300')
        response = self.client.get(f'/api/finance/budgets/?month={self.this_month}')
        self.assertEqual(response.data[0]['spent'], 300.0)


# ---------------------------------------------------------------- budget alerts
class BudgetAlertTests(BaseTest):
    def setUp(self):
        super().setUp()
        Budget.objects.create(user=self.user, category=self.food,
                              month=self.today.replace(day=1), amount=Decimal('1000'))

    def alerts(self):
        return Notification.objects.filter(user=self.user, type='budget_alert')

    def test_no_alert_below_80_percent(self):
        self.add_expense('700')
        self.assertEqual(self.alerts().count(), 0)

    def test_alert_at_80_percent_is_created_only_once(self):
        self.add_expense('850')
        self.assertEqual(self.alerts().count(), 1)
        self.assertIn('80%', self.alerts().first().message)
        self.add_expense('10')                       # still 80 percent or more
        self.assertEqual(self.alerts().count(), 1)

    def test_over_budget_alert(self):
        self.add_expense('850')
        self.add_expense('200')
        self.assertEqual(self.alerts().count(), 2)
        self.assertTrue(self.alerts().filter(message__contains='gone over').exists())

    def test_an_alert_also_triggers_an_email(self):
        self.add_expense('850')
        self.email_mock.assert_called_once()

    def test_other_categories_do_not_count(self):
        self.add_expense('900', category=self.travel)
        self.assertEqual(self.alerts().count(), 0)


# ---------------------------------------------------------------- savings goals
class GoalTests(BaseTest):
    def create_goal(self, **extra):
        data = {'name': 'New Laptop Fund', 'target_amount': '1000', 'saved_amount': '0'}
        data.update(extra)
        return self.client.post('/api/finance/goals/', data, format='json')

    def contribute(self, goal_id, amount):
        return self.client.post(f'/api/finance/goals/{goal_id}/contribute/', {'amount': str(amount)}, format='json')

    def test_create_goal(self):
        response = self.create_goal()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['progress'], 0)
        self.assertFalse(response.data['is_completed'])

    def test_target_must_be_positive(self):
        self.assertEqual(self.create_goal(target_amount='0').status_code, 400)

    def test_deadline_cannot_be_in_the_past(self):
        yesterday = (self.today - timedelta(days=1)).isoformat()
        self.assertEqual(self.create_goal(deadline=yesterday).status_code, 400)

    def test_adding_money_updates_progress_and_sends_a_milestone(self):
        goal_id = self.create_goal().data['id']
        response = self.contribute(goal_id, 500)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['progress'], 50.0)
        self.assertTrue(Notification.objects.filter(
            user=self.user, type='goal_milestone', message__contains='50%').exists())

    def test_reaching_the_target_completes_the_goal(self):
        goal_id = self.create_goal().data['id']
        response = self.contribute(goal_id, 1000)
        self.assertTrue(response.data['is_completed'])
        self.assertTrue(Notification.objects.filter(
            user=self.user, message__contains='completed').exists())

    def test_taking_money_out(self):
        goal_id = self.create_goal().data['id']
        self.contribute(goal_id, 500)
        response = self.contribute(goal_id, -200)
        self.assertEqual(response.data['saved_amount'], '300.00')

    def test_cannot_take_out_more_than_saved(self):
        goal_id = self.create_goal().data['id']
        self.assertEqual(self.contribute(goal_id, -10).status_code, 400)

    def test_zero_or_invalid_amounts_are_rejected(self):
        goal_id = self.create_goal().data['id']
        self.assertEqual(self.contribute(goal_id, 0).status_code, 400)
        self.assertEqual(self.contribute(goal_id, 'abc').status_code, 400)

    def test_cannot_touch_another_users_goal(self):
        theirs = SavingsGoal.objects.create(user=self.other, name='Theirs', target_amount=Decimal('100'))
        self.assertEqual(self.contribute(theirs.id, 10).status_code, 404)


# ---------------------------------------------------------------- free versus premium
class PremiumTests(BaseTest):
    def test_plan_endpoint_for_a_free_user(self):
        response = self.client.get('/api/finance/plan/')
        self.assertEqual(response.data['plan'], 'free')
        self.assertEqual(response.data['limits']['goals'], 3)

    def test_plan_endpoint_for_a_premium_user(self):
        self.make_premium()
        response = self.client.get('/api/finance/plan/')
        self.assertEqual(response.data['plan'], 'premium')
        self.assertIsNone(response.data['limits']['goals'])

    def test_free_users_are_limited_to_three_active_goals(self):
        for number in range(3):
            response = self.client.post('/api/finance/goals/', {
                'name': f'Goal {number}', 'target_amount': '100'}, format='json')
            self.assertEqual(response.status_code, 201)
        fourth = self.client.post('/api/finance/goals/', {'name': 'Fourth', 'target_amount': '100'}, format='json')
        self.assertEqual(fourth.status_code, 403)
        self.assertIn('Premium', fourth.data['detail'])

    def test_completed_goals_do_not_count_towards_the_limit(self):
        for number in range(3):
            SavingsGoal.objects.create(user=self.user, name=f'Done {number}',
                                       target_amount=Decimal('10'), saved_amount=Decimal('10'),
                                       is_completed=True)
        response = self.client.post('/api/finance/goals/', {'name': 'New', 'target_amount': '100'}, format='json')
        self.assertEqual(response.status_code, 201)

    def test_premium_users_have_no_goal_limit(self):
        self.make_premium()
        for number in range(5):
            response = self.client.post('/api/finance/goals/', {
                'name': f'Goal {number}', 'target_amount': '100'}, format='json')
            self.assertEqual(response.status_code, 201)

    def test_free_users_are_limited_to_five_custom_categories(self):
        for number in range(5):
            response = self.client.post('/api/finance/categories/', {'name': f'Custom {number}'}, format='json')
            self.assertEqual(response.status_code, 201)
        sixth = self.client.post('/api/finance/categories/', {'name': 'Custom 5'}, format='json')
        self.assertEqual(sixth.status_code, 403)

    def test_analytics_trend_is_three_months_for_free_users(self):
        response = self.client.get(f'/api/finance/analytics/?month={self.this_month}&months=12')
        self.assertEqual(len(response.data['trend']), 3)

    def test_analytics_trend_is_longer_for_premium_users(self):
        self.make_premium()
        response = self.client.get(f'/api/finance/analytics/?month={self.this_month}&months=12')
        self.assertEqual(len(response.data['trend']), 12)


# ---------------------------------------------------------------- reports and exports
@override_settings(MEDIA_ROOT=TEMP_MEDIA)
class ReportTests(BaseTest):
    def setUp(self):
        super().setUp()
        self.add_expense('300')
        Income.objects.create(user=self.user, source='pocket_money', amount=Decimal('8000'), date=self.today)

    def test_pdf_report_is_available_to_everyone(self):
        response = self.client.get(f'/api/finance/reports/monthly/?month={self.this_month}&file=pdf')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_downloading_a_report_is_recorded(self):
        self.client.get(f'/api/finance/reports/monthly/?month={self.this_month}&file=pdf')
        self.assertEqual(Report.objects.filter(user=self.user).count(), 1)

    def test_excel_report_is_premium_only(self):
        url = f'/api/finance/reports/monthly/?month={self.this_month}&file=xlsx'
        self.assertEqual(self.client.get(url).status_code, 403)
        self.make_premium()
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('spreadsheetml', response['Content-Type'])

    def test_unknown_file_type_is_rejected(self):
        self.assertEqual(self.client.get('/api/finance/reports/monthly/?file=doc').status_code, 400)

    def test_csv_export_is_premium_only(self):
        self.assertEqual(self.client.get('/api/finance/export/transactions/').status_code, 403)
        self.make_premium()
        response = self.client.get('/api/finance/export/transactions/')
        self.assertEqual(response.status_code, 200)
        text = response.content.decode('utf-8-sig')
        self.assertIn('Date,Type,Category or source,Note,Amount', text)
        self.assertIn('Pocket Money', text)


# ---------------------------------------------------------------- summary, transactions, analytics
class SummaryTests(BaseTest):
    def setUp(self):
        super().setUp()
        Income.objects.create(user=self.user, source='pocket_money', amount=Decimal('8000'), date=self.today)
        self.add_expense('300', category=self.food)
        self.add_expense('200', category=self.travel)
        Expense.objects.create(user=self.other, category=self.food, amount=Decimal('5000'), date=self.today)

    def test_summary_adds_up_only_my_data(self):
        response = self.client.get(f'/api/finance/summary/?month={self.this_month}')
        self.assertEqual(response.data['income_total'], 8000.0)
        self.assertEqual(response.data['expense_total'], 500.0)
        self.assertEqual(response.data['balance'], 7500.0)
        self.assertEqual(response.data['by_category'][0]['category'], 'Food')

    def test_summary_shows_the_overall_budget(self):
        Budget.objects.create(user=self.user, category=None, month=self.today.replace(day=1), amount=Decimal('1000'))
        response = self.client.get(f'/api/finance/summary/?month={self.this_month}')
        self.assertEqual(response.data['budget']['percent'], 50.0)

    def test_transactions_mix_income_and_expenses(self):
        response = self.client.get(f'/api/finance/transactions/?month={self.this_month}')
        self.assertEqual(response.data['count'], 3)
        only_income = self.client.get(f'/api/finance/transactions/?month={self.this_month}&type=income')
        self.assertEqual(only_income.data['count'], 1)

    def test_analytics_has_every_section(self):
        response = self.client.get(f'/api/finance/analytics/?month={self.this_month}')
        for key in ('trend', 'categories', 'income_sources', 'daily', 'weekdays',
                    'budgets', 'top_expenses', 'insights'):
            self.assertIn(key, response.data)
        self.assertEqual(response.data['insights']['top_category']['category'], 'Food')


# ---------------------------------------------------------------- notifications
class NotificationTests(BaseTest):
    def make_notification(self, user=None, message='Test alert'):
        return Notification.objects.create(user=user or self.user, type='budget_alert', message=message)

    def test_list_mark_read_and_delete(self):
        note = self.make_notification()
        listing = self.client.get('/api/finance/notifications/')
        self.assertEqual(listing.status_code, 200)
        self.assertTrue(any(n['message'] == 'Test alert' for n in listing.data))

        self.assertEqual(self.client.post(f'/api/finance/notifications/{note.id}/read/').status_code, 200)
        note.refresh_from_db()
        self.assertTrue(note.is_read)

        self.assertEqual(self.client.delete(f'/api/finance/notifications/{note.id}/').status_code, 204)

    def test_mark_all_as_read(self):
        self.make_notification(message='One')
        self.make_notification(message='Two')
        response = self.client.post('/api/finance/notifications/read-all/')
        self.assertEqual(response.data['updated'], 2)
        self.assertFalse(Notification.objects.filter(user=self.user, is_read=False).exists())

    def test_cannot_touch_another_users_notification(self):
        theirs = self.make_notification(user=self.other)
        self.assertEqual(self.client.delete(f'/api/finance/notifications/{theirs.id}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/finance/notifications/{theirs.id}/read/').status_code, 404)

    def test_opening_notifications_creates_a_deadline_reminder(self):
        SavingsGoal.objects.create(user=self.user, name='Trip', target_amount=Decimal('1000'),
                                   deadline=self.today + timedelta(days=5))
        self.client.get('/api/finance/notifications/')
        self.assertTrue(Notification.objects.filter(
            user=self.user, type='savings_reminder', message__contains='within 7 days').exists())
        self.client.get('/api/finance/notifications/')          # open again: no duplicate
        self.assertEqual(Notification.objects.filter(user=self.user, type='savings_reminder').count(), 1)


# ---------------------------------------------------------------- email
class EmailBuilderTests(SimpleTestCase):
    def test_subject_and_button_link(self):
        subject, text, html = build_email(
            'budget_alert', 'You have used 80% of your Food budget.', 'Anu', 'http://127.0.0.1:5500/')
        self.assertEqual(subject, 'BudgetBuddy: Budget alert')
        self.assertIn('http://127.0.0.1:5500/budgets', text)
        self.assertIn('http://127.0.0.1:5500/budgets', html)

    def test_user_text_is_escaped(self):
        _, _, html = build_email('budget_alert', '<b>bold</b>', '<script>x</script>', 'http://x')
        self.assertNotIn('<script>', html)
        self.assertIn('&lt;script&gt;', html)
        self.assertNotIn('<b>bold</b>', html)

    def test_every_kind_can_be_built(self):
        for kind in ('budget_alert', 'goal_milestone', 'savings_reminder', 'monthly_report', 'test', 'unknown'):
            subject, text, html = build_email(kind, 'Message', '', 'http://x')
            self.assertTrue(subject.startswith('BudgetBuddy:'))


HAS_EMAIL_SWITCH = any(f.name == 'email_notifications' for f in Profile._meta.get_fields())


class SendEmailRulesTests(TestCase):
    def make_note(self, **user_options):
        user = make_user('mailer')
        for field, value in user_options.items():
            setattr(user, field, value)
        user.save()
        return Notification.objects.create(user=user, type='budget_alert', message='Test')

    @patch('finance.emails.threading.Thread')
    def test_email_is_sent_when_the_user_has_an_address(self, thread):
        send_notification_email(self.make_note())
        thread.assert_called_once()

    @patch('finance.emails.threading.Thread')
    def test_no_email_without_an_address(self, thread):
        send_notification_email(self.make_note(email=''))
        thread.assert_not_called()

    @patch('finance.emails.threading.Thread')
    def test_no_email_when_the_switch_is_off(self, thread):
        if not HAS_EMAIL_SWITCH:
            self.skipTest('The email_notifications field is not in this project yet.')
        note = self.make_note()
        note.user.profile.email_notifications = False
        note.user.profile.save()
        send_notification_email(note)
        thread.assert_not_called()