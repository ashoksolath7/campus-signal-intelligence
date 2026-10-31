from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import re
import smtplib
import socket
from typing import Any

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def validate_email_syntax(email: str) -> str:
    """Validates that the provided email is syntactically valid across all email providers."""
    cleaned = email.strip().lower()
    if not cleaned or not EMAIL_REGEX.match(cleaned):
        raise AppError(
            f"'{email}' is not a valid email address. Please enter a valid address (e.g., student@gmail.com, user@outlook.com, person@campus.edu).",
            code="invalid_email_format",
            status_code=400,
        )
    return cleaned


def send_otp_email(to_email: str, otp: str) -> dict[str, Any]:
    """Delivers a 6-digit verification code to the target email address via real SMTP."""
    valid_email = validate_email_syntax(to_email)

    subject = f"Your Campus Signal Intelligence Verification Code: {otp}"
    from_addr = settings.smtp_from_email.strip() or settings.smtp_user.strip() or "no-reply@campussignal.edu"
    from_name = settings.smtp_from_name or "Campus Signal Intelligence"
    sender_header = f"{from_name} <{from_addr}>"

    text_body = (
        f"Campus Signal Intelligence — Email Verification\n\n"
        f"Your one-time verification code is:\n\n"
        f"    {otp}\n\n"
        f"This code will expire in {settings.otp_expire_minutes} minutes.\n"
        f"Do not share this code with anyone. If you did not request this verification, you can safely ignore this email.\n\n"
        f"Campus Signal Intelligence Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="background-color: #0f172a; padding: 20px 24px;">
      <h1 style="color: #ffffff; font-size: 18px; margin: 0; font-weight: 600;">Campus Signal Intelligence</h1>
    </div>
    <div style="padding: 24px;">
      <h2 style="font-size: 16px; color: #0f172a; margin-top: 0; font-weight: 600;">Verify Your Email Address</h2>
      <p style="font-size: 14px; line-height: 22px; color: #475569;">
        Please use the following 6-digit one-time code to complete your registration.
      </p>
      <div style="margin: 24px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f172a; background-color: #f1f5f9; padding: 14px 28px; border-radius: 6px; border: 1px dashed #cbd5e1; font-family: monospace;">
          {otp}
        </span>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 20px;">
        • This verification code expires in <strong>{settings.otp_expire_minutes} minutes</strong>.<br>
        • Never share your code with anyone.<br>
        • If you did not request this code, no action is needed.
      </p>
    </div>
    <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
      Automated Security Notification &bull; Campus Signal Intelligence
    </div>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender_header
    msg["To"] = valid_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    if not settings.smtp_configured:
        if settings.app_env == "production":
            raise AppError(
                "Email delivery service is not configured. Please contact the administrator.",
                code="smtp_not_configured",
                status_code=503,
            )
        logger.info(
            "SMTP is not configured in .env. Development fallback enabled for %s (no external email sent).",
            valid_email,
        )
        return {
            "delivered": True,
            "method": "development_unconfigured",
            "email": valid_email,
            "note": "SMTP not configured in backend/.env; email delivery simulated for development.",
        }

    server = None
    try:
        timeout_val = float(settings.smtp_timeout_seconds)
        if settings.smtp_ssl:
            server = smtplib.SMTP_SSL(
                host=settings.smtp_host,
                port=settings.smtp_port,
                timeout=timeout_val,
            )
        else:
            server = smtplib.SMTP(
                host=settings.smtp_host,
                port=settings.smtp_port,
                timeout=timeout_val,
            )
            if settings.smtp_tls:
                server.starttls()

        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)

        server.send_message(msg)
        try:
            server.quit()
        except Exception:
            pass

        logger.info(
            "SMTP OTP email dispatched successfully to %s via %s:%s",
            valid_email,
            settings.smtp_host,
            settings.smtp_port,
        )
        return {
            "delivered": True,
            "method": "smtp",
            "email": valid_email,
        }
    except smtplib.SMTPAuthenticationError as exc:
        logger.error("SMTP authentication failed for user %s: code=%s", settings.smtp_user, exc.smtp_code)
        raise AppError(
            "Email delivery failed: SMTP authentication rejected. Please check sender credentials or App Password.",
            code="smtp_auth_failed",
            status_code=502,
        )
    except (smtplib.SMTPConnectError, TimeoutError, socket.timeout) as exc:
        logger.error(
            "SMTP connection to %s:%s timed out or failed: %s",
            settings.smtp_host,
            settings.smtp_port,
            exc,
        )
        raise AppError(
            f"Email delivery failed: Connection to mail server ({settings.smtp_host}:{settings.smtp_port}) timed out. Please check network and SMTP port settings.",
            code="smtp_connection_timeout",
            status_code=504,
        )
    except smtplib.SMTPServerDisconnected as exc:
        logger.error("SMTP server disconnected unexpectedly: %s", exc)
        raise AppError(
            "Email delivery failed: Mail server disconnected unexpectedly before completing transmission. Please try again.",
            code="smtp_disconnected",
            status_code=502,
        )
    except smtplib.SMTPRecipientsRefused as exc:
        logger.error("SMTP recipient rejected for %s: %s", valid_email, exc)
        raise AppError(
            f"Email delivery failed: The recipient address '{valid_email}' was rejected by the mail server.",
            code="smtp_recipient_refused",
            status_code=400,
        )
    except smtplib.SMTPSenderRefused as exc:
        logger.error("SMTP sender refused (%s): %s", from_addr, exc)
        raise AppError(
            "Email delivery failed: The sender address was rejected by the mail server.",
            code="smtp_sender_refused",
            status_code=502,
        )
    except smtplib.SMTPDataError as exc:
        logger.error("SMTP data error: %s", exc)
        raise AppError(
            "Email delivery failed: Mail server rejected the message content or quota was exceeded.",
            code="smtp_data_rejected",
            status_code=502,
        )
    except smtplib.SMTPException as exc:
        logger.error("SMTP protocol error during dispatch to %s: %s", valid_email, exc)
        raise AppError(
            f"Email delivery failed: Mail server protocol error ({type(exc).__name__}). Please check SMTP configuration.",
            code="smtp_protocol_error",
            status_code=502,
        )
    except Exception as exc:
        logger.error("Unexpected error during email delivery to %s: %s", valid_email, exc)
        raise AppError(
            "Email delivery failed due to a server connection issue. Please verify mail settings and try again.",
            code="smtp_delivery_failed",
            status_code=502,
        )
    finally:
        if server is not None:
            try:
                server.close()
            except Exception:
                pass
