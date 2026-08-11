import { randomString } from "@lindorm/random";

/**
 * The secret half of a session handle — the half the browser carries and pylon
 * never keeps. Nothing derived from it is stored: it derives the key that seals
 * `Session.payloadEncrypted` (`sessionRecordKit`), so possession is proved by the
 * decrypt succeeding and there is no server-side copy to grind.
 *
 * 512-bit floor. 86 base64url characters carry ~516 bits, so the floor holds with
 * margin — the same entropy contract as tyr's handle secret.
 */
export const createSessionSecret = (): string => randomString(86, "base64url");
