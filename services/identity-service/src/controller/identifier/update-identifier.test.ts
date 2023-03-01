import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { updateIdentifierController } from "./update-identifier";

describe("updateIdentifierController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {},
      entity: {
        identity: createTestIdentity(),
        identifier: createTestEmailIdentifier(),
      },
      repository: {
        identifierRepository: createMockRepository(createTestEmailIdentifier),
      },
    };
  });

  afterEach(jest.resetAllMocks);

  test("should resolve label", async () => {
    ctx.data.label = "new-label";

    await expect(updateIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "new-label",
      }),
    );
  });

  test("should resolve primary", async () => {
    ctx.data.primary = true;

    await expect(updateIdentifierController(ctx)).resolves.toBeUndefined();
  });

  test("should resolve label and primary", async () => {
    ctx.data.label = "new-label";
    ctx.data.primary = true;

    await expect(updateIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalled();
  });
});
