import { describe, expect, it } from "vitest";
import { resolveBroadcastDestination } from "./resolve-broadcast-destination.js";

describe("resolveBroadcastDestination", () => {
  it("should return the base unchanged for a non-broadcast envelope", () => {
    expect(resolveBroadcastDestination("iris.orders", false, ".")).toBe("iris.orders");
    expect(resolveBroadcastDestination("iris:orders", false, ":")).toBe("iris:orders");
  });

  it("should append the broadcast suffix with the given separator", () => {
    expect(resolveBroadcastDestination("iris.orders", true, ".")).toBe(
      "iris.orders.broadcast",
    );
    expect(resolveBroadcastDestination("iris:orders", true, ":")).toBe(
      "iris:orders:broadcast",
    );
  });
});
