import os
import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

if __package__:
    from .models import ApiErrorDetail, HealthResponse, ScrapeRequest, ScrapeResponse
    from .scraper import (
        NavigationError,
        ScraperUnavailableError,
        ScrapeTimeoutError,
        UnsupportedPageError,
        WebsiteBlockedError,
        scrape_products,
    )
    from .security import UnsafeUrlError
else:
    from models import ApiErrorDetail, HealthResponse, ScrapeRequest, ScrapeResponse
    from scraper import (
        NavigationError,
        ScraperUnavailableError,
        ScrapeTimeoutError,
        UnsupportedPageError,
        WebsiteBlockedError,
        scrape_products,
    )
    from security import UnsafeUrlError


logger = logging.getLogger("uvicorn.error")


app = FastAPI(
    title="DataFlow Scraper API",
    description="Extracts normalized product data from public e-commerce pages.",
    version="1.0.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": ApiErrorDetail(code=code, message=message).model_dump()
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    message = errors[0].get("msg", "The request is invalid.") if errors else "The request is invalid."
    return _error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "invalid_request",
        message,
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unexpected scraper API error",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "internal_error",
        "The extraction service encountered an unexpected error.",
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="dataflow-scraper")


@app.post("/api/scrape", response_model=ScrapeResponse)
async def scrape_data(request: ScrapeRequest) -> ScrapeResponse:
    try:
        return await scrape_products(request.url)
    except UnsafeUrlError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ApiErrorDetail(code="invalid_url", message=str(exc)).model_dump(),
        ) from exc
    except WebsiteBlockedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ApiErrorDetail(
                code="website_blocked", message=str(exc)
            ).model_dump(),
        ) from exc
    except ScrapeTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=ApiErrorDetail(code="timeout", message=str(exc)).model_dump(),
        ) from exc
    except ScraperUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ApiErrorDetail(
                code="service_unavailable", message=str(exc)
            ).model_dump(),
        ) from exc
    except UnsupportedPageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=ApiErrorDetail(
                code="no_product_metadata", message=str(exc)
            ).model_dump(),
        ) from exc
    except NavigationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=ApiErrorDetail(
                code="navigation_failed", message=str(exc)
            ).model_dump(),
        ) from exc
