# Standard Library Imports
import asyncio
import binascii
import datetime
import importlib
import io
import base64
import json
import logging
import math
import os
import re
import subprocess
import threading
import time
import zipfile
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
DEFAULT_TEMP_DIR = os.getenv("TEMP_DIR") or ("/app/temp_uploads" if os.name != "nt" else "temp_uploads")
os.environ.setdefault("TEMP_DIR", DEFAULT_TEMP_DIR)

# Third-party Imports
import cv2
import fitz  # PyMuPDF
import numpy as np
import openpyxl
import pandas as pd
import pdfplumber
import pytesseract
import torch
from PIL import Image, ImageDraw, ImageFont, ImageOps
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from openpyxl.styles import Alignment
from openpyxl.utils import get_column_letter
from pytesseract import Output
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_JUSTIFY

try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
except ImportError:
    AutoTokenizer = None
    AutoModelForSeq2SeqLM = None

# Local Module Imports
from compression import PDFCompressionService
try:
    from services.html_to_pdf import HTMLToPDFService
except ImportError as html_import_error:
    HTMLToPDFService = None
    HTML_TO_PDF_IMPORT_ERROR = html_import_error
else:
    HTML_TO_PDF_IMPORT_ERROR = None
from services.job_manager import job_manager
from services.file_registry import file_registry
from services.extraction_service import extraction_service
from services.summarization_service import summarization_service
from services.ocr_service import ocr_service
from services.image_service import image_service
from image_routes import router as image_router, set_telemetry_logger as set_image_telemetry_logger


def int_from_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


# OPTIMIZATION: Zero-Lag globally enforced bounds
MAX_WORKERS = int_from_env("MAX_WORKERS", 2)
torch.set_num_threads(MAX_WORKERS)
cv2.setNumThreads(1)

# Thread pool for CPU-heavy operations
CPU_EXECUTOR = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# --- ENGINE CONFIGURATION ---
IS_WINDOWS = os.name == 'nt'
TEMP_DIR = DEFAULT_TEMP_DIR
TEMP_FILE_TTL_SECONDS = int_from_env("TEMP_FILE_TTL_SECONDS", 900)
TEMP_CLEANUP_INTERVAL_SECONDS = int_from_env("TEMP_CLEANUP_INTERVAL_SECONDS", 300)
MAX_UPLOAD_BYTES = int_from_env("MAX_UPLOAD_MB", 50) * 1024 * 1024
# Use persistent cache directory for production
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR") or (
    os.path.join(TEMP_DIR, "models_cache") if IS_WINDOWS else "/app/models_cache"
)
# Ensure MODEL_CACHE_DIR is not None
if MODEL_CACHE_DIR is None:
    MODEL_CACHE_DIR = os.path.join(TEMP_DIR, "models_cache") if IS_WINDOWS else "/app/models_cache"
os.makedirs(TEMP_DIR, exist_ok=True)
if MODEL_CACHE_DIR:
    try:
        os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
    except OSError as cache_error:
        logging.getLogger(__name__).warning(f"Model cache directory unavailable: {cache_error}")
        MODEL_CACHE_DIR = None

def safe_find_spec(module_name: str):
    try:
        return importlib.util.find_spec(module_name)
    except (ImportError, ModuleNotFoundError, ValueError):
        return None

if IS_WINDOWS:
    # Windows Paths
    if safe_find_spec("pythoncom"):
        pythoncom = __import__("pythoncom")
    else:
        pythoncom = None

    if safe_find_spec("comtypes.client"):
        comtypes_client = __import__("comtypes.client", fromlist=[""])
    else:
        comtypes_client = None

    GS_EXE = r"C:\Program Files\gs\gs10.06.0\bin\gswin64c.exe"
    POPPLER_PATH = r'C:\Program Files\poppler-25.12.0\Library\bin'
else:
    # Linux/Docker Paths
    GS_EXE = "gs"
    POPPLER_PATH = None 
    
    # Force offline mode for digital sovereignty
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"

# Configure structured logging
logger = logging.getLogger(__name__)


async def periodic_temp_cleanup():
    while True:
        await asyncio.sleep(TEMP_CLEANUP_INTERVAL_SECONDS)
        cleanup_temp_files()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP LOGIC
    logger.info("Starting Arcane Engine...")

    await html_to_pdf_service.startup()
    cleanup_temp_files()
    cleanup_task = asyncio.create_task(periodic_temp_cleanup())

    # Translation warmup removed - translation functionality disabled

    try:
        yield  # Application runs here
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass

    # SHUTDOWN LOGIC
    logger.info("Shutting down Arcane Engine...")

    await html_to_pdf_service.shutdown()
    
    # Translation cache clearing removed - translation functionality disabled

app = FastAPI(
    title="Arcane PDF Cinematic Engine",
    lifespan=lifespan
)

# Serve temp files for download
app.mount("/temp_uploads", StaticFiles(directory=TEMP_DIR), name="temp_uploads")
app.mount("/temp_files", StaticFiles(directory=TEMP_DIR), name="temp_files")
app.mount("/outputs", StaticFiles(directory=TEMP_DIR), name="outputs")

# Cleanup function to remove old temporary files
def cleanup_temp_files():
    """Remove old files from temp directories, keep recent ones for download"""
    import glob

    temp_dirs = {TEMP_DIR, "temp_uploads"}
    protected_names = {"telemetry.json"}

    for temp_dir in temp_dirs:
        if os.path.exists(temp_dir):
            try:
                current_time = time.time()
                removed_count = 0
                files = glob.glob(os.path.join(temp_dir, "*"))
                for file in files:
                    try:
                        if os.path.isfile(file):
                            if os.path.basename(file) in protected_names:
                                continue
                            file_age = current_time - os.path.getmtime(file)
                            if file_age > TEMP_FILE_TTL_SECONDS:
                                os.remove(file)
                                removed_count += 1
                    except Exception as e:
                        logger.error(f"Failed to remove {file}: {e}")
                if removed_count:
                    logger.info("Cleaned %s old temp files from %s", removed_count, temp_dir)
            except Exception as e:
                logger.error(f"Error cleaning up {temp_dir}: {e}")


def cleanup_files(*files):
    for file in files:
        try:
            if file and os.path.exists(file):
                os.remove(file)
        except Exception as e:
            logger.error("Cleanup error for %s: %s", file, e)
            
compression_service = PDFCompressionService(
    temp_dir=TEMP_DIR,
    gs_exe=GS_EXE,
    logger=logger,
)

class HTMLToPDFUnavailableService:
    async def startup(self):
        logger.warning(f"HTML to PDF service unavailable: {HTML_TO_PDF_IMPORT_ERROR}")

    async def shutdown(self):
        return None

    async def render_url_to_pdf(self, url: str) -> bytes:
        raise HTTPException(status_code=503, detail="HTML to PDF dependency unavailable.")

    async def render_html_to_pdf(self, html_content: str) -> bytes:
        raise HTTPException(status_code=503, detail="HTML to PDF dependency unavailable.")

html_to_pdf_service = (
    HTMLToPDFService(logger=logger)
    if HTMLToPDFService is not None
    else HTMLToPDFUnavailableService()
)


def parse_csv_env(name: str, default: Optional[List[str]] = None) -> List[str]:
    value = os.getenv(name, "")
    items = [item.strip().rstrip("/") for item in value.split(",") if item.strip()]
    return items or (default or [])


CORS_ORIGINS = parse_csv_env("CORS_ORIGINS")
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
    # CRITICAL: Added 'download_url' and 'task_id' to exposure
    expose_headers=[
        "X-Reduction-Percentage", 
        "X-Old-Size", 
        "X-New-Size", 
        "Content-Disposition",
        "download_url",
        "task_id"
    ]
)


@app.middleware("http")
async def enforce_upload_size_limit(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_UPLOAD_BYTES:
                max_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Upload too large. Maximum size is {max_mb} MB."},
                )
        except ValueError:
            pass
    return await call_next(request)


# --- SOVEREIGN TELEMETRY ENGINE ---
STATS_FILE = os.path.join(TEMP_DIR, "telemetry.json")

class TelemetryPulse(BaseModel):
    tool_name: str
    status: str = "success"
    size_bytes: int = 0

def log_telemetry(tool_name: str, status: str = "success", size_bytes: int = 0):
    """Sovereign Ledger Logic: Writes to local JSON for Analytics."""
    try:
        log_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "tool": tool_name,
            "status": status,
            "size_mb": round(size_bytes / (1024 * 1024), 2) if size_bytes > 0 else 0
        }
        
        logs = []
        if os.path.exists(STATS_FILE) and os.path.getsize(STATS_FILE) > 0:
            with open(STATS_FILE, "r") as f:
                try:
                    logs = json.load(f)
                except:
                    logs = []
        
        logs.append(log_entry)
        
        # Atomic Write for Docker stability
        temp_stats = STATS_FILE + ".tmp"
        with open(temp_stats, "w") as f:
            json.dump(logs[-2000:], f, indent=2)
        os.replace(temp_stats, STATS_FILE)
    except Exception as e:
        logger.error(f"Telemetry Core Failure: {e}")

set_image_telemetry_logger(log_telemetry)

# Include image processing routes after telemetry is wired.
app.include_router(image_router, prefix="/api")

@app.post("/engine/pulse")
async def receive_frontend_pulse(data: TelemetryPulse):
    """Endpoint for Frontend tools (page.tsx) to report usage."""
    log_telemetry(data.tool_name, data.status, data.size_bytes)
    return {"status": "Pulse Recorded"}

@app.get("/engine/stats")
async def get_engine_stats():
    """Synthesizes the Ledger for the Dashboard."""
    if not os.path.exists(STATS_FILE):
        return {"total_operations": 0, "total_data_distilled_mb": 0, "tool_distribution": {}, "recent_activity": []}
    
    with open(STATS_FILE, "r") as f:
        logs = json.load(f)
    
    tool_counts = {}
    total_size = 0
    for entry in logs:
        t = entry["tool"]
        tool_counts[t] = tool_counts.get(t, 0) + 1
        total_size += entry.get("size_mb", 0)

    return {
        "total_operations": len(logs),
        "total_data_distilled_mb": round(total_size, 2),
        "tool_distribution": tool_counts,
        "recent_activity": logs[-15:][::-1]
    }

# Translation health endpoints removed - translation functionality disabled




# Register tasks with job manager
job_manager.register_task("extract", extraction_service.extract_text)
job_manager.register_task("summarize", summarization_service.summarize)
job_manager.register_task("ocr", ocr_service.process_ocr)
job_manager.register_task("compress", compression_service.compress_upload)

# --- ENHANCED SUMMARIZATION ENGINE ---

@dataclass
class DocumentStructure:
    """Represents structured document content"""
    elements: List[Dict[str, Any]]
    metadata: Dict[str, Any]

@dataclass
class SummaryConfig:
    """Configuration for summarization pipeline"""
    summary_ratio: float = 0.2
    mode: str = "summary"  # "summary", "bullet_points", "technical"
    preserve_structure: bool = True
    use_abstractive: bool = False
    max_chunk_tokens: int = 1500

# Global model cache for abstractive summarization
_ABSTRACTIVE_MODEL_CACHE = {}
_ABSTRACTIVE_MODEL_LOCK = threading.Lock()

def extract_structure(pdf_bytes: bytes) -> DocumentStructure:
    """
    Structure-aware text extraction with heading/paragraph detection.
    Falls back to plain text if structure detection fails.
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            elements = []
            total_chars = 0
            
            for page_num, page in enumerate(pdf.pages):
                try:
                    # Extract text with character information for structure analysis
                    chars = page.chars
                    if not chars:
                        continue
                        
                    # Group characters by lines and analyze font patterns
                    lines = {}
                    for char in chars:
                        line_key = (char['top'], char['bottom'])
                        if line_key not in lines:
                            lines[line_key] = []
                        lines[line_key].append(char)
                    
                    # Sort lines by vertical position
                    sorted_lines = sorted(lines.items(), key=lambda x: x[0][0])
                    
                    page_text = ""
                    for line_key, line_chars in sorted_lines:
                        # Sort characters horizontally
                        line_chars.sort(key=lambda x: x['x0'])
                        line_text = "".join(char['text'] for char in line_chars)
                        page_text += line_text + "\n"
                    
                    # Analyze text structure
                    if page_text.strip():
                        structured_elements = _analyze_text_structure(page_text.strip())
                        elements.extend(structured_elements)
                        total_chars += len(page_text)
                        
                except Exception as e:
                    logger.warning(f"Structure analysis failed for page {page_num}: {e}")
                    # Fallback to plain text extraction
                    text = page.extract_text()
                    if text:
                        elements.append({
                            "type": "paragraph",
                            "text": text.strip(),
                            "page": page_num + 1
                        })
                        total_chars += len(text)
            
            return DocumentStructure(
                elements=elements,
                metadata={
                    "total_elements": len(elements),
                    "total_chars": total_chars,
                    "extraction_method": "structure_aware"
                }
            )
            
    except Exception as e:
        logger.error(f"Structure extraction failed: {e}")
        # Fallback to plain text extraction
        return _fallback_to_plain_text(pdf_bytes)

def _analyze_text_structure(text: str) -> List[Dict[str, Any]]:
    """
    Analyze text to identify headings, paragraphs, and lists.
    """
    elements = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Heading detection heuristics
        if _is_heading(line):
            elements.append({
                "type": "heading",
                "text": line,
                "level": _detect_heading_level(line)
            })
        # List detection
        elif _is_list_item(line):
            elements.append({
                "type": "list",
                "text": line
            })
        # Default to paragraph
        else:
            elements.append({
                "type": "paragraph",
                "text": line
            })
    
    return elements

def _is_heading(line: str) -> bool:
    """
    Detect if a line is likely a heading.
    """
    # Common heading patterns
    if len(line) < 100 and (
        line.isupper() or  # ALL CAPS
        line.endswith(':') or  # Ends with colon
        re.match(r'^\d+\.\s+', line) or  # Numbered heading
        re.match(r'^[A-Z][A-Z\s]*$', line)  # Short uppercase
    ):
        return True
    return False

def _detect_heading_level(line: str) -> int:
    """
    Detect heading level (1-3) based on formatting.
    """
    if re.match(r'^\d+\.\d+\.\s+', line):
        return 3
    elif re.match(r'^\d+\.\s+', line):
        return 2
    else:
        return 1

def _is_list_item(line: str) -> bool:
    """
    Detect if a line is a list item.
    """
    return bool(re.match(r'^[•\-\*]\s+|^\d+[\.)]\s+', line))

def _fallback_to_plain_text(pdf_bytes: bytes) -> DocumentStructure:
    """
    Fallback to plain text extraction when structure detection fails.
    """
    try:
        text = extract_pdf_text_sovereign(io.BytesIO(pdf_bytes))
        return DocumentStructure(
            elements=[{
                "type": "paragraph",
                "text": text.strip()
            }],
            metadata={
                "total_elements": 1,
                "total_chars": len(text),
                "extraction_method": "plain_text_fallback"
            }
        )
    except Exception as e:
        logger.error(f"Plain text fallback failed: {e}")
        return DocumentStructure(
            elements=[],
            metadata={
                "total_elements": 0,
                "total_chars": 0,
                "extraction_method": "failed"
            }
        )

def semantic_chunk(structure: DocumentStructure, config: SummaryConfig) -> List[Dict[str, Any]]:
    """
    Semantic chunking based on document structure rather than word count.
    """
    chunks = []
    current_chunk = {
        "elements": [],
        "text": "",
        "token_count": 0
    }
    
    for element in structure.elements:
        element_text = element["text"]
        # Rough token estimation (1 token ≈ 4 characters)
        element_tokens = len(element_text) // 4
        
        # Check if adding this element would exceed chunk size
        if current_chunk["token_count"] + element_tokens > config.max_chunk_tokens and current_chunk["elements"]:
            # Save current chunk and start new one
            chunks.append(current_chunk)
            current_chunk = {
                "elements": [],
                "text": "",
                "token_count": 0
            }
        
        # Add element to current chunk
        current_chunk["elements"].append(element)
        current_chunk["text"] += element_text + "\n"
        current_chunk["token_count"] += element_tokens
    
    # Add final chunk if it has content
    if current_chunk["elements"]:
        chunks.append(current_chunk)
    
    return chunks

def load_abstractive_model(model_name: str = "t5-small") -> Tuple[Any, Any]:
    """
    Load abstractive summarization model with caching.
    """
    if model_name in _ABSTRACTIVE_MODEL_CACHE:
        return _ABSTRACTIVE_MODEL_CACHE[model_name]
    
    with _ABSTRACTIVE_MODEL_LOCK:
        if model_name in _ABSTRACTIVE_MODEL_CACHE:
            return _ABSTRACTIVE_MODEL_CACHE[model_name]
        
        try:
            if AutoTokenizer is None or AutoModelForSeq2SeqLM is None:
                logger.warning("Transformers dependency unavailable; using extractive summarization.")
                _ABSTRACTIVE_MODEL_CACHE[model_name] = (None, None)
                return None, None

            logger.info(f"Loading abstractive model: {model_name}")
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=MODEL_CACHE_DIR,
                local_files_only=False
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                cache_dir=MODEL_CACHE_DIR,
                local_files_only=False
            )
            model.eval()
            
            _ABSTRACTIVE_MODEL_CACHE[model_name] = (model, tokenizer)
            logger.info(f"Successfully loaded {model_name}")
            return model, tokenizer
            
        except Exception as e:
            logger.error(f"Failed to load abstractive model {model_name}: {e}")
            return None, None

def hybrid_summarize(text: str, config: SummaryConfig) -> str:
    """
    Hybrid summarization: extractive + optional abstractive.
    """
    if not text.strip():
        return ""
    
    # Stage 1: Extractive summarization (TextRank)
    try:
        extractive_summary = distill_text_engine(text, config.summary_ratio)
        if not extractive_summary or extractive_summary == text[:500] + "...":
            # Fallback if extractive failed
            extractive_summary = text
    except Exception as e:
        logger.error(f"Extractive summarization failed: {e}")
        extractive_summary = text
    
    # Stage 2: Optional abstractive summarization
    if config.use_abstractive and len(extractive_summary) > 100:
        try:
            model, tokenizer = load_abstractive_model()
            if model and tokenizer:
                # Prepare input for T5
                if "summarize" not in extractive_summary.lower():
                    input_text = f"summarize: {extractive_summary}"
                else:
                    input_text = extractive_summary
                
                # Tokenize and generate
                inputs = tokenizer(
                    input_text,
                    return_tensors="pt",
                    max_length=512,
                    truncation=True,
                    padding=True
                )
                
                with torch.no_grad():
                    outputs = model.generate(
                        **inputs,
                        max_length=min(256, len(extractive_summary) // 4),
                        num_beams=3,
                        early_stopping=True,
                        temperature=0.7,
                        length_penalty=1.0
                    )
                
                abstractive_summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
                if abstractive_summary.strip():
                    return abstractive_summary.strip()
                    
        except Exception as e:
            logger.error(f"Abstractive summarization failed: {e}")
            # Fall back to extractive
            pass
    
    return extractive_summary

def hierarchical_refine(chunks: List[Dict[str, Any]], config: SummaryConfig) -> Dict[str, Any]:
    """
    Hierarchical summarization: summarize each chunk, then merge and refine.
    """
    chunk_summaries = []
    sections = []
    
    # Summarize each chunk individually
    for i, chunk in enumerate(chunks):
        chunk_summary = hybrid_summarize(chunk["text"], config)
        chunk_summaries.append(chunk_summary)
        
        # Extract section title if structure is preserved
        if config.preserve_structure and chunk["elements"]:
            heading_element = next(
                (el for el in chunk["elements"] if el["type"] == "heading"),
                None
            )
            if heading_element:
                sections.append({
                    "title": heading_element["text"],
                    "summary": chunk_summary
                })
    
    # Merge chunk summaries
    merged_summary = "\n\n".join(chunk_summaries)
    
    # Final refinement pass
    if len(merged_summary) > 500:  # Only refine if there's substantial content
        final_summary = hybrid_summarize(merged_summary, config)
    else:
        final_summary = merged_summary
    
    return {
        "summary": final_summary,
        "sections": sections,
        "metadata": {
            "chunks_processed": len(chunks),
            "compression_ratio": len("\n".join(chunk["text"] for chunk in chunks)) / max(len(final_summary), 1),
            "total_elements": sum(len(chunk["elements"]) for chunk in chunks)
        }
    }



# --- NEURAL DISTILLATION UTILITIES ---
def extract_pdf_text_sovereign(file_stream):
    """
    Optimized extraction: Uses a generator-like approach 
    to prevent memory spikes on large documents.
    """
    extracted_parts = []
    try:
        with pdfplumber.open(file_stream) as pdf:
            for page in pdf.pages:
                txt = page.extract_text()
                if txt:
                    # Clean control characters that break XML-based PDF generators
                    clean_txt = "".join(c for c in txt if c.isprintable() or c in "\n\r\t")
                    extracted_parts.append(clean_txt)
        return "\n\n".join(extracted_parts)
    except Exception as e:
        logger.error(f"Neural Extraction Collapse: {e}")
        return ""


# Translation PDF synthesis function removed - translation functionality disabled


def distill_text_engine(text, ratio=0.2):
    """
    Strict ratio-based summarization. 
    Note: Standard ratio is usually 0.2 (20% of original).
    """
    if not text.strip() or len(text) < 100:
        return text

    try:
        ensure_nltk_data()
        plaintext = import_dependency("sumy.parsers.plaintext", "sumy")
        tokenizer_mod = import_dependency("sumy.nlp.tokenizers", "sumy")
        summarizer_mod = import_dependency("sumy.summarizers.text_rank", "sumy")

        parser = plaintext.PlaintextParser.from_string(text, tokenizer_mod.Tokenizer("english"))
        summarizer = summarizer_mod.TextRankSummarizer()
        
        # Calculate target based on sentence count
        sentence_count = len(parser.document.sentences)
        # Production guard: Ensure at least 3 sentences or original if text is short
        target = max(3, math.ceil(sentence_count * ratio))
        
        summary_sentences = summarizer(parser.document, target)
        
        paragraphs, current_p = [], []
        for i, sent in enumerate(summary_sentences):
            current_p.append(str(sent))
            # Create a new paragraph every 4 distilled sentences for visual flow
            if (i + 1) % 4 == 0:
                paragraphs.append(" ".join(current_p))
                current_p = []
        
        if current_p:
            paragraphs.append(" ".join(current_p))
            
        return "\n\n".join(paragraphs)
    except Exception as e:
        logger.error(f"Summarization Engine Stalled: {e}")
        return text[:500] + "..." # Fallback to snippet

# --- ENDPOINTS ---

@app.post("/summarize-pdf")
async def summarize_pdf_protocol(
    file: UploadFile = File(...),
    summary_ratio: float = Form(0.2),
    mode: str = Form("summary"),
    preserve_structure: bool = Form(True),
    use_advanced: bool = Form(False)
):
    """
    Enhanced Neural Distillation with backward compatibility.
    - use_advanced=False: Uses legacy word-based chunking (original behavior)
    - use_advanced=True: Uses new structure-aware pipeline
    """
    file_size = 0
    try:
        pdf_bytes = await file.read()
        file_size = len(pdf_bytes)
        
        # Validate parameters
        if not 0.1 <= summary_ratio <= 0.5:
            raise HTTPException(status_code=400, detail="summary_ratio must be between 0.1 and 0.5")
        if mode not in ["summary", "bullet_points", "technical"]:
            raise HTTPException(status_code=400, detail="mode must be 'summary', 'bullet_points', or 'technical'")
        
        if use_advanced:
            # Use new enhanced pipeline
            return await _enhanced_summarize_pipeline(
                pdf_bytes, file_size, summary_ratio, mode, preserve_structure
            )
        else:
            # Use legacy pipeline for backward compatibility
            return await _legacy_summarize_pipeline(pdf_bytes, file_size)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Summarization Failure: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Summarize PDF", "failure", file_size)
        raise HTTPException(status_code=500, detail="Neural sequence interrupted.")

async def _legacy_summarize_pipeline(pdf_bytes: bytes, file_size: int) -> dict:
    """
    Original word-based chunking pipeline for backward compatibility.
    """
    # 1. Atomic Extraction
    text = await run_in_cpu_executor(extract_pdf_text_sovereign, io.BytesIO(pdf_bytes))
    if not text.strip():
        raise HTTPException(status_code=400, detail="Matrix empty or OCR required.")

    # 2. Strategic Chunking (original word-based approach)
    words = text.split()
    chunk_size = 4000  # Smaller chunks for higher precision
    final_summary_parts = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        # We use a 0.15 ratio for high-density distillation
        distilled_part = await run_in_cpu_executor(distill_text_engine, chunk, 0.15)
        final_summary_parts.append(distilled_part)

    # 3. Final Synthesis
    full_summary = "\n\n".join(final_summary_parts)
    
    # Log to Sovereign Telemetry
    if 'log_telemetry' in globals():
        log_telemetry("Summarize PDF", "success", file_size)

    return {
        "summary": full_summary,
        "distillation_date": datetime.datetime.now().isoformat(),
        "original_mass_kb": round(file_size / 1024, 2)
    }

async def _enhanced_summarize_pipeline(
    pdf_bytes: bytes, file_size: int, 
    summary_ratio: float, mode: str, preserve_structure: bool
) -> dict:
    """
    New structure-aware, hierarchical summarization pipeline.
    """
    # 1. Structure-aware extraction
    structure = await run_in_cpu_executor(extract_structure, pdf_bytes)
    if not structure.elements:
        raise HTTPException(status_code=400, detail="No extractable content found in PDF.")
    
    # 2. Configuration setup
    config = SummaryConfig(
        summary_ratio=summary_ratio,
        mode=mode,
        preserve_structure=preserve_structure,
        use_abstractive=os.getenv("ENABLE_ABSTRACTIVE", "0") == "1"
    )
    
    # 3. Semantic chunking
    chunks = await run_in_cpu_executor(semantic_chunk, structure, config)
    if not chunks:
        raise HTTPException(status_code=400, detail="Failed to process document content.")
    
    # 4. Hierarchical summarization
    result = await run_in_cpu_executor(hierarchical_refine, chunks, config)
    
    # 5. Format output based on mode
    if mode == "bullet_points":
        result["summary"] = _format_as_bullet_points(result["summary"])
    elif mode == "technical":
        result["summary"] = _format_technical_summary(result["summary"])
    
    # Add metadata
    result.update({
        "distillation_date": datetime.datetime.now().isoformat(),
        "original_mass_kb": round(file_size / 1024, 2),
        "engine": "Structure-Aware-Hierarchical-v2",
        "config": {
            "summary_ratio": summary_ratio,
            "mode": mode,
            "preserve_structure": preserve_structure,
            "use_abstractive": config.use_abstractive
        }
    })
    
    # Log to Sovereign Telemetry
    if 'log_telemetry' in globals():
        log_telemetry("Enhanced Summarize PDF", "success", file_size)
    
    return result

def _format_as_bullet_points(text: str) -> str:
    """
    Convert summary to bullet point format.
    """
    sentences = re.split(r'[.!?]+', text)
    bullet_points = []
    
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) > 10:  # Filter out very short fragments
            bullet_points.append(f"• {sentence.capitalize()}")
    
    return "\n".join(bullet_points)

def _format_technical_summary(text: str) -> str:
    """
    Format summary for technical audiences.
    """
    # Add technical prefixes and preserve key terms
    sentences = re.split(r'[.!?]+', text)
    technical_sentences = []
    
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) > 10:
            # Preserve technical terms and add emphasis
            if any(keyword in sentence.lower() for keyword in ['method', 'algorithm', 'system', 'process', 'result']):
                technical_sentences.append(f"KEY: {sentence}")
            else:
                technical_sentences.append(sentence)
    
    return ". ".join(technical_sentences) + "."

@app.post("/summarize-pdf-advanced")
async def summarize_pdf_advanced_protocol(
    file: UploadFile = File(...),
    summary_ratio: float = Form(0.2),
    mode: str = Form("summary"),
    preserve_structure: bool = Form(True),
    use_abstractive: bool = Form(False)
):
    """
    Advanced endpoint that always uses the enhanced pipeline.
    """
    file_size = 0
    try:
        pdf_bytes = await file.read()
        file_size = len(pdf_bytes)
        
        # Validate parameters
        if not 0.1 <= summary_ratio <= 0.5:
            raise HTTPException(status_code=400, detail="summary_ratio must be between 0.1 and 0.5")
        if mode not in ["summary", "bullet_points", "technical"]:
            raise HTTPException(status_code=400, detail="mode must be 'summary', 'bullet_points', or 'technical'")
        
        # Force use of advanced pipeline
        config = SummaryConfig(
            summary_ratio=summary_ratio,
            mode=mode,
            preserve_structure=preserve_structure,
            use_abstractive=use_abstractive
        )
        
        return await _enhanced_summarize_pipeline(
            pdf_bytes, file_size, summary_ratio, mode, preserve_structure
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Advanced Summarization Failure: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Advanced Summarize PDF", "failure", file_size)
        raise HTTPException(status_code=500, detail="Advanced neural sequence interrupted.")


# --- NEW HIGH-PERFORMANCE ENDPOINTS ---

@app.post("/submit-job")
async def submit_job(file: UploadFile = File(...), task: str = Form(...), **params):
    """
    Submit a job for parallel processing
    """
    try:
        # Validate file
        if not file.content_type or not file.content_type.startswith('application/pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # File size validation (max 50MB)
        file_data = await file.read()
        if len(file_data) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")
        
        # Register file
        file_id = file_registry.register_file(file_data, file.filename, file.content_type)
        
        # Submit job
        job_id = await job_manager.submit_task(task, file_data, **params)
        
        return {
            "status": "success",
            "job_id": job_id,
            "file_id": file_id,
            "task": task,
            "message": "Job submitted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Job submission failed: {e}")
        return {
            "status": "error",
            "job_id": None,
            "error": str(e)
        }

@app.post("/submit-parallel-jobs")
async def submit_parallel_jobs(file: UploadFile = File(...), tasks: str = Form(...)):
    """
    Submit multiple jobs for parallel execution
    tasks: JSON string of task specifications
    """
    try:
        import json
        
        # Parse tasks
        task_specs = json.loads(tasks)
        if not isinstance(task_specs, list):
            raise HTTPException(status_code=400, detail="Tasks must be a JSON array")
        
        # Validate and read file
        if not file.content_type or not file.content_type.startswith('application/pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        file_data = await file.read()
        if len(file_data) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")
        
        # Register file
        file_id = file_registry.register_file(file_data, file.filename, file.content_type)
        
        # Prepare task specifications
        tasks_with_file = []
        for task_spec in task_specs:
            if "task_name" not in task_spec:
                raise HTTPException(status_code=400, detail="Each task must have 'task_name'")
            
            tasks_with_file.append({
                **task_spec,
                "file_data": file_data
            })
        
        # Submit parallel jobs
        job_ids = await job_manager.submit_parallel_tasks(tasks_with_file)
        
        return {
            "status": "success",
            "job_ids": job_ids,
            "file_id": file_id,
            "tasks_count": len(job_ids),
            "message": f"{len(job_ids)} jobs submitted for parallel execution"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Parallel job submission failed: {e}")
        return {
            "status": "error",
            "job_ids": [],
            "error": str(e)
        }

@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    """
    Get job status by ID
    """
    job_status = job_manager.get_job_status(job_id)
    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "status": "success",
        "data": job_status
    }

@app.get("/job-result/{job_id}")
async def get_job_result(job_id: str):
    """
    Get job result by ID
    """
    result = job_manager.get_job_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return result

@app.get("/job-stats")
async def get_job_stats():
    """
    Get job manager performance statistics
    """
    stats = job_manager.get_performance_stats()
    return {
        "status": "success",
        "data": stats
    }

@app.get("/file-stats")
async def get_file_stats():
    """
    Get file registry statistics
    """
    stats = file_registry.get_stats()
    return {
        "status": "success",
        "data": stats
    }

@app.post("/cleanup")
async def cleanup_resources():
    """
    Cleanup old jobs and files
    """
    try:
        job_manager.cleanup_completed_jobs()
        file_registry._cleanup()
        
        return {
            "status": "success",
            "message": "Cleanup completed"
        }
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/summarize-pdf-parallel")
async def summarize_pdf_parallel(
    file: UploadFile = File(...),
    summary_ratio: float = Form(0.2),
    mode: str = Form("summary"),
    preserve_structure: bool = Form(True),
    use_abstractive: bool = Form(False),
    use_ocr: bool = Form(False)
):
    """
    High-performance parallel PDF summarization
    """
    try:
        # Validate inputs
        if not 0.1 <= summary_ratio <= 0.5:
            raise HTTPException(status_code=400, detail="summary_ratio must be between 0.1 and 0.5")
        if mode not in ["summary", "bullet_points", "technical"]:
            raise HTTPException(status_code=400, detail="mode must be 'summary', 'bullet_points', or 'technical'")
        
        # Read file
        file_data = await file.read()
        if len(file_data) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")
        
        # Prepare parallel tasks
        tasks = [
            {
                "task_name": "extract",
                "params": {
                    "use_structure": True,
                    "use_ocr_fallback": use_ocr
                }
            },
            {
                "task_name": "summarize",
                "params": {
                    "summary_ratio": summary_ratio,
                    "mode": mode,
                    "preserve_structure": preserve_structure,
                    "use_abstractive": use_abstractive
                }
            }
        ]
        
        # If OCR is requested, add OCR task
        if use_ocr:
            tasks.insert(0, {
                "task_name": "ocr",
                "params": {
                    "mode": "text",
                    "language": "eng+hin+tel"
                }
            })
        
        # Submit parallel jobs
        job_ids = await job_manager.submit_parallel_tasks([
            {**task, "file_data": file_data} for task in tasks
        ])
        
        return {
            "status": "success",
            "job_ids": job_ids,
            "tasks": [task["task_name"] for task in tasks],
            "message": f"{len(job_ids)} tasks submitted for parallel processing"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Parallel summarization failed: {e}")
        return {
            "status": "error",
            "job_ids": [],
            "error": str(e)
        }

@app.post("/generate-summary-pdf")
async def generate_summary_pdf(data: dict):
    """
    Universal PDF Synthesis:
    Renders distilled text into a high-fidelity Sovereign PDF.
    """
    text = data.get("text", "")
    filename = data.get("filename", f"Arcane_Summary_{uuid.uuid4().hex[:6]}.pdf")
    
    buffer = io.BytesIO()
    # Production Margins (standard 1-inch)
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter, 
        rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    arcane_body_style = ParagraphStyle(
        name='ArcaneBody', 
        parent=styles['Normal'], 
        fontSize=10.5, 
        leading=15, 
        alignment=TA_JUSTIFY,
        spaceAfter=12
    )
    
    story = []

    # Arcane Header Branding
    title_text = f"<font color='#CC208E' size='16'><b>ARCANE NEURAL SUMMARY</b></font>"
    story.append(Paragraph(title_text, styles["Title"]))
    story.append(Spacer(1, 12))
    
    # Metadata line
    meta = f"<font size='8' color='#666666'>ENGINE PULSE: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</font>"
    story.append(Paragraph(meta, styles["Normal"]))
    story.append(Spacer(1, 24))
    
    # Content Processing
    # We normalize newlines to prevent XML parsing errors in ReportLab
    paragraphs = text.replace('\r', '').split('\n')
    for p in paragraphs:
        clean_p = p.strip()
        if clean_p:
            # Escape XML special characters to prevent "Illegal Character" errors
            safe_p = clean_p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(safe_p, arcane_body_style))
            
    try:
        doc.build(story)
        pdf_value = buffer.getvalue()
        buffer.close()
        
        return Response(
            content=pdf_value,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"PDF Synthesis Collapse: {e}")
        raise HTTPException(status_code=500, detail="Synthesis failed.")
    
def import_dependency(module_name: str, package_name: str | None = None):
    try:
        return importlib.import_module(module_name)
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Missing dependency: install '{package_name or module_name}' to use this endpoint.",
        ) from exc


def ensure_nltk_data() -> None:
    nltk_module = import_dependency("nltk", "nltk")
    resources = {
        "tokenizers/punkt": "punkt",
        "tokenizers/punkt_tab": "punkt_tab",
    }
    for resource_path, download_name in resources.items():
        try:
            nltk_module.data.find(resource_path)
        except LookupError:
            nltk_module.download(download_name, quiet=True)


async def run_in_cpu_executor(func, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(CPU_EXECUTOR, func, *args)

# --- MATRIX ANALYSIS ---
@app.post("/analyze-pdf")
async def analyze_pdf(file: UploadFile = File(...)):
    """
    Sovereign Visual Analysis:
    Renders low-latency thumbnails for frontend organization UI.
    Uses a standard RGB colorspace for cross-platform compatibility.
    """
    doc = None
    file_size = 0
    try:
        content = await file.read()
        file_size = len(content)
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Empty PDF asset.")

        # Open from memory to avoid disk I/O for quick analysis
        doc = fitz.open(stream=content, filetype="pdf")
        if len(doc) == 0:
            raise HTTPException(status_code=422, detail="PDF contains no pages.")

        thumbnails = []
        
        # Optimization: matrix(0.2, 0.2) provides 20% scale—perfect for UI previews
        zoom_matrix = fitz.Matrix(0.2, 0.2)
        
        for i in range(len(doc)):
            page = doc[i]
            # Colorspace="rgb" ensures thumbnails look consistent on all OS types
            pix = page.get_pixmap(matrix=zoom_matrix, colorspace=fitz.csRGB, alpha=False)
            
            # Encode to PNG bytes
            img_bytes = pix.tobytes("png")
            img_base64 = base64.b64encode(img_bytes).decode("utf-8")
            
            thumbnails.append({
                "id": i, 
                "image": f"data:image/png;base64,{img_base64}"
            })
            
        log_telemetry("Analyze PDF", "success", file_size)
        return {"pages": thumbnails, "total_pages": len(doc)}
    except HTTPException:
        log_telemetry("Analyze PDF", "failure", file_size)
        raise
    except Exception as e:
        logger.error(f"Analysis Matrix Collapse: {e}")
        log_telemetry("Analyze PDF", "failure", file_size)
        raise HTTPException(500, detail="Document analysis sequence failed.")
    finally:
        if doc:
            doc.close()

# --- SAAS CORE UTILITIES ---
def preprocess_for_saas_ocr(img):
    """
    Normalizes the visual matrix:
    Grayscale -> Denoise -> Deskew for maximum OCR hit-rate.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adaptive denoising to remove grain/noise from scans
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    
    # Thresholding for deskewing logic
    _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    coords = np.column_stack(np.where(thresh > 0))
    if coords.size > 0:
        angle = cv2.minAreaRect(coords)[-1]
        # Normalize the rotation angle
        if angle < -45: angle = -(90 + angle)
        else: angle = -angle
        
        (h, w) = denoised.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return cv2.cvtColor(rotated, cv2.COLOR_BGR2RGB)
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

# --- THE INTEGRATED CORE LOGIC ---

def ocr_engine_core(file_path: str, mode: str = "text") -> dict:
    """
    Unifies Preprocessing and Extraction for the Sovereign Engine.
    Supports Hindi, Telugu, and English via Tesseract.
    """
    doc = fitz.open(file_path)
    pages_data = []
    full_text_parts = []
    
    # Define multi-language support for Indic scripts
    tess_lang = "hin+tel+eng"

    try:
        for page in doc:
            # 1. High-fidelity render (300 DPI approx for OCR accuracy)
            pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), colorspace=fitz.csRGB, alpha=False)
            img = cv2.imdecode(np.frombuffer(pix.tobytes(), np.uint8), cv2.IMREAD_COLOR)
            
            # 2. Sovereign Preprocessing (Grayscale -> Denoise -> Deskew)
            processed_img = preprocess_for_saas_ocr(img)

            # 3. Logic Branch based on Mode
            if mode == "text":
                # Raw text extraction via LSTM engine with Hindi/Telugu support
                text = pytesseract.image_to_string(
                    processed_img, 
                    lang=tess_lang, 
                    config='--psm 3 --oem 3'
                )
                full_text_parts.append(text.strip())
            
            elif mode == "layout":
                # Spatial layout extraction for searchable PDF reconstruction
                data = pytesseract.image_to_data(
                    processed_img, 
                    lang=tess_lang, 
                    output_type=Output.DICT, 
                    config='--psm 3'
                )
                
                words_metadata = []
                for i in range(len(data["text"])):
                    txt = data["text"][i].strip()
                    # Only keep high-confidence words to avoid "matrix noise"
                    if float(data["conf"][i]) > 20 and txt:
                        words_metadata.append({
                            "text": txt,
                            "x": data["left"][i],
                            "y": data["top"][i],
                            "w": data["width"][i],
                            "h": data["height"][i],
                        })
                
                pages_data.append({
                    "width": page.rect.width,
                    "height": page.rect.height,
                    "img_w": processed_img.shape[1],
                    "img_h": processed_img.shape[0],
                    "image_bytes": cv2.imencode('.png', processed_img)[1].tobytes(),
                    "words": words_metadata
                })

        # 4. Final Data Synthesis
        if mode == "text":
            return {
                "text": "\n\n--- PAGE SEPARATOR ---\n\n".join(full_text_parts), 
                "pages": len(doc),
                "detected_engine": "Tesseract-Indic-v3"
            }
            
        return {"layout": pages_data}
    
    except Exception as e:
        logger.error(f"Sovereign OCR Engine Collapse: {e}")
        raise e
    finally:
        doc.close()


def generate_searchable_pdf(layout_data, output_path):
    """Reconstructs a forensic PDF with an invisible text highlight layer."""
    output_doc = fitz.open()
    try:
        for p_data in layout_data:
            page = output_doc.new_page(width=p_data["width"], height=p_data["height"])
            
            # Background Layer: Insert the cleaned image
            page.insert_image(page.rect, stream=p_data["image_bytes"])

            # Scaling factor between OCR coordinate space and PDF point space
            scale_x = p_data["width"] / p_data["img_w"]
            scale_y = p_data["height"] / p_data["img_h"]

            for word in p_data["words"]:
                # Coordinate synthesis
                x = word["x"] * scale_x
                y = word["y"] * scale_y
                w = word["w"] * scale_x
                h = word["h"] * scale_y
                
                # Invisible text injection (fill_opacity=0)
                try:
                    # In PDF space, text is drawn from the bottom-left point of its box
                    bottom_left = fitz.Point(x, y + h)
                    page.insert_text(
                        bottom_left, 
                        word["text"], 
                        fontsize=h * 0.85, # Dynamic font height based on OCR detection
                        fill_opacity=0 # Hidden for searchability only
                    )
                except:
                    continue

        output_doc.save(output_path, garbage=3, deflate=True)
    finally:
        output_doc.close()


def run_subprocess(command: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, capture_output=True, timeout=timeout)


def convert_pdf_to_docx(converter, output_path: str) -> None:
    converter.convert(output_path, start=0, end=None)

# --- REFINED API ENDPOINTS ---

# --- REFINED API ENDPOINTS WITH TELEMETRY ---

@app.post("/ocr-to-text")
async def ocr_text_endpoint(file: UploadFile = File(...)):
    """Extracts raw text only with Telemetry Tracking."""
    job_id = uuid.uuid4().hex
    temp_path = os.path.join(TEMP_DIR, f"raw_{job_id}.pdf")
    file_size = 0
    
    try:
        content = await file.read()
        file_size = len(content)
        with open(temp_path, "wb") as f: f.write(content)
        
        result = await run_in_cpu_executor(ocr_engine_core, temp_path, "text")
        
        # SUCCESS PULSE
        log_telemetry("Vision OCR (Text)", "success", file_size)
        return result

    except Exception as e:
        # FAILURE PULSE
        log_telemetry("Vision OCR (Text)", "failure", file_size)
        logger.error(f"OCR Raw Failure: {e}")
        raise HTTPException(500, detail="Text extraction failed.")
    finally:
        if os.path.exists(temp_path): os.remove(temp_path)


@app.post("/ocr-pdf-layout")
async def ocr_pdf_layout_endpoint(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Synthesizes Searchable PDF with Telemetry Tracking."""
    job_id = uuid.uuid4().hex
    temp_in = os.path.join(TEMP_DIR, f"in_{job_id}.pdf")
    temp_out = os.path.join(TEMP_DIR, f"searchable_{job_id}.pdf")
    file_size = 0

    try:
        content = await file.read()
        file_size = len(content)
        with open(temp_in, "wb") as f: f.write(content)

        # Step 1: Map visual matrix
        layout_result = await run_in_cpu_executor(ocr_engine_core, temp_in, "layout")
        
        # Step 2: Synthesize PDF layers
        await run_in_cpu_executor(generate_searchable_pdf, layout_result["layout"], temp_out)
        
        # SUCCESS PULSE
        log_telemetry("Vision OCR (Searchable PDF)", "success", file_size)
        
        background_tasks.add_task(cleanup_temp_files)
        
        return FileResponse(
            temp_out,
            media_type="application/pdf",
            filename=f"searchable_{file.filename}"
        )
    except Exception as e:
        # FAILURE PULSE
        log_telemetry("Vision OCR (Searchable PDF)", "failure", file_size)
        logger.error(f"OCR Layout Failure: {e}")
        raise HTTPException(500, detail="Vision sequence failed.")
    
@app.post("/organize-pdf")
async def organize_pdf_protocol(
    background_tasks: BackgroundTasks, 
    files: list[UploadFile] = File(...),
    page_order: str = Form(...)
):
    """
    Sovereign Matrix Re-ordering:
    Reconstructs a new PDF by mapping shards based on a sequence map.
    Handles blank page injection and multi-file cross-referencing.
    """
    unique_id = uuid.uuid4().hex
    output_path = os.path.join(TEMP_DIR, f"organized_{unique_id}.pdf")
    temp_paths = []
    total_mass = 0
    
    try:
        # 1. Ingest all shards into the Docker temporary volume
        for f in files:
            shard_id = uuid.uuid4().hex
            path = os.path.join(TEMP_DIR, f"shard_{shard_id}_{f.filename}")
            
            content = await f.read()
            total_mass += len(content)
            
            with open(path, "wb") as buffer:
                buffer.write(content)
            temp_paths.append(path)

        # 2. Decode instructions
        try:
            new_order = json.loads(page_order)
        except Exception:
            raise HTTPException(400, detail="Invalid sequence map provided.")

        new_doc = fitz.open()
        
        # 3. Re-alignment Sequence
        for item in new_order:
            if item.get("type") == "blank":
                # Standard A4/Letter blank vector page injection
                new_doc.insert_page(-1)
            else:
                file_idx = item.get("file_idx")
                p_idx = item.get("p_idx")
                
                # Boundary check for production safety
                if file_idx < len(temp_paths):
                    src_doc = fitz.open(temp_paths[file_idx])
                    # Ensure the requested page index exists in the source
                    if p_idx < len(src_doc):
                        new_doc.insert_pdf(src_doc, from_page=p_idx, to_page=p_idx)
                    src_doc.close()

        # 4. Finalize & Optimize
        # garbage=3: Remove unused objects
        # deflate=True: Compress the internal cross-reference table
        new_doc.save(output_path, garbage=3, deflate=True, clean=True)
        new_doc.close()

        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("Organize PDF", "success", total_mass)

        # 5. Production Cleanup
        # We delete input shards AND the output file after the user downloads it
        background_tasks.add_task(cleanup_temp_files)
        
        return FileResponse(
            path=output_path, 
            media_type="application/pdf",
            filename="arcane_organized.pdf"
        )

    except Exception as e:
        logger.error(f"Matrix Re-ordering Failure: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Organize PDF", "failure", total_mass)
            
        # Emergency cleanup: don't leave shards on the disk if process fails
        cleanup_files(*temp_paths)
        raise HTTPException(status_code=500, detail="Matrix alignment failed.")
    

@app.post("/pdf-to-word")
async def pdf_to_word_protocol(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...)
):
    """
    Sovereign DOCX Reconstruction:
    Analyzes PDF layout layers (text, images, shapes) and synthesizes 
    a matching Word document shard. Optimized for Docker/Linux.
    """
    # 1. Input Validation
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid asset: PDF required.")

    unique_id = uuid.uuid4().hex
    pdf_path = os.path.join(TEMP_DIR, f"in_{unique_id}.pdf")
    docx_path = os.path.join(TEMP_DIR, f"out_{unique_id}.docx")
    file_size = 0

    try:
        converter_module = import_dependency("pdf2docx", "pdf2docx")

        # 2. Ingest binary data
        content = await file.read()
        file_size = len(content)
        
        with open(pdf_path, "wb") as f:
            f.write(content)

        # 3. Initiate the Reconstruction Engine
        # We wrap this in a try-finally to ensure the Converter closes 
        # even if the layout analysis crashes.
        cv = converter_module.Converter(pdf_path)
        try:
            # multi_processing=True can be enabled for high-core count servers, 
            # but False is safer for standard Docker/Mobile environments.
            await run_in_cpu_executor(convert_pdf_to_docx, cv, docx_path)
        finally:
            cv.close()

        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("PDF to Word", "success", file_size)

        # 4. Finalize & Sovereign Cleanup
        # We use a custom cleanup function to handle potential file locks
        background_tasks.add_task(cleanup_temp_files)

        # Sanitize original filename for the response
        safe_filename = file.filename.rsplit('.', 1)[0] + ".docx"

        return FileResponse(
            path=docx_path,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=safe_filename
        )

    except Exception as e:
        logger.error(f"DOCX Reconstruction Collapse: {e}")
        
        if 'log_telemetry' in globals():
            log_telemetry("PDF to Word", "failure", file_size)
        
        # Immediate cleanup of the failed input
        try:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
        except OSError as cleanup_error:
            logger.warning(f"Failed to remove {pdf_path}: {cleanup_error}")
        
        raise HTTPException(
            status_code=500, 
            detail="Layout reconstruction sequence failed. The document structure may be too complex."
        )
       
@app.post("/add-page-numbers")
async def add_page_numbers_protocol(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    position: str = Form("bottom_right"),
    font_size: int = Form(10),
    color: str = Form("#CC208E"),
    start_index: int = Form(1),
    format_type: str = Form("standard"), # "standard", "x_of_y", or "roman"
):
    """
    Sovereign Pagination:
    Injects dynamic page numbering into the PDF matrix. 
    Supports standard, Roman, and 'X of Y' formats.
    """
    job_id = uuid.uuid4().hex
    in_p = os.path.join(TEMP_DIR, f"pagin_in_{job_id}.pdf")
    out_p = os.path.join(TEMP_DIR, f"pagin_out_{job_id}.pdf")
    file_size = 0

    try:
        roman_module = import_dependency("roman", "roman")

        # 1. Ingest asset
        content = await file.read()
        file_size = len(content)
        with open(in_p, "wb") as f:
            f.write(content)

        # 2. Extract Color Shard (HEX to RGB)
        h = color.lstrip('#')
        # Ensure we have a valid 6-char hex
        if len(h) != 6: h = "CC208E" 
        rgb = tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))

        doc = fitz.open(in_p)
        total_pages = len(doc)

        # 3. Pagination Injection Loop
        for i, page in enumerate(doc):
            current_num = i + start_index
            
            # --- Format Synthesis ---
            if format_type == "roman":
                # Roman numerals must be > 0
                text = roman_module.toRoman(max(1, current_num)).lower()
            elif format_type == "x_of_y":
                text = f"Page {current_num} of {total_pages}"
            else:
                text = str(current_num)

            # --- Dynamic Coordinate Mapping ---
            # Handles different page sizes (A4, Letter, Custom)
            p_w, p_h = page.rect.width, page.rect.height
            margin = 36 
            
            # Use font size to estimate text width for centering
            text_width = len(text) * (font_size * 0.5)

            if position == "bottom_right":
                point = fitz.Point(p_w - margin - text_width, p_h - margin)
            elif position == "bottom_center":
                point = fitz.Point((p_w / 2) - (text_width / 2), p_h - margin)
            elif position == "top_right":
                point = fitz.Point(p_w - margin - text_width, margin + font_size)
            else: # bottom_left
                point = fitz.Point(margin, p_h - margin)

            # --- Legibility Guard ---
            # We insert a tiny white rectangle behind the text 
            # if the user wants clear visibility on busy documents.
            # page.draw_rect([point.x-2, point.y-font_size, point.x+text_width+2, point.y+2], color=(1,1,1), fill=(1,1,1), overlay=True)

            page.insert_text(
                point, 
                text, 
                fontsize=font_size, 
                color=rgb, 
                fontname="helv", # Helvetica is universal
                overlay=True
            )

        # 4. Finalize & Optimize
        doc.save(out_p, garbage=3, deflate=True, clean=True)
        doc.close()

        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("Add Page Numbers", "success", file_size)

        background_tasks.add_task(cleanup_temp_files)
        
        safe_name = f"numbered_{file.filename}"
        return FileResponse(out_p, filename=safe_name)

    except Exception as e:
        logger.error(f"Pagination Sequence Failed: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Add Page Numbers", "failure", file_size)
        
        if os.path.exists(in_p): os.remove(in_p)

@app.post("/sign-pdf")
async def sign_pdf_protocol(
    file: UploadFile = File(...), 
    signature_base64: str = Form(...),
    x_percent: float = Form(...),
    y_percent: float = Form(...),
    width_px: float = Form(...),
    height_px: float = Form(...),
    page_index: int = Form(0)
):
    """
    Sovereign Sign PDF Protocol: 
    Injects a transparent signature shard into the PDF matrix at precise coordinates.
    """
    file_size = 0
    doc = None
    try:
        # 1. Ingest PDF Matrix
        pdf_content = await file.read()
        file_size = len(pdf_content)
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Empty PDF asset.")

        doc = fitz.open(stream=pdf_content, filetype="pdf")
        if len(doc) == 0:
            raise HTTPException(status_code=422, detail="PDF contains no pages.")

        # 2. Decode Signature Shard (Preserve Alpha/Transparency)
        try:
            # Validate input first
            if not signature_base64 or not isinstance(signature_base64, str):
                raise ValueError("Empty or invalid signature data")
            
            # Debug: Log the signature data info
            logger.info(f"Signature data length: {len(signature_base64)}")
            logger.info(f"Signature data starts with: {signature_base64[:50]}...")
            
            # Strip metadata prefix if present (e.g., data:image/png;base64,)
            clean_signature = signature_base64.strip()
            if "," in clean_signature:
                clean_signature = clean_signature.split(',')[1].strip()
                logger.info(f"Stripped prefix, new length: {len(clean_signature)}")
            
            # Check if the cleaned signature is empty
            if not clean_signature:
                raise ValueError("Empty signature data after processing")
            
            # Validate base64 characters only
            if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', clean_signature):
                raise ValueError("Invalid base64 characters detected")
            
            # Add padding if needed (base64 strings must be divisible by 4)
            padding_needed = len(clean_signature) % 4
            if padding_needed:
                clean_signature += "=" * (4 - padding_needed)
                logger.info(f"Added {4 - padding_needed} padding characters")
            
            sig_data = base64.b64decode(clean_signature)
            logger.info(f"Successfully decoded {len(sig_data)} bytes of signature data")
            
            # Check if decoded data is reasonable size
            if len(sig_data) < 100:  # Too small to be a valid image
                raise ValueError("Decoded signature data too small")
            
            if len(sig_data) > 10 * 1024 * 1024:  # Too large (>10MB)
                raise ValueError("Decoded signature data too large")
            
            # Opening via PIL ensures we can handle various web-encoded formats
            sig_img = Image.open(io.BytesIO(sig_data))
            logger.info(f"Opened image with mode: {sig_img.mode}, size: {sig_img.size}")
            
            # Validate image dimensions
            if sig_img.size[0] == 0 or sig_img.size[1] == 0:
                raise ValueError("Invalid image dimensions")
            
            # Convert to bytes for PyMuPDF insertion
            sig_buffer = io.BytesIO()
            sig_img.save(sig_buffer, format="PNG")
            sig_bytes = sig_buffer.getvalue()
            logger.info(f"Converted to PNG bytes: {len(sig_bytes)}")
            
        except ValueError as e:
            logger.error(f"Validation error: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid signature data: {str(e)}")
        except binascii.Error as e:
            logger.error(f"Base64 decoding failed: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid base64 format: {str(e)}")
        except Exception as e:
            logger.error(f"Signature processing failed: {e}")
            raise HTTPException(status_code=400, detail=f"Signature matrix corrupted: {str(e)}")

        # 3. Coordinate Realignment
        # Fallback to page 0 if index is out of bounds
        if page_index < 0 or page_index >= len(doc):
            page_index = 0
            
        page = doc[page_index]
        p_w, p_h = page.rect.width, page.rect.height

        # Map 0.0-1.0 percentage coordinates to actual PDF points
        target_x = x_percent * p_w
        target_y = y_percent * p_h
        
        # Define the injection bounding box
        # PyMuPDF uses 'points' (1/72 inch)
        sig_rect = fitz.Rect(
            target_x, 
            target_y, 
            target_x + width_px, 
            target_y + height_px
        )

        # 4. High-Fidelity Injection
        # overlay=True ensures the signature is on top of existing text
        page.insert_image(sig_rect, stream=sig_bytes, overlay=True)
        
        # 5. Distillation & Finalization
        # garbage=3: Remove unused objects
        # deflate=True: Apply Flate compression to the stream
        output_pdf = doc.tobytes(garbage=3, deflate=True, clean=True)
        doc.close()
        doc = None

        # Log Telemetry Pulse
        if 'log_telemetry' in globals():
            log_telemetry("Sign PDF", "success", file_size)

        return Response(
            content=output_pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=signed_{file.filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except HTTPException:
        if 'log_telemetry' in globals():
            log_telemetry("Sign PDF", "failure", file_size)
        raise
    except Exception as e:
        logger.error(f"Signature Protocol Collapse: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Sign PDF", "failure", file_size)
        raise HTTPException(status_code=500, detail="Matrix alignment sequence failed.")
    finally:
        if doc is not None:
            doc.close()

@app.post("/jpg-to-pdf")
async def jpg_to_pdf_protocol(files: list[UploadFile] = File(...)):
    """
    Sovereign Visual Compiler:
    Batch-distills image assets into a unified PDF matrix.
    Optimized for in-memory processing to ensure data sovereignty.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No visual assets detected.")

    # 1. Initialize a new Master PDF in memory
    new_pdf = fitz.open()
    total_mass = 0
    
    try:
        # 2. Pre-sort files by name to ensure chronological page order
        # Browsers don't always send files in the order they were selected
        sorted_files = sorted(files, key=lambda x: x.filename.lower())

        for uploaded_file in sorted_files:
            # Format Guard
            ext = uploaded_file.filename.lower().split('.')[-1]
            if ext not in ['jpg', 'jpeg', 'png', 'webp']:
                logger.warning(f"Skipping incompatible asset: {uploaded_file.filename}")
                continue

            # 3. Read image binary stream
            image_content = await uploaded_file.read()
            total_mass += len(image_content)
            
            # 4. Synthesize Image Shard
            try:
                # Open image from memory stream
                img_doc = fitz.open(stream=image_content, filetype=ext)
                
                # Convert image to PDF binary stream
                # This preserves the original resolution without distortion
                pdf_bytes = img_doc.convert_to_pdf()
                img_doc.close()
                
                # Insert shard into the Master Matrix
                img_pdf_shard = fitz.open("pdf", pdf_bytes)
                new_pdf.insert_pdf(img_pdf_shard)
                img_pdf_shard.close()
            except Exception as inner_e:
                logger.error(f"Failed to distill {uploaded_file.filename}: {inner_e}")
                continue

        # 5. Finalize the Distillation
        if len(new_pdf) == 0:
            raise HTTPException(status_code=422, detail="No valid image shards synthesized.")

        # 6. High-Efficiency Save
        # garbage=3: Strip redundant data and unused objects
        # deflate=True: Apply Flate compression to the stream
        output_buffer = io.BytesIO()
        new_pdf.save(
            output_buffer, 
            garbage=3, 
            deflate=True, 
            clean=True
        )

        # Tip: Do not query new_pdf after closing (ValueError: document closed)
        total_pages = len(new_pdf)
        new_pdf.close()
        
        pdf_payload = output_buffer.getvalue()
        output_buffer.close()

        # Log Success Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("JPG to PDF", "success", total_mass)

        return Response(
            content=pdf_payload,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=arcane_visual_distillation.pdf",
                "X-Total-Pages": str(total_pages),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages"
            }
        )

    except HTTPException:
        if 'log_telemetry' in globals():
            log_telemetry("JPG to PDF", "failure", total_mass)
        if new_pdf:
            new_pdf.close()
        raise
    except Exception as e:
        logger.error(f"Visual Synthesis Failure: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("JPG to PDF", "failure", total_mass)
        
        if new_pdf:
            new_pdf.close()
        raise HTTPException(status_code=500, detail="Visual matrix compilation failed.")
    

# --- CROSS-PLATFORM OFFICE CONVERTER ---

@app.post("/word-to-pdf")
@app.post("/excel-to-pdf")
@app.post("/ppt-to-pdf")
async def office_to_pdf_protocol(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...)
):
    """
    Sovereign Office Distillation:
    Converts Word, Excel, and PPT shards into high-fidelity PDF matrices.
    Optimized for Docker/Linux using Headless LibreOffice with dynamic Excel scaling.
    """
    job_id = uuid.uuid4().hex
    ext = os.path.splitext(file.filename)[1].lower()
    
    # Validation Shard
    if ext not in ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt']:
        raise HTTPException(status_code=400, detail="Unsupported Office format.")

    input_path = os.path.join(TEMP_DIR, f"{job_id}{ext}")
    output_pdf = os.path.join(TEMP_DIR, f"{job_id}.pdf")
    file_size = 0

    try:
        # 1. Ingest asset binary
        content = await file.read()
        file_size = len(content)
        with open(input_path, "wb") as buffer:
            buffer.write(content)

        # 2. Excel-Specific Preprocessing (Integration of Logic & Scaling)
        if ext in ['.xlsx', '.xls']:
            try:
                wb = openpyxl.load_workbook(input_path)
                
                for sheet in wb.worksheets:
                    # --- Logic A: Calculate Column Widths ---
                    # First pass: determine optimal width for each column
                    column_widths = {}
                    
                    for col_idx, col in enumerate(sheet.columns, start=1):
                        max_length = 0
                        col_letter = get_column_letter(col_idx)
                        
                        for cell in col:
                            if cell.value:
                                # Find max line length within the cell (handling explicit newlines)
                                lines = str(cell.value).split('\n')
                                current_max = max(len(line) for line in lines)
                                if current_max > max_length:
                                    max_length = current_max
                        
                        # Apply adjusted width (capped at 60 for layout safety, minimum 8)
                        adjusted_width = min((max_length * 1.1) + 3, 60)
                        adjusted_width = max(adjusted_width, 8)
                        column_widths[col_letter] = adjusted_width
                        sheet.column_dimensions[col_letter].width = adjusted_width

                    # --- Logic B: Set Alignment and Calculate Dynamic Row Height ---
                    for row in sheet.iter_rows():
                        max_lines = 1
                        
                        for cell in row:
                            if cell.value:
                                # Enable Wrap Text with top alignment
                                cell.alignment = Alignment(wrap_text=True, vertical="top", horizontal="left")
                                
                                text = str(cell.value)
                                col_letter = get_column_letter(cell.column)
                                col_width = column_widths.get(col_letter, sheet.column_dimensions[col_letter].width)
                                
                                # Count explicit newlines
                                explicit_lines = text.count("\n") + 1
                                
                                # Estimate wrapped lines based on text length vs calculated column width
                                # Use average char width factor of ~1.1 for better estimation
                                chars_per_line = max(col_width / 1.2, 1)
                                wrapped_lines = math.ceil(len(text) / chars_per_line)
                                
                                current_cell_lines = max(explicit_lines, wrapped_lines)
                                if current_cell_lines > max_lines:
                                    max_lines = current_cell_lines

                        # Apply calculated height with generous padding (18 factor for comfortable spacing)
                        # Minimum height of 15 to prevent collision
                        calculated_height = max(max_lines * 18, 15)
                        sheet.row_dimensions[row[0].row].height = calculated_height

                    # --- Logic C: Page Setup (A4 Landscape for wide tables, proper margins) ---
                    # Set paper size to A4
                    sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
                    
                    # Use landscape orientation for wide tables
                    sheet.page_setup.orientation = sheet.ORIENTATION_LANDSCAPE
                    
                    # Set reasonable margins (in inches)
                    sheet.page_margins.left = 0.3
                    sheet.page_margins.right = 0.3
                    sheet.page_margins.top = 0.3
                    sheet.page_margins.bottom = 0.3
                    
                    # Fit to width but allow natural height flow
                    sheet.sheet_properties.pageSetUpPr.fitToPage = True
                    sheet.page_setup.fitToWidth = 1
                    sheet.page_setup.fitToHeight = 0  # 0 means automatic/unspecified (not False)

                wb.save(input_path)
                
            except Exception as e:
                logger.warning(f"Excel preprocessing failed: {e}")

        # 3. Execution Branching
        if ext in ['.xlsx', '.xls']:
            # Use proper calc_pdf_Export filter with page scaling
            # ScaleToPagesX=1 fits to width, ScaleToPagesY=0 allows natural height
            output_filter = 'pdf:calc_pdf_Export:{"ScaleToPagesX":{"type":"long","value":"1"},"ScaleToPagesY":{"type":"long","value":"0"}}'
        else:
            output_filter = 'pdf'

        # Command Construction (Docker/Linux optimized)
        cmd = [
            'libreoffice', '--headless', '--convert-to', output_filter,
            '--outdir', TEMP_DIR, input_path
        ]

        # 4. Process Execution with Timeout
        try:
            result = await run_in_cpu_executor(run_subprocess, cmd, 300)
            logger.info(f"LibreOffice Output: {result.stdout.decode()[:100]}")
        except subprocess.TimeoutExpired:
            raise Exception("Conversion timed out (300s limit reached).")

        # 5. Verification Guard
        if not os.path.exists(output_pdf):
            raise Exception("Sovereign distillation failed: Output PDF not materialized.")

        # Log Telemetry
        tool_tag = f"{ext.strip('.').upper()} to PDF"
        if 'log_telemetry' in globals():
            log_telemetry(tool_tag, "success", file_size)

        # 6. Queue Sovereign Cleanup
        background_tasks.add_task(cleanup_files, input_path, output_pdf)

        return FileResponse(
            path=output_pdf, 
            media_type="application/pdf",
            filename=f"arcane_distilled_{file.filename.rsplit('.', 1)[0]}.pdf"
        )

    except Exception as e:
        logger.error(f"Office Distillation Collapse: {e}")
        if 'log_telemetry' in globals():
            log_telemetry(f"{ext.strip('.').upper()} to PDF", "failure", file_size)
            
        if os.path.exists(input_path): os.remove(input_path)
        
        raise HTTPException(status_code=500, detail=f"Engine failed to distill {ext.upper()} asset.")


# --- PDF TO POWERPOINT (Visual Reconstruction) ---
@app.post("/pdf-to-ppt")
async def pdf_to_ppt_protocol(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...)
):
    """
    Sovereign PPT Reconstruction:
    Rasterizes PDF pages into high-fidelity slide assets.
    Dynamically adjusts slide dimensions to match PDF orientation.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF asset required for PPT synthesis.")

    job_id = uuid.uuid4().hex
    in_p = os.path.join(TEMP_DIR, f"ppt_in_{job_id}.pdf")
    out_p = os.path.join(TEMP_DIR, f"ppt_out_{job_id}.pptx")
    file_size = 0

    try:
        pptx_module = import_dependency("pptx", "python-pptx")

        # 1. Atomic Ingestion
        content = await file.read()
        file_size = len(content)
        with open(in_p, "wb") as f:
            f.write(content)
            
        doc = fitz.open(in_p)
        prs = pptx_module.Presentation()

        # 2. Matrix Realignment (Match Slide Size to PDF Page)
        # We take the first page as the master dimension
        if len(doc) > 0:
            ref_page = doc[0]
            # Convert PDF points to PPT Emu (English Metric Units)
            # 1 point = 12700 Emu
            prs.slide_width = int(ref_page.rect.width * 12700)
            prs.slide_height = int(ref_page.rect.height * 12700)

        # 3. Iterative Rasterization Sequence
        for i in range(len(doc)):
            page = doc[i]
            
            # High-Fidelity Rendering: matrix(2, 2) = 2x Scale (approx 144 DPI)
            # matrix(3, 3) is even sharper but increases file size significantly
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csRGB, alpha=False)
            
            img_p = os.path.join(TEMP_DIR, f"shard_{job_id}_{i}.png")
            pix.save(img_p)
            
            # Use Layout[6] (Absolute Blank Slide)
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            
            # Add picture covering the full slide area
            slide.shapes.add_picture(img_p, 0, 0, width=prs.slide_width, height=prs.slide_height)
            
            # Immediate cleanup of the temporary PNG shard to save Docker disk space
            os.remove(img_p)
            
        doc.close()
        prs.save(out_p)

        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("PDF to PPT", "success", file_size)

        # 4. Finalize & Sovereign Cleanup
        background_tasks.add_task(cleanup_temp_files)

        safe_name = file.filename.rsplit('.', 1)[0] + ".pptx"
        return FileResponse(out_p, filename=safe_name)

    except Exception as e:
        logger.error(f"PPT Synthesis Collapse: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("PDF to PPT", "failure", file_size)
        
        # Emergency cleanup
        if os.path.exists(in_p): os.remove(in_p)
        raise HTTPException(status_code=500, detail="Visual PPT synthesis failed.")
    
# --- NEW: PDF TO JPG (Visual Asset Extraction) ---
@app.post("/pdf-to-jpg")
async def pdf_to_jpg_protocol(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...)
):
    """
    Sovereign Asset Extraction:
    Rasterizes PDF pages into high-fidelity JPG shards and 
    packages them into a compressed ZIP archive.
    Optimized for low disk-footprint in Docker.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF asset required.")

    job_id = uuid.uuid4().hex
    # We only create one physical file (the ZIP) to minimize I/O
    zip_path = os.path.join(TEMP_DIR, f"assets_{job_id}.zip")
    file_size = 0

    try:
        # 1. Ingest PDF Matrix
        content = await file.read()
        file_size = len(content)
        doc = fitz.open(stream=content, filetype="pdf")
        
        # 2. Initialize Stream-based Archive
        # We use ZIP_DEFLATED (level 9) for maximum density
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            
            # 3. Iterative Rasterization & Injection
            for i in range(len(doc)):
                page = doc[i]
                
                # High-Fidelity Rendering (2x zoom = 144 DPI)
                # colorspace="rgb" ensures no inversion on Linux/Docker
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csRGB, alpha=False)
                
                # Convert Pixmap to JPG bytes in-memory
                # Quality 85 is the industry sweet spot for size vs clarity
                img_data = pix.tobytes("jpg", jpg_quality=85)
                
                # Inject directly into ZIP with logical naming
                zipf.writestr(f"page_{i+1}.jpg", img_data)
                
        doc.close()

        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("PDF to JPG", "success", file_size)

        # 4. Finalize & Queue Cleanup
        background_tasks.add_task(cleanup_temp_files)

        safe_name = file.filename.rsplit('.', 1)[0] + "_images.zip"
        
        return FileResponse(
            zip_path, 
            media_type="application/zip", 
            filename=safe_name
        )

    except Exception as e:
        logger.error(f"Rasterization Sequence Failed: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("PDF to JPG", "failure", file_size)
        
        # Emergency cleanup of the partially written ZIP
        if os.path.exists(zip_path):
            os.remove(zip_path)
            
        raise HTTPException(status_code=500, detail="Visual extraction sequence failed.")


@app.post("/watermark-pdf")
async def watermark_pdf_engine(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    text: str = Form(...),
    opacity: str = Form("0.3"),
    rotation: str = Form("45"),
    font_size: str = Form("60"),
    color: str = Form("#CC208E"),
    mode: str = Form("center") # "center" or "tile"
):
    """
    Sovereign Watermark Projection:
    Injects high-density text layers into the PDF matrix.
    Supports centered projection and multi-axis tiling.
    Optimized for cross-platform font compatibility.
    """
    job_id = uuid.uuid4().hex
    output_path = os.path.join(TEMP_DIR, f"wm_out_{job_id}.pdf")
    file_size = 0

    try:
        # 1. Ingest binary asset (Direct Stream)
        content = await file.read()
        file_size = len(content)
        # Load from memory to adhere to Data Sovereignty principles
        doc = fitz.open(stream=content, filetype="pdf")

        # 2. Distill & Normalize Parameters
        try:
            opacity_val = max(0.0, min(1.0, float(opacity)))
            angle = float(rotation)
            size = int(font_size)
            h = color.lstrip("#")
            # Ensure 6-char hex string
            if len(h) != 6: h = "CC208E"
            rgb = tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
        except (ValueError, TypeError):
            raise HTTPException(400, detail="Invalid parameter shard detected.")

        # 3. Projection Logic
        for page in doc:
            width = page.rect.width
            height = page.rect.height
            
            # Create transformation matrix for rotation
            matrix = fitz.Matrix(1, 1).prerotate(angle)

            if mode == "center":
                # Precise center point calculation
                center = fitz.Point(width / 2, height / 2)
                page.insert_text(
                    center, 
                    text, 
                    fontsize=size, 
                    color=rgb,
                    fill_opacity=opacity_val, 
                    fontname="helv", # Standard PDF Base14 font
                    morph=(center, matrix), 
                    overlay=True
                )
            else:  # tile mode
                # Create tiled watermark pattern
                x_step = width / 4
                y_step = height / 4
                for x in range(0, int(width), int(x_step)):
                    for y in range(0, int(height), int(y_step)):
                        point = fitz.Point(x, y)
                        page.insert_text(
                            point,
                            text,
                            fontsize=size,
                            color=rgb,
                            fill_opacity=opacity_val,
                            fontname="helv",
                            morph=(point, matrix),
                            overlay=True
                        ) 
        
        # 4. Finalize & Save
        doc.save(output_path, garbage=4, deflate=True, clean=True)
        doc.close()
        
        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry("Watermark PDF", "success", file_size)
        
        # Queue Cleanup
        background_tasks.add_task(cleanup_temp_files)
        
        return FileResponse(
            output_path,
            filename=f"watermarked_{file.filename}",
            media_type="application/pdf"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Watermark projection failed: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Watermark PDF", "failure", file_size)
        raise HTTPException(status_code=500, detail="Watermark projection failed.")


@app.post("/compress-pdf")
async def compress_pdf_protocol(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    level: str = Query("medium") # low, medium, high
):
    """
    Sovereign Compression Engine:
    Distills PDF matrix density using Ghostscript profiles.
    Optimized for Docker/Linux with an automatic mass-reversion guard.
    """
    try:
        result = await compression_service.compress_upload(file, level)

        # Log Telemetry
        if 'log_telemetry' in globals():
            log_telemetry(
                f"Compress ({level.capitalize()})",
                "fallback" if result.used_fallback else "success",
                result.original_size,
            )

        # 4. Finalize & Queue Cleanup
        background_tasks.add_task(cleanup_temp_files)
        
        return FileResponse(
            result.output_path, 
            filename=f"arcane_compressed_{os.path.basename(file.filename or 'document.pdf')}",
            headers={
                "X-Reduction-Percentage": str(result.reduction_percent), 
                "X-Old-Size": str(result.original_size), 
                "X-New-Size": str(result.new_size),
                "X-Compression-Engine": result.compression_engine,
                "X-Compression-Elapsed": str(result.elapsed_seconds),
                "task_id": result.task_id,
                "Access-Control-Expose-Headers": (
                    "X-Reduction-Percentage, X-Old-Size, X-New-Size, "
                    "X-Compression-Engine, X-Compression-Elapsed, task_id"
                )
            }
        )
    except HTTPException as exc:
        logger.error(f"Compression Collapse: {exc.detail}")
        if 'log_telemetry' in globals():
            log_telemetry("Compress", "failure", 0)
        raise
    except Exception as e:
        logger.error(f"Compression Collapse: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("Compress", "failure", 0)
        raise HTTPException(status_code=500, detail="Matrix density reduction failed.")


@app.post("/html-to-pdf")
async def html_to_pdf_protocol(
    url: str | None = Form(None),
    html_file: UploadFile | None = File(None),
):
    """
    Converts either a remote webpage URL or an uploaded HTML file into PDF.
    """
    url = url.strip() if url else None
    if not url and html_file is None:
        raise HTTPException(status_code=400, detail="Provide either a URL or an HTML file.")
    if url and html_file is not None:
        raise HTTPException(status_code=400, detail="Provide only one input: URL or HTML file.")

    output_name = "arcane_capture.pdf"
    generated_size = 0

    try:
        if url:
            pdf_bytes = await html_to_pdf_service.render_url_to_pdf(url)
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.replace(".", "_") or "website"
            output_name = f"arcane_capture_{domain}.pdf"
        else:
            assert html_file is not None
            filename = (html_file.filename or "").strip()
            if not filename.lower().endswith((".html", ".htm")):
                raise HTTPException(status_code=400, detail="Uploaded file must be an .html or .htm file.")

            file_bytes = await html_file.read()
            if not file_bytes.strip():
                raise HTTPException(status_code=400, detail="Uploaded HTML file is empty.")

            try:
                html_content = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                html_content = file_bytes.decode("utf-8", errors="replace")

            pdf_bytes = await html_to_pdf_service.render_html_to_pdf(html_content)
            safe_stem = os.path.splitext(os.path.basename(filename))[0] or "uploaded_html"
            output_name = f"{safe_stem}.pdf"

        generated_size = len(pdf_bytes)
        if generated_size == 0:
            raise HTTPException(status_code=500, detail="Generated PDF was empty.")

        if 'log_telemetry' in globals():
            log_telemetry("HTML to PDF", "success", generated_size)

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{output_name}"'}
        )
    except HTTPException as exc:
        logger.error(f"HTML to PDF Failure: {exc.detail}")
        if 'log_telemetry' in globals():
            log_telemetry("HTML to PDF", "failure", generated_size)
        raise
    except Exception as e:
        logger.error(f"HTML to PDF Failure: {e}")
        if 'log_telemetry' in globals():
            log_telemetry("HTML to PDF", "failure", 0)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=500,
            detail="HTML to PDF conversion failed. Verify the source content and browser rendering dependencies."
        )
    
    # Explicit return for IDE static analysis clarity
    return None
    

@app.post("/pdf-to-excel")
async def pdf_to_excel_protocol(
    file: UploadFile = File(...)
):
    """
    Sovereign Spreadsheet Distillation: OPTIMIZED
    Parses vector table structures from PDF matrix with robust extraction and fallback.
    Zero-lag performance with async execution and proper error handling.
    Returns in-memory response without saving files.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF asset required for data extraction.")

    job_id = str(uuid.uuid4())
    file_size = 0

    try:
        # 1. Atomic Ingestion with async optimization
        content = await file.read()
        file_size = len(content)

        # 2. OPTIMIZED Table Extraction Sequence
        all_tabs = []
        
        # Use optimized extraction with PyMuPDF first, fallback to pdfplumber
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            for page_num in range(len(doc)):
                page = doc[page_num]
                tables = page.find_tables()
                
                for table_idx, table in enumerate(tables):
                    if not table or len(table.data) < 2:
                        continue
                    
                    try:
                        # Convert table to DataFrame with proper formatting
                        table_data = []
                        for row_idx, row in enumerate(table.data):
                            # Clean cell data and handle empty cells
                            clean_row = []
                            for cell in row:
                                if cell and str(cell).strip():
                                    clean_row.append(str(cell).strip())
                                else:
                                    clean_row.append("")
                            table_data.append(clean_row)
                        
                        if not table_data or len(table_data) < 2:
                            continue
                        
                        # Create DataFrame with proper headers
                        df = pd.DataFrame(table_data)
                        
                        # OPTIMIZED: Enhanced data cleaning
                        if hasattr(df, "map"):
                            df = df.map(lambda x: str(x).strip() if pd.notna(x) else "")
                        else:
                            df = df.applymap(lambda x: str(x).strip() if pd.notna(x) else "")
                        
                        # Assign optimized sheet name
                        sheet_name = f"Page{page_num+1}_Table{table_idx+1}"[:31]
                        all_tabs.append((df, sheet_name))
                        
                    except Exception as e:
                        logger.warning(f"Table extraction error on page {page_num}, table {table_idx}: {e}")
                        continue
            
            doc.close()
            
        except Exception as e:
            logger.warning(f"PyMuPDF extraction failed, falling back to pdfplumber: {e}")
        
        # FALLBACK: Use pdfplumber if PyMuPDF fails
        if not all_tabs:
            logger.info("Using pdfplumber fallback extraction")
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for i, page in enumerate(pdf.pages):
                    tables = page.extract_tables()
                    for j, table in enumerate(tables):
                        if not table:
                            continue
                             
                        try:
                            # Convert to DataFrame with robust processing
                            df = pd.DataFrame(table)
                             
                            # Production Guard: Filter out "Ghost Tables"
                            if df.empty or (df.shape[0] < 2 and df.shape[1] < 2):
                                continue
                             
                            # OPTIMIZED: Enhanced data cleaning
                            if hasattr(df, "map"):
                                df = df.map(lambda x: str(x).strip() if pd.notna(x) else "")
                            else:
                                df = df.applymap(lambda x: str(x).strip() if pd.notna(x) else "")
                             
                            # Assign optimized sheet name
                            sheet_name = f"Pg{i+1}_Tab{j+1}"[:31]
                            all_tabs.append((df, sheet_name))
                             
                        except Exception as e:
                            logger.warning(f"pdfplumber extraction error on page {i}, table {j}: {e}")
                            continue

        # 3. OPTIMIZED Validation and Fallback
        if not all_tabs:
            logger.warning("No tabular matrices detected. Engaging enhanced text extraction.")
            
            # Extract text with better formatting
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                full_text = []
                for p_num, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text and text.strip():
                        full_text.append(text.strip())
            
            if full_text:
                # Create structured text data
                text_content = "\n\n".join([f"Page {i+1}:\n{text}" for i, text in enumerate(full_text)])
                
                # Create DataFrame with proper structure
                df = pd.DataFrame({"Content": text_content.split('\n')})
                all_tabs.append((df, "Extracted_Text"))
            
            if not all_tabs:
                raise ValueError("No extractable content found in PDF")

        # 4. OPTIMIZED Excel Shard Synthesis (In-Memory)
        # Using optimized settings for production performance
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            for df, name in all_tabs: 
                # OPTIMIZED: Enhanced Excel formatting
                df.to_excel(writer, sheet_name=name, index=False, header=False)
                
                # Auto-adjust column width for better UX
                worksheet = writer.sheets[name]
                if hasattr(worksheet, 'set_column'):
                    for i, col in enumerate(df.columns):
                        # Calculate optimal column width
                        if len(df) > 0:
                            max_len = max(
                                df[col].astype(str).str.len().max() if hasattr(df[col], 'str') else 0,
                                len(col)  # Column header length
                            )
                            worksheet.set_column(i, 1, min(max(max_len, 10), 50))
            
            # OPTIMIZED: Enhanced workbook properties
            if hasattr(writer.book, 'properties'):
                writer.book.properties['title'] = f"PDF to Excel Conversion - {job_id}"
                writer.book.properties['subject'] = "Extracted from PDF"
                writer.book.properties['creator'] = "Arcane PDF Engine"
        
        # 5. OPTIMIZED Response with enhanced metadata (In-Memory)
        excel_buffer.seek(0)
        excel_bytes = excel_buffer.getvalue()
        output_size = len(excel_bytes)
        
        log_telemetry("PDF to Excel", "success", file_size)
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="xl_out_{job_id}.xlsx"',
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except ValueError as e:
        logger.error(f"PDF to Excel validation error: {e}")
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "detail": str(e)
            }
        )
    except Exception as e:
        logger.error(f"PDF to Excel protocol failed: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error", 
                "detail": "PDF to Excel conversion failed"
            }
        )


@app.post("/rotate-pdf")
async def rotate_pdf_protocol(
    file: UploadFile = File(...), 
    angle: int = Query(90)
):
    """
    Sovereign Rotation Engine:
    Realigns the orientation of all pages within the PDF matrix.
    Operates strictly in-memory for high-speed, secure processing.
    """
    # 1. Asset Validation
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid asset sequence. PDF required.")

    # 2. Angle Normalization
    # Standard PDF rotation only supports increments of 90 degrees
    valid_angle = angle % 360
    if valid_angle % 90 != 0:
        raise HTTPException(status_code=400, detail="Invalid rotation increment. Use 90, 180, or 270.")

    file_size = 0
    try:
        # 3. Stream Ingestion (Data Sovereignty)
        content = await file.read()
        file_size = len(content)
        
        # Load PDF directly from the binary buffer
        doc = fitz.open(stream=content, filetype="pdf")
        
        # 4. Matrix Realignment Sequence
        for page in doc:
            # Set absolute rotation based on increment
            # page.rotation + valid_angle ensures it rotates relative to current state
            page.set_rotation((page.rotation + valid_angle) % 360)
            
        # 5. Distillation & Optimization (In-Memory)
        output_buffer = io.BytesIO()
        
        # garbage=3: Aggressively remove unused objects
        # deflate=True: Use Flate compression for the internal stream
        doc.save(
            output_buffer, 
            garbage=3, 
            deflate=True, 
            clean=True
        )
        doc.close()
        
        pdf_payload = output_buffer.getvalue()
        output_buffer.close()

        # Log Successful Orientation Telemetry
        if 'log_telemetry' in globals():
            log_telemetry(f"Rotate PDF ({valid_angle}°)", "success", file_size)

        # 6. Finalize Response
        return Response(
            content=pdf_payload,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=arcane_rotated_{file.filename}",
                "X-Rotation-Applied": str(valid_angle),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Rotation-Applied"
            }
        )

    except Exception as e:
        logger.error(f"Orientation Sequence Failed: {e}")
        log_telemetry("Rotate PDF", "failure", file_size)
        raise HTTPException(status_code=500, detail="Matrix orientation sequence collapsed.")

# --- IMAGE PROCESSING ENDPOINTS ---

SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".tiff", ".tif", ".webp", ".bmp"}

def _is_image_upload(file: UploadFile) -> bool:
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    return content_type.startswith("image/") or os.path.splitext(filename)[1] in SUPPORTED_IMAGE_EXTENSIONS

async def _read_image_uploads(files: list[UploadFile]) -> Tuple[List[bytes], int]:
    if not files:
        raise HTTPException(status_code=400, detail="No image files provided")

    file_data_list = []
    total_size = 0
    for file in files:
        if not _is_image_upload(file):
            raise HTTPException(status_code=400, detail=f"File {file.filename or 'upload'} is not a supported image")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"File {file.filename or 'upload'} is empty")

        file_data_list.append(content)
        total_size += len(content)

    return file_data_list, total_size

@app.post("/img/compress")
async def compress_image_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    quality: int = Form(85)
):
    """Compress images while maintaining quality"""
    total_size = 0
    try:
        # Validate quality parameter
        if not 1 <= quality <= 100:
            raise HTTPException(status_code=400, detail="Quality must be between 1 and 100")
        
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.compress_image(file_data_list, quality)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Compress Image", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Compress Image", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"Image compression endpoint failed: {str(e)}")
        log_telemetry("Compress Image", "failure", total_size)
        raise HTTPException(status_code=500, detail="Image compression failed")

@app.post("/img/resize")
async def resize_image_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    width: int = Form(800),
    height: int = Form(600),
    maintain_aspect: bool = Form(True)
):
    """Resize images with aspect ratio preservation option"""
    total_size = 0
    try:
        # Validate dimensions
        if width <= 0 or height <= 0:
            raise HTTPException(status_code=400, detail="Width and height must be positive")
        
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.resize_image(file_data_list, width, height, maintain_aspect)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Resize Image", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Resize Image", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"Image resize endpoint failed: {str(e)}")
        log_telemetry("Resize Image", "failure", total_size)
        raise HTTPException(status_code=500, detail="Image resize failed")

@app.post("/img/convert-to-jpg")
async def convert_to_jpg_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...)
):
    """Convert various image formats to JPG"""
    total_size = 0
    try:
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.convert_to_jpg(file_data_list)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Convert to JPG", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Convert to JPG", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"JPG conversion endpoint failed: {str(e)}")
        log_telemetry("Convert to JPG", "failure", total_size)
        raise HTTPException(status_code=500, detail="JPG conversion failed")

@app.post("/img/convert-from-jpg")
async def convert_from_jpg_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    target_format: str = Form("png")
):
    """Convert JPG to other formats (PNG, WEBP, GIF)"""
    total_size = 0
    try:
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.convert_from_jpg(file_data_list, target_format)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Convert from JPG", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Convert from JPG", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"JPG conversion endpoint failed: {str(e)}")
        log_telemetry("Convert from JPG", "failure", total_size)
        raise HTTPException(status_code=500, detail="JPG conversion failed")

@app.post("/img/create-gif")
async def create_gif_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    duration: float = Form(0.5),
    loop: int = Form(0)
):
    """Create animated GIF from multiple images"""
    total_size = 0
    try:
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.create_animated_gif(file_data_list, duration, loop)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Create Animated GIF", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Create Animated GIF", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"GIF creation endpoint failed: {str(e)}")
        log_telemetry("Create Animated GIF", "failure", total_size)
        raise HTTPException(status_code=500, detail="GIF creation failed")

@app.post("/img/upscale")
async def upscale_image_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    scale_factor: float = Form(2.0)
):
    """Upscale images using advanced interpolation"""
    total_size = 0
    try:
        # Validate scale factor
        if scale_factor <= 0:
            raise HTTPException(status_code=400, detail="Scale factor must be positive")
        
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.upscale_image(file_data_list, scale_factor)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Upscale Image", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Upscale Image", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"Image upscaling endpoint failed: {str(e)}")
        log_telemetry("Upscale Image", "failure", total_size)
        raise HTTPException(status_code=500, detail="Image upscaling failed")

@app.post("/img/remove-bg")
async def remove_background_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...)
):
    """Remove background using basic color detection"""
    total_size = 0
    try:
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.remove_background(file_data_list)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Remove Background", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Remove Background", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"Background removal endpoint failed: {str(e)}")
        log_telemetry("Remove Background", "failure", total_size)
        raise HTTPException(status_code=500, detail="Background removal failed")


def _is_image_upload(file: UploadFile):
    return file.content_type in ["image/jpeg", "image/png", "image/webp"]

@app.post("/img/watermark")
async def watermark_image_endpoint(
    files: UploadFile = File(...),  # Frontend: formData.append("files", file)
    text: str = Form("Arcane Engine"),
    opacity: str = Form("0.3"),
    rotation: str = Form("45"),
    font_size: str = Form("60"),
    color: str = Form("#CC208E"),
    mode: str = Form("center")
):
    """
    Sovereign Image Watermark Projection:
    Injects high-density text layers into raster assets with the same
    center/tile projection model as the PDF watermark engine.
    """
    job_id = uuid.uuid4().hex
    original_name = files.filename or "image"
    clean_stem = "".join(c for c in os.path.splitext(original_name)[0] if c.isalnum() or c in "._- ").strip() or "image"
    output_filename = f"wm_img_{job_id}_{clean_stem}.png"
    output_path = os.path.join(TEMP_DIR, output_filename)
    file_size = 0

    try:
        if not _is_image_upload(files):
            raise HTTPException(status_code=400, detail="Unsupported image format.")

        content = await files.read()
        file_size = len(content)
        if not content:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")

        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Watermark text is required.")

        try:
            opacity_val = max(0.0, min(1.0, float(opacity)))
            angle = float(rotation)
            requested_size = int(font_size)
            h = color.lstrip("#")
            if not re.match(r"^[0-9a-fA-F]{6}$", h):
                h = "CC208E"
            rgb = tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid parameter shard detected.")

        mode = mode.lower().strip()
        if mode not in {"center", "tile"}:
            raise HTTPException(status_code=400, detail="Invalid watermark mode.")

        try:
            source = Image.open(io.BytesIO(content))
            source.load()
            source = ImageOps.exif_transpose(source).convert("RGBA")
        except Exception as pil_error:
            logger.warning(f"Image decode failed: {pil_error}")
            raise HTTPException(status_code=400, detail="Invalid or unsupported image asset.")

        if source.width <= 0 or source.height <= 0:
            raise HTTPException(status_code=400, detail="Invalid image dimensions.")

        width, height = source.size
        baseline_size = max(1, int(width * 0.05))
        size = max(1, min(1000, requested_size or baseline_size))

        try:
            font = ImageFont.truetype("DejaVuSans.ttf", size)
        except Exception:
            font = ImageFont.load_default()

        alpha = int(opacity_val * 255)
        watermark_layer = Image.new("RGBA", (width, height), (255, 255, 255, 0))
        draw = ImageDraw.Draw(watermark_layer)
        text_fill = (*rgb, alpha)

        if mode == "center":
            draw.text(
                (width / 2, height / 2),
                text,
                font=font,
                fill=text_fill,
                anchor="mm",
            )
        else:
            x_step = max(1, width // 4)
            y_step = max(1, height // 4)
            for x in range(x_step // 2, width, x_step):
                for y in range(y_step // 2, height, y_step):
                    draw.text(
                        (x, y),
                        text,
                        font=font,
                        fill=text_fill,
                        anchor="mm",
                    )

        rotated_layer = watermark_layer.rotate(
            angle,
            resample=Image.Resampling.BICUBIC,
            center=(width / 2, height / 2),
        )

        final_img = Image.alpha_composite(source, rotated_layer)
        final_img.save(output_path, "PNG", optimize=True)

        log_telemetry("Watermark Image", "success", file_size)

        return FileResponse(
            output_path,
            filename=f"watermarked_{clean_stem}.png",
            media_type="image/png",
        )

    except HTTPException:
        log_telemetry("Watermark Image", "failure", file_size)
        if os.path.exists(output_path):
            os.remove(output_path)
        raise
    except Exception as e:
        logger.error(f"Image watermark projection failed: {e}")
        log_telemetry("Watermark Image", "failure", file_size)
        if os.path.exists(output_path):
            os.remove(output_path)
        raise HTTPException(status_code=500, detail="Image watermark projection failed.")

        
@app.post("/img/rotate")
async def rotate_image_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    angle: float = Form(90)
):
    """Rotate images by specified angle"""
    total_size = 0
    try:
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.rotate_image(file_data_list, angle)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Rotate Image", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Rotate Image", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"Image rotation endpoint failed: {str(e)}")
        log_telemetry("Rotate Image", "failure", total_size)
        raise HTTPException(status_code=500, detail="Image rotation failed")

@app.post("/img/crop")
async def crop_image_endpoint(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    x: int = Form(0),
    y: int = Form(0),
    width: int = Form(100),
    height: int = Form(100)
):
    """Crop images to specified dimensions"""
    total_size = 0
    try:
        # Validate crop parameters
        if x < 0 or y < 0 or width <= 0 or height <= 0:
            raise HTTPException(status_code=400, detail="Invalid crop parameters")
        
        file_data_list, total_size = await _read_image_uploads(files)
        
        # Process images
        result = await image_service.crop_image(file_data_list, x, y, width, height)
        
        if result.status == "error":
            raise HTTPException(status_code=500, detail=result.error)

        log_telemetry("Crop Image", "success", total_size)
        
        return {
            "status": result.status,
            "job_id": result.job_id,
            "tool": result.tool,
            "data": result.data,
            "metadata": result.metadata
        }
        
    except HTTPException:
        log_telemetry("Crop Image", "failure", total_size)
        raise
    except Exception as e:
        logger.error(f"Image cropping endpoint failed: {str(e)}")
        log_telemetry("Crop Image", "failure", total_size)
        raise HTTPException(status_code=500, detail="Image cropping failed")


# --- SYSTEM HEALTH ---
@app.get("/health")
async def health():
    return {"status": "Arcane Sovereign Engine Active", "os": os.name}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
