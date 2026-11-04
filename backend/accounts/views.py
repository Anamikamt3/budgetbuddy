from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile, User
from .serializers import (
    ChangePasswordSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer,
)


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