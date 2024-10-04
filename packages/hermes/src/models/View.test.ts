import { TEST_HERMES_EVENT } from "../__fixtures__/hermes-event";
import { TEST_VIEW_OPTIONS } from "../__fixtures__/view";
import { ViewDestroyedError } from "../errors";
import { HermesEvent } from "../messages";
import { View } from "./View";

describe("View", () => {
  const hermesEvent = new HermesEvent(TEST_HERMES_EVENT);

  let view: View;

  beforeEach(() => {
    view = new View(TEST_VIEW_OPTIONS);
  });

  test("should construct", () => {
    expect(() => new View(TEST_VIEW_OPTIONS)).not.toThrow();
  });

  test("should return json object", async () => {
    expect(view.toJSON()).toEqual({
      id: expect.any(String),
      name: "name",
      context: "default",
      destroyed: false,
      hash: expect.any(String),
      meta: {},
      processedCausationIds: [],
      revision: 0,
      state: {},
    });
  });

  test("should get state", () => {
    view = new View({
      ...TEST_VIEW_OPTIONS,
      state: { test: true },
    });

    expect(view.state).toEqual({ test: true });
    expect(view.meta).toEqual({});
  });

  test("should destroy", () => {
    expect(() => view.destroy(hermesEvent)).not.toThrow();

    expect(view.destroyed).toEqual(true);
  });

  test("should merge state", () => {
    expect(() => view.mergeState(hermesEvent, { merge: "mergeState" })).not.toThrow();

    expect(view.state).toEqual({ merge: "mergeState" });
    expect(view.meta).toEqual({
      merge: {
        destroyed: false,
        timestamp: expect.any(Date),
        value: "mergeState",
      },
    });
  });

  test("should set state", () => {
    expect(() => view.setState(hermesEvent, { setState: true })).not.toThrow();

    expect(view.state).toEqual({ setState: true });
    expect(view.meta).toEqual({
      setState: {
        destroyed: false,
        timestamp: expect.any(Date),
        value: true,
      },
    });
  });

  test("should throw on destroy when destroyed", () => {
    view = new View({
      ...TEST_VIEW_OPTIONS,
      destroyed: true,
    });

    expect(() => view.destroy(hermesEvent)).toThrow(ViewDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    view = new View({
      ...TEST_VIEW_OPTIONS,
      destroyed: true,
    });

    expect(() => view.mergeState(hermesEvent, { setState: true })).toThrow(
      ViewDestroyedError,
    );
  });

  test("should throw on set state when destroyed", () => {
    view = new View({
      ...TEST_VIEW_OPTIONS,
      destroyed: true,
    });

    expect(() => view.setState(hermesEvent, { setState: true })).toThrow(
      ViewDestroyedError,
    );
  });
});
