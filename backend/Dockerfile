FROM python:3.11-slim-bookworm

ENV NODE_OPTIONS="--no-deprecation" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MALLOC_ARENA_MAX=2 \
    OMP_THREAD_LIMIT=1 \
    HF_ENABLE_PARALLEL_LOADING=false \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HF_HOME=/app/models_cache \
    MODEL_CACHE_DIR=/app/models_cache \
    TRANSFORMERS_CACHE=/app/models_cache \
    HF_HUB_VERBOSITY=error \
    HF_HUB_DISABLE_XET=1 \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    MAX_WORKERS=2 \
    MAX_UPLOAD_MB=50 \
    TEMP_FILE_TTL_SECONDS=900 \
    TRANSFORMERS_OFFLINE=1 \
    HF_HUB_OFFLINE=1

# 🔥 Install all system dependencies in ONE layer (no duplicates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libc6 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libdbus-1-3 \
    libxkbcommon0 \
    poppler-utils \
    ghostscript \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-tel \
    fontconfig \
    fonts-dejavu \
    fonts-liberation \
    fonts-freefont-ttf \
    libreoffice \
    libreoffice-writer \
    default-jre-headless \
    && fc-cache -f -v \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 📦 Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# 🎭 Playwright + NLTK setup
RUN python -m playwright install chromium --with-deps --force && \
    python3 -m nltk.downloader punkt punkt_tab && \
    python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')"

# 📁 Create required directories
RUN mkdir -p /app/models_cache /app/temp_uploads

# 📂 Copy project
COPY . .

EXPOSE 8000

# ⚙️ Run FastAPI
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --limit-concurrency ${UVICORN_LIMIT_CONCURRENCY:-8} --timeout-keep-alive 5 --log-level info"]
