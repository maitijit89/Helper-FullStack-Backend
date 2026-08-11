import socket
import pytest
from unittest.mock import MagicMock, patch

from app.services.email_service import EmailService, IPv4FallbackSMTP, _create_connection_ipv4_fallback


def test_create_connection_ipv4_fallback_success():
    """Test that when socket.create_connection succeeds, it returns the socket directly."""
    mock_sock = MagicMock()
    with patch("socket.create_connection", return_value=mock_sock):
        sock = _create_connection_ipv4_fallback(("smtp.gmail.com", 587), timeout=15)
        assert sock == mock_sock


def test_create_connection_ipv4_fallback_on_network_unreachable():
    """Test that when socket.create_connection fails with OSError 101, IPv4 fallback is attempted."""
    mock_ipv4_sock = MagicMock()

    def mock_create_conn(address, timeout=None, source_address=None):
        raise OSError(101, "Network is unreachable")

    def mock_getaddrinfo(host, port, family, socktype):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("142.250.0.1", 587))]

    with patch("socket.create_connection", side_effect=mock_create_conn), \
         patch("socket.getaddrinfo", side_effect=mock_getaddrinfo), \
         patch("socket.socket", return_value=mock_ipv4_sock):
        
        sock = _create_connection_ipv4_fallback(("smtp.gmail.com", 587), timeout=15)
        assert sock == mock_ipv4_sock
        mock_ipv4_sock.connect.assert_called_once_with(("142.250.0.1", 587))


@pytest.mark.asyncio
async def test_email_service_send_email_success():
    """Test email_service.send_email returns True on success."""
    service = EmailService()
    
    mock_server = MagicMock()
    with patch("app.services.email_service.IPv4FallbackSMTP") as mock_smtp, \
         patch("app.core.config.settings.SMTP_USER", "test@gmail.com"), \
         patch("app.core.config.settings.SMTP_PASSWORD", "secret"):
        
        mock_smtp.return_value.__enter__.return_value = mock_server
        result = await service.send_email("user@example.com", "Test Subject", "<p>Hello</p>")
        
        assert result is True
        mock_server.login.assert_called_once()
        mock_server.sendmail.assert_called_once()


@pytest.mark.asyncio
async def test_email_service_send_email_failure_graceful():
    """Test email_service.send_email catches SMTP exceptions gracefully and returns False."""
    service = EmailService()

    with patch("app.services.email_service.IPv4FallbackSMTP", side_effect=OSError(101, "Network is unreachable")), \
         patch("app.core.config.settings.SMTP_USER", "test@gmail.com"), \
         patch("app.core.config.settings.SMTP_PASSWORD", "secret"):
        
        result = await service.send_email("user@example.com", "Test Subject", "<p>Hello</p>")
        assert result is False
