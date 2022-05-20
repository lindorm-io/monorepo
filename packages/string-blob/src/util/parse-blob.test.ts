import MockDate from "mockdate";
import { stringifyBlob } from "./stringify-blob";
import { parseBlob } from "./parse-blob";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("stringifyBlob", () => {
  test("should create a text blob with json and meta values", () => {
    const blobObject: any = {
      foo: [
        true,
        new Date(),
        12345,
        "string",
        {
          ipsum: [true, 123, "arr", null, undefined],
          dolor: false,
          sit: new Date(),
          amet: 123,
          consectetur: "str",
        },
      ],
      bar: true,
      baz: new Date(),
      qux: 12345,
      fred: {
        adipiscing: "a",
        elit: 1,
        sed: null,
        do: true,
        eiusmod: [],
        tempor: undefined,
      },
      thud: "string",
    };

    const string = stringifyBlob(blobObject);

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
