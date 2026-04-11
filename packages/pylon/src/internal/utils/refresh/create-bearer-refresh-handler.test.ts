import { createMockAegis } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { PylonSocketAuth } from "../../../types";
import { createBearerRefreshHandler } from "./create-bearer-refresh-handler";

describe("createBearerRefreshHandler", () => {
  let aegis: ReturnType<typeof createMockAegis>;
  let auth: PylonSocketAuth;
  let socket: any;

  beforeEach(() => {
    aegis = createMockAegis();

    auth = {
      strategy: "bearer",
      getExpiresAt: () => new Date("2026-04-11T12:05:00.000Z"),
      refresh: async () => {},
      authExpiredEmittedAt: new Date("2026-04-11T12:04:30.000Z"),
    };

    socket = {
      data: {
        tokens: { bearer: { payload: { subject: "alice" } } },
        pylon: { auth },
      },
    };
  });

  test("swaps bearer, updates getExpiresAt, clears authExpiredEmittedAt on valid refresh", async () => {
    const newExp = new Date("2026-04-11T13:00:00.000Z");
    (aegis.verify as jest.Mock).mockResolvedValue({
      payload: { subject: "alice", expiresAt: newExp },
      header: { tokenType: "access_token" },
      token: "new-jwt",
    });

    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await handler({ bearer: "new-jwt" });

    expect(socket.data.tokens.bearer).toMatchSnapshot();
    expect(auth.getExpiresAt()).toMatchSnapshot();
    expect(auth.authExpiredEmittedAt).toBeNull();
  });

  test("throws when subject changes", async () => {
    (aegis.verify as jest.Mock).mockResolvedValue({
      payload: { subject: "bob", expiresAt: new Date() },
      header: {},
      token: "new-jwt",
    });

    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await expect(handler({ bearer: "new-jwt" })).rejects.toThrow(ClientError);
  });

  test("throws when payload is malformed", async () => {
    const handler = createBearerRefreshHandler({
      aegis,
      socket,
      subject: "alice",
      verifyOptions: { issuer: "https://test.lindorm.io/" } as any,
    });

    await expect(handler({})).rejects.toThrow(ClientError);
    await expect(handler(null)).rejects.toThrow(ClientError);
    await expect(handler({ bearer: 123 })).rejects.toThrow(ClientError);
  });
});
