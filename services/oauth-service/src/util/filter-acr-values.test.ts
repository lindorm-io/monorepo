import { AuthenticationMethod, AuthenticationStrategy } from "@lindorm-io/common-types";
import { filterAcrValues } from "./filter-acr-values";

describe("filterAcrValues", () => {
  test("should resolve all desired values", () => {
    expect(
      filterAcrValues({
        acrString: "LOA_3 session email phone email_code",
        amrString: "email",
        acrArray: ["loa_3"],
        amrArray: ["email", "phone", "session_link", "rdc_qr_code"],
      }),
    ).toStrictEqual({
      levelOfAssurance: 3,
      methods: expect.arrayContaining([
        AuthenticationMethod.EMAIL,
        AuthenticationMethod.PHONE,
        AuthenticationMethod.SESSION_LINK,
      ]),
      strategies: expect.arrayContaining([
        AuthenticationStrategy.EMAIL_CODE,
        AuthenticationStrategy.RDC_QR_CODE,
      ]),
    });
  });

  test("should skip level of assurance", () => {
    expect(
      filterAcrValues({
        acrString: "email phone",
      }),
    ).toStrictEqual({
      levelOfAssurance: 0,
      methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      strategies: [],
    });
  });

  test("should resolve the highest desired level of assurance", () => {
    expect(
      filterAcrValues({
        acrString: "LOA_3 2 LOA_1 LOA_2 1 LOA_4 3",
      }),
    ).toStrictEqual({
      levelOfAssurance: 4,
      methods: [],
      strategies: [],
    });
  });

  test("should filter out duplicates from methods", () => {
    expect(
      filterAcrValues({
        amrString: "email email phone phone email_otp email_otp",
      }),
    ).toStrictEqual({
      levelOfAssurance: 0,
      methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      strategies: [AuthenticationStrategy.EMAIL_OTP],
    });
  });

  test("should resolve with arrays", () => {
    expect(
      filterAcrValues({
        acrArray: ["loa_4"],
        amrArray: ["email", "phone"],
      }),
    ).toStrictEqual({
      levelOfAssurance: 4,
      methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
      strategies: [],
    });
  });

  test("should resolve with no options object", () => {
    expect(filterAcrValues()).toStrictEqual({
      levelOfAssurance: 0,
      methods: [],
      strategies: [],
    });
  });
});
