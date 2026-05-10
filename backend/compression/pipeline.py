from __future__ import annotations

import asyncio
import io
import logging
import math
import os
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any

import fitz
from fastapi import HTTPException, UploadFile
from PIL import Image


UPLOAD_CHUNK_SIZE = 1024 * 1024
LARGE_PDF_THRESHOLD_MB = 50
Image.MAX_IMAGE_PIXELS = None


@dataclass(frozen=True)
class CompressionProfile:
    name: str
    gs_profile: str
    minimum_gain_ratio: float
    color_dpi: int
    gray_dpi: int
    mono_dpi: int
    max_image_width: int
    jpeg_quality: int


@dataclass(frozen=True)
class PDFCompressionResult:
    task_id: str
    output_path: str
    original_path: str
    cleanup_paths: tuple[str, ...]
    original_size: int
    new_size: int
    reduction_percent: float
    compression_engine: str
    used_fallback: bool
    elapsed_seconds: float


class PDFCompressionService:
    """Hybrid PDF compression pipeline with bounded concurrency and graceful fallback."""

    def __init__(
        self,
        temp_dir: str,
        gs_exe: str,
        logger: logging.Logger,
        max_workers: int | None = None,
    ) -> None:
        cpu_count = os.cpu_count() or 2
        worker_count = max_workers or max(1, cpu_count - 1)

        self.temp_dir = temp_dir
        self.gs_exe = gs_exe
        self.logger = logger
        self.max_workers = worker_count
        self.executor = ThreadPoolExecutor(
            max_workers=worker_count,
            thread_name_prefix="pdf-compression",
        )
        self.job_gate = asyncio.Semaphore(worker_count)
        self.progress: dict[str, dict[str, Any]] = {}
        self.render_threads = max(1, min(4, worker_count))
        self.profiles = {
            "low": CompressionProfile("low", "/printer", 0.01, 150, 150, 150, 2000, 80),
            "medium": CompressionProfile("medium", "/ebook", 0.02, 120, 120, 120, 1500, 60),
            "high": CompressionProfile("high", "/screen", 0.03, 100, 100, 100, 1000, 40),
        }

    def get_progress(self, task_id: str) -> dict[str, Any] | None:
        return self.progress.get(task_id)

    async def compress_upload(self, upload: UploadFile, level: str) -> PDFCompressionResult:
        safe_filename = self._validate_pdf_filename(upload.filename)
        normalized_level = level.lower().strip()
        if normalized_level not in self.profiles:
            raise HTTPException(status_code=400, detail="Compression level must be low, medium, or high.")

        profile = self.profiles[normalized_level]
        task_id = uuid.uuid4().hex
        input_path = os.path.join(self.temp_dir, f"comp_in_{task_id}.pdf")
        fast_output_path = os.path.join(self.temp_dir, f"comp_pymupdf_{task_id}.pdf")
        ghostscript_output_path = os.path.join(self.temp_dir, f"comp_gs_{task_id}.pdf")

        async with self.job_gate:
            started_at = time.perf_counter()
            self._set_progress(task_id, "queued", 1)
            try:
                self._set_progress(task_id, "uploading", 5)
                await self._stream_upload_to_disk(upload, input_path)

                self._set_progress(task_id, "analyzing", 15)
                original_size, page_count, image_count = await self._run_blocking(self._inspect_pdf_metadata, input_path)
                size_mb = original_size / (1024 * 1024)
                self.logger.info(
                    "compression_start task_id=%s filename=%s level=%s size_mb=%.2f page_count=%s image_count=%s",
                    task_id,
                    safe_filename,
                    normalized_level,
                    size_mb,
                    page_count,
                    image_count,
                )

                compressed_candidates: list[str] = []
                used_fallback = False

                timeout_seconds = self._estimate_timeout(original_size)
                should_run_ghostscript = (
                    original_size > 5 * 1024 * 1024
                    or image_count > 0
                    or not self._is_already_optimized(original_size, page_count)
                )

                self._set_progress(task_id, "pymupdf", 35)
                pymupdf_task = asyncio.create_task(
                    self._run_blocking(self._optimize_with_pymupdf, input_path, fast_output_path, profile)
                )
                ghostscript_task: asyncio.Task[bool] | None = None

                if should_run_ghostscript:
                    self._set_progress(task_id, "ghostscript", 45)
                    ghostscript_task = asyncio.create_task(
                        self._run_ghostscript(
                            input_path=input_path,
                            output_path=ghostscript_output_path,
                            profile=profile,
                            timeout_seconds=timeout_seconds,
                        )
                    )

                pymupdf_size = 0
                ghostscript_size = 0

                try:
                    await pymupdf_task
                    if os.path.exists(fast_output_path):
                        compressed_candidates.append(fast_output_path)
                        pymupdf_size = os.path.getsize(fast_output_path)
                    self._set_progress(task_id, "pymupdf_complete", 65)
                except Exception as exc:
                    self.logger.warning(
                        "pymupdf_optimization_failed task_id=%s filename=%s error=%s",
                        task_id,
                        safe_filename,
                        exc,
                    )
                    self._set_progress(task_id, "pymupdf_failed", 55)

                if ghostscript_task is not None:
                    try:
                        await ghostscript_task
                        if os.path.exists(ghostscript_output_path):
                            compressed_candidates.append(ghostscript_output_path)
                            ghostscript_size = os.path.getsize(ghostscript_output_path)
                    except TimeoutError:
                        used_fallback = True
                        self.logger.warning(
                            "ghostscript_timeout task_id=%s filename=%s timeout=%s fallback=%s",
                            task_id,
                            safe_filename,
                            timeout_seconds,
                            "pymupdf" if os.path.exists(fast_output_path) else "original",
                        )
                    except subprocess.CalledProcessError as exc:
                        used_fallback = True
                        self.logger.warning(
                            "ghostscript_failed task_id=%s filename=%s return_code=%s fallback=%s",
                            task_id,
                            safe_filename,
                            exc.returncode,
                            "pymupdf" if os.path.exists(fast_output_path) else "original",
                        )

                self._set_progress(task_id, "finalizing", 90)
                output_path, new_size = self._select_smallest_path(input_path, compressed_candidates)
                raw_reduction_percent = ((original_size - new_size) / original_size) * 100 if original_size else 0.0
                reduction_percent = round(max(raw_reduction_percent, 0.0), 2)

                compression_engine = "original"
                if output_path == ghostscript_output_path:
                    compression_engine = "ghostscript"
                elif output_path == fast_output_path:
                    compression_engine = "pymupdf"

                if not compressed_candidates:
                    used_fallback = True

                elapsed_seconds = round(time.perf_counter() - started_at, 2)
                self._set_progress(task_id, "complete", 100)
                self.logger.info(
                    "compression_complete task_id=%s filename=%s engine=%s original_size=%s pymupdf_size=%s ghostscript_size=%s final_size=%s reduction_percent=%.2f elapsed_seconds=%.2f used_fallback=%s",
                    task_id,
                    safe_filename,
                    compression_engine,
                    original_size,
                    pymupdf_size,
                    ghostscript_size,
                    new_size,
                    reduction_percent,
                    elapsed_seconds,
                    used_fallback,
                )

                return PDFCompressionResult(
                    task_id=task_id,
                    output_path=output_path,
                    original_path=input_path,
                    cleanup_paths=(input_path, fast_output_path, ghostscript_output_path),
                    original_size=original_size,
                    new_size=new_size,
                    reduction_percent=reduction_percent,
                    compression_engine=compression_engine,
                    used_fallback=used_fallback,
                    elapsed_seconds=elapsed_seconds,
                )
            except HTTPException:
                self._set_progress(task_id, "failed", 100)
                raise
            except Exception as exc:
                self._set_progress(task_id, "failed", 100)
                self.logger.exception("compression_unhandled_failure task_id=%s error=%s", task_id, exc)
                raise HTTPException(status_code=500, detail="Matrix density reduction failed.") from exc
            finally:
                self.progress.pop(task_id, None)

    def _set_progress(self, task_id: str, stage: str, progress: int) -> None:
        self.progress[task_id] = {"stage": stage, "progress": progress}

    async def _run_blocking(self, func, *args):
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self.executor, func, *args)

    def _validate_pdf_filename(self, filename: str | None) -> str:
        safe_name = (filename or "document.pdf").strip()
        if not safe_name.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="PDF asset required.")
        return os.path.basename(safe_name)

    async def _stream_upload_to_disk(self, upload: UploadFile, destination: str) -> int:
        total_bytes = 0
        await upload.seek(0)
        with open(destination, "wb") as buffer:
            while True:
                chunk = await upload.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                total_bytes += len(chunk)
                buffer.write(chunk)
        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")
        return total_bytes

    def _inspect_pdf_metadata(self, pdf_path: str) -> tuple[int, int, int]:
        file_size = os.path.getsize(pdf_path)
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty.")
        try:
            with fitz.open(pdf_path) as pdf_doc:
                image_count = 0
                for page in pdf_doc:
                    image_count += len(page.get_images(full=True))
                return file_size, len(pdf_doc), image_count
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Uploaded file is not a readable PDF.") from exc

    def _is_already_optimized(self, file_size_bytes: int, page_count: int) -> bool:
        if file_size_bytes <= 2 * 1024 * 1024:
            return True
        if page_count > 0 and (file_size_bytes / page_count) < 75 * 1024:
            return True
        return False

    def _estimate_timeout(self, file_size_bytes: int) -> int:
        size_mb = max(1, math.ceil(file_size_bytes / (1024 * 1024)))
        return max(15, min(60, size_mb * 2))

    def _optimize_with_pymupdf(self, input_path: str, output_path: str, profile: CompressionProfile) -> None:
        with fitz.open(input_path) as pdf_doc:
            metadata = pdf_doc.metadata or {}
            if any(metadata.values()):
                pdf_doc.set_metadata({})
            self._recompress_document_images(pdf_doc, profile)
            pdf_doc.save(
                output_path,
                garbage=4,
                deflate=True,
                clean=True,
            )

    def _recompress_document_images(self, pdf_doc: fitz.Document, profile: CompressionProfile) -> None:
        processed_xrefs: set[int] = set()

        for page in pdf_doc:
            for image_info in page.get_images(full=True):
                xref = image_info[0]
                if xref in processed_xrefs:
                    continue
                processed_xrefs.add(xref)

                try:
                    extracted = pdf_doc.extract_image(xref)
                    image_bytes = extracted.get("image")
                    if not image_bytes:
                        continue

                    with Image.open(io.BytesIO(image_bytes)) as image:
                        converted = image.convert("RGB")
                        width, height = converted.size
                        if width > profile.max_image_width:
                            new_height = max(1, int(height * (profile.max_image_width / width)))
                            converted = converted.resize((profile.max_image_width, new_height), Image.Resampling.LANCZOS)

                        output_buffer = io.BytesIO()
                        converted.save(
                            output_buffer,
                            format="JPEG",
                            quality=profile.jpeg_quality,
                            optimize=True,
                        )
                        recompressed_bytes = output_buffer.getvalue()

                    if len(recompressed_bytes) < len(image_bytes):
                        pdf_doc.update_stream(xref, recompressed_bytes)
                except Exception as exc:
                    self.logger.debug("image_recompress_skip xref=%s error=%s", xref, exc)

    def _build_ghostscript_command(
        self,
        input_path: str,
        output_path: str,
        profile: CompressionProfile,
    ) -> list[str]:
        return [
            self.gs_exe,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={profile.gs_profile}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dSAFER",
            f"-dNumRenderingThreads={self.render_threads}",
            "-dBufferSpace=200000000",
            "-dBandBufferSpace=200000000",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            "-dSubsetFonts=true",
            "-dAutoRotatePages=/None",
            "-dDownsampleColorImages=true",
            "-dDownsampleGrayImages=true",
            "-dDownsampleMonoImages=true",
            "-dColorImageDownsampleType=/Bicubic",
            "-dGrayImageDownsampleType=/Bicubic",
            "-dMonoImageDownsampleType=/Subsample",
            f"-dColorImageResolution={profile.color_dpi}",
            f"-dGrayImageResolution={profile.gray_dpi}",
            f"-dMonoImageResolution={profile.mono_dpi}",
            f"-sOutputFile={output_path}",
            input_path,
        ]

    async def _run_ghostscript(
        self,
        input_path: str,
        output_path: str,
        profile: CompressionProfile,
        timeout_seconds: int,
    ) -> None:
        command = self._build_ghostscript_command(input_path, output_path, profile)
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError as exc:
            process.kill()
            await process.communicate()
            raise TimeoutError("Ghostscript compression timed out.") from exc

        if process.returncode != 0:
            raise subprocess.CalledProcessError(
                returncode=process.returncode,
                cmd=command,
                output=stdout,
                stderr=stderr,
            )

    def _select_smallest_path(self, original_path: str, candidate_paths: list[str]) -> tuple[str, int]:
        valid_candidates: list[tuple[str, int]] = []
        for candidate_path in candidate_paths:
            if not os.path.exists(candidate_path):
                continue
            candidate_size = os.path.getsize(candidate_path)
            if candidate_size > 0:
                valid_candidates.append((candidate_path, candidate_size))

        if not valid_candidates:
            return original_path, os.path.getsize(original_path)

        return min(valid_candidates, key=lambda item: item[1])
