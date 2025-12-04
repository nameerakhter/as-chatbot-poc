"""Main entry point for the MCP server."""

import asyncio
import logging
import sys
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server

from .config import API_BASE_URL, LOG_LEVEL, REQUEST_TIMEOUT
from .api_client import close_client, get_client
from .tools import get_tool_definitions, handle_tool_call

# Setup logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)

logger = logging.getLogger("apuni-sarkar-mcp")

# Create MCP server instance
server = Server("apuni-sarkar-mcp-server")


@server.list_tools()
async def list_tools():
    """List available tools."""
    return get_tool_definitions()


@server.call_tool()
async def call_tool(name: str, args: dict):
    """Handle tool calls."""
    return await handle_tool_call(name, args)


async def main():
    """Main entry point."""
    logger.info("Starting MCP Server")
    logger.info(f"Backend: {API_BASE_URL}")
    logger.info(f"Timeout: {REQUEST_TIMEOUT}s")

    try:
        logger.info("Testing backend connection...")
        client = await get_client()
        test = await client.health_check()
        if test.get("status") == "ok":
            logger.info("Backend is up")
        else:
            logger.warning(f"Backend check failed: {test}")
    except Exception as e:
        logger.error(f"Connection failed: {e}")

    try:
        async with stdio_server() as (read_stream, write_stream):
            logger.info("Starting stdio server...")
            await server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="apuni-sarkar-mcp",
                    server_version="2.0.0",
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )
    finally:
        await close_client()
        logger.info("Server shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

