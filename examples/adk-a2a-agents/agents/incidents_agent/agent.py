"""
Incidents Agent -- generates incident tracking tables using the Oat Catalog.
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
        'You are an incidents agent that creates comprehensive incident management '
        'dashboards with rich interactive UI showcasing the full Oat component catalog.'
    ),
    workflow_description=(
        'When asked about incidents or issues, build a full incident management surface. '
        'Return a JSON array of A2UI messages with createSurface, updateComponents, '
        'and updateDataModel. Use realistic mock data with 6-10 incidents across '
        'various severity levels. '
        'IMPORTANT: Component properties go at the TOP LEVEL (NOT nested under '
        '"properties"). Use "component" (not "type"). Children are arrays of string IDs. '
        'Data binding uses {"path": "/model/path"} objects.'
    ),
    ui_description=(
        'BUILD A RICH INCIDENT MANAGEMENT DASHBOARD -- aim for 20-30 components:\n'
        '- HEADER: Row with Text (h2) title, Badge showing total open count (error variant), '
        'Dropdown for "Filter by severity" (All/Critical/High/Medium/Low), '
        'TextField for incident search, Button for "Create Incident".\n'
        '- SUMMARY ROW: Row of 4 Cards showing counts: Critical (red Badge), High (orange), '
        'Medium (yellow), Resolved (green). Each Card has an Icon + Text count + Text label.\n'
        '- TABS: Use Tabs with "Active Incidents", "Resolved", "SLA Status" panels.\n'
        '- ACTIVE INCIDENTS TAB: Table with columns: ID, Title, Severity (Badge), '
        'Status (Badge), Service, Assigned (Avatar), Time Open. Show 6-8 rows with '
        'mixed severities. Add Pagination below (showing page 1 of 3).\n'
        '- RESOLVED TAB: Accordion (name="resolved") with one entry per resolved incident, '
        'showing resolution time and notes.\n'
        '- SLA TAB: Progress bars for SLA compliance per service, Meter for breach risk.\n'
        '- FOOTER: Alert for any critical unassigned incidents, Divider, '
        'Row with Switch for "Auto-escalate" toggle and Tooltip-wrapped Badge '
        'showing "SLA at risk" count.'
    ),
    include_schema=True,
)


def instruction(_ctx):
    return _instruction


incidents_agent = LlmAgent(
    model='gemini-3-flash-preview',
    name='incidents_agent',
    description='Generates incident tracking tables with severity badges and status.',
    instruction=instruction,
    generate_content_config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.MEDIUM),
        response_mime_type='application/json',
    ),
)
