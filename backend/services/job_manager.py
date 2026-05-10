"""
High-Performance Job Manager for Digital Sovereignty PDF Cloning Engine
Provides async task orchestration, parallel execution, and job tracking
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
import threading
from concurrent.futures import ThreadPoolExecutor, Future
import time
from datetime import timedelta

logger = logging.getLogger(__name__)

class JobStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class Job:
    job_id: str
    task_name: str
    status: JobStatus = JobStatus.QUEUED
    progress: int = 0
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class JobManager:
    """High-performance async job manager with parallel execution"""
    
    def __init__(self, max_workers: int = None):
        self.max_workers = max_workers or (os.cpu_count() or 4) * 2
        self.jobs: Dict[str, Job] = {}
        self._lock = threading.RLock()
        
        # Thread pools for different task types
        self.cpu_executor = ThreadPoolExecutor(
            max_workers=os.cpu_count() or 4,
            thread_name_prefix="cpu_worker"
        )
        self.io_executor = ThreadPoolExecutor(
            max_workers=self.max_workers,
            thread_name_prefix="io_worker"
        )
        
        # Task registry for parallel execution
        self._task_registry: Dict[str, Callable] = {}
        
    def register_task(self, task_name: str, task_func: Callable):
        """Register a task for execution"""
        self._task_registry[task_name] = task_func
        
    async def submit_task(self, task_name: str, file_data: bytes, **params) -> str:
        """Submit a task for parallel execution"""
        job_id = str(uuid.uuid4())
        
        with self._lock:
            job = Job(
                job_id=job_id,
                task_name=task_name,
                metadata={"params": params, "file_size": len(file_data)}
            )
            self.jobs[job_id] = job
        
        # Schedule async execution
        asyncio.create_task(self._execute_task(job_id, task_name, file_data, **params))
        
        return job_id
    
    async def submit_parallel_tasks(self, tasks: List[Dict[str, Any]]) -> List[str]:
        """Submit multiple tasks for parallel execution"""
        job_ids = []
        
        # Create all jobs first
        with self._lock:
            for task_spec in tasks:
                job_id = str(uuid.uuid4())
                job = Job(
                    job_id=job_id,
                    task_name=task_spec["task_name"],
                    metadata={"params": task_spec.get("params", {})}
                )
                self.jobs[job_id] = job
                job_ids.append(job_id)
        
        # Execute all tasks in parallel
        async def execute_all():
            task_coroutines = []
            for i, task_spec in enumerate(tasks):
                task_coroutines.append(
                    self._execute_task(
                        job_ids[i], 
                        task_spec["task_name"], 
                        task_spec["file_data"],
                        **task_spec.get("params", {})
                    )
                )
            await asyncio.gather(*task_coroutines, return_exceptions=True)
        
        asyncio.create_task(execute_all())
        return job_ids
    
    async def _execute_task(self, job_id: str, task_name: str, file_data: bytes, **params):
        """Execute a single task with error handling and progress tracking"""
        job = self.get_job(job_id)
        if not job:
            return
            
        try:
            # Update job status
            with self._lock:
                job.status = JobStatus.PROCESSING
                job.started_at = datetime.now()
            
            # Get task function
            task_func = self._task_registry.get(task_name)
            if not task_func:
                raise ValueError(f"Task '{task_name}' not registered")
            
            # Execute task with progress callback
            start_time = time.time()
            
            def progress_callback(progress: int):
                with self._lock:
                    job.progress = min(100, max(0, progress))
            
            # Choose appropriate executor based on task type
            if task_name in ["ocr", "summarize", "extract"]:
                # CPU-bound tasks
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(
                    self.cpu_executor,
                    self._run_task_with_progress,
                    task_func,
                    file_data,
                    progress_callback,
                    **params
                )
            else:
                # I/O-bound tasks
                loop = asyncio.get_running_loop()
                result = await loop.run_in_executor(
                    self.io_executor,
                    self._run_task_with_progress,
                    task_func,
                    file_data,
                    progress_callback,
                    **params
                )
            
            execution_time = time.time() - start_time
            
            # Update job with result
            with self._lock:
                job.status = JobStatus.COMPLETED
                job.result = result
                job.completed_at = datetime.now()
                job.progress = 100
                job.metadata["execution_time"] = execution_time
                
            logger.info(f"Job {job_id} completed in {execution_time:.2f}s")
            
        except Exception as e:
            # Update job with error
            with self._lock:
                job.status = JobStatus.FAILED
                job.error = str(e)
                job.completed_at = datetime.now()
                
            logger.error(f"Job {job_id} failed: {e}")
    
    def _run_task_with_progress(self, task_func, file_data: bytes, progress_callback, **params):
        """Run task with progress tracking"""
        try:
            # Check if task function accepts progress callback
            import inspect
            sig = inspect.signature(task_func)
            if 'progress_callback' in sig.parameters:
                return task_func(file_data, progress_callback=progress_callback, **params)
            else:
                return task_func(file_data, **params)
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            raise
    
    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        with self._lock:
            return self.jobs.get(job_id)
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status in API format"""
        job = self.get_job(job_id)
        if not job:
            return None
            
        return {
            "job_id": job.job_id,
            "task_name": job.task_name,
            "status": job.status.value,
            "progress": job.progress,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error": job.error,
            "metadata": job.metadata
        }
    
    def get_job_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job result in API format"""
        job = self.get_job(job_id)
        if not job:
            return None
            
        if job.status != JobStatus.COMPLETED:
            return {
                "status": "error",
                "job_id": job_id,
                "data": None,
                "error": f"Job not completed. Current status: {job.status.value}"
            }
        
        return {
            "status": "success",
            "job_id": job_id,
            "data": job.result,
            "error": None
        }
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a job"""
        job = self.get_job(job_id)
        if not job or job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            return False
            
        with self._lock:
            job.status = JobStatus.CANCELLED
            job.completed_at = datetime.now()
            
        return True
    
    def cleanup_completed_jobs(self, max_age_hours: int = 24):
        """Cleanup old completed jobs"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        with self._lock:
            jobs_to_remove = []
            for job_id, job in self.jobs.items():
                if (job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] and
                    job.completed_at and job.completed_at < cutoff_time):
                    jobs_to_remove.append(job_id)
            
            for job_id in jobs_to_remove:
                del self.jobs[job_id]
        
        logger.info(f"Cleaned up {len(jobs_to_remove)} old jobs")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        with self._lock:
            total_jobs = len(self.jobs)
            completed_jobs = sum(1 for job in self.jobs.values() if job.status == JobStatus.COMPLETED)
            failed_jobs = sum(1 for job in self.jobs.values() if job.status == JobStatus.FAILED)
            
            # Calculate average execution time
            execution_times = [
                job.metadata.get("execution_time", 0)
                for job in self.jobs.values()
                if job.status == JobStatus.COMPLETED and "execution_time" in job.metadata
            ]
            avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0
            
            return {
                "total_jobs": total_jobs,
                "completed_jobs": completed_jobs,
                "failed_jobs": failed_jobs,
                "success_rate": completed_jobs / total_jobs if total_jobs > 0 else 0,
                "average_execution_time": avg_execution_time,
                "active_jobs": sum(1 for job in self.jobs.values() if job.status == JobStatus.PROCESSING),
                "queued_jobs": sum(1 for job in self.jobs.values() if job.status == JobStatus.QUEUED)
            }
    
    def shutdown(self):
        """Shutdown the job manager"""
        self.cpu_executor.shutdown(wait=True)
        self.io_executor.shutdown(wait=True)
        logger.info("Job manager shutdown complete")

# Global job manager instance
job_manager = JobManager()
