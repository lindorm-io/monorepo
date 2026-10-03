Feature: Caller-supplied key policy

  A caller states which key may verify or decrypt a token in two ways. A key
  policy is a constraint on the key that resolves — an algorithm floor is how
  a deployment refuses an algorithm downgrade — and it is checked whichever
  door the token arrived through and whichever wire it is on, because a
  policy silently dropped on one code path is worse than no policy at all:
  the caller believes the constraint is in force and stops checking. A key
  supplied outright is the caller's choice of key, and it is used as given:
  the key id a token carries only hints at a key, so the signature or the
  MAC decides whether the supplied key secured the token, and decryption
  fails unless the supplied key sealed it. With no key supplied, the hint is
  what selects a key from the vault. A rule that states aegis policy carries
  no tag.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a caller-supplied key policy is applied when verifying an opaque signature

    An opaque signature has no claims layer, so the domain verify reaches the
    wire kit directly, and that is the path on which a forwarded option is
    most easily lost. A policy that held on one wire and not the other would
    be a policy an attacker chooses to be bound by, since the encoding is the
    issuer's choice and the presenter's opportunity. The vault's signing key
    is the ES512 one, so a policy demanding RS256 can only be satisfied by
    ignoring the policy. Aegis policy.

    Background:
      Given the payload to sign
        | hello | world |
      And the verifier accepts only a signing key of the algorithm "RS256"

    Scenario Outline: <wire>: the opaque signature is refused as a key error under the caller's policy
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token
      Then verification is refused as a key error "verify_key_policy_violation"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a key supplied to the domain verify is used as given, whatever key the token's key id names

    RFC 7515 §4.1.4: "The "kid" (key ID) Header Parameter is a hint
    indicating which key was used to secure the JWS." RFC 9052 §3.1: "Key
    identifier values are hints about which key to use. This is not a
    security-critical field." A key the caller supplies is never compared
    with that hint; the signature is the check that can tell whether the
    supplied key secured the token. RFC 7515 §6: "These Header Parameters
    MUST be integrity protected if the information that they convey is to be
    utilized in a trust decision; however, if the only information used in
    the trust decision is a key, these parameters need not be integrity
    protected, since changing them in a way that causes a different key to
    be used will cause the validation to fail." The producer signs with a
    key the vault does not hold and names that key; the verifier supplies
    the same key material under an id of its own, so the token's key id
    names no key the verifier holds, and only the supplied key can verify
    the token.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the producer holds an ES512 signing key the vault does not hold
      And the verifier supplies the producer's key under a key id of its own

    @RFC-7515
    Scenario: jose: the domain verify accepts the token under the supplied key (RFC-7515 §4.1.4)
      When the producer signs the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    @RFC-9052
    Scenario: cose: the domain verify accepts the token under the supplied key (RFC-9052 §3.1)
      When the producer signs the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

  Rule: a deployment's own verification key is used as given, whatever key the token's key id names

    A deployment may name the key it verifies with in its settings rather
    than resolve one from its vault per token, and that key is the caller's
    choice exactly as a key supplied to one verify is. RFC 7515 §4.1.4: "The
    "kid" (key ID) Header Parameter is a hint indicating which key was used
    to secure the JWS." RFC 9052 §3.1: "Key identifier values are hints
    about which key to use. This is not a security-critical field." The
    deployment holds the producer's key material under an id of its own, so
    the token's key id names no key the deployment holds.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the producer holds an ES512 signing key the vault does not hold
      And the deployment verifies with the producer's key under a key id of its own

    @RFC-7515
    Scenario: jose: the domain verify accepts the token under the deployment's key (RFC-7515 §4.1.4)
      When the producer signs the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    @RFC-9052
    Scenario: cose: the domain verify accepts the token under the deployment's key (RFC-9052 §3.1)
      When the producer signs the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

  Rule: a key supplied to the raw claims door is used as given, whatever key the token's key id names

    The raw claims door speaks the wire and nothing above it, and it takes
    the same supplied key the domain verify does. RFC 7515 §4.1.4: "The
    "kid" (key ID) Header Parameter is a hint indicating which key was used
    to secure the JWS." RFC 9052 §3.1: "Key identifier values are hints
    about which key to use. This is not a security-critical field."

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the producer holds an ES512 signing key the vault does not hold
      And the verifier supplies the producer's key under a key id of its own

    @RFC-7515
    Scenario: jose: the raw claims door accepts the token under the supplied key (RFC-7515 §4.1.4)
      When the producer signs the wire claims as a claims token on the jose wire
      And I verify the token as a claims token on the jose wire
      Then the raw door accepts the token

    @RFC-9052
    Scenario: cose: the raw claims door accepts the token under the supplied key (RFC-9052 §3.1)
      When the producer signs the wire claims as a claims token on the cose wire
      And I verify the token as a claims token on the cose wire
      Then the raw door accepts the token

  Rule: a shared secret supplied to the raw claims door is used as given, whatever key the token's key id names

    A shared secret authenticates a token with a MAC rather than a
    signature, and on the COSE wire that is a structure of its own with a
    raw door of its own. RFC 7515 §4.1.4: "The "kid" (key ID) Header
    Parameter is a hint indicating which key was used to secure the JWS."
    RFC 9052 §3.1: "Key identifier values are hints about which key to use.
    This is not a security-critical field." The MAC is the check that can
    tell whether the supplied secret secured the token.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the producer holds an HS256 signing key the vault does not hold
      And the verifier supplies the producer's key under a key id of its own

    @RFC-7515
    Scenario: jose: the raw claims door accepts the token under the supplied secret (RFC-7515 §4.1.4)
      When the producer signs the wire claims as a claims token on the jose wire
      And I verify the token as a claims token authenticated by a shared secret on the jose wire
      Then the raw door accepts the token

    @RFC-9052
    Scenario: cose: the raw claims door accepts the token under the supplied secret (RFC-9052 §3.1)
      When the producer signs the wire claims as a claims token on the cose wire
      And I verify the token as a claims token authenticated by a shared secret on the cose wire
      Then the raw door accepts the token

  Rule: a key supplied to the raw opaque door is used as given, whatever key the token's key id names

    An opaque signature carries no claims, so nothing but the key id could
    point at a key, and the supplied key is used as given there too. RFC 7515
    §4.1.4: "The "kid" (key ID) Header Parameter is a hint indicating which
    key was used to secure the JWS." RFC 9052 §3.1: "Key identifier values
    are hints about which key to use. This is not a security-critical
    field."

    Background:
      Given the payload to sign
        | hello | world |
      And the producer holds an ES512 signing key the vault does not hold
      And the verifier supplies the producer's key under a key id of its own

    @RFC-7515
    Scenario: jose: the raw opaque door delivers the payload under the supplied key (RFC-7515 §4.1.4)
      When the producer signs the payload as opaque content on the jose wire
      And I verify the token as opaque content on the jose wire
      Then the raw door reports the payload
        | hello | world |

    @RFC-9052
    Scenario: cose: the raw opaque door delivers the payload under the supplied key (RFC-9052 §3.1)
      When the producer signs the payload as opaque content on the cose wire
      And I verify the token as opaque content on the cose wire
      Then the raw door reports the payload
        | hello | world |

  Rule: a key supplied to the domain decrypt is used as given, whatever key the ciphertext's key id names

    RFC 7516 §4.1.6: "This parameter has the same meaning, syntax, and
    processing rules as the "kid" Header Parameter defined in Section 4.1.4
    of [JWS], except that the key hint references the public key to which
    the JWE was encrypted; this can be used to determine the private key
    needed to decrypt the JWE." RFC 9052 §3.1: "Key identifier values are
    hints about which key to use. This is not a security-critical field."
    Decryption fails unless the supplied key sealed the ciphertext. The
    producer seals with a key the vault does not hold and names that key;
    the recipient supplies the same key material under an id of its own.

    Background:
      Given the data to encrypt
        | sub | user-1 |
      And the producer holds a dir encryption key the vault does not hold
      And the recipient supplies the producer's key under a key id of its own

    @RFC-7516
    Scenario: jose: the domain decrypt opens the ciphertext under the supplied key (RFC-7516 §4.1.6)
      When the producer encrypts the data on the jose wire
      And I decrypt the token
      Then the decrypted payload carries "sub" "user-1"

    @RFC-9052
    Scenario: cose: the domain decrypt opens the ciphertext under the supplied key (RFC-9052 §3.1)
      When the producer encrypts the data on the cose wire
      And I decrypt the token
      Then the decrypted payload carries "sub" "user-1"

  Rule: a key supplied to the raw decrypt door is used as given, whatever key the ciphertext's key id names

    The raw decrypt door speaks the wire and takes the same supplied key the
    domain decrypt does. RFC 7516 §4.1.6: "This parameter has the same
    meaning, syntax, and processing rules as the "kid" Header Parameter
    defined in Section 4.1.4 of [JWS], except that the key hint references
    the public key to which the JWE was encrypted; this can be used to
    determine the private key needed to decrypt the JWE." RFC 9052 §3.1:
    "Key identifier values are hints about which key to use. This is not a
    security-critical field."

    Background:
      Given the data to encrypt
        | sub | user-1 |
      And the producer holds a dir encryption key the vault does not hold
      And the recipient supplies the producer's key under a key id of its own

    @RFC-7516
    Scenario: jose: the raw decrypt door opens the ciphertext under the supplied key (RFC-7516 §4.1.6)
      When the producer encrypts the data on the jose wire
      And I decrypt the token as sealed content on the jose wire
      Then the raw decrypt door reports the payload
        | sub | user-1 |

    @RFC-9052
    Scenario: cose: the raw decrypt door opens the ciphertext under the supplied key (RFC-9052 §3.1)
      When the producer encrypts the data on the cose wire
      And I decrypt the token as sealed content on the cose wire
      Then the raw decrypt door reports the payload
        | sub | user-1 |

  Rule: with no key supplied, a token whose key id the vault does not hold is refused at key resolution

    With no key supplied, the key id is all the verifier has to choose a key
    by, so it is looked up in the vault and nowhere else. One the vault does
    not hold is refused there, as a key error, before any signature is
    checked: trying other keys until one verified would let the token choose
    the key it is checked against. The vault holds a signing key of the
    producer's algorithm, so a lookup that fell back to it would reach the
    signature rather than refuse. Aegis policy.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the producer holds an ES512 signing key the vault does not hold

    Scenario Outline: <wire>: the domain verify refuses the token as a key error
      When the producer signs the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a key error "verify_key_not_found"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: with no key supplied, ciphertext whose key id the vault does not hold is refused at key resolution

    With no key supplied, the ciphertext's key id is all the recipient has
    to choose a key by, so it is looked up in the vault and nowhere else.
    One the vault does not hold is refused there, as a key error, before any
    decryption is attempted. The vault holds a key of the producer's kind,
    so a lookup that fell back to it would reach the decryption rather than
    refuse. Aegis policy.

    Background:
      Given the data to encrypt
        | sub | user-1 |
      And the vault also holds a dir encryption key
      And the producer holds a dir encryption key the vault does not hold

    Scenario Outline: <wire>: the domain decrypt refuses the ciphertext as a key error
      When the producer encrypts the data on the <wire> wire
      And I decrypt the token
      Then decryption is refused as a key error "decrypt_key_not_found"

      Examples:
        | wire |
        | jose |
        | cose |
