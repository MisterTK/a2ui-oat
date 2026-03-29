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
        'You are the metrics surface of a production SRE platform. On-call engineers '
        'use your output to quickly answer three questions: Is the system healthy right '
        'now? What resources are under pressure? What thresholds are being approached '
        'or breached?'
    ),
    workflow_description=(
        'Generate a metrics dashboard surface with realistic, precise mock data '
        '(e.g. CPU: 67.3%, Memory: 11.2 / 16 GB, Disk I/O: 342 MB/s). '
        'Return createSurface, updateComponents, updateDataModel.\n'
        'IMPORTANT: Component properties go at the TOP LEVEL (not under "properties"). '
        'Use "component" (not "type"). Children are arrays of string IDs. '
        'Data binding uses {"path": "/model/path"}.'
    ),
    ui_description=(
        '<information-hierarchy>\n'
        'Structure the surface in three levels of information need:\n\n'
        '1. IMMEDIATE STATUS (what the engineer sees first)\n'
        '   Key resources — CPU, memory, disk, network — each shown as a Card with:\n'
        '   Progress for the consumption value and Meter for threshold awareness '
        '   (set low/high so the risk zone is visible, not just the number). '
        '   A Badge per card (success / warning / error) gives instant triage signal. '
        '   One overall health Badge in the header row anchors the whole view.\n\n'
        '2. CONTEXTUAL DETAIL (when the engineer drills down)\n'
        '   Use Tabs to separate resource categories from network from process breakdown. '
        '   A Table showing top processes by CPU or memory belongs in the detail tab, '
        '   not the summary. Accordion for recent alert history keeps logs accessible '
        '   without cluttering the primary view.\n\n'
        '3. CONTROLS (minimal — an overwhelmed engineer misses things)\n'
        '   Alert if any threshold is actively breached. Switch for auto-refresh. '
        '   A Tooltip-wrapped Button for manual refresh with "Last updated: Xs ago" context.\n'
        '</information-hierarchy>\n\n'
        '<structure-example>\n'
        'Metric card pattern:\n'
        '  Card -> Column -> [Text (h3, "CPU"), Row -> [Progress, Badge], Text (p, "67.3%")]\n'
        '  With threshold awareness:\n'
        '  Card -> Column -> [Text (h3, "Disk"), Meter (value=85, low=70, high=90), Badge]\n'
        '</structure-example>'
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
