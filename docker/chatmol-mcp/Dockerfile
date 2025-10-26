FROM python:3.11-slim

# Install system dependencies, PyMOL, and pip for system Python
RUN apt-get update && apt-get install -y \
    curl \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgomp1 \
    gcc \
    g++ \
    make \
    libglew-dev \
    libpng-dev \
    libfreetype6-dev \
    libxml2-dev \
    pymol \
    python3-pymol \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and server
COPY requirements.txt ./
COPY server.py ./

# Install Python dependencies for system Python (which has PyMOL)
RUN /usr/bin/python3 -m pip install --no-cache-dir --timeout=300 --retries=5 -r requirements.txt --break-system-packages

# Create media directory
RUN mkdir -p /app/media

# Expose port
EXPOSE 8000

# Run the server with system Python (has PyMOL installed)
CMD ["/usr/bin/python3", "server.py"]
