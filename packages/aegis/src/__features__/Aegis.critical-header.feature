Feature: Critical header parameters

  `crit` is a producer's statement that a recipient must understand a header
  parameter before acting on the token (RFC 7515 §4.1.11, RFC 9052 §3.1).
  aegis is never the final recipient — it verifies on an application's behalf —
  so every reading door refuses a critical parameter until the caller declares
  it, and every writing door refuses a `crit` the specifications forbid a
  producer to write.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a foreign token whose crit names a parameter the specification itself defines is refused at verify

    A producer may not name a specification-defined parameter in `crit`, and a
    recipient may treat a token that does as invalid (RFC 7515 §4.1.11); aegis
    takes that recipient option, at verify as at the mint. The token carries
    `cty` beside the `crit` naming it, so the header is otherwise well-formed
    and the refusal can only be about the member being specification-defined.
    Only a foreign producer can put the shape on the wire. The cose scenario
    carries no tag: RFC 9052 §3.1 says such labels need not be included and
    attaches no consequence to including one, so the same refusal on that wire
    is aegis policy — an enforcement present on one wire and absent on the
    other lets the presenter choose the encoding that is accepted.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | crit | ["cty"]            |
        | cty  | "application/json" |

    @RFC-7515
    Scenario: jose: the token is refused as a malformed JWT, reporting the crit it read (RFC-7515 §4.1.11)
      When a third party signs the wire claims on the jose wire
      And I verify the token
      Then verification is refused as a JWT error
      And the refusal reports the critical list ["cty"]

    Scenario: cose: the token is refused as a malformed CWT, reporting the crit it read
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a CWT error
      And the refusal reports the critical list ["cty"]

  Rule: a parameter the kit derives from the key cannot be smuggled in as a custom one

    The parameters a kit derives — the algorithm, the key id, the content
    encryption, the certificate fields — describe crypto that actually
    happened, and a recipient reads them to decide how to process the token. A
    caller that could state one would be describing crypto that did not
    happen. The registered header bag omits them at the type level, so the
    open set must not become the way back in. The refusal is distinct from the
    one for any other specification-defined name, because the repair differs:
    a registered parameter has a bag that accepts it, and a kit-owned one has
    none at all.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the custom header
        | alg | "ES256" |

    Scenario Outline: <wire>: the signature is refused under the kit-owned verdict, naming the parameter
      When I sign the wire claims as a claims token on the <wire> wire
      Then signing is refused as a <error> error "header_kit_owned_in_custom"
      And the refusal names the parameter "alg"

      Examples:
        | wire | error |
        | jose | JWT   |
        | cose | CWT   |

  Rule: a header parameter the library does not know is reported, never dropped

    A token header is an open set, so a foreign issuer may legitimately carry
    parameters this library has never heard of. Dropping them hides what the
    token said. Reporting them in a bag of their own is what makes that safe:
    merging them into the typed header would hand a caller a value whose type
    says the key cannot exist. On COSE the parameter rides its text label
    (RFC 9052 §1.5), which is the same spelling.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | x-foreign-hint | "issuer-wrote-this" |

    Scenario Outline: <wire>: the parameter is reported in the protected custom bag, as the issuer wrote it
      When a third party signs the wire claims on the <wire> wire
      And I verify the token as a claims token on the <wire> wire
      Then the wire-tier protected custom bag carries "x-foreign-hint" "issuer-wrote-this"

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the parameter does not join the typed header
      When a third party signs the wire claims on the <wire> wire
      And I verify the token as a claims token on the <wire> wire
      Then the wire-tier header carries no "x-foreign-hint"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an unregistered header parameter never reaches the domain header

    The domain surface exists so a caller never has to learn either wire's
    vocabulary. An unregistered parameter has no domain name by definition, so
    surfacing it would put raw wire spellings into the one result that
    promises there are none. The parameter is not lost — the wire result
    reports it — and the boundary holds for a parameter aegis itself wrote as
    much as for a foreign one. The raw bucket is read first, so the scenario
    cannot pass by the parameter never having been written.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the custom header
        | x-lindorm-hint | "carried" |

    Scenario Outline: <wire>: the parameter is on the wire and stops short of the verified header
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the raw protected header carries "x-lindorm-hint" "carried"
      And the verified header carries no "x-lindorm-hint"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a COSE text label spelled like a registered parameter does not override the signed one

    The integer 2 and the text "crit" are different COSE labels naming
    different things (RFC 9052 §1.5). Where both are present the reader must
    resolve to the parameter the issuer's integer label carries, because that
    is the one every conformant implementation reads. The shape is chosen so
    the verdict depends on which `crit` answers: the genuine one names `oid`,
    which the header does not carry, so the token is fatally malformed
    (RFC 9052 §3.1); the impostor names a parameter that is present. Resolving
    the other way would let a holder who cannot re-sign the token repair its
    `crit` by appending two text labels. A JOSE header has one name-space, so
    the collision cannot arise on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | crit | ["oid"] |
      And the foreign protected header carries, under text labels
        | crit     | ["x-shadow"] |
        | x-shadow | "v"          |

    @RFC-9052
    Scenario: cose: the crit at the registered label is the one judged, and the token is refused on it (RFC-9052 §1.5) (RFC-9052 §3.1)
      When a third party signs the wire claims on the cose wire
      And I verify the token as a claims token on the cose wire
      Then verification is refused as a CWT error "cwt_invalid_crit"
      And the refusal reports the critical list ["oid"]

  Rule: a crit member naming an integer label is not satisfied by the text label of the same numeral

    A COSE `crit` lists labels, and an integer label and a text label are
    different kinds of map key that CBOR never conflates (RFC 9052 §1.5) — so
    a header carrying the text "-5885" carries nothing at the integer label
    -5885, and a `crit` naming that integer names a parameter the protected
    bucket does not have, which is fatal (RFC 9052 §3.1). A reader comparing
    the two by their printed form would accept the token on a parameter the
    issuer never marked critical. The refusal names the member as its own
    label space spells it. A JOSE header has one kind of member name, so
    there is no second label space on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | crit | [-5885] |
      And the foreign protected header carries, under text labels
        | -5885 | "carried" |

    @RFC-9052
    Scenario: cose: the token is refused, naming the integer label the protected header does not carry (RFC-9052 §1.5) (RFC-9052 §3.1)
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a CWT error "cwt_invalid_crit"
      And the refusal reports the critical list [-5885]
      And the refusal names the parameter -5885

  Rule: the crit a refusal reports is the one the reader actually judged, not the typed bag beside it

    A refusal is only actionable if its data describes the thing refused. The
    read side splits one header the producer wrote into a typed bag and a bag
    of parameters no registry row answers for, and a `crit` can arrive in
    either — the integer label 2 and the text "crit" are different labels
    (RFC 9052 §1.5), so a token carrying only the text one has an empty typed
    `crit`. A verdict decided on the merged header and reported off the typed
    bag would hand the caller no crit at all for a token refused because of
    its `crit`. The keyless door is the one that reads a header without a key,
    and it judges a `crit` exactly as verify does. Judging a text-labelled
    list as a crit at all is aegis policy.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries, under text labels
        | crit | ["x-shadow"] |

    Scenario: cose: the keyless read refuses the text-labelled crit and reports the list it judged
      When a third party signs the wire claims on the cose wire
      And I read the token without a key
      Then the keyless read is refused as a CWT error "cwt_invalid_crit"
      And the refusal reports the critical list ["x-shadow"]
      And the refusal names the parameter "x-shadow"

  Rule: a token this library signs can be read back by its own keyless reader

    `parse` and `verify` are two doors onto the same bytes, and a producer
    chooses between them by whether it holds a key — never by what the token
    says. A rule enforced at one door and not the other is an accident of which
    door a caller happened to use. The shape that exposes it is a `crit` naming
    a custom parameter: both readers must locate it to decide the token is
    well-formed, and its two halves live in different bags on the read side.
    A reader consulting only the registered bag would refuse what this library
    had just signed, and that refusal is fatal rather than cosmetic
    (RFC 9052 §3.1). The keyless read takes no declaration; the verify does.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["x-lindorm-hint"] |
      And the custom header
        | x-lindorm-hint | "carried" |
      And the recipient declares the critical parameter "x-lindorm-hint"

    Scenario Outline: <wire>: the keyless read and the declared verify both accept the token
      When I sign the wire claims as a claims token on the <wire> wire
      And I read the token without a key
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a critical UNREGISTERED header parameter round-trips: minted, and accepted at verify by a caller that declares it

    `crit` may not name parameters the specification itself defines
    (RFC 7515 §4.1.11), which leaves an issuer's own extension as precisely
    what the parameter is for. A library that would mint such a token and then
    refuse it from every caller would be two disagreeing implementations. The
    duty to understand the extension belongs to the recipient, and a
    verification library is never the final recipient, so the round trip
    closes only when the caller states that it takes the parameter on. Both
    halves are asserted on the wire: without the `crit` half, the round trip
    would stay green if the mint dropped the member entirely. The parameter
    rides under its own key on both encodings; `crit` is a registered
    parameter, so COSE keys it by its integer label 2 — a rule this table
    does not cite, so the cose scenario carries no tag.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["x-lindorm-hint"] |
      And the custom header
        | x-lindorm-hint | "carried" |
      And the recipient declares the critical parameter "x-lindorm-hint"

    Scenario Outline: <wire>: the token verifies for the caller that declares the parameter
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the parameter rides the protected header under its own name
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the raw protected header carries "x-lindorm-hint" "carried"

      Examples:
        | wire |
        | jose |
        | cose |

    @RFC-7515
    Scenario: jose: the crit rides the protected header and names the parameter (RFC-7515 §4.1.11)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the raw protected header carries "crit" as the list "x-lindorm-hint"

    Scenario: cose: the crit rides the protected header at its registered label and names the parameter
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the raw protected header carries label 2 as the list "x-lindorm-hint"

  Rule: a token marking a custom header parameter critical is refused from a verifier that has not claimed it

    A listed extension header parameter the recipient does not understand
    invalidates the token on JOSE (RFC 7515 §4.1.11). The same refusal on
    COSE is aegis policy, not a citation: RFC 9052 §3.1 attaches no such
    consequence. The duty belongs to the recipient, and a verification library
    cannot know what the application behind it implements, so accepting on
    carriage alone would leave the duty unenforced for every extension a
    specification does not define. Refusing until the parameter is claimed
    fails closed: a verifier that says nothing gets the strict answer. The
    refusal names the member, not the whole list.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["x-lindorm-hint"] |
      And the custom header
        | x-lindorm-hint | "carried" |

    @RFC-7515
    Scenario: jose: the token is refused as unsupported, naming the undeclared parameter (RFC-7515 §4.1.11)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then verification is refused as a JWT error "jwt_unsupported_crit_param"
      And the refusal names the undeclared parameter "x-lindorm-hint"

    Scenario: cose: the token is refused as unsupported, naming the undeclared parameter
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then verification is refused as a CWT error "cwt_unsupported_crit_param"
      And the refusal names the undeclared parameter "x-lindorm-hint"

  Rule: declaring a critical parameter does not make a token that omits it verifiable

    A `crit` naming a parameter the protected header does not carry is a fatal
    processing error on COSE (RFC 9052 §3.1); on JOSE a producer may not write
    one and a recipient may treat a token that does as invalid
    (RFC 7515 §4.1.11), and aegis takes that recipient option. The declaration
    and the presence rule answer different questions: one says the recipient
    will act on the parameter, the other says the issuer actually stated it. A
    declaration that waived presence would let a verifier turn a malformed
    token into a valid one by naming the missing parameter. The token is a
    foreign producer's, since aegis's own mint gate refuses the shape; on JOSE
    it is hand-assembled, which `jose` itself refuses to write.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | crit | ["x-lindorm-hint"] |
      And the recipient declares the critical parameter "x-lindorm-hint"

    @RFC-7515
    Scenario: jose: the token is refused as malformed, not as unsupported (RFC-7515 §4.1.11)
      When a third party signs the wire claims on the jose wire
      And I verify the token
      Then verification is refused as a JWT error "jwt_invalid_crit"

    @RFC-9052
    Scenario: cose: the token is refused as malformed, not as unsupported (RFC-9052 §3.1)
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a CWT error "cwt_invalid_crit"

  Rule: a verifier cannot take responsibility for a critical parameter the specification itself defines

    A producer may not name a specification-defined parameter in `crit`
    (RFC 7515 §4.1.11), so there is no conformant token for a recipient to
    accept. The declaration transfers the duty to understand an extension; it
    is not a waiver of the rules about what may be named, and reading it as
    one would let any verifier opt back into the exact shape the specification
    prohibits. The cose scenario carries no tag: RFC 9052 §3.1 states no such
    prohibition, and the refusal there is aegis policy for the reason the
    first rule gives.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | crit | ["cty"]            |
        | cty  | "application/json" |
      And the recipient declares the critical parameter "contentType"

    @RFC-7515
    Scenario: jose: the declaration does not admit the specification-defined member (RFC-7515 §4.1.11)
      When a third party signs the wire claims on the jose wire
      And I verify the token
      Then verification is refused as a JWT error "jwt_invalid_crit"

    Scenario: cose: the declaration does not admit the specification-defined member
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a CWT error "cwt_invalid_crit"

  Rule: declaring a critical parameter does not admit one that rides the unsigned COSE bucket

    Every critical parameter must be integrity-protected (RFC 9052 §3.1),
    because a parameter the signature does not cover is one any holder in the
    path could have written. A recipient declaring that it will act on the
    parameter makes that worse rather than better: it is now committed to
    honouring a value an intermediary chose. So the bucket rule is prior to the
    declaration, and the reader consults the protected bucket alone when
    deciding whether the header carries what its `crit` names. The JOSE
    compact serialisation has one header and it is protected
    (RFC 7515 §7.1), so there is no unsigned bucket on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the foreign protected header carries
        | crit | ["x-lindorm-hint"] |
      And the foreign unprotected header carries
        | x-lindorm-hint | "advisory" |
      And the recipient declares the critical parameter "x-lindorm-hint"

    @RFC-9052
    Scenario: cose: the token is refused as malformed, since the protected bucket does not carry the parameter (RFC-9052 §3.1)
      When a third party signs the wire claims on the cose wire
      And I verify the token
      Then verification is refused as a CWT error "cwt_invalid_crit"

  Rule: the raw wire verify door takes the same critical-parameter declaration the domain door does

    A caller reaches the same rule through two doors — the domain verb and
    the raw wire namespace — and a declaration honoured at one and dropped at
    the other is invisible: the caller states it, sees no error, and the token
    is refused anyway. The duty sits with the recipient rather than with a
    tier (RFC 7515 §4.1.11), so which door an application happens to use
    cannot decide whether it is allowed to claim an extension.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["x-lindorm-hint"] |
      And the custom header
        | x-lindorm-hint | "carried" |
      And the recipient declares the critical parameter "x-lindorm-hint"

    Scenario Outline: <wire>: the raw claims door accepts the token for the declaring caller
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token as a claims token on the <wire> wire
      Then the raw door accepts the token

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the opaque wire verify door takes the critical-parameter declaration for a signature over arbitrary octets

    An opaque signature carries the same critical-parameter rule a claims
    token does: neither the signature's reach nor the recipient's duty turns
    on the payload being a claim set (RFC 7515 §1, RFC 7515 §4.1.11). The
    opaque signing door can write a critical custom header parameter, so a
    matching verify door that cannot be told about one would make the library
    refuse its own output on that surface alone. Both halves are asserted on
    the wire for the reason the structured twin states: an acceptance alone
    would stay green if the opaque signing door dropped either. The cose
    `crit` scenario carries no tag, as the structured twin's does not.

    Background:
      Given the payload to sign
        | tid   | at_abc |
        | scope | openid |
      And the wire header
        | crit | ["x-lindorm-hint"] |
      And the custom header
        | x-lindorm-hint | "carried" |
      And the recipient declares the critical parameter "x-lindorm-hint"

    Scenario Outline: <wire>: the opaque door accepts the token for the declaring caller
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token as opaque content on the <wire> wire
      Then the raw door accepts the token

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the parameter rides the protected header under its own name
      When I sign the payload as opaque content on the <wire> wire
      And I verify the token as opaque content on the <wire> wire
      Then the raw protected header carries "x-lindorm-hint" "carried"

      Examples:
        | wire |
        | jose |
        | cose |

    @RFC-7515
    Scenario: jose: the crit rides the protected header and names the parameter (RFC-7515 §4.1.11)
      When I sign the payload as opaque content on the jose wire
      And I verify the token as opaque content on the jose wire
      Then the raw protected header carries "crit" as the list "x-lindorm-hint"

    Scenario: cose: the crit rides the protected header at its registered label and names the parameter
      When I sign the payload as opaque content on the cose wire
      And I verify the token as opaque content on the cose wire
      Then the raw protected header carries label 2 as the list "x-lindorm-hint"

  Rule: an encrypting outer marking a custom header parameter critical is read only by a caller that declares it

    An encrypting outer carries a header exactly as a signed one does, and
    `crit` means the same thing on a JWE as on a JWS (RFC 7516 §4.1.13,
    RFC 7515 §4.1.11). A library whose sealing door can write a critical custom
    parameter and whose opening door cannot be told about one refuses the
    tokens it produces itself, so the declaration has to reach the decrypt
    door and not the verify door alone.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the text to encrypt "sealed-plaintext"
      And the wire header
        | crit | ["x-lindorm-hint"] |
      And the custom header
        | x-lindorm-hint | "carried" |
      And the recipient declares the critical parameter "x-lindorm-hint"

    Scenario Outline: <wire>: the sealed token is opened for the declaring caller
      When I encrypt the text as sealed content on the <wire> wire
      And I decrypt the token
      Then the decrypted token is a "<format>"
      And the decrypted payload is the text "sealed-plaintext"

      Examples:
        | wire | format |
        | jose | jwe    |
        | cose | cwe    |

  Rule: a refusal of a critical-parameter list names the parameter the library cannot honour

    A producer may mark several parameters critical at once
    (RFC 7515 §4.1.11), and only some of them may be nameable there. The
    refusal is the only part of the verdict a caller can act on, so it has to
    name the parameter actually objected to rather than whichever happens to
    be listed first. `oid` is listed first deliberately: it is the member
    aegis permits, so a refusal naming it would be naming the wrong one.
    `alg` is a specification-defined name and so forbidden outright; it is
    the one the verdict must name, beside the whole list.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid", "alg"] |
        | oid  | "1.2.3.4"      |

    Scenario Outline: <wire>: the refusal carries the whole list and names the forbidden member, not the first
      When I sign the wire claims as a claims token on the <wire> wire
      Then signing is refused as a <error> error
      And the refusal reports the critical list ["oid", "alg"]
      And the refusal names the parameter "alg"

      Examples:
        | wire | error |
        | jose | JWT   |
        | cose | CWT   |

  Rule: a token marking a header parameter the library implements critical is minted, and verified by a caller that declares it

    `crit` is a producer's one way to say that a recipient is required to
    understand a header parameter, on either wire (RFC 7515 §4.1.11,
    RFC 9052 §3.1). Both are worthless to a library that refuses every such
    token, including its own output. So a parameter the library implements as
    an extension is one it can be told to insist on, and one it honours the
    insistence about — which means carrying the parameter through to the
    verified header, in domain vocabulary, where the application can act on
    it. `oid` gets no exception from the declaration, because aegis
    registering a parameter says nothing about whether the application behind
    it can act on one.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid"]   |
        | oid  | "1.2.3.4" |
      And the recipient declares the critical parameter "objectId"

    Scenario Outline: <wire>: the token verifies for the declaring caller
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the verified header reports the critical list and the parameter in domain vocabulary
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified header includes
        | critical | ["objectId"] |
        | objectId | "1.2.3.4"    |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token marking the library's own extension critical is refused from a verifier that has not claimed it

    A token is invalid when a listed extension header parameter is not
    understood and supported by the recipient, on JOSE (RFC 7515 §4.1.11).
    The same refusal on COSE is aegis policy, not a citation: RFC 9052 §3.1
    attaches no such consequence. That a library registers a parameter,
    translates it and reports it says only that the library can carry the
    value; it says nothing about whether the application receiving that value
    can act on it. So a registered extension is on exactly the same footing as
    an issuer's own: both are refused until the caller states that it takes
    the parameter on.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid"]   |
        | oid  | "1.2.3.4" |

    @RFC-7515
    Scenario: jose: the token is refused as unsupported, naming the undeclared parameter (RFC-7515 §4.1.11)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then verification is refused as a JWT error "jwt_unsupported_crit_param"
      And the refusal names the undeclared parameter "oid"

    Scenario: cose: the token is refused as unsupported, naming the undeclared parameter
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then verification is refused as a CWT error "cwt_unsupported_crit_param"
      And the refusal names the undeclared parameter "oid"

  Rule: the raw wire verify door claims the library's own extension under the name the header carries

    A wire door speaks the wire's vocabulary in every direction — the header
    it reports, the `crit` it reads, and the declaration it takes. A door that
    reported a parameter under one spelling and demanded another to accept it
    would make the caller hold two names for one thing, and the mismatch is
    silent. So the declaration is spelled exactly as the member the reader is
    comparing it against.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid"]   |
        | oid  | "1.2.3.4" |
      And the recipient declares the critical parameter "oid"

    Scenario Outline: <wire>: the raw claims door accepts the declaration spelled as the wire name
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token as a claims token on the <wire> wire
      Then the raw door accepts the token

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: the domain verify door refuses a critical-parameter declaration spelled in wire names

    The domain tier exists so a caller never has to learn either encoding's
    vocabulary: every value it takes is stated in aegis names, and the
    crossing translates them. A door that also accepted the wire spelling
    would speak two vocabularies at once, and a caller reading one surface
    would write the other. The refusal is the mirror of a wire door refusing a
    domain-spelled `crit` member, and together they keep one name meaning one
    thing per tier.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid"]   |
        | oid  | "1.2.3.4" |
      And the recipient declares the critical parameter "oid"

    Scenario Outline: <wire>: the domain door refuses the declaration and names the domain spelling it expects
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "crit_declaration_not_domain_named"
      And the refusal names the parameter "oid" and expects the domain spelling "objectId"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint refuses a critical-parameter list naming a parameter the specification itself defines

    A producer may not name a specification-defined parameter in `crit`, and a
    recipient may treat a token that does as invalid (RFC 7515 §4.1.11). Such
    a `crit` adds no information, because every implementation already
    understands the parameter, and it costs conformance. Holding COSE to the
    same refusal is aegis policy: RFC 9052 §3.1 puts the low integer labels an
    implementation already handles under a SHOULD-omit rather than a
    prohibition. `alg` is the sharpest member available: it is required on
    every token, so the refusal cannot be mistaken for the separate rule about
    a `crit` naming a parameter the header lacks. The refusal belongs at the
    write, the last point at which the producer can still choose differently.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["alg"] |

    @RFC-7515
    Scenario: jose: the signature is refused, naming the specification-defined member (RFC-7515 §4.1.11)
      When I sign the wire claims as a claims token on the jose wire
      Then signing is refused as a JWT error
      And the refusal names the parameter "alg"

    Scenario: cose: the signature is refused, naming the specification-defined member
      When I sign the wire claims as a claims token on the cose wire
      Then signing is refused as a CWT error
      And the refusal names the parameter "alg"

  Rule: a mint refuses a critical-parameter list that names the same parameter twice

    A producer may not repeat a name in `crit` (RFC 7515 §4.1.11). A repeat
    states nothing the first mention did not, and what it costs is
    conformance: the token is malformed for every recipient that applies the
    rule. `oid` is the member that makes this reproduce the rule rather than
    agree with it by accident — it is the one parameter a producer may
    legitimately mark critical, so the only thing wrong with the header is the
    repetition. The refusal is at the write; a foreign token carrying a
    duplicate is deliberately still accepted, since the specification binds
    the producer and leaves the recipient a MAY. The cose scenario carries no
    tag: RFC 9052 §3.1 states no duplicate rule, so the refusal there is
    aegis policy.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["oid", "oid"] |
        | oid  | "1.2.3.4"      |

    @RFC-7515
    Scenario: jose: the signature is refused, reporting the repeating list and the repeated member (RFC-7515 §4.1.11)
      When I sign the wire claims as a claims token on the jose wire
      Then signing is refused as a JWT error
      And the refusal reports the critical list ["oid", "oid"]
      And the refusal names the parameter "oid"

    Scenario: cose: the signature is refused, reporting the repeating list and the repeated member
      When I sign the wire claims as a claims token on the cose wire
      Then signing is refused as a CWT error
      And the refusal reports the critical list ["oid", "oid"]
      And the refusal names the parameter "oid"

  Rule: a wire-named door refuses a critical-parameter list written in domain vocabulary

    A door takes one vocabulary. The wire doors take wire parameter names, and
    a `crit` member is a parameter name like any other. A door that quietly
    accepted the domain spelling in that one position would resolve the same
    call two ways depending on the encoding: a COSE `crit` member is a label,
    the very label its parameter is keyed under (RFC 9052 §3.1,
    RFC 9052 §1.5), so a member the JOSE door silently translated has no
    counterpart on the COSE wire. `oid` is supplied, so the refusal is about
    the spelling and not about a missing parameter.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire header
        | crit | ["objectId"] |
        | oid  | "1.2.3.4"    |

    Scenario Outline: <wire>: the signature is refused, naming the domain-spelled member
      When I sign the wire claims as a claims token on the <wire> wire
      Then signing is refused as a <error> error
      And the refusal names the parameter "objectId"

      Examples:
        | wire | error |
        | jose | JWT   |
        | cose | CWT   |

  Rule: a domain-named mint marks a parameter critical using the domain name for it

    The domain tier is the surface a caller reaches when it does not want to
    know which encoding the token ends up in, so every value it takes is
    stated in aegis vocabulary — including a `crit` member, which is a
    parameter name and must therefore be spelled the way the same bag spells
    its keys. The crossing translates both together, so the member and the
    parameter it names can never disagree; a tier that translated the keys
    and not the members would emit a `crit` naming a parameter the token does
    not carry — a fatal processing error on COSE (RFC 9052 §3.1), and on JOSE
    a header a producer may not write (RFC 7515 §4.1.11). The declaration is
    in the same vocabulary as the mint's: one spelling for the member on both
    sides of the domain door.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the domain header
        | critical | ["objectId"] |
        | objectId | "1.2.3.4"    |
      And the recipient declares the critical parameter "objectId"

    Scenario Outline: <wire>: the minted token verifies for the caller declaring the same domain name
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the verified header reports the critical list and the parameter in domain vocabulary
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified header includes
        | critical | ["objectId"] |
        | objectId | "1.2.3.4"    |

      Examples:
        | wire |
        | jose |
        | cose |
