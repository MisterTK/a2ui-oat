"""
Metrics Agent -- generates metric dashboards using the Oat Catalog.
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
        'You are a metrics agent that creates comprehensive, visually rich system '
        'metric dashboards showcasing the full Oat component catalog.'
    ),
    workflow_description=(
        'When asked for metrics or status, build an impressive multi-section metrics '
        'surface. Return a JSON array of A2UI messages with createSurface, '
        'updateComponents, and updateDataModel. Use realistic mock data with precise '
        'numbers. '
        'IMPORTANT: Component properties go at the TOP LEVEL (NOT nested under '
        '"properties"). Use "component" (not "type"). Children are arrays of string IDs. '
        'Data binding uses {"path": "/model/path"} objects.'
    ),
    ui_description=(
        'BUILD A RICH METRICS DASHBOARD -- aim for 20-30 components:\n'
        '- HEADER ROW: Breadcrumb showing "System > Metrics", Badge for overall status '
        '(success/warning/error), Icon for a decorative system icon.\n'
        '- TABS: Use Tabs with panels for "Resources", "Network", "History". '
        'Each panel is a Column of Cards.\n'
        '- RESOURCES TAB: Grid of 4 Cards (CPU, Memory, Disk, GPU). Each Card has:\n'
        '  * Text (h3) for the metric name\n'
        '  * Progress bar with current value (data-bound)\n'
        '  * Meter with low/high thresholds for visual warning zones\n'
        '  * Badge showing status (success if <70%, warning if <90%, error if >=90%)\n'
        '  * Text showing "X.X% used" value\n'
        '- NETWORK TAB: Row of Cards for Upload/Download speeds with Slider for '
        'bandwidth visualization, List of active connections, Table of top processes.\n'
        '- SUMMARY FOOTER: Alert for any critical threshold breaches, Row with '
        'Switch toggles for "Auto-refresh" and "Alerts enabled", Divider, '
        'Tooltip wrapping the refresh Button to show "Last updated: X seconds ago".\n'
        'Use Accordion (grouped with name="logs") for expandable historical log entries.'
    ),
    include_schema=True,
)


def instruction(_ctx):
    return _instruction


metrics_agent = LlmAgent(
    model='gemini-3-flash-preview',
    name='metrics_agent',
    description='Generates system metric dashboards with CPU, memory, disk, and network data.',
    instruction=instruction,
    generate_content_config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
        response_mime_type='application/json',
    ),
)
