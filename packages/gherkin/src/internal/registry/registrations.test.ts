import { describe, expect, test } from "vitest";
import type { BindingRegistration } from "./registrations.js";
import { addRegistration, drainRegistrations } from "./registrations.js";

const registration = (className: string): BindingRegistration => ({
  className,
  parameterTypes: [],
  steps: [],
  target: class {},
});

describe("registrations", () => {
  test("should drain registrations in decoration order and clear the list", () => {
    addRegistration(registration("First"));
    addRegistration(registration("Second"));

    expect(drainRegistrations().map((entry) => entry.className)).toEqual([
      "First",
      "Second",
    ]);
    expect(drainRegistrations()).toEqual([]);
  });

  test("should only return registrations added since the previous drain", () => {
    addRegistration(registration("First"));
    drainRegistrations();

    addRegistration(registration("Second"));

    expect(drainRegistrations().map((entry) => entry.className)).toEqual(["Second"]);
  });
});
