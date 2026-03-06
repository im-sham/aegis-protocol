#!/usr/bin/env python3
"""
AEGIS Protocol — CrewAI Agent Example (via MCP)

This example wires the published AEGIS MCP server into a CrewAI agent.

Read-only mode (no signing):
  OPENAI_API_KEY=... python3 crewai-agent.py "Check job 0x... status"

Read-write mode (enables escrow writes):
  OPENAI_API_KEY=... AEGIS_PRIVATE_KEY=0x... python3 crewai-agent.py \
    "Approve 5 USDC for escrow and create a job between agent 1 and 2."
"""

from __future__ import annotations

import os
import sys
from typing import Any

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

DEFAULT_PROMPT = (
    "Run an AEGIS preflight on Base Sepolia: "
    "1) check balance for my signer (or ask for address if read-only), "
    "2) lookup agent 1 reputation, "
    "3) summarize whether it is safe to create a new escrow job right now."
)


def get_prompt_from_args() -> str:
    prompt = " ".join(sys.argv[1:]).strip()
    if prompt:
        return prompt
    return DEFAULT_PROMPT


def load_crewai() -> tuple[Any, Any, Any, Any, Any]:
    try:
        from crewai import Agent, Crew, Process, Task
        from crewai.mcp import MCPServerStdio
    except ImportError as exc:
        raise RuntimeError(
            "CrewAI MCP dependencies are missing. Install with: pip install crewai mcp"
        ) from exc
    return Agent, Crew, Process, Task, MCPServerStdio


def build_mcp_env() -> dict[str, str]:
    env = {"AEGIS_CHAIN": os.getenv("AEGIS_CHAIN", "base-sepolia")}

    passthrough = [
        "AEGIS_RPC_URL",
        "AEGIS_RPC_URLS",
        "BASE_SEPOLIA_RPC_URL_PRIMARY",
        "BASE_SEPOLIA_RPC_URL_SECONDARY",
        "AEGIS_API_URL",
        "AEGIS_PRIVATE_KEY",
    ]

    for key in passthrough:
        value = os.getenv(key)
        if value:
            env[key] = value

    return env


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required.")

    Agent, Crew, Process, Task, MCPServerStdio = load_crewai()
    prompt = get_prompt_from_args()
    write_enabled = bool(os.getenv("AEGIS_PRIVATE_KEY"))

    aegis_mcp = MCPServerStdio(
        command="npx",
        args=["-y", "@aegis-protocol/mcp-server"],
        env=build_mcp_env(),
        cache_tools_list=True,
    )

    agent = Agent(
        role="AEGIS Escrow Operator",
        goal=(
            "Use AEGIS escrow tools to safely evaluate and execute "
            "agent-to-agent transactions."
        ),
        backstory=(
            "You are an operations-focused escrow specialist that uses "
            "on-chain evidence to protect agent transactions."
        ),
        llm=OPENAI_MODEL,
        mcps=[aegis_mcp],
        verbose=True,
        allow_delegation=False,
    )

    task = Task(
        description=(
            f"{prompt}\n\n"
            "Always prefer AEGIS tools over assumptions. "
            "If write tools are unavailable, explain what inputs are needed."
        ),
        expected_output=(
            "A concise action summary with tool outputs, current risk posture, "
            "and recommended next step."
        ),
        agent=agent,
    )

    crew = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )

    print(f"Mode: {'read-write' if write_enabled else 'read-only'}")
    print(f"Prompt: {prompt}\n")

    result = crew.kickoff()
    print("Agent response:\n")
    print(result)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"CrewAI example failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
