import asyncio
import io
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageFont
import cv2
import numpy as np
import pytesseract
import logging
from datetime import datetime
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import gc

logger = logging.getLogger(__name__)
telemetry_logger = None

# OPTIMIZATION: CPU-only constrained threads to prevent Out-Of-Memory thrashing
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["U2NET_HOME"] = os.path.join(os.path.dirname(__file__), ".u2net")
cv2.setNumThreads(1)

try:
    from rembg import remove, new_session
    # CPU Lightweight model initialization
    rembg_session = new_session("u2netp")
except ImportError:
    logger.warning("rembg is not installed. Background removal will fail.")
    rembg_session = None

@dataclass
class ImageProcessingResult:
    status: str
    job_id: str
    tool: str
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    error: Optional[str] = None

router = APIRouter(prefix="/image", tags=["image"])

def set_telemetry_logger(callback):
    global telemetry_logger
    telemetry_logger = callback

def log_image_telemetry(tool_name: str, status: str, size_bytes: int) -> None:
    if telemetry_logger is None:
        return
    try:
        telemetry_logger(tool_name, status, size_bytes)
    except Exception as exc:
        logger.warning(f"Image telemetry failed for {tool_name}: {exc}")

def _is_supported_image_upload(file: UploadFile) -> bool:
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    valid_extensions = {".jpg", ".jpeg", ".png", ".gif", ".tiff", ".tif", ".webp", ".bmp", ".heic", ".raw"}
    return content_type.startswith("image/") or os.path.splitext(filename)[1] in valid_extensions

async def read_image_uploads(files: List[UploadFile]) -> tuple[List[bytes], int]:
    if not files:
        raise HTTPException(status_code=400, detail="No image files provided")

    file_bytes = []
    total_size = 0
    for file in files:
        if not _is_supported_image_upload(file):
            raise HTTPException(status_code=400, detail=f"File {file.filename or 'upload'} is not a supported image")

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"File {file.filename or 'upload'} is empty")

        file_bytes.append(content)
        total_size += len(content)

    return file_bytes, total_size

class ImageService:
    def __init__(self):
        self.temp_dir = os.getenv("TEMP_DIR", "temp_uploads")
        self.outputs_dir = os.getenv("TEMP_DIR", "temp_uploads")
        # CPU OPTIMIZATION: Hard limit max_workers to 2 defensively.
        self.executor = ThreadPoolExecutor(max_workers=min(2, os.cpu_count() or 2))
        self.supported_formats = {
            'input': ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.webp', '.bmp', '.heic', '.raw'],
            'output': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        }
        
    async def _run_async(self, func, *args):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self.executor, func, *args)

    # ---------------- Compress -----------------
    async def compress_image(self, files: List[bytes], quality: int = 85) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._compress_images_sync, files, quality, job_id)
            return ImageProcessingResult("success", job_id, "compress", {"files": results}, {"total": len(files), "quality": quality, "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "compress", {"files": []}, {}, str(e))
    
    def _compress_images_sync(self, files: List[bytes], quality: int, job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                output_filename = f"compressed_{job_id}_{i}.jpg"
                output_path = os.path.join(self.outputs_dir, output_filename)
                
                img.save(output_path, 'JPEG', quality=quality, optimize=True)
                
                orig_size = len(file_data)
                comp_size = os.path.getsize(output_path)
                reduction = max(0, int((1 - comp_size / orig_size) * 100)) if orig_size > 0 else 0
                
                output_files.append({
                    "url": f"/outputs/{output_filename}", 
                    "filename": output_filename,
                    "original_size": orig_size,
                    "compressed_size": comp_size,
                    "reduction_percentage": reduction
                })
                del img
                gc.collect()
            except Exception as e:
                logger.error(f"Compress err {i}: {e}")
        return output_files

    # ---------------- Resize -----------------
    async def resize_image(self, files: List[bytes], width: int, height: int, maintain_aspect: bool = True) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._resize_images_sync, files, width, height, maintain_aspect, job_id)
            return ImageProcessingResult("success", job_id, "resize", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "resize", {"files": []}, {}, str(e))
    
    def _resize_images_sync(self, files: List[bytes], width: int, height: int, maintain_aspect: bool, job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                if maintain_aspect:
                    img.thumbnail((width, height), Image.Resampling.LANCZOS)
                    resized_img = img
                else:
                    resized_img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                output_filename = f"resized_{job_id}_{i}.jpg"
                output_path = os.path.join(self.outputs_dir, output_filename)
                resized_img.save(output_path, 'JPEG', quality=90)
                output_files.append({"url": f"/temp_uploads/{output_filename}", "filename": output_filename})
                del img
                del resized_img
                gc.collect()
            except Exception as e:
                logger.error(f"Resize err {i}: {e}")
        return output_files

    # ---------------- Convert -----------------
    async def convert_image(self, files: List[bytes], target_format: str = "png") -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._convert_images_sync, files, target_format, job_id)
            return ImageProcessingResult("success", job_id, "convert", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "convert", {"files": []}, {}, str(e))
    
    def _convert_images_sync(self, files: List[bytes], target_format: str, job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                if target_format.lower() in ['jpg', 'jpeg'] and img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                output_filename = f"converted_{job_id}_{i}.{target_format.lower()}"
                output_path = os.path.join(self.outputs_dir, output_filename)
                
                save_params = {}
                if target_format.lower() in ['jpg', 'jpeg']:
                    save_params = {'format': 'JPEG', 'quality': 95}
                elif target_format.lower() == 'png':
                    save_params = {'format': 'PNG'}
                elif target_format.lower() == 'webp':
                    save_params = {'format': 'WEBP', 'quality': 90}
                else:
                    save_params = {'format': target_format.upper()}
                
                img.save(output_path, **save_params)
                output_files.append({"url": f"/temp_uploads/{output_filename}", "filename": output_filename})
                del img
                gc.collect()
            except Exception as e:
                logger.error(f"Convert err {i}: {e}")
        return output_files

    # ---------------- Enhance -----------------
    async def enhance_image(self, files: List[bytes], brightness: float, contrast: float, sharpness: float, noise_reduction: bool) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._enhance_images_sync, files, brightness, contrast, sharpness, noise_reduction, job_id)
            return ImageProcessingResult("success", job_id, "enhance", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "enhance", {"files": []}, {}, str(e))
    
    def _enhance_images_sync(self, files: List[bytes], b: float, c: float, s: float, nr: bool, job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                if nr:
                    # CPU Intensive Denoiser
                    cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                    cv_img = cv2.fastNlMeansDenoisingColored(cv_img, None, 10, 10, 7, 21)
                    img = Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))
                
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                if b != 1.0: img = ImageEnhance.Brightness(img).enhance(b)
                if c != 1.0: img = ImageEnhance.Contrast(img).enhance(c)
                if s != 1.0: img = ImageEnhance.Sharpness(img).enhance(s)
                
                output_filename = f"enhanced_{job_id}_{i}.jpg"
                output_path = os.path.join(self.outputs_dir, output_filename)
                img.save(output_path, 'JPEG', quality=95)
                output_files.append({"url": f"/temp_uploads/{output_filename}", "filename": output_filename})
                del img
                gc.collect()
            except Exception as e:
                logger.error(f"Enhance err {i}: {e}")
        return output_files

    # ---------------- OCR Visual Overlay -----------------
    async def ocr_image(self, files: List[bytes]) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._ocr_images_sync, files, job_id)
            return ImageProcessingResult("success", job_id, "ocr", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "ocr", {"files": []}, {}, str(e))
    
    def _ocr_images_sync(self, files: List[bytes], job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data)).convert('RGB')
                
                gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
                data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
                
                draw = ImageDraw.Draw(img)
                extracted_text_arr = []
                
                for j in range(len(data['text'])):
                    if int(data['conf'][j]) > 60:
                        text = data['text'][j].strip()
                        if text:
                            (x, y, w, h) = (data['left'][j], data['top'][j], data['width'][j], data['height'][j])
                            draw.rectangle(((x, y), (x + w, y + h)), outline="magenta", width=2)
                            extracted_text_arr.append(text)
                
                # Save visual overlay
                ui_output_filename = f"ocr_overlay_{job_id}_{i}.jpg"
                ui_output_path = os.path.join(self.outputs_dir, ui_output_filename)
                img.save(ui_output_path, 'JPEG', quality=85)
                
                # Save extracted text
                txt_filename = f"ocr_data_{job_id}_{i}.txt"
                txt_path = os.path.join(self.outputs_dir, txt_filename)
                with open(txt_path, 'w', encoding='utf-8') as f:
                    f.write(" ".join(extracted_text_arr))
                
                output_files.append({
                    "url": f"/temp_uploads/{ui_output_filename}", 
                    "filename": ui_output_filename,
                    "text_url": f"/temp_uploads/{txt_filename}"
                })
                del img
                gc.collect()
            except Exception as e:
                logger.error(f"OCR err {i}: {e}")
        return output_files

    # ---------------- Rotate -----------------
    async def rotate_image(self, files: List[bytes], angle: int) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._rotate_images_sync, files, angle, job_id)
            return ImageProcessingResult("success", job_id, "rotate", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "rotate", {"files": []}, {}, str(e))
            
    def _rotate_images_sync(self, files: List[bytes], angle: int, job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                # Fix black output: Use expand=True and preserve color
                img = img.rotate(360 - angle, expand=True, fillcolor='white')
                # Ensure RGB mode after rotation
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                output_filename = f"rotated_{job_id}_{i}.jpg"
                output_path = os.path.join(self.outputs_dir, output_filename)
                img.save(output_path, 'JPEG', quality=95)
                
                output_files.append({"url": f"/temp_uploads/{output_filename}", "filename": output_filename})
                del img
                gc.collect()
            except Exception as e:
                logger.error(f"Rotate {i}: {e}")
        return output_files

    # ---------------- Remove Background -----------------
    async def remove_bg_image(self, files: List[bytes]) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._remove_bg_sync, files, job_id)
            return ImageProcessingResult("success", job_id, "remove_bg", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "remove_bg", {"files": []}, {}, str(e))
            
    def _remove_bg_sync(self, files: List[bytes], job_id: str) -> List[dict]:
        output_files = []
        if not rembg_session: return output_files
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Execute U2Net lightweight CPU inference with proper alpha handling
                result_img = remove(img, session=rembg_session, post_process_mask=True)
                # Ensure proper RGB conversion after background removal
                if result_img.mode != 'RGB':
                    result_img = result_img.convert('RGB')
                
                output_filename = f"nobg_{job_id}_{i}.png"
                output_path = os.path.join(self.outputs_dir, output_filename)
                result_img.save(output_path, 'PNG')
                
                output_files.append({"url": f"/temp_uploads/{output_filename}", "filename": output_filename})
                del img
                del result_img
                gc.collect()
            except Exception as e:
                logger.error(f"Remove BG {i}: {e}")
        return output_files

    # ---------------- Watermark -----------------
    async def watermark_image(self, files: List[bytes], text: str, opacity: float, position: str) -> ImageProcessingResult:
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        try:
            results = await self._run_async(self._watermark_images_sync, files, text, opacity, position, job_id)
            return ImageProcessingResult("success", job_id, "watermark", {"files": results}, {"total": len(files), "exec": (datetime.now() - start_time).total_seconds()})
        except Exception as e:
            return ImageProcessingResult("error", job_id, "watermark", {"files": []}, {}, str(e))
            
    def _watermark_images_sync(self, files: List[bytes], text: str, opacity: float, position: str, job_id: str) -> List[dict]:
        output_files = []
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data)).convert("RGBA")
                
                txt_layer = Image.new('RGBA', img.size, (255, 255, 255, 0))
                draw = ImageDraw.Draw(txt_layer)
                
                # Dynamic font sizing CPU logic
                font_size = int(img.width / 15)
                # Fallback to default sans using implicit loading or rudimentary PIL standard
                font = ImageFont.load_default()
                
                # Bounding calc - since ImageFont default lacks getsize in some modern PIL
                try:
                    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
                    w, h = right - left, bottom - top
                except:
                    w, h = len(text) * 10, 20
                
                x, y = 10, 10
                if position == "center":
                    x = (img.width - w) // 2
                    y = (img.height - h) // 2
                elif position == "bottom-right":
                    x = img.width - w - 20
                    y = img.height - h - 20
                    
                draw.text((x, y), text, font=font, fill=(255, 255, 255, int(255 * opacity)))
                combined = Image.alpha_composite(img, txt_layer).convert("RGB")
                
                output_filename = f"watermark_{job_id}_{i}.jpg"
                output_path = os.path.join(self.outputs_dir, output_filename)
                combined.save(output_path, 'JPEG', quality=95)
                
                output_files.append({"url": f"/temp_uploads/{output_filename}", "filename": output_filename})
                del img
                del txt_layer
                del combined
                gc.collect()
            except Exception as e:
                logger.error(f"Watermark {i}: {e}")
        return output_files

image_service = ImageService()

# ----------------- ROUTER ENDPOINTS -----------------

@router.post("/compress")
async def compress_image_endpoint(files: List[UploadFile] = File(...), quality: int = Form(85)):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.compress_image(file_bytes, quality)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="Compression failed")
        log_image_telemetry("Image Router Compress", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Compress", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Compress", "failure", total_size)
        raise HTTPException(status_code=500, detail="Compression failed")

@router.post("/resize")
async def resize_image_endpoint(files: List[UploadFile] = File(...), width: int = Form(800), height: int = Form(600), maintain_aspect: bool = Form(True)):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.resize_image(file_bytes, width, height, maintain_aspect)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="Resize failed")
        log_image_telemetry("Image Router Resize", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Resize", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Resize", "failure", total_size)
        raise HTTPException(status_code=500, detail="Resize failed")

@router.post("/convert")
async def convert_image_endpoint(files: List[UploadFile] = File(...), target_format: str = Form("png")):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.convert_image(file_bytes, target_format)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="Conversion failed")
        log_image_telemetry("Image Router Convert", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Convert", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Convert", "failure", total_size)
        raise HTTPException(status_code=500, detail="Conversion failed")

@router.post("/enhance")
async def enhance_image_endpoint(
    files: List[UploadFile] = File(...),
    brightness: float = Form(1.0),
    contrast: float = Form(1.0),
    sharpness: float = Form(1.0),
    noise_reduction: bool = Form(False)
):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.enhance_image(file_bytes, brightness, contrast, sharpness, noise_reduction)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="Enhancement failed")
        log_image_telemetry("Image Router Enhance", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Enhance", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Enhance", "failure", total_size)
        raise HTTPException(status_code=500, detail="Enhancement failed")

@router.post("/ocr")
async def ocr_image_endpoint(files: List[UploadFile] = File(...)):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.ocr_image(file_bytes)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="OCR failed")
        log_image_telemetry("Image Router OCR", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router OCR", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router OCR", "failure", total_size)
        raise HTTPException(status_code=500, detail="OCR failed")

@router.post("/rotate")
async def rotate_image_endpoint(files: List[UploadFile] = File(...), angle: int = Form(90)):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.rotate_image(file_bytes, angle)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="Rotate failed")
        log_image_telemetry("Image Router Rotate", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Rotate", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Rotate", "failure", total_size)
        raise HTTPException(status_code=500, detail="Rotate failed")

@router.post("/remove-bg")
async def remove_bg_endpoint(files: List[UploadFile] = File(...)):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.remove_bg_image(file_bytes)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="BG removal failed")
        log_image_telemetry("Image Router Remove Background", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Remove Background", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Remove Background", "failure", total_size)
        raise HTTPException(status_code=500, detail="BG removal failed")

@router.post("/watermark")
async def watermark_endpoint(files: List[UploadFile] = File(...), text: str = Form("Arcane"), opacity: float = Form(0.5), position: str = Form("center")):
    total_size = 0
    try:
        file_bytes, total_size = await read_image_uploads(files)
        result = await image_service.watermark_image(file_bytes, text, opacity, position)
        if result.status == "error":
            raise HTTPException(status_code=500, detail="Watermark failed")
        log_image_telemetry("Image Router Watermark", "success", total_size)
        return JSONResponse({"success": result.status == "success", "data": result.data["files"], "metadata": result.metadata})
    except HTTPException:
        log_image_telemetry("Image Router Watermark", "failure", total_size)
        raise
    except Exception:
        log_image_telemetry("Image Router Watermark", "failure", total_size)
        raise HTTPException(status_code=500, detail="Watermark failed")
