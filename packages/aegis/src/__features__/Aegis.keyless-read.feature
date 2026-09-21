Feature: The keyless claims read

  Before a token can be verified the holder must know which key to fetch and
  which issuer to ask, and both facts are inside the token. The keyless read
  is how that circularity is broken: it yields the header and the claims of
  any claims-bearing artifact, refuses the artifacts that carry none, and
  stays unverified — nothing it returns may decide whether the token is
  accepted.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a claims token is read keylessly into its header and its domain claims

    The read has to yield the header and the claims of any claims-bearing
    artifact, in the domain vocabulary the rest of the surface speaks, or the
    holder learns which key and issuer to ask about in one spelling per
    wire. The claims include one the profile injected and one the caller
    stated under an unregistered name, so the read is shown to translate the
    registered layer and to carry the rest.

    Background:
      Given the content to mint
        | subject       | user-1  |
        | transactionId | txn_abc |
      And the content expires in "1h"
      And the token type "test_token"

    Scenario Outline: <wire>: the token is read without a key and reports its claims format
      When I mint the content under the "default" profile on the <wire> wire
      And I read the token without a key
      Then the parsed token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the parsed header reports the algorithm the token was signed under
      When I mint the content under the "default" profile on the <wire> wire
      And I read the token without a key
      Then the parsed header includes
        | algorithm | "ES512" |

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the parsed claims are the content, with the issuer the profile injected
      When I mint the content under the "default" profile on the <wire> wire
      And I read the token without a key
      Then the parsed claims include
        | subject       | user-1                   |
        | issuer        | https://test.lindorm.io/ |
        | transactionId | txn_abc                  |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claims token issued elsewhere and carrying no type header is still read keylessly

    The keyless read is what a holder does to a token it did not issue — that
    is its whole purpose — so it cannot require a type header this package
    would have stamped. A claims token that declares no type is ordinary and
    conformant (RFC 7519 §5.1, RFC 9596 §2). A reader that routed on the
    header would answer "not a token I recognise" for the majority of the
    third-party tokens it exists to inspect, and the holder would have no way
    to learn which key or issuer to ask about. The token is a third party's
    on purpose: every aegis writer stamps a type header on both wires and no
    option suppresses it. The absence is read off the wire first, so the
    scenario cannot pass on an ordinary typed token.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7519
    Scenario: jose: a token carrying no type header is read, the absence read off the wire (RFC-7519 §5.1)
      When a third party signs the wire claims on the jose wire
      And I read the token without a key
      Then the raw protected header carries no "typ"
      And the parsed token is a "jwt"

    @RFC-9596
    Scenario: cose: a token carrying no type header is read, the absence read off the wire (RFC-9596 §2)
      When a third party signs the wire claims on the cose wire
      And I read the token without a key
      Then the raw protected header carries no label 16
      And the parsed token is a "cwt"

    Scenario Outline: <wire>: the parsed claims are what the third party wrote
      When a third party signs the wire claims on the <wire> wire
      And I read the token without a key
      Then the parsed claims include
        | subject | user-1                   |
        | issuer  | https://test.lindorm.io/ |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the keyless claims read refuses an opaque signed token rather than reporting empty claims

    An opaque signed artifact has no claims layer at all, so a claims reader
    given one has nothing to return. Returning an empty claim set would be
    indistinguishable from a claims token that happened to carry none, and
    every presence check a caller then makes passes vacuously — so the reader
    must say that the artifact is the wrong kind rather than answer as though
    it were the right one. The refusal names the format it read.

    Background:
      Given the payload to sign
        | tid | at_abc |

    Scenario Outline: <wire>: the read is refused as a domain error naming the opaque format
      When I sign the payload as opaque content on the <wire> wire
      And I read the token without a key
      Then the keyless read is refused as a domain error "parse_requires_claims"
      And the refusal reports the format "<format>"

      Examples:
        | wire | format |
        | jose | jws    |
        | cose | cws    |

  Rule: the keyless claims read refuses an encrypted token rather than reporting a partial result

    An encrypted token's claims are ciphertext, so a keyless reader cannot
    see them at all. Anything it returned would be about the envelope and not
    the content, and a caller reading claims off such a result would be
    making decisions from an empty set while holding a token full of them.
    The refusal is what sends the caller to the verb that holds a key, and
    it names the format it read.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the text to encrypt "secret"

    Scenario Outline: <wire>: the read is refused as a domain error naming the encrypting format
      When I encrypt the text on the <wire> wire
      And I read the token without a key
      Then the keyless read is refused as a domain error "parse_requires_decrypt"
      And the refusal reports the format "<format>"

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |

  Rule: a sensitive claim sitting in cleartext is not surfaced by the keyless claims read either

    The confidentiality gate is a property of the claim and of how the token
    was carried, not of which door read it. A sensitive value that travelled
    unencrypted has already been disclosed to every intermediary, and
    surfacing it now would spread it further — into the caller's logs and its
    own storage — while telling the caller the marking did its job. A gate
    present at one reading door and absent at another is no gate: the value
    simply arrives through the other one. The claim reaches a cleartext wire
    through the raw claims door, because a mint encrypts such a claim or
    strips it. Suppressed means gone, not relocated: a claim demoted out of
    the sensitive bucket into the custom one is still disclosed.

    Background:
      Given the wire claims
        | iss                      | "https://test.lindorm.io/" |
        | sub                      | "user-1"                   |
        | aud                      | ["https://rs.lindorm.io/"] |
        | jti                      | "token-1"                  |
        | national_identity_number | "19900101-1234"            |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the token is read and no sensitive bucket is reported
      When I sign the wire claims as a claims token on the <wire> wire
      And I read the token without a key
      Then the parsed token is a "<format>"
      And the parsed token carries no sensitive bucket

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the sensitive claim does not reach the parsed claims
      When I sign the wire claims as a claims token on the <wire> wire
      And I read the token without a key
      Then the parsed claims carry no "nationalIdentityNumber"

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the sensitive claim is not demoted into the custom bucket
      When I sign the wire claims as a claims token on the <wire> wire
      And I read the token without a key
      Then the parsed custom bucket carries no "nationalIdentityNumber"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the keyless claims read handles the MAC-authenticated structure as well as the signed one

    The keyless read exists so a holder can see what a token says before
    deciding what to do with it — which key to fetch, which issuer to ask,
    whether to bother at all. That decision has to be available for every
    claims-bearing structure, or a deployment using the MAC-authenticated
    form is forced to verify first and inspect afterwards, which is exactly
    backwards: verification needs the very facts the read would have
    supplied. The vault also holds the baseline ES512 key, so the selector
    is what puts the shared secret in front of the mint. The jose wire has no
    scenario: JOSE has no separate MAC structure to read — one structure
    carries both digital signatures and MACs (RFC 7515 §1), so a
    MAC-authenticated JOSE claims token is a JWT and is already covered by the
    ordinary keyless read.

    Background:
      Given the vault also holds an HS256 signing key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint selects a signing key of the symmetric class

    Scenario: cose: the read reports the MAC-authenticated format
      When I mint the content under the "id_token" profile as a MAC-authenticated claims token
      And I read the token without a key
      Then the parsed token is a "cwm"

    Scenario: cose: the parsed claims are the content and the profile's issuer
      When I mint the content under the "id_token" profile as a MAC-authenticated claims token
      And I read the token without a key
      Then the parsed claims include
        | subject | user-1                   |
        | issuer  | https://test.lindorm.io/ |
