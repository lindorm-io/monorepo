import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { deleteAuthenticationController } from "./delete-authentication";

describe("deleteAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authenticationSessionCache: createMockCache(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession: createTestAuthenticationSession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(deleteAuthenticationController(ctx)).resolves.toBeUndefined();
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.CONFIRMED;

    await expect(deleteAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
