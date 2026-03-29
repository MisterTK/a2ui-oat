"""
Orchestrator Agent -- delegates to metrics and incidents sub-agents.

The orchestrator itself does not use A2UI. It delegates to the
specialized sub-agents which each generate their own A2UI surfaces.
"""

from google.adk.agents.llm_agent import LlmAgent
from google.genai import types
from agents.metrics_agent import metrics_agent
from agents.incidents_agent import incidents_agent

root_agent = LlmAgent(
    model='gemini-3-flash-preview',
    name='orchestrator',
    description='Routes requests to metrics or incidents sub-agents.',
    generate_content_config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level='MEDIUM'),
    ),
    instruction=(
        'You are an orchestrator that delegates to specialized sub-agents. '
        'When the user asks about metrics, system status, CPU, memory, or '
        'performance, delegate to the metrics_agent. When the user asks about '
        'incidents, issues, alerts, or problems, delegate to the incidents_agent. '
        'When asked for a full dashboard or overview, delegate to BOTH agents '
        'by making two separate requests. Always delegate -- never respond directly.'
    ),
    sub_agents=[metrics_agent, incidents_agent],
)
