import fs from "node:fs";
import path from "node:path";

const RECLAIM_OPENAPI_URL = "https://api.app.reclaim.ai/swagger/reclaim-api-0.1.yml";
const GENERATED_ROOT = path.resolve("generated", "reclaim-openapi");
const RAW_SPEC_PATH = path.join(GENERATED_ROOT, "reclaim-api-0.1.raw.yml");
const SANITIZED_SPEC_PATH = path.join(GENERATED_ROOT, "reclaim-api-0.1.sanitized.yml");
const REPORT_PATH = path.join(GENERATED_ROOT, "sanitize-report.json");

const COMPONENT_REF_PATTERN = /\$ref:\s*["']?#\/components\/schemas\/([^"'\s]+)["']?/g;
const COMPONENTS_START = "\ncomponents:\n";
const SCHEMAS_START = "\n  schemas:\n";

export interface ReclaimOpenApiSanitizeResult {
  missingSchemas: string[];
  sanitized: string;
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function getSchemasBlock(spec: string): string {
  const componentsIndex = spec.indexOf(COMPONENTS_START);
  const schemasIndex = spec.indexOf(SCHEMAS_START, componentsIndex);
  if (componentsIndex < 0 || schemasIndex < 0) {
    throw new Error("Could not find components.schemas in the published Reclaim OpenAPI spec.");
  }

  const afterSchemas = spec.slice(schemasIndex + SCHEMAS_START.length);
  const nextComponentsKey = afterSchemas.search(/\n {2}[A-Za-z0-9_-]+:\n/);
  return nextComponentsKey >= 0 ? afterSchemas.slice(0, nextComponentsKey + 1) : afterSchemas;
}

function findMissingSchemas(spec: string): string[] {
  const referenced = unique(
    Array.from(spec.matchAll(COMPONENT_REF_PATTERN), (match) => match[1] ?? ""),
  );
  const defined = unique(
    Array.from(
      getSchemasBlock(spec).matchAll(/^ {4}([^:\r\n]+):\s*(?:#.*)?$/gm),
      (match) => match[1] ?? "",
    ),
  );
  const definedSet = new Set(defined);
  return referenced.filter((name) => !definedSet.has(name));
}

function buildPlaceholderSchemas(missingSchemas: string[]): string {
  if (missingSchemas.length === 0) {
    return "";
  }

  return [
    "    # Placeholder schemas injected locally because the published Reclaim OpenAPI",
    "    # document references these names without defining them. This keeps client",
    "    # generation usable for the documented task, habit, meeting, timescheme, and",
    "    # current-user paths while upstream analytics refs remain broken.",
    ...missingSchemas.flatMap((schemaName) => [
      `    ${schemaName}:`,
      `      description: Placeholder injected by reclaim-toolkit because ${schemaName} is referenced but not defined in the published Reclaim OpenAPI document.`,
      "      type: object",
      "      additionalProperties: true",
    ]),
    "",
  ].join("\n");
}

export function sanitizeReclaimOpenApiSpec(spec: string): ReclaimOpenApiSanitizeResult {
  const missingSchemas = findMissingSchemas(spec);
  if (missingSchemas.length === 0) {
    return { missingSchemas, sanitized: spec };
  }

  const placeholderSchemas = buildPlaceholderSchemas(missingSchemas);
  const sanitized = spec.replace(SCHEMAS_START, `${SCHEMAS_START}${placeholderSchemas}`);
  return { missingSchemas, sanitized };
}

async function fetchOpenApiSpec(): Promise<string> {
  const response = await fetch(RECLAIM_OPENAPI_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Reclaim OpenAPI spec: ${response.status} ${response.statusText}`,
    );
  }

  return response.text();
}

async function main(): Promise<void> {
  const rawSpec = await fetchOpenApiSpec();
  const result = sanitizeReclaimOpenApiSpec(rawSpec);

  fs.mkdirSync(GENERATED_ROOT, { recursive: true });
  fs.writeFileSync(RAW_SPEC_PATH, rawSpec, "utf8");
  fs.writeFileSync(SANITIZED_SPEC_PATH, result.sanitized, "utf8");
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        fetchedFrom: RECLAIM_OPENAPI_URL,
        rawSpecPath: RAW_SPEC_PATH,
        sanitizedSpecPath: SANITIZED_SPEC_PATH,
        missingSchemaCount: result.missingSchemas.length,
        missingSchemas: result.missingSchemas,
      },
      null,
      2,
    ),
    "utf8",
  );

  process.stdout.write(
    JSON.stringify(
      {
        fetchedFrom: RECLAIM_OPENAPI_URL,
        rawSpecPath: RAW_SPEC_PATH,
        sanitizedSpecPath: SANITIZED_SPEC_PATH,
        missingSchemaCount: result.missingSchemas.length,
        missingSchemas: result.missingSchemas,
        nextStep:
          "Run `npm run reclaim:openapi:generate` to generate TypeScript OpenAPI paths from the sanitized spec for use with openapi-fetch or another thin repo-owned client wrapper.",
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
