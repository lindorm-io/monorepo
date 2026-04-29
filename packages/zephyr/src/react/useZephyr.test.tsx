/** @jest-environment jsdom */
import React from "react";
import { renderHook } from "@testing-library/react";
import { ZephyrProvider } from "./ZephyrProvider.js";
import { useZephyr } from "./useZephyr.js";
import { createMockClient } from "./__fixtures__/mock-client.js";
import { describe, expect, test } from "vitest";

const createWrapper = (client: any) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ZephyrProvider client={client}>{children}</ZephyrProvider>
  );
  return Wrapper;
};

describe("useZephyr", () => {
  test("returns the client from context", () => {
    const client = createMockClient();

    const { result } = renderHook(() => useZephyr(), {
      wrapper: createWrapper(client),
    });

    expect(result.current).toBe(client);
  });
});
