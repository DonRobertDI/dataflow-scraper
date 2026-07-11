from typing import Literal, Optional

from pydantic import BaseModel, Field


class ScrapeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


class Product(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    price: Optional[str] = Field(default=None, max_length=100)
    currency: Optional[str] = Field(default=None, max_length=16)
    availability: Optional[str] = Field(default=None, max_length=500)
    sku: Optional[str] = Field(default=None, max_length=200)
    imageUrl: Optional[str] = Field(default=None, max_length=2048)
    description: Optional[str] = Field(default=None, max_length=10_000)


class ScrapeResponse(BaseModel):
    pageTitle: str = Field(max_length=1000)
    sourceUrl: str = Field(max_length=2048)
    extractedAt: str
    duration: float
    products: list[Product]
    warnings: list[str]
    status: Literal["success"]


class HealthResponse(BaseModel):
    status: str
    service: str


class ApiErrorDetail(BaseModel):
    code: str
    message: str
