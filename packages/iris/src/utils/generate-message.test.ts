import { generateMessageSource } from "./generate-message";

describe("generateMessageSource", () => {
  it("produces a pascal-case message file", () => {
    expect(generateMessageSource({ name: "OrderCreated" })).toMatchSnapshot();
  });

  it("interpolates shorter PascalCase names", () => {
    expect(generateMessageSource({ name: "Payment" })).toMatchSnapshot();
  });
});
