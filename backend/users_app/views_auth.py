from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from .views import create_admin_log

User = get_user_model()


def _is_admin_account(user):
    return bool(user and (user.is_superuser or user.is_staff or getattr(user, "role", "") == "admin"))


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = (attrs.get("username") or "").strip()
        password = attrs.get("password")

        if not identifier or not password:
            raise AuthenticationFailed("Username/email and password are required.")

        user = User.objects.filter(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        ).first()

        if not user or not user.check_password(password):
            raise AuthenticationFailed("Invalid username/email or password.")

        is_admin_account = _is_admin_account(user)

        # Repair legacy admin/superuser records created before admin defaults were aligned.
        if is_admin_account:
            fields_to_update = []
            if getattr(user, "role", "") != "admin":
                user.role = "admin"
                fields_to_update.append("role")
            if not getattr(user, "is_email_verified", False):
                user.is_email_verified = True
                fields_to_update.append("is_email_verified")
            if fields_to_update:
                user.save(update_fields=fields_to_update)

        if not user.is_active:
            if user.role == "instructor":
                raise AuthenticationFailed("Instructor account is waiting for admin approval.")
            raise AuthenticationFailed("Account is inactive.")

        if is_admin_account:
            data = super().validate({"username": user.username, "password": password})
            return data

        if not getattr(user, "is_email_verified", False):
            raise AuthenticationFailed("Account inactive. Please verify your email.")

        data = super().validate({"username": user.username, "password": password})
        create_admin_log(
            action="User login",
            performed_by=user,
            target_user=user,
            description=f"Successful login for {user.username}.",
        )
        return data


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer
