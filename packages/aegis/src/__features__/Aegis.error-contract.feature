Feature: The error contract at every door

  `AegisError` is the class a consumer catches: a token rejection becomes a
  401 because the consumer branches on it, and a failure raised as anything
  else falls through that guard and surfaces as a generic 500 that tells the
  caller nothing about the token. Every failure aegis raises is therefore an
  `AegisError`, at every door. A domain rule is one rule and raises one code
  on both encodings, so the encoding of the token it refused travels as data
  on the error. Both are aegis policy — no specification says anything about
  the shape of an implementation's error — so no scenario carries a tag.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: an expired token rejected by a kit verify throws an AegisError

    The raw claims door is the one a consumer reaches when it wants the wire
    and nothing above it, and a rejection there must be catchable by the same
    guard as any other. The token is expired, so the refusal is the kit's own
    temporal predicate — the deepest layer a caller can reach through the
    public surface.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T06:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:00:00.000Z"

    Scenario Outline: <wire>: the raw claims door's refusal is an aegis error
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token as a claims token on the <wire> wire
      Then verification is refused as an aegis error

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an expired token rejected by the domain verify verb throws an AegisError

    The domain verify verb is the door most consumers use. A failure raised
    there that is not an `AegisError` defeats every `instanceof` guard written
    against the package, and it would do so on the commonest rejection of
    all: a token whose lifetime has run out.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T06:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:00:00.000Z"

    Scenario Outline: <wire>: the domain verify's refusal is an aegis error
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as an aegis error

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a failing static claim assertion throws an AegisError

    The static claim-matching surface is a door like any other: a caller that
    wraps it in the same guard as a verify must catch the same class. The
    door takes a flat claim set and no token, so the scenario names no wire.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the verifier asserts
        """json
        { "subject": "someone-else" }
        """

    Scenario: the static door's refusal is an aegis error
      When I check the claims without a signature
      Then the claims are refused as an aegis error

  Rule: a domain refusal names the encoding of the token it refused in its data

    A consumer handling a domain refusal — logging it, rendering it, deciding
    whether to retry against a different endpoint — has to know which
    encoding the refused token was in, and that fact is not in the code. A
    refusal that names the wrong encoding is worse than one that names none:
    it sends whoever reads it to the wrong decoder, the wrong issuer and the
    wrong half of the code, most convincingly when both wires share the one
    implementation that produced it. The token carries no expiry, so the
    domain rule that refuses it is expiry presence; the range check belongs
    to the kit and is not what answers. The verify states no options at all,
    so the twin that states an empty bag can be held to the same verdict.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"

    Scenario Outline: <wire>: the refusal reports the format of the token it refused
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token stating no options
      Then verification is refused as a domain error "missing_claim_exp"
      And the refusal reports the format "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |
