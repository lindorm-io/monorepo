import { createMockLogger } from "@lindorm/logger";
import { createTestEvent } from "../__fixtures__/create-message";
import { createTestViewIdentifier } from "../__fixtures__/create-test-view-identifier";
import { TestEventCreate } from "../__fixtures__/modules/events/TestEventCreate";
import { ViewDestroyedError } from "../errors";
import { ViewModelOptions } from "../types";
import { ViewModel } from "./ViewModel";

describe("ViewModel", () => {
  const std: ViewModelOptions = {
    ...createTestViewIdentifier(),
    logger: createMockLogger(),
  };

  let view: ViewModel;

  beforeEach(() => {
    view = new ViewModel(std);
  });

  test("should construct", () => {
    expect(() => new ViewModel(std)).not.toThrow();
  });

  test("should return json object", async () => {
    expect(view.toJSON()).toEqual({
      id: expect.any(String),
      name: "test_mongo_view",
      namespace: "hermes",
      destroyed: false,
      meta: {},
      processedCausationIds: [],
      revision: 0,
      state: {},
    });
  });

  test("should get state", () => {
    view = new ViewModel({
      ...std,
      state: { test: true },
    });

    expect(view.state).toEqual({ test: true });
    expect(view.meta).toEqual({});
  });

  test("should destroy", () => {
    const event = createTestEvent(new TestEventCreate("create"));

    expect(() => view.destroy(event)).not.toThrow();

    expect(view.destroyed).toEqual(true);
  });

  test("should merge state", () => {
    const event = createTestEvent(new TestEventCreate("create"));

    expect(() => view.mergeState(event, { merge: "mergeState" })).not.toThrow();

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
    const event = createTestEvent(new TestEventCreate("create"));
    expect(() => view.setState(event, { setState: true })).not.toThrow();

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
    const event = createTestEvent(new TestEventCreate("create"));

    view = new ViewModel({
      ...std,
      destroyed: true,
    });

    expect(() => view.destroy(event)).toThrow(ViewDestroyedError);
  });

  test("should throw on merge state when destroyed", () => {
    const event = createTestEvent(new TestEventCreate("create"));

    view = new ViewModel({
      ...std,
      destroyed: true,
    });

    expect(() => view.mergeState(event, { setState: true })).toThrow(ViewDestroyedError);
  });

  test("should throw on set state when destroyed", () => {
    const event = createTestEvent(new TestEventCreate("create"));

    view = new ViewModel({
      ...std,
      destroyed: true,
    });

    expect(() => view.setState(event, { setState: true })).toThrow(ViewDestroyedError);
  });
});
