import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger("notifications")


def notify_new_contact(name: str, email: str, subject: str, message: str) -> None:
    """Emails the site owner when SMTP is configured; otherwise just logs.

    The dashboard always shows unread messages, so email is a convenience.
    """
    if not (settings.SMTP_HOST and settings.NOTIFY_EMAIL and settings.SMTP_FROM):
        log.info("new contact message from %s (email notifications not configured)", email)
        return
    msg = EmailMessage()
    msg["Subject"] = f"[Portfolio] {subject}"[:200]
    msg["From"] = settings.SMTP_FROM
    msg["To"] = settings.NOTIFY_EMAIL
    msg["Reply-To"] = email
    msg.set_content(f"New message from {name} <{email}>\n\nSubject: {subject}\n\n{message}\n")
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        log.warning("failed to send contact notification: %s", exc)
