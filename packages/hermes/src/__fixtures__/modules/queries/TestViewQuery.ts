import { Query } from "../../../decorators";

@Query()
export class TestViewQuery {
  public constructor(public readonly filter: string) {}
}
