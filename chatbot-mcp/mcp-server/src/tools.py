"""MCP tool definitions and handlers."""

import logging
from typing import Any, Dict

import httpx
from mcp.types import Tool, TextContent

from .api_client import get_client
from .formatters import (
    format_service_response,
    format_timeline_response,
    format_certificate_response,
    format_search_response,
    format_stats_response,
)
from .search import fuzzy_search_services

logger = logging.getLogger(__name__)


def get_tool_definitions() -> list[Tool]:
    """
    Get list of available MCP tools.

    Returns:
        List of Tool definitions
    """
    logger.info("Listing tools")
    return [
        Tool(
            name="get_service_info",
            description=(
                "Search for government services. Works with English or Hindi queries. "
                "Returns complete service details including documents, fees, timeline, and application link. "
                "Examples: 'domicile certificate', 'income certificate', 'जाति प्रमाण पत्र'"
            ),
            inputSchema={
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Service name in English or Hindi",
                    },
                    "maxResults": {
                        "type": "number",
                        "description": "Max results (default: 1, max: 10)",
                        "default": 1,
                    },
                },
            },
        ),
        Tool(
            name="check_application_status",
            description=(
                "Track application status with complete timeline showing all steps, "
                "officers, and current status."
            ),
            inputSchema={
                "type": "object",
                "required": ["applicationId"],
                "properties": {
                    "applicationId": {
                        "type": "string",
                        "description": "Application ID (e.g., UK21ES0100004508)",
                    }
                },
            },
        ),
        Tool(
            name="get_certificate",
            description="Get certificate download links for approved applications.",
            inputSchema={
                "type": "object",
                "required": ["applicationId"],
                "properties": {
                    "applicationId": {"type": "string", "description": "Application ID"}
                },
            },
        ),
        Tool(
            name="search_by_mobile",
            description="Find all applications by mobile number.",
            inputSchema={
                "type": "object",
                "required": ["mobile"],
                "properties": {
                    "mobile": {"type": "string", "description": "10-digit mobile number"}
                },
            },
        ),
        Tool(
            name="get_system_stats",
            description="Get overall system statistics.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="health_check",
            description="Check backend API status",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


async def handle_tool_call(name: str, args: Dict[str, Any]) -> list[TextContent]:
    """
    Handle MCP tool call.

    Args:
        name: Tool name
        args: Tool arguments

    Returns:
        List of TextContent responses
    """
    logger.info(f"Tool called: {name} with args={args}")
    client = await get_client()

    match name:
        case "get_service_info":
            query = args.get("query", "")
            max_results = min(args.get("maxResults", 1), 10)

            services = await client.fetch_all_services()
            if not services:
                return [
                    TextContent(
                        type="text", text="❌ Could not fetch services. Try again later."
                    )
                ]

            matches = fuzzy_search_services(query, services, max_results)
            return [
                TextContent(type="text", text=format_service_response(matches, query))
            ]

        case "check_application_status":
            application_id = args.get("applicationId", "")
            if not application_id:
                return [
                    TextContent(
                        type="text", text="❌ Application ID is required"
                    )
                ]
            try:
                result = await client.get_application_timeline(application_id)
                return [TextContent(type="text", text=format_timeline_response(result))]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    return [TextContent(
                        type="text",
                        text=f"❌ Application '{application_id}' not found. Please verify the application ID."
                    )]
                return [TextContent(
                    type="text",
                    text=f"❌ Error checking application status: {e.response.status_code}"
                )]
            except Exception as e:
                return [TextContent(
                    type="text",
                    text=f"❌ Error: {str(e)}"
                )]

        case "get_certificate":
            application_id = args.get("applicationId", "")
            if not application_id:
                return [
                    TextContent(
                        type="text", text="❌ Application ID is required"
                    )
                ]
            try:
                result = await client.get_certificate(application_id)
                return [TextContent(type="text", text=format_certificate_response(result))]
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    error_msg = "Certificate not ready or application not found"
                    try:
                        error_data = e.response.json()
                        error_msg = error_data.get("message", error_msg)
                    except:
                        pass
                    return [TextContent(
                        type="text",
                        text=f"❌ {error_msg}"
                    )]
                return [TextContent(
                    type="text",
                    text=f"❌ Error getting certificate: {e.response.status_code}"
                )]
            except Exception as e:
                return [TextContent(
                    type="text",
                    text=f"❌ Error: {str(e)}"
                )]

        case "search_by_mobile":
            mobile = args.get("mobile", "")
            if not mobile:
                return [
                    TextContent(
                        type="text", text="❌ Mobile number is required"
                    )
                ]
            try:
                result = await client.search_by_mobile(mobile)
                # result is now a list directly
                return [TextContent(type="text", text=format_search_response(result))]
            except httpx.HTTPStatusError as e:
                return [TextContent(
                    type="text",
                    text=f"❌ Error searching applications: {e.response.status_code}"
                )]
            except Exception as e:
                return [TextContent(
                    type="text",
                    text=f"❌ Error: {str(e)}"
                )]

        case "get_system_stats":
            try:
                result = await client.get_system_stats()
                return [TextContent(type="text", text=format_stats_response(result))]
            except Exception as e:
                return [TextContent(
                    type="text",
                    text=f"❌ Error getting statistics: {str(e)}"
                )]

        case "health_check":
            try:
                result = await client.health_check()
                text = (
                    "✅ Backend online"
                    if result.get("status") == "ok"
                    else f"❌ Offline: {result.get('message', 'Unknown')}"
                )
                return [TextContent(type="text", text=text)]
            except Exception as e:
                return [TextContent(
                    type="text",
                    text=f"❌ Backend offline: {str(e)}"
                )]

    return [TextContent(type="text", text=f"❌ Unknown tool: {name}")]

