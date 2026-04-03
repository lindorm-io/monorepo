import { createMockAegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { createMockKafkaSource } from "@lindorm/kafka";
import { createMockMnemosSource } from "@lindorm/mnemos";
import { createMockMongoSource } from "@lindorm/mongo";
import { createMockRabbitSource } from "@lindorm/rabbit";
import { createMockRedisSource } from "@lindorm/redis";
import { IPylonSession } from "../../interfaces";
import { createSessionStore } from "./create-session-store";

describe("createSessionStore", () => {
  let ctx: any;
  let session: IPylonSession;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      kafka: { source: createMockKafkaSource() },
      mnemos: { source: createMockMnemosSource() },
      mongo: { source: createMockMongoSource() },
      rabbit: { source: createMockRabbitSource() },
      redis: { source: createMockRedisSource() },
    };

    session = {
      id: "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
      accessToken: "access-token",
      expiresAt: Date.now() + 3600000,
      idToken: "id-token",
      issuedAt: Date.now(),
      refreshToken: "refresh-token",
      scope: ["openid", "profile", "email", "offline_access"],
      subject: "643881f8-f6b0-5a18-9396-6fbe29ebfec8",
    };
  });

  test("should resolve undefined when cookie is used", () => {
    expect(createSessionStore({ use: "cookie" })).toBeUndefined();
  });

  test("should resolve custom store", async () => {
    const custom = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      logout: jest.fn(),
    };

    const store = createSessionStore({ use: "custom", custom });

    expect(store).toBe(custom);
  });

  test("should resolve stored store", async () => {
    const store = createSessionStore({ use: "stored", source: "MnemosSource" });

    expect(store).toBeDefined();

    await expect(store!.set(ctx, session)).resolves.toEqual(
      "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
    );

    await expect(store!.get(ctx, session.id)).resolves.toEqual(
      expect.objectContaining({
        id: session.id,
      }),
    );

    await expect(store!.del(ctx, session.id)).resolves.toBeUndefined();

    await expect(store!.logout(ctx, session.subject)).resolves.toBeUndefined();
  });
});
