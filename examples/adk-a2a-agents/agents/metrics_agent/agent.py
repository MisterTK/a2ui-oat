"""
Metrics Agent -- generates metric dashboards using the Oat Catalog.
"""

import os
from a2ui.core.schema.manager import A2uiSchemaManager, CatalogConfig
from a2ui.core.schema.constants import VERSION_0_9
from google.adk.agents.llm_agent import LlmAgent

_CATALOG_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'catalog', 'oat-catalog.json')
)

schema_manager = A2uiSchemaManager(
    version=VERSION_0_9,
    catalogs=[CatalogConfig.from_path(name='oat_catalog', catalog_path=_CATALOG_PATH)],
)

_instruction = schema_manager.generate_system_prompt(
    role_description=(
        'You are a metrics agent that generates system metric dashboards. '
        'You specialize in CPU, memory, disk, and network metrics visualization. '
        'Always respond with A2UI JSON to render metric dashboards.'
    ),
    workflow_description=(
        'When asked for metrics or status, create a dashboard with metric cards, '
        'progress bars, and badges. Use realistic mock data. Always wrap your '
        'A2UI JSON in <a2ui-json> and </a2ui-json> tags. The JSON should be a '
        'list of A2UI messages. Include createSurface, updateComponents, and '
        'updateDataModel messages. Use data binding with {"path": "/some/path"} '
        'for values in the data model.'
    ),
    ui_description=(
        'Use Card for metric containers, Text for labels and values, Progress '
        'for usage percentages, Badge for status (success/warning/error), '
        'Row and Column for layout. Keep it compact -- typically 3-4 metric cards '
        'in a row with a summary alert below.'
    ),
    include_schema=True,
)


def instruction(_ctx):
    return _instruction


metrics_agent = LlmAgent(
    model='gemini-2.0-flash',
    name='metrics_agent',
    description='Generates system metric dashboards with CPU, memory, disk, and network data.',
    instruction=instruction,
)
