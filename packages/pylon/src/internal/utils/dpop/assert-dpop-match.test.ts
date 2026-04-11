import { ClientError } from "@lindorm/errors";
import { assertDpopMatch } from "./assert-dpop-match";

describe("assertDpopMatch", () => {
  const target = {
    method: "POST",
    origin: "https://api.example.com",
    path: "/orders",
  };

  test("accepts matching method and uri", () => {
    expect(() =>
      assertDpopMatch(target, {
        httpMethod: "POST",
        httpUri: "https://api.example.com/orders",
      }),
    ).not.toThrow();
  });

  test("throws on htm mismatch", () => {
    expect(() =>
      assertDpopMatch(target, {
        httpMethod: "GET",
        httpUri: "https://api.example.com/orders",
      }),
    ).toThrow(ClientError);
  });

  test("throws on htu path mismatch", () => {
    expect(() =>
      assertDpopMatch(target, {
        httpMethod: "POST",
        httpUri: "https://api.example.com/other",
      }),
    ).toThrow(ClientError);
  });

  test("throws on htu origin mismatch", () => {
    expect(() =>
      assertDpopMatch(target, {
        httpMethod: "POST",
        httpUri: "https://evil.example.com/orders",
      }),
    ).toThrow(ClientError);
  });

  test("normalizes default port and scheme case", () => {
    expect(() =>
      assertDpopMatch(target, {
        httpMethod: "POST",
        httpUri: "HTTPS://API.EXAMPLE.COM:443/orders",
      }),
    ).not.toThrow();
  });
});
