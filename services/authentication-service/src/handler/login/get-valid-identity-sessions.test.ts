import { Account } from "../../entity";
import { createTestAccount } from "../../fixtures/entity";
import { getValidIdentitySessions } from "./get-valid-identity-sessions";
import { oauthGetIdentitySessions as _oauthGetIdentitySessions } from "../axios";

jest.mock("../axios");

const oauthGetIdentitySessions = _oauthGetIdentitySessions as jest.Mock;

describe("getValidIdentitySessions", () => {
  let ctx: any;
  let account: Account;

  beforeEach(() => {
    ctx = {};

    account = createTestAccount();

    oauthGetIdentitySessions.mockResolvedValue({
      sessions: [
        { id: "0b22f71b-223d-4aac-a69a-3eca2efe3337", levelOfAssurance: 1 },
        { id: "35d061df-b89f-4d3b-8f79-8c5ae20cdefa", levelOfAssurance: 2 },
        { id: "c3185abd-a96e-4de7-a2fd-6a2016d5e76c", levelOfAssurance: 3 },
        { id: "cfeda8f4-733a-448d-90ae-8f5867c56633", levelOfAssurance: 4 },
      ],
    });
  });

  test("should resolve", async () => {
    await expect(getValidIdentitySessions(ctx, account)).resolves.toStrictEqual([
      "35d061df-b89f-4d3b-8f79-8c5ae20cdefa",
      "c3185abd-a96e-4de7-a2fd-6a2016d5e76c",
      "cfeda8f4-733a-448d-90ae-8f5867c56633",
    ]);
  });

  test("should resolve empty array when account is missing", async () => {
    await expect(getValidIdentitySessions(ctx)).resolves.toStrictEqual([]);
  });

  test("should resolve empty array when identity service fails", async () => {
    oauthGetIdentitySessions.mockRejectedValue(new Error("message"));

    await expect(getValidIdentitySessions(ctx)).resolves.toStrictEqual([]);
  });
});
