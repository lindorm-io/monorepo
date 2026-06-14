import { describe, expect, test } from "vitest";
import { eventsShape } from "./events-shape.js";

describe("eventsShape", () => {
  test("passes when events is absent", () => {
    expect(eventsShape({})).toEqual([]);
  });

  test("passes for a URL event type with an empty payload", () => {
    expect(
      eventsShape({
        events: { "http://schemas.openid.net/event/backchannel-logout": {} },
      }),
    ).toEqual([]);
  });

  test("passes for a URN event type", () => {
    expect(eventsShape({ events: { "urn:lindorm:event:rtbf": { id: "x" } } })).toEqual(
      [],
    );
  });

  test("fails when events is not an object", () => {
    expect(eventsShape({ events: "x" })).toMatchSnapshot();
  });

  test("fails when events is empty", () => {
    expect(eventsShape({ events: {} })).toMatchSnapshot();
  });

  test("fails for a non-URI key and a non-object payload", () => {
    expect(eventsShape({ events: { "not a uri": "scalar" } })).toMatchSnapshot();
  });
});
