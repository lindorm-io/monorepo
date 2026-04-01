import { Query } from "../../../decorators";

@Query()
export class GetAccountSummary {
  public constructor(public readonly accountId: string) {}
}
