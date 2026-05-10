import asyncio
import io
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from PIL import Image, ImageSequence, ImageEnhance, ImageFilter
import cv2
import numpy as np
try:
    import imageio
except ImportError:
    imageio = None
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class ImageProcessingResult:
    status: str
    job_id: str
    tool: str
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    error: Optional[str] = None

class ImageService:
    def __init__(self):
        self.temp_dir = os.getenv("TEMP_DIR", "temp_uploads")
        try:
            max_workers = max(1, int(os.getenv("MAX_WORKERS", "2")))
        except ValueError:
            max_workers = 2
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.supported_formats = {
            'input': ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.webp', '.bmp', '.heic', '.raw'],
            'output': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
        }
        
    async def compress_image(self, files: List[bytes], quality: int = 85) -> ImageProcessingResult:
        """Compress images while maintaining quality"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._compress_images_sync,
                files,
                quality,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="compress",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results)
                }
            )
        except Exception as e:
            logger.error(f"Image compression failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="compress",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _compress_images_sync(self, files: List[bytes], quality: int, job_id: str) -> List[str]:
        """Synchronous image compression"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                # Open image from bytes
                img = Image.open(io.BytesIO(file_data))
                
                # Convert to RGB if necessary (for JPEG)
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                
                # Save compressed image
                output_buffer = io.BytesIO()
                img.save(output_buffer, format='JPEG', quality=quality, optimize=True)
                
                # Save to temp file
                filename = f"compressed_{job_id}_{i}.jpg"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to compress image {i}: {str(e)}")
                continue
        
        return output_files
    
    async def resize_image(self, files: List[bytes], width: int, height: int, maintain_aspect: bool = True) -> ImageProcessingResult:
        """Resize images with aspect ratio preservation option"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._resize_images_sync,
                files,
                width,
                height,
                maintain_aspect,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="resize",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results),
                    "target_size": f"{width}x{height}"
                }
            )
        except Exception as e:
            logger.error(f"Image resize failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="resize",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _resize_images_sync(self, files: List[bytes], width: int, height: int, maintain_aspect: bool, job_id: str) -> List[str]:
        """Synchronous image resizing"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                if maintain_aspect:
                    img.thumbnail((width, height), Image.Resampling.LANCZOS)
                else:
                    img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                output_buffer = io.BytesIO()
                img.save(output_buffer, format='PNG')
                
                filename = f"resized_{job_id}_{i}.png"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to resize image {i}: {str(e)}")
                continue
        
        return output_files
    
    async def convert_to_jpg(self, files: List[bytes]) -> ImageProcessingResult:
        """Convert various image formats to JPG"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._convert_to_jpg_sync,
                files,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="convert_to_jpg",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results)
                }
            )
        except Exception as e:
            logger.error(f"JPG conversion failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="convert_to_jpg",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _convert_to_jpg_sync(self, files: List[bytes], job_id: str) -> List[str]:
        """Synchronous JPG conversion"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Handle transparency
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    img = background
                
                output_buffer = io.BytesIO()
                img.save(output_buffer, format='JPEG', quality=95, optimize=True)
                
                filename = f"converted_to_jpg_{job_id}_{i}.jpg"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to convert image {i} to JPG: {str(e)}")
                continue
        
        return output_files
    
    async def convert_from_jpg(self, files: List[bytes], output_format: str) -> ImageProcessingResult:
        """Convert JPG to other formats (PNG, WEBP, GIF)"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._convert_from_jpg_sync,
                files,
                output_format,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="convert_from_jpg",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results),
                    "output_format": output_format
                }
            )
        except Exception as e:
            logger.error(f"JPG conversion failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="convert_from_jpg",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _convert_from_jpg_sync(self, files: List[bytes], output_format: str, job_id: str) -> List[str]:
        """Synchronous conversion from JPG"""
        output_files = []
        format_map = {'png': 'PNG', 'webp': 'WEBP', 'gif': 'GIF'}
        
        if output_format not in format_map:
            raise ValueError(f"Unsupported output format: {output_format}")
        
        pil_format = format_map[output_format]
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                output_buffer = io.BytesIO()
                save_kwargs = {'format': pil_format}
                
                if output_format == 'webp':
                    save_kwargs['quality'] = 95
                    save_kwargs['method'] = 6
                elif output_format == 'png':
                    save_kwargs['optimize'] = True
                
                img.save(output_buffer, **save_kwargs)
                
                filename = f"converted_from_jpg_{job_id}_{i}.{output_format}"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to convert JPG {i} to {output_format}: {str(e)}")
                continue
        
        return output_files
    
    async def create_animated_gif(self, files: List[bytes], duration: float = 0.5, loop: int = 0) -> ImageProcessingResult:
        """Create animated GIF from multiple images"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._create_gif_sync,
                files,
                duration,
                loop,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="create_gif",
                data={"files": [result]},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(files),
                    "frame_duration": duration,
                    "loop_count": loop
                }
            )
        except Exception as e:
            logger.error(f"GIF creation failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="create_gif",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _create_gif_sync(self, files: List[bytes], duration: float, loop: int, job_id: str) -> str:
        """Synchronous GIF creation"""
        if len(files) < 2:
            raise ValueError("At least 2 images required for animated GIF")
        
        images = []
        
        for file_data in files:
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Resize all images to the same dimensions (first image size)
                if images:
                    img = img.resize(images[0].size, Image.Resampling.LANCZOS)
                
                images.append(img)
                
            except Exception as e:
                logger.error(f"Failed to process image for GIF: {str(e)}")
                continue
        
        if len(images) < 2:
            raise ValueError("Not enough valid images for GIF creation")
        
        # Create animated GIF
        output_buffer = io.BytesIO()
        images[0].save(
            output_buffer,
            format='GIF',
            save_all=True,
            append_images=images[1:],
            duration=int(duration * 1000),  # Convert to milliseconds
            loop=loop,
            optimize=True
        )
        
        filename = f"animated_gif_{job_id}.gif"
        filepath = os.path.join(self.temp_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(output_buffer.getvalue())
        
        return f"/temp_files/{filename}"
    
    async def upscale_image(self, files: List[bytes], scale_factor: float = 2.0) -> ImageProcessingResult:
        """Upscale images using advanced interpolation"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._upscale_images_sync,
                files,
                scale_factor,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="upscale",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results),
                    "scale_factor": scale_factor
                }
            )
        except Exception as e:
            logger.error(f"Image upscaling failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="upscale",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _upscale_images_sync(self, files: List[bytes], scale_factor: float, job_id: str) -> List[str]:
        """Synchronous image upscaling"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Calculate new dimensions
                new_width = int(img.width * scale_factor)
                new_height = int(img.height * scale_factor)
                
                # Use high-quality upscaling
                upscaled = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Apply sharpening to enhance details
                enhancer = ImageEnhance.Sharpness(upscaled)
                enhanced = enhancer.enhance(1.2)
                
                output_buffer = io.BytesIO()
                enhanced.save(output_buffer, format='PNG')
                
                filename = f"upscaled_{job_id}_{i}.png"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to upscale image {i}: {str(e)}")
                continue
        
        return output_files
    
    async def remove_background(self, files: List[bytes]) -> ImageProcessingResult:
        """Remove background using basic color detection"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._remove_background_sync,
                files,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="remove_bg",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results)
                }
            )
        except Exception as e:
            logger.error(f"Background removal failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="remove_bg",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _remove_background_sync(self, files: List[bytes], job_id: str) -> List[str]:
        """Synchronous background removal using color detection"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Convert to RGBA
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                
                # Get image data as numpy array
                img_array = np.array(img)
                
                # Simple background removal using color detection
                # This is a basic implementation - in production, use AI models
                hsv = cv2.cvtColor(img_array[:, :, :3], cv2.COLOR_RGB2HSV)
                
                # Define range for white/light colors (typical background)
                lower_white = np.array([0, 0, 200])
                upper_white = np.array([180, 30, 255])
                
                # Create mask
                mask = cv2.inRange(hsv, lower_white, upper_white)
                
                # Invert mask to keep foreground
                mask_inv = cv2.bitwise_not(mask)
                
                # Apply mask to alpha channel
                img_array[:, :, 3] = mask_inv
                
                # Convert back to PIL
                result_img = Image.fromarray(img_array, 'RGBA')
                
                output_buffer = io.BytesIO()
                result_img.save(output_buffer, format='PNG')
                
                filename = f"bg_removed_{job_id}_{i}.png"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to remove background from image {i}: {str(e)}")
                continue
        
        return output_files
    
    async def add_watermark(self, files: List[bytes], watermark_text: str = "Arcane IMG") -> ImageProcessingResult:
        """Add watermark to images"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._add_watermark_sync,
                files,
                watermark_text,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="watermark",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results),
                    "watermark_text": watermark_text
                }
            )
        except Exception as e:
            logger.error(f"Watermark addition failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="watermark",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _add_watermark_sync(self, files: List[bytes], watermark_text: str, job_id: str) -> List[str]:
        """Synchronous watermark addition"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Convert to RGBA if needed
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                
                # Create a transparent overlay
                overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
                
                # Use PIL's drawing capabilities
                from PIL import ImageDraw, ImageFont
                
                draw = ImageDraw.Draw(overlay)
                
                # Try to load a font, fallback to default if not available
                try:
                    font_size = max(img.size) // 20
                    font = ImageFont.truetype("arial.ttf", font_size)
                except:
                    font = ImageFont.load_default()
                
                # Calculate text position (center)
                bbox = draw.textbbox((0, 0), watermark_text, font=font)
                wm_w = bbox[2] - bbox[0]
                wm_h = bbox[3] - bbox[1]
                img_w = img.width
                img_h = img.height
                
                x = (img_w - wm_w) // 2
                y = (img_h - wm_h) // 2
                
                # Add semi-transparent text
                draw.text((x, y), watermark_text, font=font, fill=(255, 255, 255, 128))
                
                # Composite the overlay onto the original image
                watermarked = Image.alpha_composite(img, overlay)
                
                output_buffer = io.BytesIO()
                watermarked.save(output_buffer, format='PNG')
                
                filename = f"watermarked_{job_id}_{i}.png"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to add watermark to image {i}: {str(e)}")
                continue
        
        return output_files
    
    async def rotate_image(self, files: List[bytes], angle: float = 90) -> ImageProcessingResult:
        """Rotate images by specified angle"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._rotate_images_sync,
                files,
                angle,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="rotate",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results),
                    "rotation_angle": angle
                }
            )
        except Exception as e:
            logger.error(f"Image rotation failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="rotate",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _rotate_images_sync(self, files: List[bytes], angle: float, job_id: str) -> List[str]:
        """Synchronous image rotation"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Rotate image
                rotated = img.rotate(angle, expand=True, fillcolor='white')
                
                output_buffer = io.BytesIO()
                rotated.save(output_buffer, format='PNG')
                
                filename = f"rotated_{job_id}_{i}.png"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to rotate image {i}: {str(e)}")
                continue
        
        return output_files
    
    async def crop_image(self, files: List[bytes], x: int, y: int, width: int, height: int) -> ImageProcessingResult:
        """Crop images to specified dimensions"""
        job_id = str(uuid.uuid4())
        start_time = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                self.executor,
                self._crop_images_sync,
                files,
                x, y, width, height,
                job_id
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return ImageProcessingResult(
                status="success",
                job_id=job_id,
                tool="crop",
                data={"files": results},
                metadata={
                    "execution_time": execution_time,
                    "processed_files": len(results),
                    "crop_dimensions": f"{x},{y},{width},{height}"
                }
            )
        except Exception as e:
            logger.error(f"Image cropping failed: {str(e)}")
            return ImageProcessingResult(
                status="error",
                job_id=job_id,
                tool="crop",
                data={},
                metadata={},
                error=str(e)
            )
    
    def _crop_images_sync(self, files: List[bytes], x: int, y: int, width: int, height: int, job_id: str) -> List[str]:
        """Synchronous image cropping"""
        output_files = []
        
        for i, file_data in enumerate(files):
            try:
                img = Image.open(io.BytesIO(file_data))
                
                # Crop image
                box = (x, y, x + width, y + height)
                cropped = img.crop(box)
                
                output_buffer = io.BytesIO()
                cropped.save(output_buffer, format='PNG')
                
                filename = f"cropped_{job_id}_{i}.png"
                filepath = os.path.join(self.temp_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(output_buffer.getvalue())
                
                output_files.append(f"/temp_files/{filename}")
                
            except Exception as e:
                logger.error(f"Failed to crop image {i}: {str(e)}")
                continue
        
        return output_files

# Global instance
image_service = ImageService()
