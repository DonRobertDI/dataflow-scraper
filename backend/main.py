from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    url: str

@app.post("/api/scrape")
async def scrape_data(req: ScrapeRequest):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            await page.goto(req.url, timeout=30000)
            title = await page.title()
            # Placeholder mock for the layout until database integration
            return {
                "status": "success",
                "title": title,
                "data": [
                    {"name": "Extracted Product Alpha", "price": "$24.99"},
                    {"name": "Extracted Product Beta", "price": "$89.99"},
                    {"name": "Extracted Product Gamma", "price": "$39.99"}
                ]
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
        finally:
            await browser.close()