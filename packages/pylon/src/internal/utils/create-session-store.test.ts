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
      expiresAt: new Date(Date.now() + 3600000),
      idToken: "id-token",
      issuedAt: new Date(),
      refreshToken: "refresh-token",
      scope: ["openid", "profile", "email", "offline_access"],
      subject: "643881f8-f6b0-5a18-9396-6fbe29ebfec8",
    };

    (mockRepo.upsert as jest.Mock).mockResolvedValue(session);
    (mockRepo.findOne as jest.Mock).mockResolvedValue(session);
    (mockRepo.delete as jest.Mock).mockResolvedValue(undefined);
  });

  test("should resolve undefined when not enabled", () => {
    expect(createSessionStore({ enabled: false })).toBeUndefined();
  });

  test("should resolve undefined when no options", () => {
    expect(createSessionStore()).toBeUndefined();
  });

  test("should resolve store when enabled with proteus on context", async () => {
    const store = createSessionStore({ enabled: true });

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

  test("should fall back to cookie when no proteus available", async () => {
    ctx.proteus = undefined;

    const store = createSessionStore({ enabled: true });

    expect(store).toBeDefined();

    // set returns the session id (no repo to insert into)
    await expect(store!.set(ctx, session)).resolves.toEqual(session.id);

    // get returns null (no repo to query)
    await expect(store!.get(ctx, session.id)).resolves.toBeNull();

    // del and logout are no-ops
    await expect(store!.del(ctx, session.id)).resolves.toBeUndefined();
    await expect(store!.logout(ctx, session.subject)).resolves.toBeUndefined();
  });
});
