import { sessioninfoController } from "./sessioninfo";
import {
  getTestBrowserSession,
  getTestClient,
  getTestConsentSession,
  getTestRefreshSession,
} from "../../test/entity";

describe("sessioninfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: {
          find: jest
            .fn()
            .mockResolvedValueOnce(
              getTestClient({
                id: "343d2d9b-2cf5-4dd3-afd4-fed8890e965a",
                name: "343d2d9b",
              }),
            )
            .mockResolvedValueOnce(
              getTestClient({
                id: "dfa00361-05bb-4cfd-9e51-4d7542079930",
                name: "dfa00361",
              }),
            )
            .mockResolvedValueOnce(
              getTestClient({
                id: "77c7554a-199f-4fce-bacb-835dc6d96a44",
                name: "77c7554a",
              }),
            )
            .mockResolvedValueOnce(
              getTestClient({
                id: "68fc5e90-1259-49c0-acf9-542d039e4d09",
                name: "68fc5e90",
              }),
            ),
        },
      },
      token: {
        bearerToken: {
          subject: "identityId",
        },
      },
      repository: {
        browserSessionRepository: {
          findMany: jest.fn().mockResolvedValue([
            getTestBrowserSession({
              clients: [
                "343d2d9b-2cf5-4dd3-afd4-fed8890e965a",
                "dfa00361-05bb-4cfd-9e51-4d7542079930",
              ],
            }),
            getTestBrowserSession({
              clients: ["77c7554a-199f-4fce-bacb-835dc6d96a44"],
            }),
          ]),
        },
        consentSessionRepository: {
          findMany: jest.fn().mockResolvedValue([
            getTestConsentSession({
              clientId: "343d2d9b-2cf5-4dd3-afd4-fed8890e965a",
            }),
            getTestConsentSession({
              clientId: "dfa00361-05bb-4cfd-9e51-4d7542079930",
            }),
            getTestConsentSession({
              clientId: "77c7554a-199f-4fce-bacb-835dc6d96a44",
            }),
            getTestConsentSession({
              clientId: "68fc5e90-1259-49c0-acf9-542d039e4d09",
            }),
          ]),
        },
        refreshSessionRepository: {
          findMany: jest.fn().mockResolvedValue([
            getTestRefreshSession({
              clientId: "68fc5e90-1259-49c0-acf9-542d039e4d09",
            }),
          ]),
        },
      },
    };
  });

  test("should resolve", async () => {
    await expect(sessioninfoController(ctx)).resolves.toMatchSnapshot();
  });
});
