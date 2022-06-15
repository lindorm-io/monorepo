import { createTestConsentSession } from "../../fixtures/entity";
import { getConsentInfoController } from "./get-consent-info";

describe("getConsentInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        consentSession: createTestConsentSession({
          requestedAudiences: ["1ea69be9-7857-420f-b4ef-1eb59e106189"],
        }),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getConsentInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
