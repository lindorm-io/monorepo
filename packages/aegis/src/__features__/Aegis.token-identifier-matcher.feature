Feature: The token identifier matcher

  The token identifier is the one registered claim whose spelling differs
  between the two wires: `jti` on JOSE, `cti` on COSE. A caller asserts it
  under one domain name, and the matcher is keyed to whichever spelling the
  token's wire carries — otherwise a correlation check finds nothing, tells
  the caller a matching token does not match, and tells a replay guard that
  a token carrying an identifier carries none.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a caller asserting the token identifier it expects is answered from the claim the wire carries

    `jti` is the identifier a replay check keys on, and the same claim is
    spelled `cti` on the COSE wire (RFC 7519 §4.1.7, RFC 8392 §3.1.7). A
    matcher keyed to one spelling and applied to the other finds nothing, so
    a caller that correlated a token with its own stored record would be told
    it did not match a token that does. The COSE scenario carries its own
    tag: the CWT document is what names the divergent spelling.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "tokenId": "token-1" }
        """

    @RFC-7519
    Scenario: jose: the identifier is read from the registered JWT claim (RFC-7519 §4.1.7)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    @RFC-8392
    Scenario: cose: the identifier is read from the CWT claim under its own spelling (RFC-8392 §3.1.7)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

  Rule: a caller asserting a token identifier the token does not carry is refused

    A matcher that accepts every value is not a matcher, and one applied to a
    claim it cannot find accepts every value — including the case where the
    presented token is a different token entirely. Refusing a mismatch is
    what makes the accepting direction mean anything: without it the
    assertion would be satisfied by any token at all, which is precisely how
    a correlation check stops correlating. The refusal names the matcher in
    the caller's vocabulary.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "tokenId": "not-the-token-id" }
        """

    Scenario Outline: <wire>: the mismatched identifier is refused, naming the matcher
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "tokenId"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller asserting that no token identifier is present is refused by a token that carries one

    This is the fail-open direction of the same divergence, and the one that
    matters: a replay guard asking whether a token carries an identifier at
    all must not be told "no" about a token that carries one. A predicate
    keyed to the wrong wire name finds nothing and answers that the claim is
    absent, which is an affirmative wrong answer rather than a missing one —
    the guard passes, records nothing, and the token can be replayed.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """json
        { "tokenId": { "$exists": false } }
        """

    Scenario Outline: <wire>: the existence matcher sees the identifier the token carries and refuses
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal lists the invalid claims "tokenId"

      Examples:
        | wire |
        | jose |
        | cose |
