"""LangGraph orchestration — ties agents into focused learning pipelines."""

from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from app.agents.essay_agent import run_essay_evaluation
from app.agents.grammar_agent import run_grammar
from app.agents.planner_agent import run_planner
from app.agents.practice_agent import run_practice
from app.agents.progress_agent import run_progress_update
from app.agents.recommendation_agent import run_recommendations


class AgentState(TypedDict, total=False):
    profile: dict[str, Any]
    essay_text: str
    session: Any
    grammar_result: dict[str, Any]
    essay_result: dict[str, Any]
    mistakes: list[dict[str, Any]]
    progress_previous: dict[str, Any]
    progress_result: dict[str, Any]
    practice_result: dict[str, Any]
    practice_focus: str | None
    catalog: list[dict[str, Any]]
    history: dict[str, Any]
    recommendations: dict[str, Any]
    roadmap: dict[str, Any]
    mode: str


async def node_planner(state: AgentState) -> AgentState:
    roadmap = await run_planner(state.get("profile") or {})
    return {**state, "roadmap": roadmap}


async def node_grammar(state: AgentState) -> AgentState:
    result = await run_grammar(
        state["session"],
        state.get("essay_text") or "",
        state.get("profile"),
    )
    return {**state, "grammar_result": result}


async def node_essay(state: AgentState) -> AgentState:
    grammar = state.get("grammar_result") or {}
    summary = grammar.get("corrected_version") or ""
    result = await run_essay_evaluation(
        state.get("essay_text") or "",
        summary,
        state.get("profile"),
    )
    return {**state, "essay_result": result}


async def node_progress(state: AgentState) -> AgentState:
    activity = {
        "grammar": state.get("grammar_result"),
        "essay": state.get("essay_result"),
        "practice": state.get("practice_result"),
    }
    result = await run_progress_update(
        activity,
        state.get("progress_previous") or {},
        state.get("profile"),
    )
    return {**state, "progress_result": result}


async def node_practice(state: AgentState) -> AgentState:
    result = await run_practice(
        state.get("mistakes") or [],
        state.get("progress_previous") or state.get("progress_result") or {},
        state.get("practice_focus"),
        state.get("profile"),
    )
    return {**state, "practice_result": result}


async def node_recommend(state: AgentState) -> AgentState:
    history = dict(state.get("history") or {})
    if state.get("profile") and "profile" not in history:
        history["profile"] = state["profile"]
    result = await run_recommendations(history, state.get("catalog") or [])
    return {**state, "recommendations": result}


def build_workflow():
    """Full documentation graph (planner → essay loop → recommend → practice)."""
    graph = StateGraph(AgentState)
    graph.add_node("planner", node_planner)
    graph.add_node("grammar", node_grammar)
    graph.add_node("essay", node_essay)
    graph.add_node("progress", node_progress)
    graph.add_node("practice", node_practice)
    graph.add_node("recommend", node_recommend)

    graph.set_entry_point("planner")
    graph.add_edge("planner", "grammar")
    graph.add_edge("grammar", "essay")
    graph.add_edge("essay", "progress")
    graph.add_edge("progress", "recommend")
    graph.add_edge("recommend", "practice")
    graph.add_edge("practice", END)
    return graph.compile()


_workflow = None


def get_workflow():
    global _workflow
    if _workflow is None:
        _workflow = build_workflow()
    return _workflow


async def run_essay_pipeline(
    session,
    essay_text: str,
    progress_previous: dict,
    profile: dict[str, Any] | None = None,
    *,
    run_grammar_step: bool = True,
) -> AgentState:
    """Grammar → Essay → Progress path for a submitted essay."""
    state: AgentState = {
        "session": session,
        "essay_text": essay_text,
        "progress_previous": progress_previous,
        "profile": profile or {},
    }
    if run_grammar_step:
        state = await node_grammar(state)
    else:
        state = {**state, "grammar_result": {}}
    state = await node_essay(state)
    state = await node_progress(state)
    return state
