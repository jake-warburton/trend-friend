import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAiUseCaseTrend,
  deriveAiUseCaseIntelligence,
} from "@/lib/ai-use-cases";
import type { TrendExplorerRecord } from "@/lib/types";

function makeTrend(
  overrides: Partial<TrendExplorerRecord>,
): TrendExplorerRecord {
  return {
    id: "trend",
    name: "Trend",
    category: "general-tech",
    metaTrend: "General",
    stage: "validated",
    confidence: 0.8,
    summary: "",
    status: "steady",
    volatility: "stable",
    rank: 1,
    previousRank: null,
    rankChange: null,
    firstSeenAt: null,
    latestSignalAt: "2026-03-25T12:00:00Z",
    score: {
      total: 100,
      social: 20,
      developer: 20,
      knowledge: 20,
      search: 20,
      advertising: 10,
      diversity: 10,
    },
    momentum: {
      previousRank: null,
      rankChange: null,
      absoluteDelta: null,
      percentDelta: null,
    },
    coverage: {
      sourceCount: 3,
      signalCount: 9,
    },
    sources: ["github", "reddit", "news"],
    evidencePreview: [],
    audienceSummary: [],
    primaryEvidence: null,
    recentHistory: [],
    seasonality: null,
    forecastDirection: null,
    breaking: null,
    ...overrides,
  };
}

test("classifyAiUseCaseTrend ignores generic non-AI trends", () => {
  const trend = makeTrend({
    id: "remote-payroll",
    name: "Remote Payroll",
    category: "future-of-work",
    summary: "Cross-border payroll tooling for remote teams.",
  });

  assert.equal(classifyAiUseCaseTrend(trend), null);
});

test("classifyAiUseCaseTrend does not treat plain substring matches like paid as AI", () => {
  const trend = makeTrend({
    id: "paid-marketing",
    name: "Paid Marketing",
    summary: "How many founders resort to paid marketing for their B2C business?",
    evidencePreview: ["How many of you resort to paid marketing for their B2C business?"],
  });

  assert.equal(classifyAiUseCaseTrend(trend), null);
});

test("classifyAiUseCaseTrend maps agent signals into agent workflows", () => {
  const trend = makeTrend({
    id: "ai-agents",
    name: "AI Agents",
    category: "ai-machine-learning",
    evidencePreview: [
      "PaperPod: On-demand sandboxes for AI Agents",
      "Interesting MCP orchestration pattern for agent memory",
    ],
  });

  const result = classifyAiUseCaseTrend(trend);
  assert.ok(result);
  assert.equal(result.useCaseId, "agent-workflows");
});

test("classifyAiUseCaseTrend captures named tools and coding workflows", () => {
  const trend = makeTrend({
    id: "claude-coding",
    name: "Claude Coding",
    category: "ai-machine-learning",
    evidencePreview: [
      "We analyzed Claude and Cursor coding sessions for backend workflows",
    ],
  });

  const result = classifyAiUseCaseTrend(trend);
  assert.ok(result);
  assert.equal(result.useCaseId, "coding-development");
  assert.deepEqual(result.toolMentions, ["Claude", "Cursor"]);
});

test("deriveAiUseCaseIntelligence groups trends into sorted clusters and tool signals", () => {
  const intelligence = deriveAiUseCaseIntelligence([
    makeTrend({
      id: "ai-agents",
      name: "AI Agents",
      category: "ai-machine-learning",
      rank: 2,
      score: { total: 180, social: 40, developer: 50, knowledge: 20, search: 20, advertising: 20, diversity: 30 },
      status: "breakout",
      evidencePreview: ["Anthropic and OpenAI developers are building new agent workflows with MCP"],
    }),
    makeTrend({
      id: "cad-models",
      name: "CAD Models",
      category: "ai-machine-learning",
      rank: 5,
      score: { total: 120, social: 15, developer: 20, knowledge: 20, search: 25, advertising: 10, diversity: 30 },
      evidencePreview: ["Whisker: Create and edit CAD models into production-ready prototypes"],
    }),
    makeTrend({
      id: "claude-coding",
      name: "Claude Coding",
      category: "ai-machine-learning",
      rank: 3,
      score: { total: 150, social: 20, developer: 60, knowledge: 20, search: 20, advertising: 10, diversity: 20 },
      evidencePreview: ["Cursor and Claude are being used for backend coding and API work"],
    }),
  ]);

  assert.equal(intelligence.trends.length, 3);
  assert.equal(intelligence.clusters[0]?.label, "Agent Workflows");
  assert.equal(intelligence.toolSignals[0]?.tool, "Claude");
  assert.equal(intelligence.evidenceHighlights.length, 3);
});
