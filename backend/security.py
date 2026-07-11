import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import ipaddress
import logging
import socket
import threading
from urllib.parse import urlsplit, urlunsplit


DNS_TIMEOUT_SECONDS = 5
MAX_URL_LENGTH = 2048
MAX_CONCURRENT_DNS_LOOKUPS = 12

_DNS_EXECUTOR = ThreadPoolExecutor(
    max_workers=MAX_CONCURRENT_DNS_LOOKUPS,
    thread_name_prefix="dataflow-dns",
)
_DNS_SUBMISSION_SLOTS = threading.BoundedSemaphore(
    MAX_CONCURRENT_DNS_LOOKUPS * 2
)


class UnsafeUrlError(ValueError):
    pass


logger = logging.getLogger("uvicorn.error")


def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


async def validate_public_url(value: str) -> str:
    candidate = value.strip()
    if (
        not candidate
        or len(candidate) > MAX_URL_LENGTH
        or any(ord(char) < 32 for char in candidate)
    ):
        raise UnsafeUrlError("The URL is invalid.")
    if "\\" in candidate:
        raise UnsafeUrlError("Backslashes are not allowed in URLs.")

    try:
        parsed = urlsplit(candidate)
    except ValueError as exc:
        raise UnsafeUrlError("The URL is invalid.") from exc

    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("Only HTTP and HTTPS URLs are supported.")
    if not parsed.hostname:
        raise UnsafeUrlError("The URL must include a valid hostname.")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("URLs containing credentials are not supported.")
    try:
        port = parsed.port
    except ValueError as exc:
        raise UnsafeUrlError("The URL contains an invalid port.") from exc
    if port == 0:
        raise UnsafeUrlError("Port 0 is not supported.")

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise UnsafeUrlError("Local and private network URLs are not allowed.")

    try:
        literal_address = ipaddress.ip_address(hostname)
    except ValueError:
        literal_address = None

    if literal_address is not None:
        if not _is_public_address(str(literal_address)):
            raise UnsafeUrlError("Local and private network URLs are not allowed.")
        normalized_hostname = literal_address.compressed
        addresses = {normalized_hostname}
    else:
        try:
            normalized_hostname = hostname.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise UnsafeUrlError("The URL hostname is invalid.") from exc

        loop = asyncio.get_running_loop()
        if not _DNS_SUBMISSION_SLOTS.acquire(blocking=False):
            raise UnsafeUrlError("DNS validation is busy. Please try again.")
        try:
            concurrent_lookup = _DNS_EXECUTOR.submit(
                partial(
                    socket.getaddrinfo,
                    normalized_hostname,
                    port
                    if port is not None
                    else (443 if parsed.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            )
        except Exception:
            _DNS_SUBMISSION_SLOTS.release()
            raise
        concurrent_lookup.add_done_callback(
            lambda _future: _DNS_SUBMISSION_SLOTS.release()
        )
        lookup = asyncio.wrap_future(concurrent_lookup, loop=loop)
        try:
            records = await asyncio.wait_for(
                asyncio.shield(lookup),
                timeout=DNS_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise UnsafeUrlError("The URL hostname took too long to resolve.") from exc
        except socket.gaierror as exc:
            raise UnsafeUrlError("The URL hostname could not be resolved.") from exc

        addresses = {record[4][0] for record in records}
        if not addresses or any(
            not _is_public_address(address) for address in addresses
        ):
            raise UnsafeUrlError("Local and private network URLs are not allowed.")

    netloc = (
        f"[{normalized_hostname}]"
        if ":" in normalized_hostname
        else normalized_hostname
    )
    if port is not None:
        netloc = f"{netloc}:{port}"
    normalized_url = urlunsplit(
        (parsed.scheme, netloc, parsed.path or "/", parsed.query, "")
    )
    if len(normalized_url) > MAX_URL_LENGTH:
        raise UnsafeUrlError("The URL is too long.")
    logger.debug(
        "URL validation passed hostname=%s resolved_addresses=%s",
        hostname,
        sorted(addresses),
    )
    return normalized_url
