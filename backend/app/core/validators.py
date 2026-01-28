"""
Custom Validators for Harmony SaaS
Provides input validation and sanitization to prevent security vulnerabilities
"""
import re
from typing import Any
from pydantic import validator
from fastapi import HTTPException, status


class PasswordValidator:
    """Password strength validation"""

    MIN_LENGTH = 8
    MAX_LENGTH = 128

    # Password requirements
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = False  # Optional for now

    # Common weak passwords to reject
    COMMON_PASSWORDS = {
        "password", "12345678", "password123", "admin123",
        "qwerty123", "letmein", "welcome123", "monkey123"
    }

    @classmethod
    def validate(cls, password: str) -> str:
        """
        Validate password strength

        Args:
            password: Password to validate

        Returns:
            str: The validated password

        Raises:
            ValueError: If password doesn't meet requirements
        """
        # Check length
        if len(password) < cls.MIN_LENGTH:
            raise ValueError(
                f"Password must be at least {cls.MIN_LENGTH} characters long"
            )

        if len(password) > cls.MAX_LENGTH:
            raise ValueError(
                f"Password must not exceed {cls.MAX_LENGTH} characters"
            )

        # Check for common weak passwords
        if password.lower() in cls.COMMON_PASSWORDS:
            raise ValueError(
                "This password is too common. Please choose a stronger password."
            )

        # Check complexity requirements
        errors = []

        if cls.REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
            errors.append("at least one uppercase letter")

        if cls.REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
            errors.append("at least one lowercase letter")

        if cls.REQUIRE_DIGIT and not re.search(r"\d", password):
            errors.append("at least one number")

        if cls.REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("at least one special character (!@#$%^&*...)")

        if errors:
            requirements = ", ".join(errors)
            raise ValueError(
                f"Password must contain {requirements}"
            )

        return password


class SubdomainValidator:
    """Subdomain validation and sanitization"""

    MIN_LENGTH = 3
    MAX_LENGTH = 50

    # Valid subdomain pattern: lowercase letters, numbers, hyphens
    # Must start and end with alphanumeric
    PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$")

    # Reserved subdomains that cannot be used
    RESERVED_SUBDOMAINS = {
        "www", "api", "admin", "app", "mail", "email", "ftp",
        "smtp", "pop", "imap", "webmail", "test", "demo", "dev",
        "staging", "prod", "production", "localhost", "support",
        "help", "blog", "forum", "shop", "store", "cdn", "static",
        "assets", "files", "docs", "status", "dashboard", "account",
        "billing", "payments", "checkout", "login", "signup", "register"
    }

    @classmethod
    def validate(cls, subdomain: str) -> str:
        """
        Validate and sanitize subdomain

        Args:
            subdomain: Subdomain to validate

        Returns:
            str: The validated subdomain (lowercase)

        Raises:
            ValueError: If subdomain is invalid
        """
        # Convert to lowercase
        subdomain = subdomain.lower().strip()

        # Check length
        if len(subdomain) < cls.MIN_LENGTH:
            raise ValueError(
                f"Subdomain must be at least {cls.MIN_LENGTH} characters long"
            )

        if len(subdomain) > cls.MAX_LENGTH:
            raise ValueError(
                f"Subdomain must not exceed {cls.MAX_LENGTH} characters"
            )

        # Check pattern
        if not cls.PATTERN.match(subdomain):
            raise ValueError(
                "Subdomain must contain only lowercase letters, numbers, and hyphens. "
                "It must start and end with a letter or number."
            )

        # Check for reserved subdomains
        if subdomain in cls.RESERVED_SUBDOMAINS:
            raise ValueError(
                f"The subdomain '{subdomain}' is reserved and cannot be used. "
                "Please choose a different subdomain."
            )

        # Check for consecutive hyphens
        if "--" in subdomain:
            raise ValueError(
                "Subdomain cannot contain consecutive hyphens"
            )

        return subdomain


class EmailValidator:
    """Email validation (additional to pydantic's EmailStr)"""

    # Disposable email domains to block (common ones)
    DISPOSABLE_DOMAINS = {
        "tempmail.com", "10minutemail.com", "guerrillamail.com",
        "mailinator.com", "throwaway.email", "temp-mail.org",
        "fakeinbox.com", "trashmail.com", "yopmail.com"
    }

    @classmethod
    def validate(cls, email: str) -> str:
        """
        Validate email address

        Args:
            email: Email address to validate

        Returns:
            str: The validated email (lowercase)

        Raises:
            ValueError: If email is invalid
        """
        # Convert to lowercase
        email = email.lower().strip()

        # Check for disposable email domains (optional - can be disabled)
        domain = email.split("@")[-1] if "@" in email else ""
        if domain in cls.DISPOSABLE_DOMAINS:
            raise ValueError(
                "Disposable email addresses are not allowed. "
                "Please use a permanent email address."
            )

        return email


class NameValidator:
    """Name validation and sanitization"""

    MIN_LENGTH = 1
    MAX_LENGTH = 100

    # Pattern to remove dangerous characters but allow Unicode names
    # Allows letters (any language), spaces, hyphens, apostrophes, periods
    DANGEROUS_CHARS = re.compile(r"[<>\"'&;]")

    @classmethod
    def validate(cls, name: str) -> str:
        """
        Validate and sanitize name

        Args:
            name: Name to validate

        Returns:
            str: The sanitized name

        Raises:
            ValueError: If name is invalid
        """
        # Strip whitespace
        name = name.strip()

        # Check length
        if len(name) < cls.MIN_LENGTH:
            raise ValueError("Name cannot be empty")

        if len(name) > cls.MAX_LENGTH:
            raise ValueError(
                f"Name must not exceed {cls.MAX_LENGTH} characters"
            )

        # Check for dangerous characters
        if cls.DANGEROUS_CHARS.search(name):
            raise ValueError(
                "Name contains invalid characters. "
                "Please remove: < > \" ' & ;"
            )

        return name


class SQLInjectionValidator:
    """SQL injection pattern detection"""

    # Common SQL injection patterns
    SQL_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
        r"(--|\#|\/\*|\*\/)",
        r"(\bOR\b.*=.*)",
        r"(\bAND\b.*=.*)",
        r"(';|\"--|\bEXEC\b|\bEXECUTE\b)",
    ]

    @classmethod
    def check(cls, value: str) -> str:
        """
        Check for SQL injection patterns

        Args:
            value: String to check

        Returns:
            str: The value if safe

        Raises:
            ValueError: If suspicious patterns detected
        """
        value_upper = value.upper()

        for pattern in cls.SQL_PATTERNS:
            if re.search(pattern, value_upper, re.IGNORECASE):
                raise ValueError(
                    "Input contains suspicious patterns and was rejected for security reasons"
                )

        return value


class XSSValidator:
    """XSS (Cross-Site Scripting) pattern detection"""

    # Common XSS patterns
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",  # Event handlers (onclick, onerror, etc.)
        r"<iframe",
        r"<object",
        r"<embed",
    ]

    @classmethod
    def check(cls, value: str) -> str:
        """
        Check for XSS patterns

        Args:
            value: String to check

        Returns:
            str: The value if safe

        Raises:
            ValueError: If XSS patterns detected
        """
        value_lower = value.lower()

        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, value_lower, re.IGNORECASE):
                raise ValueError(
                    "Input contains suspicious HTML/JavaScript patterns and was rejected"
                )

        return value


# Pydantic validator decorators for easy integration

def password_validator(v: str) -> str:
    """Pydantic validator for passwords"""
    return PasswordValidator.validate(v)


def subdomain_validator(v: str) -> str:
    """Pydantic validator for subdomains"""
    return SubdomainValidator.validate(v)


def email_validator(v: str) -> str:
    """Pydantic validator for emails"""
    return EmailValidator.validate(v)


def name_validator(v: str) -> str:
    """Pydantic validator for names"""
    return NameValidator.validate(v)


def sql_injection_check(v: str) -> str:
    """Pydantic validator for SQL injection"""
    return SQLInjectionValidator.check(v)


def xss_check(v: str) -> str:
    """Pydantic validator for XSS"""
    return XSSValidator.check(v)
