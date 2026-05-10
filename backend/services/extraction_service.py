"""
High-Performance Text Extraction Service for Digital Sovereignty PDF Cloning Engine
Provides structure-aware text extraction with OCR fallback and parallel processing
"""

import io
import logging
import pdfplumber
import fitz  # PyMuPDF
from typing import Dict, Any, List, Optional, Callable, Tuple
from dataclasses import dataclass
import re
import threading

logger = logging.getLogger(__name__)

@dataclass
class ExtractionResult:
    """Result of text extraction"""
    text: str
    structure: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    extraction_method: str
    page_count: int
    char_count: int

class ExtractionService:
    """High-performance text extraction with structure analysis"""
    
    def __init__(self):
        self._lock = threading.Lock()
        
    def extract_text(self, file_data: bytes, progress_callback: Optional[Callable] = None, **params) -> Dict[str, Any]:
        """
        Extract text from PDF with structure analysis
        """
        try:
            # Choose extraction method based on params
            use_structure = params.get('use_structure', True)
            use_ocr_fallback = params.get('use_ocr_fallback', True)
            
            if use_structure:
                result = self._extract_with_structure(file_data, progress_callback)
            else:
                result = self._extract_plain_text(file_data, progress_callback)
            
            # OCR fallback if extraction failed and fallback is enabled
            if use_ocr_fallback and (not result.text.strip() or len(result.text.strip()) < 50):
                logger.info("Text extraction insufficient, trying OCR fallback")
                ocr_result = self._extract_with_ocr(file_data, progress_callback)
                if ocr_result.text.strip():
                    result = ocr_result
                    result.extraction_method = "ocr_fallback"
            
            return self._format_result(result)
            
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            return {
                "status": "error",
                "tool": "extraction",
                "message": str(e),
                "data": None
            }
    
    def _extract_with_structure(self, file_data: bytes, progress_callback: Optional[Callable] = None) -> ExtractionResult:
        """Extract text with structure analysis"""
        elements = []
        total_chars = 0
        page_count = 0
        
        try:
            with pdfplumber.open(io.BytesIO(file_data)) as pdf:
                page_count = len(pdf.pages)
                
                for page_num, page in enumerate(pdf.pages):
                    try:
                        # Update progress
                        if progress_callback:
                            progress = int((page_num / page_count) * 50)  # Structure analysis is first 50%
                            progress_callback(progress)
                        
                        # Extract with character information
                        chars = page.chars
                        if not chars:
                            # Fallback to simple text extraction
                            text = page.extract_text()
                            if text:
                                elements.append({
                                    "type": "paragraph",
                                    "text": text.strip(),
                                    "page": page_num + 1
                                })
                                total_chars += len(text)
                            continue
                        
                        # Group characters by lines
                        lines = {}
                        for char in chars:
                            line_key = (char['top'], char['bottom'])
                            if line_key not in lines:
                                lines[line_key] = []
                            lines[line_key].append(char)
                        
                        # Sort lines and reconstruct text
                        sorted_lines = sorted(lines.items(), key=lambda x: x[0][0])
                        page_text = ""
                        
                        for line_key, line_chars in sorted_lines:
                            line_chars.sort(key=lambda x: x['x0'])
                            line_text = "".join(char['text'] for char in line_chars)
                            page_text += line_text + "\n"
                        
                        # Analyze structure
                        if page_text.strip():
                            structured_elements = self._analyze_text_structure(page_text.strip(), page_num + 1)
                            elements.extend(structured_elements)
                            total_chars += len(page_text)
                    
                    except Exception as e:
                        logger.warning(f"Structure analysis failed for page {page_num}: {e}")
                        # Fallback to plain text for this page
                        text = page.extract_text()
                        if text:
                            elements.append({
                                "type": "paragraph",
                                "text": text.strip(),
                                "page": page_num + 1
                            })
                            total_chars += len(text)
                
                # Final progress update
                if progress_callback:
                    progress_callback(50)
                
                return ExtractionResult(
                    text="\n".join(el["text"] for el in elements),
                    structure=elements,
                    metadata={
                        "total_elements": len(elements),
                        "extraction_method": "structure_aware"
                    },
                    extraction_method="structure_aware",
                    page_count=page_count,
                    char_count=total_chars
                )
        
        except Exception as e:
            logger.error(f"Structure extraction failed: {e}")
            # Fallback to plain text
            return self._extract_plain_text(file_data, progress_callback)
    
    def _extract_plain_text(self, file_data: bytes, progress_callback: Optional[Callable] = None) -> ExtractionResult:
        """Extract plain text without structure analysis"""
        try:
            with pdfplumber.open(io.BytesIO(file_data)) as pdf:
                page_count = len(pdf.pages)
                text_parts = []
                total_chars = 0
                
                for page_num, page in enumerate(pdf.pages):
                    # Update progress
                    if progress_callback:
                        progress = int((page_num / page_count) * 100)
                        progress_callback(progress)
                    
                    text = page.extract_text()
                    if text:
                        text_parts.append(text.strip())
                        total_chars += len(text)
                
                return ExtractionResult(
                    text="\n\n".join(text_parts),
                    structure=[{
                        "type": "paragraph",
                        "text": "\n\n".join(text_parts)
                    }],
                    metadata={
                        "total_elements": 1,
                        "extraction_method": "plain_text"
                    },
                    extraction_method="plain_text",
                    page_count=page_count,
                    char_count=total_chars
                )
        
        except Exception as e:
            logger.error(f"Plain text extraction failed: {e}")
            raise
    
    def _extract_with_ocr(self, file_data: bytes, progress_callback: Optional[Callable] = None) -> ExtractionResult:
        """Extract text using OCR (placeholder - would integrate with OCR service)"""
        try:
            # For now, return minimal result
            # In production, this would call the OCR service
            logger.warning("OCR extraction not fully implemented - returning empty result")
            return ExtractionResult(
                text="",
                structure=[],
                metadata={"extraction_method": "ocr_failed"},
                extraction_method="ocr_failed",
                page_count=0,
                char_count=0
            )
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            raise
    
    def _analyze_text_structure(self, text: str, page_num: int) -> List[Dict[str, Any]]:
        """Analyze text to identify structure elements"""
        elements = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Heading detection
            if self._is_heading(line):
                elements.append({
                    "type": "heading",
                    "text": line,
                    "level": self._detect_heading_level(line),
                    "page": page_num
                })
            # List detection
            elif self._is_list_item(line):
                elements.append({
                    "type": "list",
                    "text": line,
                    "page": page_num
                })
            # Default to paragraph
            else:
                elements.append({
                    "type": "paragraph",
                    "text": line,
                    "page": page_num
                })
        
        return elements
    
    def _is_heading(self, line: str) -> bool:
        """Detect if a line is likely a heading"""
        if len(line) < 100 and (
            line.isupper() or  # ALL CAPS
            line.endswith(':') or  # Ends with colon
            re.match(r'^\d+\.\s+', line) or  # Numbered heading
            re.match(r'^[A-Z][A-Z\s]*$', line)  # Short uppercase
        ):
            return True
        return False
    
    def _detect_heading_level(self, line: str) -> int:
        """Detect heading level (1-3)"""
        if re.match(r'^\d+\.\d+\.\s+', line):
            return 3
        elif re.match(r'^\d+\.\s+', line):
            return 2
        else:
            return 1
    
    def _is_list_item(self, line: str) -> bool:
        """Detect if a line is a list item"""
        return bool(re.match(r'^[•\-\*]\s+|^\d+[\.)]\s+', line))
    
    def _format_result(self, result: ExtractionResult) -> Dict[str, Any]:
        """Format extraction result for API response"""
        return {
            "status": "success",
            "tool": "extraction",
            "data": {
                "text": result.text,
                "structure": result.structure,
                "metadata": {
                    **result.metadata,
                    "page_count": result.page_count,
                    "char_count": result.char_count,
                    "extraction_method": result.extraction_method
                }
            },
            "error": None
        }

# Global extraction service instance
extraction_service = ExtractionService()
