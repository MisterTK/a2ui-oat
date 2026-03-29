"""
Server for the ADK Single Agent example.

Runs a FastAPI server that:
- Serves the frontend at /
- Exposes POST /api/chat to interact with the ADK dashboard agent
- Parses A2UI JSON from the agent response and returns it to the frontend
"""

import json
import os
import sys
import asyncio

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Load environment variables from .env at project root
_ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(os.path.abspath(_ENV_PATH))

# Import ADK components
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

# Import the agent
from agent import root_agent

# Import A2UI parser
from a2ui.core.parser.parser import parse_response

# --------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------

app = FastAPI(title="ADK Single Agent - Oat Dashboard")

# Serve renderer/ from the repo root so the frontend can import OatRenderer
_RENDERER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'renderer'))
app.mount("/renderer", StaticFiles(directory=_RENDERER_DIR), name="renderer")

session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name="oat_dashboard",
    session_service=session_service,
)

# In-memory session tracking per user
_sessions: dict[str, str] = {}

APP_NAME = "oat_dashboard"
USER_ID = "web_user"

DOMAIN_CONTEXTS = {
    "sre": (
        "Platform: SRE operations. Audience: on-call engineers. "
        "Design for instant visibility into system health, service reliability, "
        "incident status, infrastructure metrics, and alert triage."
    ),
    "retail": (
        "Platform: Retail management. Audience: store managers and merchants. "
        "Design for visibility into inventory levels, sales performance, "
        "order fulfillment, product trends, and customer analytics."
    ),
    "healthcare": (
        "Platform: Healthcare operations. Audience: clinical staff and administrators. "
        "Design for visibility into patient appointments, care team workloads, "
        "department capacity, clinical metrics, and resource utilization."
    ),
    "sales": (
        "Platform: Sales CRM. Audience: sales reps and managers. "
        "Design for visibility into pipeline health, lead status, "
        "revenue forecasts, deal activity, and team performance."
    ),
}


async def get_or_create_session() -> str:
    """Get or create a session for the web user."""
    if USER_ID not in _sessions:
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=USER_ID,
        )
        _sessions[USER_ID] = session.id
    return _sessions[USER_ID]


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the frontend HTML."""
    html_path = os.path.join(os.path.dirname(__file__), 'frontend', 'index.html')
    with open(html_path, 'r') as f:
        return HTMLResponse(f.read())


@app.post("/api/chat")
async def chat(request: Request):
    """
    Accept a user message, run the ADK agent, parse A2UI JSON from
    the response, and return both the text and A2UI data.
    """
    body = await request.json()
    user_message = body.get("message", "").strip()
    domain = body.get("domain", "sre")

    if not user_message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    domain_ctx = DOMAIN_CONTEXTS.get(domain, DOMAIN_CONTEXTS["sre"])
    full_message = f"{domain_ctx}\n\nRequest: {user_message}"

    session_id = await get_or_create_session()

    # Run the agent
    content = Content(role="user", parts=[Part(text=full_message)])
    response_text = ""

    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    # With structured output (response_mime_type=application/json), the
    # response is pure JSON -- no <a2ui-json> tags to parse.
    a2ui_data = []
    plain_text = ""

    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, list):
            a2ui_data = parsed
        elif isinstance(parsed, dict):
            a2ui_data = [parsed]
    except json.JSONDecodeError:
        # Fallback: try the A2UI tag parser for non-JSON responses
        try:
            parts = parse_response(response_text)
            for part in parts:
                if part.text:
                    plain_text += part.text + "\n"
                if part.a2ui_json:
                    a2ui_data.extend(part.a2ui_json)
        except ValueError:
            plain_text = response_text

    return JSONResponse({
        "text": plain_text.strip(),
        "a2ui": a2ui_data,
        "raw": response_text,
    })


@app.post("/api/reset")
async def reset_session():
    """Reset the conversation session."""
    if USER_ID in _sessions:
        del _sessions[USER_ID]
    return JSONResponse({"status": "ok"})


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting ADK Single Agent server on http://localhost:8080")
    print("Open http://localhost:8080 in your browser")
    uvicorn.run(app, host="0.0.0.0", port=8080)
