import json
import unittest
from unittest.mock import AsyncMock, patch

try:
    from .models import Product
    from .scraper import (
        _choose_name,
        _absolute_url,
        _clean_price,
        _deduplicate,
        _find_price,
        _from_json_ld,
        _infer_currency,
        _looks_like_block_page,
        _looks_like_product_url,
        _normalize_availability,
        _offer_values,
        _product_nodes,
        _sanitize_product_urls,
        _strict_price,
    )
except ImportError:
    from models import Product
    from scraper import (
        _choose_name,
        _absolute_url,
        _clean_price,
        _deduplicate,
        _find_price,
        _from_json_ld,
        _infer_currency,
        _looks_like_block_page,
        _looks_like_product_url,
        _normalize_availability,
        _offer_values,
        _product_nodes,
        _sanitize_product_urls,
        _strict_price,
    )


class PriceParsingTests(unittest.TestCase):
    def test_body_text_without_a_price_is_not_returned_as_a_price(self):
        body = "About our company Contact us Add to cartography newsletter"
        self.assertIsNone(_find_price(body))

    def test_body_text_extracts_a_supported_currency_price(self):
        body = "Wireless mouse In stock Special price $24.99 Add to cart"
        self.assertEqual(_find_price(body), "$24.99")

    def test_explicit_metadata_price_remains_supported_without_a_symbol(self):
        self.assertEqual(_clean_price("24.99"), "24.99")

    def test_european_price_keeps_decimal_and_thousands_separators(self):
        self.assertEqual(_find_price("Price: \u20ac 1.234,56"), "\u20ac 1.234,56")
        self.assertEqual(_find_price("Price: 91,99 \u20ac"), "91,99 \u20ac")

    def test_currency_codes_and_prefixed_dollar_symbols_are_supported(self):
        canadian_price = "C" + "$" + "42.50"
        self.assertEqual(_find_price(f"Price {canadian_price}"), canadian_price)
        self.assertEqual(_find_price("Price AUD 42.50"), "AUD 42.50")
        self.assertEqual(_find_price("Price CHF 12.00"), "CHF 12.00")
        self.assertEqual(_infer_currency(canadian_price), "CAD")

    def test_currency_codes_do_not_match_inside_words(self):
        self.assertIsNone(_find_price("Fraud 42.50 detection"))

    def test_unmatched_metadata_text_is_not_accepted_as_a_price(self):
        self.assertIsNone(_strict_price("4 min read"))
        self.assertIsNone(_strict_price("Rating: 4.8"))
        self.assertEqual(_strict_price("0"), "0")


class StructuredDataTests(unittest.TestCase):
    def test_recurses_through_main_entity_and_schema_url_type(self):
        payload = {
            "@type": "WebPage",
            "mainEntity": {
                "@type": "https://schema.org/Product",
                "name": "Nested product",
            },
        }
        nodes = _product_nodes(payload)
        self.assertEqual([node["name"] for node in nodes], ["Nested product"])

    def test_offer_fields_are_selected_from_one_coherent_offer(self):
        offers = [
            {"@type": "Offer", "availability": "OutOfStock"},
            {"@type": "Offer", "price": 0, "priceCurrency": "USD"},
        ]
        self.assertEqual(_offer_values(offers), ("0", "USD", None))

    def test_price_specification_is_supported(self):
        offer = {
            "@type": "Offer",
            "priceSpecification": {
                "@type": "UnitPriceSpecification",
                "price": "19.95",
                "priceCurrency": "EUR",
            },
            "availability": "https://schema.org/InStock",
        }
        self.assertEqual(_offer_values(offer), ("19.95", "EUR", "In stock"))

    def test_product_fields_are_normalized_and_relative_image_is_resolved(self):
        document = json.dumps(
            {
                "@type": "WebPage",
                "mainEntity": {
                    "@type": "https://schema.org/Product",
                    "name": "Fixture product",
                    "sku": "FIX-1",
                    "image": {"url": "/images/product.png"},
                    "offers": {
                        "price": "9.99",
                        "priceCurrency": "usd",
                        "availability": "https://schema.org/InStock",
                    },
                },
            }
        )
        products = _from_json_ld([document], "https://shop.example/product/1")
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0].currency, "USD")
        self.assertEqual(products[0].availability, "In stock")
        self.assertEqual(products[0].imageUrl, "https://shop.example/images/product.png")

    def test_html_comment_wrapped_json_ld_is_supported(self):
        document = '<!-- {"@type":"Product","name":"Wrapped"} -->;'
        self.assertEqual(_from_json_ld([document])[0].name, "Wrapped")

    def test_review_item_reviewed_is_not_treated_as_page_product(self):
        payload = {
            "@type": "Review",
            "itemReviewed": {"@type": "Product", "name": "Related product"},
        }
        self.assertEqual(_product_nodes(payload), [])

    def test_product_candidate_walk_stops_at_its_limit(self):
        payload = [
            {"@type": "Product", "name": f"Product {index}"}
            for index in range(1200)
        ]
        self.assertEqual(len(_product_nodes(payload, limit=1001)), 1001)


class ProductNormalizationTests(unittest.TestCase):
    def test_availability_schema_values_are_human_readable(self):
        self.assertEqual(
            _normalize_availability("https://schema.org/OutOfStock"),
            "Out of stock",
        )

    def test_visible_heading_removes_site_suffix_from_metadata_title(self):
        self.assertEqual(
            _choose_name(
                "Exact Product",
                "Exact Product | Example Scraping Sandbox",
            ),
            "Exact Product",
        )

    def test_unrelated_section_heading_does_not_replace_metadata_name(self):
        self.assertEqual(
            _choose_name("Description", "Widget | Example Store"),
            "Widget | Example Store",
        )

    def test_product_url_requires_a_detail_segment(self):
        self.assertTrue(_looks_like_product_url("https://example.com/products/123"))
        self.assertTrue(
            _looks_like_product_url(
                "https://books.example/catalogue/a-book_1000/index.html"
            )
        )
        self.assertFalse(_looks_like_product_url("https://example.com/products"))

    def test_duplicates_merge_missing_fields_but_variants_remain_distinct(self):
        products = [
            Product(name="Shirt", price="20.00", currency="USD"),
            Product(name="Shirt", price="20.00", sku="SHIRT-S", availability="In stock"),
            Product(name="Shirt", price="20.00", sku="SHIRT-M"),
        ]
        result = _deduplicate(products)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].sku, "SHIRT-S")
        self.assertEqual(result[0].availability, "In stock")
        self.assertEqual(result[1].sku, "SHIRT-M")

    def test_same_numeric_price_in_different_currencies_stays_distinct(self):
        result = _deduplicate(
            [
                Product(name="Shirt", price="20.00", currency="USD"),
                Product(name="Shirt", price="20.00", currency="CAD"),
            ]
        )
        self.assertEqual(len(result), 2)

    def test_challenge_page_detection_is_conservative(self):
        self.assertTrue(_looks_like_block_page("Access denied", ""))
        self.assertTrue(_looks_like_block_page("Store", "Verify you are human"))
        self.assertFalse(
            _looks_like_block_page(
                "Captcha Board Game",
                "A normal and sufficiently descriptive product page" * 2000,
            )
        )

    def test_image_urls_reject_active_or_credential_bearing_schemes(self):
        self.assertIsNone(_absolute_url("javascript:alert(1)", "https://shop.example/p/1"))
        self.assertIsNone(
            _absolute_url(
                "https://user:pass@example.com/image.png",
                "https://shop.example/p/1",
            )
        )


class ProductUrlSafetyTests(unittest.IsolatedAsyncioTestCase):
    async def test_private_product_image_is_removed(self):
        products = [
            Product(
                name="Fixture",
                imageUrl="http://127.0.0.1/private-image.png",
            )
        ]
        module = _sanitize_product_urls.__module__
        unsafe_error = __import__(module, fromlist=["UnsafeUrlError"]).UnsafeUrlError
        with patch(
            f"{module}.validate_public_url",
            new=AsyncMock(side_effect=unsafe_error("private")),
        ):
            blocked = await _sanitize_product_urls(products, {})
        self.assertEqual(blocked, 1)
        self.assertIsNone(products[0].imageUrl)


if __name__ == "__main__":
    unittest.main()
