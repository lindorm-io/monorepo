Feature: The opaque signed artifact and the raw wire doors

  Below the domain verb sit the doors that speak a wire's own vocabulary: the
  opaque signature over content the issuer alone interprets, and the raw
  claims and opaque verify doors that thread the caller's options by hand. An
  opaque artifact makes no claims, so it is delivered whole and the claim
  buckets are left empty. A raw door honours the same options the domain
  door honours, refuses a type of another family, and accepts a token that
  declares no type at all — presence is the application's policy, and the
  raw door is not the application.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: an opaque signed token delivers its payload as itself, with no claims resolved from it

    An opaque signed artifact is a signature over content the issuer alone
    interprets — a handle, a state blob — and it makes no claims. Resolving
    its content into claim buckets would report statements nobody made: a
    key that happens to be spelled like a registered claim would arrive
    under that claim's meaning and be believed by anything that reads the
    bucket. The payload therefore has to be delivered whole and the claim
    buckets left empty. `tid` and `sec` are unregistered on purpose, so the
    buckets can only be empty because nothing was resolved.

    Background:
      Given the payload to sign
        | tid | at_abc |
        | sec | s3cr3t |

    Scenario Outline: <wire>: the domain verify reports the opaque format
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jws    |
        | cose | cws    |

    Scenario Outline: <wire>: the payload is delivered whole as the opaque payload
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token
      Then the verified opaque payload includes
        | tid | at_abc |
        | sec | s3cr3t |

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: no claim is resolved from the payload
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token
      Then the verified claim buckets are empty

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an opaque signed token round-trips a string payload byte for byte

    The content type an opaque artifact negotiates decides how its payload is
    reconstructed, and a string that came back as anything else — a byte
    buffer, a parsed object, a truncation — would break every caller that
    signed one to hand it back to itself later. Verbatim is the only useful
    contract for content the package does not interpret, and a string is
    compared whole.

    Background:
      Given the text to sign "not-a-map"

    Scenario Outline: <wire>: the string comes back as the same string
      When I sign the text as opaque content on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified opaque payload is the text "not-a-map"

      Examples:
        | wire | format |
        | jose | jws    |
        | cose | cws    |

  Rule: an opaque signed token declares a media type that names it opaque, not claims-bearing

    Explicit typing is what stops a token of one kind being taken for
    another (RFC 8725 §3.11), and an opaque signature and a claims token are
    exactly two such kinds: they are the same structure with different
    contents. The media type is the only thing distinguishing them before the
    payload is read, so an opaque artifact typed as a claims token would be
    handed to a claims reader that finds none — and a caller routing on the
    declaration would treat a handle as a credential. The spelling is aegis
    policy: `application/<prefix>+jws` and `application/<prefix>+cws`, whose
    suffixes are constructions of this package and not registered structured
    syntax suffixes. The cose scenario carries no tag: RFC 8725 is JWT
    practice, and the COSE type parameter's own document is one this row does
    not cite.

    Background:
      Given the payload to sign
        | tid | at_abc |
      And the opaque signature carries the type prefix "at"

    @RFC-8725
    Scenario: jose: the type header names the opaque JWS family with the caller's prefix (RFC-8725 §3.11)
      When I sign the payload as opaque content on the jose wire
      Then the raw protected header carries "typ" "application/at+jws"

    Scenario: cose: the type header at its label names the opaque CWS family with the caller's prefix
      When I sign the payload as opaque content on the cose wire
      Then the raw protected header carries label 16 "application/at+cws"

  Rule: an opaque signed artifact verifies through its own raw door and returns the payload it was signed over

    A signature covers an arbitrary sequence of octets (RFC 7515 §1), so the
    opaque door is the one a caller uses for a payload that is not a claim
    set — a stored blob, an encoded record — and it is a separate forward
    from the claims door with its own key resolution and its own verify call.
    A door that could sign but not verify would leave every such artifact
    unreadable by the package that wrote it, and there would be no other
    surface to reach it from: the claims reader refuses an opaque artifact by
    design rather than returning an empty claim set. The payload is compared
    whole, so a door that accepted the signature and returned something else
    would not pass. The cose scenario carries no tag: the row cites the JWS
    document alone.

    Background:
      Given the payload to sign
        | tid   | at_abc |
        | scope | openid |

    @RFC-7515
    Scenario: jose: the opaque door accepts the signature and returns the payload it covers (RFC-7515 §1)
      When I sign the payload as opaque content on the jose wire
      And I verify the token as opaque content on the jose wire
      Then the raw door accepts the token
      And the raw door reports the payload
        | tid   | at_abc |
        | scope | openid |

    Scenario: cose: the opaque door accepts the signature and returns the payload it covers
      When I sign the payload as opaque content on the cose wire
      And I verify the token as opaque content on the cose wire
      Then the raw door accepts the token
      And the raw door reports the payload
        | tid   | at_abc |
        | scope | openid |

  Rule: the opaque verify refuses a token whose protected type names the claims-token family

    Explicit typing exists so that a token of one kind is never processed as
    another (RFC 8725 §3.11 on JOSE; RFC 9596 §3 on COSE, which asks an
    application employing it to reject a type it does not expect), and an
    opaque signature and a claims token are exactly two such kinds over the
    same structure. A claims token read through the opaque door would come
    back as bytes nobody validated — no expiry, audience or issuer checked —
    under a result that says the signature held. The type is the one thing
    that tells the kinds apart before the payload is read, so a present type
    of the claims family is refused at this door on both wires, in the
    door's own vocabulary and reporting the type it read.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-8725
    Scenario: jose: the opaque door refuses the token as a JWS error, reporting the claims type it read (RFC-8725 §3.11)
      When a third party signs the wire claims on the jose wire, typed "JWT"
      And I verify the token as opaque content on the jose wire
      Then verification is refused as a JWS error "jws_invalid_typ"
      And the refusal reports the type header it read "JWT"

    @RFC-9596
    Scenario: cose: the opaque door refuses the token as a CWS error, reporting the claims type it read (RFC-9596 §3)
      When a third party signs the wire claims on the cose wire, typed "application/at+cwt"
      And I verify the token as opaque content on the cose wire
      Then verification is refused as a CWS error "cws_invalid_typ"
      And the refusal reports the type header it read "application/at+cwt"

  Rule: the opaque verify refuses a token whose protected type names the encrypted family

    The same kind-confusion rule from the other side (RFC 8725 §3.11,
    RFC 9596 §3): a signed structure whose type says it is an encrypted one
    is claiming a confidentiality it does not have, and a reader that
    accepted it would hand a caller cleartext under the type of a sealed
    token. The families are told apart by the type alone, so the opaque door
    refuses the encrypted spelling as it refuses the claims one.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-8725
    Scenario: jose: the opaque door refuses the token as a JWS error, reporting the encrypted type it read (RFC-8725 §3.11)
      When a third party signs the wire claims on the jose wire, typed "JWE"
      And I verify the token as opaque content on the jose wire
      Then verification is refused as a JWS error "jws_invalid_typ"
      And the refusal reports the type header it read "JWE"

    @RFC-9596
    Scenario: cose: the opaque door refuses the token as a CWS error, reporting the encrypted type it read (RFC-9596 §3)
      When a third party signs the wire claims on the cose wire, typed "application/cwe"
      And I verify the token as opaque content on the cose wire
      Then verification is refused as a CWS error "cws_invalid_typ"
      And the refusal reports the type header it read "application/cwe"

  Rule: the opaque verify accepts a token that carries no type header

    `typ` is OPTIONAL on both wires (RFC 7515 §4.1.9, RFC 9596 §2), so a
    signature that declares no type is conformant, and the opaque door is
    the raw wire surface rather than an application. What the door refuses
    is a type of another family; whether a type must be present is a policy
    the layer above states, and a presence rule imposed here would refuse
    conformant tokens with no way for the caller to say otherwise. The
    absence is read off the wire first, so the scenario cannot pass on an
    ordinary typed token.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7515
    Scenario: jose: a signature carrying no type header is accepted at the opaque door (RFC-7515 §4.1.9)
      When a third party signs the wire claims on the jose wire
      And I verify the token as opaque content on the jose wire
      Then the raw protected header carries no "typ"
      And the raw door accepts the token

    @RFC-9596
    Scenario: cose: a signature carrying no type header is accepted at the opaque door (RFC-9596 §2)
      When a third party signs the wire claims on the cose wire
      And I verify the token as opaque content on the cose wire
      Then the raw protected header carries no label 16
      And the raw door accepts the token

  Rule: the opaque verify does not consult a type carried only in the unprotected bucket

    No signature covers an unprotected parameter (RFC 9052 §3), and the type
    is what routes a token, so a type read from the unprotected bucket is a
    type the presenter chose. RFC 9596 §2 puts `typ` in the protected bucket;
    a copy anywhere else must answer nothing — neither accepting a token on
    its strength nor refusing one because of it. The claims type that would
    be refused from the protected bucket rides the unprotected one alone, and
    both halves of that premise are read off the raw wire. The JOSE compact
    serialisation has one header and it is protected (RFC 7515 §7.1), so
    there is no unprotected bucket to carry a second type in on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign unprotected header carries
        | typ | "application/at+cwt" |

    @RFC-9052
    @RFC-9596
    Scenario: cose: a claims type riding the unsigned bucket alone answers nothing, and the token is accepted (RFC-9052 §3) (RFC-9596 §2)
      When a third party signs the wire claims on the cose wire
      And I verify the token as opaque content on the cose wire
      Then the raw unprotected header carries label 16 "application/at+cwt"
      And the raw protected header carries no label 16
      And the raw door accepts the token

  Rule: an opaque signature stamped with a token-type prefix verifies through its own raw door

    The opaque mint writes a structured media type for a caller's token-type
    prefix — `application/<prefix>+jws` on JOSE and `application/<prefix>+cws`
    on COSE — and the read side of the same door must take every spelling the
    write side produces, or a caller who typed their handle would be unable
    to verify it. A door that accepted only the bare spelling would refuse
    its own structured output. The spelling is aegis policy, which is why the
    scenarios carry no tag: `typ` declares the media type of the complete
    object (RFC 7515 §4.1.9, RFC 9596 §2) and its processing belongs to the
    application, and neither `+jws` nor `+cws` is a registered structured
    syntax suffix (RFC 6838 §4.2.8). The spelling the door accepted is read
    off the wire, so the scenario pins the structured form and not merely
    that some type verified.

    Background:
      Given the payload to sign
        | tid | at_abc |
      And the opaque signature carries the type prefix "at"

    Scenario Outline: <wire>: the type the opaque mint stamps is accepted back at its own door
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token as opaque content on the <wire> wire
      Then the raw protected header carries <type key> "<media type>"
      And the raw door accepts the token

      Examples:
        | wire | type key | media type         |
        | jose | "typ"    | application/at+jws |
        | cose | label 16 | application/at+cws |

  Rule: the raw claims verify accepts a token that carries no type header

    `typ` is OPTIONAL, and processing it belongs to the application rather
    than to the token implementation, on either wire (RFC 7519 §5.1,
    RFC 9596 §2) — so a typ-less claims token is conformant. Whether to
    accept one is an application policy, which is where the domain surface
    enforces it; the raw wire door is not the application, so a presence
    rule imposed there would refuse conformant tokens with no way for the
    caller to say otherwise. The absence is read off the wire first, so the
    scenario cannot pass on an ordinary typed token.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7519
    Scenario: jose: a claims token carrying no type header is accepted at the raw claims door (RFC-7519 §5.1)
      When a third party signs the wire claims on the jose wire
      And I verify the token as a claims token on the jose wire
      Then the raw protected header carries no "typ"
      And the raw door accepts the token

    @RFC-9596
    Scenario: cose: a claims token carrying no type header is accepted at the raw claims door (RFC-9596 §2)
      When a third party signs the wire claims on the cose wire
      And I verify the token as a claims token on the cose wire
      Then the raw protected header carries no label 16
      And the raw door accepts the token

  Rule: the raw claims verify accepts an expired token when the caller waives the expiry range

    `exp` is a bound a verifier enforces (RFC 7519 §4.1.4), and waiving it is
    a narrow, legitimate request — inspecting a previously-issued token where
    the signature, not the lifetime, is what is being trusted. The raw door
    threads its own option bag by hand, so it can honour an option the domain
    door honours and drop the one beside it; the caller sees no difference,
    because a dropped waiver simply rejects. The waiver is aegis's own
    allowance and not the specification's, which is why the scenarios carry
    no tag. The token is an hour past its expiry, so nothing but the waiver
    admits it.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T06:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier leaves the expiry unchecked

    Scenario Outline: <wire>: the raw claims door accepts the expired token under the waiver
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token as a claims token on the <wire> wire
      Then the raw door accepts the token

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the raw claims verify accepts a token expired inside the leeway the caller allows

    A small leeway for clock skew is allowed when checking `exp`
    (RFC 7519 §4.1.4). The leeway is a number rather than a flag, so it is
    the option that shows the whole bag reaches the raw door and not merely
    the booleans a hand-written forward is most likely to remember: a token
    ten seconds past its expiry verifies under a sixty-second allowance and
    fails without one. The cose scenario carries no tag: the leeway is the
    JWT document's, and the CWT document that gives its own expiry claim the
    same processing rules by reference is one this row does not cite.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T07:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:59:50.000Z"
      And the verifier allows a clock tolerance of 60 seconds

    @RFC-7519
    Scenario: jose: the raw claims door accepts the token inside the leeway (RFC-7519 §4.1.4)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token as a claims token on the jose wire
      Then the raw door accepts the token

    Scenario: cose: the raw claims door accepts the token inside the leeway
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token as a claims token on the cose wire
      Then the raw door accepts the token

  Rule: the raw claims verify refuses a token whose signing key the caller's policy forbids

    A library must let the caller restrict which algorithms it will use, and
    must honour that restriction (RFC 8725 §3.1). The raw door is where a
    caller reaches the wire directly, so a policy dropped there is worse
    than no policy at all: the caller believes the constraint is in force and
    stops checking, and the token's own header is left to decide which vault
    resident verifies it. The vault's signing key is the ES512 one, so a
    policy demanding a shared secret can only be satisfied by ignoring the
    policy. The cose scenario carries no tag: RFC 8725 is JWT practice, and
    the row cites no COSE document.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier accepts only a signing key of the symmetric class

    @RFC-8725
    Scenario: jose: the raw claims door refuses the token as a key error under the caller's policy (RFC-8725 §3.1)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token as a claims token on the jose wire
      Then verification is refused as a key error "verify_key_policy_violation"

    Scenario: cose: the raw claims door refuses the token as a key error under the caller's policy
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token as a claims token on the cose wire
      Then verification is refused as a key error "verify_key_policy_violation"
