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
        'You are an incidents agent that generates incident tracking displays. '
        'You specialize in showing active incidents, severity levels, affected '
        'services, and resolution status.'
    ),
    workflow_description=(
        'When asked about incidents or issues, create a table of incidents with '
        'severity badges and status information. Use realistic mock data with '
        '5-8 incidents. Return a JSON array of A2UI messages. Include createSurface, '
        'updateComponents, and updateDataModel messages. '
        'IMPORTANT: Component properties go at the TOP LEVEL (NOT nested under '
        '"properties"). Use "component" (not "type"). Children are arrays of string IDs.'
    ),
    ui_description=(
        'Use Table for the incident list with columns for ID, title, severity, '
        'status, and assigned team. Use Badge for severity levels (error for '
        'critical, warning for high, info for medium). Use Alert for summary '
        'counts. Use Row and Column for layout.'
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
