/** @jest-environment jsdom */
import React from "react";
import { renderHook } from "@testing-library/react";
import { ZephyrProvider } from "./ZephyrProvider";
import { useRoom } from "./useRoom";
import { createMockClient } from "./__fixtures__/mock-client";

const createWrapper = (client: any) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ZephyrProvider client={client}>{children}</ZephyrProvider>
  );
  return Wrapper;
};

describe("useRoom", () => {
  test("calls client.room with name", () => {
    const client = createMockClient();

    renderHook(() => useRoom("chat-room"), {
      wrapper: createWrapper(client),
    });

    expect(client.room).toHaveBeenCalledWith("chat-room");
  });

  test("calls room.join on mount", () => {
    const client = createMockClient();

    renderHook(() => useRoom("chat-room"), {
      wrapper: createWrapper(client),
    });

    const room = client.room.mock.results[0].value;
    expect(room.join).toHaveBeenCalled();
  });

  test("calls room.leave on unmount", () => {
    const client = createMockClient();

    const { unmount } = renderHook(() => useRoom("chat-room"), {
      wrapper: createWrapper(client),
    });

    const room = client.room.mock.results[0].value;

    unmount();

    expect(room.leave).toHaveBeenCalled();
  });

  test("returns the room instance", () => {
    const client = createMockClient();

    const { result } = renderHook(() => useRoom("chat-room"), {
      wrapper: createWrapper(client),
    });

    const room = client.room.mock.results[0].value;
    expect(result.current).toBe(room);
  });
});
