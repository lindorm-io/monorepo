import {
  CreateDateField,
  Encrypted,
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
  TypedJson,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";
import type { PylonUserinfo } from "../types/index.js";

/**
 * A cached OIDC Core §5.3 userinfo answer. `claims` is the DOMAIN object exactly
 * as `ctx.auth.userinfo()` returns it — no wire translation on either side.
 *
 * ⚠ Wire form (`Aegis.toWire`) was considered and is WRONG here, unlike on
 * `CachedIntrospection`, because the translation is NOT symmetric over a
 * profile: `address` (OIDC Core §5.1, the one nested profile claim) is
 * snake-keyed on the way out and handed back VERBATIM on the way in, so a cache
 * HIT would return `{ street_address }` where a MISS returned
 * `{ streetAddress }` — an answer that differs by cache state, the worst shape a
 * bug can take. `@TypedJson` avoids the translation entirely: it carries the JS
 * types (`updatedAt` stays a `Date`) in a sidecar column, which `@Encrypted`
 * seals alongside the payload. A PLAIN `@Field("json")` would not do — proteus
 * rejects a `Date` inside one outright.
 *
 * There is no `active` field and no negative entry: userinfo returns a profile
 * or it errors, and a failure is never cached — it would serve a stale failure
 * after the cause cleared, and "is this token still good?" is introspection's
 * question, under introspection's much shorter window.
 */
export type CachedUserinfoPayload = {
  claims: PylonUserinfo;
};

@Namespace("pylon")
@Entity()
export class CachedUserinfo {
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
   * Sealed at rest: a profile is the most obviously personal payload pylon
   * stores — name, email, phone, address, picture — sitting in the shared,
   * frequently least protected source in a deployment. The marker is bare; pylon
   * stages the deployment's KEK onto it before the source sets up, so an
   * unresolvable key fails loudly at setup instead of silently storing
   * plaintext.
   */
  @Encrypted()
  @TypedJson()
  @Field("json")
  payload!: CachedUserinfoPayload;
}
