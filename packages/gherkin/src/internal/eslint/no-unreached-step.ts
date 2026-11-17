import { isUndefined } from "@lindorm/is";
import type { Rule } from "eslint";
import type * as ESTree from "estree";
import { collectClassDeclarations } from "./collect-class-declarations.js";
import { collectStepTexts } from "./collect-step-texts.js";
import { compileStepExpression } from "./compile-step-expression.js";
import { createParameterTypeRegistry } from "./create-parameter-type-registry.js";
import { readGherkinImports } from "./read-gherkin-imports.js";

type NoUnreachedStepOptions = {
  features?: Array<string>;
};

export const noUnreachedStep: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Report a step definition that no scenario step in the feature files matches",
    },
    messages: {
      unreached: 'No scenario step in the feature files matches "{{expression}}".',
    },
    schema: [
      {
        type: "object",
        properties: { features: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  create: (context) => {
    const classes: Array<ESTree.Class> = [];

    return {
      ClassDeclaration: (node) => {
        classes.push(node);
      },
      ClassExpression: (node) => {
        classes.push(node);
      },
      "Program:exit": (program) => {
        const imports = readGherkinImports(program);
        const declarations = classes.map((node) =>
          collectClassDeclarations(node, imports),
        );
        const steps = declarations.flatMap(({ steps }) => steps);

        if (steps.length === 0) {
          return;
        }

        const { features = ["src/**/*.feature"] }: NoUnreachedStepOptions =
          context.options[0] ?? {};
        const texts = collectStepTexts({ cwd: context.cwd, features });
        const registry = createParameterTypeRegistry(
          declarations.flatMap(({ parameterTypes }) => parameterTypes),
        );

        for (const { expression, node } of steps) {
          const compiled = compileStepExpression(expression, registry);

          if (
            isUndefined(compiled) ||
            texts.some((text) => compiled.match(text) !== null)
          ) {
            continue;
          }

          context.report({ data: { expression }, messageId: "unreached", node });
        }
      },
    };
  },
};
