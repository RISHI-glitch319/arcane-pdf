from __future__ import annotations

import asyncio
import html
import logging
from typing import Final
from urllib.parse import urlparse

from fastapi import HTTPException
from playwright.async_api import Browser, BrowserContext, Error, Page, Playwright, TimeoutError, async_playwright


DEFAULT_TIMEOUT_MS: Final[int] = 45000


class HTMLToPDFService:
    """Render remote URLs or raw HTML into PDF using headless Chromium."""

    def __init__(self, logger: logging.Logger, browser_launch_timeout_ms: int = DEFAULT_TIMEOUT_MS) -> None:
        self.logger = logger
        self.browser_launch_timeout_ms = browser_launch_timeout_ms
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._browser_lock = asyncio.Lock()

    async def startup(self) -> None:
        await self._ensure_browser()

    async def shutdown(self) -> None:
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None

    async def render_url_to_pdf(self, url: str) -> bytes:
        parsed_url = urlparse(url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL. Use a full http or https address.")

        context = await self._new_context(base_url=f"{parsed_url.scheme}://{parsed_url.netloc}")
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="networkidle", timeout=DEFAULT_TIMEOUT_MS)
            await self._wait_for_page_readiness(page)
            return await self._render_page_pdf(page)
        except TimeoutError as exc:
            raise HTTPException(status_code=504, detail="Timed out while rendering the requested webpage.") from exc
        except Error as exc:
            raise HTTPException(status_code=502, detail=f"Browser rendering failed: {exc}") from exc
        finally:
            await context.close()

    async def render_html_to_pdf(self, html_content: str, base_url: str | None = None) -> bytes:
        final_html = self._inject_base_href(html_content, base_url)
        context = await self._new_context(base_url=base_url)
        page = await context.new_page()
        try:
            await page.set_content(final_html, wait_until="networkidle", timeout=DEFAULT_TIMEOUT_MS)
            await self._wait_for_page_readiness(page)
            return await self._render_page_pdf(page)
        except TimeoutError as exc:
            raise HTTPException(status_code=504, detail="Timed out while rendering the uploaded HTML file.") from exc
        except Error as exc:
            raise HTTPException(status_code=502, detail=f"Browser rendering failed: {exc}") from exc
        finally:
            await context.close()

    async def _ensure_browser(self) -> Browser:
        if self._browser is not None:
            return self._browser

        async with self._browser_lock:
            if self._browser is not None:
                return self._browser

            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
                timeout=self.browser_launch_timeout_ms,
            )
            self.logger.info("playwright_browser_started")
            return self._browser

    async def _new_context(self, base_url: str | None = None) -> BrowserContext:
        browser = await self._ensure_browser()
        return await browser.new_context(
            base_url=base_url,
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1,
            java_script_enabled=True,
            ignore_https_errors=True,
        )

    async def _wait_for_page_readiness(self, page: Page) -> None:
        await page.wait_for_load_state("domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
        await page.wait_for_timeout(1000)

    async def _render_page_pdf(self, page: Page) -> bytes:
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
            margin={
                "top": "0.5in",
                "right": "0.5in",
                "bottom": "0.5in",
                "left": "0.5in",
            },
        )
        if not pdf_bytes:
            raise HTTPException(status_code=500, detail="Generated PDF was empty.")
        return pdf_bytes

    def _inject_base_href(self, html_content: str, base_url: str | None = None) -> str:
        if not base_url:
            return html_content

        normalized = html_content.lstrip()
        if "<base " in html_content.lower():
            return html_content

        base_tag = f'<base href="{html.escape(base_url, quote=True)}">'
        lower_html = normalized.lower()

        if "<head" in lower_html:
            head_open = lower_html.find("<head")
            head_close = lower_html.find(">", head_open)
            if head_close != -1:
                prefix_len = len(html_content) - len(normalized)
                insert_at = prefix_len + head_close + 1
                return html_content[:insert_at] + base_tag + html_content[insert_at:]

        return f"<head>{base_tag}</head>{html_content}"
