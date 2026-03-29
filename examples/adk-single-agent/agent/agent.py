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
        'You are a world-class dashboard agent that creates stunning, feature-rich '
        'system dashboards. You showcase the full power of the Oat component catalog.'
    ),
    workflow_description=(
        'When the user asks about system status, metrics, or any data, create an '
        'impressive, comprehensive dashboard UI. Return a JSON array of A2UI messages. '
        'Each message has "version": "v0.9" and one of: createSurface, updateComponents, '
        'or updateDataModel. Always include all three message types. Use rich mock data. '
        'IMPORTANT: Component properties go at the TOP LEVEL of each component object '
        '(NOT nested under a "properties" key). Use "component" (not "type") for the '
        'component name. Children must be arrays of string IDs (not inline objects). '
        'Data binding uses {"path": "/model/path"} objects for dynamic values.'
    ),
    ui_description=(
        'CREATE A RICH, MULTI-SECTION DASHBOARD. You have 37 components -- use many of them:\n'
        '- TOP-LEVEL LAYOUT: Use Tabs to organise sections (Overview, Performance, Services, Logs). '
        'Each tab panel should contain a Column with multiple cards.\n'
        '- HEADER: Breadcrumb for navigation context, Row with Avatar + Text for user/system info, '
        'Badge for overall health status, Icon for decorative elements.\n'
        '- METRICS SECTION: Grid layout with Card containers holding Progress bars for CPU/memory/disk, '
        'Meter for threshold indicators (with low/high/optimum), Slider for capacity visualization.\n'
        '- DATA TABLES: Table with multiple rows, Badge cells for status, Icon cells for severity. '
        'Add Pagination below large tables.\n'
        '- STATUS & ALERTS: Alert for warnings/errors, Switch for toggles, Dropdown for filters, '
        'ChoicePicker for view selection.\n'
        '- ACCORDIONS: Use Accordion (with name attribute for grouping) for collapsible log sections '
        'or detailed subsections.\n'
        '- INTERACTIVE: Button for actions, TextField for search/filter, Tooltip wrapping key metrics '
        'to show context on hover.\n'
        '- MISC: Divider between sections, List for bullet-point summaries, Skeleton for loading states.\n'
        'Aim for 25-40 components total. Make it a showcase of what A2UI + Oat can do.'
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
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
        response_mime_type='application/json',
    ),
)
