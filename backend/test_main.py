import json
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError

try:
    from .main import health, scrape_data, validation_error_handler
    from .models import Product, ScrapeRequest, ScrapeResponse
    from .scraper import ScraperUnavailableError
except ImportError:
    from main import health, scrape_data, validation_error_handler
    from models import Product, ScrapeRequest, ScrapeResponse
    from scraper import ScraperUnavailableError


class ApiContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.module = scrape_data.__module__

    async def test_health_contract(self):
        response = await health()
        self.assertEqual(
            response.model_dump(),
            {"status": "ok", "service": "dataflow-scraper"},
        )

    async def test_validation_errors_use_the_standard_error_shape(self):
        error = RequestValidationError(
            [
                {
                    "type": "string_too_short",
                    "loc": ("body", "url"),
                    "msg": "String should have at least 8 characters",
                    "input": "short",
                    "ctx": {"min_length": 8},
                }
            ]
        )
        response = await validation_error_handler(None, error)
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(payload["detail"]["code"], "invalid_request")
        self.assertTrue(payload["detail"]["message"])

    async def test_unsafe_urls_use_the_standard_error_shape(self):
        with self.assertRaises(HTTPException) as raised:
            await scrape_data(ScrapeRequest(url="http://127.0.0.1/product"))
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail["code"], "invalid_url")

    async def test_success_response_is_forwarded(self):
        result = ScrapeResponse(
            pageTitle="Fixture",
            sourceUrl="https://example.com/product/1",
            extractedAt=datetime.now(timezone.utc).isoformat(),
            duration=0.1,
            products=[Product(name="Fixture", price="1.00", currency="USD")],
            warnings=[],
            status="success",
        )
        with (
            patch(
                f"{self.module}.scrape_products",
                new=AsyncMock(return_value=result),
            ),
        ):
            response = await scrape_data(ScrapeRequest(url=result.sourceUrl))
        self.assertEqual(response.products[0].name, "Fixture")

    async def test_browser_startup_failure_is_a_stable_503(self):
        with (
            patch(
                f"{self.module}.scrape_products",
                new=AsyncMock(side_effect=ScraperUnavailableError("Browser unavailable")),
            ),
        ):
            with self.assertRaises(HTTPException) as raised:
                await scrape_data(
                    ScrapeRequest(url="https://example.com/product/1")
                )
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(raised.exception.detail["code"], "service_unavailable")


if __name__ == "__main__":
    unittest.main()
