"""
ADK Single Agent -- Dashboard Agent using the Oat Catalog.

Uses Gemini 3 Flash with structured JSON output to guarantee valid A2UI JSON.
"""

import os
from a2ui.core.schema.manager import A2uiSchemaManager, CatalogConfig
from a2ui.core.schema.constants import VERSION_0_9
from google.adk.agents.llm_agent import LlmAgent
from google.genai import types

# Resolve the catalog path relative to this file
_CATALOG_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', 'catalog', 'oat-catalog.json'
)

schema_manager = A2uiSchemaManager(
    version=VERSION_0_9,
    catalogs=[
        CatalogConfig.from_path(
            name='oat_catalog',
            catalog_path=os.path.abspath(_CATALOG_PATH),
        ),
    ],
)

_instruction = schema_manager.generate_system_prompt(
    role_description=(
        'You are a dashboard agent that presents system metrics and information '
        'using rich UI components.'
    ),
    workflow_description=(
        'When the user asks about system status, metrics, or any data, create a '
        'dashboard UI with appropriate components. Return a JSON array of A2UI '
        'messages. Each message has "version": "v0.9" and one of: createSurface, '
        'updateComponents, or updateDataModel. Always include all three message '
        'types. Use realistic mock data. '
        'IMPORTANT: Component properties go at the TOP LEVEL of each component '
        'object (NOT nested under a "properties" key). Use "component" (not "type") '
        'for the component name. Children must be arrays of string IDs.'
    ),
    ui_description=(
        'Use Card for containers, Text for headings and content, Progress for '
        'percentages, Badge for status indicators, Table for tabular data, '
        'Alert for warnings, Row and Column for layout. Use data binding with '
        '{"path": "/some/path"} for dynamic values that reference the data model.'
    ),
    include_schema=True,
)


def instruction(_ctx):
    return _instruction


root_agent = LlmAgent(
    model='gemini-3-flash-preview',
    name='dashboard_agent',
    description='An agent that generates rich dashboard UIs using the Oat Catalog.',
    instruction=instruction,
    generate_content_config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level='MEDIUM'),
        response_mime_type='application/json',
    ),
)
