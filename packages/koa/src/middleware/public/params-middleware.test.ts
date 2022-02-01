import MockDate from "mockdate";
import { paramsMiddleware } from "./params-middleware";

MockDate.set("2020-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("paramsMiddleware", () => {
  const array = ["array"];
  const date = new Date("2020-01-01T08:00:00.000Z");
  const error = new Error("error");
  const string = "string";

  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        PascalCaseOne: "PascalCaseOne",
        camelCaseOne: "camelCaseOne",
        snake_case_one: "snake_case_one",
        array,
        date,
        error,
        string,
      },
      params: {
        PascalCaseThree: "PascalCaseThree",
        camelCaseThree: "camelCaseThree",
        snake_case_three: "snake_case_three",
        number: 123456,
        string: "string",
        paramUri: encodeURIComponent("https://test.lindorm.io/route/path"),
        paramWithSpaces: encodeURI("param with spaces"),
      },
    };
  });

  test("should transform and merge all incoming data into one object on context", async () => {
    await expect(paramsMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.data).toStrictEqual({
      PascalCaseOne: "PascalCaseOne",
      array,
      camelCaseOne: "camelCaseOne",
      camelCaseThree: "camelCaseThree",
      date,
      error,
      number: "123456",
      paramUri: "https://test.lindorm.io/route/path",
      paramWithSpaces: "param with spaces",
      pascalCaseThree: "PascalCaseThree",
      snakeCaseThree: "snake_case_three",
      snake_case_one: "snake_case_one",
      string,
    });
  });

  test("should not fail if data is undefined", async () => {
    ctx = { params: undefined, data: undefined };

    await expect(paramsMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.data).toStrictEqual({});
  });
});
