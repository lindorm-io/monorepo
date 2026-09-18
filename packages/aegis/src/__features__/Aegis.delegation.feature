Feature: Delegation, and the actor policy a verifier states over it

  The `act` claim says a token is presented by a party acting for its subject,
  and one `act` nested in another is the chain of hands the token passed
  through (RFC 8693 §4.1). A verify reports that chain on the result, and a
  verifier states a policy over it: a demand, a prohibition, a list of trusted
  actors, a depth. The member set of an actor is open, so what aegis does with
  a member it does not declare, on each door and at every depth, is the same
  subject seen from the wire.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a token presented by an actor on a subject's behalf reports that delegation on the result

    `act` names the party currently acting for the subject, and its whole
    purpose is that the recipient can tell a delegated presentation from a
    direct one. A result that dropped the chain would report the token as
    though the subject had presented it, so every authorisation decision
    downstream would attribute the request to the wrong party — and an actor
    policy stated against it would have nothing to read. The cose scenario
    carries no tag: the rule is the JWT specification's, a CWT is not a JWT,
    and `act` has no registered CWT claim key — it rides the COSE wire under
    its JWT name, which no document this row cites gives a meaning.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | act | { "sub": "service-a" }     |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    @RFC-8693
    Scenario: jose: the verified result reports the presentation as delegated, naming the current actor (RFC-8693 §4.1)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"
      And the verified delegation is exactly the object
        """json
        { "isDelegated": true, "currentActor": "service-a", "actorChain": [{ "subject": "service-a" }] }
        """

    Scenario: cose: the verified result reports the presentation as delegated, naming the current actor
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"
      And the verified delegation is exactly the object
        """json
        { "isDelegated": true, "currentActor": "service-a", "actorChain": [{ "subject": "service-a" }] }
        """

  Rule: a token presented by its own subject reports a delegation bucket saying so

    The `act` claim is what expresses that delegation has occurred
    (RFC 8693 §4.1). Its absence is therefore a positive statement about the
    presentation, and the result has to carry that statement rather than
    leave the bucket off — aegis policy on the read surface: a consumer
    reading `isDelegated` off an absent bucket reads `undefined`, which is
    falsy, so the direct case and the case where the read side simply lost
    the chain become indistinguishable, and the second is the one that
    misattributes a delegated request to the subject.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the delegation bucket is present and states that nobody acts for the subject
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified delegation is exactly the object
        """json
        { "isDelegated": false, "actorChain": [] }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a verifier demanding a delegated presentation accepts a token that names an actor

    A requirement has to refuse exactly the presentations that fail it. An
    endpoint that only ever serves delegated calls states this so an
    undelegated token cannot reach it; if the requirement also refused the
    delegated tokens it was written for, the endpoint could not be used at
    all, and the remedy a deployment reaches for is to drop the requirement
    rather than narrow it — which removes the refusal that mattered.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | act | { "sub": "service-1" }     |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier demands a delegated presentation

    Scenario Outline: <wire>: the demand is met and the token verifies
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a verifier that accepts only direct presentations refuses a delegated token

    An `act` claim says the request is being made by a party acting for the
    subject rather than by the subject (RFC 8693 §4.1). An operation that
    must be performed by the end-user in person — a credential change, a
    consent — is authorised by the subject and not by anyone acting for them,
    so the verifier needs a way to refuse the delegated form outright.
    Without it the only remaining defence is that every downstream check
    happens to notice the actor, which none of them are written to do. The
    prohibition is aegis policy; the specification defines the claim, not
    what a verifier may demand of it.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | act | { "sub": "service-1" }     |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier accepts only a direct presentation

    Scenario Outline: <wire>: the delegated token is refused
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_not_allowed"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verifier listing the actors it trusts accepts a chain whose earlier actors it does not list

    The allowlist answers one question — is the party making this call one
    the verifier trusts — and it is read against that party alone: a consumer
    applying access control policy considers the current actor, and prior
    actors are informational only. The hops a credential took before it
    arrived are history about parties that are no longer touching the
    request; holding the list against all of them would refuse a token over
    a party that cannot act on it any more, and a list that refuses on
    history is one a deployment can keep only by naming every intermediary
    that has ever existed or by dropping the list. The cose scenario carries
    no tag: the rule is the JWT specification's, a CWT is not a JWT, and
    `act` has no registered CWT claim key — no document this row cites gives
    it a meaning on that wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                        |
        | sub | "user-1"                                          |
        | aud | ["https://rs.lindorm.io/"]                        |
        | jti | "token-1"                                         |
        | act | { "sub": "service-1", "act": { "sub": "rogue" } } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier admits only an actor matching
        """json
        { "subject": "service-1" }
        """

    @RFC-8693
    Scenario: jose: the list is held against the current actor alone, so the chain verifies (RFC-8693 §4.1)
      When I sign the wire claims as a claims token on the jose wire
      And I verify the token
      Then the verified token is a "jwt"

    Scenario: cose: the list is held against the current actor alone, so the chain verifies
      When I sign the wire claims as a claims token on the cose wire
      And I verify the token
      Then the verified token is a "cwt"

  Rule: a verifier listing the actors it trusts refuses a chain whose calling actor is not listed

    The refusal is the whole of the constraint: an unlisted party wielding
    the token is exactly what a deployment states this option to stop, and it
    is the half that is invisible when it is missing, because a check that
    always accepts and a check that is correct agree on every token that was
    going to be accepted anyway. The unlisted party here is the current actor
    and the listed one is a prior actor, so a policy that searched the chain
    rather than reading its head (RFC 8693 §4.1) would accept this token.
    The refusal is aegis policy: the specification says which actor a
    consumer reads, not what it does when the list does not name that actor.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                        |
        | sub | "user-1"                                          |
        | aud | ["https://rs.lindorm.io/"]                        |
        | jti | "token-1"                                         |
        | act | { "sub": "rogue", "act": { "sub": "service-1" } } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier admits only an actor matching
        """json
        { "subject": "service-1" }
        """

    Scenario Outline: <wire>: a listed prior actor does not answer for the unlisted current one
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_not_allowed"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verifier listing the actors it trusts refuses a token presented by its own subject

    A constraint on who may act cannot be satisfied by nobody acting. The
    `act` claim is what expresses that delegation has occurred and identifies
    the acting party (RFC 8693 §4.1), so a token carrying none names no such
    party at all — a different presentation from the ones the list was
    written to admit. Admitting it would make the allowlist a constraint that
    applies only once some other claim happens to be present, and a verifier
    stating one would have to state a delegation requirement beside it to get
    back the refusal it had already asked for. Aegis policy at verify.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier admits only an actor matching
        """json
        { "subject": "service-1" }
        """

    Scenario Outline: <wire>: a token naming no actor cannot satisfy the list
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_not_allowed"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verifier whose actor allowlist names the parties it refuses still refuses a token presented by its own subject

    Naming the parties a verifier will not accept states the same policy as
    naming the ones it will: some party is acting, and it is not one of
    those. The refusal of a token naming no actor therefore has to be decided
    before the condition is applied rather than by it — the condition
    language negates two-valuedly, so an actor that is not there fails to
    match anything and consequently satisfies every denial. A verifier whose
    policy survived being rewritten from a list of admitted parties into a
    list of refused ones, but whose refusal of the undelegated presentation
    did not, has had a hole opened by an edit that changed nothing it could
    observe. The code separates the two refusals a bad allowlist can draw:
    this is the token failing a well-formed condition, and it would read as
    green if the condition were instead refused as one that constrains
    nothing.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier admits only an actor matching
        """json
        { "$not": { "subject": "rogue" } }
        """

    Scenario Outline: <wire>: the absent actor is refused as the token's fault, not admitted by the denial
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_not_allowed"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verifier stating an actor allowlist with no condition in it has the call refused rather than obeyed

    A condition naming no field is satisfied by every actor, so an allowlist
    written that way authorises everyone while the call site still reads as
    an allowlist — and the deployment that wrote it has stopped checking
    elsewhere precisely because it believes this check is in force. Nothing
    downstream can notice, since every token the policy should have refused
    is accepted instead. Refusing the call is what makes it visible: a policy
    that cannot refuse is worse than no policy at all. It is the condition
    that must state something, not the option: an absent allowlist states no
    actor policy and stays legal. The token names an actor the empty
    condition would match; without one it would be refused for naming no
    actor at all, and the scenario could not tell a working guard from a
    missing one. The code names the caller's option as the malformed thing:
    sharing the token-shaped code would send an operator to read a token
    that is fine.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | act | { "sub": "service-1" }     |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier admits only an actor matching
        """json
        {}
        """

    Scenario Outline: <wire>: the call is refused, naming the caller's option as the fault
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_policy_invalid"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verifier stating an actor allowlist whose alternatives include one with no condition in it has the call refused rather than obeyed

    A list of alternatives admits an actor satisfying any one of them, so an
    alternative naming no field admits every actor and the surrounding list
    stops constraining — while the call site still reads as a list of
    trusted parties, and every alternative that does name a party still
    reads as if it were being held against the actor. This is the shape a
    list assembled from configuration produces: one entry that names nothing
    yields one alternative that constrains nothing, and the list nobody
    wrote out by hand is the one nobody re-reads. Refusing the call is what
    makes it visible. The token names an actor no named alternative admits,
    so only the degenerate one could let it through — which is what
    separates a working guard from a missing one here.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | act | { "sub": "service-1" }     |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier admits only an actor matching
        """json
        { "$or": [{ "subject": "nobody" }, {}] }
        """

    Scenario Outline: <wire>: the call is refused, naming the caller's option as the fault
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_policy_invalid"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verifier bounding the delegation depth refuses a chain longer than it allows

    A chain nests one `act` claim within another (RFC 8693 §4.1), and every
    additional hop is another party that has held the token. A depth bound
    is how a deployment states how far a credential may travel from the
    party that authorised it, and it is also the only structural bound on
    the claim at all — an unbounded nesting is an unbounded parse, so a
    verifier that never reads the depth cannot refuse a chain built purely
    to be expensive. The bound is aegis policy; the specification puts no
    limit on the nesting.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                                                     |
        | sub | "user-1"                                                                       |
        | aud | ["https://rs.lindorm.io/"]                                                     |
        | jti | "token-1"                                                                      |
        | act | { "sub": "service-1", "act": { "sub": "service-2", "act": { "sub": "service-3" } } } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the verifier bounds the delegation depth at 2

    Scenario Outline: <wire>: a chain of three actors is refused under a bound of two
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "actor_not_allowed"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint carries an actor member RFC 8693 permits and aegis does not declare, at every depth

    The actor's member set is open to further identity claims — both the
    actor and the authorized actor close it to non-identity ones
    (RFC 8693 §4.1, RFC 8693 §4.4). The set of claims that may identify an
    actor belongs to the deployment and to the other specifications it
    composes with, not to this library: an issuer that needs one more
    identifier must be able to write it, and a reader must report it rather
    than pretend the issuer said less. The member travels untouched because
    its name was given by whoever registered it — a case flip would not
    translate it but rewrite it into a field nobody reads. The nesting is
    part of the rule and not a bonus: a nested `act` is the same kind of
    object as the outer one, so a member set that opened at the top and
    closed one level down would be a rule about nothing. The raw wire is
    asserted whole, so a translator that also emitted a spelling of its own
    beside the member fails. The cose scenario carries no tag: the rule is
    the JWT specification's, a CWT is not a JWT, and `act` has no registered
    CWT claim key — no document this row cites gives it a meaning on that
    wire. The read back is aegis's own surface and carries no tag either.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the actor claim is the object
        """json
        { "subject": "service-1", "act": { "subject": "service-2", "email": "service-2@example.test" } }
        """

    @RFC-8693
    Scenario: jose: the undeclared member rides the wire verbatim beside the declared one in its registered spelling, at depth (RFC-8693 §4.1)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "act" as the object
        """json
        { "sub": "service-1", "act": { "sub": "service-2", "email": "service-2@example.test" } }
        """

    Scenario: cose: the undeclared member rides the wire verbatim beside the declared one in its registered spelling, at depth
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries "act" as the object
        """json
        { "sub": "service-1", "act": { "sub": "service-2", "email": "service-2@example.test" } }
        """

    Scenario Outline: <wire>: the member is read back at depth under the domain vocabulary
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified actor claim is exactly the object
        """json
        { "subject": "service-1", "act": { "subject": "service-2", "email": "service-2@example.test" } }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verify reports an actor member of somebody else's token that aegis does not declare

    A read reports what a producer wrote. Dropping a member the library has
    no declaration for makes it misreport a stranger's token as saying less
    than it says, and does so silently — so nothing downstream can tell an
    actor the issuer described in two members from one they described in
    three, and a deployment that depends on the extra identifier discovers
    the loss only where it eventually matters. That is worse than either
    honest alternative: refusing says the token cannot be read, reporting
    says what it contains. The extra member is legitimate in the first place
    (RFC 8693 §4.1), so refusing would reject conformant issuers, which
    leaves reporting as the only answer that is both honest and usable —
    aegis's read policy, stated whole so a member the read dropped or
    renamed fails. The token is written through the raw kit door, which
    performs no translation, so the wire says exactly what this row means it
    to say.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                                 |
        | sub | "user-1"                                                   |
        | aud | ["https://rs.lindorm.io/"]                                 |
        | jti | "token-1"                                                  |
        | act | { "sub": "service-1", "email": "service-1@example.test" } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the member is reported under the name its issuer wrote
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified actor claim is exactly the object
        """json
        { "subject": "service-1", "email": "service-1@example.test" }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a mint carries a caller's actor audience under the name the caller wrote, never as the actor's `aud`

    aegis declares no audience member inside an actor claim and emits none —
    aegis policy at the mint door, RFC 8693 §4.1 — and the policy lives in
    the type, so a typed call site does not compile. A caller who reaches
    past it has written a member the registry has never heard of, and the
    open member set decides the rest: it rides untouched, under the name the
    caller gave it. Both alternatives are worse. Spelling it `aud` would put
    a member on a signed wire that aegis neither declares nor validates,
    under the name a recipient reads as one this library stands behind.
    Dropping it would sign a token saying less than the caller asked for,
    with nothing downstream able to notice the loss. Carrying it verbatim is
    what every undeclared member gets, so one rule answers the case instead
    of a second rule for one name. The raw wire is asserted whole on both
    encodings, which is what shows no `aud` beside the member.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the actor claim is the object
        """json
        { "subject": "service-1", "audience": ["https://rs.lindorm.io/"] }
        """

    Scenario Outline: <wire>: the wire carries the member under the caller's name, and no `aud` beside it
      When I mint the content under the "access_token" profile on the <wire> wire
      Then the raw payload carries "act" as the object
        """json
        { "sub": "service-1", "audience": ["https://rs.lindorm.io/"] }
        """

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the member is read back under the name the caller wrote
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified actor claim is exactly the object
        """json
        { "subject": "service-1", "audience": ["https://rs.lindorm.io/"] }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verify reports a foreign token's actor `aud` under the name its issuer wrote

    A read reports what a producer wrote. An issuer that put an `aud` inside
    an actor wrote a member aegis does not declare (RFC 8693 §4.1), and the
    open member set already settles what becomes of one: it is reported,
    under its own name — aegis's read policy, untranslated and unvalidated.
    Refusing would reject a token whose only fault is a member this library
    holds no opinion about. Translating it into the domain `audience` would
    state that aegis recognised and validated it — an assertion about a
    stranger's token that nothing in this package backs, and one the domain
    type refuses to make in the first place. The asymmetry with the mint door
    is the capability, not an oversight: what aegis emits is its own policy,
    and what aegis reports is the issuer's, so neither door may be read off
    the other. The actor's audience differs from the token's own, so a read
    that confused the two cannot pass.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                                     |
        | sub | "user-1"                                                       |
        | aud | ["https://rs.lindorm.io/"]                                     |
        | jti | "token-1"                                                      |
        | act | { "sub": "service-1", "aud": ["https://other-rs.lindorm.test"] } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the actor's `aud` is reported in the tail, untranslated
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified actor claim is exactly the object
        """json
        { "subject": "service-1", "aud": ["https://other-rs.lindorm.test"] }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a token whose actor carries a domain-spelled look-alike beside the real one is refused, not re-read from the look-alike

    The acting party is identified by the claims inside the `act` object,
    `sub` among them (RFC 8693 §4.1), so which party the issuer named is
    decided by that member and by nothing else. The actor's member set is
    open, and an open set is what makes this reachable: a member the library
    carries untouched can be spelled exactly like the library's own domain
    name for a member it does declare, so `sub` and `subject` both arrive at
    `subject` and something has to decide between them. Deciding by key
    order hands the identification to whoever presents the token: a chain
    the issuer wrote as `{"sub":"audited-service"}` is re-read as naming a
    different actor entirely by appending one member the issuer never wrote,
    and every allowlist, every scope and every audit record downstream then
    names the wrong party. There is no safe winner to pick — the token is
    self-contradictory about the one fact the claim exists to state — so the
    collision is refused, naming the key both members resolved to. Aegis
    policy at verify: the specification permits the member, and aegis
    refuses the collision because carrying an unknown member and carrying it
    into a declared member's own slot are two different acts.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                                |
        | sub | "user-1"                                                  |
        | aud | ["https://rs.lindorm.io/"]                                |
        | jti | "token-1"                                                 |
        | act | { "sub": "audited-service", "subject": "rogue-service" } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the collision is refused, naming the key both members resolved to
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and locates the fault at "act.subject": Members "sub" and "subject" both resolve to "subject" in "act"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token whose actor names ONLY a domain-spelled look-alike is refused, not read as identifying that actor

    The dangerous form of a look-alike is the one that arrives alone. The
    acting party is identified by the claims inside the `act` object, `sub`
    among them (RFC 8693 §4.1); a token writing `subject` instead produces a
    domain claim byte-identical to one built from a genuine `sub`, so every
    consumer downstream — an allowlist, a scope decision, an audit record —
    reads a party the issuer never named and has nothing to tell the two
    apart. With both members present there is a visible contradiction for a
    reader to refuse; with only the look-alike there is none, which makes
    this the case a refusal must cover rather than the one it may skip.
    Aegis policy at verify, and the refusal cannot depend on the issuer
    having written the real member too: a refusal built from the members
    that arrived lets the look-alike take the declared member's slot
    uncontested.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"     |
        | sub | "user-1"                       |
        | aud | ["https://rs.lindorm.io/"]     |
        | jti | "token-1"                      |
        | act | { "subject": "rogue-service" } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the lone look-alike is refused at the slot it would have taken
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and locates the fault at "act.subject": Members "sub" and "subject" both resolve to "subject" in "act"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a token whose address names a member in the library's own domain spelling is refused, not read as that member

    An address member is spelled `street_address` on the wire
    (OpenID Connect Core 1.0 §5.1.1) and `streetAddress` in the library's
    domain vocabulary. A token writing the domain form is writing a name no
    specification defines into the slot the specification's own member
    resolves to, and the result a consumer reads is indistinguishable from a
    conformant token — so the deployment cannot tell whether the issuer
    followed the specification. The address claim carries a case-flipped
    open tail precisely because an undeclared member is a lindorm extension
    of a lindorm type; a member that is not undeclared, merely spelled in the
    wrong vocabulary, is not that. Stated on `address` as well as on the
    actor chain because they take different tail policies — a flipped tail
    and a verbatim one — and a rule that held for only one of them would be
    a rule about the tail policy rather than about the member set. Aegis
    policy at verify.

    Background:
      Given the wire claims
        | iss     | "https://test.lindorm.io/"          |
        | sub     | "user-1"                            |
        | aud     | ["https://rs.lindorm.io/"]          |
        | jti     | "token-1"                           |
        | address | { "streetAddress": "Storgatan 1" } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the domain spelling is refused rather than read as the registered member
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "address"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint refuses a structured claim whose caller wrote both spellings of one member

    The read-side hazard has a write-side twin, and it is the same defect
    from the other end: a caller who writes both the domain and the wire
    spelling of one member has told the library two things about one field,
    and an emission that picks a winner signs whichever the object's key
    order happened to put last. What reaches the wire then depends on how the
    caller's object was assembled rather than on what they meant, and the
    caller has no way to see which one was chosen — the token verifies, and
    the field is simply wrong. Refusing at the emission boundary is the last
    moment the value is still in the producer's hands. `subject` is the
    declared member and resolves to the wire `sub`; a caller-supplied `sub`
    rides the open tail verbatim and lands on the same key.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the actor claim is the object
        """json
        { "subject": "declared-actor", "sub": "shadow-actor" }
        """

    Scenario Outline: <wire>: the mint is refused at the key both spellings resolve to
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and locates the fault at "act.sub": Members "sub" and "subject" both resolve to "sub" in "act"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint refuses a structured claim naming EVERY fault it carries, not the one the walker reached first

    A structure refusal is a repair instruction, and every fault it withholds
    costs the caller another round trip to discover. Two members colliding on
    one key and two other members colliding on a different key are
    independent faults: neither creates the other, and repairing one leaves
    the other exactly as it was — so a walk that returned at the first would
    report an N-fault structure as a one-fault structure and the caller would
    rediscover the rest one mint at a time, each time with no token issued
    and no way to see how far the problem went. Reporting all of them is also
    the only form in which the entry list describes the value rather than
    the walk: a single entry says which member the walker happened to reach
    first, and that is a fact about the caller's key insertion order, not
    about the claim. `issuer`/`iss` meet on `iss` and `subject`/`sub` meet on
    `sub` — separate declared members, separate tail members, separate
    outgoing keys.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the actor claim is the object
        """json
        {
          "issuer": "https://declared-issuer.test",
          "iss": "https://shadow-issuer.test",
          "subject": "declared-actor",
          "sub": "shadow-actor"
        }
        """

    Scenario Outline: <wire>: both independent collisions are named in one refusal
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and lists the faults
        | key     | message                                                 |
        | act.iss | Members "iss" and "issuer" both resolve to "iss" in "act" |
        | act.sub | Members "sub" and "subject" both resolve to "sub" in "act" |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint refusing a fault inside a nested actor names the path to it, not the claim it sits in

    The actor claim nests itself (RFC 8693 §4.1), so a delegation chain puts
    the same member set at every depth and a bare claim name cannot say
    which actor in the chain is malformed. A caller told only that `act` is
    wrong has to search a structure whose shape gave them no place to look,
    and the deeper the chain the less the refusal says — which is the point
    at which a claim that exists to record who acted for whom stops being
    repairable. The entry key therefore carries the full path from the claim
    down to the offending member, and the message names the structure the
    two members met in rather than the claim they are nested under. The
    outer actor is well formed; the fault sits one hop back in the chain,
    and the shape is held constant so the only thing varied is the depth.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the actor claim is the object
        """json
        { "subject": "outer-actor", "act": { "subject": "declared-actor", "sub": "shadow-actor" } }
        """

    Scenario Outline: <wire>: the entry names the full path to the nested member and the structure it sits in
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and locates the fault at "act.act.sub": Members "sub" and "subject" both resolve to "sub" in "act.act"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a mint refusing a fault below a collection element names the index AND the member, not the collection

    A Subject Identifier of format `aliases` carries a list of identifiers
    (RFC 9493 §3.2.8), so a refusal that stopped at the claim would tell a
    caller only that one of an unbounded list is wrong, and one that stopped
    at the element index would not say which part of that element to look
    at. Both leave the caller searching. The entry key therefore keeps
    growing past the index: it names the collection, the position in it, and
    the member inside that position, so the refusal points at exactly the
    value that has to change however deep the structure runs. The element is
    itself an `aliases` identifier — a nesting RFC 9493 §3.2.8 forbids —
    which is why the mint runs under a profile stating no subject-identifier
    shape rule: the profile that states one refuses the nesting before any
    wire is assembled, so the walker would never be reached. What the nesting
    buys is a member below a collection element, and the fault itself is the
    ordinary one: `identifiers` is declared an array and holds a string.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the subject identifier is the object
        """json
        { "format": "aliases", "identifiers": [{ "format": "aliases", "identifiers": "not-an-array" }] }
        """

    Scenario Outline: <wire>: the entry key names the collection, the index and the member below it
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "subjectId" and locates the fault at "subjectId.identifiers[0].identifiers": Claim "subjectId" must be an array

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose collection element carries a member that is not of its declared kind is refused at its index

    A Subject Identifier of format `aliases` carries a list of identifiers
    (RFC 9493 §3.2.8), and each element declares the same member set as an
    identifier standing alone — so the rule that a member whose value
    contradicts its declared shape is refused at mint must hold inside an
    element exactly as it holds at the surface: written, it is bytes aegis's
    own reader reports as never stated; dropped, the signed token lists an
    alias identified by fewer facts than the caller stated, and the caller
    who supplied the value is the one party who cannot notice. The write
    door is aegis's own caller, so the member is refused wherever it sits,
    and the entry's key names the collection, the position in it, and the
    member inside that position. The element's `format` conforms; `issuer`
    is the fault, and the conforming member beside it is not named.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the subject identifier is the object
        """json
        { "format": "aliases", "identifiers": [{ "format": "iss_sub", "issuer": 42 }] }
        """

    Scenario Outline: <wire>: the mint is refused at the element's index, naming the member that is not of its kind
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "subjectId" and locates the fault at "subjectId.identifiers[0].issuer": Member "issuer" must be the shape it declares

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a verify refuses a CWT whose member map carries one member at both its integer label and its text name

    A COSE map has two kinds of key (RFC 9052 §1.5), and CBOR keys them
    apart, so a member's integer label and its interoperable text name are
    two distinct map entries. They are also two renderings of one declared
    member, so a map carrying both says two things about one field and a
    decoder that merges them lets the last entry win. For an identity member
    that hands the identification to whoever wrote the map: an actor the
    issuer named `2 => "audited-service"` is re-read as a different party by
    appending one entry, and every allowlist and audit record downstream then
    names the wrong one. There is no safe winner to pick, so the map is
    refused, naming the label and the name that resolved together — aegis
    policy at verify; the specification defines the two kinds of label and
    says nothing of a map carrying both for one member. The door is the
    verifying one because that is what the rule has to survive: the token is
    written by a third party over a real key, so it passes every check
    before the claims layer, and the refusal has to come from the decoder.
    The jose wire has no scenario: a JOSE member has one spelling and no
    second key for the same member to arrive under.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"
      And the wire claim "act" is the map
        | key | keyed by | value             |
        | 2   | label    | "audited-service" |
        | sub | name     | "rogue-service"   |

    Scenario: cose: the map is refused, naming the label and the name that met on one member
      When a third party signs the wire claims on the cose wire, typed "application/cwt"
      And I verify the token
      Then verification is refused as a COSE error
      And the refusal names the member "sub" of the claim "act", keyed at both label 2 and name "sub"

  Rule: a verify refuses an address whose undeclared member flips onto a member the address already states

    The collision rule is a property of an open member set, not of any one
    claim: an undeclared member takes the house case flip, so `streetAddress`
    becomes `street_address` and lands on the member
    OpenID Connect Core 1.0 §5.1.1 already spells that way. An address is not
    an identity assertion, so the stakes are lower than the actor's — which
    is exactly why it is worth stating separately: a rule that defended only
    the claim somebody happened to be looking at would be a patch, and the
    next open structure to arrive would inherit the defect rather than the
    defence. Aegis policy at verify.

    Background:
      Given the wire claims
        | iss     | "https://test.lindorm.io/"                                              |
        | sub     | "user-1"                                                                |
        | aud     | ["https://rs.lindorm.io/"]                                              |
        | jti     | "token-1"                                                               |
        | address | { "street_address": "Storgatan 1", "streetAddress": "Shadow Street 9" } |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the flipped tail member is refused at the member it lands on
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "address" and locates the fault at "address.streetAddress": Members "streetAddress" and "street_address" both resolve to "streetAddress" in "address"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an actor member aegis does not declare rides the compact COSE encoding as well as the interoperable one

    The compact encoding is a size decision, and a size decision must not
    also be a content decision. A label map holds only the members the
    library has labels for, so an implementation that builds one from its
    label table alone drops everything else — the same domain call then
    produces two tokens that say different things, and the one that says
    less is the one a deployment turns on for efficiency. Nothing in the
    token records the loss, and the interoperable token that would have
    revealed it is the one nobody is minting. A COSE map admits both integer
    and text labels (RFC 9052 §1.5), so a member with no assigned label rides
    under its own name in the same map as the labelled ones — aegis's
    encoding, resting on that permission. The raw map is compared as a map,
    so an integer label cannot pass for its own text spelling. The jose wire
    has no scenario: the compact label map is a COSE encoding, and a JSON
    object has one kind of key (RFC 8259 §4), so a JOSE member has one
    spelling and no second encoding to be dropped from.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the actor claim is the object
        """json
        { "subject": "service-1", "email": "service-1@example.test" }
        """
      And the mint is asked for the compact COSE encoding

    Scenario: cose: the compact map keys the declared member at its label and the undeclared one under its own name
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries "act" as the map
        | key   | keyed by | value                    |
        | 2     | label    | "service-1"              |
        | email | name     | "service-1@example.test" |

    Scenario: cose: the member is read back through the compact encoding
      When I mint the content under the "access_token" profile on the cose wire
      And I verify the token under the "access_token" profile as the audience "https://rs.lindorm.io/"
      Then the verified token is a "cwt"
      And the verified actor claim is exactly the object
        """json
        { "subject": "service-1", "email": "service-1@example.test" }
        """

  Rule: an actor object carrying no member the token states is reported back as an empty actor, not as no actor

    An issuer and a reader of the same token must agree about what it says.
    `act` is the claim that says a delegation occurred (RFC 8693 §4.1), so an
    actor object with no members is a strange thing to write, but it is a
    thing a foreign issuer can write, and once written the honest read of it
    is the object that is there — aegis's read policy. Reporting the claim
    as absent instead would say the token names no actor when it names an
    empty one, which is a different statement and one the wire does not
    support. The consequence a consumer must know is that the reported object
    is truthy: a delegation is stated and the acting party is not
    identified, so a check that cares who is acting has to read a member
    rather than the container. The token is a third party's: every aegis
    signing door refuses an empty actor on the way out, so this shape can
    only be presented by somebody else's producer.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | act | {}                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the empty actor is reported as the object that is there
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified token is a "<format>"
      And the verified actor claim is exactly the object
        """json
        {}
        """

      Examples:
        | wire | typ             | format |
        | jose | JWT             | jwt    |
        | cose | application/cwt | cwt    |

  Rule: a token naming an authorized actor carries it on the wire and reports it back under its own name

    `may_act` is the claim a delegation authorisation is written into
    (RFC 8693 §4.4). It is therefore a claim whose whole value is that a
    different party can read it later: a token that carried it under a
    spelling the exchange endpoint does not look for, or that lost it on the
    way back in, silently turns every delegation the issuer authorised into
    one that cannot be exercised. The claim is the mirror of `act` — one
    records a delegation that happened, the other permits one that has not —
    so it is stated separately rather than assumed to follow from its twin.
    The member spellings are RFC 8693's on both encodings; the claim key is a
    separate question, and the interoperable default answers it with the
    string name and not a private-use integer label — integer values below
    -65536 are Private Use in the registry a CWT claim key comes from
    (RFC 8392 §9.1.1), so an interoperable token must not carry one. The
    cose scenario carries no tag: the rule is the JWT specification's, a CWT
    is not a JWT, and `may_act` has no registered CWT claim key; where the
    interoperable claim key lands is aegis's encoding, resting on the
    registry's private-use range. The read back is aegis's own surface.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the authorized actor claim is the object
        """json
        { "subject": "delegate-1", "clientId": "delegate-client-1" }
        """

    @RFC-8693
    Scenario: jose: the authorized actor travels under its registered JWT claim name, its members spelled as claims (RFC-8693 §4.4)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "may_act" as the object
        """json
        { "sub": "delegate-1", "client_id": "delegate-client-1" }
        """

    Scenario: cose: the authorized actor travels under its text name with its members spelled as on the JWT wire, and under no private-use claim key
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries "may_act" as the object
        """json
        { "sub": "delegate-1", "client_id": "delegate-client-1" }
        """
      And the raw payload carries no claim key -65543

    Scenario Outline: <wire>: the authorized actor is read back under its domain name
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified authorized actor claim is exactly the object
        """json
        { "subject": "delegate-1", "clientId": "delegate-client-1" }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |
