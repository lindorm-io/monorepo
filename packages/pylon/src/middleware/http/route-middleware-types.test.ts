import { describe, expect, test } from "vitest";
import { z } from "zod";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../types/index.js";
import { useSchema } from "../common/use-schema.js";
import { useHandler } from "./use-handler.js";

// Regression for F3: useSchema() returns the base PylonMiddleware (PylonContext),
// useHandler() returns the http-specialised PylonHttpMiddleware. A single route
// array `[useSchema(s), useHandler(h)]` typed as Array<ServerHttpMiddleware> only
// type-checks if PylonHttpContext is assignable to PylonContext — which requires
// `params` to be present on PylonHttpContext. This is enforced at `npm run
// typecheck` (test files are part of the typecheck include).

// Mirror create-pylon's generated types/context.ts shape.
type ServerHttpContext<Data = any> = PylonHttpContext<Data>;
type ServerHttpMiddleware<C extends ServerHttpContext = ServerHttpContext> =
  PylonHttpMiddleware<C>;

describe("route middleware array (F3)", () => {
  test("useSchema + useHandler compose into a single Array<ServerHttpMiddleware>", () => {
    // Compile-time assertion: this assignment fails to type-check if
    // PylonHttpContext stops surfacing `params`.
    const GET: Array<ServerHttpMiddleware> = [
      useSchema(z.object({ id: z.string() })),
      useHandler(async () => ({})),
    ];

    expect(GET).toHaveLength(2);
    expect(typeof GET[0]).toBe("function");
    expect(typeof GET[1]).toBe("function");
  });

  test("params is present on PylonHttpContext", () => {
    // Type-level: params must be a Dict<string> on the http context.
    type ParamsType = PylonHttpContext["params"];
    const params: ParamsType = { id: "abc" };
    expect(params.id).toBe("abc");
  });
});
