import { IdentifierType } from "@lindorm-io/common-enums";
import { createTestIdentity } from "../../fixtures/entity";
import {
  addGenericIdentifier as _addGenericIdentifier,
  addUsernameIdentifier as _addUsernameIdentifier,
} from "../../handler";
import { assertIdentifier as _assertIdentifier } from "../../util";
import { addIdentifierController } from "./add-identifier";

jest.mock("../../handler");
jest.mock("../../util");

const addGenericIdentifier = _addGenericIdentifier as jest.Mock;
const addUsernameIdentifier = _addUsernameIdentifier as jest.Mock;
const assertIdentifier = _assertIdentifier as jest.Mock;

describe("addIdentifierController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        identifier: "identifier",
        label: "label",
        provider: "provider",
        type: IdentifierType.EMAIL,
        verified: true,
      },
      entity: {
        identity: createTestIdentity(),
      },
    };
  });

  test("should resolve generic identifier", async () => {
    await expect(addIdentifierController(ctx)).resolves.toBeUndefined();

    expect(assertIdentifier).toHaveBeenCalledWith("identifier", IdentifierType.EMAIL);
    expect(addGenericIdentifier).toHaveBeenCalledWith(ctx, ctx.entity.identity, {
      value: "identifier",
      label: "label",
      provider: "provider",
      type: IdentifierType.EMAIL,
      verified: true,
    });
    expect(addUsernameIdentifier).not.toHaveBeenCalled();
  });

  test("should resolve username", async () => {
    ctx.data.type = IdentifierType.USERNAME;

    await expect(addIdentifierController(ctx)).resolves.toBeUndefined();

    expect(assertIdentifier).toHaveBeenCalledWith("identifier", IdentifierType.USERNAME);
    expect(addGenericIdentifier).not.toHaveBeenCalledWith();
    expect(addUsernameIdentifier).toHaveBeenCalledWith(ctx, ctx.entity.identity, "identifier");
  });
});
