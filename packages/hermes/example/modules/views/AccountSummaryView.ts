/**
 * AccountSummaryView -- Proteus entity for the account summary read model
 *
 * Demonstrates:
 *   - extends HermesViewEntity (provides id, destroyed, revision, timestamps)
 *   - @Entity({ name: "account_summary" }) for table/collection naming
 *   - @Namespace("banking") for schema/prefix scoping
 *   - @Field("string" | "float" | "integer") for typed columns
 *   - @Index() for query-optimized fields
 *   - @Default() for column defaults
 */

import { Entity, Namespace, Field, Index, Default } from "@lindorm/proteus";
import { HermesViewEntity } from "@lindorm/hermes";

@Entity({ name: "account_summary" })
@Namespace("banking")
export class AccountSummaryView extends HermesViewEntity {
  @Field("string")
  @Index()
  @Default("")
  public ownerName: string = "";

  @Field("string")
  @Default("USD")
  public currency: string = "USD";

  @Field("float")
  @Default(0)
  public balance: number = 0;

  @Field("string")
  @Index()
  @Default("open")
  public status: string = "open";

  @Field("integer")
  @Default(0)
  public transactionCount: number = 0;
}
