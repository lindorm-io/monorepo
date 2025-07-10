import { Query } from "../../../decorators";

@Query()
export class TestMongoQuery {
  public constructor(public readonly id: string) {}
}
