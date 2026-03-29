"""
Inline Catalog Agent -- demonstrates dynamic catalog injection.
Uses structured JSON output for reliable A2UI generation.
"""

import os
from a2ui.core.schema.manager import A2uiSchemaManager, CatalogConfig
from a2ui.core.schema.constants import VERSION_0_9
from google.adk.agents.llm_agent import LlmAgent
from google.genai import types

# Catalog paths
_OAT_CATALOG_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'catalog', 'oat-catalog.json')
)

import a2ui
_BASIC_CATALOG_PATH = os.path.join(
    os.path.dirname(a2ui.__file__), 'assets', '0.9', 'basic_catalog.json'
)


def create_agent(mode: str = 'oat') -> LlmAgent:
    """Create an agent with Basic or Oat catalog."""
    if mode == 'basic':
        catalog_path = _BASIC_CATALOG_PATH
        catalog_name = 'basic_catalog'
        component_count = 18
    else:
        catalog_path = _OAT_CATALOG_PATH
        catalog_name = 'oat_catalog'
        component_count = 35

    schema_manager = A2uiSchemaManager(
        version=VERSION_0_9,
        catalogs=[CatalogConfig.from_path(name=catalog_name, catalog_path=catalog_path)],
    )

    _instruction = schema_manager.generate_system_prompt(
        role_description=(
            f'You are a dashboard agent using the {catalog_name} ({component_count} components). '
            'You generate rich dashboard UIs.'
        ),
        workflow_description=(
            'Create a UI using the components available in your catalog. '
            'Return a JSON array of A2UI messages. Include createSurface, '
            'updateComponents, and updateDataModel. Use realistic mock data. '
            'Make the dashboard visually rich with multiple component types. '
            'IMPORTANT: Component properties go at the TOP LEVEL (NOT nested under '
            '"properties"). Use "component" (not "type"). Children are arrays of string IDs.'
        ),
        ui_description=(
            'Use all available component types to create a rich dashboard. '
            'Use layout components (Row, Column) to organize content. '
            'Include interactive elements and data displays where appropriate.'
        ),
        include_schema=True,
    )

    def instruction_fn(_ctx):
        return _instruction

    return LlmAgent(
        model='gemini-3-flash-preview',
        name=f'{mode}_dashboard_agent',
        description=f'Dashboard agent using {catalog_name} ({component_count} components).',
        instruction=instruction_fn,
        generate_content_config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
            response_mime_type='application/json',
        ),
    )
