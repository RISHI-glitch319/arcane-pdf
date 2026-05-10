from __future__ import annotations

import logging
import os
import shutil


logger = logging.getLogger(__name__)


def cleanup_files(*paths: str) -> None:
    """Delete files or directories best-effort without interrupting request flow."""
    for path in paths:
        if not path or not os.path.exists(path):
            continue
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        except Exception as exc:
            logger.error("cleanup_failed path=%s error=%s", path, exc)


def cleanup_paths(*paths: str) -> None:
    cleanup_files(*paths)


def sovereign_cleanup(*paths: str) -> None:
    cleanup_files(*paths)
