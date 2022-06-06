import { createTestAddress } from "../fixtures/entity";
import { getAddress } from "./get-address";

describe("getAddress", () => {
  test("should resolve full openid formatted address", () => {
    expect(getAddress(createTestAddress())).toStrictEqual({
      careOf: "Gustav Torsson",
      country: "Sweden",
      formatted: "Long Street Name 12\nSecond Row\n12345 Stockholm\nStockholm\nSweden",
      locality: "Stockholm",
      postalCode: "12345",
      region: "Stockholm",
      streetAddress: "Long Street Name 12\nSecond Row",
    });
  });

  test("should resolve partial openid format", () => {
    expect(
      getAddress(
        createTestAddress({
          careOf: null,
          country: "country",
          locality: null,
          postalCode: "postalCode",
          region: null,
          streetAddress: ["street 1"],
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
