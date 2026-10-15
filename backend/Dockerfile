FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt requirements.lock.txt ./
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.lock.txt
COPY . .
RUN useradd --create-home atmosphere && mkdir -p /app/artifacts /app/data && chown -R atmosphere:atmosphere /app
USER atmosphere
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
