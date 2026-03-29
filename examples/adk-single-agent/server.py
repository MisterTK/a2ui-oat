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

    if not user_message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    session_id = await get_or_create_session()

    # Run the agent
    content = Content(role="user", parts=[Part(text=user_message)])
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

    # Parse A2UI JSON from the response
    a2ui_data = []
    plain_text = ""

    try:
        parts = parse_response(response_text)
        for part in parts:
            if part.text:
                plain_text += part.text + "\n"
            if part.a2ui_json:
                a2ui_data.extend(part.a2ui_json)
    except ValueError:
        # No A2UI tags found -- return raw text
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
