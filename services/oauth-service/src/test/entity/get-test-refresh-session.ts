import { RefreshSession, RefreshSessionOptions } from "../../entity";

export const getTestRefreshSession = (
  options: Partial<RefreshSessionOptions> = {},
): RefreshSession =>
  new RefreshSession({
    acrValues: ["loa_2", "email_otp", "phone_otp"],
    amrValues: ["email_otp", "phone_otp"],
    clientId: "6a3e8398-eebf-47d1-904f-d8d267a92f85",
    expires: new Date("2021-02-01T08:00:00.000Z"),
    identityId: "26ef8a68-dd67-414b-bcff-e6dbe2b6707a",
    levelOfAssurance: 2,
    nonce: "Aem5ldu1tdUgrd9C",
    tokenId: "ff75e200-909f-487a-a39a-88e42993876c",
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
