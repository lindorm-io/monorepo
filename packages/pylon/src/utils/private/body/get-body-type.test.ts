import { getBodyType } from "./get-body-type";

describe("isBodyMimeType", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      is: jest.fn(),
    };
  });

  test("should return json if body is json", () => {
    ctx.is.mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual("json");
  });

  test("should return urlencoded if body is urlencoded", () => {
    ctx.is.mockReturnValueOnce(false).mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual("urlencoded");
  });

  test("should return text if body is text", () => {
    ctx.is
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual("text");
  });

  test("should return multipart if body is multipart", () => {
    ctx.is
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual("multipart");
  });

  test("should return unknown if body is unknown", () => {
    ctx.is.mockReturnValue(false);

    expect(getBodyType(ctx)).toEqual("unknown");
  });
});
