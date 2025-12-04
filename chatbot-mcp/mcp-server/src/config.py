"""Configuration management for the MCP server."""

import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3002")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30000")) / 1000
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()

CACHE_TTL = 3600  # 1 hour in seconds

ESERVICES_BASE_URL = "https://eservices.uk.gov.in/user/services"

