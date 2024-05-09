import MockDate from "mockdate";
import { JsonKit } from "./json-kit";

MockDate.set("2020-01-01T08:00:00.000Z");

describe("JsonKit", () => {
  const dict: any = {
    one: [
      true,
      new Date(),
      12345,
      "string",
      {
        thirteen: [true, 123, "arr", null, undefined],
        fourteen: false,
        fifteen: new Date(),
        sixteen: 123,
        seventeen: "str",
      },
    ],
    two: true,
    three: new Date(),
    four: 12345,
    five: {
      six: "a",
      seven: 1,
      eight: null,
      nine: true,
      ten: [],
      eleven: undefined,
    },
    twelve: "string",
  };

  const string = `{"json":{"one":["true","2020-01-01T08:00:00.000Z","12345","string",{"thirteen":["true","123","arr",0,0],"fourteen":"false","fifteen":"2020-01-01T08:00:00.000Z","sixteen":"123","seventeen":"str"}],"two":"true","three":"2020-01-01T08:00:00.000Z","four":"12345","five":{"six":"a","seven":"1","eight":0,"nine":"true","ten":[],"eleven":0},"twelve":"string"},"meta":{"one":["B","D","N","S",{"thirteen":["B","N","S","L","U"],"fourteen":"B","fifteen":"D","sixteen":"N","seventeen":"S"}],"two":"B","three":"D","four":"N","five":{"six":"S","seven":"N","eight":"L","nine":"B","ten":[],"eleven":"U"},"twelve":"S"}}`;

  test("should create a text meta struct with json and meta values", () => {
    expect(JsonKit.stringify(dict)).toMatchSnapshot();
  });

  test("should parse a text meta struct with json and meta values", () => {
    expect(JsonKit.parse(string)).toMatchSnapshot();
  });
});
