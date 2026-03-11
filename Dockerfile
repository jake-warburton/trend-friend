FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TREND_FRIEND_API_HOST=0.0.0.0 \
    TREND_FRIEND_API_PORT=8000 \
    TREND_FRIEND_API_RELOAD=false

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY main.py .

RUN mkdir -p data web/data

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
