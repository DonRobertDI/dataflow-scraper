# DataFlow E-Commerce Scraper

DataFlow converts a public product-detail page into a normalized, reviewable product record. It combines a React dashboard with a FastAPI and Playwright extraction service.

## What it does

- Accepts one public HTTP or HTTPS product-detail URL per request
- Renders JavaScript pages in an isolated Chromium context
- Extracts and merges JSON-LD Product data, product metadata, semantic markup, and cautious visible-page fallbacks
- Returns product name, price, currency, availability, SKU or identifier, image URL, and description
- Normalizes schema availability values and resolves relative image URLs
- Rejects catalog, search, home, article, and challenge pages instead of fabricating a product from their first visible price
- Shows complete records in the dashboard and stores up to 100 recent jobs in browser-local history
- Exports every normalized field to CSV or to the browser's Print / Save as PDF flow

DataFlow does not provide accounts, cloud persistence, batch crawling, scheduling, CAPTCHA bypassing, or guaranteed support for every storefront. Store owners can change markup or restrict automated access at any time.

## Architecture

```text
React/Vite dashboard
  -> POST /api/scrape
FastAPI
  -> URL and public-address validation
  -> isolated Playwright browser context
  -> JSON-LD + metadata + scoped DOM extraction
  -> normalization and response validation
React
  -> complete results, local history, CSV, print/PDF
```

## Local setup

Prerequisites:

- Node.js 20+
- Python 3.10+

Install the frontend dependencies:

```bash
npm install
```

Create and activate a Python virtual environment, then install the API dependencies and Chromium:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
playwright install chromium
```

Copy `.env.example` to `.env`. The defaults support local development:

```env
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
MAX_CONCURRENT_SCRAPES=3
POSTGRES_PASSWORD=change_me
```

An empty `VITE_API_BASE_URL` uses Vite's same-origin proxy. Set it to the public API origin only when the frontend and API are deployed separately.

Start both services:

```bash
npm run dev
```

- Dashboard: `http://localhost:3000`
- API documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Verification commands

```bash
npm test
npm run lint
npm run build
```

The regression suite covers URL safety, consistent API errors, nested JSON-LD, free and multi-offer products, locale-aware prices, currency and availability normalization, deduplication, response validation, history limits, and storage failures.

## Legitimate test pages

These sandbox websites are intended for scraper practice:

- `https://web-scraping.dev/product/1`
- `https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html`
- `https://sandbox.oxylabs.io/products/1`
- `https://learnwebscraping.dev/practice/ecommerce/products/ashenfang-longsword-fan-1001/`
- `https://scrapingsandbox.com/product/1`

Paste an individual product-detail URL, not the site's home page, search page, or catalog page.

## API

### `POST /api/scrape`

Request:

```json
{
  "url": "https://web-scraping.dev/product/1"
}
```

A successful response contains:

- `pageTitle`
- `sourceUrl`
- `extractedAt`
- `duration`
- `products`
- `warnings`
- `status`

The `duration` value is measured in seconds.

Stable error responses use this format:

```json
{
  "detail": {
    "code": "no_product_metadata",
    "message": "No supported product data was found."
  }
}
```

Important HTTP statuses:

- `400` for unsafe URLs
- `403` for blocked sources
- `422` for unsupported pages or invalid requests
- `502` for navigation failures
- `503` when the browser service is unavailable or busy
- `504` for timeouts

### `GET /health`

Returns the API process status without launching a browser.

## Docker

Start the frontend and backend:

```bash
docker compose up --build
```

The browser API runs as a non-root user with a read-only filesystem, dropped Linux capabilities, and writable temporary filesystems.

The unused PostgreSQL scaffold is optional:

```bash
docker compose --profile database up --build
```

## Security and operational limits

- Only globally routable HTTP and HTTPS destinations are allowed.
- Local, private, link-local, shared or CGNAT, reserved, multicast, credential-bearing, and ambiguous backslash URLs are rejected.
- DNS resolution has a deadline, and every resolved address must be public.
- Browser-context routing covers redirects, popup first requests, subresources, and WebSockets.
- Unsafe product image URLs are removed before they reach the frontend.
- Browser concurrency, JSON-LD size, body scanning, field lengths, blocked-request logs, and result count are bounded.
- A page returning HTTP 200 can still be a bot challenge. Common challenge pages are reported as blocked rather than unsupported.
- DNS validation in application code cannot fully eliminate DNS-rebinding risks because Chromium performs its own resolution.
- Production deployments should also deny private-network egress at the container, firewall, proxy, or cloud-network layer.
- The local container runs Chromium as a non-root user but does not claim a fully validated Chromium sandbox profile.
- Treat hostile-page execution as an isolated workload and add a tested seccomp, user-namespace, or separate browser-worker boundary in production.
- Operators remain responsible for website terms, robots policies, rate limits, privacy requirements, and applicable data-use laws.

## Screenshots

### Dashboard

> Add a dashboard screenshot here.

### Results

> Add a results screenshot here.

### Documentation

> Add a documentation screenshot here.

## Future improvements

- User authentication
- Cloud database persistence
- Batch scraping
- Scheduled scraping
- Additional storefront support
- Improved bot-challenge detection
- User accounts and saved projects
- Excel export
- AI-powered product insights
- Dark mode

## Author

**Don Robert Dimasayao**

Computer Science graduate passionate about full-stack development, AI, automation, and building practical software solutions.

LinkedIn:
https://www.linkedin.com/in/donrobertdimasayao/

GitHub:
https://github.com/DonRobertDI

## License

This project is licensed under the MIT License.
