import { verifyIdentifierConnectSessionController } from "./verify-identifier-connect-session";
import { createTestConnectSession, createTestEmailIdentifier } from "../../fixtures/entity";
import { createMockRepository } from "@lindorm-io/mongo";

jest.mock("../../instance", () => ({
  argon: {
    assert: jest.fn().mockImplementation(async () => {}),
  },
}));

describe("verifyIdentifierConnectSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        code: "code",
      },
      entity: {
        connectSession: createTestConnectSession(),
        identifier: createTestEmailIdentifier({
          verified: false,
        }),
      },
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };
  });

  test("should resolve", async () => {
    await expect(verifyIdentifierConnectSessionController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ verified: true }),
    );
  });
});
