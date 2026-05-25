# users_app/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from .models import ApprovedSchoolID, SiteSettings, AdminLog
from dashboards_app.serializers import SidebarLinkSerializer, CourseSerializer, SubmissionSerializer, NotificationSerializer


User = get_user_model()


# --------------------------
# REGISTER SERIALIZER
# --------------------------
class RegisterSerializer(serializers.ModelSerializer):
    initial_password = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = (
            'username', 'initial_password', 'password', 'password2',
            'email', 'first_name', 'middle_initial', 'last_name', 'school_id'
        )

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Passwords do not match."})

        # Validate approved school ID
        try:
            approved = ApprovedSchoolID.objects.get(school_id=attrs['school_id'])
        except ApprovedSchoolID.DoesNotExist:
            raise serializers.ValidationError({"school_id": "School ID not approved."})

        if not check_password(attrs['initial_password'], approved.initial_password):
            raise serializers.ValidationError({"initial_password": "Initial password is incorrect."})

        if approved.first_name.lower() != attrs['first_name'].lower() or approved.last_name.lower() != attrs['last_name'].lower():
            raise serializers.ValidationError({"name": "Full name does not match school record."})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        validated_data.pop('initial_password')

        approved = ApprovedSchoolID.objects.get(school_id=validated_data['school_id'])
        validated_data['role'] = approved.role
        validated_data['college'] = approved.college

        user = User.objects.create_user(**validated_data)
        user.is_verified_school_user = True
        user.save()
        return user


# --------------------------
# USER SERIALIZER
# --------------------------
class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'middle_initial', 'last_name',
            'full_name', 'role', 'college', 'school_id', 'is_verified_school_user',
        )

    def get_full_name(self, obj):
        mi = f"{obj.middle_initial}." if obj.middle_initial else ""
        return f"{obj.last_name}, {obj.first_name} {mi}".strip()


class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        try:
            uid = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=uid)
        except Exception as exc:
            raise serializers.ValidationError({"token": "This reset link is invalid or has expired."}) from exc

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError({"token": "This reset link is invalid or has expired."})

        attrs["user"] = user
        return attrs


# --------------------------
# APPROVED SCHOOL ID SERIALIZER
# --------------------------
class ApprovedSchoolIDSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovedSchoolID
        fields = ('id', 'first_name', 'middle_initial', 'last_name', 'school_id', 'role', 'college')


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = (
            "require_email_verification",
            "allow_instructor_self_registration",
            "allow_username_change",
            "default_user_role",
            "analytics_polling_interval",
            "analytics_low_risk_max",
            "analytics_medium_risk_max",
            "analytics_high_risk_min",
            "analytics_passing_grade",
            "max_login_attempts",
            "updated_at",
        )
        read_only_fields = ("updated_at",)

    def validate(self, attrs):
        instance = self.instance

        def next_value(field):
            return attrs.get(field, getattr(instance, field, None))

        low_max = float(next_value("analytics_low_risk_max"))
        medium_max = float(next_value("analytics_medium_risk_max"))
        high_min = float(next_value("analytics_high_risk_min"))
        passing_grade = float(next_value("analytics_passing_grade"))

        for field_name, value in (
            ("analytics_low_risk_max", low_max),
            ("analytics_medium_risk_max", medium_max),
            ("analytics_high_risk_min", high_min),
        ):
            if value < 0 or value > 1:
                raise serializers.ValidationError({field_name: "Risk thresholds must be between 0 and 1."})

        if not (0 <= passing_grade <= 100):
            raise serializers.ValidationError({"analytics_passing_grade": "Passing grade must be between 0 and 100."})
        if low_max >= medium_max:
            raise serializers.ValidationError(
                {"analytics_low_risk_max": "Low risk max must be lower than medium risk max."}
            )
        if high_min < medium_max:
            raise serializers.ValidationError(
                {"analytics_high_risk_min": "High risk min must be equal to or greater than medium risk max."}
            )

        return attrs


class AdminLogSerializer(serializers.ModelSerializer):
    performed_by_username = serializers.CharField(source="performed_by.username", read_only=True)
    target_user_username = serializers.CharField(source="target_user.username", read_only=True)

    class Meta:
        model = AdminLog
        fields = (
            "id",
            "action",
            "performed_by",
            "performed_by_username",
            "target_user",
            "target_user_username",
            "description",
            "timestamp",
        )
        read_only_fields = ("id", "timestamp", "performed_by", "performed_by_username")


class InstructorProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "middle_initial",
            "full_name",
            "name",
            "profile_complete",
            "college",
            "bio",
            "phone",
            "department",
            "avatar",
            "avatar_url",
        )
        read_only_fields = ("id", "username", "full_name", "name", "profile_complete", "avatar_url")

    def get_full_name(self, obj):
        mi = f"{obj.middle_initial}." if obj.middle_initial else ""
        composed = f"{obj.first_name} {mi} {obj.last_name}".replace("  ", " ").strip()
        return composed or obj.username

    def get_name(self, obj):
        return self.get_full_name(obj)

    def get_avatar_url(self, obj):
        return obj.get_avatar_url(request=self.context.get("request"))


class InstructorNotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "notify_assignment_submission",
            "notify_quiz_completed",
            "notify_student_join_course",
        )


class StudentProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    can_edit_school_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "role",
            "email",
            "first_name",
            "last_name",
            "middle_initial",
            "full_name",
            "name",
            "school_id",
            "college",
            "profile_complete",
            "can_edit_school_id",
            "bio",
            "phone",
            "department",
            "avatar",
            "avatar_url",
        )
        read_only_fields = (
            "id",
            "username",
            "role",
            "full_name",
            "name",
            "school_id",
            "profile_complete",
            "can_edit_school_id",
            "avatar_url",
        )

    def get_full_name(self, obj):
        mi = f"{obj.middle_initial}." if obj.middle_initial else ""
        composed = f"{obj.first_name} {mi} {obj.last_name}".replace("  ", " ").strip()
        return composed or obj.username

    def get_name(self, obj):
        return self.get_full_name(obj)

    def get_avatar_url(self, obj):
        return obj.get_avatar_url(request=self.context.get("request"))

    def get_can_edit_school_id(self, obj):
        return not bool(getattr(obj, "school_id", ""))


class StudentNotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "notify_instructor_announcement",
            "notify_assignment_graded",
            "notify_quiz_released",
            "notify_due_date_approaching",
        )


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
