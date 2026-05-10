"""
High-Performance Compression Service for Digital Sovereignty PDF Cloning Engine
Provides parallel PDF compression with multiple optimization strategies
"""

import logging
import os
import subprocess
import threading
from typing import Dict, Any, Optional, Callable, Tuple
from dataclasses import dataclass
import fitz  # PyMuPDF
import io

logger = logging.getLogger(__name__)

@dataclass
class CompressionResult:
    """Result of PDF compression"""
    compressed_data: bytes
    original_size: int
    compressed_size: int
    compression_ratio: float
    metadata: Dict[str, Any]

class CompressionService:
    """High-performance PDF compression service"""
    
    def __init__(self, temp_dir: str = None, gs_exe: str = None):
        self.temp_dir = temp_dir or "/tmp"
        self.gs_exe = gs_exe or "gs"
        self._lock = threading.Lock()
        
    def compress_pdf(self, file_data: bytes, quality: str = "medium", 
                   progress_callback: Optional[Callable] = None, **params) -> Dict[str, Any]:
        """
        Compress PDF with multiple optimization strategies
        """
        try:
            # Validate quality
            quality_levels = {
                "low": {"dpi": 72, "quality": 25},
                "medium": {"dpi": 150, "quality": 50},
                "high": {"dpi": 300, "quality": 75}
            }
            
            if quality not in quality_levels:
                raise ValueError("Quality must be 'low', 'medium', or 'high'")
            
            quality_settings = quality_levels[quality]
            
            # Update progress
            if progress_callback:
                progress_callback(10)
            
            # Try multiple compression methods (prefer PyMuPDF for reliability)
            methods = [
                ("pyMuPDF", self._compress_with_pymupdf),
                ("ghostscript", self._compress_with_ghostscript)
            ]
            
            best_result = None
            best_ratio = float('inf')
            
            for method_name, method_func in methods:
                try:
                    if progress_callback:
                        progress_callback(20 + methods.index((method_name, method_func)) * 30)
                    
                    result = method_func(file_data, quality_settings, progress_callback)
                    
                    if result and result.compression_ratio < best_ratio:
                        best_result = result
                        best_ratio = result.compression_ratio
                        best_result.metadata["method"] = method_name
                        
                except Exception as e:
                    logger.warning(f"Compression method {method_name} failed: {e}")
                    # If Ghostscript fails, continue to PyMuPDF
                    if method_name == "ghostscript":
                        logger.info("Ghostscript failed, PyMuPDF will be used as fallback")
                    continue
            
            if not best_result:
                raise ValueError("All compression methods failed")
            
            if progress_callback:
                progress_callback(100)
            
            return self._format_result(best_result)
            
        except Exception as e:
            logger.error(f"PDF compression failed: {e}")
            return {
                "status": "error",
                "tool": "compression",
                "message": str(e),
                "data": None
            }
    
    def _compress_with_pymupdf(self, file_data: bytes, quality_settings: Dict[str, Any], 
                               progress_callback: Optional[Callable] = None) -> CompressionResult:
        """Compress PDF using PyMuPDF"""
        try:
            doc = fitz.open(stream=file_data, filetype="pdf")
            original_size = len(file_data)
            
            # Create compressed PDF
            compressed_doc = fitz.open()
            
            for page_num in range(len(doc)):
                if progress_callback:
                    progress = 25 + int((page_num / len(doc)) * 20)
                    progress_callback(progress)
                
                page = doc[page_num]
                
                # Compress page images
                pix = page.get_pixmap(dpi=quality_settings["dpi"], colorspace=fitz.csRGB, alpha=False)
                img_data = pix.tobytes("png")
                
                # Create new page with compressed image
                new_page = compressed_doc.new_page(width=page.rect.width, height=page.rect.height)
                new_page.insert_image(page.rect, stream=img_data)
            
            # Save compressed PDF
            compressed_bytes = compressed_doc.write(garbage=4, deflate=True)
            compressed_doc.close()
            doc.close()
            
            compressed_size = len(compressed_bytes)
            compression_ratio = compressed_size / original_size
            
            return CompressionResult(
                compressed_data=compressed_bytes,
                original_size=original_size,
                compressed_size=compressed_size,
                compression_ratio=compression_ratio,
                metadata={
                    "method": "pyMuPDF",
                    "quality": quality_settings,
                    "pages_processed": len(doc)
                }
            )
            
        except Exception as e:
            logger.error(f"PyMuPDF compression failed: {e}")
            raise
    
    def _compress_with_ghostscript(self, file_data: bytes, quality_settings: Dict[str, Any], 
                                progress_callback: Optional[Callable] = None) -> CompressionResult:
        """Compress PDF using Ghostscript"""
        try:
            original_size = len(file_data)
            
            # Create temporary files
            input_path = os.path.join(self.temp_dir, f"compress_input_{id(file_data)}.pdf")
            output_path = os.path.join(self.temp_dir, f"compress_output_{id(file_data)}.pdf")
            
            try:
                # Write input file
                with open(input_path, 'wb') as f:
                    f.write(file_data)
                
                if progress_callback:
                    progress_callback(40)
                
                # Ghostscript command
                cmd = [
                    self.gs_exe,
                    "-sDEVICE=pdfwrite",
                    "-dCompatibilityLevel=1.4",
                    f"-dPDFSETTINGS=/{self._get_pdf_setting(quality_settings['quality'])}",
                    f"-dNOPAUSE",
                    f"-dQUIET",
                    f"-dBATCH",
                    f"-sOutputFile={output_path}",
                    input_path
                ]
                
                # Run Ghostscript with increased timeout
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=180  # Increased from 60 to 180 seconds
                )
                
                if progress_callback:
                    progress_callback(70)
                
                if result.returncode != 0:
                    error_msg = f"Ghostscript failed (code {result.returncode}): {result.stderr}"
                    logger.error(error_msg)
                    raise RuntimeError(error_msg)
                
                # Read compressed file
                with open(output_path, 'rb') as f:
                    compressed_bytes = f.read()
                
                compressed_size = len(compressed_bytes)
                compression_ratio = compressed_size / original_size
                
                return CompressionResult(
                    compressed_data=compressed_bytes,
                    original_size=original_size,
                    compressed_size=compressed_size,
                    compression_ratio=compression_ratio,
                    metadata={
                        "method": "ghostscript",
                        "quality": quality_settings,
                        "gs_output": result.stderr
                    }
                )
                
            finally:
                # Cleanup temporary files
                for path in [input_path, output_path]:
                    if os.path.exists(path):
                        try:
                            os.remove(path)
                        except:
                            pass
            
        except Exception as e:
            logger.error(f"Ghostscript compression failed: {e}")
            raise
    
    def _get_pdf_setting(self, quality: int) -> str:
        """Get Ghostscript PDF setting based on quality"""
        if quality <= 25:
            return "screen"
        elif quality <= 50:
            return "ebook"
        elif quality <= 75:
            return "printer"
        else:
            return "prepress"
    
    def _format_result(self, result: CompressionResult) -> Dict[str, Any]:
        """Format compression result for API response"""
        return {
            "status": "success",
            "tool": "compression",
            "data": {
                "compressed_data": result.compressed_data,
                "original_size": result.original_size,
                "compressed_size": result.compressed_size,
                "compression_ratio": result.compression_ratio,
                "size_reduction_percent": round((1 - result.compression_ratio) * 100, 2),
                "metadata": result.metadata
            },
            "error": None
        }

# Global compression service instance
compression_service = CompressionService()
