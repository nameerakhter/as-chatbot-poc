"""HTTP client for backend API communication."""

import logging
from typing import Any, Dict, List, Optional
import httpx
from datetime import datetime

from .config import API_BASE_URL, REQUEST_TIMEOUT

logger = logging.getLogger(__name__)


class APIClient:
    """HTTP client for making requests to the NestJS backend."""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._services_cache: Optional[List[Dict[str, Any]]] = None
        self._cache_timestamp: Optional[datetime] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def request(
        self,
        endpoint: str,
        method: str = "GET",
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Make HTTP request to backend API.

        Args:
            endpoint: API endpoint path
            method: HTTP method (GET, POST)
            params: Query parameters
            data: Request body data

        Returns:
            Response data as dictionary
        """
        client = await self._get_client()
        url = f"{API_BASE_URL}{endpoint}"

        try:
            logger.info(f"Calling {method} {url}")
            if params:
                logger.debug(f"Params: {params}")
            if data:
                logger.debug(f"Body: {data}")

            if method == "GET":
                response = await client.get(url, params=params)
            elif method == "POST":
                response = await client.post(url, json=data)
            else:
                raise ValueError(f"Method not supported: {method}")

            logger.info(f"Got {response.status_code}")
            response.raise_for_status()
            result = response.json()
            logger.debug(f"Response: {result}")
            return result

        except httpx.ConnectError as e:
            logger.error(f"Connection failed to {url}: {str(e)}")
            return {
                "success": False,
                "message": f"Can't reach backend at {API_BASE_URL}",
                "details": str(e),
            }

        except httpx.TimeoutException as e:
            logger.error(f"Request timed out: {str(e)}")
            return {
                "success": False,
                "message": "Request took too long",
                "details": str(e),
            }

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP {e.response.status_code}: {str(e)}")
            return {
                "success": False,
                "message": f"Backend returned error: {e.response.status_code}",
                "details": str(e),
            }

        except Exception as e:
            logger.error(f"Something went wrong: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": "Unexpected error",
                "details": str(e),
            }

    async def fetch_all_services(self, cache_ttl: int = 3600) -> List[Dict[str, Any]]:
        """
        Fetch all services from API with caching.

        Args:
            cache_ttl: Cache time-to-live in seconds

        Returns:
            List of service dictionaries
        """

        if self._services_cache and self._cache_timestamp:
            age = (datetime.now() - self._cache_timestamp).total_seconds()
            if age < cache_ttl:
                logger.info(
                    f"Using cached data ({len(self._services_cache)} services, {age:.0f}s old)"
                )
                return self._services_cache

        logger.info("Fetching fresh services from API...")
        result = await self.request("/chatbot/services")

        if not result.get("success", True):
            logger.error(f"Failed to get services: {result.get('message')}")
            return []

        if isinstance(result, list):
            services = result
        elif "data" in result:
            services = result["data"]
        else:
            services = []

        self._services_cache = services
        self._cache_timestamp = datetime.now()

        logger.info(f"Cached {len(services)} services")
        return services

    async def health_check(self) -> Dict[str, Any]:
        """Check backend health status."""
        return await self.request("/chatbot/health")

    async def get_application_timeline(self, application_id: str) -> Dict[str, Any]:
        """Get application timeline."""
        return await self.request(f"/chatbot/application/{application_id}/timeline")

    async def get_certificate(self, application_id: str) -> Dict[str, Any]:
        """Get certificate information."""
        return await self.request(f"/chatbot/certificate/{application_id}")

    async def search_by_mobile(self, mobile: str) -> Dict[str, Any]:
        """Search applications by mobile number."""
        return await self.request("/chatbot/search", params={"mobile": mobile})

    async def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics."""
        return await self.request("/chatbot/stats")


_client_instance: Optional[APIClient] = None


async def get_client() -> APIClient:
    """Get global API client instance."""
    global _client_instance
    if _client_instance is None:
        _client_instance = APIClient()
    return _client_instance


async def close_client() -> None:
    """Close global API client."""
    global _client_instance
    if _client_instance:
        await _client_instance.close()
        _client_instance = None

