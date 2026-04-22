import fs from "node:fs";

const RECLAIM_PUBLISHED_OPENAPI_URL = "https://api.app.reclaim.ai/swagger/reclaim-api-0.1.yml";

const PATH_LINE_PATTERN = /^ {2}["']?(\/[^:"']+)["']?:\s*$/;
const METHOD_LINE_PATTERN = /^ {4}(get|post|put|patch|delete|options|head):\s*$/i;

type CapabilityScope = "current_surface" | "future_bet";
type ToolkitStatus = "implemented" | "preview_only" | "read_only" | "not_started";
type OpenApiSupport = "documented" | "partial" | "not_documented";
type RiskLevel = "low" | "medium" | "high";

interface CapabilityDefinition {
  id: string;
  label: string;
  scope: CapabilityScope;
  toolkitStatus: ToolkitStatus;
  pathPrefixes: string[];
  requiredMethods: string[];
  documentedRecommendation: string;
  partialRecommendation: string;
  missingRecommendation: string;
}

interface OpenApiOperation {
  method: string;
  path: string;
}

export interface ReclaimApiCapabilityMatrixRow {
  id: string;
  label: string;
  scope: CapabilityScope;
  toolkitStatus: ToolkitStatus;
  openApiSupport: OpenApiSupport;
  riskLevel: RiskLevel;
  matchedOperations: string[];
  missingRequiredMethods: string[];
  recommendation: string;
}

export interface ReclaimApiCapabilityMatrix {
  matrix: "reclaim-openapi-capability-matrix";
  readSafety: "public_metadata";
  source: {
    type: "published_openapi" | "file";
    location: string;
  };
  summary: {
    capabilityCount: number;
    documentedCount: number;
    partialCount: number;
    notDocumentedCount: number;
    recommendedNextBet?: string;
  };
  capabilities: ReclaimApiCapabilityMatrixRow[];
}

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    id: "tasks-crud",
    label: "Tasks CRUD baseline",
    scope: "current_surface",
    toolkitStatus: "implemented",
    pathPrefixes: ["/api/tasks"],
    requiredMethods: ["GET", "POST", "PATCH", "DELETE"],
    documentedRecommendation:
      "Matches the shipped task read/write surface and confirms the current public baseline is grounded in the published API document.",
    partialRecommendation:
      "Task support in the published API document is incomplete relative to the shipped toolkit surface; avoid widening the public promise until the missing methods are confirmed.",
    missingRecommendation:
      "The published API document does not show the shipped task baseline; stop before expanding task commitments from this matrix alone."
  },
  {
    id: "habit-live-write",
    label: "Habit live-write candidate",
    scope: "future_bet",
    toolkitStatus: "preview_only",
    pathPrefixes: ["/api/smart-habits", "/api/assist/habits"],
    requiredMethods: ["POST"],
    documentedRecommendation:
      "Best next public write bet: the toolkit already has preview-only habit shaping and the published API document names habit endpoints.",
    partialRecommendation:
      "Habit endpoints appear in the published API document, but the operation coverage is thin enough that write scope should stay narrow and adapter-led.",
    missingRecommendation:
      "Keep habits preview-only until the published API document exposes a concrete habit write path."
  },
  {
    id: "focus-and-buffers-live-write",
    label: "Focus and Buffer live-write candidate",
    scope: "future_bet",
    toolkitStatus: "preview_only",
    pathPrefixes: ["/api/focus", "/api/buffers", "/api/buffer"],
    requiredMethods: ["POST"],
    documentedRecommendation:
      "A documented write path exists, so a thin adapter proof may be reasonable if the preview-only helpers still map cleanly onto the API payloads.",
    partialRecommendation:
      "Some Focus or Buffer signals exist, but the published API document is not complete enough to support a confident public write promise yet.",
    missingRecommendation:
      "Current Focus and Buffer helpers should remain local preview-only because the published API document does not show a stable write surface."
  },
  {
    id: "meeting-writes",
    label: "Meeting write candidate",
    scope: "future_bet",
    toolkitStatus: "read_only",
    pathPrefixes: ["/api/meetings"],
    requiredMethods: ["POST", "PATCH", "DELETE"],
    documentedRecommendation:
      "The published API document shows meeting write coverage, so a bounded write proof could be scoped behind the existing read-only inspector.",
    partialRecommendation:
      "The published API document shows meeting reads but not a full write lifecycle; treat meeting writes as a higher-risk bet pending stronger contract evidence.",
    missingRecommendation:
      "Keep meetings in read-only mode because the published API document does not show meeting write operations."
  },
  {
    id: "hours-write-and-config",
    label: "Hours write and configuration helpers",
    scope: "future_bet",
    toolkitStatus: "read_only",
    pathPrefixes: ["/api/timeschemes"],
    requiredMethods: ["POST", "PATCH", "DELETE"],
    documentedRecommendation:
      "The published API document shows write-capable time-scheme operations, so the existing inspector could support a bounded configuration helper proof.",
    partialRecommendation:
      "The published API document shows read-only time-scheme coverage; hour configuration remains a medium-risk bet until a write contract is visible.",
    missingRecommendation:
      "Keep time-scheme work read-only because the published API document does not show write operations."
  },
  {
    id: "higher-level-task-helpers",
    label: "Higher-level task search and completion helpers",
    scope: "future_bet",
    toolkitStatus: "not_started",
    pathPrefixes: ["/api/tasks"],
    requiredMethods: ["GET", "PATCH"],
    documentedRecommendation:
      "Underlying task endpoints exist, but these helpers are still repo-owned abstractions; keep any future public scope framed as a thin adapter over documented task operations.",
    partialRecommendation:
      "Some task operations exist, but helper claims should stay narrow because the published API document does not show a distinct search or completion contract.",
    missingRecommendation:
      "Do not treat higher-level task helpers as an API-backed bet until the published task contract is clearer."
  }
];

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function extractOpenApiOperations(spec: string): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];
  let currentPath: string | undefined;

  for (const line of spec.split(/\r?\n/)) {
    const pathMatch = line.match(PATH_LINE_PATTERN);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = currentPath ? line.match(METHOD_LINE_PATTERN) : undefined;
    if (methodMatch && currentPath) {
      operations.push({
        method: methodMatch[1]!.toUpperCase(),
        path: currentPath
      });
    }
  }

  if (operations.length === 0) {
    throw new Error("Could not find any OpenAPI path operations in the provided spec.");
  }

  return operations;
}

function matchesCapability(operation: OpenApiOperation, definition: CapabilityDefinition): boolean {
  return definition.pathPrefixes.some((prefix) => operation.path.startsWith(prefix));
}

function determineOpenApiSupport(
  matchedOperations: OpenApiOperation[],
  requiredMethods: string[]
): Pick<ReclaimApiCapabilityMatrixRow, "openApiSupport" | "missingRequiredMethods" | "riskLevel"> {
  const supportedMethods = new Set(matchedOperations.map((operation) => operation.method));
  const missingRequiredMethods = requiredMethods.filter((method) => !supportedMethods.has(method));

  if (matchedOperations.length === 0) {
    return {
      openApiSupport: "not_documented",
      missingRequiredMethods,
      riskLevel: "high"
    };
  }

  if (missingRequiredMethods.length > 0) {
    return {
      openApiSupport: "partial",
      missingRequiredMethods,
      riskLevel: "medium"
    };
  }

  return {
    openApiSupport: "documented",
    missingRequiredMethods: [],
    riskLevel: "low"
  };
}

function recommendationForSupport(
  definition: CapabilityDefinition,
  openApiSupport: OpenApiSupport
): string {
  switch (openApiSupport) {
    case "documented":
      return definition.documentedRecommendation;
    case "partial":
      return definition.partialRecommendation;
    default:
      return definition.missingRecommendation;
  }
}

function buildCapabilityRows(spec: string): ReclaimApiCapabilityMatrixRow[] {
  const operations = extractOpenApiOperations(spec);

  return CAPABILITY_DEFINITIONS.map((definition) => {
    const matchedOperations = operations.filter((operation) => matchesCapability(operation, definition));
    const support = determineOpenApiSupport(matchedOperations, definition.requiredMethods);

    return {
      id: definition.id,
      label: definition.label,
      scope: definition.scope,
      toolkitStatus: definition.toolkitStatus,
      openApiSupport: support.openApiSupport,
      riskLevel: support.riskLevel,
      matchedOperations: unique(matchedOperations.map((operation) => `${operation.method} ${operation.path}`)),
      missingRequiredMethods: support.missingRequiredMethods,
      recommendation: recommendationForSupport(definition, support.openApiSupport)
    };
  });
}

function recommendNextBet(capabilities: ReclaimApiCapabilityMatrixRow[]): string | undefined {
  return capabilities.find((capability) =>
    capability.scope === "future_bet"
    && capability.toolkitStatus === "preview_only"
    && capability.openApiSupport === "documented"
  )?.id;
}

export function buildReclaimApiCapabilityMatrix(
  spec: string,
  source: ReclaimApiCapabilityMatrix["source"]
): ReclaimApiCapabilityMatrix {
  const capabilities = buildCapabilityRows(spec);

  return {
    matrix: "reclaim-openapi-capability-matrix",
    readSafety: "public_metadata",
    source,
    summary: {
      capabilityCount: capabilities.length,
      documentedCount: capabilities.filter((capability) => capability.openApiSupport === "documented").length,
      partialCount: capabilities.filter((capability) => capability.openApiSupport === "partial").length,
      notDocumentedCount: capabilities.filter((capability) => capability.openApiSupport === "not_documented").length,
      recommendedNextBet: recommendNextBet(capabilities)
    },
    capabilities
  };
}

export async function loadReclaimApiCapabilityMatrix(options?: {
  inputPath?: string;
  fetchImpl?: typeof fetch;
}): Promise<ReclaimApiCapabilityMatrix> {
  if (options?.inputPath) {
    const spec = fs.readFileSync(options.inputPath, "utf8");
    return buildReclaimApiCapabilityMatrix(spec, {
      type: "file",
      location: options.inputPath
    });
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(RECLAIM_PUBLISHED_OPENAPI_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Reclaim OpenAPI spec: ${response.status} ${response.statusText}`);
  }

  return buildReclaimApiCapabilityMatrix(await response.text(), {
    type: "published_openapi",
    location: RECLAIM_PUBLISHED_OPENAPI_URL
  });
}
