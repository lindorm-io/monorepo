import { createMockRepository } from "@lindorm-io/mongo";
import { createTestEmailIdentifier } from "../../fixtures/entity";
import { setIdentifierAsPrimary as _setIdentifierAsPrimary } from "../../handler";
import { updateIdentifierController } from "./update-identifier";

jest.mock("../../handler");

const setIdentifierAsPrimary = _setIdentifierAsPrimary as jest.Mock;

describe("updateIdentifierController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {},
      entity: {
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

    expect(setIdentifierAsPrimary).toHaveBeenCalled();
  });

  test("should resolve label and primary", async () => {
    ctx.data.label = "new-label";
    ctx.data.primary = true;

    await expect(updateIdentifierController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identifierRepository.update).toHaveBeenCalled();

    expect(setIdentifierAsPrimary).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        label: "new-label",
      }),
    );
  });
});
