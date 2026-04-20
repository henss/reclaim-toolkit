// Managed by llm-orchestrator TypeScript agent-surface standard.
import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

interface ParsedArgs {
  sourcePath?: string;
  targetPath?: string;
  exportNames: string[];
  tsConfigFilePath?: string;
  helpRequested?: true;
}

const USAGE = "Usage: pnpm refactor:extract-exports -- --source <file> --target <file> --exports Foo,bar [--tsconfig <path>]";

interface ExtractableDeclaration {
  exportName: string;
  node: Node;
  typeOnly: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { exportNames: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--help" || value === "-h") { parsed.helpRequested = true; continue; }
    if (value === "--source") {
      parsed.sourcePath = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--target") {
      parsed.targetPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--exports") {
      parsed.exportNames = argv[index + 1].split(",").map((entry) => entry.trim()).filter(Boolean);
      index += 1;
      continue;
    }
    if (value === "--tsconfig") {
      parsed.tsConfigFilePath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function uniqueExportNames(exportNames: string[]): string[] {
  return Array.from(new Set(exportNames.map((value) => value.trim()).filter(Boolean)));
}

function ensureTargetCanBeCreated(targetPath: string): void {
  const directoryPath = path.dirname(targetPath);
  fs.mkdirSync(directoryPath, { recursive: true });
  if (!fs.existsSync(targetPath)) return;
  if (fs.readFileSync(targetPath, "utf8").trim().length > 0) {
    throw new Error(`Target file already exists and is not empty: ${targetPath}`);
  }
}

function normalizeDeclaration(exportName: string, declaration: Node): ExtractableDeclaration {
  if (
    Node.isFunctionDeclaration(declaration) ||
    Node.isClassDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration) ||
    Node.isInterfaceDeclaration(declaration) ||
    Node.isTypeAliasDeclaration(declaration)
  ) {
    return { exportName, node: declaration, typeOnly: Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration) };
  }
  if (Node.isVariableDeclaration(declaration)) {
    const statement = declaration.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    if (!statement) throw new Error(`Could not resolve exported variable statement for ${exportName}.`);
    if (statement.getDeclarations().length > 1) {
      throw new Error(`Export ${exportName} shares a variable statement with other declarations; split it first.`);
    }
    return { exportName, node: statement, typeOnly: false };
  }
  throw new Error(`Export ${exportName} is not a supported direct declaration kind.`);
}

function collectExtractableDeclarations(sourceFile: SourceFile, exportNames: string[]): ExtractableDeclaration[] {
  const exportedDeclarations = sourceFile.getExportedDeclarations();
  const collected = exportNames.map((exportName) => {
    const declarations = exportedDeclarations.get(exportName);
    if (!declarations || declarations.length === 0) {
      throw new Error(`Export not found in ${sourceFile.getFilePath()}: ${exportName}`);
    }
    if (declarations.length > 1) {
      throw new Error(`Export ${exportName} has multiple declarations; extract one declaration at a time.`);
    }
    return normalizeDeclaration(exportName, declarations[0]);
  });
  return collected.sort((left, right) => left.node.getStart() - right.node.getStart());
}

function isNodeWithin(candidate: Node, root: Node): boolean {
  return candidate.getStart() >= root.getStart() && candidate.getEnd() <= root.getEnd();
}

function renderDependency(node: Node): string {
  const nameNode =
    ("getNameNode" in node && typeof node.getNameNode === "function" ? node.getNameNode() : undefined) ??
    ("getName" in node && typeof node.getName === "function" ? node.getName() : undefined);
  const name = typeof nameNode === "string" ? nameNode : nameNode?.getText();
  return name ? `${name} (${node.getKindName()})` : node.getKindName();
}

function isAllowedLocalDependency(node: Node, roots: Node[]): boolean {
  if (roots.some((root) => isNodeWithin(node, root))) return true;
  return (
    Node.isImportSpecifier(node) ||
    Node.isImportClause(node) ||
    Node.isNamespaceImport(node) ||
    Node.isImportEqualsDeclaration(node)
  );
}

function assertSelfContained(sourceFile: SourceFile, declarations: ExtractableDeclaration[]): void {
  const roots = declarations.map((declaration) => declaration.node);
  const unsupportedDependencies = new Set<string>();
  for (const declaration of declarations) {
    for (const identifier of declaration.node.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const definitions = identifier.getDefinitions();
      for (const definition of definitions) {
        const node = definition.getDeclarationNode();
        if (!node || node.getSourceFile() !== sourceFile) continue;
        if (isAllowedLocalDependency(node, roots)) continue;
        unsupportedDependencies.add(renderDependency(node));
      }
    }
  }
  if (unsupportedDependencies.size > 0) {
    throw new Error(`Cannot extract exports with hidden local dependencies: ${Array.from(unsupportedDependencies).sort().join(", ")}`);
  }
}

function collectRequiredImports(declarations: ExtractableDeclaration[]): string[] {
  const imports = new Map<string, string>();
  for (const declaration of declarations) {
    for (const identifier of declaration.node.getDescendantsOfKind(SyntaxKind.Identifier)) {
      for (const definition of identifier.getDefinitions()) {
        const node = definition.getDeclarationNode();
        if (!node) continue;
        const importDeclaration = node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
        if (importDeclaration) imports.set(importDeclaration.getText(), importDeclaration.getText());
      }
    }
  }
  return Array.from(imports.values());
}

function writeTargetFile(targetFile: SourceFile, requiredImports: string[], declarations: ExtractableDeclaration[]): void {
  const statements = [...requiredImports];
  if (requiredImports.length > 0 && declarations.length > 0) statements.push("");
  statements.push(...declarations.map((declaration) => declaration.node.getFullText().trim()));
  targetFile.addStatements(statements);
}

function getRelativeModuleSpecifier(fromPath: string, toPath: string): string {
  const relativePath = path.relative(path.dirname(fromPath), toPath).split(path.sep).join("/");
  const withoutExtension = relativePath.replace(/\.[^.]+$/, ".js");
  return withoutExtension.startsWith(".") ? withoutExtension : `./${withoutExtension}`;
}

function addReExports(sourceFile: SourceFile, declarations: ExtractableDeclaration[], moduleSpecifier: string): void {
  const valueExports = declarations.filter((declaration) => !declaration.typeOnly).map((declaration) => declaration.exportName);
  const typeExports = declarations.filter((declaration) => declaration.typeOnly).map((declaration) => declaration.exportName);
  if (valueExports.length > 0) {
    sourceFile.addExportDeclaration({ moduleSpecifier, namedExports: valueExports });
  }
  if (typeExports.length > 0) {
    sourceFile.addExportDeclaration({ isTypeOnly: true, moduleSpecifier, namedExports: typeExports });
  }
}

function removeOriginalDeclarations(declarations: ExtractableDeclaration[]): void {
  for (const declaration of [...declarations].reverse()) {
    declaration.node.replaceWithText("");
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.helpRequested) { console.log(USAGE); return; }
  if (!args.sourcePath || !args.targetPath || args.exportNames.length === 0) {
    throw new Error(USAGE);
  }

  const sourcePath = path.resolve(args.sourcePath);
  const targetPath = path.resolve(args.targetPath);
  const exportNames = uniqueExportNames(args.exportNames);
  const project = new Project({
    tsConfigFilePath: args.tsConfigFilePath ? path.resolve(args.tsConfigFilePath) : path.resolve(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: false
  });
  const sourceFile = project.getSourceFile(sourcePath) ?? project.addSourceFileAtPath(sourcePath);
  ensureTargetCanBeCreated(targetPath);
  const targetFile = project.createSourceFile(targetPath, "", { overwrite: false });
  const declarations = collectExtractableDeclarations(sourceFile, exportNames);
  assertSelfContained(sourceFile, declarations);
  const requiredImports = collectRequiredImports(declarations);
  writeTargetFile(targetFile, requiredImports, declarations);
  removeOriginalDeclarations(declarations);
  const moduleSpecifier = getRelativeModuleSpecifier(sourcePath, targetPath);
  addReExports(sourceFile, declarations, moduleSpecifier);
  sourceFile.organizeImports();
  targetFile.organizeImports();
  project.saveSync();

  console.log("Extracted exports into a new module.");
  console.log(`- source: ${sourcePath}`);
  console.log(`- target: ${targetPath}`);
  console.log(`- exports: ${exportNames.join(", ")}`);
  console.log(`- source re-export: ${moduleSpecifier}`);
}

main();
