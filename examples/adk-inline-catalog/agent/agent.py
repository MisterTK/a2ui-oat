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
            f'You are a dashboard agent for a production SRE platform, '
            f'using the {catalog_name} ({component_count} components available). '
            'On-call engineers use your surfaces to understand system health and respond to issues.'
        ),
        workflow_description=(
            'Create a dashboard surface for the user\'s request using the best components '
            'your catalog provides. Return a JSON array of A2UI messages: '
            'createSurface, updateComponents, updateDataModel. Use precise, realistic mock data.\n'
            'IMPORTANT: Component properties go at the TOP LEVEL (not under "properties"). '
            'Use "component" (not "type"). Children are arrays of string IDs. '
            'Data binding uses {"path": "/model/path"} objects.'
        ),
        ui_description=(
            '<component-selection>\n'
            'Choose the richest component your catalog offers for each type of information:\n'
            '- A percentage or consumption value: use Progress if available, otherwise Text\n'
            '- A metric with meaningful risk thresholds: use Meter if available (set low/high)\n'
            '- A discrete status: use Badge with variant if available, otherwise Text\n'
            '- Structured records: use Table if available\n'
            '- Secondary/collapsible detail: use Accordion if available\n'
            '- Multiple views on the same surface: use Tabs if available\n'
            '- A paginated record set: use Pagination + fetchPage if available\n'
            '- A toggle preference: use Switch if available\n'
            '</component-selection>\n\n'
            '<quality-bar>\n'
            'Organize the surface with clear visual hierarchy: a header establishing '
            'context and overall status, a primary content area for the main data, '
            'and a footer for alerts and controls. Use layout components (Row, Column, '
            'Grid if available) to group related information. '
            'Every component should earn its place by helping the engineer '
            'understand something or take an action.\n'
            '</quality-bar>'
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
