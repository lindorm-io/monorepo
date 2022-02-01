import { ClientError } from "@lindorm-io/errors";
import { useAssertion } from "./use-assertion";
import { includes } from "lodash";

describe("useAssertion", () => {
  let ctx: any;
  let next: any;

  beforeEach(() => {
    ctx = {
      data: { array: ["value"] },
      body: { key: "value" },
      entity: {
        key: "value",
      },
    };
    next = () => Promise.resolve();
  });

  test("should resolve with expectation in options", async () => {
    await expect(
      useAssertion({
        expect: "value",
        fromPath: {
          actual: "entity.key",
        },
      })(ctx, next),
    ).resolves.toBeUndefined();
  });

  test("should resolve with expectation in path", async () => {
    await expect(
      useAssertion({
        fromPath: {
          expect: "body.key",
          actual: "entity.key",
        },
      })(ctx, next),
    ).resolves.toBeUndefined();
  });

  test("should resolve with custom assertion", async () => {
    await expect(
      useAssertion({
        assertion: includes,
        fromPath: {
          expect: "data.array",
          actual: "entity.key",
        },
      })(ctx, next),
    ).resolves.toBeUndefined();
  });

  test("should reject when values differ", async () => {
    await expect(
      useAssertion({
        fromPath: {
          expect: "body.key",
          actual: "entity.wrong",
        },
      })(ctx, next),
    ).rejects.toThrow(ClientError);
  });
});
