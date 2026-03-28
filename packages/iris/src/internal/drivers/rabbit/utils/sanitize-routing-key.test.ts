import { sanitizeRoutingKey } from "./sanitize-routing-key";

describe("sanitizeRoutingKey", () => {
  it("should return an already clean key unchanged", () => {
    expect(sanitizeRoutingKey("orders.created")).toMatchSnapshot();
  });

  it("should replace spaces with underscores", () => {
    expect(sanitizeRoutingKey("my topic name")).toMatchSnapshot();
  });

  it("should replace special characters", () => {
    expect(sanitizeRoutingKey("topic/with@special#chars!")).toMatchSnapshot();
  });

  it("should preserve dots, hyphens, and underscores", () => {
    expect(sanitizeRoutingKey("my-topic_v2.events")).toMatchSnapshot();
  });

  it("should handle empty string", () => {
    expect(sanitizeRoutingKey("")).toMatchSnapshot();
  });

  it("should handle string with only invalid characters", () => {
    expect(sanitizeRoutingKey("@#$%^&")).toMatchSnapshot();
  });

  it("should handle alphanumeric only", () => {
    expect(sanitizeRoutingKey("OrderCreated123")).toMatchSnapshot();
  });
});
