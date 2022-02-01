import { getAddress } from "./get-address";
import { Identity } from "../entity";

describe("getAddress", () => {
  test("should resolve full openid formatted address", () => {
    expect(
      getAddress(
        new Identity({
          address: {
            careOf: "careOf",
            country: "country",
            locality: "locality",
            postalCode: "postalCode",
            region: "region",
            streetAddress: ["street 1", "street 2"],
          },
        }),
      ),
    ).toStrictEqual({
      careOf: "careOf",
      country: "country",
      formatted: "street 1\nstreet 2\npostalCode locality\nregion\ncountry",
      locality: "locality",
      postalCode: "postalCode",
      region: "region",
      streetAddress: "street 1\nstreet 2",
    });
  });

  test("should resolve partial openid format", () => {
    expect(
      getAddress(
        new Identity({
          address: {
            careOf: null,
            country: "country",
            locality: null,
            postalCode: "postalCode",
            region: null,
            streetAddress: ["street 1"],
          },
        }),
      ),
    ).toStrictEqual({
      careOf: null,
      country: "country",
      formatted: "street 1\npostalCode\ncountry",
      locality: null,
      postalCode: "postalCode",
      region: null,
      streetAddress: "street 1",
    });
  });
});
