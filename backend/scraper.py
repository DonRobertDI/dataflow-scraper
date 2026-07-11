import asyncio
import contextlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlsplit

from playwright.async_api import (
    Error as PlaywrightError,
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

if __package__:
    from .models import Product, ScrapeResponse
    from .security import UnsafeUrlError, validate_public_url
else:
    from models import Product, ScrapeResponse
    from security import UnsafeUrlError, validate_public_url


NAVIGATION_TIMEOUT_MS = 30_000
SETTLE_TIMEOUT_MS = 8_000
MAX_PRODUCTS = 250
MAX_JSON_LD_DOCUMENTS = 100
MAX_JSON_LD_DOCUMENT_BYTES = 1_000_000
MAX_JSON_LD_TOTAL_BYTES = 2_000_000
MAX_BODY_TEXT_CHARS = 500_000
MAX_PRODUCT_CANDIDATES = 1_000
MAX_PAGE_ORIGINS = 64
MAX_NEW_IMAGE_ORIGINS = 12
IMAGE_VALIDATION_TIMEOUT_SECONDS = 6
SCRAPE_TOTAL_TIMEOUT_SECONDS = 50
SCRAPE_QUEUE_TIMEOUT_SECONDS = 3
logger = logging.getLogger("uvicorn.error")


def _positive_int_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except ValueError:
        logger.warning("Invalid %s value; using %s", name, default)
        return default


MAX_CONCURRENT_SCRAPES = _positive_int_env("MAX_CONCURRENT_SCRAPES", 3)
_SCRAPE_SLOTS = asyncio.Semaphore(MAX_CONCURRENT_SCRAPES)


CURRENCY_CODES = (
    "USD|EUR|GBP|JPY|INR|PHP|CAD|AUD|NZD|HKD|SGD|CNY|KRW|THB|VND|"
    "RUB|TRY|BRL|CHF|SEK|NOK|DKK|PLN|CZK|HUF|ZAR|MXN|AED|SAR|IDR|MYR"
)
CURRENCY_SYMBOL = (
    r"(?:US\$|CA\$|C\$|AU\$|A\$|NZ\$|HK\$|S\$|R\$|"
    r"\u20b1|\$|\u20ac|\u00a3|\u00a5|\u20b9|\u20a9|\u0e3f|"
    r"\u20ab|\u20bd|\u20ba)"
)
CURRENCY_CODE_TOKEN = rf"(?<![A-Z])(?:{CURRENCY_CODES})(?![A-Z])"
CURRENCY_TOKEN = rf"(?:{CURRENCY_CODE_TOKEN}|{CURRENCY_SYMBOL})"
NUMBER_TOKEN = (
    r"(?:\d{1,3}(?:[\s\u00a0,.'\u2019]\d{3})+(?:[.,]\d{1,2})?|"
    r"\d+(?:[.,]\d{1,2})?)"
)
PRICE_PATTERN = re.compile(
    rf"(?:{CURRENCY_TOKEN}\s*{NUMBER_TOKEN}|{NUMBER_TOKEN}\s*{CURRENCY_TOKEN})",
    re.IGNORECASE,
)

IDENTIFIER_PATTERN = re.compile(
    r"\b(?:SKU|UPC|EAN|MPN|ISBN(?:-1[03])?|Product\s+(?:ID|Code)|"
    r"Item\s+(?:ID|Number)|Article\s+number)\s*(?::|#|-)?\s*"
    r"([A-Z0-9][A-Z0-9._/-]{2,})",
    re.IGNORECASE,
)
AVAILABILITY_PATTERN = re.compile(
    r"\b(?:in stock(?:\s*\([^\r\n)]*\))?|out of stock|sold out|"
    r"pre[- ]?order|back[- ]?order(?:ed)?|discontinued|"
    r"only\s+\d+\s+(?:items?\s+)?left(?:\s+in\s+stock)?)\b",
    re.IGNORECASE,
)

CURRENCY_SYMBOLS = (
    ("US$", "USD"),
    ("CA$", "CAD"),
    ("C$", "CAD"),
    ("AU$", "AUD"),
    ("A$", "AUD"),
    ("NZ$", "NZD"),
    ("HK$", "HKD"),
    ("S$", "SGD"),
    ("R$", "BRL"),
    ("\u20b1", "PHP"),
    ("\u20ac", "EUR"),
    ("\u00a3", "GBP"),
    ("\u20b9", "INR"),
    ("\u20a9", "KRW"),
    ("\u0e3f", "THB"),
    ("\u20ab", "VND"),
    ("\u20bd", "RUB"),
    ("\u20ba", "TRY"),
    ("\u00a5", "JPY"),
    ("$", "USD"),
)

AVAILABILITY_VALUES = {
    "instock": "In stock",
    "outofstock": "Out of stock",
    "soldout": "Sold out",
    "preorder": "Pre-order",
    "presale": "Pre-order",
    "backorder": "Back order",
    "limitedavailability": "Limited availability",
    "onlineonly": "Online only",
    "instoreonly": "In store only",
    "discontinued": "Discontinued",
}


class ScrapeTimeoutError(RuntimeError):
    pass


class UnsupportedPageError(RuntimeError):
    pass


class NavigationError(RuntimeError):
    pass


class WebsiteBlockedError(RuntimeError):
    pass


class ScraperUnavailableError(RuntimeError):
    pass


def _text(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, list):
        for item in value:
            result = _text(item)
            if result:
                return result
        return None

    if isinstance(value, dict):
        for key in ("url", "contentUrl", "@id", "@value", "value", "name"):
            result = _text(value.get(key))
            if result:
                return result
        return None

    result = " ".join(str(value).split()).strip()
    return result or None


def _first_present(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value is not None and value != "":
            return value
    return None


def _clean_price(value: str | None) -> str | None:
    if not value:
        return None

    cleaned = " ".join(value.split()).strip()
    match = PRICE_PATTERN.search(cleaned)
    return match.group(0).strip() if match else cleaned or None


def _find_price(value: str | None) -> str | None:
    if not value:
        return None

    match = PRICE_PATTERN.search(" ".join(value.split()))
    return match.group(0).strip() if match else None


def _strict_price(value: str | None) -> str | None:
    cleaned = _text(value)
    if not cleaned:
        return None
    matched = _find_price(cleaned)
    if matched:
        return matched
    return cleaned if re.fullmatch(NUMBER_TOKEN, cleaned) else None


def _infer_currency(value: str | None) -> str | None:
    if not value:
        return None

    upper = value.upper()
    code_match = re.search(rf"\b({CURRENCY_CODES})\b", upper)
    if code_match:
        return code_match.group(1).upper()

    for symbol, code in CURRENCY_SYMBOLS:
        if symbol in value:
            return code
    return None


def _clean_currency(value: str | None) -> str | None:
    if not value:
        return None
    inferred = _infer_currency(value)
    return inferred or _text(value)


def _normalize_availability(value: str | None) -> str | None:
    cleaned = _text(value)
    if not cleaned:
        return None

    token = cleaned.rstrip("/").rsplit("/", 1)[-1].rsplit("#", 1)[-1]
    normalized = re.sub(r"[^a-z]", "", token.lower())
    return AVAILABILITY_VALUES.get(normalized, cleaned)


def _schema_type(value: Any) -> str:
    text = _text(value) or ""
    return text.rstrip("/").rsplit("/", 1)[-1].rsplit("#", 1)[-1].lower()


def _product_nodes(
    value: Any,
    limit: int = MAX_PRODUCT_CANDIDATES + 1,
) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []

    def visit(item: Any) -> None:
        if len(nodes) >= limit:
            return
        if isinstance(item, list):
            for child in item:
                if len(nodes) >= limit:
                    break
                visit(child)
            return

        if not isinstance(item, dict):
            return

        raw_types = item.get("@type", [])
        types = raw_types if isinstance(raw_types, list) else [raw_types]
        if any(_schema_type(node_type) == "product" for node_type in types):
            nodes.append(item)
            for key in ("hasVariant",):
                visit(item.get(key))
            return

        for key in (
            "@graph",
            "mainEntity",
            "mainEntityOfPage",
            "itemListElement",
            "item",
            "hasVariant",
        ):
            if len(nodes) >= limit:
                break
            visit(item.get(key))

    visit(value)
    return nodes


def _offer_values(offers: Any) -> tuple[str | None, str | None, str | None]:
    candidates = offers if isinstance(offers, list) else [offers]
    best: tuple[int, Any, Any, Any] | None = None

    for offer in candidates:
        if not isinstance(offer, dict):
            continue

        price = _first_present(offer, "price", "lowPrice", "highPrice")
        currency = _first_present(offer, "priceCurrency", "currency")
        availability = offer.get("availability")

        specifications = offer.get("priceSpecification")
        if not isinstance(specifications, list):
            specifications = [specifications]
        for specification in specifications:
            if not isinstance(specification, dict):
                continue
            if price is None:
                price = _first_present(
                    specification, "price", "minPrice", "maxPrice"
                )
            if currency is None:
                currency = _first_present(
                    specification, "priceCurrency", "currency"
                )

        score = (
            (4 if price is not None else 0)
            + (2 if currency is not None else 0)
            + (1 if availability is not None else 0)
        )
        if best is None or score > best[0]:
            best = (score, price, currency, availability)

    _score, price, currency, availability = best or (0, None, None, None)
    return (
        _text(price),
        _clean_currency(_text(currency)),
        _normalize_availability(_text(availability)),
    )


def _absolute_url(value: str | None, base_url: str) -> str | None:
    cleaned = _text(value)
    if (
        not cleaned
        or cleaned.startswith(("data:", "blob:"))
        or "\\" in cleaned
        or any(ord(char) < 32 for char in cleaned)
    ):
        return None
    try:
        absolute = urljoin(base_url, cleaned)
        parsed = urlsplit(absolute)
        parsed.port
    except ValueError:
        return None
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        return None
    return absolute if len(absolute) <= 2048 else None


def _bounded(value: str | None, length: int) -> str | None:
    cleaned = _text(value)
    return cleaned[:length] if cleaned else None


def _decode_json_ld(document: str) -> Any:
    cleaned = document.lstrip("\ufeff").strip().rstrip(";").strip()
    if cleaned.startswith("<!--"):
        cleaned = cleaned[4:]
    if cleaned.endswith("-->"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip().rstrip(";").strip()
    return json.loads(cleaned)


def _from_json_ld(documents: list[str], base_url: str = "") -> list[Product]:
    products: list[Product] = []

    for document in documents[:MAX_JSON_LD_DOCUMENTS]:
        if len(products) > MAX_PRODUCT_CANDIDATES:
            break
        if len(document) > MAX_JSON_LD_DOCUMENT_BYTES:
            continue
        try:
            payload = _decode_json_ld(document)
        except (json.JSONDecodeError, TypeError, AttributeError):
            continue

        remaining = MAX_PRODUCT_CANDIDATES + 1 - len(products)
        for node in _product_nodes(payload, remaining):
            name = _text(node.get("name"))
            if not name:
                continue

            price, currency, availability = _offer_values(node.get("offers"))
            if price is None:
                price = _text(_first_present(node, "price", "lowPrice", "highPrice"))
            if currency is None:
                currency = _clean_currency(
                    _text(_first_present(node, "priceCurrency", "currency"))
                )
            if availability is None:
                availability = _normalize_availability(_text(node.get("availability")))

            cleaned_price = _clean_price(price)
            products.append(
                Product(
                    name=_bounded(name, 500),
                    price=_bounded(cleaned_price, 100),
                    currency=_bounded(currency or _infer_currency(cleaned_price), 16),
                    availability=_bounded(availability, 500),
                    sku=_bounded(_text(
                        _first_present(node, "sku", "mpn", "productID", "gtin13", "gtin")
                    ), 200),
                    imageUrl=_absolute_url(_text(node.get("image")), base_url),
                    description=_bounded(_text(node.get("description")), 10_000),
                )
            )
            if len(products) > MAX_PRODUCT_CANDIDATES:
                break

    return products


async def _meta_content(page, selector: str) -> str | None:
    try:
        element = page.locator(selector).first
        if await element.count() == 0:
            return None
        return _text(await element.get_attribute("content"))
    except PlaywrightError:
        return None


async def _first_text(page, selectors: list[str]) -> str | None:
    for selector in selectors:
        try:
            element = page.locator(selector).first
            if await element.count() == 0:
                continue
            value = _text(await element.inner_text(timeout=2_000))
        except PlaywrightError:
            continue
        if value:
            return value
    return None


async def _first_value(
    page,
    selectors: list[str],
    attributes: tuple[str, ...] = (
        "content",
        "value",
        "href",
        "src",
        "data-src",
        "data-price",
        "data-sku",
    ),
) -> str | None:
    for selector in selectors:
        try:
            element = page.locator(selector).first
            if await element.count() == 0:
                continue
            for attribute in attributes:
                value = _text(await element.get_attribute(attribute))
                if value:
                    return value
            value = _text(await element.inner_text(timeout=2_000))
            if value:
                return value
        except PlaywrightError:
            continue
    return None


async def _first_url(
    page,
    selectors: list[str],
    base_url: str,
    attributes: tuple[str, ...] = (
        "data-src",
        "data-lazy-src",
        "data-original",
        "src",
        "content",
        "href",
    ),
) -> str | None:
    for selector in selectors:
        try:
            matches = page.locator(selector)
            count = min(await matches.count(), 5)
            for index in range(count):
                element = matches.nth(index)
                for attribute in attributes:
                    candidate = _absolute_url(
                        _text(await element.get_attribute(attribute)),
                        base_url,
                    )
                    if candidate:
                        return candidate
        except PlaywrightError:
            continue
    return None


async def _page_text(page) -> str:
    try:
        return await page.evaluate(
            "(limit) => (document.body?.innerText || '').slice(0, limit)",
            MAX_BODY_TEXT_CHARS,
        )
    except PlaywrightError:
        return ""


async def _json_ld_documents(page) -> list[str]:
    try:
        return await page.locator('script[type="application/ld+json"]').evaluate_all(
            """
            (elements, limits) => {
                const documents = [];
                let total = 0;
                for (const element of elements.slice(0, limits.count)) {
                    if (total >= limits.totalBytes) break;
                    const raw = (element.textContent || '').slice(0, limits.documentBytes);
                    const document = raw.slice(0, limits.totalBytes - total);
                    total += document.length;
                    if (document) documents.push(document);
                }
                return documents;
            }
            """,
            {
                "count": MAX_JSON_LD_DOCUMENTS,
                "documentBytes": MAX_JSON_LD_DOCUMENT_BYTES,
                "totalBytes": MAX_JSON_LD_TOTAL_BYTES,
            },
        )
    except PlaywrightError:
        return []


async def _label_values(page) -> dict[str, str]:
    try:
        values = await page.evaluate(
            r"""
            () => {
                const result = {};
                const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
                const add = (label, value) => {
                    const key = clean(label).replace(/:\s*$/, '').toLowerCase();
                    const cleanedValue = clean(value);
                    if (key && key.length <= 80 && cleanedValue && cleanedValue.length <= 1000 && !result[key]) {
                        result[key] = cleanedValue;
                    }
                };

                document.querySelectorAll('dl').forEach((list) => {
                    list.querySelectorAll('dt').forEach((term) => {
                        let value = term.nextElementSibling;
                        while (value && value.tagName !== 'DD') value = value.nextElementSibling;
                        if (value) add(term.textContent, value.textContent);
                    });
                });

                document.querySelectorAll('tr').forEach((row) => {
                    const cells = Array.from(row.children).filter((cell) => /^(TH|TD)$/.test(cell.tagName));
                    if (cells.length >= 2) add(cells[0].textContent, cells[1].textContent);
                });

                document.querySelectorAll('[data-testid], [data-sku], [data-product-id]').forEach((element) => {
                    const label = element.getAttribute('data-testid') ||
                        (element.hasAttribute('data-sku') ? 'sku' : 'product id');
                    const value = element.getAttribute('data-sku') ||
                        element.getAttribute('data-product-id') || element.textContent;
                    add(label, value);
                });
                return result;
            }
            """
        )
    except PlaywrightError:
        return {}
    return values if isinstance(values, dict) else {}


def _label_value(labels: dict[str, str], *names: str) -> str | None:
    for name in names:
        value = labels.get(name.lower())
        if value:
            return _text(value)
    return None


def _choose_name(visible_name: str | None, metadata_name: str | None) -> str | None:
    visible = _text(visible_name)
    metadata = _text(metadata_name)
    if not visible:
        return metadata
    if not metadata:
        return visible

    visible_folded = visible.casefold()
    metadata_folded = metadata.casefold()
    if visible_folded in metadata_folded:
        return visible
    if metadata_folded in visible_folded:
        return metadata
    return metadata


def _looks_like_product_url(value: str) -> bool:
    path = urlsplit(value).path.lower().rstrip("/")
    if re.search(r"/(?:products?|items?|p)/[^/]+$", path):
        return True
    return bool(re.search(r"/catalogue/[^/]+(?:_\d+)?(?:/index\.html)?$", path))


async def _page_signals(page) -> dict[str, int]:
    try:
        result = await page.evaluate(
            """
            () => {
                const count = (selector) => document.querySelectorAll(selector).length;
                const actions = Array.from(document.querySelectorAll('button, a, input[type="submit"], input[type="button"]'))
                    .filter((element) => /\b(add to (?:cart|bag|basket)|buy now|purchase)\b/i.test(
                        element.textContent || element.value || element.getAttribute('aria-label') || ''
                    )).length;
                return {
                    productMarkers: count('[itemtype*="schema.org/Product" i], [class*="product-detail" i], [class*="product_detail" i], [class*="product-page" i], [class*="product_page" i], [data-testid*="product-detail" i]'),
                    listingCards: count('article.product_pod, [class*="product-card" i], [class*="product_card" i], [class*="product-item" i], [class*="product_item" i], [data-testid*="product-card" i]'),
                    priceElements: count('[itemprop="price"], [class*="price" i], [data-testid*="price" i], [data-price]'),
                    actions,
                };
            }
            """
        )
    except PlaywrightError:
        return {
            "productMarkers": 0,
            "listingCards": 0,
            "priceElements": 0,
            "actions": 0,
        }
    return result if isinstance(result, dict) else {}


def _extract_identifier(body_text: str, labels: dict[str, str]) -> str | None:
    value = _label_value(
        labels,
        "sku",
        "product id",
        "product code",
        "item id",
        "item number",
        "upc",
        "ean",
        "mpn",
        "isbn",
        "isbn-10",
        "isbn-13",
        "article number",
    )
    if value:
        label_match = IDENTIFIER_PATTERN.search(value)
        return label_match.group(1) if label_match else value

    match = IDENTIFIER_PATTERN.search(body_text)
    return match.group(1).strip() if match else None


def _clean_identifier(value: str | None) -> str | None:
    cleaned = _text(value)
    if not cleaned:
        return None
    labeled = IDENTIFIER_PATTERN.search(cleaned)
    if labeled:
        return labeled.group(1).strip()
    if re.fullmatch(r"[A-Z0-9][A-Z0-9._/-]{2,}", cleaned, re.IGNORECASE) and any(
        char.isdigit() for char in cleaned
    ):
        return cleaned
    return None


def _extract_availability(body_text: str, labels: dict[str, str]) -> str | None:
    value = _label_value(
        labels,
        "availability",
        "stock",
        "stock status",
        "inventory",
    )
    if value:
        return _normalize_availability(value)
    match = AVAILABILITY_PATTERN.search(body_text)
    return _normalize_availability(match.group(0)) if match else None


async def _fallback_product(page) -> tuple[Product | None, str | None]:
    og_type = await _meta_content(page, 'meta[property="og:type"]')
    metadata_name = (
        await _meta_content(page, 'meta[property="og:title"]')
        or await _meta_content(page, 'meta[name="title"]')
        or await _meta_content(page, 'meta[name="twitter:title"]')
    )
    specific_name = await _first_text(
        page,
        [
            '[data-testid="product-title"]',
            '[data-testid*="product-title" i]',
            '[itemprop="name"]',
            '[class*="product-title" i]',
            '[class*="product_name" i]',
            '[class*="product-name" i]',
            '.product_page h1',
            '[class*="product-detail" i] h1',
            '[class*="product-detail" i] h2',
        ],
    )
    heading_name = await _first_text(
        page,
        [
            'main h1',
            'article h1',
            'h1',
            'main h2',
            'article h2',
            'h2',
        ],
    )
    visible_name = specific_name or heading_name
    name = specific_name or _choose_name(heading_name, metadata_name)

    twitter_price = None
    twitter_price_label = await _meta_content(page, 'meta[name="twitter:label1"]')
    if twitter_price_label and "price" in twitter_price_label.casefold():
        twitter_price = await _meta_content(page, 'meta[name="twitter:data1"]')

    price = (
        await _meta_content(page, 'meta[property="product:price:amount"]')
        or await _meta_content(page, 'meta[property="og:price:amount"]')
        or await _meta_content(page, 'meta[property="og:price"]')
        or await _meta_content(page, 'meta[itemprop="price"]')
        or await _meta_content(page, 'meta[name="price"]')
        or twitter_price
    )
    if not price:
        price = await _first_value(
            page,
            [
                '[itemprop="price"]',
                '[data-testid*="price" i]',
                '[data-price]',
                '[aria-label*="price" i]',
                '[class*="product-price" i]',
                '[class*="sale-price" i]',
                '.price_color',
                '.pip-price',
                '[class*="price" i]',
            ],
        )

    body_text = await _page_text(page)
    labels = await _label_values(page)
    price = _strict_price(price) or _find_price(
        _label_value(labels, "price", "sale price", "current price", "price (incl. tax)")
    )
    if not price:
        price = _find_price(body_text)

    visible_identifier = await _first_value(
        page,
        [
            '[itemprop="sku"]',
            '[data-testid*="sku" i]',
            '[data-sku]',
            '[class*="product-sku" i]',
            '[class*="product-code" i]',
            '.sku',
            '.eyebrow',
        ],
        ("content", "value", "data-sku", "data-product-id"),
    )
    sku = _clean_identifier(visible_identifier) or _extract_identifier(
        body_text, labels
    )
    availability = (
        await _first_value(
            page,
            [
                'meta[property="product:availability"]',
                'meta[property="og:availability"]',
                '[itemprop="availability"]',
                '[data-testid*="availability" i]',
                '[data-testid*="stock" i]',
                '.availability',
                '[class*="stock-status" i]',
            ],
        )
        or _extract_availability(body_text, labels)
    )
    availability = _normalize_availability(availability)

    currency = _clean_currency(
        await _first_value(
            page,
            [
                'meta[property="product:price:currency"]',
                'meta[property="og:price:currency"]',
                'meta[property="og:currency"]',
                '[itemprop="priceCurrency"]',
                '[data-currency]',
                '[data-currency-code]',
            ],
        )
        or _label_value(labels, "currency", "price currency")
    ) or _infer_currency(price)

    description = (
        await _first_text(
            page,
            [
                '[itemprop="description"]',
                '[class*="product-description" i]',
                '#product_description + p',
                '.lede',
            ],
        )
        or await _meta_content(page, 'meta[property="og:description"]')
        or await _meta_content(page, 'meta[name="description"]')
        or await _meta_content(page, 'meta[name="twitter:description"]')
    )

    visible_image = await _first_url(
        page,
        [
            'img[itemprop="image"]',
            'img[class*="product-image" i]',
            'img[class*="product_image" i]',
            '[class*="product-image" i] img',
            '[class*="product_image" i] img',
            '.product_page img',
            'main img[alt*="product" i]',
            'main img',
        ],
        page.url,
    )
    metadata_image = (
        await _meta_content(page, 'meta[property="og:image"]')
        or await _meta_content(page, 'meta[name="twitter:image"]')
    )
    image_url = visible_image or _absolute_url(metadata_image, page.url)

    signals = await _page_signals(page)
    product_path = _looks_like_product_url(page.url)
    metadata_product = _schema_type(og_type) == "product" or bool(
        await _meta_content(page, 'meta[property="product:price:amount"]')
    )
    single_product_marker = (
        signals.get("productMarkers", 0) == 1
        and signals.get("listingCards", 0) <= 1
    )
    listing_likely = (
        signals.get("listingCards", 0) > 1
        or signals.get("priceElements", 0) > 5
        or signals.get("actions", 0) > 5
    )
    supporting_signal = bool(
        sku
        or availability
        or signals.get("actions", 0) == 1
        or single_product_marker
    )
    is_product_page = bool(
        name
        and price
        and (
            metadata_product
            or single_product_marker
            or product_path
            or (supporting_signal and not listing_likely)
        )
    )

    if not is_product_page:
        return None, None

    source = (
        "visible product markup"
        if visible_name and name == visible_name
        else "Open Graph metadata"
    )
    return (
        Product(
            name=_bounded(name, 500),
            price=_bounded(price, 100),
            currency=_bounded(currency, 16),
            availability=_bounded(availability, 500),
            sku=_bounded(sku, 200),
            imageUrl=image_url,
            description=_bounded(description, 10_000),
        ),
        source,
    )


def _merge_product(primary: Product, supplement: Product) -> tuple[Product, list[str]]:
    values = primary.model_dump()
    supplement_values = supplement.model_dump()
    filled: list[str] = []
    for field in (
        "price",
        "currency",
        "availability",
        "sku",
        "imageUrl",
        "description",
    ):
        if not values.get(field) and supplement_values.get(field):
            values[field] = supplement_values[field]
            filled.append(field)
    return Product(**values), filled


def _deduplicate(products: list[Product]) -> list[Product]:
    unique: list[Product] = []
    by_sku: dict[tuple[str, str], int] = {}
    generic_by_name_price: dict[tuple[str, str, str], int] = {}
    generic_by_name_price_loose: dict[tuple[str, str], list[int]] = {}
    first_by_name_price: dict[tuple[str, str, str], int] = {}

    def compatible(first: Product, second: Product) -> bool:
        if first.name.casefold() != second.name.casefold():
            return False
        for field in ("price", "currency", "sku"):
            first_value = getattr(first, field)
            second_value = getattr(second, field)
            if (
                first_value
                and second_value
                and first_value.casefold() != second_value.casefold()
            ):
                return False
        return True

    def register(index: int, product: Product) -> None:
        name = product.name.casefold()
        price = (product.price or "").casefold()
        currency = (product.currency or "").casefold()
        loose_key = (name, price, currency)
        first_by_name_price.setdefault(loose_key, index)
        if product.sku:
            by_sku.setdefault((name, product.sku.casefold()), index)
        else:
            generic_by_name_price.setdefault(loose_key, index)
            loose_currency_key = (name, price)
            indexes = generic_by_name_price_loose.setdefault(
                loose_currency_key, []
            )
            if index not in indexes:
                indexes.append(index)

    for product in products:
        name = product.name.casefold()
        price = (product.price or "").casefold()
        currency = (product.currency or "").casefold()
        loose_key = (name, price, currency)
        candidates: list[int | None] = []
        if product.sku:
            candidates.append(by_sku.get((name, product.sku.casefold())))
        candidates.append(generic_by_name_price.get(loose_key))
        candidates.extend(generic_by_name_price_loose.get((name, price), []))
        if not product.sku:
            candidates.append(first_by_name_price.get(loose_key))

        match_index = next(
            (
                index
                for index in candidates
                if index is not None and compatible(unique[index], product)
            ),
            None,
        )

        if match_index is None:
            unique.append(product)
            register(len(unique) - 1, product)
        else:
            unique[match_index], _filled = _merge_product(
                unique[match_index], product
            )
            register(match_index, unique[match_index])
    return unique


def _looks_like_block_page(page_title: str, body_text: str) -> bool:
    markers = (
        "access denied",
        "verify you are human",
        "are you a human",
        "unusual traffic",
        "request blocked",
        "checking your browser",
        "attention required",
    )
    title = page_title.casefold()
    if any(marker in title for marker in markers):
        return True
    if re.match(
        r"^\s*(?:captcha(?:\s+(?:challenge|required|verification))?|human verification)\s*(?:[|:-]|$)",
        title,
    ):
        return True
    body = body_text[:20_000].casefold()
    return len(body_text) < 40_000 and any(
        marker in body for marker in (*markers, "captcha")
    )


async def _sanitize_product_urls(
    products: list[Product],
    validations: dict[tuple[str, str, int | None], Any],
) -> int:
    blocked = 0
    new_origins: set[tuple[str, str, int | None]] = set()
    checks: list[tuple[int, Product, asyncio.Task, bool]] = []
    for index, product in enumerate(products):
        if not product.imageUrl:
            continue
        parsed = urlsplit(product.imageUrl)
        origin = (parsed.scheme, parsed.hostname or "", parsed.port)
        task = validations.get(origin)
        is_new_validation = task is None
        if task is None:
            if len(new_origins) >= MAX_NEW_IMAGE_ORIGINS:
                products[index] = product.model_copy(update={"imageUrl": None})
                blocked += 1
                continue
            task = asyncio.create_task(validate_public_url(product.imageUrl))
            validations[origin] = task
            new_origins.add(origin)
        checks.append((index, product, task, is_new_validation))

    if not checks:
        return blocked

    tasks = {check[2] for check in checks}
    done, pending = await asyncio.wait(
        tasks,
        timeout=IMAGE_VALIDATION_TIMEOUT_SECONDS,
    )
    for task in pending:
        task.cancel()

    for index, product, task, is_new_validation in checks:
        normalized = None
        if task in done:
            try:
                validated_url = task.result()
                normalized = validated_url if is_new_validation else product.imageUrl
            except (UnsafeUrlError, asyncio.CancelledError):
                pass
            except Exception:
                logger.debug("Product image URL validation failed", exc_info=True)
        if normalized is None:
            blocked += 1
        products[index] = product.model_copy(update={"imageUrl": normalized})
    return blocked


async def _scrape_products(url: str) -> ScrapeResponse:
    started = time.perf_counter()
    warnings: list[str] = []
    browser = None
    context = None
    page = None
    blocked_navigation: list[str] = []
    blocked_resources: list[str] = []
    validated_origins: dict[tuple[str, str, int | None], asyncio.Task] = {}
    popup_tasks: set[asyncio.Task] = set()

    try:
        async with async_playwright() as playwright:
            try:
                browser = await playwright.chromium.launch(headless=True)
                context = await browser.new_context(
                    viewport={"width": 1366, "height": 768},
                    locale="en-US",
                    extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
                    service_workers="block",
                )
            except PlaywrightError as exc:
                raise ScraperUnavailableError(
                    "The extraction browser could not be started. Install Chromium and try again."
                ) from exc

            def remember_blocked(
                target_url: str,
                is_navigation: bool,
                resource_type: str,
            ) -> None:
                blocked = blocked_navigation if is_navigation else blocked_resources
                if len(blocked) >= 20:
                    return
                blocked.append(target_url)
                logger.warning(
                    "Blocked unsafe browser request requested_url=%s target_url=%s resource_type=%s",
                    url,
                    target_url,
                    resource_type,
                )

            async def protect_request(route, request) -> None:
                try:
                    parsed = urlsplit(request.url)
                    port = parsed.port
                except ValueError:
                    remember_blocked(
                        request.url,
                        request.is_navigation_request(),
                        request.resource_type,
                    )
                    await route.abort("blockedbyclient")
                    return
                if parsed.scheme in {"data", "blob", "about"}:
                    if request.is_navigation_request():
                        remember_blocked(request.url, True, request.resource_type)
                        await route.abort("blockedbyclient")
                        return
                    await route.continue_()
                    return
                if parsed.scheme not in {"http", "https"}:
                    remember_blocked(
                        request.url,
                        request.is_navigation_request(),
                        request.resource_type,
                    )
                    await route.abort("blockedbyclient")
                    return

                origin = (parsed.scheme, parsed.hostname or "", port)
                task = validated_origins.get(origin)
                if task is None:
                    if len(validated_origins) >= MAX_PAGE_ORIGINS:
                        remember_blocked(
                            request.url,
                            request.is_navigation_request(),
                            request.resource_type,
                        )
                        await route.abort("blockedbyclient")
                        return
                    task = asyncio.create_task(validate_public_url(request.url))
                    validated_origins[origin] = task
                try:
                    await task
                except UnsafeUrlError:
                    remember_blocked(
                        request.url,
                        request.is_navigation_request(),
                        request.resource_type,
                    )
                    await route.abort("blockedbyclient")
                    return

                await route.continue_()

            async def protect_web_socket(web_socket_route) -> None:
                try:
                    parsed = urlsplit(web_socket_route.url)
                    port = parsed.port
                except ValueError:
                    remember_blocked(web_socket_route.url, False, "websocket")
                    await web_socket_route.close(
                        code=1008,
                        reason="Invalid WebSocket destination",
                    )
                    return
                if parsed.scheme not in {"ws", "wss"}:
                    await web_socket_route.close(
                        code=1008,
                        reason="Unsupported WebSocket destination",
                    )
                    return
                validation_scheme = "https" if parsed.scheme == "wss" else "http"
                validation_url = parsed._replace(scheme=validation_scheme).geturl()
                origin = (
                    validation_scheme,
                    parsed.hostname or "",
                    port,
                )
                task = validated_origins.get(origin)
                if task is None:
                    if len(validated_origins) >= MAX_PAGE_ORIGINS:
                        remember_blocked(web_socket_route.url, False, "websocket")
                        await web_socket_route.close(
                            code=1008,
                            reason="Too many external destinations",
                        )
                        return
                    task = asyncio.create_task(validate_public_url(validation_url))
                    validated_origins[origin] = task
                try:
                    await task
                except UnsafeUrlError:
                    remember_blocked(web_socket_route.url, False, "websocket")
                    await web_socket_route.close(
                        code=1008,
                        reason="Unsafe WebSocket destination",
                    )
                    return
                web_socket_route.connect_to_server()

            try:
                await context.route("**/*", protect_request)
                await context.route_web_socket("**/*", protect_web_socket)
                page = await context.new_page()
            except PlaywrightError as exc:
                raise ScraperUnavailableError(
                    "The extraction browser could not create an isolated page."
                ) from exc

            async def close_popup(popup) -> None:
                if popup is not page:
                    with contextlib.suppress(PlaywrightError):
                        await popup.close()

            def schedule_popup_close(popup) -> None:
                task = asyncio.create_task(close_popup(popup))
                popup_tasks.add(task)
                task.add_done_callback(popup_tasks.discard)

            context.on("page", schedule_popup_close)
            response = await page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=NAVIGATION_TIMEOUT_MS,
            )

            try:
                await page.wait_for_load_state("networkidle", timeout=SETTLE_TIMEOUT_MS)
            except PlaywrightError:
                pass

            if blocked_navigation:
                raise NavigationError("The page redirected to an unsafe URL.")
            if blocked_resources:
                warnings.append(
                    "One or more unsafe or unresolvable page resources were blocked."
                )
            if response is None:
                raise NavigationError("The page did not return a response.")

            logger.info(
                "Navigation completed requested_url=%s final_url=%s status=%s",
                url,
                page.url,
                response.status,
            )
            if response.status in {401, 403, 407, 429}:
                raise WebsiteBlockedError(
                    f"The website blocked the request with HTTP {response.status}."
                )
            if response.status >= 400:
                raise NavigationError(
                    f"The source page returned HTTP {response.status}."
                )

            content_type = response.headers.get("content-type", "").lower()
            if content_type and not any(
                supported in content_type
                for supported in ("text/html", "application/xhtml+xml")
            ):
                raise UnsupportedPageError(
                    "The URL did not return an HTML product page."
                )

            source_url = await validate_public_url(page.url)
            page_title = (await page.title()).strip()
            documents = await _json_ld_documents(page)
            candidates = _from_json_ld(documents, source_url)
            candidate_limit_reached = len(candidates) > MAX_PRODUCT_CANDIDATES
            products = _deduplicate(candidates[:MAX_PRODUCT_CANDIDATES])

            fallback = None
            fallback_source = None
            if len(products) <= 1:
                fallback, fallback_source = await _fallback_product(page)
            if products and len(products) == 1 and fallback:
                products[0], filled = _merge_product(products[0], fallback)
                if filled:
                    warnings.append(
                        "Filled missing "
                        + ", ".join(filled)
                        + f" from {fallback_source}."
                    )
            elif not products and fallback:
                products = [fallback]
                warnings.append(
                    f"No JSON-LD Product schema was found; used {fallback_source}."
                )

            products = _deduplicate(products)
            truncated = len(products) > MAX_PRODUCTS
            products = products[:MAX_PRODUCTS]
            if not products:
                body_text = await _page_text(page)
                if _looks_like_block_page(page_title, body_text):
                    raise WebsiteBlockedError(
                        "The website displayed an access check instead of product data."
                    )
                raise UnsupportedPageError(
                    "No supported product data was found. Use an individual product-detail URL rather than a catalog, search, or home page."
                )

            blocked_product_urls = await _sanitize_product_urls(
                products, validated_origins
            )
            if blocked_product_urls:
                warnings.append(
                    "One or more unsafe product image URLs were removed."
                )

            if any(product.price is None for product in products):
                warnings.append("One or more products did not include a price.")
            if truncated:
                warnings.append(
                    f"Results were limited to the first {MAX_PRODUCTS} products."
                )
            if candidate_limit_reached:
                warnings.append(
                    f"Structured product candidates were capped at {MAX_PRODUCT_CANDIDATES}."
                )

            return ScrapeResponse(
                pageTitle=(page_title or products[0].name)[:1000],
                sourceUrl=source_url,
                extractedAt=datetime.now(timezone.utc).isoformat(),
                duration=round(time.perf_counter() - started, 3),
                products=products,
                warnings=warnings,
                status="success",
            )

    except PlaywrightTimeoutError as exc:
        logger.warning(
            "Navigation timed out requested_url=%s final_url=%s error=%s",
            url,
            page.url if page else "about:blank",
            exc,
        )
        raise ScrapeTimeoutError(
            "The page took too long to respond. Please try again."
        ) from exc
    except (
        UnsafeUrlError,
        UnsupportedPageError,
        NavigationError,
        WebsiteBlockedError,
        ScraperUnavailableError,
    ):
        raise
    except PlaywrightError as exc:
        logger.warning(
            "Playwright navigation failed requested_url=%s final_url=%s error=%s",
            url,
            page.url if page else "about:blank",
            exc,
        )
        error_text = str(exc).lower()
        if blocked_navigation:
            raise NavigationError("The page redirected to an unsafe URL.") from exc
        if any(
            marker in error_text
            for marker in (
                "err_access_denied",
                "err_blocked_by_client",
                "err_too_many_redirects",
            )
        ):
            raise WebsiteBlockedError(
                "The website blocked or refused automated access."
            ) from exc
        raise NavigationError("The page could not be loaded or inspected.") from exc
    finally:
        cleanup_tasks = set(validated_origins.values()) | popup_tasks
        for task in cleanup_tasks:
            if not task.done():
                task.cancel()
        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)


async def scrape_products(url: str) -> ScrapeResponse:
    try:
        await asyncio.wait_for(
            _SCRAPE_SLOTS.acquire(),
            timeout=SCRAPE_QUEUE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise ScraperUnavailableError(
            "The extraction service is busy. Please try again shortly."
        ) from exc

    try:
        normalized_url = await validate_public_url(url)
        try:
            return await asyncio.wait_for(
                _scrape_products(normalized_url),
                timeout=SCRAPE_TOTAL_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise ScrapeTimeoutError(
                "The extraction exceeded its total time limit. Please try again."
            ) from exc
    finally:
        _SCRAPE_SLOTS.release()
