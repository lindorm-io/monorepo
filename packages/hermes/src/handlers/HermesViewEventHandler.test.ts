import { MAX_VIEW_LENGTH } from "../constants/private";
import { ViewStoreType } from "../enums";
import { HermesViewEventHandler } from "./HermesViewEventHandler";

describe("HermesViewEventHandler", () => {
  test("should construct", () => {
    expect(
      () =>
        new HermesViewEventHandler<any>({
          eventName: "greeting_updated",
          adapter: { type: ViewStoreType.Redis },
          aggregate: { name: "test_aggregate", context: "hermes_test" },
          conditions: { created: true },
          view: {
            name: "#",
            context: "#",
          },
          getViewId: (event) => event.aggregate.id,
          handler: async () => {},
        }),
    ).not.toThrow();
  });

  test("should throw error if view name exceeds maximum length", () => {
    expect(
      () =>
        new HermesViewEventHandler<any>({
          eventName: "greeting_updated",
          adapter: { type: ViewStoreType.Redis },
          aggregate: { name: "test_aggregate", context: "hermes_test" },
          conditions: { created: true },
          view: {
            name: "#".repeat(MAX_VIEW_LENGTH),
            context: "#",
          },
          getViewId: (event) => event.aggregate.id,
          handler: async () => {},
        }),
    ).toThrow();
  });

  test("should throw error if view context exceeds maximum length", () => {
    expect(
      () =>
        new HermesViewEventHandler<any>({
          eventName: "greeting_updated",
          adapter: { type: ViewStoreType.Redis },
          aggregate: { name: "test_aggregate", context: "hermes_integration" },
          conditions: { created: true },
          view: {
            name: "#",
            context: "#".repeat(MAX_VIEW_LENGTH),
          },
          getViewId: (event) => event.aggregate.id,
          handler: async () => {},
        }),
    ).toThrow();
  });
});
