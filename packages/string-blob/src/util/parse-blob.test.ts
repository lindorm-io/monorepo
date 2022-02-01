import MockDate from "mockdate";
import { stringifyBlob } from "./stringify-blob";
import { parseBlob } from "./parse-blob";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("stringifyBlob", () => {
  test("should create a text blob with json and meta values", () => {
    const string = stringifyBlob({
      array: [
        true,
        new Date(),
        12345,
        "string",
        {
          array: [true, 123, "arr"],
          bool: false,
          date: new Date(),
          num: 123,
          str: "str",
        },
      ],
      boolean: true,
      date: new Date(),
      number: 12345,
      object: {
        a: "a",
        b: 1,
        c: null,
        d: true,
        e: [],
        f: undefined,
      },
      string: "string",
    });

    expect(parseBlob(string)).toMatchSnapshot();
  });

  test("should create blob with errors", () => {
    const blob = stringifyBlob({
      error: new Error("error"),
    });

    expect(parseBlob(blob)).toStrictEqual({
      error: expect.any(Error),
    });
  });
});
