# Python SDK Design — Work In Progress (Paused)

> **Status:** Paused in favor of AEGIS MCP Server (Phase 2.5 highest priority).
> **Resume after:** MCP Server ships.
> **Session date:** 2026-02-18

## Decision: Approach C (SDK-first)

After evaluating three approaches, we chose **Approach C: Python SDK-first, framework integrations as thin wrappers.**

Rationale:
- Production-ready (not a demo script in `examples/`)
- Centralizes security (input validation, tx signature verification, error handling)
- Scalable — CrewAI tools, LangChain tools, Eliza plugin import from one package
- The REST API already exists, so the Python SDK is a typed HTTP client over it

## Section 1: Package Structure (Approved)

```
sdk-python/
├── pyproject.toml              # uv/pip, hatch build backend
├── src/
│   └── aegis_protocol/
│       ├── __init__.py         # Public API surface
│       ├── client.py           # AegisClient — main entry point
│       ├── models/
│       │   ├── __init__.py
│       │   ├── jobs.py         # Job, JobState, CreateJobParams
│       │   ├── disputes.py     # Dispute, DisputeMethod
│       │   ├── templates.py    # JobTemplate, CreateTemplateParams
│       │   ├── agents.py       # AgentWallet, ReputationSummary
│       │   ├── treasury.py     # TreasuryBalances
│       │   └── common.py       # Hex, Address, PaginationParams
│       ├── services/
│       │   ├── __init__.py
│       │   ├── jobs.py         # JobService
│       │   ├── disputes.py     # DisputeService
│       │   ├── templates.py    # TemplateService
│       │   ├── agents.py       # AgentService (ERC-8004)
│       │   ├── usdc.py         # UsdcService
│       │   ├── treasury.py     # TreasuryService
│       │   ├── relay.py        # RelayService (tx broadcast)
│       │   └── events.py       # EventStream (SSE)
│       ├── errors.py           # Error hierarchy
│       ├── _http.py            # Internal httpx transport layer
│       └── _sse.py             # Internal SSE stream parser
├── tests/
│   ├── conftest.py             # Shared fixtures, respx mocks
│   ├── test_client.py
│   ├── test_jobs.py
│   ├── test_disputes.py
│   ├── test_relay.py
│   └── test_events.py
└── examples/
    ├── quickstart.py           # Minimal read-only usage
    └── lifecycle.py            # Full job lifecycle
```

Key tech choices:
- `src/` layout (standard modern Python)
- Pydantic v2 for all models
- httpx (async-first HTTP client)
- hatch build backend
- respx for test mocking
- Python 3.11+

## Remaining Design Sections (Not Started)

- Section 2: Pydantic models / type system
- Section 3: Service layer architecture
- Section 4: Error hierarchy and retry strategy
- Section 5: SSE event streaming
- Section 6: Auth, security, and transaction signing
- Section 7: Testing strategy
- Section 8: Packaging, publishing (PyPI), and CI

## Framework Integrations (After SDK)

Target frameworks: CrewAI, LangChain, Eliza (ai16z)
- Each framework integration is a thin wrapper importing the SDK
- Full lifecycle demos (client agent hires provider, work delivered, payment settles)
- Real calls to Base Sepolia (not mocked)
