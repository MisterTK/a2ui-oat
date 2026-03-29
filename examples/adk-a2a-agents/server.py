"""
Server for the ADK A2A Multi-Agent example.

Runs both sub-agents (metrics + incidents) in parallel and returns
their A2UI surfaces side-by-side. Each agent generates its own
A2UI JSON independently using structured output.
"""

import asyncio
import json
import os
import sys

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

# Import the sub-agents directly (not the orchestrator)
from agents.metrics_agent import metrics_agent
from agents.incidents_agent import incidents_agent

# --------------------------------------------------------------------------
# Setup -- one runner per agent
# --------------------------------------------------------------------------

app = FastAPI(title="ADK A2A Multi-Agent - Oat Dashboard")

metrics_session_service = InMemorySessionService()
metrics_runner = Runner(
    agent=metrics_agent,
    app_name="metrics",
    session_service=metrics_session_service,
)

incidents_session_service = InMemorySessionService()
incidents_runner = Runner(
    agent=incidents_agent,
    app_name="incidents",
    session_service=incidents_session_service,
)

_metrics_sessions: dict[str, str] = {}
_incidents_sessions: dict[str, str] = {}

USER_ID = "web_user"


async def get_or_create_session(service, sessions, app_name) -> str:
    if USER_ID not in sessions:
        session = await service.create_session(
            app_name=app_name, user_id=USER_ID,
        )
        sessions[USER_ID] = session.id
    return sessions[USER_ID]


async def run_agent(runner, session_service, sessions, app_name, message):
    """Run a single agent and return parsed A2UI data."""
    session_id = await get_or_create_session(
        session_service, sessions, app_name,
    )
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
        plain_text = response_text

    return {"text": plain_text.strip(), "a2ui": a2ui_data}


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
    """Run both agents in parallel with the same prompt."""
    body = await request.json()
    user_message = body.get("message", "").strip()
    if not user_message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    # Run both agents in parallel
    metrics_task = asyncio.create_task(
        run_agent(
            metrics_runner, metrics_session_service,
            _metrics_sessions, "metrics",
            f"Show system metrics for: {user_message}",
        )
    )
    incidents_task = asyncio.create_task(
        run_agent(
            incidents_runner, incidents_session_service,
            _incidents_sessions, "incidents",
            f"Show incidents related to: {user_message}",
        )
    )

    metrics_result, incidents_result = await asyncio.gather(
        metrics_task, incidents_task, return_exceptions=True,
    )

    surfaces = {}
    if isinstance(metrics_result, dict):
        surfaces["metrics_agent"] = metrics_result
    else:
        surfaces["metrics_agent"] = {"text": f"Error: {metrics_result}", "a2ui": []}

    if isinstance(incidents_result, dict):
        surfaces["incidents_agent"] = incidents_result
    else:
        surfaces["incidents_agent"] = {"text": f"Error: {incidents_result}", "a2ui": []}

    return JSONResponse({
        "surfaces": surfaces,
        "agents": ["metrics_agent", "incidents_agent"],
    })


@app.post("/api/reset")
async def reset_session():
    _metrics_sessions.clear()
    _incidents_sessions.clear()
    return JSONResponse({"status": "ok"})


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting ADK A2A Multi-Agent server on http://localhost:8081")
    print("Open http://localhost:8081 in your browser")
    uvicorn.run(app, host="0.0.0.0", port=8081)
