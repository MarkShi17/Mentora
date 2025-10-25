FROM manimcommunity/manim:stable

# Install Python for MCP server
USER root

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install aiohttp for HTTP server
RUN pip3 install --no-cache-dir aiohttp==3.9.3

WORKDIR /app

# Create media directory
RUN mkdir -p /app/media && chmod 777 /app/media

# Copy server code
COPY server.py .

# Ensure manim user can write to media
RUN chown -R manimuser:manimuser /app

USER manimuser

# Expose port for HTTP mode (if needed in future)
EXPOSE 8000

# Default to stdio mode
CMD ["python3", "-u", "server.py"]
