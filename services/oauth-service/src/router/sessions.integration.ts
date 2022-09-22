test("", () => {});

// import MockDate from "mockdate";
// import nock from "nock";
// import request from "supertest";
// import { createTestBrowserSession } from "../fixtures/entity";
// import { getTestData } from "../fixtures/data";
// import { randomUUID } from "crypto";
// import { server } from "../server/server";
// import {
//   TEST_BROWSER_SESSION_REPOSITORY,
//   getTestAccessToken,
//   getTestAuthenticationConfirmationToken,
//   setupIntegration,
//   getTestIdToken,
// } from "../fixtures/integration";
//
// MockDate.set("2021-01-01T08:00:00.000Z");
//
// jest.unmock("@lindorm-io/mongo");
// jest.unmock("@lindorm-io/redis");
//
// describe("/sessions", () => {
//   beforeAll(setupIntegration);
//
//   nock("https://authentication.test.lindorm.io")
//     .post("/internal/authentication")
//     .times(999)
//     .reply(200, { id: "da2f2281-da07-4118-8d40-5596079e036b" });
//
//   test("POST /authenticate", async () => {
//     const { codeChallenge, codeChallengeMethod } = getTestData();
//     const subject = randomUUID();
//
//     const accessToken = getTestAccessToken({ subject });
//     const idTokenHint = getTestIdToken({ subject });
//
//     const response = await request(server.callback())
//       .post("/sessions/authenticate")
//       .set("Authorization", `Bearer ${accessToken}`)
//       .send({
//         code_challenge: codeChallenge,
//         code_challenge_method: codeChallengeMethod,
//         country: "se",
//         id_token_hint: idTokenHint,
//       })
//       .expect(200);
//
//     expect(response.body).toStrictEqual({
//       authentication_session_id: "da2f2281-da07-4118-8d40-5596079e036b",
//     });
//   });
//
//   test("PUT /authenticate", async () => {
//     const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());
//
//     const authToken = getTestAuthenticationConfirmationToken({
//       subject: browserSession.identityId,
//     });
//
//     const accessToken = getTestAccessToken({
//       sessionId: browserSession.id,
//       subject: browserSession.identityId,
//     });
//
//     await request(server.callback())
//       .put("/sessions/authenticate")
//       .set("Authorization", `Bearer ${accessToken}`)
//       .send({
//         auth_token: authToken,
//       })
//       .expect(204);
//
//     await expect(
//       TEST_BROWSER_SESSION_REPOSITORY.find({ id: browserSession.id }),
//     ).resolves.toStrictEqual(
//       expect.objectContaining({
//         acrValues: ["loa_3"],
//         amrValues: ["device_challenge", "email_otp", "phone_otp"],
//         latestAuthentication: new Date("2021-01-01T08:00:00.000Z"),
//         levelOfAssurance: 3,
//       }),
//     );
//   });
// });
