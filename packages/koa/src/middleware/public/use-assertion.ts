import { AssertionFunction, DefaultLindormKoaContext, DefaultLindormMiddleware } from "../../types";
import { ClientError } from "@lindorm-io/errors";
import { get } from "lodash";

interface Options {
  assertion?: AssertionFunction;
  expect?: any;
  fromPath: {
    expect?: string;
    actual: string;
  };
  hint?: string;
}

const defaultAssertion: AssertionFunction = (expect, actual) => expect === actual;

export const useAssertion =
  <Context extends DefaultLindormKoaContext = DefaultLindormKoaContext>(
    options: Options,
  ): DefaultLindormMiddleware<Context> =>
  async (ctx, next): Promise<void> => {
    const { assertion = defaultAssertion, fromPath, hint } = options;

    try {
      const expect = fromPath.expect ? get(ctx, fromPath.expect) : options.expect;
      const actual = get(ctx, fromPath.actual);

      if (expect === undefined || actual === undefined) {
        throw new ClientError("Conflict", {
          debug: {
            expect,
            actual,
          },
          data: { hint },
          description: "Value is missing",
          statusCode: ClientError.StatusCode.CONFLICT,
        });
      }

      if (!assertion(expect, actual)) {
        throw new ClientError("Conflict", {
          debug: {
            expect,
            actual,
          },
          data: { hint },
          description: "Assertion failed",
          statusCode: ClientError.StatusCode.CONFLICT,
        });
      }
    } catch (err: any) {
      if (err instanceof ClientError) {
        throw err;
      }

      throw new ClientError("Conflict", {
        error: err,
        description: err.message,
      });
    }

    await next();
  };
