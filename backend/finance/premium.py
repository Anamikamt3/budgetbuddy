"""Free versus Premium: who may do what.
A user is Premium when their role is 'premium' (or 'admin')."""
from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, SavingsGoal

PREMIUM_ROLES = ('premium', 'admin')

# None means "no limit"
FREE_LIMITS = {'goals': 3, 'custom_categories': 5, 'trend_months': 3}
PREMIUM_LIMITS = {'goals': None, 'custom_categories': None, 'trend_months': 24}


def is_premium(user):
    return bool(user and user.is_authenticated and user.role in PREMIUM_ROLES)


def limits_for(user):
    return PREMIUM_LIMITS if is_premium(user) else FREE_LIMITS


def require_premium(user, feature):
    """Call this at the start of a Premium-only feature."""
    if not is_premium(user):
        raise PermissionDenied(f'{feature} is a Premium feature. Upgrade on the Premium page.')


class IsPremium(BasePermission):
    """Use on a whole view:  permission_classes = [IsAuthenticated, IsPremium]"""
    message = 'This feature is part of the Premium plan.'

    def has_permission(self, request, view):
        return is_premium(request.user)


class PlanView(APIView):
    """Tells the frontend which plan the user has, the limits and how much is used."""

    def get(self, request):
        user = request.user
        return Response({
            'plan': 'premium' if is_premium(user) else 'free',
            'role': user.role,
            'limits': limits_for(user),
            'usage': {
                'goals': SavingsGoal.objects.filter(user=user, is_completed=False).count(),
                'custom_categories': Category.objects.filter(user=user).count(),
            },
            'demo_upgrade': getattr(settings, 'PREMIUM_DEMO_UPGRADE', False),
        })