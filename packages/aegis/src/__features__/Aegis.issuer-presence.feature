Feature: The issuer claim's presence

  Using `iss` is OPTIONAL — in a JWT (RFC 7519 §4.1.1), and in a CWT whose own
  `iss` claim carries the JWT claim's processing rules (RFC 8392 §3.1.1). So
  neither wire demands one of a claims token it reads: the token comes back with
  no issuer in it, and a caller that needs one states the demand itself — with a
  matcher of its own, or by verifying under a profile whose floor expects an
  issuer. The wires answer identically, because nothing in either document
  distinguishes them here.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key
    And the wire claims
      | sub | "user-1"                   |
      | aud | ["https://rs.lindorm.io/"] |
      | jti | "token-1"                  |
    And the wire claims were issued at "2024-01-01T08:00:00.000Z"
    And the wire claims expire at "2024-01-01T09:00:00.000Z"

  Rule: a claims token carrying no issuer is read keylessly, on both wires

    The keyless read is how a holder learns what a token says before it holds a
    key, and a token naming no issuer is conformant on both wires. Refusing the
    read would hide such a token from the only door that can inspect it, and
    the reader has nothing to put in the claim's place — an issuer it invented
    would be worse than none. So the absence is what it reports.

    @RFC-7519
    Scenario: jose: the issuer-less token is read and its claims reported (RFC-7519 §4.1.1)
      When I sign the wire claims as a claims token on the jose wire
      And I read the token without a key
      Then the parsed token is a "jwt"
      And the parsed claims include
        | subject | user-1 |

    @RFC-8392
    Scenario: cose: the issuer-less token is read and its claims reported (RFC-8392 §3.1.1)
      When I sign the wire claims as a claims token on the cose wire
      And I read the token without a key
      Then the parsed token is a "cwt"
      And the parsed claims include
        | subject | user-1 |

    Scenario Outline: <wire>: the parsed claims carry no issuer
      When I sign the wire claims as a claims token on the <wire> wire
      And I read the token without a key
      Then the parsed claims carry no "issuer"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claims token carrying no issuer is verified without a profile, on both wires

    A verify that applies no profile enforces the specification and the
    caller's own statements, and nothing besides. The issuer claim's processing
    is application specific, so with no profile and no matcher there is no
    application rule to apply — while the signature, the audience and the
    temporal window are checked exactly as they are on a token that names an
    issuer.

    @RFC-7519
    Scenario: jose: the issuer-less token verifies and reports its format (RFC-7519 §4.1.1)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    @RFC-8392
    Scenario: cose: the issuer-less token verifies and reports its format (RFC-8392 §3.1.1)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

    Scenario Outline: <wire>: the verified claims are what was signed, with no issuer among them
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified claims include
        | subject | user-1 |
      And the verified claims carry no "issuer"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a caller needing an issuer asserts it, and its own matcher is what refuses, on both wires

    The read imposes no presence rule, so the demand has to be available at a
    door the caller controls — otherwise a deployment that does need `iss` has
    nowhere to say so. The refusal is the matcher's own verdict, naming the
    domain claim the caller wrote, so a caller can tell its own unmet demand
    apart from a malformed token.

    Background:
      Given the verifier asserts
        """
        { "issuer": { "$exists": true } }
        """

    Scenario Outline: <wire>: the caller's presence matcher refuses the issuer-less token
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claims_invalid"
      And the refusal's data is exactly
        | invalid | ["issuer"] |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a profiled verify refuses the issuer-less token at the floor, on both wires

    Reading a token is not accepting it. A profile expecting the deployment's
    own issuer compares the claim that was read, and a token stating none
    cannot match it — so a read that asks nothing about the claim moves the
    refusal to the floor rather than removing it, and the refusal is the
    floor's own comparison.

    Scenario Outline: <wire>: the floor refuses the token whose issuer it cannot match
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "issuer_mismatch"

      Examples:
        | wire |
        | jose |
        | cose |
