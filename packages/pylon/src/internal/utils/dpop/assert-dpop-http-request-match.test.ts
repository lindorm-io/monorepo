import { ClientError } from "@lindorm/errors";
import { assertDpopHttpRequestMatch } from "./assert-dpop-http-request-match.js";
import { describe, expect, test } from "vitest";

describe("assertDpopHttpRequestMatch", () => {
  const ctx: any = {
    method: "POST",
    origin: "https://api.example.com",
    path: "/orders",
  };

  test("accepts matching proof", () => {
    expect(() =>
      assertDpopHttpRequestMatch(ctx, {
        httpMethod: "POST",
        httpUri: "https://api.example.com/orders",
      }),
    ).not.toThrow();
  });

  test("rejects on method mismatch", () => {
    expect(() =>
      assertDpopHttpRequestMatch(ctx, {
        httpMethod: "GET",
        httpUri: "https://api.example.com/orders",
      }),
    ).toThrow(ClientError);
  });

  test("rejects on uri mismatch", () => {
    expect(() =>
      assertDpopHttpRequestMatch(ctx, {
        httpMethod: "POST",
        httpUri: "https://api.example.com/other",
      }),
    ).toThrow(ClientError);
  });
});
