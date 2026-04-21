/** @jest-environment jsdom */
import React from "react";
import { renderHook } from "@testing-library/react";
import { ZephyrProvider } from "./ZephyrProvider.js";
import { useEvent } from "./useEvent.js";
import { createMockClient } from "./__fixtures__/mock-client.js";
import { describe, expect, test, vi } from "vitest";

const createWrapper = (client: any) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ZephyrProvider client={client}>{children}</ZephyrProvider>
  );
  return Wrapper;
};

describe("useEvent", () => {
  test("calls client.on with event name on mount", () => {
    const client = createMockClient();
    const handler = vi.fn();

    renderHook(() => useEvent("test:message", handler), {
      wrapper: createWrapper(client),
    });

    expect(client.on).toHaveBeenCalledWith("test:message", expect.any(Function));
  });

  test("calls client.off on unmount", () => {
    const client = createMockClient();
    const handler = vi.fn();

    const { unmount } = renderHook(() => useEvent("test:message", handler), {
      wrapper: createWrapper(client),
    });

    const listener = client.on.mock.calls[0][1];

    unmount();

    expect(client.off).toHaveBeenCalledWith("test:message", listener);
  });

  test("forwards data to the handler ref", () => {
    const client = createMockClient();
    const handler = vi.fn();

    renderHook(() => useEvent("test:message", handler), {
      wrapper: createWrapper(client),
    });

    const listener = client.on.mock.calls[0][1];
    listener({ payload: "hello" });

    expect(handler).toHaveBeenCalledWith({ payload: "hello" });
  });
});
