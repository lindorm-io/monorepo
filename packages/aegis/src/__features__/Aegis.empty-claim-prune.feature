Feature: The empty-claim prune

  Whether an empty value is a statement or noise is a fact about the claim,
  and aegis records it per claim in its registry: an empty `scope` is a grant
  of nothing and is kept, an empty `amr` asserts something no issuer means
  and is dropped, an empty `cnf` can be neither emitted nor dropped and is
  refused. The registry decides, never the caller, at the one emission
  boundary every signing door runs. `null` is a different question: it is
  absence, never a value, and is stripped from every claim before the
  registry is consulted, on every door and on both wires. Every rule here is
  aegis policy at the mint and carries no tag, except where a scenario
  asserts a wire spelling the row's rationale cites.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: an empty claim whose emptiness is itself a statement is emitted

    An empty claim and an absent one are different statements, and for some
    claims the empty one is the one that restricts. `scope` is only a SHOULD
    on an access token (RFC 9068 §2.2.3), so a recipient cannot tell an
    absent scope from a grant that never carried one; the explicit empty
    value is the only way an issuer can state that this grant conveys
    nothing, and deleting it would erase that statement. A raw door writes
    the caller's own value as given, and aegis keys `scope` at claim key 9,
    so the two wires spell the surviving claim differently.

    Background:
      Given the wire claims
        | iss   | "https://test.lindorm.io/" |
        | sub   | "user-1"                   |
        | aud   | ["https://rs.lindorm.io/"] |
        | jti   | "token-1"                  |
        | scope | []                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario: jose: the empty scope reaches the wire as the empty list under its own name
      When I sign the wire claims as a claims token on the jose wire
      Then the raw payload carries "scope" as the empty list

    Scenario: cose: the empty scope reaches the wire as the empty list under claim key 9
      When I sign the wire claims as a claims token on the cose wire
      Then the raw payload carries claim key 9 as the empty list

  Rule: an explicitly empty scope reaches the wire as the empty string and is read back as the empty list

    The wire form of `scope` is one space-separated string (RFC 8693 §4.2),
    so on the wire the empty grant is spelled as the empty string — and it
    must survive to the wire, because `scope` is only a SHOULD on an access
    token (RFC 9068 §2.2.3) and the explicit empty value is the one way an
    issuer can tell a grant of nothing apart from silence. The string form is
    the JWT document's, so the jose scenario carries the tag; the cose twin
    does not, since no document this row cites gives the CWT claim its form.
    Reading it back as the empty list is aegis's read surface.

    Background:
      Given the content to mint
        | subject  | user-1   |
        | clientId | client-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And an empty scope list

    @RFC-8693
    Scenario: jose: the empty grant is spelled as the empty string, the claim's one string form (RFC-8693 §4.2)
      When I mint the content under the "access_token" profile on the jose wire
      Then the raw payload carries "scope" ""

    Scenario: cose: the empty grant is spelled as the empty string under claim key 9
      When I mint the content under the "access_token" profile on the cose wire
      Then the raw payload carries claim key 9 ""

    Scenario Outline: <wire>: the verify reads the empty string back as the empty list
      When I mint the content under the "access_token" profile on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified claims list an empty scope

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: an explicitly empty audience reaches the wire as the empty list on both wires

    `aud: []` names nobody where an absent `aud` restricts nothing
    (RFC 7519 §4.1.3), so the empty list is the narrowest statement an issuer
    can make and pruning it would issue the widest. A kept claim is kept
    verbatim: unlike `scope`, `aud` has no scalar collapse, so the container
    itself survives the domain door. Both encodings carry an empty array
    natively, and RFC 8392 §3.1.3 keys `aud` at claim key 3. Keeping the
    empty value is aegis policy at the mint.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And an empty audience list

    Scenario: jose: the empty audience reaches the wire as the empty list under its own name
      When I mint the content under the "default" profile on the jose wire
      Then the raw payload carries "aud" as the empty list

    Scenario: cose: the empty audience reaches the wire as the empty list under claim key 3
      When I mint the content under the "default" profile on the cose wire
      Then the raw payload carries claim key 3 as the empty list

  Rule: an empty claim that asserts nothing anyone can act on is not emitted

    The mirror case, and it fails open the other way. `amr: []` reads as "the
    authentication methods are known and none applied" — a statement no
    issuer means and no audience can act on — so emitting it puts an
    assertion on the wire that nobody wrote. It reaches the boundary because
    a claim bag assembled from optional values ends up with empty containers
    in it. Which of the two an empty value is cannot be decided per call,
    only per claim, and the registry's cell for this claim says prune.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | amr | []                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the empty authentication-methods list is left off the wire
      When I sign the wire claims as a claims token on the <wire> wire
      Then the raw payload carries no "amr"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an empty claim that states something no recipient can act on is refused at the door with no profile above it

    The third answer, and the one a profile cannot give. `cnf: {}` declares
    that the presenter holds a particular key and that the recipient can
    confirm it (RFC 7800 §3), and it names no key — so emitting it mints a
    binding nothing satisfies and dropping it mints the bearer token the
    caller did not ask for. The raw signing doors are where this has to
    hold: they run no profile, so the emission boundary is the only layer
    that can speak, and a refusal on one wire alone would be a verdict the
    caller picks by encoding. The error is the same class and vocabulary the
    profile floor uses for the same value, naming the claim by its domain
    name and never by the wire key the door was handed.

    Background:
      Given the opaque payload is the object
        """json
        { "cnf": {}, "scope": [] }
        """

    Scenario Outline: <wire>: the opaque signature is refused under the empty-value ruling, naming the claim by its domain name
      When I sign the payload as opaque content on the <wire> wire
      Then signing is refused as a domain error "claim_empty_value"
      And the refusal names the claim "confirmation" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an actor claim carrying no member is refused at the mint rather than written or dropped

    `act` says a delegation occurred and names the party acting
    (RFC 8693 §4.1), so a verifier reading one holds the actor to its own
    policy. An actor object with no member gives that policy nobody to hold:
    written, it states a delegation by nobody; dropped, it hands the audience
    a token that reads as the subject acting directly when the issuer said
    otherwise. Aegis policy at mint refuses it while it is still in the
    producer's hands, on both wires.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the actor claim is the object
        """json
        {}
        """

    Scenario Outline: <wire>: the mint is refused under the empty-value ruling, naming the actor claim
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_empty_value"
      And the refusal names the claim "act" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an authorized-actor claim carrying no member is refused at the mint rather than written or dropped

    `may_act` is the claim a delegation authorisation is written into
    (RFC 8693 §4.4): a token endpoint reading one lets the party it names
    become the actor. An object with no member names no party to admit, so
    writing it puts an authorisation on the wire that nothing can exercise
    and dropping it turns a stated authorisation into silence. Aegis policy
    at mint refuses it on both wires, as it refuses the empty `act`.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the authorized actor claim is the object
        """json
        {}
        """

    Scenario Outline: <wire>: the mint is refused under the empty-value ruling, naming the authorized-actor claim
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_empty_value"
      And the refusal names the claim "mayAct" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an events claim naming no event type is refused at the mint rather than written or dropped

    `events` is the claim that makes a token a Security Event Token, and its
    members are the event-type URIs a recipient dispatches on
    (RFC 8417 §2.2). A map naming no event type gives the recipient nothing
    to dispatch, so writing it mints a SET announcing no event and dropping
    it turns the token into something the recipient reads as a different
    kind of token. Aegis policy at mint refuses it on both wires. A member's
    payload is a different question, stated by its own rule below.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the events claim is the object
        """json
        {}
        """

    Scenario Outline: <wire>: the mint is refused under the empty-value ruling, naming the events claim
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_empty_value"
      And the refusal names the claim "events" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an access token hash supplied as the empty string is refused at the mint rather than written or dropped

    `at_hash` binds an ID Token to the access token issued beside it
    (OpenID Connect Core 1.0 §3.1.3.6): a client reading one compares it
    against the access token it holds. An empty digest is a binding no
    access token can ever match, so writing it mints an ID Token that fails
    beside every access token, and dropping it hands the client an unbound
    ID Token where the issuer stated a binding. Aegis policy at mint refuses
    it on both wires. The value crosses the mint as the caller's own digest.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the mint stamps the access token hash ""

    Scenario Outline: <wire>: the mint is refused under the empty-value ruling, naming the hash claim
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_empty_value"
      And the refusal names the claim "accessTokenHash" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an authorization code hash supplied as the empty string is refused at the mint rather than written or dropped

    `c_hash` binds an ID Token to the authorization code issued beside it
    (OpenID Connect Core 1.0 §3.3.2.11). An empty digest is a binding no
    code can ever match, so writing it mints an ID Token that fails beside
    every code, and dropping it hands the client an unbound ID Token where
    the issuer stated a binding. Aegis policy at mint refuses it on both
    wires, for the same reason it refuses the empty `at_hash`.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the mint stamps the code hash ""

    Scenario Outline: <wire>: the mint is refused under the empty-value ruling, naming the hash claim
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_empty_value"
      And the refusal names the claim "codeHash" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a state hash supplied as the empty string is refused at the mint rather than written or dropped

    `s_hash` binds an ID Token to the `state` value of the authorization
    request it answers (Financial-grade API Security Profile 1.0 Part 2
    §5.1.1). An empty digest is a binding no `state` can ever match, so
    writing it mints an ID Token that fails beside every request, and
    dropping it hands the client an unbound ID Token where the issuer stated
    a binding. Aegis policy at mint refuses it on both wires — one binding
    argument, three artifacts.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the mint stamps the state hash ""

    Scenario Outline: <wire>: the mint is refused under the empty-value ruling, naming the hash claim
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_empty_value"
      And the refusal names the claim "stateHash" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a subject identifier carrying no member is refused at the raw door rather than written or dropped

    `sub_id` identifies who a token is about (RFC 9493 §4.1): a recipient
    reading one acts on the subject it names. An identifier with no member
    names nobody, so writing it mints a token about no one and dropping it
    turns a token the issuer stated a subject for into one that states none.
    Aegis policy refuses it. The domain doors never reach this verdict for
    the empty object, because a Subject Identifier's `format` is a mandatory
    member and the structure rule refuses the shape first; the raw doors run
    no structure walk, so the emission boundary is the only layer that can
    speak there, and it must speak on both wires.

    Background:
      Given the wire claims
        | iss    | "https://test.lindorm.io/" |
        | sub    | "user-1"                   |
        | sub_id | {}                         |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the claims signature is refused under the empty-value ruling, naming the identifier by its domain name
      When I sign the wire claims as a claims token on the <wire> wire
      Then signing is refused as a domain error "claim_empty_value"
      And the refusal names the claim "subjectId" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an access token hash supplied as the empty string is refused at the door with no profile above it

    `at_hash` binds an ID Token to the access token issued beside it
    (OpenID Connect Core 1.0 §3.1.3.6), and an empty digest is a binding no
    access token can ever match. The raw signing doors are where the refusal
    has to hold on its own: they run no profile and no translation, so the
    emission boundary is the only layer that can speak, and it speaks the
    same class and vocabulary the profile floor uses for the same value.
    Aegis policy at mint, on both wires: the empty string is the one empty
    form a text-valued claim can take.

    Background:
      Given the opaque payload is the object
        """json
        { "at_hash": "" }
        """

    Scenario Outline: <wire>: the opaque signature is refused under the empty-value ruling, naming the hash claim by its domain name
      When I sign the payload as opaque content on the <wire> wire
      Then signing is refused as a domain error "claim_empty_value"
      And the refusal names the claim "accessTokenHash" under the empty-value ruling "refuse"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a logout token whose events map names no event type is refused by the profile floor, with the floor's own code and every failure named

    A logout token's `events` is required and names the back-channel-logout
    event (OpenID Connect Back-Channel Logout 1.0 §2.4), so a map naming no
    event type fails the profile twice over: the demand for the claim, which
    an empty value does not satisfy, and the shape the claim must have
    (RFC 8417 §2.2). The profile floor runs before the emission boundary at
    every domain door, so under a profile that names the claim it is the
    floor that answers — with its own code and the whole list of what the
    token failed, not the first failure alone. Which layer answers is aegis
    policy at mint; the class and the domain vocabulary do not change with
    the profile.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the events claim is the object
        """json
        {}
        """

    Scenario Outline: <wire>: the mint is refused by the floor, listing the missing claim and the shape it failed
      When I mint the content under the "logout_token" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and lists the faults
        | key    | message                                      |
        | events | Required claim "events" is missing           |
        | events | events must contain at least one event type  |

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an explicitly empty authorization details list reaches the wire as the empty list on both wires

    `authorization_details` is the claim a JWT access token carries its rich
    authorization in (RFC 9396 §9.1), and each element it lists is a grant of
    the actions and locations that element names (RFC 9396 §2). An empty
    list therefore authorises nothing, where a token carrying no such claim
    is not restricted by authorization details at all — so the empty list is
    the narrower statement, and pruning it would issue the wider one. Aegis
    policy at mint keeps it verbatim on both wires, under the claim's own
    name on each.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And an empty authorization details list

    Scenario Outline: <wire>: the empty list reaches the wire under the claim's own name
      When I mint the content under the "default" profile on the <wire> wire
      Then the raw payload carries "authorization_details" as the empty list

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claim aegis has not declared reaches the wire with its empty value intact

    Whether an empty value is a statement or noise is a fact about the claim,
    and a library holds that fact only for the claims it has defined. For
    anything else — a deployment's own claim, a wire dict handed straight to
    a kit — it is guessing, and both guesses are wrong in a way the wire
    cannot show: dropping strips a restriction, keeping fabricates an
    assertion. So the prune stops at the edge of what aegis has declared,
    and a caller pruning its own claims stays the caller's job.

    Background:
      Given the wire claims
        | iss        | "https://test.lindorm.io/" |
        | sub        | "user-1"                   |
        | aud        | ["https://rs.lindorm.io/"] |
        | jti        | "token-1"                  |
        | empty_list | []                         |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the undeclared claim's empty list is written as given
      When I sign the wire claims as a claims token on the <wire> wire
      Then the raw payload carries "empty_list" as the empty list

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a security event whose payload is the conventional empty object is kept on the wire

    The `events` claim's members are URIs identifying event statements, and
    a member value may be the empty object (RFC 8417 §2.2). OpenID Connect
    Back-Channel Logout 1.0 §2.4 makes that the normal case: the logout
    token carries the member `http://schemas.openid.net/event/backchannel-logout`,
    and the member's presence is the whole statement. A prune that removed
    empty containers indiscriminately would delete the event itself. The
    empty-object form is the SET document's, and a SET is a JWT, so the jose
    scenario carries the tag; the cose twin does not — the CWT carries
    `events` under its text name, which no document this row cites gives a
    meaning.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the events claim is the object
        """json
        { "http://schemas.openid.net/event/backchannel-logout": {} }
        """

    @RFC-8417
    Scenario: jose: the event reaches the wire with its empty payload, which is a valid event statement (RFC-8417 §2.2)
      When I mint the content under the "logout_token" profile on the jose wire
      Then the raw payload carries "events" as the object
        """json
        { "http://schemas.openid.net/event/backchannel-logout": {} }
        """

    Scenario: cose: the event reaches the wire with its empty payload
      When I mint the content under the "logout_token" profile on the cose wire
      Then the raw payload carries "events" as the object
        """json
        { "http://schemas.openid.net/event/backchannel-logout": {} }
        """

  Rule: a security event's type URI is carried onto the wire without conversion

    The `events` claim's members are named by URI (RFC 8417 §2.2). A URI is
    an identifier, not a field name, and a receiver dispatches on it
    character for character — so the house convention that flips a claim's
    key case on the way out would not translate an event type but rename
    it, and the token would announce an event nobody is listening for. The
    URI form is the SET document's, so the jose scenario carries the tag and
    the cose twin does not, for the reason the rule above gives.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the events claim is the object
        """json
        { "https://schemas.lindorm.test/event/accountRecovery": {} }
        """

    @RFC-8417
    Scenario: jose: the event type reaches the wire as the URI it is, character for character (RFC-8417 §2.2)
      When I mint the content under the "logout_token" profile on the jose wire
      Then the raw payload carries "events" as the object
        """json
        { "https://schemas.lindorm.test/event/accountRecovery": {} }
        """

    Scenario: cose: the event type reaches the wire as the URI it is, character for character
      When I mint the content under the "logout_token" profile on the cose wire
      Then the raw payload carries "events" as the object
        """json
        { "https://schemas.lindorm.test/event/accountRecovery": {} }
        """

  Rule: a confirmation supplied as null through the domain door states no binding, and the token is minted without one

    `null` and `undefined` are absence, never a value: the emission boundary
    every signing door runs strips both from every claim before the registry
    is consulted, so a null confirmation is a confirmation the caller did
    not state. By including a `cnf` claim the issuer declares that the
    presenter holds a particular key (RFC 7800 §3); a caller who states none
    has declared nothing, and the token is the bearer token a `cnf`-less
    mint always is. Aegis policy at mint, and the opposite of the empty
    confirmation, which is a stated declaration naming no key and is
    refused. RFC 8747 §7.1.1 keys `cnf` at claim key 8.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the confirmation claim is stated as null

    Scenario: jose: the token is minted as a bearer token, carrying no confirmation
      When I mint the content under the "default" profile on the jose wire
      Then the raw payload carries no "cnf"

    Scenario: cose: the token is minted as a bearer token, carrying no confirmation
      When I mint the content under the "default" profile on the cose wire
      Then the raw payload carries no claim key 8

  Rule: a confirmation supplied as null through a raw door states no binding, and the token is signed without one

    The raw doors run no profile and no translation: the caller's own
    wire-named bag reaches the emission boundary as written. The answer is
    the same as at the domain door because it is the same boundary: `null`
    is absence and is stripped from every claim before the registry is
    consulted, on both wires. A verdict that differed by door would let a
    caller pick between a bound token and a bearer one by choosing which
    door to knock on.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | ["https://rs.lindorm.io/"] |
        | jti | "token-1"                  |
        | cnf | null                       |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario: jose: the token is signed as a bearer token, carrying no confirmation
      When I sign the wire claims as a claims token on the jose wire
      Then the raw payload carries no "cnf"

    Scenario: cose: the token is signed as a bearer token, carrying no confirmation
      When I sign the wire claims as a claims token on the cose wire
      Then the raw payload carries no claim key 8

  Rule: an events claim supplied as null states no event and is left off the wire, where the empty map is refused

    A null `events` is an events claim the caller did not state, and the
    token is minted without one, on both wires — the opposite of the empty
    map, which is a stated claim naming no event type (RFC 8417 §2.2) and is
    refused. The two spellings have to part here, because they are the two
    things a caller assembling a token from optional sources actually hands
    in. Aegis keys `events` at a private-use label on-platform and under its
    name off-platform; a null reaches neither spelling.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the events claim is stated as null

    Scenario: jose: the token is minted without an events claim
      When I mint the content under the "default" profile on the jose wire
      Then the raw payload carries no "events"

    Scenario: cose: the token is minted without an events claim under either spelling
      When I mint the content under the "default" profile on the cose wire
      Then the raw payload carries none of claim key -65550, "events"

  Rule: a claim supplied as null is absent from the wire on both wires, whatever the registry says of its empty value

    The registry's emptiness cell judges the empty values a wire can spell —
    `""`, `[]`, `{}` — and is never asked about a null, which is absence.
    `aud` is a cell that keeps its empty value, because `aud: []` names
    nobody where an absent `aud` restricts nothing (RFC 7519 §4.1.3), so it
    is the claim on which an absence and an empty value are most visibly two
    different things: the empty list reaches the wire, and the null reaches
    it not at all. Aegis policy at mint; RFC 8392 §3.1.3 keys `aud` at claim
    key 3.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the audience claim is stated as null

    Scenario: jose: the token is minted without an audience claim
      When I mint the content under the "default" profile on the jose wire
      Then the raw payload carries no "aud"

    Scenario: cose: the token is minted without an audience claim
      When I mint the content under the "default" profile on the cose wire
      Then the raw payload carries no claim key 3

  Rule: a registered claim supplied as null through a raw door is absent from the wire on both wires

    A raw door runs no translation: the caller's own wire-named bag reaches
    the emission boundary as written. `aud` is a cell that keeps its empty
    value (RFC 7519 §4.1.3), and a keep cell judges an empty value; `null` is
    absence, never a value, so it never reaches the cell and the claim is
    simply not stated. A caller cannot spell absence onto a signed token by
    choosing the door with no translator in front of it. Aegis policy at the
    raw door.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | null                       |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario: jose: the token is signed without an audience claim
      When I sign the wire claims as a claims token on the jose wire
      Then the raw payload carries no "aud"

    Scenario: cose: the token is signed without an audience claim
      When I sign the wire claims as a claims token on the cose wire
      Then the raw payload carries no claim key 3

  Rule: a foreign token whose aud is the wire null is read as naming no audience, and fails a verify that asserts one

    No aegis door writes a wire null at a claim key, so an `aud` of null can
    only arrive on a token somebody else produced, and the read side is what
    answers for it. A verifier asserting an audience asks whether the token
    names it. A wire-null `aud` names nothing: reading the null as a
    wildcard would let a producer's empty optional widen a token to every
    audience, so the only safe answer is the refusal the floor gives a token
    that omits `aud`. Aegis policy at verify: the claim is optional and the
    specification scopes its mandated rejection to a token that carries it
    (RFC 7519 §4.1.3). The first scenario reads the null off the wire, so
    the second judges the read. The jose wire alone, matching the table's
    cells; the third-party producer here can write a CBOR null under claim
    key 3 too, and aegis refuses that leg the same way.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/" |
        | sub | "user-1"                   |
        | aud | null                       |
        | jti | "token-1"                  |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario: jose: the null reaches the wire, so it is the read that is judged
      When a third party signs the wire claims on the jose wire
      Then the raw payload carries "aud" as null

    Scenario: jose: the verify asserting an audience is refused, as it is for a token that omits the claim
      When a third party signs the wire claims on the jose wire
      And I verify the token under the "default" profile as the audience "https://rs.lindorm.io/"
      Then verification is refused as a domain error "audience_mismatch"

  Rule: a claim whose empty value asserts nothing is not emitted when supplied as null

    A nullable source column is the ordinary shape of an optional fact, so a
    caller minting from one hands the null straight in rather than running a
    stripping pass first. `null` is absence, never a value: the emission
    boundary strips it from every claim before the registry is consulted, so
    the claim is simply not stated and its emptiness cell is never asked —
    which is what makes the answer to a null the same for every claim,
    whatever the cell says. `email` has a private-use COSE label, so the
    interoperable encoding keys it by its name on both wires.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the content's claims container is the object
        """json
        { "email": null }
        """

    Scenario Outline: <wire>: the null claim is absent from the wire
      When I mint the content under the "default" profile on the <wire> wire
      Then the raw payload carries no "email"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an unregistered claim supplied as null through the domain door is not emitted

    An unregistered claim has no registry cell, and it needs none: `null` is
    absence, and the emission boundary strips it from every claim before the
    registry is consulted — registered or not. Writing the null would put a
    member on a signed wire that asserts nothing and whose spelling the
    caller never chose. `clearance` is its own snake_case, so the exclusion
    names the key the domain door would have written it under.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the content's claims container is the object
        """json
        { "clearance": null }
        """

    Scenario Outline: <wire>: the null claim is absent from the wire
      When I mint the content under the "default" profile on the <wire> wire
      Then the raw payload carries no "clearance"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: an unregistered claim supplied as null through a kit door is not emitted

    A kit door takes an already-wire claims dict and neither renames nor
    reshapes what aegis has not declared — but `null` is not a shape, it is
    absence, and the emission boundary strips it from every claim before the
    registry is consulted, at this door as at every other. The domain door
    gives the same answer for the same key, so a null custom claim is absent
    at every door, on both wires.

    Background:
      Given the wire claims
        | iss       | "https://test.lindorm.io/" |
        | sub       | "user-1"                   |
        | jti       | "token-1"                  |
        | clearance | null                       |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the null claim is absent from the wire
      When I sign the wire claims as a claims token on the <wire> wire
      Then the raw payload carries no "clearance"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claim supplied as null through the profile-less domain door is absent from the wire on both wires, whatever the registry says of its empty value

    The profile-less domain verb applies no floor, so nothing but the
    caller's own bag decides what the token states — and `null` is absence.
    `aud` keeps its empty value because `aud: []` names nobody
    (RFC 7519 §4.1.3), and `cnf` refuses its empty value because a stated
    confirmation naming no key can be neither honoured nor dropped
    (RFC 7800 §3). Both are absent here for one reason: nothing was stated.
    The subject alone reaches the wire, under `sub` on JOSE and claim key 2
    on COSE (RFC 7519 §4.1.2, RFC 8392 §3.1.2). Aegis policy at the domain
    door.

    Background:
      Given the claims to sign
        | subject | user-1 |
      And the audience claim is stated as null
      And the confirmation claim is stated as null

    Scenario: jose: the subject alone reaches the wire, and neither null does
      When I sign the claims without a profile on the jose wire
      Then the raw payload carries "sub" "user-1"
      And the raw payload carries none of "aud", "cnf"

    Scenario: cose: the subject alone reaches the wire, and neither null does
      When I sign the claims without a profile on the cose wire
      Then the raw payload carries claim key 2 "user-1"
      And the raw payload carries none of claim key 3, claim key 8
