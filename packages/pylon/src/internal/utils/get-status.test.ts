import { getStatus } from "./get-status";

describe("getStatus", () => {
  test("should return status", () => {
    expect(getStatus({ status: 202 })).toEqual(202);
  });

  test("should return 201", () => {
    expect(getStatus({ location: "redirect" })).toEqual(201);
  });

  test("should return 308", () => {
    expect(getStatus({ body: {}, redirect: "redirect" })).toEqual(308);
  });

  test("should return 302", () => {
    expect(getStatus({ redirect: "redirect" })).toEqual(302);
  });

  test("should return 200 with body", () => {
    expect(getStatus({ body: {} })).toEqual(200);
  });

  test("should return 200 with file", () => {
    expect(getStatus({ file: {} as any })).toEqual(200);
  });

  test("should return 200 with stream", () => {
    expect(getStatus({ stream: {} as any })).toEqual(200);
  });

  test("should return 204", () => {
    expect(getStatus({})).toEqual(204);
  });
});
