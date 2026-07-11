import asyncio
import socket
import time
import unittest
from unittest.mock import patch

try:
    from .security import UnsafeUrlError, _is_public_address, validate_public_url
except ImportError:
    from security import UnsafeUrlError, _is_public_address, validate_public_url


class PublicAddressTests(unittest.TestCase):
    def test_only_globally_routable_addresses_are_allowed(self):
        self.assertTrue(_is_public_address("8.8.8.8"))
        for address in (
            "127.0.0.1",
            "10.0.0.1",
            "169.254.1.1",
            "100.64.0.1",
            "192.0.2.1",
            "::1",
            "fe80::1",
        ):
            with self.subTest(address=address):
                self.assertFalse(_is_public_address(address))


class UrlValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_literal_is_normalized_and_fragment_removed(self):
        result = await validate_public_url("https://8.8.8.8/path?q=1#fragment")
        self.assertEqual(result, "https://8.8.8.8/path?q=1")

    async def test_private_credentials_and_ambiguous_backslashes_are_rejected(self):
        values = (
            "http://127.0.0.1/",
            "https://user:pass@example.com/",
            "https://example.com\\@127.0.0.1/",
            "file:///etc/passwd",
            "https://8.8.8.8:0/product",
            "https://example.com/" + ("a" * 2050),
        )
        for value in values:
            with self.subTest(value=value), self.assertRaises(UnsafeUrlError):
                await validate_public_url(value)

    async def test_any_private_dns_answer_rejects_the_host(self):
        records = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 443)),
        ]
        with patch("socket.getaddrinfo", return_value=records):
            with self.assertRaises(UnsafeUrlError):
                await validate_public_url("https://example.com/product")

    async def test_idn_hostname_is_normalized(self):
        records = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))
        ]
        with patch("socket.getaddrinfo", return_value=records):
            result = await validate_public_url("https://b\u00fccher.example/product")
        self.assertEqual(result, "https://xn--bcher-kva.example/product")

    async def test_dns_resolution_has_a_deadline(self):
        def slow_getaddrinfo(*_args, **_kwargs):
            time.sleep(0.05)
            return []

        module = validate_public_url.__module__
        with (
            patch(f"{module}.DNS_TIMEOUT_SECONDS", 0.001),
            patch(f"{module}.socket.getaddrinfo", side_effect=slow_getaddrinfo),
        ):
            with self.assertRaisesRegex(UnsafeUrlError, "too long"):
                await validate_public_url("https://example.com/product")


if __name__ == "__main__":
    unittest.main()
