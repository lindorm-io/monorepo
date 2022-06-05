import { getConsentInfoController } from "./get-consent-info";
import { createTestConsentSession } from "../../fixtures/entity";

describe("getConsentInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        consentSession: createTestConsentSession(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(getConsentInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
