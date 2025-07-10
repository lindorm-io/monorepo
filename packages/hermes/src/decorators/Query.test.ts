import { globalHermesMetadata } from "../utils/private";
import { Query } from "./Query";

describe("Query Decorator", () => {
  test("should add metadata", () => {
    @Query()
    class TestQuery {}

    expect(globalHermesMetadata.getQuery(TestQuery)).toMatchSnapshot();
  });
});
