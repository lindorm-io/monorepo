import {
  CucumberExpression,
  ParameterType as CucumberParameterType,
  ParameterTypeRegistry,
} from "@cucumber/cucumber-expressions";
// Deep import: the class is not exported from the package index (verified
// 20.1.0 index.d.ts, no `exports` map in its package.json). A release that
// moves the file fails LOUDLY at load — the accepted tradeoff.
import { UndefinedParameterTypeError } from "@cucumber/cucumber-expressions/dist/Errors.js";
import { GherkinError } from "../../errors/GherkinError.js";
import type { CompiledStep } from "./match-step.js";
import { matchStep } from "./match-step.js";
import { orderHooks } from "./order-hooks.js";
import type { ContextRegistration } from "./registrations.js";
import type { GherkinRegistry, ParameterTypeDeclaration, StepModule } from "./types.js";

/**
 * Builds the step registry from the drained binding registrations. ALL
 * parameter types register first, then ALL expressions build — an expression
 * in module A may use a parameter type declared in module B regardless of
 * import order, so interleaving the two would make `{name}` resolution depend
 * on `import.meta.glob` key order.
 */
export const buildRegistry = (
  modules: Array<StepModule>,
  contexts: Array<ContextRegistration> = [],
): GherkinRegistry => {
  const parameterTypeRegistry = new ParameterTypeRegistry();
  const parameterTypeDeclarations = new Map<string, ParameterTypeDeclaration>();

  for (const { modulePath, registrations } of modules) {
    for (const { className, parameterTypes, target } of registrations) {
      for (const staged of parameterTypes) {
        const parameterType = new CucumberParameterType<unknown>(
          staged.name,
          staged.regexp,
          null,
          // Static `this` is the declaring class no matter what cucumber
          // passes as thisObj at Argument.getValue time.
          (...match: Array<string>) => staged.transform.apply(target, match),
          staged.options.useForSnippets === true,
          // MUST be false: `true` makes two parameter types sharing one regexp
          // source fail registration ("only one preferential parameter type
          // per regexp" — ParameterTypeRegistry.defineParameterType), and the
          // flat namespace makes shared regexps routine. Pinned:
          // build-registry.test.ts.
          false,
        );

        try {
          parameterTypeRegistry.defineParameterType(parameterType);
          parameterTypeDeclarations.set(staged.name, {
            className,
            methodName: staged.methodName,
            modulePath,
          });
        } catch (error) {
          // Only the duplicate-name throw is reachable here. The constructor
          // above cannot throw because its inputs are pre-validated at
          // @ParameterType decoration time (name characters, non-empty name,
          // regexp flags — ParameterType.ts), and the other throw in
          // ParameterTypeRegistry.defineParameterType (preferential-regexp
          // clash) requires BOTH types preferential while ours are pinned
          // false above.
          throw new GherkinError(`Duplicate parameter type {${staged.name}}`, {
            code: "duplicate_parameter_type",
            title: "Duplicate Parameter Type",
            details:
              "A parameter type name registers once per registry — the flat step namespace shares one registry across every step module, and the built-in names are taken too. Rename one of the two declarations.",
            data: {
              className,
              methodName: staged.methodName,
              modulePath,
              name: staged.name,
            },
            error: error as Error,
          });
        }
      }
    }
  }

  const compiled: Array<CompiledStep> = [];

  for (const { modulePath, registrations } of modules) {
    for (const { className, injects, steps, target } of registrations) {
      for (const staged of steps) {
        try {
          compiled.push({
            definition: {
              className,
              decorator: staged.decorator,
              expression: staged.expression,
              injects,
              methodName: staged.methodName,
              modulePath,
              target,
            },
            expression: new CucumberExpression(staged.expression, parameterTypeRegistry),
          });
        } catch (error) {
          if (error instanceof UndefinedParameterTypeError) {
            throw new GherkinError(
              `Unknown parameter type {${error.undefinedParameterTypeName}}`,
              {
                code: "unknown_parameter_type",
                title: "Unknown Parameter Type",
                details:
                  "The step expression references a parameter type that no @ParameterType declaration or built-in provides. Declare it on a static method, or fix the name in the expression.",
                data: {
                  className,
                  expression: staged.expression,
                  methodName: staged.methodName,
                  modulePath,
                  name: error.undefinedParameterTypeName,
                },
                error,
              },
            );
          }

          // Any other constructor throw is a malformed expression — anchored
          // like every registry error, never rethrown raw: the cucumber
          // message alone names no class, method or module, so the author
          // could not find the offending decorator. Always an Error: the
          // thrower is cucumber's own parser (CucumberExpressionError et al).
          const cause = error as Error;
          const failure = new GherkinError(
            [
              `Invalid step expression "${staged.expression}"`,
              `  ${className}.${staged.methodName} (${modulePath})`,
              cause.message,
            ].join("\n\n"),
            {
              code: "invalid_step_expression",
              title: "Invalid Step Expression",
              details:
                "The step expression is not a valid Cucumber Expression — construction failed before any matching could happen. Fix the expression on the named method; the parser's own diagnosis follows the anchor.",
              data: {
                className,
                expression: staged.expression,
                methodName: staged.methodName,
                modulePath,
              },
              error: cause,
            },
          );

          failure.cause = cause;
          throw failure;
        }
      }
    }
  }

  return {
    contexts,
    hooks: orderHooks(modules),
    match: (text: string) => matchStep(compiled, text),
    parameterTypeDeclarations,
    parameterTypeRegistry,
  };
};
