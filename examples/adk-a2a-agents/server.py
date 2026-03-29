"""
Server for the ADK A2A Multi-Agent example.

Runs a FastAPI server with an orchestrator that delegates to two
sub-agents (metrics + incidents). Each sub-agent generates its own
A2UI surface, rendered side-by-side in the frontend.
"""

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

# Import the orchestrator (which includes sub-agents)
from agents.orchestrator import root_agent

# Import A2UI parser
from a2ui.core.parser.parser import parse_response

# --------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------

app = FastAPI(title="ADK A2A Multi-Agent - Oat Dashboard")

session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name="a2a_dashboard",
    session_service=session_service,
)

_sessions: dict[str, str] = {}

APP_NAME = "a2a_dashboard"
USER_ID = "web_user"


async def get_or_create_session() -> str:
    if USER_ID not in _sessions:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=USER_ID,
        )
        _sessions[USER_ID] = session.id
    return _sessions[USER_ID]


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
    Run the orchestrator agent. It will delegate to sub-agents.
    We collect all events and group A2UI responses by which agent
    authored them.
    """
    body = await request.json()
    user_message = body.get("message", "").strip()
    if not user_message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    session_id = await get_or_create_session()
    content = Content(role="user", parts=[Part(text=user_message)])

    # Collect events grouped by author
    agent_responses: dict[str, str] = {}

    async for event in runner.run_async(
        user_id=USER_ID,
        session_id=session_id,
        new_message=content,
    ):
        if event.content and event.content.parts:
            author = event.author or "orchestrator"
            if author not in agent_responses:
                agent_responses[author] = ""
            for part in event.content.parts:
                if part.text:
                    agent_responses[author] += part.text

    # Parse A2UI from each agent's response
    surfaces = {}
    for agent_name, response_text in agent_responses.items():
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
            plain_text = response_text

        if a2ui_data or plain_text.strip():
            surfaces[agent_name] = {
                "text": plain_text.strip(),
                "a2ui": a2ui_data,
            }

    return JSONResponse({
        "surfaces": surfaces,
        "agents": list(agent_responses.keys()),
    })


@app.post("/api/reset")
async def reset_session():
    if USER_ID in _sessions:
        del _sessions[USER_ID]
    return JSONResponse({"status": "ok"})


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting ADK A2A Multi-Agent server on http://localhost:8081")
    print("Open http://localhost:8081 in your browser")
    uvicorn.run(app, host="0.0.0.0", port=8081)
