import {
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
  Sensitive,
} from "@lindorm/proteus";

/**
 * The session ENVELOPE, deliberately NOT `implements IPylonSession`: the entity is
 * what sits at rest, the interface is the opened view.
 *
 * Membership rule, stated once: every cleartext column here is one pylon must read
 * with NO holder present. Everything else lives inside `payloadEncrypted`, sealed
 * under a key derived from the secret the cookie carries — so a kv dump yields a
 * session id, a subject, two timestamps and a blob, and the access, id and refresh
 * tokens are unrecoverable.
 */
@Namespace("pylon")
@Entity()
export class Session {
  /** Named by the cookie. Readable without the secret: the lookup precedes the decrypt. */
  @PrimaryKeyField()
  id!: string;

  /**
   * AES-256-GCM under HKDF(cookie `sec`). Holds the token set and the scope.
   *
   * `@Sensitive` is for LOG VOLUME, not confidentiality — the ciphertext is not
   * secret. `@Hide` is deliberately NOT used: that filters the column out of
   * SELECTs, and this column IS the read.
   */
  @Sensitive()
  @Field("text")
  payloadEncrypted!: string;

  /**
   * Back-channel logout deletes by subject with no holder present, so this cannot
   * be sealed.
   */
  @Field("string")
  subject!: string;

  /**
   * The refresh middleware's `half_life` / `max_age` decision reads it, and it is
   * the one timestamp that is a fact about the row.
   */
  @Field("timestamp")
  issuedAt!: Date;

  /**
   * Drives the store's own expiry reaping, and is the validity check the socket
   * refresh path runs BEFORE it has a key to decrypt with.
   */
  @ExpiryDateField()
  expiresAt!: Date | null;
}
