Feature: The error contract at every door

  `AegisError` is the class a consumer catches: a token rejection becomes a
  401 because the consumer branches on it, and a failure raised as anything
  else falls through that guard and surfaces as a generic 500 that tells the
  caller nothing about the token. Every failure aegis raises is therefore an
  `AegisError`, at every door. A domain rule is one rule and raises one code
  on both encodings, and the data on the error leaves out the token's
  encoding: the client sent that token or chose its encoding, so the
  encoding is a diagnostic. Both are aegis policy — no specification says
  anything about the shape of an implementation's error — so no scenario
  carries a tag.

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

  Rule: a failing claim assertion at the deployment throws an AegisError

    The deployment's claim check is a door like any other: a caller that
    wraps it in the same guard as a verify must catch the same class. The
    door takes a flat claim set and no token, so the scenario names no wire.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the verifier asserts
        """json
        { "subject": "someone-else" }
        """

    Scenario: the deployment's claim check refusal is an aegis error
      When I check the claims without a signature
      Then the claims are refused as an aegis error

  Rule: a failing claim assertion outside any deployment throws an AegisError

    The claim check offered outside any deployment is a door too, and a
    caller holding claims and no vault still branches on the class. The door
    takes a flat claim set and no token, so the scenario names no wire.

    Background:
      Given the claims to check
        | subject | "user-1" |
      And the verifier asserts
        """json
        { "subject": "someone-else" }
        """

    Scenario: the refusal of a claim check outside any deployment is an aegis error
      When I check the claims without a signature or a deployment
      Then the claims are refused as an aegis error

  Rule: a domain refusal keeps the token's encoding out of its data

    The data on a refusal reaches the client. The client sent the token or
    chose its encoding, so the data does not repeat the encoding: it is a
    diagnostic. The token carries no expiry, so the domain rule that refuses
    it is expiry presence, whose refusal names nothing else; the range check
    belongs to the kit and is not what answers. The verify states no options
    at all, so the twin that states an empty bag can be held to the same
    verdict.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"

    Scenario Outline: <wire>: the refusal of a token with no expiry carries no data
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token stating no options
      Then verification is refused as a domain error "missing_claim_exp"
      And the refusal carries no data

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a COSE type header that is not a text string is refused as a COSE error at every door

    RFC 9596 §2 lets a COSE type header be a CoAP Content-Format integer as
    well as a media-type string. aegis reads the type as a media type — it
    decides which kind of token this is and it is what a profile's floor
    compares — and an integer names no media type to compare. So a type
    header that is not a text string is refused where the header is read,
    under one code at every door, as an error the consumer's guard catches
    rather than a failure that falls through it. That is aegis policy, not a
    requirement of RFC 9596, which registers the parameter as an unsigned
    integer or a text string. The jose wire has no scenario: the integer form
    is one RFC 9596 gives the COSE type header alone, and a JOSE header whose
    type is not a string is refused by the JOSE header decoder under a code of
    its own.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | typ | 61 |

    Scenario: cose: the domain verify refuses a type header stated as an integer
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a COSE error "cose_header_typ_invalid"

    Scenario: cose: the keyless read refuses a type header stated as an integer
      When a third party signs the wire claims on the cose wire
      And I read the token without a key
      Then the keyless read is refused as a COSE error "cose_header_typ_invalid"

    Scenario: cose: the raw claims door refuses a type header stated as an integer
      When a third party signs the wire claims on the cose wire
      And I verify the token as a claims token on the cose wire
      Then verification is refused as a COSE error "cose_header_typ_invalid"

    Scenario: cose: the raw opaque door refuses a type header stated as an integer
      When a third party signs the wire claims on the cose wire
      And I verify the token as opaque content on the cose wire
      Then verification is refused as a COSE error "cose_header_typ_invalid"

  Rule: a COSE type header that is not a text string is refused in the unprotected bucket too

    A type header in the bucket the signature does not cover is read and not
    believed when it is text. One that is not text is refused there as well:
    aegis reads a type header the same way in either bucket, so the bucket is
    no way past the refusal. That is aegis policy too — RFC 9596 §2 forbids
    the parameter in that bucket whatever its value, and aegis still accepts
    a text one there and ignores it. The jose wire has no scenario: the JOSE
    compact serialisation has no unprotected bucket (RFC 7515 §7.1).

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign unprotected header carries
        | typ | 61 |

    Scenario: cose: the domain verify refuses an unprotected type header stated as an integer
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a COSE error "cose_header_typ_invalid"

    Scenario: cose: the raw opaque door refuses an unprotected type header stated as an integer
      When a third party signs the wire claims on the cose wire
      And I verify the token as opaque content on the cose wire
      Then verification is refused as a COSE error "cose_header_typ_invalid"

  Rule: a COSE content type stated as a CoAP Content-Format with a content coding is refused as a COSE error

    The jose wire has no scenario: the integer form is one RFC 9052 §3.1
    gives the COSE content type alone. RFC 9052 §3.1 lets a COSE content type
    be an unsigned integer from the CoAP Content-Formats registry, and some
    of that registry's rows pair a media type with a content coding: the
    bytes they describe are compressed. aegis cannot undo a content coding,
    and reading the bare media type would hand compressed bytes to a JSON,
    CBOR or text reader. So such an integer is refused where the header is
    read, as an error the consumer's guard catches rather than a failure that
    falls through it. That is aegis policy, not a requirement of RFC 9052,
    which registers the parameter as a text string or an unsigned integer.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | cty | 11050 |

    Scenario: cose: the domain verify refuses a content type stated as the deflate-coded CoAP Content-Format 11050
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a COSE error "cose_header_cty_invalid"

  Rule: a COSE content type stated as an unassigned integer is refused in the unprotected bucket too

    The jose wire has no scenario: the JOSE compact serialisation has no
    unprotected bucket (RFC 7515 §7.1). An integer the CoAP Content-Formats
    registry does not assign names no media type, so aegis refuses it as a
    content type where the header is read. aegis reads a content type the
    same way in either bucket, so the bucket the signature does not cover is
    no way past the refusal. That is aegis policy, not a requirement of
    RFC 9052, which registers the parameter as a text string or an unsigned
    integer.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign unprotected header carries
        | cty | 1 |

    Scenario: cose: the domain verify refuses an unprotected content type stated as an unassigned integer
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a COSE error "cose_header_cty_invalid"
