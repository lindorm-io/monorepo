import { confirmOauthSelectAccount as _confirmOauthSelectAccount } from "../../../handler";
import { confirmSelectAccountController } from "./confirm-select-account";

jest.mock("../../../handler");

const confirmOauthSelectAccount = _confirmOauthSelectAccount as jest.Mock;

describe("confirmSelectAccountController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        id: "36a19465-6a48-4eda-9655-92a7c8b68813",
        selectExisting: "7de41ef2-8cd7-474a-9fed-300fc8003431",
        selectNew: true,
      },
    };

    confirmOauthSelectAccount.mockResolvedValue({ redirectTo: "confirmOauthSelectAccount" });
  });

  test("should resolve", async () => {
    await expect(confirmSelectAccountController(ctx)).resolves.toStrictEqual({
      body: { redirectTo: "confirmOauthSelectAccount" },
    });
  });
});
