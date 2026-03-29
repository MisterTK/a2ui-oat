"""
Incidents Agent -- generates incident tracking tables using the Oat Catalog.
Uses structured JSON output for reliable A2UI generation.
"""

import os
from a2ui.core.schema.manager import A2uiSchemaManager, CatalogConfig
from a2ui.core.schema.constants import VERSION_0_9
from google.adk.agents.llm_agent import LlmAgent
from google.genai import types

_CATALOG_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'catalog', 'oat-catalog.json')
)

schema_manager = A2uiSchemaManager(
    version=VERSION_0_9,
    catalogs=[CatalogConfig.from_path(name='oat_catalog', catalog_path=_CATALOG_PATH)],
)

_instruction = schema_manager.generate_system_prompt(
    role_description=(
        'You are the incident management surface of a production SRE platform. '
        'Engineers use your output to triage open incidents, understand severity '
        'and impact, and track resolution. The primary question your surface must '
        'answer is: what needs my attention right now, and what is its context?'
    ),
    workflow_description=(
        'Generate an incident management surface. Use realistic mock data with '
        '6-8 incidents at mixed severities (1-2 critical, 2-3 high, 2-3 medium). '
        'Return createSurface, updateComponents, updateDataModel.\n'
        'IMPORTANT: Component properties go at the TOP LEVEL (not under "properties"). '
        'Use "component" (not "type"). Children are arrays of string IDs. '
        'Data binding uses {"path": "/model/path"}.'
    ),
    ui_description=(
        '<information-hierarchy>\n'
        'Incidents are structured records — Table is the right primary component. '
        'Design the surface around what an engineer needs during triage:\n\n'
        '1. TRIAGE TABLE (primary view)\n'
        '   Table with columns: ID, Title, Severity (Badge), Status (Badge), '
        'Service, Assigned, Time Open. Badge variants communicate urgency instantly — '
        'error for critical, warning for high, info for medium. '
        'Pagination if the dataset is large. A TextField + Dropdown filter row '
        'above the table lets engineers narrow by severity or service quickly.\n\n'
        '2. SUMMARY HEADER (load at a glance)\n'
        '   A row of summary Cards — one per severity level — with counts. '
        'This tells the engineer the overall incident load before they read a single row. '
        'An Alert in the header for any critical unassigned incident is the '
        'highest-priority escalation signal.\n\n'
        '3. DETAIL AND HISTORY (secondary)\n'
        '   Tabs separate active triage from resolved history and SLA tracking. '
        'Resolved incidents with their RCA notes belong in Accordion entries — '
        'accessible but not cluttering the live view. '
        'SLA compliance is a continuous value per service — Progress with a Meter '
        'showing breach threshold communicates risk better than a number alone.\n\n'
        '4. CONTROLS (surgical)\n'
        '   A Switch for auto-escalation and a Button for creating a new incident '
        'are the only controls most engineers need. Do not add controls that have '
        'no backing action in the current context.\n'
        '</information-hierarchy>'
    ),
    include_schema=True,
)


def instruction(_ctx):
    return _instruction


incidents_agent = LlmAgent(
    model='gemini-3-flash-preview',
    name='incidents_agent',
    description='Generates incident tracking tables with severity badges and status.',
    instruction=instruction,
    generate_content_config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
        response_mime_type='application/json',
    ),
)
