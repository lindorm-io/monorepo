import { convertError } from "./convert-error";

describe("convertError", () => {
  test("should resolve a more limited AxiosRequestError", () => {
    const converted = convertError({
      config: {
        timeout: 0,
        url: "url",
        data: { data: true },
        headers: { headers: true },
        params: { params: true },
      },
      request: {
        host: "host",
        method: "method",
        path: "path",
        protocol: "protocol",
      },
      response: {
        data: {
          error: {
            message: "message",
            name: "name",
            details: "details",
            code: "code",
            data: { data: true },
            title: "title",
          },
        },
        headers: { headers: true },
        status: 500,
        statusText: "statusText",
      },
    } as any);

    expect(converted).toMatchSnapshot();
  });
});
