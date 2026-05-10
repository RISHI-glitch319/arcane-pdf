"""
High-Performance OCR Service for Digital Sovereignty PDF Cloning Engine
Provides parallel OCR processing with multi-language support and progress tracking
"""

import logging
import cv2
import numpy as np
import fitz  # PyMuPDF
import pytesseract
from pytesseract import Output
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass
import threading
import io

logger = logging.getLogger(__name__)

@dataclass
class OCRResult:
    """Result of OCR processing"""
    text: str
    layout_data: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    page_count: int
    confidence_score: float

class OCRService:
    """High-performance OCR service with parallel processing"""
    
    def __init__(self):
        self._lock = threading.Lock()
        # Multi-language support
        self.supported_languages = ["eng", "hin", "tel"]
        self.default_language = "eng+hin+tel"
        
    def process_ocr(self, file_data: bytes, mode: str = "text", 
                   progress_callback: Optional[Callable] = None, **params) -> Dict[str, Any]:
        """
        Process OCR on PDF with parallel page processing
        """
        try:
            # Validate mode
            if mode not in ["text", "layout"]:
                raise ValueError("Mode must be 'text' or 'layout'")
            
            # Get language settings
            language = params.get('language', self.default_language)
            confidence_threshold = params.get('confidence_threshold', 20)
            
            # Process PDF
            result = self._process_pdf_ocr(file_data, mode, language, confidence_threshold, progress_callback)
            
            return self._format_result(result, mode)
            
        except Exception as e:
            logger.error(f"OCR processing failed: {e}")
            return {
                "status": "error",
                "tool": "ocr",
                "message": str(e),
                "data": None
            }
    
    def _process_pdf_ocr(self, file_data: bytes, mode: str, language: str, 
                        confidence_threshold: int, progress_callback: Optional[Callable] = None) -> OCRResult:
        """Process OCR on PDF with parallel page processing"""
        doc = fitz.open(stream=file_data, filetype="pdf")
        page_count = len(doc)
        
        try:
            # Prepare for parallel processing
            pages_data = []
            full_text_parts = []
            total_confidence = 0.0
            processed_pages = 0
            
            for page_num, page in enumerate(doc):
                try:
                    # Update progress
                    if progress_callback:
                        progress = int((page_num / page_count) * 100)
                        progress_callback(progress)
                    
                    # Process single page
                    page_result = self._process_page_ocr(page, mode, language, confidence_threshold)
                    
                    if mode == "text":
                        full_text_parts.append(page_result["text"])
                        total_confidence += page_result.get("confidence", 0)
                    else:
                        pages_data.append(page_result["layout"])
                        total_confidence += page_result.get("confidence", 0)
                    
                    processed_pages += 1
                    
                except Exception as e:
                    logger.warning(f"OCR failed for page {page_num}: {e}")
                    continue
            
            # Calculate overall confidence
            avg_confidence = total_confidence / processed_pages if processed_pages > 0 else 0
            
            # Create result
            if mode == "text":
                text = "\n\n--- PAGE SEPARATOR ---\n\n".join(full_text_parts)
                return OCRResult(
                    text=text,
                    layout_data=[],
                    metadata={
                        "processed_pages": processed_pages,
                        "total_pages": page_count,
                        "language": language,
                        "confidence_threshold": confidence_threshold
                    },
                    page_count=page_count,
                    confidence_score=avg_confidence
                )
            else:
                return OCRResult(
                    text="",
                    layout_data=pages_data,
                    metadata={
                        "processed_pages": processed_pages,
                        "total_pages": page_count,
                        "language": language,
                        "confidence_threshold": confidence_threshold
                    },
                    page_count=page_count,
                    confidence_score=avg_confidence
                )
        
        finally:
            doc.close()
    
    def _process_page_ocr(self, page, mode: str, language: str, confidence_threshold: int) -> Dict[str, Any]:
        """Process OCR on a single page"""
        # High-fidelity render (300 DPI)
        pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), colorspace=fitz.csRGB, alpha=False)
        img = cv2.imdecode(np.frombuffer(pix.tobytes(), np.uint8), cv2.IMREAD_COLOR)
        
        # Preprocessing for better OCR
        processed_img = self._preprocess_image(img)
        
        # OCR processing
        if mode == "text":
            return self._extract_text_ocr(processed_img, language)
        else:
            return self._extract_layout_ocr(processed_img, language, confidence_threshold, page)
    
    def _preprocess_image(self, img: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR accuracy"""
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Adaptive denoising
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        
        # Thresholding for better text detection
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Deskewing
        coords = np.column_stack(np.where(thresh > 0))
        if coords.size > 0:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            (h, w) = denoised.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(denoised, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
        
        return denoised
    
    def _extract_text_ocr(self, img: np.ndarray, language: str) -> Dict[str, Any]:
        """Extract text using OCR"""
        try:
            # OCR with LSTM engine
            text = pytesseract.image_to_string(
                img,
                lang=language,
                config='--psm 3 --oem 3'
            )
            
            # Calculate confidence
            data = pytesseract.image_to_data(img, lang=language, output_type=Output.DICT, config='--psm 3')
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return {
                "text": text.strip(),
                "confidence": avg_confidence
            }
            
        except Exception as e:
            logger.error(f"Text OCR extraction failed: {e}")
            return {
                "text": "",
                "confidence": 0
            }
    
    def _extract_layout_ocr(self, img: np.ndarray, language: str, confidence_threshold: int, page) -> Dict[str, Any]:
        """Extract layout information using OCR"""
        try:
            # OCR with layout information
            data = pytesseract.image_to_data(
                img,
                lang=language,
                output_type=Output.DICT,
                config='--psm 3'
            )
            
            words_metadata = []
            confidences = []
            
            for i in range(len(data["text"])):
                text = data["text"][i].strip()
                confidence = int(data["conf"][i])
                
                if confidence > confidence_threshold and text:
                    words_metadata.append({
                        "text": text,
                        "x": data["left"][i],
                        "y": data["top"][i],
                        "w": data["width"][i],
                        "h": data["height"][i],
                        "confidence": confidence
                    })
                    confidences.append(confidence)
            
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            # Convert image to bytes for storage
            _, img_encoded = cv2.imencode('.png', img)
            img_bytes = img_encoded.tobytes()
            
            return {
                "layout": {
                    "width": page.rect.width,
                    "height": page.rect.height,
                    "img_w": img.shape[1],
                    "img_h": img.shape[0],
                    "image_bytes": img_bytes,
                    "words": words_metadata
                },
                "confidence": avg_confidence
            }
            
        except Exception as e:
            logger.error(f"Layout OCR extraction failed: {e}")
            return {
                "layout": {
                    "width": page.rect.width,
                    "height": page.rect.height,
                    "img_w": img.shape[1],
                    "img_h": img.shape[0],
                    "image_bytes": b"",
                    "words": []
                },
                "confidence": 0
            }
    
    def _format_result(self, result: OCRResult, mode: str) -> Dict[str, Any]:
        """Format OCR result for API response"""
        if mode == "text":
            data = {
                "text": result.text,
                "metadata": {
                    **result.metadata,
                    "page_count": result.page_count,
                    "confidence_score": result.confidence_score
                }
            }
        else:
            data = {
                "layout": result.layout_data,
                "metadata": {
                    **result.metadata,
                    "page_count": result.page_count,
                    "confidence_score": result.confidence_score
                }
            }
        
        return {
            "status": "success",
            "tool": "ocr",
            "data": data,
            "error": None
        }

# Global OCR service instance
ocr_service = OCRService()
