from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.parsers import FormParser, MultiPartParser

from .avatars import make_avatar

from .models import Profile, User
from .serializers import (
    ChangePasswordSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer, PhotoSerializer
)

from django.conf import settings

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ProfileView(APIView):
    """GET: your account and profile.   PATCH: change your own details."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        profile, _ = Profile.objects.get_or_create(user=user)

        if 'email' in data:
            user.email = data['email']
            user.save(update_fields=['email'])
        for field in ('full_name', 'monthly_income', 'currency' , 'email_notifications'):
            if field in data:
                setattr(profile, field, data[field])
        profile.save()

        user.refresh_from_db()
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Your password was updated.'})


class ProfilePhotoView(APIView):
    """POST: upload or replace your profile photo.   DELETE: remove it."""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = PhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile, _ = Profile.objects.get_or_create(user=request.user)
        content = make_avatar(serializer.validated_data['photo'])
        if profile.photo:
            profile.photo.delete(save=False)           # remove the old file from the disk
        profile.photo.save('avatar.jpg', content, save=True)

        user = User.objects.get(pk=request.user.pk)
        return Response(UserSerializer(user).data)

    def delete(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        if profile.photo:
            profile.photo.delete(save=True)            # deletes the file and clears the field

        user = User.objects.get(pk=request.user.pk)
        return Response(UserSerializer(user).data)

class UpgradeView(APIView):
    """DEMO upgrade: switches a Student to Premium.
    In a real product this would happen after a payment is confirmed (Stripe, Razorpay...).
    It only works while PREMIUM_DEMO_UPGRADE=True, so it is off by default."""

    def post(self, request):
        if not getattr(settings, 'PREMIUM_DEMO_UPGRADE', False):
            return Response({'detail': 'Upgrades are handled by an administrator.'}, status=403)
        user = request.user
        if user.role == User.Role.ADMIN:
            return Response({'detail': 'Administrators already have every feature.'}, status=400)
        user.role = User.Role.PREMIUM
        user.save(update_fields=['role'])
        return Response(UserSerializer(user).data)


class DowngradeView(APIView):
    """DEMO: switches a Premium user back to Student (handy for testing)."""

    def post(self, request):
        if not getattr(settings, 'PREMIUM_DEMO_UPGRADE', False):
            return Response({'detail': 'Plan changes are handled by an administrator.'}, status=403)
        user = request.user
        if user.role == User.Role.ADMIN:
            return Response({'detail': 'Administrator accounts cannot be downgraded here.'}, status=400)
        user.role = User.Role.STUDENT
        user.save(update_fields=['role'])
        return Response(UserSerializer(user).data)