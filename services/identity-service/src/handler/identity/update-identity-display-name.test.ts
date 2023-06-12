import { createMockLogger } from "@lindorm-io/winston";
import { Identity } from "../../entity";
import { createTestDisplayName, createTestIdentity } from "../../fixtures/entity";
import { updateIdentityDisplayName } from "./update-identity-display-name";

describe("updateIdentityDisplayName", () => {
  let ctx: any;
  let identity: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      mongo: {
        displayNameRepository: {
          findOrCreate: jest.fn().mockImplementation(async (options) =>
            createTestDisplayName({
              number: 1234,
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
        number: 456,
      },
    });
  });

  test("should update display name entity", async () => {
    await expect(updateIdentityDisplayName(ctx, identity, "newName")).resolves.toStrictEqual(
      expect.any(Identity),
    );

    expect(identity).toStrictEqual(
      expect.objectContaining({
        displayName: {
          name: "newName",
          number: 1235,
        },
      }),
    );
  });
});
