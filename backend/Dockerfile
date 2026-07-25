# Essentia publishes Linux wheels but no Windows ones, so the backend runs in a
# Linux container on Windows dev machines. Build spec §1 wants a containerized
# backend for deploy anyway, so dev and prod share this image.
FROM python:3.11-slim

# ffmpeg supplies the mp3/m4a/aac decoders behind Essentia's MonoLoader;
# libsndfile covers wav/flac/aiff. Without these, uploads in those formats fail
# at decode time rather than at upload.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Dependency layer first so app edits don't reinstall Essentia on every build.
COPY pyproject.toml ./
RUN mkdir -p app && touch app/__init__.py \
    && pip install -e ".[audio]"

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
