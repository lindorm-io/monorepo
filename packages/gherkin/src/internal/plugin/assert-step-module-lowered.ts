import { isArray, isObject } from "@lindorm/is";
import { parseAst } from "vite";
import { GherkinError } from "../../errors/GherkinError.js";

export type AssertStepModuleLoweredOptions = {
  /** The step module's code AFTER the whole transform chain has run. */
  code: string;
  /** Root-relative path, matching the plugin's other failure messages. */
  uri: string;
};

const ROUTE =
  "Any transform whose output is executable JavaScript works, tsc's own __esDecorate lowering included; the route this package verifies is `unplugin-swc` with `jsc.parser.decorators: true`, `jsc.transform.decoratorVersion: \"2022-03\"` and `oxc: false`, as the README's Quick start wires it.";

const NOT_COMPILED_DETAILS = `Step modules are TypeScript with stage-3 decorators and gherkin lowers nothing itself, so the vite config must carry a transform that compiles them. ${ROUTE} With one configured, this module's own syntax is the fault.`;

const NOT_LOWERED_DETAILS = `No JavaScript engine executes a stage-3 decorator, and gherkin lowers nothing itself, so the vite config must carry a transform that does. ${ROUTE}`;

/** A `Decorator` node anywhere — a decorated class nests at any depth. */
const hasDecorator = (node: unknown): boolean => {
  if (isArray(node)) {
    return node.some(hasDecorator);
  }

  if (isObject(node) === false) {
    return false;
  }

  if (node.type === "Decorator") {
    return true;
  }

  return Object.values(node).some(hasDecorator);
};

/**
 * Runs on the LAST transform hook of the chain (gherkin-plugin.ts), so the
 * code handed here is what the engine would have executed. Both refusals are
 * proofs of non-execution rather than opinions about the consumer's config,
 * which is what keeps a correctly wired pipeline out of this guard's reach:
 * the code parseAst rejects is the code vite's own ssrTransform rejects
 * moments later, and no JavaScript engine executes a stage-3 decorator.
 *
 * ⚠ A transform-hook throw reaches the terminal as its MESSAGE, `plugin` and
 * `id` only — `code`, `details` and `data` never print — so the fix travels
 * inside the message and `id` carries the uri vite's formatter shows as
 * `File:`. Without the guard the reader gets `SyntaxError: Invalid or
 * unexpected token` and `Tests no tests`, naming neither decorators nor the
 * transform. Pinned by src/e2e/meta-no-lowering.test.ts.
 */
export const assertStepModuleLowered = ({
  code,
  uri,
}: AssertStepModuleLoweredOptions): void => {
  let ast: unknown;

  try {
    ast = parseAst(code);
  } catch (error) {
    throw new GherkinError(
      [
        `Step module ${uri} does not parse as JavaScript after the transform pipeline ran, so it can never load.`,
        "",
        NOT_COMPILED_DETAILS,
      ].join("\n"),
      {
        code: "step_module_not_compiled",
        details: NOT_COMPILED_DETAILS,
        data: { uri },
        cause: error,
        id: uri,
      },
    );
  }

  if (hasDecorator(ast) === false) {
    return;
  }

  throw new GherkinError(
    [
      `Step module ${uri} still carries a stage-3 decorator after the transform pipeline ran.`,
      "",
      NOT_LOWERED_DETAILS,
    ].join("\n"),
    {
      code: "step_module_not_lowered",
      details: NOT_LOWERED_DETAILS,
      data: { uri },
      id: uri,
    },
  );
};
