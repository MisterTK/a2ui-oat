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
            'Your goal is to create the most impressive, feature-packed dashboard possible '
            'using every available component to demonstrate the full capability of your catalog.'
        ),
        workflow_description=(
            'Create a comprehensive, visually stunning dashboard using as many different '
            'component types as possible from your catalog. Return a JSON array of A2UI messages. '
            'Include createSurface, updateComponents, and updateDataModel. Use rich, realistic '
            'mock data. Aim for 20-35 components in a well-organized layout. '
            'IMPORTANT: Component properties go at the TOP LEVEL (NOT nested under '
            '"properties"). Use "component" (not "type"). Children are arrays of string IDs. '
            'Data binding uses {"path": "/model/path"} objects for dynamic values.'
        ),
        ui_description=(
            f'SHOWCASE ALL {component_count} AVAILABLE COMPONENTS. Create a multi-section dashboard:\n'
            '- Use Tabs to organize into sections (Overview, Details, Settings or similar)\n'
            '- Include layout: Row, Column, Grid, Card, Sidebar (if available)\n'
            '- Include data display: Table (with Pagination), List, Accordion\n'
            '- Include metrics: Progress, Meter, Badge, Alert\n'
            '- Include text: Text (h1/h2/h3/p), Breadcrumb, Divider\n'
            '- Include interactive: Button, TextField, Dropdown, Switch, ChoicePicker, Slider\n'
            '- Include rich: Avatar, Icon, Tooltip, Image (if available)\n'
            '- Use Badge variants: success, warning, error, info throughout\n'
            '- Use Alert variants: info, warning, error for different messages\n'
            'Every section should demonstrate a different set of components. '
            'The goal is to show the BREADTH of what this catalog can render.'
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
