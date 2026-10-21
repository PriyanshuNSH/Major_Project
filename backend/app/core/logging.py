"""
HealthSync AI — Structured Logging & Security Scrubbing Filter
"""

import logging
import re
import sys
from typing import Any

# Sensitive patterns to redact in application logs
SENSITIVE_PATTERNS = [
    (re.compile(r'(password["\']?\s*[:=]\s*["\']?)([^"\'\s&]+)(["\']?)', re.IGNORECASE), r'\1[REDACTED]\3'),
    (re.compile(r'(bearer\s+)([a-zA-Z0-9_\-\.]+)', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(token["\']?\s*[:=]\s*["\']?)([^"\'\s&]+)(["\']?)', re.IGNORECASE), r'\1[REDACTED]\3'),
    (re.compile(r'(secret["\']?\s*[:=]\s*["\']?)([^"\'\s&]+)(["\']?)', re.IGNORECASE), r'\1[REDACTED]\3'),
]


class SensitiveDataFilter(logging.Filter):
    """Log filter to scrub passwords, tokens, and secrets from formatted log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.scrub_text(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self.scrub_value(v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self.scrub_value(v) for v in record.args)
        return True

    @classmethod
    def scrub_text(cls, text: str) -> str:
        for pattern, replacement in SENSITIVE_PATTERNS:
            text = pattern.sub(replacement, text)
        return text

    @classmethod
    def scrub_value(cls, val: Any) -> Any:
        if isinstance(val, str):
            return cls.scrub_text(val)
        return val


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configures structured console logging with sensitive data filtering."""
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Avoid duplicate handlers on re-init
    if not root_logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)

        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)
        console_handler.addFilter(SensitiveDataFilter())

        root_logger.addHandler(console_handler)

    app_logger = logging.getLogger("healthsync")
    app_logger.setLevel(numeric_level)
    return app_logger


logger = setup_logging()
