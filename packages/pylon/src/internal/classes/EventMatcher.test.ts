import { EventMatcher, EventSegment } from "./EventMatcher";

const literal = (value: string): EventSegment => ({ type: "literal", value });
const param = (value: string): EventSegment => ({ type: "param", value });
const catchAll = (value: string): EventSegment => ({ type: "catchAll", value });

describe("EventMatcher", () => {
  describe("literal matching", () => {
    it("should match a static event", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), literal("message")], "handler1");

      expect(matcher.match("chat:message")).toMatchSnapshot();
    });

    it("should not match a different event", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), literal("message")], "handler1");

      expect(matcher.match("chat:other")).toBeNull();
    });

    it("should not match a partial event", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), literal("message")], "handler1");

      expect(matcher.match("chat")).toBeNull();
    });

    it("should not match a longer event", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), literal("message")], "handler1");

      expect(matcher.match("chat:message:extra")).toBeNull();
    });
  });

  describe("param matching", () => {
    it("should match a single param", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("rooms"), param("roomId"), literal("join")], "handler1");

      expect(matcher.match("rooms:lobby:join")).toMatchSnapshot();
    });

    it("should match multiple params", () => {
      const matcher = new EventMatcher<string>();
      matcher.add(
        [literal("users"), param("userId"), literal("posts"), param("postId")],
        "handler1",
      );

      expect(matcher.match("users:abc:posts:123")).toMatchSnapshot();
    });

    it("should not match when trailing segments are missing", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("rooms"), param("roomId"), literal("join")], "handler1");

      expect(matcher.match("rooms:lobby")).toBeNull();
    });
  });

  describe("catch-all matching", () => {
    it("should match and capture all remaining segments", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("proxy"), catchAll("path")], "handler1");

      expect(matcher.match("proxy:a:b:c")).toMatchSnapshot();
    });

    it("should match a single remaining segment", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("proxy"), catchAll("path")], "handler1");

      expect(matcher.match("proxy:x")).toMatchSnapshot();
    });

    it("should match any event when pattern is only a catch-all", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([catchAll("event")], "handler1");

      expect(matcher.match("anything:at:all")).toMatchSnapshot();
    });
  });

  describe("priority", () => {
    it("should prefer literal over param", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), param("room")], "paramHandler");
      matcher.add([literal("chat"), literal("admin")], "literalHandler");

      expect(matcher.match("chat:admin")).toMatchSnapshot();
    });

    it("should prefer param over catch-all", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), catchAll("rest")], "catchAllHandler");
      matcher.add([literal("chat"), param("room"), literal("msg")], "paramHandler");

      expect(matcher.match("chat:lobby:msg")).toMatchSnapshot();
    });

    it("should fall back to catch-all when param path does not match", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), param("room"), literal("msg")], "paramHandler");
      matcher.add([literal("chat"), catchAll("rest")], "catchAllHandler");

      expect(matcher.match("chat:lobby:other")).toMatchSnapshot();
    });
  });

  describe("empty and edge cases", () => {
    it("should return null for empty event", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat")], "handler1");

      expect(matcher.match("")).toBeNull();
    });

    it("should return null when no patterns are registered", () => {
      const matcher = new EventMatcher<string>();

      expect(matcher.match("chat:message")).toBeNull();
    });
  });

  describe("multiple handlers", () => {
    it("should return all handlers registered at the same pattern", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("chat"), literal("message")], "handler1");
      matcher.add([literal("chat"), literal("message")], "handler2");

      expect(matcher.match("chat:message")).toMatchSnapshot();
    });

    it("should return all handlers for a catch-all pattern", () => {
      const matcher = new EventMatcher<string>();
      matcher.add([literal("proxy"), catchAll("path")], "handler1");
      matcher.add([literal("proxy"), catchAll("path")], "handler2");

      expect(matcher.match("proxy:a:b")).toMatchSnapshot();
    });
  });

  describe("hasParams", () => {
    it("should return false for all-literal segments", () => {
      const matcher = new EventMatcher<string>();

      expect(matcher.hasParams([literal("chat"), literal("message")])).toBe(false);
    });

    it("should return true when segments contain a param", () => {
      const matcher = new EventMatcher<string>();

      expect(matcher.hasParams([literal("rooms"), param("roomId")])).toBe(true);
    });

    it("should return true when segments contain a catch-all", () => {
      const matcher = new EventMatcher<string>();

      expect(matcher.hasParams([literal("proxy"), catchAll("path")])).toBe(true);
    });
  });

  describe("parseSegments", () => {
    it("should convert scanner segments correctly", () => {
      const scannerSegments = [
        {
          raw: "rooms",
          path: "rooms",
          isParam: false,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          paramName: null,
        },
        {
          raw: "[roomId]",
          path: ":roomId",
          isParam: true,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          paramName: "roomId",
        },
        {
          raw: "join",
          path: "join",
          isParam: false,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          paramName: null,
        },
      ];

      expect(EventMatcher.parseSegments(scannerSegments)).toMatchSnapshot();
    });

    it("should convert catch-all segments", () => {
      const scannerSegments = [
        {
          raw: "proxy",
          path: "proxy",
          isParam: false,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          paramName: null,
        },
        {
          raw: "[...path]",
          path: "{*path}",
          isParam: false,
          isCatchAll: true,
          isOptionalCatchAll: false,
          isGroup: false,
          paramName: "path",
        },
      ];

      expect(EventMatcher.parseSegments(scannerSegments)).toMatchSnapshot();
    });

    it("should convert optional catch-all segments", () => {
      const scannerSegments = [
        {
          raw: "proxy",
          path: "proxy",
          isParam: false,
          isCatchAll: false,
          isOptionalCatchAll: false,
          isGroup: false,
          paramName: null,
        },
        {
          raw: "[[...path]]",
          path: "{*path}",
          isParam: false,
          isCatchAll: false,
          isOptionalCatchAll: true,
          isGroup: false,
          paramName: "path",
        },
      ];

      expect(EventMatcher.parseSegments(scannerSegments)).toMatchSnapshot();
    });
  });
});
