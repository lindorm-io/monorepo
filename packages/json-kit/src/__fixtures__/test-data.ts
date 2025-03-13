export const TEST_DICT = {
  one: [
    true,
    new Date("2020-01-01T08:00:00.000Z"),
    12345,
    "string",
    {
      thirteen: [true, 123, "arr", null, undefined],
      fourteen: false,
      fifteen: new Date("2020-01-01T08:00:00.000Z"),
      sixteen: 123,
      seventeen: "str",
    },
  ],
  two: true,
  three: new Date("2020-01-01T08:00:00.000Z"),
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
  thirteen: Buffer.from("hello"),
};

export const TEST_DICT_STRING = `{"__meta__":{"one":["B","D","N","S",{"thirteen":["B","N","S","L","U"],"fourteen":"B","fifteen":"D","sixteen":"N","seventeen":"S"}],"two":"B","three":"D","four":"N","five":{"six":"S","seven":"N","eight":"L","nine":"B","ten":[],"eleven":"U"},"twelve":"S","thirteen":"F"},"__record__":{"one":["true","2020-01-01T08:00:00.000Z","12345","string",{"thirteen":["true","123","arr",0,0],"fourteen":"false","fifteen":"2020-01-01T08:00:00.000Z","sixteen":"123","seventeen":"str"}],"two":"true","three":"2020-01-01T08:00:00.000Z","four":"12345","five":{"six":"a","seven":"1","eight":0,"nine":"true","ten":[],"eleven":0},"twelve":"string","thirteen":"aGVsbG8"}}`;

export const TEST_ARRAY = [TEST_DICT, TEST_DICT];

export const TEST_ARRAY_STRING = `{"__meta__":[{"one":["B","D","N","S",{"thirteen":["B","N","S","L","U"],"fourteen":"B","fifteen":"D","sixteen":"N","seventeen":"S"}],"two":"B","three":"D","four":"N","five":{"six":"S","seven":"N","eight":"L","nine":"B","ten":[],"eleven":"U"},"twelve":"S","thirteen":"F"},{"one":["B","D","N","S",{"thirteen":["B","N","S","L","U"],"fourteen":"B","fifteen":"D","sixteen":"N","seventeen":"S"}],"two":"B","three":"D","four":"N","five":{"six":"S","seven":"N","eight":"L","nine":"B","ten":[],"eleven":"U"},"twelve":"S","thirteen":"F"}],"__array__":[{"one":["true","2020-01-01T08:00:00.000Z","12345","string",{"thirteen":["true","123","arr",0,0],"fourteen":"false","fifteen":"2020-01-01T08:00:00.000Z","sixteen":"123","seventeen":"str"}],"two":"true","three":"2020-01-01T08:00:00.000Z","four":"12345","five":{"six":"a","seven":"1","eight":0,"nine":"true","ten":[],"eleven":0},"twelve":"string","thirteen":"aGVsbG8"},{"one":["true","2020-01-01T08:00:00.000Z","12345","string",{"thirteen":["true","123","arr",0,0],"fourteen":"false","fifteen":"2020-01-01T08:00:00.000Z","sixteen":"123","seventeen":"str"}],"two":"true","three":"2020-01-01T08:00:00.000Z","four":"12345","five":{"six":"a","seven":"1","eight":0,"nine":"true","ten":[],"eleven":0},"twelve":"string","thirteen":"aGVsbG8"}]}`;
