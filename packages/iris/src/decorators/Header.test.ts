import { Header } from "./Header";
import { describe, expect, it } from "vitest";

describe("Header", () => {
  it("should stage header with explicit name", () => {
    class TestMsg {
      @Header("x-user-id")
      userId!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.headers).toMatchSnapshot();
  });

  it("should stage header using field name as default", () => {
    class TestMsg {
      @Header()
      traceId!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.headers).toHaveLength(1);
    expect(metadata.headers[0].key).toBe("traceId");
    expect(metadata.headers[0].headerName).toBe("traceId");
  });

  it("should accumulate multiple headers", () => {
    class TestMsg {
      @Header("x-user-id")
      userId!: string;

      @Header("x-trace-id")
      traceId!: string;
    }

    const metadata = (TestMsg as any)[Symbol.metadata];
    expect(metadata.headers).toHaveLength(2);
    expect(metadata.headers).toMatchSnapshot();
  });
});
