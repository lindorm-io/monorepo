Feature: Header provenance, empty header parameters and the asserted token type

  What a header carries, who signed it, and what a reader may believe. A COSE
  object has a protected bucket the signature covers and an unprotected one it
  does not (RFC 9052 §3); a JOSE compact serialisation has one header and it
  is protected (RFC 7515 §7.1). The domain header merges the buckets under the
  header registry's placement rule, an empty parameter becomes nothing or a
  refusal at the write, and a caller's type assertion is compared on the whole
  media type the token carries.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a CWT's unprotected key identifier reaches the one header the domain result reports

    A COSE object has two header buckets and the `kid` hint may ride the
    unprotected one (RFC 9052 §3, RFC 9052 §3.1). A caller reading a verified
    token must still be told which key identifier the token carried, and must
    be told it the same way on both wires: the JOSE compact serialisation has
    no second bucket (RFC 7515 §7.1), so a domain surface reporting the COSE
    `kid` under a bucket name of its own would make the same fact unreadable
    in one place on one wire and another place on the other. `kid` is on the
    short list of parameters the registry permits to travel unauthenticated: it
    names a key, and the key is then proven by the signature rather than
    believed. The raw buckets are read by the independent inspector, so the
    domain assertion cannot be satisfied by a kit that moved `kid` into the
    protected bucket. Where the algorithm rides is the specification's rule;
    where the key identifier and the type header ride is aegis's choice within
    what the specifications permit. The jose wire has no scenario: the JOSE
    compact serialisation has no unprotected bucket at all (RFC 7515 §7.1), so
    no parameter can arrive from one and there is nothing to merge.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-9052
    Scenario: cose: the algorithm rides the protected bucket and not the unprotected one (RFC-9052 §3.1)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the raw protected header carries all of label 1
      And the raw unprotected header carries none of label 1

    Scenario: cose: the type header rides the protected bucket and not the unprotected one
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the raw protected header carries all of label 16
      And the raw unprotected header carries none of label 16

    Scenario: cose: the key identifier rides the unprotected bucket alone
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the raw unprotected header carries all of label 4
      And the raw protected header carries none of label 4

    Scenario: cose: the verified header reports the algorithm and the unprotected key identifier
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"
      And the verified header includes
        | algorithm | "ES512" |
      And the verified header reports the key id of the ES512 signing key

  Rule: every parameter in a JWT's domain header is one the signature covers

    A JWT has exactly one header (RFC 7515 §7.1) and the signature covers all
    of it (RFC 7515 §5.2), so the domain header's provenance question is
    settled by the serialisation itself: there is no second bucket for an
    unauthenticated parameter to arrive from. This is what makes one domain
    header the honest shape on this wire. The same parameter set is asserted
    on both sides: each half alone is weaker, since the domain assertion would
    be satisfied by a reader that fabricated the values, and the wire
    assertion would not say what a caller is actually handed. The inspector
    reports no unprotected bucket for a compact token; that is its own
    statement about the wire, not a check aegis can fail, so the three-part
    count carries the serialisation half. The cose wire has no scenario: a
    COSE structure always carries an unprotected bucket (RFC 9052 §3), so the
    serialisation-level absence asserted here cannot arise on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7515
    Scenario: jose: the token is a three-part compact serialisation, so no bucket lies outside the signature (RFC-7515 §7.1)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"
      And the raw token is a compact serialisation of 3 parts

    Scenario: jose: every parameter the verified header reports is one the protected header carries
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified header includes
        | algorithm  | "ES512" |
        | headerType | "JWT"   |
      And the verified header reports the key id of the ES512 signing key
      And the raw protected header carries all of "alg", "kid", "typ"

  Rule: a header parameter the library knows is refused from the custom unprotected bucket

    The custom bag exists to carry parameters no specification defines, and
    the registered bag exists to carry the ones that do — one question per
    field. A registered name accepted into `custom` would travel raw, past the
    value codec its registry row states and past the bucket its placement
    assigns, while a reader gave it the meaning its specification assigns.
    The rule is the name and not the bucket; this is the unprotected half,
    which is the bucket a caller is likeliest to reach for. `cty` is
    caller-settable and not kit-derived, so the refusal can only be the
    registered-in-custom rule. The jose wire has no scenario: the JOSE compact
    serialisation has no unprotected bucket for a parameter to be written into
    (RFC 7515 §7.1), so the JOSE envelope declares no such bag and a JOSE door
    refuses the shape at compile time; the name rule itself holds on both
    wires, and `internal/header/custom-header-params.test.ts` pins it for
    JOSE.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the custom unprotected header
        | cty | "application/example" |

    Scenario: cose: the signature is refused under the registered-in-custom verdict, naming the parameter and the bucket
      When I sign the wire claims as a claims token on the cose wire
      Then signing is refused as a CWT error "header_registered_in_custom"
      And the refusal names the parameter "cty" in the bucket "unprotected"

  Rule: a parameter stated in both header buckets is reported as the issuer signed it

    The protected bucket is covered by the signature and the unprotected one
    is not (RFC 9052 §3), so where both state the same parameter only one of
    the two values has an author a verifier can name. The signed value must
    therefore win, unconditionally: resolving the other way, or by which
    bucket happens to be read first, would let whoever last held the token
    overwrite a statement its issuer signed. The token is a foreign producer's,
    since no aegis writer emits this shape. It verifies, which is what makes
    this about the merge and not about key resolution: `kid` is a routing hint
    (RFC 9052 §3.1), so aegis finds the key by the unprotected one and the
    signature then proves it. What the result reports is the signed value. The
    jose wire has no scenario: the JOSE compact serialisation has one header
    and no second bucket to restate a parameter from (RFC 7515 §7.1), so the
    collision cannot be constructed on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | kid | "key_the_issuer_signed" |

    Scenario: cose: the token verifies, and the key identifier reported is the one the signature covers
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the verified token is a "cwt"
      And the raw protected header carries label 4 as the byte string "key_the_issuer_signed"
      And the raw unprotected header carries all of label 4
      And the verified header includes
        | keyId | "key_the_issuer_signed" |

  Rule: header parameters that must be signed are ignored when they arrive unauthenticated

    A parameter a verifier routes, audits or polices a token by is only worth
    reading if the issuer said it. `kid` may ride the unprotected bucket
    (RFC 9052 §3.1); the parameters a verifier decides by may not, and a
    reader that surfaced them anyway would let whoever last held the token
    declare what the token is: its type (RFC 9596 §2), the type of its
    payload, the certificate it is attributable to, or an object identifier an
    application authorises against. The certificate half of that list is aegis
    policy, not a placement the specification makes: RFC 9360 §2 permits
    `x5chain` and `x5t` in either bucket — but aegis binds on the thumbprint
    and pins the certificate parameters protected, so an unprotected one is a
    certificate reference whoever last held the token can rewrite. On read the
    header registry's placement column is the allowlist, and a parameter
    declared protected that arrives unauthenticated is dropped before the
    domain header is built. Every parameter is hand-placed by a foreign
    producer at the label aegis reads, and each scenario reads its label back
    off the raw bytes before asserting the domain header does not believe it.
    The jose wire has no scenario: the JOSE compact serialisation has no
    unprotected bucket (RFC 7515 §7.1), so no parameter can arrive
    unauthenticated on that wire and there is nothing for a placement rule to
    ignore.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign unprotected header carries
        | typ | "application/at+cwt"                      |
        | cty | "application/json"                        |
        | oid | "1.2.3.4"                                 |
        | x5u | "https://attacker.lindorm.test/certs.pem" |
        | x5c | ["MIIBforged"]                            |

    @RFC-9596
    Scenario: cose: an unprotected type header is on the wire and is not believed (RFC-9596 §2)
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the raw unprotected header carries label 16 "application/at+cwt"
      And the verified header reports no token type
      And the verified header carries no "headerType"

    Scenario: cose: an unprotected content type is on the wire and is not believed
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the raw unprotected header carries label 3 "application/json"
      And the verified header carries no "contentType"

    Scenario: cose: an unprotected object identifier is on the wire and is not believed
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the raw unprotected header carries "oid" "1.2.3.4"
      And the verified header carries no "objectId"

    Scenario: cose: an unprotected object identifier at its private-use integer label is on the wire and is not believed
      Given the foreign unprotected header carries
        | typ | "application/at+cwt"                      |
        | cty | "application/json"                        |
        | x5u | "https://attacker.lindorm.test/certs.pem" |
        | x5c | ["MIIBforged"]                            |
      And the foreign unprotected header carries, at the integer labels
        | -70000 | "1.2.3.4" |
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the raw unprotected header carries label -70000 "1.2.3.4"
      And the raw unprotected header carries no "oid"
      And the verified header carries no "objectId"

    Scenario: cose: an unprotected certificate URL is on the wire and is not believed
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the raw unprotected header carries label 35 "https://attacker.lindorm.test/certs.pem"
      And the verified header carries no "certificateUrl"

    Scenario: cose: an unprotected certificate chain is on the wire and is not believed
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the raw unprotected header carries label 33 as the list "MIIBforged"
      And the verified header carries no "certificateChain"

    Scenario: cose: the token verifies, and the verified header still reports the algorithm and the key identifier it routed by
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then the verified token is a "cwt"
      And the verified header includes
        | algorithm | "ES512" |
      And the verified header reports the key id of the ES512 signing key

  Rule: a mint refuses a certificate thumbprint that identifies no certificate

    `x5t#S256` names the certificate corresponding to the key that signed the
    token (RFC 7515 §4.1.8), and it is the one header parameter a verifier
    acts on — presence is the binding. An empty thumbprint therefore has no
    safe disposal: removing it hands the audience a token carrying no binding
    where the issuer intended one, and emitting it mints a token whose binding
    no certificate can ever satisfy. Both outcomes are silent, so the only
    answer left is a refusal at the write, where the producer still holds the
    value. The refusal is one verdict on both wires, fired in the normalisation
    both builders share, upstream of either wire's own disposal of the
    parameter — and the registry ruling it reports is what tells it apart
    from the reserved-parameter refusal, which carries the same class and the
    same parameter name.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | x5t#S256 | "" |

    Scenario Outline: <wire>: the signature is refused under the registry's empty-value ruling, before either wire disposes of the parameter
      When I sign the wire claims as a claims token on the <wire> wire
      Then signing is refused as an aegis error "header_empty_parameter"
      And the refusal names the parameter "x5t#S256" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token whose producer marked nothing critical carries no critical-parameter list

    Both wires forbid the empty list outright (RFC 7515 §4.1.11,
    RFC 9052 §3.1). A `crit` naming no parameter states that a recipient must
    understand nothing, which is what an absent `crit` already states, so it
    adds no information and forfeits conformance to say it. It is also the
    shape a header bag assembled from optional values arrives in, so a writer
    that passed it through would emit a token its own reader refuses. The
    token is verified, not merely minted, because the point is that the token
    aegis produced is one aegis accepts; the raw bucket is read by the
    independent inspector, per wire because the two spell the parameter
    differently.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | [] |

    @RFC-7515
    Scenario: jose: the token verifies and its protected header carries no crit (RFC-7515 §4.1.11)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"
      And the raw protected header carries no "crit"

    @RFC-9052
    Scenario: cose: the token verifies and its protected header carries no label 2 (RFC-9052 §3.1)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"
      And the raw protected header carries no label 2

  Rule: a mint refuses a header that marks a parameter critical while carrying no value for it

    A `crit` list is a producer's statement that a recipient is required to
    understand a named parameter (RFC 7515 §4.1.11 on JOSE, RFC 9052 §3.1 on
    COSE). Naming a parameter while giving nothing to understand is that
    statement contradicting itself, and the contradiction is unrecoverable by
    the time anyone reads the token: a `crit` naming a label the protected
    bucket does not carry is a fatal error (RFC 9052 §3.1). The write is
    therefore the only place the contradiction can be both named and repaired.
    Treating a present-but-empty value as that same fault is aegis policy:
    RFC 9052 §3.1 attaches the fatal error to an absent label. `oid` is the
    parameter that makes this reproduce the rule rather than agree with it:
    it is the only parameter aegis owns that a `crit` may name at all. The
    refusal names the parameter on both wires, since under the interoperable
    default `oid` rides its string label.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid"] |
        | oid  | ""      |

    Scenario Outline: <wire>: the signature is refused as a malformed crit, naming the parameter with nothing to understand
      When I sign the wire claims as a claims token on the <wire> wire
      Then signing is refused as a <error> error "<code>"
      And the refusal names the parameter "oid"

      Examples:
        | wire | error | code             |
        | jose | JWT   | jwt_invalid_crit |
        | cose | CWT   | cwt_invalid_crit |

  Rule: an object sealed under an empty content type is recovered as the object it was

    `cty` is the media type of the secured content (RFC 7515 §4.1.10), and the
    empty string is not a media type — it is a second spelling of the absent
    parameter. Nothing has a rule for the second spelling, so it displaces the
    rule written for the first: a stated content type outranks the one a
    writer infers from the payload, and a reader given a type it does not
    recognise falls back to raw bytes. The consequence is silent in the
    direction that matters — the token decrypts cleanly and hands back a
    different type than was sealed. The recovered value is compared whole, so
    a byte-string fallback fails by type.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |
        | tenant  | acme   |
      And the domain header
        | contentType | "" |

    Scenario Outline: <wire>: the empty content type is not stated, and the object comes back as the object
      When I encrypt the data on the <wire> wire
      And I decrypt the token
      Then the decrypted token is a "<format>"
      And the decrypted payload is exactly the object
        """
        { "subject": "user-1", "tenant": "acme" }
        """

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |

  Rule: an object sealed on the encryption kit under an empty cty is recovered as the object it was

    The same rule at the wire-named door, which is a public one: a caller
    reaches the sealing kit directly and spells the parameter `cty` rather
    than `contentType`. Whether the empty string is a media type is a fact
    about the parameter — `cty` is the media type of the secured content, and
    COSE carries the same parameter at label 3 (RFC 7515 §4.1.10,
    RFC 9052 §3.1) — so it cannot depend on which door the caller used or
    which encoding they picked. The two encodings must also agree about it, or
    the parameter is present on one wire and absent on the other for one
    call, which is a difference an attacker chooses the encoding to exploit.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the data to encrypt
        | subject | user-1 |
        | tenant  | acme   |
      And the wire header
        | cty | "" |

    Scenario Outline: <wire>: the empty cty is not stated, and the object comes back as the object
      When I encrypt the data as sealed content on the <wire> wire
      And I decrypt the token
      Then the decrypted token is a "<format>"
      And the decrypted payload is exactly the object
        """
        { "subject": "user-1", "tenant": "acme" }
        """

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |

  Rule: a token of another type is refused when the caller asserts an id token

    The `typ` header parameter declares the media type of the complete token
    (RFC 7519 §5.1), so a caller asserting a token is of a given type is
    asserting on that whole media type. The comparison has to be made on the
    whole of it: an id token's media type is the bare conventional form, with
    no structured prefix, so a check that compares prefixes has nothing to
    compare for exactly that type and silently accepts every token instead.
    COSE has the same parameter, at label 16 (RFC 9596 §2, RFC 9596 §4.1), so
    the caller's assertion means the same thing on that wire. The refusal
    reports the type header it read, so the rejection is attributable to the
    type comparison rather than to any other rule this token would also have
    to satisfy; the assertion's meaning is aegis's own.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the claims token carries the type prefix "at"
      And the verifier asserts
        """
        { "tokenType": "id_token" }
        """

    Scenario Outline: <wire>: the assertion is refused on the whole media type the token carries
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "token_type_mismatch"
      And the refusal reports the type header it read "<typ>"
      And the refusal reports the format "<format>"

      Examples:
        | wire | typ                | format |
        | jose | application/at+jwt | jwt    |
        | cose | application/at+cwt | cwt    |

  Rule: a token typed as an id token verifies when the caller asserts an id token

    The type assertion must refuse exactly the tokens of another type and no
    others. An id token's media type is the bare conventional `JWT`
    (RFC 7519 §5.1), so a comparison that got this wrong in the other
    direction — demanding a structured media type an id token never carries
    — would refuse every conformant id token in existence. That bare media
    type has one COSE equivalent, `application/cwt` (RFC 8392 §9.2), so the
    assertion must accept exactly that and no other there. The media type the
    assertion matched is read off the raw bytes, not reconstructed by aegis on
    the way out.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier asserts
        """
        { "tokenType": "id_token" }
        """

    Scenario Outline: <wire>: the token verifies under the assertion
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    @RFC-7519
    Scenario: jose: the type header the assertion matched is the bare conventional JWT (RFC-7519 §5.1)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the raw protected header carries "typ" "JWT"

    @RFC-8392
    Scenario: cose: the type header the assertion matched is the CWT media type (RFC-8392 §9.2)
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the raw protected header carries label 16 "application/cwt"

  Rule: a token's integrity-protected object identifier reaches the verified domain header

    The verified domain header is what a caller inspects to route, audit and
    police a token, so every parameter the signature covers has to reach it. A
    protected parameter dropped on the way out is a statement the issuer
    signed and the consuming code can never see — and what a caller can see
    of a token must not depend on the encoding the issuer chose for it. The
    token carries no `crit`, which keeps this independent of
    critical-parameter enforcement.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | oid | "1.2.3.4" |

    Scenario Outline: <wire>: the verified header reports the object identifier in domain vocabulary
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified header includes
        | objectId | "1.2.3.4" |

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |
