/**
 * Holistic level of assurance per ISO/IEC 29115:2013 (ITU-T X.1254):
 * level 1 (low), 2 (medium), 3 (high), 4 (very high). There is no level 0 —
 * "no assurance" is the absence of the claim.
 */
export type LevelOfAssurance = 1 | 2 | 3 | 4;

/**
 * Authenticator Assurance Level per NIST SP 800-63B: 1, 2, 3.
 */
export type AuthenticatorAssuranceLevel = 1 | 2 | 3;

/**
 * Identity Assurance Level per NIST SP 800-63A: 1, 2, 3. "No proofing" is the
 * absence of the claim — there is no enumerated IAL0.
 */
export type IdentityAssuranceLevel = 1 | 2 | 3;

/**
 * Federation Assurance Level per NIST SP 800-63C: 1, 2, 3.
 */
export type FederationAssuranceLevel = 1 | 2 | 3;
