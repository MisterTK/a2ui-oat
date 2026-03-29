"""
Server for the ADK Inline Catalog example.

Demonstrates that the same agent architecture can use different catalogs.
Runs two agents side-by-side: one with Basic Catalog (18 components) and
one with Oat Catalog (35 components), showing the difference in output
richness.
"""

import json
import os
import sys
import asyncio

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn

# Load environment variables
_ENV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(os.path.abspath(_ENV_PATH))

# Import ADK components
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

# Import agent factory
from agent import create_agent

# Import A2UI parser
from a2ui.core.parser.parser import parse_response

# --------------------------------------------------------------------------
# Setup -- create both agents
# --------------------------------------------------------------------------

app = FastAPI(title="ADK Inline Catalog Comparison")

# Basic Catalog agent
basic_agent = create_agent('basic')
basic_session_service = InMemorySessionService()
basic_runner = Runner(
    agent=basic_agent,
    app_name="basic_demo",
    session_service=basic_session_service,
)

# Oat Catalog agent
oat_agent = create_agent('oat')
oat_session_service = InMemorySessionService()
oat_runner = Runner(
    agent=oat_agent,
    app_name="oat_demo",
    session_service=oat_session_service,
)

# Session tracking
_basic_sessions: dict[str, str] = {}
_oat_sessions: dict[str, str] = {}

USER_ID = "web_user"


async def get_or_create_session(service, sessions, app_name) -> str:
    if USER_ID not in sessions:
        session = await service.create_session(
            app_name=app_name, user_id=USER_ID,
        )
        sessions[USER_ID] = session.id
    return sessions[USER_ID]


async def run_agent(runner, session_service, sessions, app_name, message):
    """Run an agent and return parsed A2UI response."""
    session_id = await get_or_create_session(session_service, sessions, app_name)
    content = Content(role="user", parts=[Part(text=message)])
    response_text = ""

    async for event in runner.run_async(
        user_id=USER_ID, session_id=session_id, new_message=content,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    a2ui_data = []
    plain_text = ""
    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, list):
            a2ui_data = parsed
        elif isinstance(parsed, dict):
            a2ui_data = [parsed]
    except json.JSONDecodeError:
        try:
            parts = parse_response(response_text)
            for part in parts:
                if part.text:
                    plain_text += part.text + "\n"
                if part.a2ui_json:
                    a2ui_data.extend(part.a2ui_json)
        except ValueError:
            plain_text = response_text

    return {"text": plain_text.strip(), "a2ui": a2ui_data, "raw": response_text}


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    html_path = os.path.join(os.path.dirname(__file__), 'frontend', 'index.html')
    with open(html_path, 'r') as f:
        return HTMLResponse(f.read())


@app.post("/api/chat")
async def chat(request: Request):
    """
    Run both agents in parallel with the same prompt.
    Return both responses for side-by-side comparison.
    """
    body = await request.json()
    user_message = body.get("message", "").strip()
    mode = body.get("mode", "both")  # 'basic', 'oat', or 'both'

    if not user_message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    results = {}

    if mode in ("basic", "both"):
        results["basic"] = await run_agent(
            basic_runner, basic_session_service, _basic_sessions, "basic_demo", user_message
        )

    if mode in ("oat", "both"):
        results["oat"] = await run_agent(
            oat_runner, oat_session_service, _oat_sessions, "oat_demo", user_message
        )

    return JSONResponse(results)


@app.post("/api/reset")
async def reset_session():
    _basic_sessions.clear()
    _oat_sessions.clear()
    return JSONResponse({"status": "ok"})


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting ADK Inline Catalog server on http://localhost:8082")
    print("Open http://localhost:8082 in your browser")
    uvicorn.run(app, host="0.0.0.0", port=8082)
