from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    ChangePasswordView, DowngradeView, MeView, ProfilePhotoView, ProfileView, RegisterView, UpgradeView,
)


urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', TokenObtainPairView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('me/', MeView.as_view()),
    path('profile/', ProfileView.as_view()),
    path('profile/photo/', ProfilePhotoView.as_view()),
    path('change-password/', ChangePasswordView.as_view()),
    path('upgrade/', UpgradeView.as_view()),
    path('downgrade/', DowngradeView.as_view()),
]