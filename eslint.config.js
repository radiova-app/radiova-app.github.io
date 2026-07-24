// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  jsdoc.configs["flat/recommended-typescript"],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      "dist/",
      "docs/",
      "scripts/",
      "node_modules/",
      ".astro/",
      "astro.config.mjs",
      "eslint.config.js",
      "public/sw.js",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportDefaultDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > ClassDeclaration",
            "ExportDefaultDeclaration > ClassDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            "ExportNamedDeclaration > VariableDeclaration",
          ],
          require: {
            ArrowFunctionExpression: false,
            FunctionExpression: false,
            ClassExpression: false,
            MethodDefinition: false,
          },
        },
      ],
      "jsdoc/require-param": [
        "error",
        {
          exemptedBy: ["internal"],
          checkDestructured: false,
        },
      ],
      "jsdoc/require-returns": [
        "error",
        {
          exemptedBy: ["internal"],
          forceReturnsWithAsync: false,
        },
      ],
      "jsdoc/check-tag-names": ["error", { typed: true }],
      "jsdoc/check-types": "off",
      "jsdoc/no-undefined-types": "off",
      "jsdoc/no-types": "error",
      "jsdoc/require-param-type": "off",
      "jsdoc/require-returns-type": "off",
      "jsdoc/require-yields": "off",
      "jsdoc/require-yields-check": "off",
      "jsdoc/require-yields-description": "off",
      "jsdoc/require-yields-type": "off",
      "jsdoc/tag-lines": "off",
      "jsdoc/check-indentation": "off",
      "jsdoc/check-line-alignment": "off",
      "jsdoc/check-examples": "off",
      "jsdoc/no-bad-blocks": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-example": "off",
      "jsdoc/match-description": "off",
      "jsdoc/informative-docs": "off",
      "jsdoc/require-hyphen-before-param-description": "off",
      "jsdoc/require-file-overview": "off",
      "jsdoc/require-property": "off",
      "jsdoc/require-property-description": "off",
      "jsdoc/require-property-name": "off",
      "jsdoc/require-property-type": "off",
      "jsdoc/require-template": "off",
      "jsdoc/require-template-description": "off",
    },
  },
  {
    files: ["tests/**"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/check-param-names": "off",
      "jsdoc/check-tag-names": "off",
      "jsdoc/valid-types": "off",
      "jsdoc/no-types": "off",
    },
  },
);
