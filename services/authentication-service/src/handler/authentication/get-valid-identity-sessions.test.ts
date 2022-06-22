import MockDate from "mockdate";
import { getValidIdentitySessions } from "./get-valid-identity-sessions";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getValidIdentitySessions", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        oauthClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              sessions: [
                { id: "1", adjustedAccessLevel: 1, levelOfAssurance: 1 },
                { id: "2", adjustedAccessLevel: 2, levelOfAssurance: 2 },
                { id: "3", adjustedAccessLevel: 3, levelOfAssurance: 3 },
                { id: "4", adjustedAccessLevel: 4, levelOfAssurance: 4 },
              ],
            },
          }),
        },
      },
    };
  });

  test("should resolve valid sessions", async () => {
    await expect(getValidIdentitySessions(ctx, "1")).resolves.toMatchSnapshot();
  });

  test("should resolve empty array on missing identity", async () => {
    await expect(getValidIdentitySessions(ctx, undefined)).resolves.toStrictEqual([]);
  });

  test("should resolve empty array on error", async () => {
    ctx.axios.oauthClient.get.mockRejectedValue(new Error("message"));

    await expect(getValidIdentitySessions(ctx, "1")).resolves.toStrictEqual([]);
  });
});
