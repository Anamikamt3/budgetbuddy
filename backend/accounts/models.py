from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
import os
import uuid

class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = 'student', 'Student'
        PREMIUM = 'premium', 'Premium User'
        ADMIN = 'admin', 'Admin'

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)

    def __str__(self):
        return self.username

def avatar_path(instance, filename):
    """Each upload gets its own file name, so browsers never show an old picture."""
    extension = os.path.splitext(filename)[1].lower() or '.jpg'
    return f'avatars/{instance.user_id}_{uuid.uuid4().hex[:10]}{extension}'

class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=100, blank=True)
    monthly_income = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=5, default='INR')   # change to your currency
    photo = models.ImageField(upload_to=avatar_path, blank=True, null=True)
    email_notifications = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Profile of {self.user.username}'