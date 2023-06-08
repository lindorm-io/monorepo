import MockDate from "mockdate";
import { getEncryptionKey } from "./get-encryption-key";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getEncryptionKey", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      token: {
        bearerToken: {
          metadata: { subjectHint: "client" },
          subject: "75887260-62d5-4130-b56c-53aaa5d484c4",
        },
      },
    };
  });

  test("should resolve", async () => {
    expect(getEncryptionKey(ctx)).toBe(
      "Y2xpZW50Ojc1ODg3MjYwLTYyZDUtNDEzMC1iNTZjLTUzYWFhNWQ0ODRjNA==",
    );
  });
});
