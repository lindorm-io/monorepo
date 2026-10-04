Feature: The issuer claim's presence

  Using `iss` is OPTIONAL — in a JWT (RFC 7519 §4.1.1), and in a CWT whose own
  `iss` claim carries the JWT claim's processing rules (RFC 8392 §3.1.1). So
  neither wire demands one of a claims token it reads: the token comes back with
  no issuer in it, and a caller that needs one states the demand itself — with a
  matcher of its own, or by verifying under a profile whose floor expects an
  issuer. An issuer stated as the empty string is not an absent one: aegis
  signs no claims token carrying it, and refuses one on read as policy. The
  wires answer identically, because nothing in either document distinguishes
  them here.

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

    A verify that applies no profile enforces the specification, the caller's
    own statements and aegis's labelled read policy, and nothing besides; for
    the issuer, that policy refuses only one stated as the empty string (a Rule
    below). The issuer claim's processing is application specific, so with no
    profile and no matcher a token naming no issuer meets no application rule
    — while the signature, the audience and the temporal window are checked
    exactly as they are on a token that names an issuer.

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

    The read demands no issuer, so the demand has to be available at a door
    the caller controls — otherwise a deployment that does need `iss` has
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
    cannot match it — so a read that demands no issuer moves the refusal to
    the floor rather than removing it, and the refusal is the floor's own
    comparison.

    Scenario Outline: <wire>: the floor refuses the token whose issuer it cannot match
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "issuer_mismatch"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an empty issuer handed to the raw signing door is left off the token, on both wires

    The claim registry prunes an empty `iss` at the emission boundary every
    signing door runs, so even the raw door, which writes the caller's wire
    claims as given, signs a token that names no issuer rather than one that
    names the empty string. Aegis policy at mint, and the reason the empty
    issuer the next Rule refuses can only arrive from another producer.

    Background:
      Given the wire claim "iss" is the empty string

    Scenario: jose: the empty issuer is left off the signed token
      When I sign the wire claims as a claims token on the jose wire
      Then the raw payload carries no "iss"

    Scenario: cose: the empty issuer is left off the signed token under claim key 1
      When I sign the wire claims as a claims token on the cose wire
      Then the raw payload carries no claim key 1

  Rule: a claims token whose issuer is the empty string is refused at every domain read door, on both wires

    An issuer of `""` names no principal, so a read that reports it hands the
    consumer a claim that looks stated and identifies nobody. RFC 7519 §2
    admits the value as a StringOrURI, and RFC 8392 §2 gives the CWT the same
    term, so the refusal is aegis policy at verify, stricter than either
    document, and no scenario here carries a tag. The empty value reads as
    missing or empty, the wording a presence demand gives a claim held as
    `""`, and the refusal answers before a profile's floor or a caller's
    claim matcher judges the claims — a matcher naming the deployment's
    issuer, and a presence matcher too, which the empty string would satisfy
    because `$exists` asks only that a claim is not null. A token that names
    no issuer at all is still read: the claim is optional, and leaving it
    out states nothing false.
    Aegis leaves an empty issuer off, so the token here is a third party's;
    the first scenario on each wire reads the empty value off the wire, so
    the rest judge the read.

    Background:
      Given the wire claim "iss" is the empty string

    Scenario: jose: the empty issuer reaches the wire as the empty string
      When a third party signs the wire claims on the jose wire, typed "JWT"
      Then the raw payload carries "iss" ""

    Scenario: cose: the empty issuer reaches the wire as the empty text string under claim key 1
      When a third party signs the wire claims on the cose wire, typed "application/cwt"
      Then the raw payload carries claim key 1 ""

    Scenario Outline: <wire>: the verify without a profile refuses the empty issuer as missing or empty
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then verification is refused as a domain error "missing_claim_iss"
      And the refusal's message is: Claim "issuer" is missing or empty
      And the refusal carries no data

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the verify under a profile refuses the empty issuer before the floor compares it
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "missing_claim_iss"
      And the refusal's message is: Claim "issuer" is missing or empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the verify asserting <assertion> refuses the empty issuer before the matcher judges it
      Given the verifier asserts
        """json
        <matcher>
        """
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then verification is refused as a domain error "missing_claim_iss"
      And the refusal's message is: Claim "issuer" is missing or empty

      Examples:
        | wire | typ             | assertion               | matcher                                  |
        | jose | JWT             | the deployment's issuer | { "issuer": "https://test.lindorm.io/" } |
        | cose | application/cwt | the deployment's issuer | { "issuer": "https://test.lindorm.io/" } |
        | jose | JWT             | the issuer's presence   | { "issuer": { "$exists": true } }        |
        | cose | application/cwt | the issuer's presence   | { "issuer": { "$exists": true } }        |

    Scenario Outline: <wire>: the keyless read refuses the empty issuer
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the keyless read is refused as a domain error "missing_claim_iss"
      And the refusal's message is: Claim "issuer" is missing or empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the same token naming no issuer at all is verified
      Given the wire claims leave out "iss"
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified claims carry no "issuer"

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a raw claims door reports a token's empty issuer as written, on both wires

    The raw wire doors run no claim translation and return the payload as the
    producer wrote it, which is what makes them the way to look at a token a
    domain door refuses. The empty-issuer refusal belongs to the domain read,
    so it stays out of them and the wire claim comes back as the empty string.

    Background:
      Given the wire claim "iss" is the empty string

    Scenario Outline: <wire>: the raw claims door reports the issuer as the empty string
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token as a claims token on the <wire> wire
      Then the raw door reports the wire claim "iss" as ""

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |
