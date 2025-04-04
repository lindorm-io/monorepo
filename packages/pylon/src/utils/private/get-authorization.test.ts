import { getAuthorization } from "./get-authorization";

describe("getAuthorization", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      get: jest.fn(),
    };

    ctx.get.mockReturnValue(null);
  });

  test("should return default authorization when no header is present", () => {
    expect(getAuthorization(ctx)).toEqual({
      type: "none",
      value: null,
    });
  });

  test("should return default authorization when header is not Basic or Bearer", () => {
    ctx.get.mockReturnValue("InvalidHeader");

    expect(getAuthorization(ctx)).toEqual({
      type: "none",
      value: null,
    });
  });

  test("should return default authorization when Basic authorization is empty", () => {
    ctx.get.mockReturnValue("Basic ");

    expect(getAuthorization(ctx)).toEqual({
      type: "none",
      value: null,
    });
  });

  test("should return default authorization when Bearer authorization is empty", () => {
    ctx.get.mockReturnValue("Bearer ");

    expect(getAuthorization(ctx)).toEqual({
      type: "none",
      value: null,
    });
  });

  test("should return Basic authorization", () => {
    ctx.get.mockReturnValue("Basic dXNlcm5hbWU6cGFzc3dvcmQ=");

    expect(getAuthorization(ctx)).toEqual({
      type: "basic",
      value: "dXNlcm5hbWU6cGFzc3dvcmQ=",
    });
  });

  test("should return Bearer authorization", () => {
    ctx.get.mockReturnValue("Bearer dXNlcm5hbWU6cGFzc3dvcmQ=");

    expect(getAuthorization(ctx)).toEqual({
      type: "bearer",
      value: "dXNlcm5hbWU6cGFzc3dvcmQ=",
    });
  });
});
