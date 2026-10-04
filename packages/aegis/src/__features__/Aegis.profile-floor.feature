Feature: The profile floor, applied to a token that arrived

  A profile's policy is enforced on the token a verifier receives, not only on
  the one this deployment mints: the issuer of a hostile token is not running
  our mint. The floor demands exactly what the profile declares, reads a
  structured claim in the domain vocabulary while the wire keeps the
  specification's spelling, and refuses a structure it cannot state.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token of one kind is refused when verified under the profile of another

    Explicit typing is what stops a token issued for one purpose being replayed
    where another is expected, and the access token has a media type of its own
    (RFC 8725 §3.11, RFC 9068 §2.1). Naming a profile is how a caller says
    which kind it expects, so the profile's type is checked against the
    token's — otherwise an id token, signed by the same issuer with the same
    key, is accepted wherever an access token is demanded. Checking the type
    is aegis policy: the best-current-practice recommends explicit typing and
    leaves the validation rule to the application.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And no access token is co-issued

    Scenario Outline: <wire>: an id token is refused where an access token is demanded
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "profile_typ_mismatch"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the profile's type is matched as a media type, so a short or differently cased spelling of it satisfies the profile

    A recipient using the type value must read it as if `application/` were
    prepended when the value carries no `/`, and a media type and its subtype
    are case insensitive (RFC 7515 §4.1.9, RFC 2045 §5.1); an access token may
    therefore arrive under either spelling and a resource server must accept
    both (RFC 9068 §4). Comparing the header verbatim refuses the shorter
    spelling every other issuer is free to emit, so a conformant token is
    rejected for how it spelled a type it got right. What widens is what a
    verifier accepts: our own mint keeps emitting the long form. The tokens are
    a third party's because aegis cannot write the short spelling, so one it
    wrote would prove nothing. Prepending on the COSE wire is aegis policy —
    RFC 9596 gives the parameter the same media type syntax and names no type
    of its own.

    Background:
      Given the wire claims
        | iss       | "https://test.lindorm.io/" |
        | sub       | "user-1"                   |
        | aud       | ["https://rs.lindorm.io/"] |
        | jti       | "token-1"                  |
        | client_id | "client-1"                 |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-9068
    Scenario: jose: an access token typed without the application prefix satisfies the profile (RFC-9068 §4)
      When a third party signs the wire claims on the jose wire, typed "at+jwt"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"

    Scenario: cose: an access token typed without the application prefix satisfies the profile
      When a third party signs the wire claims on the cose wire, typed "at+cwt"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "cwt"

    @RFC-7515
    Scenario: jose: an access token whose subtype is spelled in upper case satisfies the profile (RFC-7515 §4.1.9)
      When a third party signs the wire claims on the jose wire, typed "application/AT+jwt"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"

    Scenario: cose: an access token whose subtype is spelled in upper case satisfies the profile
      When a third party signs the wire claims on the cose wire, typed "application/AT+cwt"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "cwt"

    Scenario Outline: <wire>: a token naming another media type is still refused
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "profile_typ_mismatch"

      Examples:
        | wire | typ                    |
        | jose | application/logout+jwt |
        | cose | application/logout+cwt |

  Rule: the token type a verified header reports is the canonical one, whatever case the type arrived in

    A verifier that accepts `application/AT+jwt` as an access token has already
    decided the spelling says nothing (RFC 7515 §4.1.9), so the type it reports
    for that token is the type it accepted: a consumer left to fold the report
    itself is comparing letters, which is the comparison the floor does not
    make. Which name a type is reported under is aegis's own vocabulary and no
    specification's requirement. Nothing is lost by folding — the header type
    reports the typ exactly as the token carried it.

    Background:
      Given the wire claims
        | iss       | "https://test.lindorm.io/" |
        | sub       | "user-1"                   |
        | aud       | ["https://rs.lindorm.io/"] |
        | jti       | "token-1"                  |
        | client_id | "client-1"                 |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: an access token whose subtype is spelled in upper case is reported as an access token
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified header reports the token type "access_token"

      Examples:
        | wire | typ                |
        | jose | application/AT+jwt |
        | cose | application/AT+cwt |

    Scenario Outline: <wire>: the spelling the token arrived under stays readable as the header type
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified header reports the header type "<typ>"

      Examples:
        | wire | typ                |
        | jose | application/AT+jwt |
        | cose | application/AT+cwt |

  Rule: a token missing a claim its profile requires is refused when it is verified

    `iat` is REQUIRED in a JWT access token, and the same claim rides the COSE
    wire (RFC 8392 §3.1.6). A required-claim rule enforced only where this
    deployment mints constrains its own output and says nothing about the token
    that arrived, which is the only one a verifier defends against. Everything
    else the profile requires is present, so the refusal is attributable to
    this claim alone.

    Background:
      Given the wire claims
        | iss       | "https://test.lindorm.io/" |
        | sub       | "user-1"                   |
        | aud       | ["https://rs.lindorm.io/"] |
        | jti       | "token-1"                  |
        | client_id | "client-1"                 |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the claims token carries the type prefix "at"

    @RFC-9068
    Scenario: jose: the issue instant the access token profile requires is demanded on arrival (RFC-9068 §2.2)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "issuedAt": Required claim "issuedAt" is missing or empty

    Scenario: cose: the issue instant the access token profile requires is demanded on arrival
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "issuedAt": Required claim "issuedAt" is missing or empty

  Rule: a token missing a claim its profile does not require verifies

    The floor must demand exactly what the profile declares. `iat` is OPTIONAL,
    so a profile written for a third party's assertion does not require it, and
    a floor that demanded it anyway would refuse conformant tokens from every
    partner while reporting a policy violation the partner cannot act on. The
    profile decides, not the floor. The cose scenario carries no tag: the rule
    is the JWT specification's, and RFC 8392 §3.1.6 gives the CWT
    issue-instant claim the same meaning and processing rules by reference to
    it.

    Background:
      Given the wire claims
        | iss | "client-1"                   |
        | sub | "client-1"                   |
        | aud | ["https://test.lindorm.io/"] |
        | jti | "token-1"                    |
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "delegation"
      And the verifier expects the issuer "client-1"

    @RFC-7519
    Scenario: jose: an issue instant the profile does not name is not demanded (RFC-7519 §4.1.6)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then the verified token is a "jwt"
      And the verified claims include
        | issuer  | client-1 |
        | subject | client-1 |
        | tokenId | token-1  |

    Scenario: cose: an issue instant the profile does not name is not demanded
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then the verified token is a "cwt"
      And the verified claims include
        | issuer  | client-1 |
        | subject | client-1 |
        | tokenId | token-1  |

  Rule: an empty identifier handed to the raw signing door is left off the token, and the token is refused without it when it is verified

    The raw signing door prunes an empty `jti` — `cti` on the COSE wire — so
    the token it signs carries no identifier at all, and what the verifier
    judges is a claim that is absent, never one that is empty. The `delegation` profile requires the
    identifier, so the floor refuses the token on arrival for the claim it
    lacks: aegis policy at verify, because no specification defines that
    profile. The first scenario on each wire reads the absence off the wire,
    so the verdict judges a token that never carried the claim. The Rule
    below presents the empty value itself, on a token another producer
    wrote.

    Background:
      Given the wire claims
        | iss | "client-1"                   |
        | sub | "client-1"                   |
        | aud | ["https://test.lindorm.io/"] |
        | jti | ""                           |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "delegation"
      And the verifier expects the issuer "client-1"

    Scenario: jose: the empty identifier is left off the signed token
      When I sign the wire claims as a claims token on the jose wire
      Then the raw payload carries no "jti"

    Scenario: cose: the empty identifier is left off the signed token
      When I sign the wire claims as a claims token on the cose wire
      Then the raw payload carries no claim key 7

    Scenario Outline: <wire>: the token signed without its identifier is refused for the claim its profile requires
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "tokenId": Required claim "tokenId" is missing or empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a third party's token whose required identifier is the empty string is refused on arrival, as one without it is

    `jti` — `cti` on the COSE wire — is the token's identifier
    (RFC 7519 §4.1.7, RFC 8392 §3.1.7), the value a replay check keys on,
    and an identifier of `""` identifies nothing — every token carrying one
    collides with every other. A presence rule satisfied by an empty value
    guarantees nothing while reporting that it does, so the floor gives the
    empty identifier the refusal it gives an absent one: the same code, and
    one message naming both. Aegis's raw signing door leaves an empty
    identifier off the token, as the Rule above shows, so the token here is
    a third party's; on the COSE wire the third party writes the empty byte
    string at claim key 7. The first scenario on each wire reads the empty
    value off the wire, so the second judges the floor. Requiring the
    identifier is aegis policy at verify: no specification defines the
    `delegation` profile.

    Background:
      Given the wire claims
        | iss | "client-1"                   |
        | sub | "client-1"                   |
        | aud | ["https://test.lindorm.io/"] |
        | jti | ""                           |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the verifier expects the issuer "client-1"

    Scenario: jose: the empty identifier reaches the wire as the empty string
      When a third party signs the wire claims on the jose wire, typed "application/delegation+jwt"
      Then the raw payload carries "jti" ""

    Scenario: cose: the empty identifier reaches the wire as the empty byte string under claim key 7
      When a third party signs the wire claims on the cose wire, typed "application/delegation+cwt"
      Then the raw payload carries claim key 7 as the byte string ""

    Scenario Outline: <wire>: the empty identifier is refused as an absent one is
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "tokenId": Required claim "tokenId" is missing or empty

      Examples:
        | wire | typ                        |
        | jose | application/delegation+jwt |
        | cose | application/delegation+cwt |

  Rule: a token whose issuer is stated per call round-trips under the issuer the caller named

    Most profiles issue in the deployment's own name, but an assertion made by
    a client is issued by that client: `iss` names the principal that issued
    the token, and here the principal is the caller, not the platform. The
    issuer has to travel from the mint content to the wire claim and back — a
    mint that stamped the deployment's identity instead would produce a token
    the receiving party rejects for naming the wrong issuer, silently, because
    the token is otherwise well-formed. The cose scenario carries no tag: the
    claim name is the JWT specification's, and RFC 8392 §3.1.1 gives the CWT
    issuer claim the same meaning and processing rules by reference to it.

    Background:
      Given the content to mint
        | issuer  | client-1     |
        | subject | customer-sub |
      And an audience list whose only member is "https://test.lindorm.io/"
      And the verifier expects the issuer "client-1"

    @RFC-7519
    Scenario: jose: the caller's issuer travels under the registered JWT issuer claim (RFC-7519 §4.1.1)
      When I mint the content under the "delegation" profile on the jose wire
      Then the raw payload carries "iss" "client-1"

    Scenario: cose: the caller's issuer travels under the registered CWT issuer claim key
      When I mint the content under the "delegation" profile on the cose wire
      Then the raw payload carries claim key 1 "client-1"

    Scenario Outline: <wire>: the audience reads back the issuer the caller named
      When I mint the content under the "delegation" profile on the <wire> wire
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then the verified token is a "<format>"
      And the verified claims include
        | issuer  | client-1     |
        | subject | customer-sub |

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: minting a security event token whose subject identifier holds an empty member is refused

    A format's required members must not be null or empty — for `iss_sub`,
    both `iss` and `sub`, which the domain surface spells `issuer` and
    `subject`. An identifier whose required member is an empty string is not
    one, however well-formed it looks. It matters most on a security event
    token, whose whole purpose is to say that something happened to a specific
    subject: the `security_event` profile forbids a plain `sub` (aegis policy,
    for SSF conformance — `sub` is OPTIONAL in RFC 8417 §2.2), which leaves the
    subject identifier as the entire statement of who the event is about. The
    refusal names the position in the domain vocabulary the caller wrote the
    claim in.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject |                          |
      And an events map whose only event is "urn:lindorm:event:test"

    @RFC-9493
    Scenario Outline: <wire>: the mint is refused, naming the empty member (RFC-9493 §3.2.3)
      When I mint the content under the "security_event" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "subjectId.subject": subjectId of format "iss_sub" requires member "subject"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a subject identifier member is written and read back in the domain vocabulary while the wire keeps the RFC spelling

    The domain surface exists so a caller states claims in one vocabulary and
    never has to know the wire's: it takes `tokenId` and returns `tokenId`, it
    takes `streetAddress` for OpenID Connect Core 1.0 §5.1.1's `street_address`,
    and a Subject Identifier is no different. Its `phone_number` member is the
    only member of any structured claim spelled with an underscore, so a caller
    writing it would otherwise have had to know that this one structure
    answered in the wire's words. The wire is what interoperability is made of
    and keeps the RFC's own spelling; the two halves are stated together, which
    is what shows a translation happening rather than a key being copied.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format      | phone_number |
        | phoneNumber | +46700000000 |
      And an events map whose only event is "urn:lindorm:event:test"

    Scenario Outline: <wire>: the caller reads the identifier back in the vocabulary it wrote it in
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified subject identifier is exactly
        | format      | phone_number |
        | phoneNumber | +46700000000 |

      Examples:
        | wire |
        | jose |
        | cose |

    @RFC-9493
    Scenario Outline: <wire>: the wire spells the member as the Phone Number Identifier Format does (RFC-9493 §3.2.5)
      When I mint the content under the "security_event" profile on the <wire> wire
      Then the raw payload carries "sub_id" as the object
        """json
        { "format": "phone_number", "phone_number": "+46700000000" }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a subject identifier's issuer and subject are written and read back as `issuer` and `subject` while the wire keeps `iss` and `sub`

    The `iss_sub` format identifies a subject by the issuer that knows it and
    the subject it is known to that issuer as, carried as `iss` and `sub`. The
    domain surface spells the pair `issuer` and `subject` — the words it uses
    for the actor claim's own pair (RFC 8693 §4.1) and for the top-level
    claims — so a caller states them in one vocabulary wherever they appear.
    The wire keeps the RFC's spelling because a receiver of a security event
    token is not a lindorm consumer.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And an events map whose only event is "urn:lindorm:event:test"

    Scenario Outline: <wire>: the caller reads the pair back as issuer and subject
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified subject identifier is exactly
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |

      Examples:
        | wire |
        | jose |
        | cose |

    @RFC-9493
    Scenario Outline: <wire>: the wire spells the pair as the Issuer and Subject Identifier Format does (RFC-9493 §3.2.3)
      When I mint the content under the "security_event" profile on the <wire> wire
      Then the raw payload carries "sub_id" as the object
        """json
        { "format": "iss_sub", "iss": "https://test.lindorm.io/", "sub": "user-1" }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a security event's transaction identifier is written and read back as `transactionId` while the wire keeps `txn`

    A security event token may carry a transaction identifier, which
    correlates the related tokens of one transaction (RFC 8417 §2.2). The
    domain surface spells it `transactionId`, so a caller states it and reads
    it back in one vocabulary; a token read that left it under its wire
    spelling would hand back a claim the caller cannot name. The JWT keeps the
    registered `txn`, because a receiver of a security event token is not a
    lindorm consumer. The CWT carries the same text key — no CWT label is
    registered for it, and a three-character key encodes shorter than a
    private-use label — which is aegis policy rather than a requirement of
    RFC 8417 or RFC 8392.

    Background:
      Given the content to mint
        | transactionId | txn_abc |
      And an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And an events map whose only event is "urn:lindorm:event:test"

    Scenario Outline: <wire>: the caller reads the transaction identifier back under the name it wrote it in
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified claims include
        | transactionId | txn_abc |

      Examples:
        | wire |
        | jose |
        | cose |

    @RFC-8417
    Scenario: jose: the wire spells the transaction identifier as the registered SET claim (RFC-8417 §2.2)
      When I mint the content under the "security_event" profile on the jose wire
      Then the raw payload carries "txn" "txn_abc"

    Scenario: cose: the wire spells the transaction identifier under the same text key
      When I mint the content under the "security_event" profile on the cose wire
      Then the raw payload carries "txn" "txn_abc"

  Rule: a security event token another producer wrote is read back with its subject identifier's `iss` and `sub` as `issuer` and `subject`

    A subject identifier reaches a verifier in RFC 9493's own spelling — `iss`
    and `sub` for the `iss_sub` format (RFC 9493 §3.2.3) — whoever wrote the
    token, and the read surface answers in the domain vocabulary regardless of
    the producer. A translation applied only to tokens this package minted
    would hand a consumer two spellings of one member depending on where a
    token came from.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/"     |
        | aud    | ["https://receiver.lindorm.io/"] |
        | jti    | "set-2"                        |
        | events | { "urn:lindorm:event:test": {} } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claim "sub_id" is the object
        """json
        { "format": "iss_sub", "iss": "https://test.lindorm.io/", "sub": "user-1" }
        """

    Scenario Outline: <wire>: the identifier is read back in the domain vocabulary whoever wrote the token
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified subject identifier is exactly
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |

      Examples:
        | wire | typ                      |
        | jose | application/secevent+jwt |
        | cose | application/secevent+cwt |

  Rule: minting a security event token whose subject identifier spells its issuer and subject as `iss` and `sub` is refused

    The domain surface spells the `iss_sub` pair `issuer` and `subject`; `iss`
    and `sub` are the wire's names (RFC 9493 §3.2.3), and inside a domain bag
    they are undeclared members. The set of Identifier Formats is open — a
    format is named in the IANA registry or by a Collision-Resistant Name
    (RFC 9493 §3) — so a member aegis does not declare may belong to a
    format aegis does not know. Carrying such a member under its own
    spelling rather than dropping it is aegis policy, and these two land on
    the keys the declared members own. On `security_event` the profile's
    shape rule reads the bag before any wire is assembled and answers first,
    in the vocabulary the caller writes in, with both halves of
    RFC 9493 §3's sentence on a Subject Identifier's members at once: the
    members the format requires are absent, and the two it carries instead
    are members that format does not describe.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format | iss_sub                  |
        | iss    | https://test.lindorm.io/ |
        | sub    | user-1                   |
      And an events map whose only event is "urn:lindorm:event:test"

    Scenario Outline: <wire>: the profile's shape rule answers first, in the vocabulary the caller writes in
      When I mint the content under the "security_event" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and lists the faults
        | key               | message                                                    |
        | subjectId.issuer  | subjectId of format "iss_sub" requires member "issuer"     |
        | subjectId.subject | subjectId of format "iss_sub" requires member "subject"    |
        | subjectId.iss     | subjectId of format "iss_sub" does not describe member "iss" |
        | subjectId.sub     | subjectId of format "iss_sub" does not describe member "sub" |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose subject identifier spells its issuer and subject as `iss` and `sub` is refused under a profile that states no shape rule

    The set of Identifier Formats is open — a format is named in the IANA
    registry or by a Collision-Resistant Name (RFC 9493 §3) — so a member
    aegis does not declare may belong to a format aegis does not know, and
    aegis policy carries it under the producer's own spelling rather than
    dropping it. `iss` and `sub` are the wire spellings of the declared
    `issuer` and `subject` (RFC 9493 §3.2.3): in a domain bag they are
    undeclared, and their outgoing keys are the ones the declared members own.
    Two members meeting on one key are refused in every open structure rather
    than settled by key order, and the refusal names the pair at its position.
    The rule is the structure's own and holds under every profile, so it is
    stated under one that declares no shape rule for the claim.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the subject identifier
        | format | iss_sub                  |
        | iss    | https://test.lindorm.io/ |
        | sub    | user-1                   |

    Scenario Outline: <wire>: two members meeting on one wire key are refused at their position
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "subjectId" and lists the faults
        | key           | message                                                        |
        | subjectId.iss | Members "iss" and "issuer" both resolve to "iss" in "subjectId" |
        | subjectId.sub | Members "sub" and "subject" both resolve to "sub" in "subjectId" |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token another producer wrote whose subject identifier spells its issuer and subject as `issuer` and `subject` is refused on read

    On the wire the `iss_sub` pair is `iss` and `sub` (RFC 9493 §3.2.3), so a
    wire `issuer` or `subject` is a member aegis does not declare. The set of
    Identifier Formats is open — a format is named in the IANA registry or by
    a Collision-Resistant Name (RFC 9493 §3) — so such a member may belong to
    a format aegis does not know, and aegis policy carries it rather than
    dropping it. These two would be carried onto the very names the declared
    members are read back under, so a token no RFC 9493 receiver reads as
    naming a subject would be read as naming one here. Each arrives alone,
    with no declared member beside it to collide with, so the refusal rests
    on the declared members' names being reserved whether or not those
    members are present, and it names each pair at its position. The rule is
    the structure's own and holds under every profile, so the token is
    verified under none; the keyless read refuses it too, since that is the
    door a stranger's payload reaches before any signature is checked. Aegis
    policy on read.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire claim "sub_id" is the object
        """json
        { "format": "iss_sub", "issuer": "https://rogue.example/", "subject": "rogue-subject" }
        """

    Scenario Outline: <wire>: the verify is refused, naming each pair at its position
      When a third party signs the wire claims on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "subjectId" and lists the faults
        | key               | message                                                              |
        | subjectId.issuer  | Members "iss" and "issuer" both resolve to "issuer" in "subjectId"   |
        | subjectId.subject | Members "sub" and "subject" both resolve to "subject" in "subjectId" |

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the keyless read is refused on the same faults
      When a third party signs the wire claims on the <wire> wire
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "subjectId" and lists the faults
        | key               | message                                                              |
        | subjectId.issuer  | Members "iss" and "issuer" both resolve to "issuer" in "subjectId"   |
        | subjectId.subject | Members "sub" and "subject" both resolve to "subject" in "subjectId" |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a subject identifier rides the compact COSE encoding at its private-use claim key, its members at their labels

    The compact encoding is a size decision: it keys the claim at a claim key
    below -65536, which is private use (RFC 8392 §9.1.1), and each declared
    member at an integer label, so a verifier holding aegis's registry reads
    the same identifier from fewer bytes and no other reader reads it at all.
    The `iss_sub` pair takes labels 1 and 2, the claim keys `iss` and `sub`
    have in a CWT (RFC 8392 §4), and the format takes label 0. The raw map is
    compared as a map, so an integer label cannot pass for its own text
    spelling. Aegis policy at mint. The jose wire has no scenario: the
    compact label map is a COSE encoding, and a JSON object has one kind of
    key (RFC 8259 §4), so a JOSE member has one spelling and no second
    encoding.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://idp.lindorm.test |
        | subject | subject-1                |
      And the mint is asked for the compact COSE encoding

    Scenario: cose: the identifier rides at claim key -65549 as a map keyed by the labels 0, 1 and 2
      When I mint the content under the "default" profile on the cose wire
      Then the raw payload carries claim key -65549 as the map
        | key | keyed by | value                      |
        | 0   | label    | "iss_sub"                  |
        | 1   | label    | "https://idp.lindorm.test" |
        | 2   | label    | "subject-1"                |

  Rule: a security event token whose subject identifier names an unmodelled Identifier Format is minted and verified

    An Identifier Format's name is either registered or a Collision-Resistant
    Name, and the second needs no registration at all (RFC 9493 §3), so a
    conformant transmitter can name a format this implementation has never
    heard of. A format may also describe more members than are strictly
    necessary, so what those members are is that format's business. An
    unmodelled format therefore carries no per-format demand and the identifier
    travels intact, through both doors, since the per-format table is consulted
    at mint and again on the verify floor. The name is drawn from
    `Object.prototype` on purpose: a lookup reached by such a name must answer
    "unknown format", and any other answer is the implementation's own
    vocabulary leaking into the specification's.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format | constructor |
        | id     | subject-1   |
      And an events map whose only event is "urn:lindorm:event:test"

    Scenario Outline: <wire>: the identifier is carried through both doors intact
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified subject identifier is exactly
        | format | constructor |
        | id     | subject-1   |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a security event token whose subject identifier carries a member its format does not describe is refused

    A Subject Identifier must not contain any member prohibited or not
    described by its Identifier Format, and the Email Identifier Format
    describes `email` alone. An identifier carrying a `uri` beside it names the
    subject twice under a format that defines one way of naming it: two
    receivers reading the same signed token resolve two subjects. The ceiling
    is the specification's and holds at the verify door for that reason. The
    door is the verifying one because aegis refuses such an identifier at mint
    before any wire is assembled, which leaves a token written elsewhere as the
    only one that can reach the floor carrying it.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/"     |
        | aud    | ["https://receiver.lindorm.io/"] |
        | jti    | "set-3"                        |
        | events | { "urn:lindorm:event:test": {} } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claim "sub_id" is the object
        """json
        { "format": "email", "email": "user@example.com", "uri": "https://user.example.com/" }
        """

    @RFC-9493
    Scenario Outline: <wire>: the verify is refused, naming the undescribed member (RFC-9493 §3) (RFC-9493 §3.2.2)
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "subjectId.uri": subjectId of format "email" does not describe member "uri"

      Examples:
        | wire | typ                      |
        | jose | application/secevent+jwt |
        | cose | application/secevent+cwt |

  Rule: minting a security event token whose alias list holds an aliases identifier is refused at the position that holds it

    "aliases" Subject Identifiers must not be nested. An alias list states
    alternate names for one entity so that a receiver can act on whichever it
    recognises, and a list holding a list is no longer that statement — the
    same token reads as one set of names or as several, depending on how deep
    the receiver looks. An alias list is unbounded, so it is the identifier at
    the position that is refused rather than the claim; a refusal stopping at
    `subjectId` would leave the caller searching it for the one element that
    has to change.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier is the object
        """json
        {
          "format": "aliases",
          "identifiers": [
            { "format": "email", "email": "user@example.com" },
            { "format": "aliases", "identifiers": [{ "format": "opaque", "id": "11112222333344445555" }] }
          ]
        }
        """
      And an events map whose only event is "urn:lindorm:event:test"

    @RFC-9493
    Scenario Outline: <wire>: the mint is refused at the nested identifier's position (RFC-9493 §3.2.8)
      When I mint the content under the "security_event" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "subjectId.identifiers[1]": subjectId.identifiers[1] must not be an identifier of format "aliases"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: verifying a security event token another producer wrote whose alias list holds an aliases identifier is refused

    The nesting ban is the specification's and a verifier is reading someone
    else's token, so the door that matters is the reading one: a transmitter
    that emits a nested alias list is exactly the party this deployment cannot
    correct. Nothing upstream of the profile gate refuses it — the claim
    registry declares the alias element as the same open member set at every
    depth, so the read translates the nested identifier faithfully and hands it
    on. The entry names the position, in the domain vocabulary the read answers
    in.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/"     |
        | aud    | ["https://receiver.lindorm.io/"] |
        | jti    | "set-4"                        |
        | events | { "urn:lindorm:event:test": {} } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claim "sub_id" is the object
        """json
        {
          "format": "aliases",
          "identifiers": [
            { "format": "email", "email": "user@example.com" },
            { "format": "aliases", "identifiers": [{ "format": "opaque", "id": "11112222333344445555" }] }
          ]
        }
        """

    @RFC-9493
    Scenario Outline: <wire>: the verify is refused at the nested identifier's position (RFC-9493 §3.2.8)
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then verification is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "verify" and locates the fault at "subjectId.identifiers[1]": subjectId.identifiers[1] must not be an identifier of format "aliases"

      Examples:
        | wire | typ                      |
        | jose | application/secevent+jwt |
        | cose | application/secevent+cwt |

  Rule: a security event token whose subject identifier aliases several formats is minted and read back at every depth

    The Aliases Identifier Format identifies one entity by a list of Subject
    Identifiers, for a receiver that may recognise only some of them. Each
    element is a Subject Identifier in its own right: it names its own format,
    carries that format's members, and is translated at its own depth —
    `phoneNumber` reaches the wire as `phone_number` inside an element exactly
    as it does at the surface. A list whose every element is conformant is
    minted and read back with each element intact, which is the accepting half
    of the member rule (RFC 9493 §3).

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier is the object
        """json
        {
          "format": "aliases",
          "identifiers": [
            { "format": "email", "email": "user@example.com" },
            { "format": "phone_number", "phoneNumber": "+12065550100" },
            { "format": "opaque", "id": "11112222333344445555" }
          ]
        }
        """
      And an events map whose only event is "urn:lindorm:event:test"

    @RFC-9493
    Scenario Outline: <wire>: every element is read back intact at its own depth (RFC-9493 §3.2.8)
      When I mint the content under the "security_event" profile on the <wire> wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified subject identifier is exactly the object
        """json
        {
          "format": "aliases",
          "identifiers": [
            { "format": "email", "email": "user@example.com" },
            { "format": "phone_number", "phoneNumber": "+12065550100" },
            { "format": "opaque", "id": "11112222333344445555" }
          ]
        }
        """

      Examples:
        | wire |
        | jose |
        | cose |

    @RFC-9493
    Scenario Outline: <wire>: each element keeps its format's own spelling on the wire (RFC-9493 §3.2.5)
      When I mint the content under the "security_event" profile on the <wire> wire
      Then the raw payload carries "sub_id" as the object
        """json
        {
          "format": "aliases",
          "identifiers": [
            { "format": "email", "email": "user@example.com" },
            { "format": "phone_number", "phone_number": "+12065550100" },
            { "format": "opaque", "id": "11112222333344445555" }
          ]
        }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose authorization detail carries an empty type is refused

    `type` is REQUIRED on every authorization details element, and its value
    determines the allowable contents of the object that contains it — it is
    the identifier a resource server dispatches on. An element typed with an
    empty string names no type, so nothing can be looked up to interpret the
    rest of the element, while the token appears to carry a granted
    authorization. The demand is the claim's own shape, not one profile's
    appetite, so it is stated under a profile that says nothing about
    authorization details at all.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And the content expires in "1h"
      And an audience list whose only member is "https://rs.lindorm.io/"
      And an authorization details list whose only element is the object
        """json
        { "type": "" }
        """

    @RFC-9396
    Scenario Outline: <wire>: the mint is refused, naming the element's type member (RFC-9396 §2)
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "authorizationDetails" and locates the fault at "authorizationDetails[0].type": Member "type" is required and must not be empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: verifying a token whose authorization detail carries no type at all is refused

    `type` determines the allowable contents of the element that carries it,
    so a presented element without one has no defined contents to read.
    Neither silent disposition is honest: dropping the element reports fewer
    authorizations than the token states, and keeping it hands a resource
    server a grant nobody defined. A producer that is not aegis wrote this
    element, so the write-side refusal never saw it; only the read can speak
    about it.

    Background:
      Given the wire claims
        | iss                   | "https://test.lindorm.io/"                   |
        | sub                   | "user-1"                                     |
        | aud                   | ["https://rs.lindorm.io/"]                   |
        | jti                   | "token-1"                                    |
        | authorization_details | [{ "locations": ["https://rs.lindorm.io/"] }] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-9396
    Scenario Outline: <wire>: the verify is refused, naming the element's type member (RFC-9396 §2)
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "authorizationDetails" and locates the fault at "authorizationDetails[0].type": Member "type" is required and must not be empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: verifying a token whose authorization detail is typed with an empty string is refused

    `type` is required, and its value is what determines the allowable
    contents of the element — so the demand is for an identifier, not for the
    key being spelled. An empty string is a present key naming no type at all.
    A reader that accepted it would let a producer satisfy the requirement by
    writing the field and leaving it blank, which is the requirement not
    existing.

    Background:
      Given the wire claims
        | iss                   | "https://test.lindorm.io/" |
        | sub                   | "user-1"                   |
        | aud                   | ["https://rs.lindorm.io/"] |
        | jti                   | "token-1"                  |
        | authorization_details | [{ "type": "" }]           |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-9396
    Scenario Outline: <wire>: the verify is refused, since a present key naming no type is no type (RFC-9396 §2)
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "authorizationDetails" and locates the fault at "authorizationDetails[0].type": Member "type" is required and must not be empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the keyless read of a token whose authorization detail names no type is refused, and reports no other claim either

    A keyless read skips the signature and the profile floor; it does not skip
    deciding what the token says, and that is the whole of what it returns. An
    element without a `type` has no contents to report, and a reader that
    answered anyway would be publishing an interpretation of a structure it
    cannot interpret, with no signature check behind it to qualify the answer.
    The cost is stated rather than discovered: the read is all-or-nothing, so
    one malformed claim denies the caller every other claim in the token.

    Background:
      Given the wire claims
        | iss                   | "https://test.lindorm.io/"                   |
        | sub                   | "user-1"                                     |
        | aud                   | ["https://rs.lindorm.io/"]                   |
        | jti                   | "token-1"                                    |
        | authorization_details | [{ "locations": ["https://rs.lindorm.io/"] }] |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-9396
    Scenario Outline: <wire>: the keyless read is refused rather than reporting an interpretation (RFC-9396 §2)
      When I sign the wire claims as a claims token on the <wire> wire
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "authorizationDetails" and locates the fault at "authorizationDetails[0].type": Member "type" is required and must not be empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: verifying a token whose authorization details claim is a bare string is refused

    The claim carries an array of objects, each holding the data for one type
    of resource. A scalar is not a shorter form of that array — there is no
    element for a `type` to scope, and nothing a resource server could
    dispatch on — so a token stating one grants nothing that can be read, while
    a reader that silently discarded the claim would report a token that made
    no authorization statement when its issuer signed one.

    Background:
      Given the wire claims
        | iss                   | "https://test.lindorm.io/" |
        | sub                   | "user-1"                   |
        | aud                   | ["https://rs.lindorm.io/"] |
        | jti                   | "token-1"                  |
        | authorization_details | "payment_initiation"       |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-9396
    Scenario: jose: the verify is refused, since the registered claim is an array of objects (RFC-9396 §14.2)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "authorizationDetails" and locates the fault at "authorizationDetails": Claim "authorizationDetails" must be an array

    Scenario: cose: the verify is refused, since the claim is an array of objects
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "authorizationDetails" and locates the fault at "authorizationDetails": Claim "authorizationDetails" must be an array

  Rule: a scope string another producer wrote in the scope-token grammar is read as the list it spells

    The wire form of `scope` is one string of scope-tokens separated by single
    spaces, the grammar RFC 8693 §4.2 takes from RFC 6749 §3.3, while the
    domain speaks the list. A string inside that grammar has exactly one
    reading, so both read doors report the members its spaces delimit.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | "openid profile"           |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify reads the string as the list it spells
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified claims list the scope "openid", "profile"

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the keyless read reads the string as the list it spells
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the parsed claims list the scope "openid", "profile"

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a scope another producer wrote as the empty string is read as the empty list

    The grammar has no empty scope-token, so the empty string sits outside it,
    yet it is the only spelling the wire form has for a grant of nothing, and
    aegis writes it for an explicitly empty list. Reading it as the empty list
    is aegis policy: refusing it would refuse aegis's own empty grant, and
    dropping it would erase the one statement that tells an empty grant apart
    from an absent one.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | ""                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify reads the empty string as the empty list
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified claims list an empty scope

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the keyless read reads the empty string as the empty list
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the parsed claims list an empty scope

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a token whose scope string carries a character outside the scope-token grammar is refused on read

    A scope-token admits no double quote, so this string is outside the grammar
    RFC 8693 §4.2 takes from RFC 6749 §3.3. That grammar binds the server that
    issues a scope and tells a recipient nothing, so the refusal is aegis
    policy. Splitting the string anyway reports a grant the grammar cannot
    state; dropping the claim reports a token granting nothing where its issuer
    signed a grant. The refusal locates the fault at the member the spaces
    delimit.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | "a\"b c"                   |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify is refused, locating the fault at the member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must contain only scope-token characters (RFC 6749 §3.3)

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the keyless read is refused, locating the fault at the member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must contain only scope-token characters (RFC 6749 §3.3)

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a token whose scope string carries two spaces in a row is refused on read, not read past

    Two spaces in a row delimit an empty member, and the grammar has no empty
    scope-token. Filtering the empty member out reads the string as a list the
    grammar would have spelled differently, and the reader cannot tell a
    careless join from a member that was lost. Aegis policy, as for every
    string outside the grammar: the refusal locates the fault at the empty
    member.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | "openid  profile"          |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify is refused, locating the fault at the empty member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[1]": Member "scope[1]" must not be empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the keyless read is refused, locating the fault at the empty member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[1]": Member "scope[1]" must not be empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a token whose scope string opens with a space is refused on read

    A leading space delimits an empty first member, which the grammar has no
    scope-token for. Aegis policy, as for every string outside the grammar: the
    refusal locates the fault at the empty member.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | " openid"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify is refused, locating the fault at the empty first member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must not be empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the keyless read is refused, locating the fault at the empty first member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[0]": Member "scope[0]" must not be empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a token whose scope string ends with a space is refused on read

    A trailing space delimits an empty last member, which the grammar has no
    scope-token for. Aegis policy, as for every string outside the grammar: the
    refusal locates the fault at the empty member.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | "openid "                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify is refused, locating the fault at the empty last member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[1]": Member "scope[1]" must not be empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the keyless read is refused, locating the fault at the empty last member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "scope" and locates the fault at "scope[1]": Member "scope[1]" must not be empty

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: a security event token carrying no expiry verifies under the profile that issues it

    `exp` is NOT RECOMMENDED in a security event token, so a conformant SET
    normally carries none, while an access token with none never stops
    working — the same absence, opposite consequences. Expiry presence is
    consequently the profile's policy to state: a profile declaring a lifetime
    keeps the requirement, one declaring none waives it, or this package cannot
    issue the shape its own specification recommends. The premise is read off
    the wire, since a verify under this profile would pass a token that did
    carry an expiry identically; and both statements a security event makes
    are read back under their domain names, which is what shows the profile is
    usable and not merely acceptable. A SET is a JWT (RFC 8417 §1.2), so the
    jose scenarios carry the tag; the cose twins carry none, because on that
    wire the rule is aegis policy: no document defines a security event token
    as a CWT.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And an events map whose only event is "urn:lindorm:event:test"

    @RFC-8417
    Scenario: jose: the minted security event carries no expiry (RFC-8417 §2.2)
      When I mint the content under the "security_event" profile on the jose wire
      Then the raw payload carries no "exp"

    Scenario: cose: the minted security event carries no expiry
      When I mint the content under the "security_event" profile on the cose wire
      Then the raw payload carries no claim key 4

    @RFC-8417
    Scenario: jose: the token verifies, and both statements a security event makes are read back (RFC-8417 §2.2)
      When I mint the content under the "security_event" profile on the jose wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified token is a "jwt"
      And the verified subject identifier is exactly
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And the verified claims carry the event "urn:lindorm:event:test" with an empty payload

    Scenario: cose: the token verifies, and both statements a security event makes are read back
      When I mint the content under the "security_event" profile on the cose wire
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified token is a "cwt"
      And the verified subject identifier is exactly
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And the verified claims carry the event "urn:lindorm:event:test" with an empty payload

  Rule: a security event whose payload is not a JSON object is refused at every door, with or without a profile

    The `events` claim names each event by URI, and the value under each name
    is the event statement: RFC 8417 §2.2 requires every one to be a JSON
    object, which may be empty. A string under an event's name is no statement
    a receiver can read, so a writer carrying it issues a token that is not a
    SET, and a reader handing it on gives the consumer a string where an event
    statement belongs. The requirement is the claim's own rather than one
    profile's, so it holds at aegis's write doors and on a third party's token
    alike, with or without a profile. A verify without a profile demands an
    expiry, so the token it reads carries one; the third party's other tokens
    carry none, as a security event normally does. A verify reads the token's
    claims before it applies the profile floor, so under a profile that states
    the claim's shape rule it is still the claim's own refusal that answers;
    which layer answers is aegis's layer order, so that scenario carries no
    tag. A SET is a JWT (RFC 8417 §1.2), so the other jose scenarios carry the
    tag and their cose twins do not. On the cose wire the refusal is aegis
    policy: no document gives a CWT `events` claim a meaning, and
    `claims.events` reads the same on both wires.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/"             |
        | aud    | ["https://receiver.lindorm.io/"]       |
        | jti    | "set-1"                                |
        | events | { "urn:lindorm:event:test": "scalar" } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claim "sub_id" is the object
        """json
        { "format": "iss_sub", "iss": "https://test.lindorm.io/", "sub": "user-1" }
        """
      And the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the events claim is the object
        """json
        { "urn:lindorm:event:test": "scalar" }
        """

    @RFC-8417
    Scenario: jose: a mint under a profile that states no shape rule for the claim is refused, naming the event (RFC-8417 §2.2)
      When I mint the content under the "default" profile on the jose wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    Scenario: cose: a mint under a profile that states no shape rule for the claim is refused, naming the event
      When I mint the content under the "default" profile on the cose wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    @RFC-8417
    Scenario: jose: a signature without a profile is refused, naming the event (RFC-8417 §2.2)
      When I sign the claims without a profile on the jose wire
      Then signing is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    Scenario: cose: a signature without a profile is refused, naming the event
      When I sign the claims without a profile on the cose wire
      Then signing is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    @RFC-8417
    Scenario: jose: the verify of a third party's token is refused, naming the event (RFC-8417 §2.2)
      Given the wire claims expire at "2024-01-01T09:00:00.000Z"
      When a third party signs the wire claims on the jose wire, typed "application/secevent+jwt"
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    Scenario: cose: the verify of a third party's token is refused, naming the event
      Given the wire claims expire at "2024-01-01T09:00:00.000Z"
      When a third party signs the wire claims on the cose wire, typed "application/secevent+cwt"
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    @RFC-8417
    Scenario: jose: the keyless read of a third party's token is refused, naming the event (RFC-8417 §2.2)
      When a third party signs the wire claims on the jose wire, typed "application/secevent+jwt"
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    Scenario: cose: the keyless read of a third party's token is refused, naming the event
      When a third party signs the wire claims on the cose wire, typed "application/secevent+cwt"
      And I read the token without a key
      Then the keyless read is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

    Scenario Outline: <wire>: a verify under a profile that states the claim's shape rule is answered by the claim's own refusal, which runs before the floor
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "events" and locates the fault at "events.urn:lindorm:event:test": Member "urn:lindorm:event:test" must be an object

      Examples:
        | wire | typ                      |
        | jose | application/secevent+jwt |
        | cose | application/secevent+cwt |

    @RFC-8417
    Scenario: jose: an event whose payload is the empty object verifies under the same profile (RFC-8417 §2.2)
      Given the wire claim "events" is the object
        """json
        { "urn:lindorm:event:test": {} }
        """
      When a third party signs the wire claims on the jose wire, typed "application/secevent+jwt"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified claims carry the event "urn:lindorm:event:test" with an empty payload

    Scenario: cose: an event whose payload is the empty object verifies under the same profile
      Given the wire claim "events" is the object
        """json
        { "urn:lindorm:event:test": {} }
        """
      When a third party signs the wire claims on the cose wire, typed "application/secevent+cwt"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified claims carry the event "urn:lindorm:event:test" with an empty payload

  Rule: minting a security event token whose event payload is not a JSON object is refused by the profile floor, which runs before the claim's own refusal

    Under a profile that states the `events` shape rule — here
    `security_event` — the payload fault is the profile's to report as well
    as the claim's. A mint runs the profile floor before it assembles the
    wire, so the floor answers first, with its own code and in the vocabulary
    the caller writes in, and the claim's own refusal never runs. Which layer
    answers is aegis's layer order at mint; the token is refused either way.

    Background:
      Given an audience list whose only member is "https://receiver.lindorm.io/"
      And the subject identifier
        | format  | iss_sub                  |
        | issuer  | https://test.lindorm.io/ |
        | subject | user-1                   |
      And the events claim is the object
        """json
        { "urn:lindorm:event:test": "scalar" }
        """

    Scenario Outline: <wire>: the floor answers first, naming the event's payload
      When I mint the content under the "security_event" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "events.urn:lindorm:event:test": event "urn:lindorm:event:test" payload must be an object

      Examples:
        | wire |
        | jose |
        | cose |
