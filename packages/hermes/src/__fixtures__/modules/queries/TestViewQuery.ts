import { Query } from "../../../decorators/index.js";

@Query()
export class TestViewQuery {
  public constructor(public readonly filter: string) {}
}
