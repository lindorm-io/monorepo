import { Query } from "../../../src";

@Query()
export class ExampleMongoQuery {
  public constructor(public readonly id: string) {}
}
