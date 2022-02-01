import { LoginSession } from "../../entity";
import { getCurrentFlowSession } from "./get-current-flow-session";
import { getTestFlowSession, getTestLoginSession } from "../../test/entity";

describe("getCurrentFlowSession", () => {
  let ctx: any;
  let loginSession: LoginSession;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: {
          findMany: jest.fn().mockResolvedValue([
            getTestFlowSession({
              id: "1",
              created: new Date("2021-01-01T08:00:00.000Z"),
            }),
            getTestFlowSession({
              id: "2",
              created: new Date("2021-01-01T08:00:15.000Z"),
            }),
          ]),
        },
      },
    };

    loginSession = getTestLoginSession();
  });

  test("should resolve with most recently created flow session", async () => {
    await expect(getCurrentFlowSession(ctx, loginSession)).resolves.toStrictEqual(
      expect.objectContaining({ id: "2" }),
    );
  });

  test("should resolve with null", async () => {
    ctx.cache.flowSessionCache.findMany.mockResolvedValue([]);

    await expect(getCurrentFlowSession(ctx, loginSession)).resolves.toBe(null);
  });
});
