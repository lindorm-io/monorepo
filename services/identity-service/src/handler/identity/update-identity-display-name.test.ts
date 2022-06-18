import { createMockLogger } from "@lindorm-io/winston";
import { createTestDisplayName, createTestIdentity } from "../../fixtures/entity";
import { updateIdentityDisplayName } from "./update-identity-display-name";

jest.mock("@lindorm-io/core", () => ({
  ...(jest.requireActual("@lindorm-io/core") as object),

  randomNumber: jest.fn().mockImplementation(async () => 4444),
}));

describe("updateIdentityDisplayName", () => {
  let ctx: any;
  let identity: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      repository: {
        displayNameRepository: {
          find: jest.fn().mockImplementation(async (options) =>
            createTestDisplayName({
              numbers: [1234, 2345, 3456, 4567, 5678, 6789],
              ...options,
            }),
          ),
          findOrCreate: jest.fn().mockImplementation(async (options) =>
            createTestDisplayName({
              numbers: [1234, 2345, 3456, 4567, 5678, 6789],
              ...options,
            }),
          ),
          update: jest.fn(),
        },
      },
    };
    identity = createTestIdentity({
      displayName: {
        name: "oldName",
        number: 1234,
      },
    });
  });

  test("should update display name entity", async () => {
    await expect(updateIdentityDisplayName(ctx, identity, "newName")).resolves.toBeUndefined();

    expect(ctx.repository.displayNameRepository.update.mock.calls[0][0]).toStrictEqual(
      expect.objectContaining({
        name: "oldName",
        numbers: [2345, 3456, 4567, 5678, 6789],
      }),
    );

    expect(ctx.repository.displayNameRepository.update.mock.calls[1][0]).toStrictEqual(
      expect.objectContaining({
        name: "newName",
        numbers: expect.arrayContaining([4444]),
      }),
    );

    expect(identity).toStrictEqual(
      expect.objectContaining({
        displayName: {
          name: "newName",
          number: 4444,
        },
      }),
    );
  });
});
