import { DpopSigner } from "@lindorm/types";
import { createConduitDpopAuthMiddleware } from "./conduit-dpop-auth-middleware";

describe("createConduitDpopAuthMiddleware", () => {
  const publicJwk = { kty: "EC", crv: "P-256", x: "x-val", y: "y-val" } as any;
  const signer: DpopSigner = {
    algorithm: "ES256",
    publicJwk,
    sign: jest.fn(async () => new Uint8Array([1, 2, 3, 4])),
  };

  let next: jest.Mock;
  let dpopAuth: ReturnType<typeof createConduitDpopAuthMiddleware>;

  beforeEach(() => {
    next = jest.fn();
    (signer.sign as jest.Mock).mockClear();
    dpopAuth = createConduitDpopAuthMiddleware(signer);
  });

  const buildCtx = (overrides: Record<string, unknown> = {}) =>
    ({
      req: {
        config: { method: "POST" },
        headers: {},
        url: "https://api.example.com/orders",
        ...overrides,
      },
    }) as any;

  test("should set Authorization: DPoP and DPoP headers", async () => {
    const ctx = buildCtx();
    const middleware = dpopAuth("test-access-token");

    await middleware(ctx, next);

    expect(ctx.req.headers.Authorization).toEqual("DPoP test-access-token");
    expect(ctx.req.headers.DPoP).toEqual(expect.stringMatching(/^.+\..+\..+$/));
  });

  test("should call the signer once per request", async () => {
    const ctx = buildCtx();
    const middleware = dpopAuth("test-access-token");

    await middleware(ctx, next);

    expect(signer.sign).toHaveBeenCalledTimes(1);
  });

  test("should call next", async () => {
    const ctx = buildCtx();
    const middleware = dpopAuth("test-access-token");

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should preserve pre-existing headers", async () => {
    const ctx = buildCtx({ headers: { "X-Correlation-Id": "abc" } });
    const middleware = dpopAuth("test-access-token");

    await middleware(ctx, next);

    expect(ctx.req.headers["X-Correlation-Id"]).toEqual("abc");
    expect(ctx.req.headers.Authorization).toEqual("DPoP test-access-token");
  });

  test("should overwrite existing Authorization header", async () => {
    const ctx = buildCtx({ headers: { Authorization: "Bearer old-token" } });
    const middleware = dpopAuth("test-access-token");

    await middleware(ctx, next);

    expect(ctx.req.headers.Authorization).toEqual("DPoP test-access-token");
  });

  test("should allow reusing the outer factory for multiple access tokens", async () => {
    const ctxA = buildCtx();
    const ctxB = buildCtx();

    await dpopAuth("token-a")(ctxA, next);
    await dpopAuth("token-b")(ctxB, next);

    expect(ctxA.req.headers.Authorization).toEqual("DPoP token-a");
    expect(ctxB.req.headers.Authorization).toEqual("DPoP token-b");
  });

  test("should pass nonce through to the proof when provided", async () => {
    const ctx = buildCtx();
    const middleware = dpopAuth("test-access-token", { nonce: "server-nonce" });

    await middleware(ctx, next);

    const [headerB64, payloadB64] = ctx.req.headers.DPoP.split(".");
    expect(headerB64).toBeTruthy();
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    expect(payload.nonce).toEqual("server-nonce");
  });
});
