"""
Inline Catalog Agent -- demonstrates dynamic catalog injection.

This module provides a factory function that creates an ADK agent
with either the Basic Catalog (18 components) or the full Oat Catalog
(35 components), showing that the same agent can use different catalogs
at creation time.
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

# The basic catalog ships with the a2ui package
import a2ui
_BASIC_CATALOG_PATH = os.path.join(
    os.path.dirname(a2ui.__file__), 'assets', '0.9', 'basic_catalog.json'
)


def create_agent(mode: str = 'oat') -> LlmAgent:
    """
    Create an agent with the specified catalog mode.

    Args:
        mode: 'basic' for Basic Catalog (18 components) or
              'oat' for Oat Catalog (35 components).

    Returns:
        Configured LlmAgent with the appropriate catalog in its system prompt.
    """
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
            'You generate rich dashboard UIs. Always respond with A2UI JSON.'
        ),
        workflow_description=(
            'When the user asks for a dashboard or data display, create a UI using '
            'the components available in your catalog. Always wrap your A2UI JSON in '
            '<a2ui-json> and </a2ui-json> tags. The JSON should be a list of A2UI '
            'messages. Include createSurface, updateComponents, and updateDataModel. '
            'Use data binding with {"path": "/some/path"} for dynamic values. '
            'Use realistic mock data. Make the dashboard visually rich with multiple '
            'component types.'
        ),
        ui_description=(
            'Use all available component types to create a rich dashboard. '
            'Use layout components (Row, Column) to organize content. '
            'Include interactive elements and data displays where appropriate.'
        ),
        include_schema=True,
    )

    # Use a callable to bypass ADK's state injection, which would otherwise
    # try to interpret curly braces in the JSON schema as template variables.
    def instruction_fn(_ctx):
        return _instruction

    return LlmAgent(
        model='gemini-3-flash-preview',
        name=f'{mode}_dashboard_agent',
        description=f'Dashboard agent using {catalog_name} ({component_count} components).',
        instruction=instruction_fn,
        generate_content_config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level='MEDIUM'),
        ),
    )
