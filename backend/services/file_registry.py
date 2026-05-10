"""
Zero-Redundancy File Registry for Digital Sovereignty PDF Cloning Engine
Provides efficient file handling with in-memory caching and reference sharing
"""

import hashlib
import io
import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, BinaryIO
from dataclasses import dataclass, field
import tempfile

logger = logging.getLogger(__name__)

@dataclass
class FileEntry:
    """Represents a file entry in the registry"""
    file_id: str
    filename: str
    content_type: str
    size: int
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)
    access_count: int = 0
    temp_path: Optional[str] = None
    in_memory: bool = True
    checksum: str = ""

class FileRegistry:
    """High-performance file registry with zero-redundancy handling"""
    
    def __init__(self, max_memory_mb: int = 100, max_files: int = 1000):
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.max_files = max_files
        
        # File storage
        self._files: Dict[str, FileEntry] = {}
        self._file_content: Dict[str, bytes] = {}
        self._file_objects: Dict[str, io.BytesIO] = {}
        
        # Thread safety
        self._lock = threading.RLock()
        
        # Cleanup tracking
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # 5 minutes
        
        # Temp directory for large files
        self.temp_dir = tempfile.gettempdir()
        
    def register_file(self, file_data: bytes, filename: str, content_type: str = "application/octet-stream") -> str:
        """Register a file and return file_id"""
        # Generate unique file ID based on content checksum
        checksum = self._calculate_checksum(file_data)
        file_id = hashlib.md5(f"{checksum}_{filename}".encode()).hexdigest()
        
        with self._lock:
            # Check if file already exists
            if file_id in self._files:
                entry = self._files[file_id]
                entry.last_accessed = datetime.now()
                entry.access_count += 1
                logger.debug(f"File {filename} already registered (access #{entry.access_count})")
                return file_id
            
            # Determine storage strategy
            in_memory = len(file_data) <= self.max_memory_bytes // 10  # 10% of max memory
            
            # Create file entry
            entry = FileEntry(
                file_id=file_id,
                filename=filename,
                content_type=content_type,
                size=len(file_data),
                in_memory=in_memory,
                checksum=checksum
            )
            
            # Store file
            if in_memory:
                self._file_content[file_id] = file_data
                self._file_objects[file_id] = io.BytesIO(file_data)
            else:
                # Write to temp file
                temp_path = os.path.join(self.temp_dir, f"arcane_{file_id}.tmp")
                with open(temp_path, 'wb') as f:
                    f.write(file_data)
                entry.temp_path = temp_path
            
            self._files[file_id] = entry
            
            # Trigger cleanup if needed
            self._maybe_cleanup()
            
        logger.info(f"Registered file {filename} ({len(file_data)} bytes, in_memory={in_memory})")
        return file_id
    
    def get_file_content(self, file_id: str) -> Optional[bytes]:
        """Get file content by ID"""
        with self._lock:
            if file_id not in self._files:
                return None
                
            entry = self._files[file_id]
            entry.last_accessed = datetime.now()
            entry.access_count += 1
            
            if entry.in_memory:
                return self._file_content.get(file_id)
            else:
                # Read from temp file
                try:
                    with open(entry.temp_path, 'rb') as f:
                        return f.read()
                except Exception as e:
                    logger.error(f"Failed to read temp file {entry.temp_path}: {e}")
                    return None
    
    def get_file_object(self, file_id: str) -> Optional[BinaryIO]:
        """Get file object by ID"""
        with self._lock:
            if file_id not in self._files:
                return None
                
            entry = self._files[file_id]
            entry.last_accessed = datetime.now()
            entry.access_count += 1
            
            if entry.in_memory:
                # Reset BytesIO position
                if file_id in self._file_objects:
                    self._file_objects[file_id].seek(0)
                    return self._file_objects[file_id]
                else:
                    # Recreate BytesIO if needed
                    content = self._file_content.get(file_id)
                    if content:
                        file_obj = io.BytesIO(content)
                        self._file_objects[file_id] = file_obj
                        return file_obj
            else:
                # Open file for reading
                try:
                    return open(entry.temp_path, 'rb')
                except Exception as e:
                    logger.error(f"Failed to open temp file {entry.temp_path}: {e}")
                    return None
    
    def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file metadata"""
        with self._lock:
            if file_id not in self._files:
                return None
                
            entry = self._files[file_id]
            return {
                "file_id": entry.file_id,
                "filename": entry.filename,
                "content_type": entry.content_type,
                "size": entry.size,
                "created_at": entry.created_at.isoformat(),
                "last_accessed": entry.last_accessed.isoformat(),
                "access_count": entry.access_count,
                "in_memory": entry.in_memory,
                "checksum": entry.checksum
            }
    
    def remove_file(self, file_id: str) -> bool:
        """Remove file from registry"""
        with self._lock:
            if file_id not in self._files:
                return False
                
            entry = self._files[file_id]
            
            # Clean up storage
            if file_id in self._file_content:
                del self._file_content[file_id]
            if file_id in self._file_objects:
                self._file_objects[file_id].close()
                del self._file_objects[file_id]
            
            # Remove temp file if exists
            if entry.temp_path and os.path.exists(entry.temp_path):
                try:
                    os.remove(entry.temp_path)
                except Exception as e:
                    logger.error(f"Failed to remove temp file {entry.temp_path}: {e}")
            
            del self._files[file_id]
            logger.info(f"Removed file {entry.filename}")
            return True
    
    def _calculate_checksum(self, data: bytes) -> str:
        """Calculate SHA-256 checksum"""
        return hashlib.sha256(data).hexdigest()
    
    def _maybe_cleanup(self):
        """Trigger cleanup if needed"""
        current_time = time.time()
        if current_time - self._last_cleanup > self._cleanup_interval:
            self._cleanup()
            self._last_cleanup = current_time
    
    def _cleanup(self):
        """Cleanup old and unused files"""
        with self._lock:
            # Remove files older than 24 hours
            cutoff_time = datetime.now() - timedelta(hours=24)
            
            files_to_remove = []
            for file_id, entry in self._files.items():
                if entry.last_accessed < cutoff_time:
                    files_to_remove.append(file_id)
            
            # Also remove if we have too many files
            if len(self._files) > self.max_files:
                # Sort by last accessed time
                sorted_files = sorted(
                    self._files.items(),
                    key=lambda x: x[1].last_accessed
                )
                excess_files = len(self._files) - self.max_files
                for i in range(excess_files):
                    files_to_remove.append(sorted_files[i][0])
            
            # Remove identified files
            for file_id in files_to_remove:
                self.remove_file(file_id)
            
            if files_to_remove:
                logger.info(f"Cleaned up {len(files_to_remove)} files")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics"""
        with self._lock:
            total_files = len(self._files)
            total_size = sum(entry.size for entry in self._files.values())
            in_memory_files = sum(1 for entry in self._files.values() if entry.in_memory)
            total_accesses = sum(entry.access_count for entry in self._files.values())
            
            return {
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "in_memory_files": in_memory_files,
                "on_disk_files": total_files - in_memory_files,
                "total_accesses": total_accesses,
                "average_accesses": total_accesses / total_files if total_files > 0 else 0,
                "memory_usage_mb": round(
                    sum(len(content) for content in self._file_content.values()) / (1024 * 1024), 2
                )
            }
    
    def cleanup_all(self):
        """Remove all files from registry"""
        with self._lock:
            file_ids = list(self._files.keys())
            for file_id in file_ids:
                self.remove_file(file_id)
            logger.info("Cleaned up all files from registry")

# Global file registry instance
file_registry = FileRegistry()
