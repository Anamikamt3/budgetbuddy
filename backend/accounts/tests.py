from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Profile, User

PASSWORD = 'StrongPass123'


def make_user(username='anu', email=None, role='student'):
    user = User.objects.create_user(
        username=username, email=email or f'{username}@example.com', password=PASSWORD)
    if role != 'student':
        user.role = role
        user.save(update_fields=['role'])
    return user


class RegistrationAndLoginTests(APITestCase):
    def test_register_creates_a_student_with_a_profile(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newbie', 'email': 'newbie@example.com', 'password': PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='newbie')
        self.assertEqual(user.role, 'student')                 # everyone starts as a Student
        self.assertTrue(Profile.objects.filter(user=user).exists())   # the signal made a profile

    def test_a_user_cannot_register_as_admin(self):
        self.client.post('/api/auth/register/', {
            'username': 'sneaky', 'email': 'sneaky@example.com',
            'password': PASSWORD, 'role': 'admin',
        }, format='json')
        self.assertEqual(User.objects.get(username='sneaky').role, 'student')

    def test_short_password_is_rejected(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'shorty', 'email': 'shorty@example.com', 'password': 'abc',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)

    def test_duplicate_username_is_rejected(self):
        make_user('anu')
        response = self.client.post('/api/auth/register/', {
            'username': 'anu', 'email': 'other@example.com', 'password': PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('username', response.data)

    def test_login_returns_tokens_and_me_works(self):
        make_user('anu')
        login = self.client.post('/api/auth/login/', {'username': 'anu', 'password': PASSWORD}, format='json')
        self.assertEqual(login.status_code, 200)
        self.assertIn('access', login.data)
        self.assertIn('refresh', login.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data['username'], 'anu')
        self.assertEqual(me.data['role'], 'student')

    def test_wrong_password_is_rejected(self):
        make_user('anu')
        response = self.client.post('/api/auth/login/', {'username': 'anu', 'password': 'wrong'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_me_needs_a_login(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_refresh_token_gives_a_new_access_token(self):
        make_user('anu')
        login = self.client.post('/api/auth/login/', {'username': 'anu', 'password': PASSWORD}, format='json')
        refreshed = self.client.post('/api/auth/refresh/', {'refresh': login.data['refresh']}, format='json')
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn('access', refreshed.data)


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = make_user('anu')
        self.client.force_authenticate(self.user)

    def test_update_profile(self):
        response = self.client.patch('/api/auth/profile/', {
            'full_name': 'Anu Menon', 'monthly_income': '8000', 'currency': 'usd',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['profile']['currency'], 'USD')     # made upper case
        self.assertEqual(response.data['profile']['full_name'], 'Anu Menon')

    def test_role_cannot_be_changed_through_the_profile(self):
        self.client.patch('/api/auth/profile/', {'role': 'admin'}, format='json')
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, 'student')

    def test_invalid_currency_is_rejected(self):
        response = self.client.patch('/api/auth/profile/', {'currency': 'RUPEES'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('currency', response.data)

    def test_negative_income_is_rejected(self):
        response = self.client.patch('/api/auth/profile/', {'monthly_income': '-5'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_email_must_be_unique(self):
        make_user('ravi', email='ravi@example.com')
        response = self.client.patch('/api/auth/profile/', {'email': 'ravi@example.com'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)

    def test_change_password_needs_the_current_password(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': 'wrong-one', 'new_password': 'BrandNewPass1',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('current_password', response.data)

    def test_change_password_works(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': PASSWORD, 'new_password': 'BrandNewPass1',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('BrandNewPass1'))

    def test_new_password_must_be_different(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': PASSWORD, 'new_password': PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 400)


class DemoUpgradeTests(APITestCase):
    def setUp(self):
        self.user = make_user('anu')
        self.client.force_authenticate(self.user)

    @override_settings(PREMIUM_DEMO_UPGRADE=False)
    def test_upgrade_is_switched_off_by_default(self):
        response = self.client.post('/api/auth/upgrade/')
        self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, 'student')

    @override_settings(PREMIUM_DEMO_UPGRADE=True)
    def test_upgrade_and_downgrade_when_enabled(self):
        self.assertEqual(self.client.post('/api/auth/upgrade/').status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, 'premium')

        self.assertEqual(self.client.post('/api/auth/downgrade/').status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.role, 'student')

    @override_settings(PREMIUM_DEMO_UPGRADE=True)
    def test_administrators_are_never_changed(self):
        admin = make_user('boss', role='admin')
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post('/api/auth/downgrade/').status_code, 400)
        admin.refresh_from_db()
        self.assertEqual(admin.role, 'admin')