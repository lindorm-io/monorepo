import { Query } from "../../../decorators/index.js";

@Query()
export class GetAccountSummary {
  public constructor(public readonly accountId: string) {}
}
