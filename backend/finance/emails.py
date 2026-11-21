import logging
import threading
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)

# How each kind of notification looks in an email
KINDS = {
    'budget_alert': {'label': 'Budget alert', 'color': '#c27c00',
                     'path': '/budgets', 'button': 'View budgets'},
    'goal_milestone': {'label': 'Goal milestone', 'color': '#16866a',
                       'path': '/goals', 'button': 'View goals'},
    'savings_reminder': {'label': 'Savings reminder', 'color': '#2d5bff',
                         'path': '/goals', 'button': 'View goals'},
    'monthly_report': {'label': 'Monthly report', 'color': '#6a4bd8',
                       'path': '/reports', 'button': 'Open reports'},
    'test': {'label': 'Test email', 'color': '#2d5bff',
             'path': '/profile', 'button': 'Open BudgetBuddy'},
}


def build_email(kind, message, name, base_url):
    """Returns (subject, plain text, html). No Django needed, so it is easy to test."""
    info = KINDS.get(kind, KINDS['budget_alert'])
    link = base_url.rstrip('/') + info['path']
    greeting = f'Hi {name},' if name else 'Hi,'
    subject = f"BudgetBuddy: {info['label']}"

    text = (
        f'{greeting}\n\n{message}\n\n{info["button"]}: {link}\n\n'
        'You are receiving this email because email notifications are turned on '
        'in your BudgetBuddy profile.\n'
    )

    html = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ef;">
    <tr><td style="background:#15203a;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:bold;">
      BudgetBuddy
    </td></tr>
    <tr><td style="padding:28px;">
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:{info['color']};color:#ffffff;font-size:12px;font-weight:bold;">{escape(info['label'])}</span>
      <p style="margin:18px 0 6px;color:#5b6578;font-size:15px;">{escape(greeting)}</p>
      <p style="margin:0 0 24px;color:#15203a;font-size:18px;line-height:1.5;font-weight:bold;">{escape(message)}</p>
      <a href="{escape(link)}" style="display:inline-block;background:#2d5bff;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:10px;">{escape(info['button'])}</a>
    </td></tr>
    <tr><td style="padding:18px 28px;background:#f8f9fc;color:#8a93a6;font-size:12px;line-height:1.5;">
      You are receiving this email because email notifications are turned on in your BudgetBuddy profile.
      You can turn them off any time on the Profile page.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>"""
    return subject, text, html


def email_fields(kind, message, name, base_url):
    """The same content as separate pieces. EmailJS fills its template with these."""
    info = KINDS.get(kind, KINDS['budget_alert'])
    return {
        'name': name or 'there',
        'label': info['label'],
        'headline': message,
        'link': base_url.rstrip('/') + info['path'],
        'button_text': info['button'],
    }


def _deliver(subject, text, html, to, fields=None):
    mail = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
    mail.attach_alternative(html, 'text/html')
    mail.extra_params = fields or {}
    mail.send()


def _send_safely(subject, text, html, to, fields):
    """Used in the background. A failed email must never break the app."""
    try:
        _deliver(subject, text, html, to, fields)
    except Exception:
        logger.exception('Could not send the notification email to %s', to)


def send_notification_email(notification):
    """Email a notification to its owner (if they have an email and want emails).
    It is sent in a background thread so the page does not wait for the mail service."""
    user = notification.user
    profile = getattr(user, 'profile', None)
    if not user.email or (profile is not None and not profile.email_notifications):
        return
    name = profile.full_name if profile is not None and profile.full_name else user.username
    subject, text, html = build_email(
        notification.type, notification.message, name, settings.FRONTEND_URL)
    fields = email_fields(notification.type, notification.message, name, settings.FRONTEND_URL)
    threading.Thread(target=_send_safely, args=(subject, text, html, user.email, fields),
                     daemon=True).start()


def send_test_email(user):
    """Sends right away (no background thread) so any problem is reported to the user.
    Returns 'console', 'smtp' or 'api' so the page can say what really happened."""
    profile = getattr(user, 'profile', None)
    name = profile.full_name if profile is not None and profile.full_name else user.username
    message = 'This is a test email. Your BudgetBuddy email notifications are working.'
    subject, text, html = build_email('test', message, name, settings.FRONTEND_URL)
    fields = email_fields('test', message, name, settings.FRONTEND_URL)
    _deliver(subject, text, html, user.email, fields)
    return settings.EMAIL_MODE