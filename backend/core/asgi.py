import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

# Initialize Django before importing modules that may touch app models/auth.
django_asgi_app = get_asgi_application()

from users_app.routing import websocket_urlpatterns
from users_app.ws_auth import JWTAuthMiddlewareStack


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        ),
    }
)
