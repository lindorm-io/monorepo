import MockDate from "mockdate";
import { getClientInfoController } from "./get-client-info";
import { getTestClient } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClientInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: getTestClient(),
      },
    };
  });

  test("should resolve client", async () => {
    await expect(getClientInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
