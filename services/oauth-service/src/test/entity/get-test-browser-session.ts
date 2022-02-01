import { BrowserSession, BrowserSessionOptions } from "../../entity";

export const getTestBrowserSession = (
  options: Partial<BrowserSessionOptions> = {},
): BrowserSession =>
  new BrowserSession({
    acrValues: ["loa_2", "email_otp", "phone_otp"],
    amrValues: ["email_otp", "phone_otp"],
    clients: [
      "642d3446-7975-4d28-a6c0-2adacf37a32a",
      "00f4b64d-de9e-42e7-86b3-2bdd1dd59eb5",
      "df6fea94-2905-4a1b-a235-0cc5b8749114",
    ],
    country: "se",
    expires: new Date("2021-04-01T08:00:00.000Z"),
    identityId: "26ef8a68-dd67-414b-bcff-e6dbe2b6707a",
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    nonce: "Aem5ldu1tdUgrd9C",
    remember: true,
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
