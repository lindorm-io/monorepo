import { globalHermesMetadata } from "../utils/private";
import { Event } from "./Event";

describe("Event Decorator", () => {
  test("should add metadata", () => {
    @Event()
    class TestEvent {}

    expect(globalHermesMetadata.getEvent(TestEvent)).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @Event({ name: "custom_event", version: 99 })
    class TestEventOptions {}

    expect(globalHermesMetadata.getEvent(TestEventOptions)).toMatchSnapshot();
  });
});
