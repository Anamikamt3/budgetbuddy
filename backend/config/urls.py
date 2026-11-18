from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/finance/', include('finance.urls')),

    # Profile photos are public. Only the "avatars" folder is served, never the saved reports.
    re_path(r'^media/avatars/(?P<path>.*)$', serve,
            {'document_root': settings.MEDIA_ROOT / 'avatars'}),
]