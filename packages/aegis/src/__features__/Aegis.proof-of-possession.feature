Feature: Proof-of-possession bindings

  A confirmation claim is the issuer declaring that the presenter holds a
  particular key and that the recipient can confirm it (RFC 7800 §3). On the
  JOSE wire the binding is a JWK thumbprint under `cnf.jkt` (RFC 9449 §6.1)
  and the presenter proves it with a DPoP proof signed at run time over the
  token it presents (RFC 9449 §4.2). What a verifier may refuse, what it may
  accept on a caller's word, and what it reports back are the rules here.
  Every rule that turns on the thumbprint or on a proof is stated on the JOSE
  wire alone: a JWK thumbprint confirmation has no CWT counterpart
  (RFC 9679 §5.5) — the COSE thumbprint, `ckt` (RFC 9679 §5.6), digests a
  different canonicalisation of the same key — so a bound token cannot be
  built on that wire to present in the first place. The mint's refusal of
  that thumbprint is the one rule stated on the COSE wire alone; the two
  rules on a confirmation's members at mint run on both wires; and a rule on
  a confirmation with no member states its own reason for the COSE leg.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a CWT mint refuses a confirmation whose thumbprint the COSE wire cannot carry

    No COSE label carries a JWK thumbprint (RFC 9679 §5.5), and the COSE
    thumbprint that does exist digests the key's canonical CBOR where
    RFC 7638 §3 digests its canonical JSON, so the same key yields different
    bytes and one cannot be relabelled as the other. A token that claims to be
    bound but is not is worse than a bearer token, because the verifier stops
    asking for a proof — so the mint fails closed rather than dropping the
    member on the way out. Failing closed is aegis policy; the refusal names
    the member it could not carry, and `keyId` is representable and absent
    from that list, which is what makes it a per-member refusal. The jose wire
    has no scenario: it can carry this confirmation — `cnf.jkt` is the
    base64url-encoded JWK SHA-256 thumbprint of the key the token is bound to
    (RFC 9449 §6.1, RFC 7638 §3) — so there is no refusal to state, and a mint
    that refused it would refuse the conformant shape.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the confirmation claim is the object
        """json
        { "thumbprint": "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc", "keyId": "k1" }
        """

    Scenario: cose: the mint is refused as a COSE error naming the thumbprint as the one member the wire cannot carry
      When I mint the content under the "access_token" profile on the cose wire
      Then minting is refused as a COSE error "cose_cnf_unsupported"
      And the refusal lists the unrepresentable members "jkt"

  Rule: a token carrying a confirmation is refused when the verifier is shown no proof of possession

    A confirmation declares that the recipient can cryptographically confirm
    the presenter's possession of the key (RFC 7800 §3). A verifier handed no
    proof has nothing to check the binding against, so it refuses rather than
    quietly falling back to bearer semantics. The refusal is aegis policy at
    verify: the row cites the claim's meaning, not the resource server's duty
    to demand a proof. The same token verifies when the caller vouches for the
    binding, which is what attributes this refusal to the missing proof. The
    cose wire has no scenario: a JWK thumbprint confirmation has no CWT
    counterpart (RFC 9679 §5.5), so no bound token can be built on that wire
    to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the confirmation claim is the object
        """json
        { "thumbprint": "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc", "keyId": "k1" }
        """

    Scenario: jose: the verify is refused, demanding a proof
      When I mint the content under the "access_token" profile on the jose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "dpop_proof_required"
      And the refusal reports the format "jwt"

  Rule: a token declaring a confirmation whose thumbprint is empty is refused, not read as unbound

    A verifier deciding whether a token is bound reads whether the issuer
    declared a binding (RFC 7800 §3), not whether the declared value is
    usable: a thumbprint nobody can match is a binding that cannot be
    honoured, and downgrading it to bearer semantics would let an attacker
    who can blank one field turn a sender-constrained token into one anybody
    holding a copy may present. Aegis policy at verify. The token comes from
    the raw claims door: a mint refuses a thumbprint that is not 32 base64url
    bytes, and the profile-less verify runs no shape rule behind the binding
    check either. The refusal names the member, because `format` alone is
    stamped on every refusal this gate throws. The cose wire has no scenario:
    a JWK thumbprint confirmation has no CWT counterpart (RFC 9679 §5.5), so
    no bound token can be built on that wire to present.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | { "jkt": "" }              |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "access"

    Scenario: jose: the verify is refused under the binds-no-key verdict, naming the thumbprint member
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then verification is refused as a domain error "confirmation_binds_no_key"
      And the refusal reports the format "jwt" and names the member "cnf.jkt"

  Rule: a caller vouching that a binding was already proven is still refused a confirmation that binds no key

    Vouching says the proof was checked upstream — a gateway that validated
    it and forwarded the token — so it substitutes for the proof, never for
    the binding the proof was checked against. A confirmation whose thumbprint
    names nothing gives the upstream checker nothing to have checked, so the
    vouch attests to something that cannot have happened. Aegis policy at
    verify, on every path that reaches the confirmation. The cose wire has no
    scenario: a JWK thumbprint confirmation has no CWT counterpart
    (RFC 9679 §5.5), so no bound token can be built on that wire to present.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | { "jkt": "" }              |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "access"
      And the verifier vouches that the binding was proven upstream

    Scenario: jose: the vouch does not substitute for the binding, and the refusal names the thumbprint member
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then verification is refused as a domain error "confirmation_binds_no_key"
      And the refusal reports the format "jwt" and names the member "cnf.jkt"

  Rule: presenting a real proof of possession against a confirmation that binds no key is refused

    A proof of possession is only meaningful against the key the token names,
    so a presenter offering a valid proof for a confirmation that names no key
    has demonstrated possession of nothing the token asked about. The refusal
    must come from the confirmation being unusable rather than from the
    comparison failing: a verifier that reaches the comparison has accepted
    the binding as checkable, and would blame the presenter's proof when the
    token is at fault. Aegis policy at verify; the member in the refusal is
    what tells the two apart, since the comparison's own refusal carries no
    such member. The cose wire has no scenario: a JWK thumbprint confirmation
    has no CWT counterpart (RFC 9679 §5.5), so no bound token can be built on
    that wire to present.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | { "jkt": "" }              |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "access"
      And a proof identified "proof-1" for the request "GET" "https://rs.lindorm.io/resource"

    Scenario: jose: the refusal judges the confirmation, not the presenter's proof
      When I sign the wire claims as a claims token on the jose wire
      And the presenter signs the proof with the ES512 presenter key over the presented token
      And I verify the token
      Then verification is refused as a domain error "confirmation_binds_no_key"
      And the refusal reports the format "jwt" and names the member "cnf.jkt"

  Rule: a token whose confirmation names no key at all is refused rather than read as unbound

    By including a `cnf` claim the issuer declares that the presenter holds a
    particular key (RFC 7800 §3). A confirmation with no member declares
    exactly that and names nothing to confirm, so there is no binding to check
    and no honest way to proceed: reading it as absent would let the emptiest
    declaration buy the widest acceptance. Aegis policy at verify. A third
    party writes the token, because the mint refuses an empty confirmation on
    the way out. The cose wire has no scenario: `encodeCnf`
    (`src/internal/cose/cose-key.ts`) refuses a confirmation map that comes
    out with no member, so no aegis producer, the raw CWT sign door included,
    can put an empty `cnf` on that wire; a COSE `cnf` is a map of
    RFC 8747 §3.1 members, and one a third party writes empty is a leg this
    suite leaves unwritten.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | {}                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"

    Scenario: jose: the verify is refused under the binds-no-key verdict, naming the confirmation itself
      When a third party signs the wire claims on the jose wire, typed "application/access+jwt"
      And I verify the token
      Then verification is refused as a domain error "confirmation_binds_no_key"
      And the refusal reports the format "jwt" and names the member "cnf"

  Rule: a caller vouching that a binding was already proven is still refused a confirmation with no member

    The vouch substitutes for the proof and never for the binding the proof
    was checked against; a confirmation naming no key gives the upstream
    checker nothing to have checked. This is the path a per-branch version of
    the verdict leaves open, which is why it is its own rule rather than
    inferred from the bare one. Aegis policy at verify. The cose wire has no
    scenario: `encodeCnf` (`src/internal/cose/cose-key.ts`) refuses a
    confirmation map that comes out with no member, so no aegis producer, the
    raw CWT sign door included, can put an empty `cnf` on that wire; a COSE
    `cnf` is a map of RFC 8747 §3.1 members, and one a third party writes
    empty is a leg this suite leaves unwritten.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | {}                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the verifier vouches that the binding was proven upstream

    Scenario: jose: the vouch does not substitute for the binding, and the refusal names the confirmation itself
      When a third party signs the wire claims on the jose wire, typed "application/access+jwt"
      And I verify the token
      Then verification is refused as a domain error "confirmation_binds_no_key"
      And the refusal reports the format "jwt" and names the member "cnf"

  Rule: presenting a real proof of possession against a confirmation with no member is refused

    A valid proof for a confirmation that names nothing demonstrates
    possession of nothing the token asked about, and the refusal must come
    from the confirmation being unusable rather than from any comparison
    failing. Aegis policy at verify; the member in the refusal is the
    discriminator, since the comparison's own refusal carries none. The cose
    wire has no scenario: `encodeCnf` (`src/internal/cose/cose-key.ts`)
    refuses a confirmation map that comes out with no member, so no aegis
    producer, the raw CWT sign door included, can put an empty `cnf` on that
    wire; a COSE `cnf` is a map of RFC 8747 §3.1 members, and one a third
    party writes empty is a leg this suite leaves unwritten.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | {}                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And a proof identified "proof-1" for the request "GET" "https://rs.lindorm.io/resource"

    Scenario: jose: the refusal judges the confirmation, not the presenter's proof
      When a third party signs the wire claims on the jose wire, typed "application/access+jwt"
      And the presenter signs the proof with the ES512 presenter key over the presented token
      And I verify the token
      Then verification is refused as a domain error "confirmation_binds_no_key"
      And the refusal reports the format "jwt" and names the member "cnf"

  Rule: a token whose confirmation member holds a value of the wrong shape is refused, not read as unbound

    A reader that cannot make sense of a declared confirmation value may
    refuse, or may report the token as stating something it cannot interpret
    — but it must not report the token as stating nothing, because an absence
    is precisely what a verifier reads as bearer semantics (RFC 7800 §3).
    Aegis policy at verify. A number where a base64url string belongs is the
    representative of the family; the refusal comes from the claim translator,
    naming the member's position, which is what says the token was refused
    for being unreadable rather than for binding nothing. The cose wire has no
    scenario: a JWK thumbprint confirmation has no CWT counterpart
    (RFC 9679 §5.5), so no bound token can be built on that wire to present.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | { "jkt": 42 }              |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T08:02:00.000Z"
      And the claims token carries the type prefix "access"

    Scenario: jose: the verify is refused as an unreadable confirmation, locating the fault at the thumbprint member
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "confirmation" and locates the fault at "confirmation.thumbprint": Member "thumbprint" must be a string

  Rule: a confirmation naming a member in the wrong vocabulary is refused, not written into the declared member's slot

    Absent an application requirement, an unrecognised confirmation member is
    ignored rather than refused, on either encoding (RFC 7800 §3.1,
    RFC 8747 §3.1). A member aegis does understand, misspelled, is a different
    thing: `kid` and the domain `keyId` resolve to one key, so writing both
    into one bag lets whoever chose the order decide which binding the token
    states — and a confirmation naming only the misspelling takes the declared
    slot uncontested. The refusal is aegis policy at mint, a departure from
    the ignore rule, and it carries both faults in order: the collision, and
    then that nothing is left to name a key — so a mint that merely dropped
    the colliding member would still fail on the second entry alone.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the confirmation claim is the object
        """json
        { "kid": "k2" }
        """

    Scenario Outline: <wire>: the mint is refused with both faults in order, the collision and then the key nothing is left to name
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "confirmation" and lists the faults
        | key              | message                                                            |
        | confirmation.kid | Members "keyId" and "kid" both resolve to "kid" in "confirmation" |
        | confirmation     | Claim "confirmation" names no key to confirm                       |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint asked for a confirmation that names no key is refused rather than issuing a bearer token

    By including a `cnf` claim the issuer declares a possession the recipient
    can confirm (RFC 7800 §3, RFC 8747 §3). A confirmation naming no key
    declares one nobody can confirm, so neither disposal is a token anyone
    asked for: dropping it hands the audience a bearer token where the issuer
    asked for a bound one, and emitting it puts a binding on the wire that a
    conformant verifier must reject. The issuer is the one party that can
    still repair the request, so the refusal is aegis policy at the mint.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the confirmation claim is the object
        """json
        {}
        """

    Scenario Outline: <wire>: the mint is refused, locating the fault at the confirmation that names nothing
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "confirmation" and locates the fault at "confirmation": Claim "confirmation" names no key to confirm

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token carrying a confirmation verifies when the caller states the binding is already proven

    The proof-of-possession floor must refuse exactly the presentations that
    show no proof, and no others. A caller stating the binding was already
    checked ahead of it — a gateway that validated the proof and forwarded
    the token — is how a deployment behind such a gateway keeps RFC 7800
    binding usable; a floor that refused even then would have deployments
    drop the confirmation instead. The vouch is aegis's own verify option. The
    cose wire has no scenario: a JWK thumbprint confirmation has no CWT
    counterpart (RFC 9679 §5.5), so no bound token can be built on that wire
    to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the confirmation claim is the object
        """json
        { "thumbprint": "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc", "keyId": "k1" }
        """
      And the verifier vouches that the binding was proven upstream

    Scenario: jose: the token verifies as a JWT on the caller's word
      When I mint the content under the "access_token" profile on the jose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"

  Rule: presenting a proof of possession with a token that carries no confirmation is refused

    A proof-of-possession check compares the key the token is bound to
    against the key that made the proof (RFC 9449 §4.3), so a token with no
    binding leaves nothing on one side of the comparison. Accepting the
    presentation would claim proof-of-possession semantics for a bearer
    token, which is the confusion the confirmation claim exists to prevent.
    The refusal is aegis policy at verify: the presenter is told the token is
    unbound rather than having the proof quietly ignored. The cose wire has no
    scenario: a proof of possession is checked against a JWK thumbprint
    confirmation (RFC 9449 §6.1), which has no CWT counterpart
    (RFC 9679 §5.5), so there is no presentation to refuse on that wire.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And a proof identified "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"

    Scenario: jose: the verify is refused, telling the presenter the token is unbound
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "dpop_token_not_bound"
      And the refusal reports the format "jwt"

  Rule: a token carrying a confirmation is refused when the proof is made by a different key

    The check the whole mechanism rests on is that the public key the access
    token is bound to matches the public key from the proof (RFC 9449 §4.3).
    A proof made by a key the token did not name is exactly what a thief
    presents — the stolen token plus a key they do hold. The proof is
    otherwise conformant and correctly signed, so the refusal is attributable
    to the key alone. The cose wire has no scenario: a JWK thumbprint
    confirmation has no CWT counterpart (RFC 9679 §5.5), so no bound token can
    be built on that wire to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the content binds the token to the EdDSA presenter key
      And a proof identified "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"

    @RFC-9449
    Scenario: jose: a proof made by the ES512 key is refused against a token bound to the EdDSA key (RFC-9449 §4.3)
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the ES512 presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "dpop_thumbprint_mismatch"

  Rule: a token carrying a confirmation verifies when the presenter proves possession of the confirmed key

    The floor must be able to say yes and not only no: a check that can only
    refuse leaves proof-of-possession unusable. The check is that the key the
    token is bound to matches the key that made the proof (RFC 9449 §4.3),
    and the token binds itself to a key that is deliberately not a vault
    resident — the verifier learns it from the proof's own `jwk` header and
    from nowhere else. The proof's own claims then reach the caller, because
    the resource server is what acts on them: `jti`, `htm` and `htu`
    (RFC 9449 §4.2) are what a single-use check and a request-binding check
    run on. Reporting them is aegis's read surface, so that scenario carries
    no tag; the access token hash is the formula RFC 9449 §4.2 fixes. The cose
    wire has no scenario: a JWK thumbprint confirmation has no CWT counterpart
    (RFC 9679 §5.5), so no bound token can be built on that wire to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the content binds the token to the EdDSA presenter key
      And a proof identified "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"

    @RFC-9449
    Scenario: jose: the token verifies when the proof's key is the one the confirmation names (RFC-9449 §4.3)
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"
      And the verified proof's thumbprint is the one the raw payload's confirmation names

    Scenario: jose: the verified result reports the identifier, method and target the presenter signed
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified proof reports the identifier "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"

    @RFC-9449
    Scenario: jose: the verified result reports the access token hash as the SHA-256 of the presented token (RFC-9449 §4.2)
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified proof's access token hash is the SHA-256 of the presented token

  Rule: a token carrying a confirmation refuses a proof that commits to a different access token

    `ath` commits a proof to one access token, and the verifier ensures its
    value equals the hash of the token actually presented (RFC 9449 §4.2,
    RFC 9449 §4.3). Without it a proof observed against one token would
    authorise every other token the observer holds. The proof is made by the
    very key the token names, so the only thing wrong with it is which token
    it commits to. The cose wire has no scenario: a JWK thumbprint
    confirmation has no CWT counterpart (RFC 9679 §5.5), so no bound token can
    be built on that wire to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the content binds the token to the EdDSA presenter key
      And a proof identified "dpop-proof-2" for the request "GET" "https://rs.lindorm.io/resource"

    @RFC-9449
    Scenario: jose: a proof whose access token hash names another token is refused (RFC-9449 §4.3)
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over another access token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "dpop_ath_mismatch"

  Rule: a token carrying a confirmation refuses a proof made by a key other than the one it names

    The verifier confirms that the key the access token is bound to is the
    key that made the proof (RFC 9449 §4.3). A proof carries its own public
    key in its header, so a verifier that checked only that the proof was
    internally consistent would accept one that any holder of the token could
    mint for themselves. The proof is conformant in every respect except the
    key it was made with. The cose wire has no scenario: a JWK thumbprint
    confirmation has no CWT counterpart (RFC 9679 §5.5), so no bound token can
    be built on that wire to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the content binds the token to the EdDSA presenter key
      And a proof identified "dpop-proof-3" for the request "GET" "https://rs.lindorm.io/resource"

    @RFC-9449
    Scenario: jose: a proof made by the RS512 key is refused against a token bound to the EdDSA key (RFC-9449 §4.3)
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the RS512 presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "dpop_thumbprint_mismatch"

  Rule: a bound token verifies against a proof that marks an extension critical when the verifier declares it

    A DPoP proof is a JWS (RFC 9449 §4.2) and may carry header parameters an
    extension or a deployment defines; a listed extension the recipient does
    not understand invalidates it (RFC 7515 §4.1.11). The duty to understand
    one is the recipient's, and a verification library is never the final
    recipient, so the presentation stands only when the caller states it takes
    the parameter on — and it states that once, for the token and the proof
    alike, because the application behind the verify is one application.
    That one declaration governing both is aegis policy, so the scenario
    carries no tag. The extension is carried beside the `crit` naming it, so
    the only question left is whether the caller claimed it. The cose wire has
    no scenario: a JWK thumbprint confirmation has no CWT counterpart
    (RFC 9679 §5.5), so no bound token can be built on that wire to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the content binds the token to the EdDSA presenter key
      And a proof identified "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"
      And the proof header carries
        | crit           | ["x-lindorm-hint"] |
        | x-lindorm-hint | "carried"          |
      And the recipient declares the critical parameter "x-lindorm-hint"

    Scenario: jose: the presentation stands under the one declaration, and the proof is reported
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "jwt"
      And the verified proof reports the identifier "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"

  Rule: a bound token is refused when its proof marks an extension critical that the verifier has not declared

    A listed extension header parameter the recipient does not understand
    invalidates a JWS (RFC 7515 §4.1.11), and a DPoP proof is a JWS
    (RFC 9449 §4.2). The proof is the presenter's own artifact — signed by a
    key the verifier has never seen, carrying whatever header the presenter
    chose — so reading past a `crit` it cannot honour would act on the one
    artifact in the exchange it has the least reason to trust. The two
    documents converge here: neither alone says what a verifier does with a
    proof's `crit`. The refusal names the member so the presenter learns which
    parameter was not honoured; the proof is the same one the accepting rule
    presents, so the refusal is attributable to the declaration alone. The
    cose wire has no scenario: a JWK thumbprint confirmation has no CWT
    counterpart (RFC 9679 §5.5), so no bound token can be built on that wire
    to present.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the content binds the token to the EdDSA presenter key
      And a proof identified "dpop-proof-1" for the request "GET" "https://rs.lindorm.io/resource"
      And the proof header carries
        | crit           | ["x-lindorm-hint"] |
        | x-lindorm-hint | "carried"          |

    @RFC-7515
    @RFC-9449
    Scenario: jose: the verify is refused, naming the undeclared parameter (RFC-7515 §4.1.11) (RFC-9449 §4.2)
      When I mint the content under the "access_token" profile on the jose wire
      And the presenter signs the proof with the EdDSA presenter key over the presented token
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "dpop_unsupported_crit_param"
      And the refusal names the undeclared parameter "x-lindorm-hint"
