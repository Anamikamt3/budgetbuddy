from rest_framework import serializers

from .models import Profile, User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class ProfileSerializer(serializers.ModelSerializer):
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['full_name', 'monthly_income', 'currency', 'email_notifications' , 'photo']

    def get_photo(self, obj):
        return obj.photo.url if obj.photo else None

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'date_joined', 'profile']


class ProfileUpdateSerializer(serializers.Serializer):
    """The fields a user is allowed to change about themselves.
    Note that "role" and "username" are NOT here, so they cannot be changed."""
    full_name = serializers.CharField(max_length=100, allow_blank=True, required=False)
    email = serializers.EmailField(required=False)
    monthly_income = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, required=False)
    currency = serializers.RegexField(
        r'^[A-Za-z]{3}$', required=False,
        error_messages={'invalid': 'Use a 3-letter currency code such as INR or USD.'})
    email_notifications = serializers.BooleanField(required=False)

    def validate_email(self, value):
        user = self.context['request'].user
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('This email is already used by another account.')
        return value

    def validate_currency(self, value):
        return value.upper()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('Your current password is incorrect.')
        return value

    def validate(self, attrs):
        if attrs['current_password'] == attrs['new_password']:
            raise serializers.ValidationError(
                {'new_password': 'Choose a password different from the current one.'})
        return attrs


class PhotoSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, file):
        if file.size > 2 * 1024 * 1024:
            raise serializers.ValidationError('The photo must be smaller than 2 MB.')
        if getattr(file, 'content_type', '') not in ('image/jpeg', 'image/png', 'image/webp'):
            raise serializers.ValidationError('Use a JPG, PNG or WebP image.')
        return file