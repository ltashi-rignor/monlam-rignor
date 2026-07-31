"""LangGraph orchestration — ties agents into the continuous learning loop."""

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
    catalog: list[dict[str, Any]]
    history: dict[str, Any]
    recommendations: dict[str, Any]
    roadmap: dict[str, Any]
    mode: str


async def node_planner(state: AgentState) -> AgentState:
    roadmap = await run_planner(state.get("profile") or {})
    return {**state, "roadmap": roadmap}


async def node_grammar(state: AgentState) -> AgentState:
    result = await run_grammar(state["session"], state.get("essay_text") or "")
    return {**state, "grammar_result": result}


async def node_essay(state: AgentState) -> AgentState:
    grammar = state.get("grammar_result") or {}
    summary = grammar.get("corrected_version") or ""
    result = await run_essay_evaluation(state.get("essay_text") or "", summary)
    return {**state, "essay_result": result}


async def node_progress(state: AgentState) -> AgentState:
    activity = {
        "grammar": state.get("grammar_result"),
        "essay": state.get("essay_result"),
        "practice": state.get("practice_result"),
    }
    result = await run_progress_update(activity, state.get("progress_previous") or {})
    return {**state, "progress_result": result}


async def node_practice(state: AgentState) -> AgentState:
    result = await run_practice(
        state.get("mistakes") or [],
        state.get("progress_previous") or state.get("progress_result") or {},
    )
    return {**state, "practice_result": result}


async def node_recommend(state: AgentState) -> AgentState:
    result = await run_recommendations(
        state.get("history") or {},
        state.get("catalog") or [],
    )
    return {**state, "recommendations": result}


def build_workflow():
    graph = StateGraph(AgentState)
    graph.add_node("planner", node_planner)
    graph.add_node("grammar", node_grammar)
    graph.add_node("essay", node_essay)
    graph.add_node("progress", node_progress)
    graph.add_node("practice", node_practice)
    graph.add_node("recommend", node_recommend)

    graph.set_entry_point("planner")
    # Default continuous loop path used for orchestration documentation;
    # API routes invoke specific subgraphs / nodes as needed.
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


async def run_essay_pipeline(session, essay_text: str, progress_previous: dict) -> AgentState:
    """Grammar → Essay → Progress path for a submitted essay."""
    state: AgentState = {
        "session": session,
        "essay_text": essay_text,
        "progress_previous": progress_previous,
    }
    state = await node_grammar(state)
    state = await node_essay(state)
    state = await node_progress(state)
    return state
