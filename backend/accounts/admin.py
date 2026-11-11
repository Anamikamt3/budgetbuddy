from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Profile, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """The Users screen of the admin dashboard.
    An administrator can change a user's plan (role) in three ways:
      1. open a user and pick a Role,
      2. change the Role dropdown right in the list and press Save,
      3. tick users and use the "Make selected users Premium" action."""

    fieldsets = UserAdmin.fieldsets + (('BudgetBuddy plan', {'fields': ('role',)}),)
    list_display = ('username', 'email', 'role', 'is_active', 'date_joined')
    list_editable = ('role',)
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username', 'email')
    ordering = ('-date_joined',)
    actions = ['make_premium', 'make_student']

    @admin.action(description='Make selected users Premium')
    def make_premium(self, request, queryset):
        # administrators are never changed by this action
        updated = queryset.exclude(role=User.Role.ADMIN).update(role=User.Role.PREMIUM)
        self.message_user(request, f'{updated} user(s) are now Premium.')

    @admin.action(description='Move selected Premium users back to Student')
    def make_student(self, request, queryset):
        updated = queryset.filter(role=User.Role.PREMIUM).update(role=User.Role.STUDENT)
        self.message_user(request, f'{updated} user(s) are now Students.')


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'currency', 'monthly_income')
    search_fields = ('user__username', 'full_name')