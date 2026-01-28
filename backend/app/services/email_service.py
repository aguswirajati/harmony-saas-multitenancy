"""
Email Service for Harmony SaaS
Handles all email sending operations including verification, password reset, and invitations
"""
from typing import Optional, Dict, Any
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from loguru import logger

from app.config import settings


class EmailService:
    """Email service for sending transactional emails"""

    def __init__(self):
        # Set up Jinja2 template environment
        template_dir = Path(__file__).parent.parent / "templates" / "email"
        template_dir.mkdir(parents=True, exist_ok=True)

        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        Send an email using SMTP

        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content of the email
            text_content: Plain text fallback content

        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not settings.MAIL_ENABLED:
            logger.warning(f"Email disabled. Would have sent to {to_email}: {subject}")
            return True

        try:
            # Create message
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
            message['To'] = to_email

            # Add plain text part
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                message.attach(text_part)

            # Add HTML part
            html_part = MIMEText(html_content, 'html')
            message.attach(html_part)

            # Send email
            await aiosmtplib.send(
                message,
                hostname=settings.MAIL_SERVER,
                port=settings.MAIL_PORT,
                username=settings.MAIL_USERNAME,
                password=settings.MAIL_PASSWORD,
                start_tls=settings.MAIL_STARTTLS,
                use_tls=settings.MAIL_SSL_TLS,
            )

            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """
        Render an email template with context

        Args:
            template_name: Name of the template file
            context: Dictionary of template variables

        Returns:
            str: Rendered HTML content
        """
        try:
            template = self.env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            logger.error(f"Failed to render template {template_name}: {str(e)}")
            raise

    async def send_welcome_email(
        self,
        to_email: str,
        user_name: str,
        tenant_name: str,
        verification_url: Optional[str] = None
    ) -> bool:
        """
        Send welcome email to new user

        Args:
            to_email: User's email address
            user_name: User's full name
            tenant_name: Name of the tenant organization
            verification_url: Email verification URL (if email verification is required)

        Returns:
            bool: True if sent successfully
        """
        context = {
            "user_name": user_name,
            "tenant_name": tenant_name,
            "verification_url": verification_url,
            "frontend_url": settings.FRONTEND_URL,
        }

        html_content = self.render_template("welcome.html", context)

        subject = f"Welcome to {tenant_name}!"

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_password_reset_email(
        self,
        to_email: str,
        user_name: str,
        reset_token: str,
        expires_in_minutes: int = 60
    ) -> bool:
        """
        Send password reset email

        Args:
            to_email: User's email address
            user_name: User's full name
            reset_token: Password reset token
            expires_in_minutes: Token expiration time in minutes

        Returns:
            bool: True if sent successfully
        """
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

        context = {
            "user_name": user_name,
            "reset_url": reset_url,
            "expires_in_minutes": expires_in_minutes,
        }

        html_content = self.render_template("password-reset.html", context)

        subject = "Reset Your Password"

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_verification_email(
        self,
        to_email: str,
        user_name: str,
        verification_token: str
    ) -> bool:
        """
        Send email verification link

        Args:
            to_email: User's email address
            user_name: User's full name
            verification_token: Email verification token

        Returns:
            bool: True if sent successfully
        """
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

        context = {
            "user_name": user_name,
            "verification_url": verification_url,
        }

        html_content = self.render_template("email-verification.html", context)

        subject = "Verify Your Email Address"

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content
        )

    async def send_invitation_email(
        self,
        to_email: str,
        inviter_name: str,
        tenant_name: str,
        invitation_token: str,
        role: str = "staff"
    ) -> bool:
        """
        Send user invitation email

        Args:
            to_email: Invitee's email address
            inviter_name: Name of the person who sent the invitation
            tenant_name: Name of the tenant organization
            invitation_token: Invitation token
            role: Role being invited to

        Returns:
            bool: True if sent successfully
        """
        invitation_url = f"{settings.FRONTEND_URL}/accept-invitation?token={invitation_token}"

        context = {
            "inviter_name": inviter_name,
            "tenant_name": tenant_name,
            "invitation_url": invitation_url,
            "role": role.replace("_", " ").title(),
        }

        html_content = self.render_template("user-invitation.html", context)

        subject = f"You've been invited to join {tenant_name}"

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content
        )


# Singleton instance
email_service = EmailService()
