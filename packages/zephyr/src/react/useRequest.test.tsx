/** @jest-environment jsdom */
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { ZephyrProvider } from "./ZephyrProvider";
import { useRequest } from "./useRequest";
import { ZephyrError } from "../errors/ZephyrError";
import { createMockClient } from "./__fixtures__/mock-client";

const createWrapper = (client: any) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ZephyrProvider client={client}>{children}</ZephyrProvider>
  );
  return Wrapper;
};

describe("useRequest", () => {
  test("fires request on mount and sets data", async () => {
    const client = createMockClient();
    const responseData = { foo: "bar" };
    client.request.mockResolvedValue(responseData);

    const { result } = renderHook(() => useRequest("test:event", { id: 1 }), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(client.request).toHaveBeenCalledWith(
      "test:event",
      { id: 1 },
      { timeout: undefined },
    );
    expect(result.current.data).toBe(responseData);
    expect(result.current.error).toBeUndefined();
  });

  test("sets loading true then false", async () => {
    const client = createMockClient();
    let resolveRequest!: (value: unknown) => void;
    client.request.mockReturnValue(
      new Promise((r) => {
        resolveRequest = r;
      }),
    );

    const { result } = renderHook(() => useRequest("test:event"), {
      wrapper: createWrapper(client),
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveRequest({ done: true });
    });

    expect(result.current.loading).toBe(false);
  });

  test("sets error on rejection", async () => {
    const client = createMockClient();
    const error = new ZephyrError("request failed");
    client.request.mockRejectedValue(error);

    const { result } = renderHook(() => useRequest("test:event"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(error);
    expect(result.current.data).toBeUndefined();
  });

  test("does not fire when enabled is false", async () => {
    const client = createMockClient();

    const { result } = renderHook(
      () => useRequest("test:event", undefined, { enabled: false }),
      { wrapper: createWrapper(client) },
    );

    expect(result.current.loading).toBe(false);
    expect(client.request).not.toHaveBeenCalled();
  });

  test("refetch re-fires the request", async () => {
    const client = createMockClient();
    client.request
      .mockResolvedValueOnce({ first: true })
      .mockResolvedValueOnce({ second: true });

    const { result } = renderHook(() => useRequest("test:event"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ first: true });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual({ second: true });
    expect(client.request).toHaveBeenCalledTimes(2);
  });
});
