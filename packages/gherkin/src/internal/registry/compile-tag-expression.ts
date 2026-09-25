import { parse } from "@cucumber/tag-expressions";
import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../../errors/GherkinError.js";

export type TagMatcher = (tags: Array<string>) => boolean;

export type CompileTagExpressionOptions = {
  className: string;
  methodName: string;
  modulePath: string;
  tagExpression?: string;
};

const ALWAYS_MATCHES: TagMatcher = () => true;

/**
 * Compiled ONCE at registry build — after every step module has loaded — so a
 * malformed expression fails every feature file deterministically and can be
 * anchored to its declaration, instead of throwing mid-scenario on whichever
 * pickle first evaluates it. Tags evaluate WITH the `@` prefix: the model
 * stores them as authored (ScenarioNode.tags / FeatureSuiteModel.tags), and
 * `parse("@wip").evaluate(["wip"])` is false (probed on 11.0.1; pinned:
 * compile-tag-expression.test.ts).
 */
export const compileTagExpression = ({
  className,
  methodName,
  modulePath,
  tagExpression,
}: CompileTagExpressionOptions): TagMatcher => {
  if (isUndefined(tagExpression)) {
    return ALWAYS_MATCHES;
  }

  try {
    const node = parse(tagExpression);
    return (tags: Array<string>) => node.evaluate(tags);
  } catch (error) {
    throw new GherkinError(
      `Invalid tag expression ${JSON.stringify(tagExpression)} on ${className}.${methodName}`,
      {
        code: "invalid_tag_expression",
        details:
          "The hook's tag expression could not be parsed. The language is `and` / `or` / `not` with parentheses over @-prefixed tags — fix the expression on the hook decorator.",
        data: {
          className,
          methodName,
          modulePath,
          tagExpression,
        },
        cause: error,
      },
    );
  }
};
