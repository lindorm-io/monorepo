import { Query } from "../../../src";

@Query()
export class ExamplePostgresQuery {
  public constructor(public readonly id: string) {}
}
