import { DebateCommand, GitHubResearchBrief, GitHubResearchReference } from "./types";

interface GitHubSearchItem {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  updated_at: string;
  archived: boolean;
  topics?: string[];
}

interface GitHubSearchResponse {
  items?: GitHubSearchItem[];
}

interface ResearchInput {
  topic: string;
  command?: DebateCommand;
  techSpec?: string;
  limit?: number;
}

const GITHUB_API = "https://api.github.com";

export async function researchGitHubReferences(input: ResearchInput): Promise<GitHubResearchBrief> {
  const limit = Math.min(Math.max(input.limit || 4, 1), 5);
  const query = buildSearchQuery(input);

  try {
    const headers = githubHeaders();
    const searchUrl = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;
    const res = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return emptyBrief(query, [`GitHub search failed with HTTP ${res.status}.`]);
    }

    const data = await res.json() as GitHubSearchResponse;
    const items = (data.items || []).slice(0, limit);
    const references = await Promise.all(items.map((item) => buildReference(item, headers)));
    const patterns = unique(references.flatMap((ref) => ref.patterns)).slice(0, 8);
    const cautions = unique(references.flatMap((ref) => ref.cautions)).slice(0, 6);

    return {
      query,
      generatedAt: new Date().toISOString(),
      summary: references.length > 0
        ? `${references.length} GitHub repositories were reviewed for reusable workflow and product-planning patterns.`
        : "No useful GitHub repositories were found for this query.",
      references,
      patterns,
      cautions,
    };
  } catch (error: any) {
    return emptyBrief(query, [`GitHub research skipped: ${error?.message || "unknown error"}.`]);
  }
}

function buildSearchQuery(input: ResearchInput): string {
  const source = `${input.topic}\n${input.techSpec || ""}`;
  const keywords = extractKeywords(source).slice(0, 4);
  const generic = (() => {
    switch (input.command) {
      case "consult":
      case "extend":
      case "fix":
        return ["developer", "agent", "codebase"];
      case "academy":
        return ["education", "management", "open-source"];
      default:
        return ["PRD", "requirements", "agent"];
    }
  })();

  // GitHub 검색은 공백을 AND로 처리하므로 항이 많을수록 결과가 0건이 되기 쉽다.
  // 추출 키워드를 우선하고, 키워드가 2개 미만일 때만 제네릭으로 보충해 최대 4개로 제한한다.
  const base = keywords.length >= 2 ? keywords : unique([...keywords, ...generic]);
  return base.slice(0, 4).join(" ");
}

function extractKeywords(text: string): string[] {
  const stop = new Set([
    "the", "and", "for", "with", "from", "this", "that", "about",
    "프로젝트", "기능", "개발", "계획", "서비스", "사용자", "만들", "관련",
  ]);
  return (text.match(/[A-Za-z][A-Za-z0-9_.-]{2,}|[가-힣]{2,}/g) || [])
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !stop.has(word.toLowerCase()));
}

async function buildReference(item: GitHubSearchItem, headers: Record<string, string>): Promise<GitHubResearchReference> {
  const readme = await fetchReadme(item.full_name, headers);
  const corpus = `${item.description || ""}\n${(item.topics || []).join(" ")}\n${readme}`.toLowerCase();
  const patterns = detectPatterns(corpus);
  const cautions = detectCautions(item, corpus);

  return {
    repository: item.full_name,
    url: item.html_url,
    description: item.description || "",
    stars: item.stargazers_count,
    language: item.language,
    lastUpdated: item.updated_at,
    archived: item.archived,
    patterns,
    cautions,
  };
}

async function fetchReadme(repo: string, headers: Record<string, string>): Promise<string> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/readme`, {
      headers: {
        ...headers,
        Accept: "application/vnd.github.raw",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 6000);
  } catch {
    return "";
  }
}

function detectPatterns(corpus: string): string[] {
  const patterns: string[] = [];
  if (hasAny(corpus, ["multi-agent", "multi agent", "roles", "product manager", "architect"])) {
    patterns.push("Use role-based SOPs: separate product, architecture, planning, implementation, and review responsibilities.");
  }
  if (hasAny(corpus, ["requirement", "requirements", "prd", "user stories", "specification"])) {
    patterns.push("Convert the initial idea into structured requirements before generating implementation tasks.");
  }
  if (hasAny(corpus, ["workflow", "automation", "webhook", "schedule", "trigger"])) {
    patterns.push("Represent repeated work as reusable workflows that can be rerun or triggered automatically.");
  }
  if (hasAny(corpus, ["github", "linear", "slack", "notion", "issue", "pull request"])) {
    patterns.push("Integrate planning output with existing collaboration tools such as GitHub issues or PRs.");
  }
  if (hasAny(corpus, ["docker", "self-host", "self host", "local", "sandbox"])) {
    patterns.push("Prefer local or sandboxed execution paths for safer agent experimentation.");
  }
  if (hasAny(corpus, ["benchmark", "evaluation", "eval", "test", "lint"])) {
    patterns.push("Add evaluator and test checkpoints so generated plans can be scored and repaired.");
  }
  if (hasAny(corpus, ["existing code", "improve existing", "codebase", "repository"])) {
    patterns.push("Support both new-project generation and existing-code improvement paths.");
  }

  return patterns.length > 0 ? patterns : ["Use the repository as a reference, but validate fit before adopting its workflow."];
}

function detectCautions(item: GitHubSearchItem, corpus: string): string[] {
  const cautions: string[] = [];
  if (item.archived) cautions.push(`${item.full_name} is archived, so use it as a pattern reference only.`);
  if (item.stargazers_count < 100) cautions.push(`${item.full_name} has limited adoption signals.`);
  if (hasAny(corpus, ["warning", "full access", "api key", "security", "sandbox"])) {
    cautions.push("Check security boundaries before copying agent execution patterns.");
  }
  if (hasAny(corpus, ["cloud", "hosted", "waitlist", "commercial"])) {
    cautions.push("Separate open-source functionality from hosted or commercial-only features.");
  }
  return cautions;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-debate-platform",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function emptyBrief(query: string, cautions: string[]): GitHubResearchBrief {
  return {
    query,
    generatedAt: new Date().toISOString(),
    summary: "GitHub research could not produce usable repository references.",
    references: [],
    patterns: [],
    cautions,
  };
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}
