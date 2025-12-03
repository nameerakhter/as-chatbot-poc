"""Configuration management for the MCP server."""

import os
from dotenv import load_dotenv

load_dotenv()

# Determine backend URL based on environment
# In Docker: use service name, locally: use localhost
if os.getenv("DOCKER_ENV") == "true":
    # Running in Docker - use service name
    API_BASE_URL = os.getenv("API_BASE_URL", "http://nestjs-backend:3002")
else:
    # Running locally - use localhost
    API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3002")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30000")) / 1000
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()

CACHE_TTL = 3600  # 1 hour in seconds

ESERVICES_BASE_URL = "https://eservices.uk.gov.in/user/services"

