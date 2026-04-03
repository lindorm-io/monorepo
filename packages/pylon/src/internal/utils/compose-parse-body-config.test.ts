import { composeParseBodyConfig } from "./compose-parse-body-config";

describe("composeConfig", () => {
  test("should resolve default config", () => {
    expect(composeParseBodyConfig()).toEqual({
      formidable: false,
      formidableOptions: {},
      limits: {
        form: "1mb",
        json: "1mb",
        text: "1mb",
      },
      methods: ["POST", "PUT", "PATCH"],
      multipart: false,
    });
  });

  test("should resolve formidable and multipart as true", () => {
    expect(composeParseBodyConfig({ formidable: true })).toEqual(
      expect.objectContaining({
        formidable: true,
        multipart: true,
      }),
    );
  });

  test("should resolve formidable as true when formidable options are set", () => {
    expect(composeParseBodyConfig({ formidableOptions: {} })).toEqual(
      expect.objectContaining({
        formidable: true,
        multipart: true,
      }),
    );
  });

  test("should resolve multipart as true", () => {
    expect(composeParseBodyConfig({ multipart: true })).toEqual(
      expect.objectContaining({
        formidable: false,
        multipart: true,
      }),
    );
  });

  test("should resolve json limit", () => {
    expect(composeParseBodyConfig({ limits: { json: "2mb" } })).toEqual(
      expect.objectContaining({
        limits: expect.objectContaining({ json: "2mb" }),
      }),
    );
  });
});
