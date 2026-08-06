import {
  CreateDateField,
  Encrypted,
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";

/**
 * A cached RFC 7662 introspection answer. `claims` is the WIRE form
 * (`Aegis.toWire`) — jose-keyed, dates as unix seconds — because the row is JSON
 * at rest and a `Date` would come back as a string the claim translator cannot
 * read. `Aegis.toDomain` rebuilds the domain claims on the way out.
 *
 * `claims` is `null` for an inactive token, and only for an inactive token: RFC
 * 7662 §2.2 says the server SHOULD NOT include anything but `active: false`, and
 * a negative IS a real cache entry — it must be storable, not merely absent.
 */
export type CachedIntrospectionPayload = {
  active: boolean;
  claims: Record<string, unknown> | null;
};

@Namespace("pylon")
@Entity()
export class CachedIntrospection {
  @PrimaryKeyField("string")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @ExpiryDateField()
  expiresAt!: Date | null;

  /**
   * Sealed at rest: these are the claims of a LIVE credential (subject, scope,
   * delegation) sitting in shared, often ephemeral, storage. The marker is bare
   * — pylon stages the deployment's KEK onto it before the source sets up, so an
   * unresolvable key fails loudly at setup instead of silently storing plaintext.
   */
  @Encrypted()
  @Field("json")
  payload!: CachedIntrospectionPayload;
}
