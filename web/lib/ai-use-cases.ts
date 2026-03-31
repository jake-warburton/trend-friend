import type { TrendExplorerRecord } from "@/lib/types";

export type AiUseCaseClusterId =
  | "agent-workflows"
  | "coding-development"
  | "research-analysis"
  | "content-creative"
  | "business-operations";

export type AiUseCaseCluster = {
  id: AiUseCaseClusterId;
  label: string;
  description: string;
  trendCount: number;
  averageScore: number;
  risingCount: number;
  topTrend: AiUseCaseTrend;
  sampleTools: string[];
};

export type AiUseCaseToolSignal = {
  tool: string;
  mentionCount: number;
  associatedUseCases: string[];
  topTrendIds: string[];
};

export type AiUseCaseEvidenceHighlight = {
  trendId: string;
  trendName: string;
  useCaseLabel: string;
  evidence: string;
};

export type AiUseCaseTrend = {
  id: string;
  name: string;
  category: string;
  metaTrend: string;
  scoreTotal: number;
  rank: number;
  status: string;
  useCaseId: AiUseCaseClusterId;
  useCaseLabel: string;
  toolMentions: string[];
  evidencePreview: string[];
  summary: string;
};

export type AiUseCaseIntelligence = {
  trends: AiUseCaseTrend[];
  clusters: AiUseCaseCluster[];
  toolSignals: AiUseCaseToolSignal[];
  evidenceHighlights: AiUseCaseEvidenceHighlight[];
};

type ClusterRule = {
  id: AiUseCaseClusterId;
  label: string;
  description: string;
  keywords: string[];
};

const AI_RELEVANCE_KEYWORDS = [
  "ai",
  "agent",
  "agentic",
  "llm",
  "language model",
  "gpt",
  "chatgpt",
  "claude",
  "copilot",
  "cursor",
  "perplexity",
  "gemini",
  "anthropic",
  "openai",
  "automation",
  "assistant",
  "assistants",
  "mcp",
];

const CLUSTER_RULES: ClusterRule[] = [
  {
    id: "agent-workflows",
    label: "Agent Workflows",
    description: "Autonomous assistants, orchestration layers, memory, MCP, and tool-using systems.",
    keywords: [
      "agent",
      "agentic",
      "assistant",
      "assistants",
      "autonomous",
      "mcp",
      "function calling",
      "workflow",
      "orchestration",
      "memory",
      "sandbox",
      "tool use",
    ],
  },
  {
    id: "coding-development",
    label: "Coding & Development",
    description: "Software creation, code generation, IDE copilots, backend automation, and developer tooling.",
    keywords: [
      "code",
      "coding",
      "developer",
      "dev",
      "backend",
      "ide",
      "copilot",
      "cursor",
      "repository",
      "github",
      "npm",
      "api",
      "software",
      "build",
      "prototype",
    ],
  },
  {
    id: "research-analysis",
    label: "Research & Analysis",
    description: "Search, synthesis, interpretation, benchmarking, evaluation, and analytical workflows.",
    keywords: [
      "research",
      "analysis",
      "analy",
      "search",
      "study",
      "paper",
      "reasoning",
      "interpret",
      "detect",
      "inference",
      "evaluate",
      "grounding",
      "counting",
    ],
  },
  {
    id: "content-creative",
    label: "Content & Creative",
    description: "Design, media, writing, visuals, art, and creative production workflows.",
    keywords: [
      "design",
      "creative",
      "art",
      "image",
      "video",
      "audio",
      "cad",
      "prototype",
      "style",
      "edit",
      "writing",
      "content",
    ],
  },
  {
    id: "business-operations",
    label: "Business Operations",
    description: "Commercial, support, marketing, productivity, and go-to-market AI applications.",
    keywords: [
      "b2b",
      "customer",
      "support",
      "sales",
      "marketing",
      "payments",
      "commerce",
      "store",
      "operations",
      "productivity",
    ],
  },
];

const TOOL_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: "ChatGPT", keywords: ["chatgpt"] },
  { label: "Claude", keywords: ["claude"] },
  { label: "Cursor", keywords: ["cursor"] },
  { label: "Copilot", keywords: ["copilot"] },
  { label: "Perplexity", keywords: ["perplexity"] },
  { label: "Gemini", keywords: ["gemini"] },
  { label: "Manus", keywords: ["manus"] },
  { label: "OpenAI", keywords: ["openai", "gpt"] },
  { label: "Anthropic", keywords: ["anthropic"] },
];

const MAX_TRENDS = 18;
const MAX_TOOL_SIGNALS = 8;
const MAX_EVIDENCE_HIGHLIGHTS = 8;

export function deriveAiUseCaseIntelligence(
  trends: TrendExplorerRecord[],
): AiUseCaseIntelligence {
  const useCaseTrends = trends
    .map(classifyAiUseCaseTrend)
    .filter((trend): trend is AiUseCaseTrend => trend !== null)
    .sort((left, right) => {
      if (left.scoreTotal !== right.scoreTotal) {
        return right.scoreTotal - left.scoreTotal;
      }
      return left.rank - right.rank;
    })
    .slice(0, MAX_TRENDS);

  return {
    trends: useCaseTrends,
    clusters: buildClusters(useCaseTrends),
    toolSignals: buildToolSignals(useCaseTrends),
    evidenceHighlights: buildEvidenceHighlights(useCaseTrends),
  };
}

export function classifyAiUseCaseTrend(
  trend: TrendExplorerRecord,
): AiUseCaseTrend | null {
  const identityHaystack = buildTrendIdentityHaystack(trend);
  const haystack = buildTrendHaystack(trend);
  const isAiRelated =
    trend.category === "ai-machine-learning" ||
    AI_RELEVANCE_KEYWORDS.some((keyword) => containsKeyword(identityHaystack, keyword));

  if (!isAiRelated) {
    return null;
  }

  const bestCluster = pickBestCluster(haystack);
  if (!bestCluster) {
    return null;
  }

  return {
    id: trend.id,
    name: trend.name,
    category: trend.category,
    metaTrend: trend.metaTrend,
    scoreTotal: trend.score.total,
    rank: trend.rank,
    status: trend.status,
    useCaseId: bestCluster.id,
    useCaseLabel: bestCluster.label,
    toolMentions: collectToolMentions(haystack),
    evidencePreview: trend.evidencePreview ?? [],
    summary: trend.summary ?? "",
  };
}

function buildTrendHaystack(trend: TrendExplorerRecord): string {
  return [
    buildTrendIdentityHaystack(trend),
    ...(trend.evidencePreview ?? []),
    ...(trend.audienceSummary ?? []).map((item) => item.label),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildTrendIdentityHaystack(trend: TrendExplorerRecord): string {
  return [
    trend.name,
    trend.category,
    trend.metaTrend,
    trend.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function pickBestCluster(haystack: string): ClusterRule | null {
  let bestCluster: ClusterRule | null = null;
  let bestScore = 0;

  for (const cluster of CLUSTER_RULES) {
    const score = cluster.keywords.reduce(
      (total, keyword) => total + (containsKeyword(haystack, keyword) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestCluster = cluster;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestCluster : null;
}

function collectToolMentions(haystack: string): string[] {
  return TOOL_KEYWORDS.filter((tool) =>
    tool.keywords.some((keyword) => containsKeyword(haystack, keyword)),
  ).map((tool) => tool.label);
}

function buildClusters(trends: AiUseCaseTrend[]): AiUseCaseCluster[] {
  return CLUSTER_RULES.map((cluster) => {
    const members = trends.filter((trend) => trend.useCaseId === cluster.id);
    if (members.length === 0) {
      return null;
    }

    const averageScore =
      members.reduce((total, trend) => total + trend.scoreTotal, 0) / members.length;
    const risingCount = members.filter((trend) =>
      trend.status === "rising" || trend.status === "breakout",
    ).length;
    const sampleTools = [...new Set(members.flatMap((trend) => trend.toolMentions))].slice(0, 4);

    return {
      id: cluster.id,
      label: cluster.label,
      description: cluster.description,
      trendCount: members.length,
      averageScore: roundToSingleDecimal(averageScore),
      risingCount,
      topTrend: members[0],
      sampleTools,
    };
  })
    .filter((cluster): cluster is AiUseCaseCluster => cluster !== null)
    .sort((left, right) => right.averageScore - left.averageScore);
}

function buildToolSignals(trends: AiUseCaseTrend[]): AiUseCaseToolSignal[] {
  return TOOL_KEYWORDS.map((tool) => {
    const members = trends.filter((trend) => trend.toolMentions.includes(tool.label));
    if (members.length === 0) {
      return null;
    }

    return {
      tool: tool.label,
      mentionCount: members.length,
      associatedUseCases: [...new Set(members.map((trend) => trend.useCaseLabel))].slice(0, 3),
      topTrendIds: members.slice(0, 3).map((trend) => trend.id),
    };
  })
    .filter((signal): signal is AiUseCaseToolSignal => signal !== null)
    .sort((left, right) => right.mentionCount - left.mentionCount)
    .slice(0, MAX_TOOL_SIGNALS);
}

function buildEvidenceHighlights(
  trends: AiUseCaseTrend[],
): AiUseCaseEvidenceHighlight[] {
  const highlights: AiUseCaseEvidenceHighlight[] = [];

  for (const trend of trends) {
    const evidence = trend.evidencePreview[0];
    if (!evidence) {
      continue;
    }

    highlights.push({
      trendId: trend.id,
      trendName: trend.name,
      useCaseLabel: trend.useCaseLabel,
      evidence,
    });

    if (highlights.length >= MAX_EVIDENCE_HIGHLIGHTS) {
      break;
    }
  }

  return highlights;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const escapedKeyword = escapeRegExp(keyword.toLowerCase());
  const pattern = new RegExp(`(^|[^a-z0-9])${escapedKeyword}($|[^a-z0-9])`, "i");
  return pattern.test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
