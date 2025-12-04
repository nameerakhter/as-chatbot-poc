"""Response formatting functions."""

import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .config import ESERVICES_BASE_URL, CACHE_TTL


def seconds_to_days(seconds: int) -> str:
    """
    Convert timeline seconds to readable format.

    Args:
        seconds: Time in seconds

    Returns:
        Human-readable time string
    """
    if not seconds or seconds == 0:
        return "As per rules"
    days = seconds / 86400
    if days < 1:
        return "Same day"
    elif days == 1:
        return "1 day"
    else:
        return f"{int(days)} days"


def build_apply_url(service: Dict) -> str:
    """
    Build the application URL for a service.

    Args:
        service: Service dictionary

    Returns:
        Application URL
    """
    # Get department ID
    dept = service.get("department")
    if isinstance(dept, dict):
        dept_id = dept.get("_id") or dept.get("id")
    elif isinstance(dept, str):
        dept_id = dept
    else:
        dept_id = None

    # Get service ID
    service_id = service.get("_id") or service.get("id")

    if dept_id and service_id:
        return f"{ESERVICES_BASE_URL}?department={dept_id}&service={service_id}"
    elif service_id:
        return f"{ESERVICES_BASE_URL}?service={service_id}"
    else:
        return ESERVICES_BASE_URL


def format_documents_list(documents: List[Dict], doc_type: str = "required") -> str:
    """
    Format document list for display.

    Args:
        documents: List of document dictionaries
        doc_type: Type of documents ('required' or 'optional')

    Returns:
        Formatted document list string
    """
    if not documents:
        return "None"

    is_required = doc_type.lower() == "required"
    filtered = [d for d in documents if d.get("required", False) == is_required]

    if not filtered:
        return "None"

    result = []
    for doc in filtered:
        name_en = doc.get("nameEnglish", "")
        name_hi = doc.get("nameHindi", "")

        if name_en:
            result.append(f"• {name_en}")
            if name_hi:
                result.append(f"  ({name_hi})")
        elif name_hi:
            result.append(f"• {name_hi}")

    return "\n".join(result) if result else "None"


def build_service_card_json(service: Dict) -> Dict:
    """
    Build the JSON card for LibreChat.

    Args:
        service: Service dictionary

    Returns:
        Service card JSON dictionary
    """
    dept = service.get("department", {})
    if isinstance(dept, str):
        dept = {"nameEnglish": dept}

    documents = service.get("documents", [])

    return {
        "serviceId": service.get("_id") or service.get("id"),
        "serviceName": service.get("nameEnglish", "Service"),
        "serviceNameHindi": service.get("nameHindi", ""),
        "slug": service.get("slug", ""),
        "department": {
            "name": dept.get("nameEnglish", "Government Department"),
            "nameHindi": dept.get("nameHindi", ""),
            "code": dept.get("code", ""),
        },
        "fee": service.get("charge", 0),
        "timeline": seconds_to_days(service.get("deliveryTimeInSeconds", 0)),
        "timelineSeconds": service.get("deliveryTimeInSeconds", 0),
        "hasCertificate": service.get("hasCertificate", False),
        "documents": {
            "required": [
                {
                    "name": d.get("nameEnglish", ""),
                    "nameHindi": d.get("nameHindi", ""),
                    "description": d.get("notes", [""])[0] if d.get("notes") else "",
                }
                for d in documents
                if d.get("required", False) is True
            ],
            "optional": [
                {
                    "name": d.get("nameEnglish", ""),
                    "nameHindi": d.get("nameHindi", ""),
                    "description": d.get("notes", [""])[0] if d.get("notes") else "",
                }
                for d in documents
                if d.get("required", False) is False
            ],
        },
        "applyUrl": build_apply_url(service),
        "officerFlow": service.get("officerFields", []) if service.get("officerFields") else [],
    }


def format_service_card_text(service: Dict, match_score: Optional[float] = None) -> str:
    """
    Format service info as readable text.

    Args:
        service: Service dictionary
        match_score: Optional match score for display

    Returns:
        Formatted text string
    """
    dept = service.get("department", {})
    if isinstance(dept, str):
        dept = {"nameEnglish": dept}

    output = "**Service Information / सेवा जानकारी**\n\n"
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Service name
    output += f"**Service Name:** {service.get('nameEnglish', 'N/A')}\n"
    if service.get("nameHindi"):
        output += f"**सेवा का नाम:** {service['nameHindi']}\n"
    output += "\n"

    # Department
    output += f"**Department:** {dept.get('nameEnglish', 'N/A')}\n"
    if dept.get("nameHindi"):
        output += f"**विभाग:** {dept['nameHindi']}\n"
    output += "\n"

    # Fee and timeline
    fee = service.get("charge", 0)
    output += f"**Fee:** ₹{fee}\n"
    output += f"**Timeline:** {seconds_to_days(service.get('deliveryTimeInSeconds', 0))}\n"

    if service.get("hasCertificate"):
        output += "**Certificate:** Yes, certificate will be issued\n"

    output += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Documents
    documents = service.get("documents", [])
    output += "**Required Documents / आवश्यक दस्तावेज:**\n\n"
    output += format_documents_list(documents, "required") + "\n\n"

    optional_docs = format_documents_list(documents, "optional")
    if optional_docs != "None":
        output += "**Optional Documents / वैकल्पिक दस्तावेज:**\n\n"
        output += optional_docs + "\n\n"

    # Officer flow
    officer_fields = service.get("officerFields", [])
    if officer_fields and len(officer_fields) > 0:
        output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        output += "**Processing Flow:**\n\n"
        for idx, field in enumerate(officer_fields):
            office = field.get("office", "Office")
            designation = field.get("designation", "Officer")
            output += f"{idx + 1}. {office} → {designation}\n"
        output += "\n"

    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    # Apply link
    output += f"**Apply Now:** {build_apply_url(service)}\n\n"
    output += "**Next Steps:**\n"
    output += "• Click the link above to start your application\n"
    output += "• Keep all required documents ready\n"
    output += "• You'll receive an application ID after submission\n"

    if match_score:
        output += f"\n**Match Confidence:** {match_score:.0f}%"

    return output


def format_service_response(services_with_scores: List[Tuple[Dict, float]], query: str) -> str:
    """
    Build complete service response.

    Args:
        services_with_scores: List of (service, score) tuples
        query: Original search query

    Returns:
        Formatted response string
    """
    if not services_with_scores:
        return (
            f"**No Services Found**\n\n"
            f"Could not find any services matching: \"{query}\"\n\n"
            f"**Suggestions:**\n"
            f"• Try different keywords (English or Hindi)\n"
            f"• Check for spelling errors\n"
            f"• Use common terms like 'domicile', 'income', 'caste'\n"
            f"• Ask 'What services are available?' to see all options"
        )

    # Get best match
    best_service, best_score = services_with_scores[0]

    # Build JSON card
    card_json = build_service_card_json(best_service)
    card_json_str = json.dumps(card_json, ensure_ascii=False, indent=2)
    wrapped_card = f"{{{{service-card}}}}\n{card_json_str}\n{{{{/service-card}}}}"

    # Build text
    text_output = format_service_card_text(best_service, best_score)

    # Show alternatives if available
    if len(services_with_scores) > 1:
        text_output += "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        text_output += "**Other Matches:**\n\n"
        for service, score in services_with_scores[1:4]:
            text_output += f"• {service.get('nameEnglish', 'N/A')} ({score:.0f}% match)\n"
            if service.get("nameHindi"):
                text_output += f"  {service['nameHindi']}\n"

    return f"{wrapped_card}\n\n{text_output}"


def format_date(date_value: Optional[str | datetime]) -> str:
    """
    Format date nicely.

    Args:
        date_value: ISO format date string or datetime object

    Returns:
        Formatted date string
    """
    if not date_value:
        return "N/A"
    
    # Handle datetime objects
    if isinstance(date_value, datetime):
        return date_value.strftime("%B %d, %Y, %I:%M %p")
    
    # Handle string dates
    try:
        # Try ISO format first
        if isinstance(date_value, str):
            date_str = date_value.replace("Z", "+00:00")
            date = datetime.fromisoformat(date_str)
            return date.strftime("%B %d, %Y, %I:%M %p")
    except Exception:
        # If parsing fails, return as-is
        return str(date_value)
    
    return "N/A"


def build_progress_bar(completed: int, total: int) -> str:
    """
    Make a progress bar.

    Args:
        completed: Number of completed steps
        total: Total number of steps

    Returns:
        Progress bar string
    """
    if total == 0:
        return ""
    percentage = int((completed / total) * 100)
    filled = int((completed / total) * 20)
    empty = 20 - filled
    return f"[{'█' * filled}{'░' * empty}] {percentage}%"


def get_status_badge(status: str) -> str:
    """
    Get status badge.

    Args:
        status: Status string

    Returns:
        Badge string
    """
    badges = {
        "SUBMITTED": "In Progress",
        "IN_PROGRESS": "Processing",
        "COMPLETED": "Completed",
        "PUBLISHED": "Published",
        "REJECTED": "Rejected",
        "AWAITING_PUBLICATION": "Awaiting Publication",
    }
    return badges.get(status, status)


def format_timeline_response(result: Dict) -> str:
    """
    Format application tracking timeline.

    Args:
        result: API response dictionary (ApplicationTimelineResponse directly)

    Returns:
        Formatted timeline string
    """
    # API now returns data directly, not wrapped
    data = result

    # Extract everything
    app_id = data.get("applicationId", "N/A")
    name = data.get("applicantName", "N/A")
    mobile = data.get("applicantMobile")
    service = data.get("serviceName", data.get("serviceType", "N/A"))
    status = data.get("status", "UNKNOWN")
    stage = data.get("currentStage", "Unknown")
    timeline = data.get("timeline", [])
    cert_ready = data.get("certificateReady", False)
    submitted = data.get("submittedDate")
    completed = data.get("completedDate")
    estimated = data.get("estimatedCompletionDate")
    metadata = data.get("metadata", {})

    completed_steps = metadata.get("completedSteps", 0)
    total_steps = metadata.get("totalSteps", len(timeline))

    # Build output
    output = "**Application Tracking / आवेदन ट्रैकिंग**\n\n"
    output += "═══════════════════════════════════════════\n\n"

    # Status
    output += f"**Status:** {get_status_badge(status)}\n"

    if cert_ready:
        output += "**Your certificate is ready for download.**\n"
    elif status == "REJECTED":
        output += "**Application has been rejected.**\n"
    elif status == "COMPLETED":
        output += "**Processing completed successfully.**\n"
    else:
        output += f"**Current Stage:** {stage}\n"

    output += "\n"

    # Expected delivery
    if completed:
        output += f"**Completed:** {format_date(completed)}\n"
    elif estimated and status not in ["REJECTED", "COMPLETED"]:
        output += f"**Expected Completion:** {format_date(estimated)}\n"

    output += "\n═══════════════════════════════════════════\n\n"

    # Progress bar
    if total_steps > 0 and status not in ["REJECTED"]:
        output += "**Progress:**\n"
        output += build_progress_bar(completed_steps, total_steps) + "\n"
        output += f"*{completed_steps} of {total_steps} steps completed*\n\n"

    output += "═══════════════════════════════════════════\n\n"

    # App details
    output += "**Application Details:**\n\n"
    output += "```\n"
    output += f"Application ID : {app_id}\n"
    output += f"Applicant Name : {name}\n"
    if mobile:
        output += f"Mobile Number  : {mobile}\n"
    output += f"Service Type   : {service}\n"
    output += f"Submitted On   : {format_date(submitted)}\n"
    output += "```\n\n"

    output += "═══════════════════════════════════════════\n\n"

    # Timeline
    output += "**Tracking Details:**\n\n"

    for idx, step in enumerate(timeline):
        is_done = step.get("completed", False)
        milestone = step.get("isMilestone", False)
        stage_name = step.get("stageName", "Processing Step")
        stage_name_hindi = step.get("stageNameHindi", "")
        office = step.get("office", "Government Office")
        officer = step.get("officerName", "Officer")
        designation = step.get("officerDesignation", "")
        timestamp = step.get("timestamp")
        remarks = step.get("remarks", "")
        action = step.get("actionTaken", "")

        # Stage name
        status_indicator = "[✓]" if is_done else "[ ]"
        if milestone:
            output += f"### {status_indicator} **{stage_name}**"
        else:
            output += f"{status_indicator} **{stage_name}**"

        if stage_name_hindi:
            output += f" / *{stage_name_hindi}*"
        output += "\n"

        # Details
        if timestamp:
            output += f"   Date: {format_date(timestamp)}\n"
        output += f"   Office: {office}\n"
        if officer not in ["Officer", "System"]:
            output += f"   Officer: {officer}"
            if designation:
                output += f" ({designation})"
            output += "\n"

        # Action
        if action and action != "PROCESSING":
            actions = {
                "SUBMITTED": "Submitted",
                "RECOMMEND": "Recommended",
                "FORWARD": "Forwarded",
                "APPROVE": "Approved",
                "REJECT": "Rejected",
                "SIGN": "Signed",
                "PUBLISH": "Published",
                "COMPLETED": "Completed",
            }
            output += f"   Action: {actions.get(action, action)}\n"

        if remarks:
            output += f"   Remarks: {remarks}\n"

        # Connector
        if idx < len(timeline) - 1:
            output += "\n"
        output += "\n"

    output += "═══════════════════════════════════════════\n\n"

    # Final message
    if cert_ready:
        output += "### **Certificate Ready**\n\n"
        output += f"To download: *\"Get certificate for {app_id}\"*\n\n"
    elif status == "REJECTED":
        output += "### **Application Rejected**\n\n"
        output += "Contact the office for more details.\n\n"
    elif status == "COMPLETED":
        output += "### **Processing Complete**\n\n"
        output += "Your application has been successfully processed.\n\n"
    else:
        output += "### **Under Process**\n\n"
        if estimated:
            output += f"Expected completion: {format_date(estimated)}\n\n"
        output += f"Track anytime: *\"Check {app_id}\"*\n\n"

    output += "---\n\n"
    output += "*Check status anytime with your Application ID or mobile number.*\n"

    return output


def format_certificate_response(result: Dict) -> str:
    """
    Format certificate info.

    Args:
        result: API response dictionary (CertificateInfoResponse directly)

    Returns:
        Formatted certificate string
    """
    # API now returns data directly, not wrapped
    cert = result

    output = "**Certificate Information**\n\n"
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    output += f"**Application ID:** {cert.get('applicationId', 'N/A')}\n"
    output += f"**Certificate Number:** {cert.get('certificateNumber', 'N/A')}\n"
    output += f"**Service:** {cert.get('certificateType', cert.get('serviceName', 'N/A'))}\n"
    if cert.get('certificateTypeHindi'):
        output += f"**सेवा:** {cert.get('certificateTypeHindi')}\n"
    output += f"**Applicant:** {cert.get('applicantName', 'N/A')}\n"
    if cert.get('applicantMobile'):
        output += f"**Mobile:** {cert.get('applicantMobile')}\n"
    output += f"**Issue Date:** {format_date(cert.get('issuedDate'))}\n"
    if cert.get('publishedDate'):
        output += f"**Published Date:** {format_date(cert.get('publishedDate'))}\n"
    if cert.get('validFrom'):
        output += f"**Valid From:** {format_date(cert.get('validFrom'))}\n"
    if cert.get('validUntil'):
        output += f"**Valid Until:** {format_date(cert.get('validUntil'))}\n"
    output += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    output += "**Download Links:**\n\n"

    preview = cert.get("previewUrl", "")
    download = cert.get("downloadUrl", "")

    if preview:
        output += f"**Preview (View Online):**\n{preview}\n\n"
    if download:
        output += f"**Download (Save PDF):**\n{download}\n\n"

    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    output += "**Instructions:**\n"
    output += "1. Click the preview link to view your certificate\n"
    output += "2. Use the download link to save the PDF\n"
    output += "3. Keep this certificate safe for official use"

    return output


def format_search_response(result: List[Dict]) -> str:
    """
    Format mobile search results.

    Args:
        result: List of ApplicationSearchResult dictionaries (direct array, not wrapped)

    Returns:
        Formatted search results string
    """
    # API now returns array directly
    apps = result if isinstance(result, list) else []

    if not apps:
        return (
            f"**No Applications Found**\n\n"
            f"No applications found for the provided mobile number.\n\n"
            f"Please verify:\n"
            f"• The mobile number is correct\n"
            f"• You have submitted applications using this number\n"
            f"• The number is registered in the system\n\n"
            f"If you need help, contact Apuni Sarkar support."
        )

    output = f"**Applications Found: {len(apps)}**\n\n"
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

    for idx, app in enumerate(apps):
        cert = app.get("certificateReady", False)
        status = app.get("status", "UNKNOWN")
        status_indicator = "[✓]" if cert else ("[X]" if status == "REJECTED" else "[ ]")

        output += f"{status_indicator} **{app.get('applicationId', 'N/A')}**\n"
        output += f"   Service: {app.get('serviceName') or app.get('serviceType', 'N/A')}\n"
        output += f"   Status: {status}\n"
        output += f"   Submitted: {format_date(app.get('submittedDate'))}\n"

        if done := app.get("completedDate"):
            output += f"   Completed: {format_date(done)}\n"
        if cert:
            output += "   Certificate Ready\n"

        if idx < len(apps) - 1:
            output += "\n"

    output += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    output += "**Next Steps:**\n"
    output += "• To check details: \"Check status of [Application ID]\"\n"
    output += "• To download certificate: \"Download certificate for [Application ID]\"\n"

    return output


def format_stats_response(result: Dict) -> str:
    """
    Format system stats.

    Args:
        result: API response dictionary (StatisticsResponse directly)

    Returns:
        Formatted stats string
    """
    # API now returns data directly, not wrapped
    stats = result

    output = "**Apuni Sarkar System Statistics**\n\n"
    output += "Uttarakhand E-Governance Portal\n\n"
    output += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    output += f"**Total Applications:** {stats.get('total', 0):,}\n"
    output += f"**Completed:** {stats.get('completed', 0):,}\n"
    output += f"**In Progress:** {stats.get('inProgress', 0):,}\n"
    output += f"**Rejected:** {stats.get('rejected', 0):,}\n"
    output += f"**Published Certificates:** {stats.get('published', 0):,}\n"
    output += f"**Today's Applications:** {stats.get('todayApplications', 0):,}\n"
    output += f"**Completion Rate:** {stats.get('completionRate', 'N/A')}\n\n"
    output += f"**Last Updated:** {format_date(stats.get('timestamp'))}\n"

    return output

