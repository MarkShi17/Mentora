FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python packages for scientific computing and visualization
# Use increased timeout and retries for large packages (numpy, scipy, etc.)
RUN pip install --no-cache-dir --timeout=600 --retries=5 -r requirements.txt

# Copy server code
COPY server.py .

# Run as non-root user
RUN useradd -m -u 1000 mcp && \
    mkdir -p /app/media && \
    chown -R mcp:mcp /app
USER mcp

# Expose port for HTTP mode
EXPOSE 8000

# Default to HTTP mode
CMD ["python", "-u", "server.py"]
