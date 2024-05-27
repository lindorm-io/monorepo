import { BodyType } from "../../../enums";
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

    expect(getBodyType(ctx)).toEqual(BodyType.Json);
  });

  test("should return urlencoded if body is urlencoded", () => {
    ctx.is.mockReturnValueOnce(false).mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual(BodyType.UrlEncoded);
  });

  test("should return text if body is text", () => {
    ctx.is
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual(BodyType.Text);
  });

  test("should return multipart if body is multipart", () => {
    ctx.is
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    expect(getBodyType(ctx)).toEqual(BodyType.Multipart);
  });

  test("should return unknown if body is unknown", () => {
    ctx.is.mockReturnValue(false);

    expect(getBodyType(ctx)).toEqual(BodyType.Unknown);
  });
});
