import { createMockAegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { createMockProteusSource, createMockRepository } from "@lindorm/proteus/mocks";
import { IPylonSession } from "../../interfaces";
import { createSessionStore } from "./create-session-store";

describe("createSessionStore", () => {
  let ctx: any;
  let session: IPylonSession;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();

    const mockProteus = createMockProteusSource();
    mockProteus.repository.mockReturnValue(mockRepo);

    ctx = {
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      proteus: mockProteus,
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

    (mockRepo.insert as jest.Mock).mockResolvedValue(session);
    (mockRepo.findOne as jest.Mock).mockResolvedValue(session);
    (mockRepo.delete as jest.Mock).mockResolvedValue(undefined);
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
    const store = createSessionStore({ use: "stored" });

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
