/** @jest-environment jsdom */
import React from "react";
import { renderHook } from "@testing-library/react";
import { ZephyrProvider, useZephyrContext } from "./ZephyrProvider";
import { createMockClient } from "./__fixtures__/mock-client";
import { describe, expect, test, vi } from "vitest";

const createWrapper = (client: any) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <ZephyrProvider client={client}>{children}</ZephyrProvider>
  );
  return Wrapper;
};

describe("ZephyrProvider", () => {
  test("renders children and provides context", () => {
    const client = createMockClient();

    const { result } = renderHook(() => useZephyrContext(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.client).toBe(client);
  });

  test("throws when useZephyrContext is used outside provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useZephyrContext());
    }).toThrow("useZephyr must be used within a ZephyrProvider");

    vi.restoreAllMocks();
  });
});
