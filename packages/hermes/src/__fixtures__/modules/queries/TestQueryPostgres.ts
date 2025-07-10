import { Query } from "../../../decorators";

@Query()
export class TestPostgresQuery {
  public constructor(public readonly id: string) {}
}
