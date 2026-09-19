Feature: What a signature proves

  A verifier accepts a token on the strength of what secures it, and the rules
  here keep that strength honest. An artifact altered after it was issued is
  refused whichever part was touched, because the signature covers the
  protected header and the payload and nothing else vouches for either. A
  shared secret proves less than a signature — every party that can verify a
  MAC can also produce one — so a profile may demand the asymmetric class of
  a token that arrives, and the COSE wire keeps the MAC structure and the
  signature structure apart on the wire and in what it reports.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token presented with a signature that is not the issuer's is refused

    The signature is the only thing that says who issued a token, so a
    verifier that accepted one it could not validate would be accepting the
    presenter's word for every claim. A signature that does not validate
    makes the token invalid on either wire: the JWS validation steps
    (RFC 7515 §5.2) and the COSE verification over the Sig_structure
    (RFC 9052 §4.4). The last byte of the signature is flipped and nothing
    else, so the token still parses and still names its key, and the refusal
    is attributable to the integrity check rather than to a decoder giving
    up. The refusal carries the signature verdict's own code, which is what
    tells it apart from any other gate the same token passes through.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7515
    Scenario: jose: the raw claims door refuses the token under the signature verdict (RFC-7515 §5.2)
      When I sign the wire claims as a claims token on the jose wire
      And the signature of the token is altered after it was issued
      And I verify the token as a claims token on the jose wire
      Then verification is refused as a JOSE error "jwt_signature_invalid"

    @RFC-9052
    Scenario: cose: the raw claims door refuses the token under the signature verdict (RFC-9052 §4.4)
      When I sign the wire claims as a claims token on the cose wire
      And the signature of the token is altered after it was issued
      And I verify the token as a claims token on the cose wire
      Then verification is refused as a COSE error "cose_signature_invalid"

  Rule: a token whose signature does not validate is refused even when the caller waived the expiry range check

    A temporal waiver states one thing — that this caller does not care when
    the token expires — and it must not be readable as a general instruction
    to trust the token less carefully. Authenticity and lifetime are
    independent properties: an unvalidated signature is fatal regardless of
    what the payload says (RFC 7515 §5.2), while `exp` is a claim about the
    payload (RFC 7519 §4.1.4). A waiver that leaked across the two would turn
    the id_token_hint flow, whose whole purpose is to accept an expired token
    on the strength of its signature, into a flow that accepts anything. The
    token is expired, so the waiver is the only reason the lifetime does not
    refuse it first. The cose scenario carries no tag: the row cites the JWS
    and JWT documents alone, and the COSE verification process is in a
    document it does not cite.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T06:00:00.000Z"
      And the wire claims expire at "2024-01-01T07:00:00.000Z"
      And the verifier leaves the expiry unchecked

    @RFC-7515
    Scenario: jose: the domain verify refuses the token under the signature verdict, the waiver notwithstanding (RFC-7515 §5.2)
      When I sign the wire claims as a claims token on the jose wire
      And the signature of the token is altered after it was issued
      And I verify the token
      Then verification is refused as a JOSE error "jwt_signature_invalid"

    Scenario: cose: the domain verify refuses the token under the signature verdict, the waiver notwithstanding
      When I sign the wire claims as a claims token on the cose wire
      And the signature of the token is altered after it was issued
      And I verify the token
      Then verification is refused as a COSE error "cose_signature_invalid"

  Rule: a token whose claims were rewritten after it was issued is refused

    A verifier's guarantee is that the claims it reads are the claims the
    issuer wrote, and that guarantee comes from the payload being covered by
    the integrity computation rather than merely travelling beside it. The
    payload is an input to the JWS Signing Input (RFC 7515 §5.2) and to the
    Sig_structure (RFC 9052 §4.4). A payload outside it would let any holder
    grant itself a scope. The rewrite adds one member to a well-formed claims
    container, so the token still parses and the refusal is the signature's.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7515
    Scenario: jose: the raw claims door refuses the rewritten payload under the signature verdict (RFC-7515 §5.2)
      When I sign the wire claims as a claims token on the jose wire
      And the payload of the token is altered after it was issued
      And I verify the token as a claims token on the jose wire
      Then verification is refused as a JOSE error "jwt_signature_invalid"

    @RFC-9052
    Scenario: cose: the raw claims door refuses the rewritten payload under the signature verdict (RFC-9052 §4.4)
      When I sign the wire claims as a claims token on the cose wire
      And the payload of the token is altered after it was issued
      And I verify the token as a claims token on the cose wire
      Then verification is refused as a COSE error "cose_signature_invalid"

  Rule: a token whose protected header was rewritten after it was issued is refused

    The protected header is where a token states its algorithm, its key and
    its type, so a header a holder could edit would let the holder restate
    every one of them. The protected header is an input to the JWS Signing
    Input (RFC 7515 §5.2) and to the Sig_structure (RFC 9052 §4.4) — which
    is precisely what makes the bucket protected and separates it from the
    unprotected one beside it. The rewrite adds one unregistered member, so
    every gate ahead of the signature still passes and the refusal is the
    signature's.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-7515
    Scenario: jose: the raw claims door refuses the rewritten header under the signature verdict (RFC-7515 §5.2)
      When I sign the wire claims as a claims token on the jose wire
      And the protected header of the token is altered after it was issued
      And I verify the token as a claims token on the jose wire
      Then verification is refused as a JOSE error "jwt_signature_invalid"

    @RFC-9052
    Scenario: cose: the raw claims door refuses the rewritten header under the signature verdict (RFC-9052 §4.4)
      When I sign the wire claims as a claims token on the cose wire
      And the protected header of the token is altered after it was issued
      And I verify the token as a claims token on the cose wire
      Then verification is refused as a COSE error "cose_signature_invalid"

  Rule: a token authenticated with a shared secret is refused by a profile that requires a signature

    A MAC proves that somebody holding the secret produced the token, and
    every party that can verify holds it — so a shared secret cannot
    establish who issued anything. An access token is presented to a party
    that is not the issuer, which is exactly the case the distinction exists
    for. The restriction is the verifier's to state and the library's to
    honour (RFC 8725 §3.1), and it must bite on arrival: a constraint applied
    only where this deployment signs defends nobody against a token this
    deployment did not write. The token is a third party's, authenticated
    with the secret the vault holds, because the same class constraint is
    part of the signing floor and a mint could never reach the rule. The
    refusal names the algorithm it read, which attributes it to the class
    floor and not to any other rule this token would also have to satisfy.
    The cose scenario carries no tag: RFC 8725 is JWT practice, and the row
    cites no COSE document.

    Background:
      Given the vault also holds an HS256 signing key
      And the wire claims
        | iss       | "https://test.lindorm.io/" |
        | sub       | "user-1"                   |
        | aud       | ["https://rs.lindorm.io/"] |
        | jti       | "forged-1"                 |
        | client_id | "client-1"                 |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-8725
    Scenario: jose: the profile refuses the token under the algorithm-class floor, naming the MAC algorithm (RFC-8725 §3.1)
      When a third party authenticates the wire claims with the shared secret on the jose wire, typed "application/at+jwt"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "algorithm_not_permitted"
      And the refusal reports the algorithm it read "HS256"

    Scenario: cose: the profile refuses the token under the algorithm-class floor, naming the MAC algorithm
      When a third party authenticates the wire claims with the shared secret on the cose wire, typed "application/at+cwt"
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "algorithm_not_permitted"
      And the refusal reports the algorithm it read "HS256"

  Rule: a third-party access token authenticated with a shared secret is refused by the profile written to accept it

    A signature and a MAC both secure content (RFC 7515 §1), and the two say
    different things about origin: everyone who can verify a MAC can also
    produce one, so a MAC establishes only that some holder of the secret
    wrote the token. A profile whose whole purpose is to accept tokens from
    an authorization server we do not control is the case where that matters
    most — the deployment holds the same secret it would be relying on to
    prove the third party issued the token, so it could equally have written
    it itself. The restriction is the verifier's to state and the library's
    to enforce (RFC 8725 §3.1). The cose scenario carries no tag: the row
    cites the JWS and JWT documents alone.

    Background:
      Given the vault also holds an HS256 signing key
      And the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "forged-1"                 |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier expects the issuer "https://test.lindorm.io/"

    @RFC-8725
    Scenario: jose: the third-party profile refuses the token under the algorithm-class floor, naming the MAC algorithm (RFC-8725 §3.1)
      When a third party authenticates the wire claims with the shared secret on the jose wire, typed "application/at+jwt"
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "algorithm_not_permitted"
      And the refusal reports the algorithm it read "HS256"

    Scenario: cose: the third-party profile refuses the token under the algorithm-class floor, naming the MAC algorithm
      When a third party authenticates the wire claims with the shared secret on the cose wire, typed "application/at+cwt"
      And I verify the token under the "external_access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "algorithm_not_permitted"
      And the refusal reports the algorithm it read "HS256"

  Rule: a delegation designation authenticated with a shared secret is refused by its profile

    A delegation designation names the client that issued it as its own
    `iss`, so the platform receiving it is being asked to act on an
    attribution. A signature and a MAC both secure content (RFC 7515 §1),
    and a MAC is symmetric: the receiving platform holds the same secret and
    could have written the designation itself, so the attribution it carries
    is unfalsifiable and therefore worthless. Only a signature made by the
    client's own registered key lets the platform say who designated whom.
    The restriction belongs where it can be enforced — with the verifier
    (RFC 8725 §3.1). The issuer is the client's identifier and not a URI,
    which is what a designation's issuer is. The cose scenario carries no
    tag: the row cites the JWS and JWT documents alone.

    Background:
      Given the vault also holds an HS256 signing key
      And the wire claims
        | iss | "client-1"                   |
        | sub | "client-1"                   |
        | aud | ["https://test.lindorm.io/"] |
        | jti | "forged-2"                   |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the verifier expects the issuer "client-1"

    @RFC-8725
    Scenario: jose: the delegation profile refuses the designation under the algorithm-class floor, naming the MAC algorithm (RFC-8725 §3.1)
      When a third party authenticates the wire claims with the shared secret on the jose wire, typed "application/delegation+jwt"
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then verification is refused as a domain error "algorithm_not_permitted"
      And the refusal reports the algorithm it read "HS256"

    Scenario: cose: the delegation profile refuses the designation under the algorithm-class floor, naming the MAC algorithm
      When a third party authenticates the wire claims with the shared secret on the cose wire, typed "application/delegation+cwt"
      And I verify the token under the "delegation" profile as the audience "https://test.lindorm.io/"
      Then verification is refused as a domain error "algorithm_not_permitted"
      And the refusal reports the algorithm it read "HS256"

  Rule: a token authenticated with a shared secret verifies under a profile that requires no signature

    The class floor is the profile's rule and not a blanket ban, and the
    difference is load-bearing. A security event token must be signed using
    JWS unless its integrity is ensured by other means, with no algorithm
    class imposed (RFC 8417 §5.1), and a JWS secures content with either a
    digital signature or a MAC (RFC 7515 §1). A SET is delivered to a
    receiver the transmitter already has a relationship with, so a shared
    secret is a conformant and ordinary choice there. A floor applied to
    every profile would refuse it, and the remedy a deployment reaches for
    is to stop using the profile — which discards every other rule it
    carried along with the one that was wrong. On the COSE wire the same
    token is a COSE_Mac0 and reports as the MAC-authenticated format; that
    scenario carries no tag, because both documents the row cites are JOSE
    ones.

    Background:
      Given the vault also holds an HS256 signing key
      And the wire claims
        | iss    | "https://test.lindorm.io/"                                       |
        | aud    | ["https://receiver.lindorm.io/"]                                 |
        | jti    | "set-1"                                                          |
        | sub_id | {"format":"iss_sub","iss":"https://test.lindorm.io/","sub":"user-1"} |
        | events | {"urn:lindorm:event:test":{}}                                    |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"

    @RFC-8417
    @RFC-7515
    Scenario: jose: a MAC-authenticated security event token verifies as a JWT (RFC-8417 §5.1) (RFC-7515 §1)
      When a third party authenticates the wire claims with the shared secret on the jose wire, typed "application/secevent+jwt"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified token is a "jwt"

    Scenario: cose: a MAC-authenticated security event token verifies, and reports the MAC-authenticated format
      When a third party authenticates the wire claims with the shared secret on the cose wire, typed "application/secevent+cwt"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified token is a "cwm"

    Scenario Outline: <wire>: the verified claims report the issuer the third party wrote
      When a third party authenticates the wire claims with the shared secret on the <wire> wire, typed "<typ>"
      And I verify the token under the "security_event" profile as the audience "https://receiver.lindorm.io/"
      Then the verified claims include
        | issuer | https://test.lindorm.io/ |

      Examples:
        | wire | typ                      |
        | jose | application/secevent+jwt |
        | cose | application/secevent+cwt |

  Rule: a claims token keyed with a shared secret is MAC-authenticated and verifies as one

    A COSE_Mac0 and a COSE_Sign1 are different objects, with different tags
    and different security properties (RFC 9052 §6.2, RFC 9052 §4.2). A
    shared secret can only produce the first, so an encoder handed one must
    emit a COSE_Mac0 and the reader must report it as the MAC-authenticated
    form — a token whose structure says MAC while the result says signature
    would let a verifier believe a shared secret proved who issued it. The
    tag chain is read off the bytes by the independent inspector, because
    the reported format is aegis's own decision about the same bytes. The
    vault also holds the baseline ES512 key, and a COSE_Mac0 refuses an
    asymmetric one, so the selector is what puts the shared secret in front
    of the mint. JOSE has one structure for signatures and MACs alike
    (RFC 7515 §1), so there is no second form to report on that wire.

    Background:
      Given the vault also holds an HS256 signing key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint selects a signing key of the symmetric class

    @RFC-9052
    Scenario: cose: the token is a COSE_Mac0 inside the CWT tag, read off the bytes (RFC-9052 §6.2) (RFC-9052 §4.2)
      When I mint the content under the "id_token" profile as a MAC-authenticated claims token
      Then the raw token carries the CBOR tag chain 61, 17

    Scenario: cose: the verified result reports the MAC-authenticated format
      When I mint the content under the "id_token" profile as a MAC-authenticated claims token
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "cwm"

    Scenario: cose: the verified claims are the content and the profile's issuer
      When I mint the content under the "id_token" profile as a MAC-authenticated claims token
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified claims include
        | subject | user-1                   |
        | issuer  | https://test.lindorm.io/ |

    Scenario: cose: the verified header reports the MAC algorithm
      When I mint the content under the "id_token" profile as a MAC-authenticated claims token
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified header includes
        | algorithm | "HS256" |

  Rule: a mint asked for the signature structure refuses a shared secret rather than emitting one

    A COSE_Sign1 carries a digital signature (RFC 9052 §4.2), whose whole
    property is that only the holder of the private key could have produced
    it. A shared secret has no such property — every party that can verify
    can also forge — so a structure that admitted one would make a signature
    and a MAC indistinguishable to the reader, which is the confusion the two
    separate structures exist to prevent. The refusal has to happen at issue:
    a token cannot be un-issued. The id_token profile declares no
    algorithm-class floor, so the selector is what puts the shared secret in
    front of the signature structure. JOSE draws no such line to enforce: one
    structure carries both digital signatures and MACs (RFC 7515 §1), so an
    HMAC `alg` is a conformant JWS and a mint that refused it would refuse
    the conformant shape.

    Background:
      Given the vault also holds an HS256 signing key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And no access token is co-issued
      And the mint selects a signing key of the symmetric class

    @RFC-9052
    Scenario: cose: the mint is refused as a CWT error before any token exists (RFC-9052 §4.2)
      When I mint the content under the "id_token" profile on the cose wire
      Then minting is refused as a CWT error "cwt_requires_asymmetric_key"
