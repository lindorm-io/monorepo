import { getConsentInfoController } from "./get-consent-info";
import { getTestConsentSession } from "../../test/entity";

describe("getConsentInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: { consentSession: getTestConsentSession() },
    };
  });

  test("should resolve", async () => {
    await expect(getConsentInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
