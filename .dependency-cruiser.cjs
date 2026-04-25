/* global module, process */
const path = module["require"]("node:path");

module.exports = {
  extends: path.join(process.cwd(), "node_modules/dependency-cruiser/configs/recommended-strict.cjs"),
  forbidden: [
    {
      name: "src-must-not-import-runnable-surfaces",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: "\\.test\\.tsx?$"
      },
      to: { path: "^(scripts|evals|tests?)/" }
    },
    {
      name: "apps-must-not-import-development-surfaces",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^(scripts|evals|tests?)/" }
    },
    {
      name: "packages-must-not-import-runnable-surfaces",
      severity: "error",
      from: {
        path: "^packages/",
        pathNot: "\\.test\\.tsx?$"
      },
      to: { path: "^(apps|scripts|evals|tests?)/" }
    }
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: [
        "npm",
        "npm-dev",
        "npm-optional",
        "npm-peer",
        "npm-bundled",
        "npm-no-pkg"
      ]
    },
    tsConfig: { fileName: "tsconfig.json" },
    reporterOptions: { dot: { collapsePattern: "node_modules/[^/]+" } }
  }
};
