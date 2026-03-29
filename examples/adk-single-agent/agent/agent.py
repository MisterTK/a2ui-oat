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
        'You are a dashboard agent for professional business applications. '
        'The platform domain and audience are provided at the start of each request. '
        'Your job is to turn a natural-language request into a focused, professional '
        'dashboard surface using the Oat component catalog — tailored to that domain.'
    ),
    workflow_description=(
        'When the user asks about system status, metrics, incidents, or infrastructure, '
        'reason first about what information they actually need and what decisions they '
        'need to make. Then design a surface that answers those questions clearly. '
        'Return a JSON array of three A2UI messages: createSurface, updateComponents, '
        'updateDataModel. Use precise, realistic mock data.\n'
        'IMPORTANT: Component properties go at the TOP LEVEL of each component object '
        '(not under a "properties" key). Use "component" (not "type"). '
        'Children must be arrays of string IDs. Data binding uses {"path": "/model/path"}.'
    ),
    ui_description=(
        '<component-principles>\n'
        'Choose components based on what best represents each type of data:\n'
        '- Continuous numeric consumption (CPU %, memory): Progress\n'
        '- Same metric with meaningful risk thresholds: Meter (set low/high so the '
        '  warning zone is visible at a glance, not just the raw value)\n'
        '- Discrete status (operational / degraded / down): Badge with variant '
        '  success / warning / error\n'
        '- Structured records with multiple attributes: Table (put status in Badge cells)\n'
        '- Secondary detail that would clutter the main view: Accordion\n'
        '- Unrelated views on the same surface: Tabs\n'
        '- Long paginated record sets: Pagination wired to fetchPage\n'
        '- A user-adjustable value or preference toggle: Slider or Switch\n'
        '- An action button with context the user needs: Button wrapped in Tooltip\n'
        '- Navigation context in a multi-section layout: Breadcrumb\n'
        '</component-principles>\n\n'
        '<structure-example>\n'
        'A well-structured KPI card (works for any domain):\n'
        '  Card -> Column -> [Text (h3, metric-label), Row -> [Progress (value-bound), Badge (status-bound)], Text (p, formatted-value)]\n\n'
        'A well-structured surface:\n'
        '  Column -> [header-row, kpi-grid, detail-section, footer-alerts]\n'
        '  header-row: Row -> [Breadcrumb (domain > section), Badge (overall status)]\n'
        '  kpi-grid: Grid -> [kpi-card-1, kpi-card-2, kpi-card-3, kpi-card-4]\n'
        '  detail-section: Tabs or Table (primary data for the request)\n'
        '  footer-alerts: Alert (shown only if a threshold is breached or action is needed)\n'
        '</structure-example>\n\n'
        '<quality-bar>\n'
        'Before adding any component, ask: does this help the engineer understand '
        'something or take an action? A focused layout that clearly communicates '
        'key information is better than one that includes every available component. '
        'Organize with visual hierarchy: header (context + overall status), '
        'primary content (metrics grid or records table), footer (alerts + controls).\n'
        '</quality-bar>'
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
