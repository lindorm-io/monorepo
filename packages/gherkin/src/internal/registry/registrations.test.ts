import { describe, expect, test } from "vitest";
import type { BindingRegistration, ContextRegistration } from "./registrations.js";
import {
  addContextRegistration,
  addRegistration,
  drainContextRegistrations,
  drainRegistrations,
} from "./registrations.js";

const registration = (className: string): BindingRegistration => ({
  className,
  hooks: [],
  injects: [],
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

  test("should drain context registrations independently of binding registrations", () => {
    const context = (className: string): ContextRegistration => ({
      className,
      injects: [],
      target: class {},
    });

    addRegistration(registration("Binding"));
    addContextRegistration(context("FirstContext"));
    addContextRegistration(context("SecondContext"));

    expect(drainContextRegistrations().map((entry) => entry.className)).toEqual([
      "FirstContext",
      "SecondContext",
    ]);
    expect(drainContextRegistrations()).toEqual([]);
    // The binding list is untouched by the context drain.
    expect(drainRegistrations().map((entry) => entry.className)).toEqual(["Binding"]);
  });
});
