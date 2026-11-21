"""Sends email through a web API over HTTPS (port 443).

Why: hosts such as Render's free plan block the normal email (SMTP) ports, so Gmail
by SMTP times out there. A web API call is an ordinary HTTPS request, which always works.

Choose the service with EMAIL_API_PROVIDER = 'emailjs' or 'brevo' (see settings.py)."""
import json
import logging
import urllib.error
import urllib.request
from email.utils import parseaddr

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send'


def _html_of(message):
    """The HTML version of an EmailMultiAlternatives message, if it has one."""
    for alternative in getattr(message, 'alternatives', []):
        if alternative[1] == 'text/html':
            return alternative[0]
    return None


def brevo_requests(message):
    """Brevo: one call can carry several recipients."""
    name, address = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
    sender = {'email': address}
    if name:
        sender['name'] = name
    payload = {
        'sender': sender,
        'to': [{'email': recipient} for recipient in message.to],
        'subject': message.subject,
        'textContent': message.body,
    }
    html = _html_of(message)
    if html:
        payload['htmlContent'] = html
    return [(BREVO_URL, {'api-key': settings.BREVO_API_KEY}, payload)]


def emailjs_requests(message):
    """EmailJS: one call per recipient. The look of the email is a template made in the
    EmailJS dashboard, and these values fill its {{placeholders}}."""
    extra = getattr(message, 'extra_params', None) or {}
    calls = []
    for recipient in message.to:
        params = {
            'to_email': recipient,
            'subject': message.subject,
            'message': message.body,
            **extra,
        }
        payload = {
            'service_id': settings.EMAILJS_SERVICE_ID,
            'template_id': settings.EMAILJS_TEMPLATE_ID,
            'user_id': settings.EMAILJS_PUBLIC_KEY,
            'accessToken': settings.EMAILJS_PRIVATE_KEY,
            'template_params': params,
        }
        calls.append((EMAILJS_URL, {}, payload))
    return calls


PROVIDERS = {'brevo': brevo_requests, 'emailjs': emailjs_requests}


def _post(url, headers, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'User-Agent': 'BudgetBuddy/1.0', **headers},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=15):
            pass
    except urllib.error.HTTPError as error:
        # The service's own explanation, for example "sender is not verified".
        # (It never contains your keys, and we never print them.)
        detail = error.read().decode('utf-8', 'replace')[:300]
        raise RuntimeError(f'The email service refused the message (HTTP {error.code}): {detail}') from None
    except urllib.error.URLError as error:
        raise RuntimeError(f'Could not reach the email service: {error.reason}') from None


class HttpApiEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        provider = getattr(settings, 'EMAIL_API_PROVIDER', 'brevo')
        build_requests = PROVIDERS.get(provider)
        if build_requests is None:
            raise ValueError(f"EMAIL_API_PROVIDER must be one of {sorted(PROVIDERS)}, not '{provider}'.")

        sent = 0
        for message in email_messages:
            try:
                for url, headers, payload in build_requests(message):
                    _post(url, headers, payload)
                sent += 1
            except Exception:
                if not self.fail_silently:
                    raise
                logger.exception('Email not sent')
        return sent