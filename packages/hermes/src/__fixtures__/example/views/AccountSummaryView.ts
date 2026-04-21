import { Entity, Namespace, Field, Index, Default } from "@lindorm/proteus";
import { HermesViewEntity } from "../../../entities/HermesViewEntity.js";

@Namespace("banking")
@Entity({ name: "account_summary" })
export class AccountSummaryView extends HermesViewEntity {
  @Field("string")
  @Index()
  @Default("")
  ownerName: string = "";

  @Field("string")
  @Default("USD")
  currency: string = "USD";

  @Field("float")
  @Default(0)
  balance: number = 0;

  @Field("string")
  @Index()
  @Default("open")
  status: string = "open";

  @Field("integer")
  @Default(0)
  transactionCount: number = 0;
}
