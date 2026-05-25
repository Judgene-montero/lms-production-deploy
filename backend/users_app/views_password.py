import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import ForgotPasswordRequestSerializer, ResetPasswordConfirmSerializer

User = get_user_model()
logger = logging.getLogger(__name__)

GENERIC_RESET_RESPONSE = {
    "message": "If an account exists with that email, a reset link has been sent."
}


def _build_reset_url(request, user):
    base_url = str(getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    if not base_url:
        base_url = request.build_absolute_uri("/").rstrip("/")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{base_url}/reset-password/{uid}/{token}", uid, token


class PasswordResetRequestAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email__iexact=email).first()

        if user:
            reset_url, uid, token = _build_reset_url(request, user)
            subject = "Reset your LMS password"
            message = (
                "You requested a password reset for your LMS account.\n\n"
                f"Use this link to reset your password:\n{reset_url}\n\n"
                "If you did not request this, you can ignore this email."
            )

            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )

            if "console" in str(settings.EMAIL_BACKEND).lower():
                logger.info(
                    "Password reset link generated for development.",
                    extra={"user_id": user.id, "email": user.email, "reset_url": reset_url, "uid": uid, "token": token},
                )

        return Response(GENERIC_RESET_RESPONSE, status=status.HTTP_200_OK)


class PasswordResetVerifyAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, uid, token):
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response({"valid": False, "message": "This reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"valid": False, "message": "This reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"valid": True, "message": "Reset link verified."}, status=status.HTTP_200_OK)


class PasswordResetConfirmAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"message": "Password reset successful. You can now log in."}, status=status.HTTP_200_OK)
