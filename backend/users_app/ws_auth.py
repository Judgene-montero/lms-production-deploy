from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


def _anonymous_user():
    from django.contrib.auth.models import AnonymousUser

    return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner
        self.jwt_authentication = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope["auth_error"] = None
        scope["user"] = await self._resolve_user(scope)
        return await self.inner(scope, receive, send)

    async def _resolve_user(self, scope):
        token = self._extract_token(scope)
        if not token:
            return scope.get("user") or _anonymous_user()
        try:
            return await self._get_user_from_token(token)
        except (InvalidToken, TokenError, AuthenticationFailed, Exception) as exc:
            scope["auth_error"] = str(exc)
            return _anonymous_user()

    def _extract_token(self, scope):
        headers = dict(scope.get("headers") or [])
        authorization = headers.get(b"authorization", b"").decode("utf-8").strip()
        if authorization.lower().startswith("bearer "):
            return authorization.split(" ", 1)[1].strip()

        query_string = (scope.get("query_string") or b"").decode("utf-8")
        params = parse_qs(query_string)
        return (params.get("token") or [""])[0].strip()

    @database_sync_to_async
    def _get_user_from_token(self, token):
        validated = self.jwt_authentication.get_validated_token(token)
        return self.jwt_authentication.get_user(validated)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
