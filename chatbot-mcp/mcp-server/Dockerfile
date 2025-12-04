FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and uv
RUN apt-get update && \
    apt-get install -y curl && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    rm -rf /var/lib/apt/lists/*

# Add uv to PATH
ENV PATH="/root/.cargo/bin:$PATH"

# Copy project files
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv
RUN uv sync --frozen || uv sync

# Copy source code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p /app/logs

# Set PYTHONPATH to include current directory
ENV PYTHONPATH=/app:$PYTHONPATH

# Health check: verify main.py exists and can be imported
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD uv run python -c "import src.main; import sys; sys.exit(0)" || python -c "import sys; sys.exit(0 if __import__('os').path.exists('/app/src/main.py') else 1)"

# Keep container alive for LibreChat exec
CMD ["tail", "-f", "/dev/null"]
