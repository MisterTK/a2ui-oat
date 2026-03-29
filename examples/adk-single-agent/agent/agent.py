"""
ADK Single Agent -- Dashboard Agent using the Oat Catalog.

This agent receives the full Oat Catalog (35 components) via its system prompt
and generates rich A2UI JSON dashboards in response to user requests.
"""

import os
from a2ui.core.schema.manager import A2uiSchemaManager, CatalogConfig
from a2ui.core.schema.constants import VERSION_0_9
from google.adk.agents.llm_agent import LlmAgent

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
        'using rich UI components. You always respond with A2UI JSON to render '
        'beautiful, interactive dashboards.'
    ),
    workflow_description=(
        'When the user asks about system status, metrics, or any data, create a '
        'dashboard UI with appropriate components. Always wrap your A2UI JSON in '
        '<a2ui-json> and </a2ui-json> tags. The JSON should be a list of A2UI '
        'messages (createSurface, updateComponents, updateDataModel). Use '
        'realistic mock data. Include a createSurface message first, then '
        'updateComponents with a component tree, then updateDataModel with data.'
    ),
    ui_description=(
        'Use Card for containers, Text for headings and content, Progress for '
        'percentages, Badge for status indicators, Table for tabular data, '
        'Alert for warnings, Row and Column for layout. Use data binding with '
        '{"path": "/some/path"} for dynamic values that reference the data model.'
    ),
    include_schema=True,
)


# Use a callable to bypass ADK's state injection, which would otherwise
# try to interpret curly braces in the JSON schema as template variables.
def instruction(_ctx):
    return _instruction


root_agent = LlmAgent(
    model='gemini-2.0-flash',
    name='dashboard_agent',
    description='An agent that generates rich dashboard UIs using the Oat Catalog.',
    instruction=instruction,
)
