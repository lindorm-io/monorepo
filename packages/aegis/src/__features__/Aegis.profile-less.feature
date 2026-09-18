Feature: Signing and sealing without a profile

  `sign` and `encrypt` are the domain verbs that apply no profile: no floor,
  no generated envelope claim, and the caller's statements travel as given.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a signature made without a profile still writes domain claims under the registered wire keys

    A claim's wire spelling is fixed by specification, not by which verb wrote
    it. A token whose claims travelled under the caller's domain names would
    verify, and every audience would find it empty.

    Background:
      Given the claims to sign
        | subject  | user-1   |
        | tokenId  | token-1  |
        | clientId | client-1 |

    @RFC-7519
    Scenario: jose: the subject travels under its registered JWT claim name (RFC-7519 §4.1.2)
      When I sign the claims without a profile on the jose wire
      Then the raw payload carries "sub" "user-1"
      And the raw payload carries no "subject"

    @RFC-7519
    Scenario: jose: the token id travels under its registered JWT claim name (RFC-7519 §4.1.7)
      When I sign the claims without a profile on the jose wire
      Then the raw payload carries "jti" "token-1"
      And the raw payload carries no "tokenId"

    @RFC-8693
    Scenario: jose: the client id travels under its registered JWT claim name (RFC-8693 §4.3)
      When I sign the claims without a profile on the jose wire
      Then the raw payload carries "client_id" "client-1"
      And the raw payload carries no "clientId"

    @RFC-8392
    Scenario: cose: the subject travels under its registered CWT claim key (RFC-8392 §3.1.2)
      When I sign the claims without a profile on the cose wire
      Then the raw payload carries claim key 2 "user-1"
      And the raw payload carries none of "sub", "subject"

    @RFC-8392
    Scenario: cose: the token id travels under its registered CWT claim key (RFC-8392 §3.1.7)
      When I sign the claims without a profile on the cose wire
      Then the raw payload carries claim key 7 as the byte string "token-1"
      And the raw payload carries none of "jti", "tokenId"

    Scenario: cose: a claim without a registered CWT claim key travels under its text name
      When I sign the claims without a profile on the cose wire
      Then the raw payload carries "client_id" "client-1"
      And the raw payload carries no "clientId"

  Rule: a signature made without a profile carries exactly the claims it was given

    The profile is what generates an envelope — issuer, issue instant, token
    id, expiry — and enforces the policy that requires them. A verb that
    applies no profile asserts nothing on the issuer's behalf.

    Background:
      Given the claims to sign
        | subject | user-1 |

    Scenario Outline: <wire>: no envelope claim is added on the issuer's behalf
      When I sign the claims without a profile on the <wire> wire
      Then the raw payload carries none of <envelope claims>

      Examples:
        | wire | envelope claims                                                 |
        | jose | "iss", "iat", "exp", "jti", "nbf"                               |
        | cose | claim key 1, claim key 6, claim key 4, claim key 7, claim key 5 |

  Rule: a signature made without a profile stamps the token type the caller named

    Without a profile there is no mandated type, so the caller's own is the
    only statement available. Its spelling is aegis policy: the `application/`
    prefix is kept, and `+cwt` is an aegis construction with no registered
    structured suffix.

    Background:
      Given the claims to sign
        | subject | user-1 |
      And the token type "access_token"

    @RFC-8725
    Scenario: jose: the caller's token type is stamped as an explicit type (RFC-8725 §3.11)
      When I sign the claims without a profile on the jose wire
      Then the raw protected header declares the media type "application/at+jwt"

    @RFC-9596
    Scenario: cose: the type header is written protected, as a text string (RFC-9596 §2)
      When I sign the claims without a profile on the cose wire
      Then the raw protected header carries a text string at label 16
      And the raw unprotected header carries no label 16

    Scenario Outline: <wire>: the stamped type is spelled as a full media type with the wire's own suffix
      When I sign the claims without a profile on the <wire> wire
      Then the raw protected header carries <type key> "<media type>"

      Examples:
        | wire | type key | media type         |
        | jose | "typ"    | application/at+jwt |
        | cose | label 16 | application/at+cwt |

  Rule: a token signed without a profile is read back through the ordinary verify path

    The reader is told nothing about which verb wrote a token; it detects the
    wire from the bytes. A profile-less token that could not travel the normal
    read path would be a token only its author could use.

    Background:
      Given the claims to sign
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And the claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the ordinary verify accepts the token and reports its format
      When I sign the claims without a profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the verified result reports the claims that were signed
      When I sign the claims without a profile on the <wire> wire
      And I verify the token
      Then the verified claims include
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token type that has no structured media type stamps each wire's own conventional type header

    An ID Token is a plain JWT with no structured media type registered for it,
    so what remains is the conventional value of whichever format is written —
    and the two wires' conventional values are not one string.

    Background:
      Given the claims to sign
        | subject | user-1 |
      And the token type "id_token"

    @RFC-7519
    Scenario: jose: the type header takes the conventional JWT value (RFC-7519 §5.1)
      When I sign the claims without a profile on the jose wire
      Then the raw protected header carries "typ" "JWT"

    @RFC-9596
    @RFC-8392
    Scenario: cose: the type header carries the CWT media type (RFC-9596 §2) (RFC-8392 §9.2)
      When I sign the claims without a profile on the cose wire
      Then the raw protected header carries label 16 "application/cwt"

  Rule: an explicitly stated type header replaces the one derived from the token type, on both wires

    An issuer with no profile to obey is the only authority on what its token
    is for, and an explicit type is what lets a recipient refuse a token issued
    for something else (RFC 8725 §3.11). Honouring the statement on one wire
    and dropping it on the other would hand the caller a typed or an untyped
    token depending on a format choice made for unrelated reasons. The value is
    stated in the JOSE spelling on either wire, and each kit re-wraps the bare
    prefix in its own format — aegis policy, as the profiled mint's rewrite
    from `+jwt` to `+cwt` is.

    Background:
      Given the claims to sign
        | subject | user-1 |
      And the token type "access_token"
      And the type header "custom+jwt"

    Scenario Outline: <wire>: the stated type header is written in place of the one the token type derives
      When I sign the claims without a profile on the <wire> wire
      Then the raw protected header carries <type key> "<media type>"

      Examples:
        | wire | type key | media type             |
        | jose | "typ"    | application/custom+jwt |
        | cose | label 16 | application/custom+cwt |

  Rule: signing a payload without a profile refuses a scope list whose member contains a space

    The wire spelling of `scope` is one space-delimited string, so a member
    containing a space has no spelling whichever verb writes the token. The
    refusal is aegis policy at mint, at the same position and under the same
    code as the profiled mint's.

    Background:
      Given the claims to sign
        | subject | user-1 |
      And a scope list whose only member is "read write"

    Scenario Outline: <wire>: the signature is refused before anything is written
      When I sign the claims without a profile on the <wire> wire
      Then signing is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must not contain a space

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an encrypt refuses an option its wire cannot honour, rather than accepting and ignoring it

    An option a writer cannot act on has two honest dispositions: do it, or
    say so. A COSE_Encrypt0 carries no recipients and runs no recipient
    algorithm, so there is no key agreement to derive party info from. The
    jose wire honours the option, so there is no refusal to state on it.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |

    Scenario: cose: a party producer is refused rather than dropped
      When I encrypt the data on the cose wire with the party producer "cHJvZHVjZXI"
      Then encryption is refused as a domain error
      And the refusal reports format "cwe", operation "encryptContent" and option "partyProducer"

  Rule: a signed token wrapped in an encrypting envelope reports its own kind, with the envelope beside it

    A caller asking what a token is must get one answer whether or not the
    issuer chose to encrypt it: an encrypted id_token is an id_token, and
    encryption is how it travelled. Reporting the envelope as the kind forces
    every consumer routing on the kind to special-case encryption, and the ones
    that forget silently drop a whole class of valid credential — the claims
    are fully populated and only the tag says otherwise.

    Background:
      Given the vault also holds a dir encryption key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint is asked to seal the token

    Scenario Outline: <wire>: the verified result reports the signed token's kind, not the envelope's
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the verified result reports the envelope beside the kind
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token reports the wrapper "<wrapper>"

      Examples:
        | wire | wrapper |
        | jose | jwe     |
        | cose | cwe     |

    Scenario Outline: <wire>: the claims are the inner token's, fully populated
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified claims include
        | subject | user-1 |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token that seals content rather than a token reports itself, with no wrapper

    `encrypt` seals a value: there is no token inside it and nothing encloses
    it, so its own kind is the encrypting format. The presence of a wrapper is
    what tells a sealed value from a signed token in an envelope.

    Background:
      Given the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |

    Scenario Outline: <wire>: the sealed result reports the encrypting format as its own kind
      When I encrypt the data on the <wire> wire
      Then the sealed token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |

    Scenario Outline: <wire>: the sealed result reports no wrapper
      When I encrypt the data on the <wire> wire
      Then the sealed token reports no wrapper

      Examples:
        | wire |
        | jose |
        | cose |
