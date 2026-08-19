import { beforeEach, describe, expect, test } from "vitest";
import { capture, errorShape } from "../__fixtures__/test-helpers.js";
import { GherkinError } from "../errors/GherkinError.js";
import {
  drainContextRegistrations,
  drainRegistrations,
} from "../internal/registry/registrations.js";
import { AbstractSteps } from "./AbstractSteps.js";
import { Binding } from "./Binding.js";
import { Context } from "./Context.js";
import { Given } from "./Given.js";

// Decorators apply bottom-up, so the BOTTOM decorator brands first and the
// TOP one finds the conflict — every pairing direction is reachable.
describe("conflicting decorators", () => {
  beforeEach(() => {
    drainRegistrations();
    drainContextRegistrations();
  });

  test("should refuse @Binding on a @Context-branded class", () => {
    const error = capture(() => {
      @Binding()
      @Context()
      class Both {}
      return Both;
    });

    expect(error).toEqual(expect.any(GherkinError));
    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "Context",
      decorator: "Binding",
    });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should refuse @Context on a @Binding-branded class", () => {
    const error = capture(() => {
      @Context()
      @Binding()
      class Both {}
      return Both;
    });

    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "Binding",
      decorator: "Context",
    });
  });

  test("should refuse @Binding on an @AbstractSteps-branded class", () => {
    const error = capture(() => {
      @Binding()
      @AbstractSteps()
      class Both {}
      return Both;
    });

    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "AbstractSteps",
      decorator: "Binding",
    });
  });

  test("should refuse @Context on a @Binding-branded class — before blaming its staged steps", () => {
    // The conflict must outrank context_declares_behaviour: the staged step is
    // legitimate for @Binding, so context_declares_behaviour's "move the member
    // to a @Binding class" advice would misname the fix on a class that
    // already IS @Binding.
    const error = capture(() => {
      @Context()
      @Binding()
      class Both {
        @Given("a step")
        step(): void {}
      }
      return Both;
    });

    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "Binding",
      decorator: "Context",
    });
  });

  test("should refuse @AbstractSteps on a @Binding-branded class — before blaming its staged steps", () => {
    // The conflict must outrank abstract_base_declares_behaviour: the staged
    // step is legitimate for @Binding, so blaming it would misname the fix.
    const error = capture(() => {
      @AbstractSteps()
      @Binding()
      class Both {
        @Given("a step")
        step(): void {}
      }
      return Both;
    });

    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "Binding",
      decorator: "AbstractSteps",
    });
  });

  test("should refuse @Context on an @AbstractSteps-branded class", () => {
    const error = capture(() => {
      @Context()
      @AbstractSteps()
      class Both {}
      return Both;
    });

    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "AbstractSteps",
      decorator: "Context",
    });
  });

  test("should refuse @AbstractSteps on a @Context-branded class", () => {
    const error = capture(() => {
      @AbstractSteps()
      @Context()
      class Both {}
      return Both;
    });

    expect(error.code).toEqual("conflicting_decorators");
    expect(error.data).toEqual({
      className: "Both",
      conflicting: "Context",
      decorator: "AbstractSteps",
    });
  });
});
