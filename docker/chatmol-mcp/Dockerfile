FROM python:3.11-slim

# Install PyMOL and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    pymol \
    && rm -rf /var/lib/apt/lists/* \
    || echo "PyMOL not available in default repos - will use host PyMOL"

# Set working directory
WORKDIR /app

# Copy requirements and server
COPY requirements.txt ./
COPY server.py ./

# Install Python dependencies with increased timeout and retries
RUN pip install --no-cache-dir --timeout=300 --retries=5 -r requirements.txt

# Create media directory
RUN mkdir -p /app/media

# Expose port
EXPOSE 8000

# Run the server
CMD ["python", "server.py"]
