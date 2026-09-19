Feature: The confidentiality gate at the verify door

  What a verify reports, and in which bucket. A sensitive claim surfaces only
  from a token that arrived sealed; the standard profile claims
  (OpenID Connect Core 1.0 §5.1) land in a bucket of their own; a structured
  claim is read member by member, so a member that contradicts its declared
  shape is refused at aegis's own mint and declined — never spread — at the
  specification-faithful read; and a null is an absence at every depth. The
  buckets have no wire representation, so every rule here is aegis's read
  surface and carries no tag unless a wire spelling the row cites is what
  the scenario asserts. A cose twin of such a scenario carries none: the
  document defines the JWT claim, and a CWT carries the name only because
  aegis keys it by its interoperable text form.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a sensitive claim carried in a sealed token is delivered to the audience in its own bucket

    Sealing a sensitive claim is only worth doing if the intended audience
    still receives it — confidentiality that also withholds the value from
    the party it was issued for is indistinguishable from omitting it. A
    bucket of its own lets a consumer apply its own handling rules without
    re-deriving which of the claims it received were the sensitive ones. The
    wrapper is the premise: it says the token arrived sealed.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the sensitive claims are the object
        """json
        { "nationalIdentityNumber": "19900101-1234" }
        """
      And no access token is co-issued

    Scenario Outline: <wire>: the token arrives sealed and the sensitive claim is reported in the sensitive bucket
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "<format>"
      And the verified token reports the wrapper "<wrapper>"
      And the verified sensitive bucket is exactly the object
        """json
        { "nationalIdentityNumber": "19900101-1234" }
        """

      Examples:
        | wire | format | wrapper |
        | jose | jwt    | jwe     |
        | cose | cwt    | cwe     |

  Rule: a sensitive claim sitting in cleartext is not surfaced by a verified token either

    A sensitive value that arrived unencrypted was already disclosed to every
    intermediary that handled the token; surfacing it now spreads the
    disclosure into the consumer's own logs with the authority of a verified
    result. The gate keys off how the token was carried rather than off the
    claim's category alone, because a valid signature says nothing about who
    could read the payload on the way. The value must reach no bucket: not
    the sensitive one, not the claims, not the custom remainder.

    Background:
      Given the wire claims
        | iss                      | "https://test.lindorm.io/" |
        | sub                      | "user-1"                   |
        | aud                      | ["https://rs.lindorm.io/"] |
        | jti                      | "token-1"                  |
        | national_identity_number | "19900101-1234"            |
      And the wire claims were issued at "2024-01-01T08:00:00.000Z"
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the token verifies and the value reaches no bucket of the result
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified token carries no sensitive bucket
      And the verified claims carry no "nationalIdentityNumber"
      And the verified custom bucket carries no "nationalIdentityNumber"

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a profile claim supplied to a mint is written to the wire and read back into its own bucket

    The standard claims are the ones an audience reads to learn about the
    end-user (OpenID Connect Core 1.0 §5.1), and the read side categorises
    them into a bucket of their own. Write and read are separate code on each
    encoding, so a bucket one side fills and the other does not loses the
    claims silently. Both halves are stated: the wire spelling is the write
    half, read by the independent inspector, and the bucket is the read half.
    The names are the JWT document's, so the jose wire scenario carries the
    tag and the cose twin does not; the bucket is aegis's own.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the profile claims are the object
        """json
        { "givenName": "Ada", "email": "ada@example.com" }
        """
      And no access token is co-issued

    @openid-connect-core-1_0
    Scenario: jose: the claims reach the wire under their standard names (OpenID Connect Core 1.0 §5.1)
      When I mint the content under the "id_token" profile on the jose wire
      Then the raw payload carries "given_name" "Ada"
      And the raw payload carries "email" "ada@example.com"

    Scenario: cose: the claims reach the wire under their standard names
      When I mint the content under the "id_token" profile on the cose wire
      Then the raw payload carries "given_name" "Ada"
      And the raw payload carries "email" "ada@example.com"

    Scenario Outline: <wire>: the verify reads the claims back into the profile bucket
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "<format>"
      And the verified profile bucket is exactly the object
        """json
        { "givenName": "Ada", "email": "ada@example.com" }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: an address is published under the member names its specification defines

    The address claim is defined entirely by its sub-fields, and their
    spellings are the interoperability contract (OpenID Connect Core 1.0
    §5.1.1): a relying party reads `street_address` and knows nothing of any
    other name for it. The domain form is camelCase like every other claim,
    so a case conversion sits between the caller and the wire, and a token
    whose members are misspelled round-trips through its own issuer perfectly
    and means nothing to anybody else. The defined members carry the tag on
    the jose wire; `care_of` is a lindorm extension and its spelling is
    aegis's, so that scenario carries none; the read half is aegis's bucket.
    On the cose wire the claim rides its interoperable text key with
    text-keyed members inside, so the inspector reads the same object.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the profile claims are the object
        """json
        {
          "address": {
            "streetAddress": "Sample 1",
            "postalCode": "00100",
            "country": "SE",
            "careOf": "Sample Recipient"
          }
        }
        """
      And no access token is co-issued

    @openid-connect-core-1_0
    Scenario: jose: the address members reach the wire under their defined names (OpenID Connect Core 1.0 §5.1.1)
      When I mint the content under the "id_token" profile on the jose wire
      Then the raw payload carries "address" as an object including
        """json
        { "street_address": "Sample 1", "postal_code": "00100", "country": "SE" }
        """

    Scenario: cose: the address members reach the wire under their defined names
      When I mint the content under the "id_token" profile on the cose wire
      Then the raw payload carries "address" as an object including
        """json
        { "street_address": "Sample 1", "postal_code": "00100", "country": "SE" }
        """

    Scenario Outline: <wire>: the extension member rides beside them under its own snake_case name
      When I mint the content under the "id_token" profile on the <wire> wire
      Then the raw payload carries "address" as an object including
        """json
        { "care_of": "Sample Recipient" }
        """

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the verify reads the address back into the profile bucket, member for member
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "<format>"
      And the verified profile bucket is exactly the object
        """json
        {
          "address": {
            "streetAddress": "Sample 1",
            "postalCode": "00100",
            "country": "SE",
            "careOf": "Sample Recipient"
          }
        }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: an address member no specification defines still reaches the recipient

    Aegis policy, not a specification requirement: the address member set is
    defined at OpenID Connect Core 1.0 §5.1.1 and bounded to that set by
    §5.1, so carrying an unrecognised member is a departure. The policy is
    that a declared member set is a floor and not a ceiling, because silently
    deleting a member a caller wrote is the worse failure — an address is a
    delivery instruction, and the caller gets no error and no way to discover
    the loss. The undeclared member gets the mechanical key flip every
    unregistered claim gets: snake_case on the wire, camelCase on the way
    back, one level in.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the profile claims are the object
        """json
        { "address": { "streetAddress": "Sample 1", "buildingName": "Sample House" } }
        """
      And no access token is co-issued

    Scenario Outline: <wire>: the undeclared member reaches the wire, snake-cased like every unregistered claim
      When I mint the content under the "id_token" profile on the <wire> wire
      Then the raw payload carries "address" as the object
        """json
        { "street_address": "Sample 1", "building_name": "Sample House" }
        """

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the verify reads it back into the profile bucket in camelCase
      When I mint the content under the "id_token" profile on the <wire> wire
      And I verify the token under the "id_token" profile as the audience "client-1"
      Then the verified token is a "<format>"
      And the verified profile bucket is exactly the object
        """json
        { "address": { "streetAddress": "Sample 1", "buildingName": "Sample House" } }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

  Rule: a claim member whose value is null states nothing, and is omitted rather than refused

    `null` is how a database column, a JSON document and an unset optional
    all spell "there is no value here", so an issuer assembling a claim from
    such a source is stating the members it has. A null member is an absence:
    refusing it turns the ordinary shape of a nullable row into an error, and
    writing it puts a member on a signed wire that asserts nothing. Aegis
    policy on the read. The null member's codec is a structure, deliberately:
    `act` is recursive (RFC 8693 §4.1), so `act.act` goes to the structure
    walker, which refuses a value that is not an object — only classifying
    null as absence first keeps this token readable, which is why the token
    verifying is the load-bearing assertion. A raw door carries a nested null
    as written, and the first scenario reads that premise off the wire.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"            |
        | sub | "user-1"                              |
        | act | { "sub": "service-a", "act": null }   |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the nested null reaches the wire as written, so it is the read that is judged
      When I sign the wire claims as a claims token on the <wire> wire
      Then the raw payload carries "act" as the object
        """json
        { "sub": "service-a", "act": null }
        """

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the token verifies and the actor is read as the one member it stated
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified token is a "<format>"
      And the verified actor claim is exactly the object
        """json
        { "subject": "service-a" }
        """

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the chain that was stated survives in the delegation bucket
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then the verified delegation is exactly the object
        """json
        { "isDelegated": true, "currentActor": "service-a", "actorChain": [{ "subject": "service-a" }] }
        """

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose claim member is not of its declared kind is refused

    A signature binds an issuer to what a token says, and a member whose value
    contradicts its declared shape is a statement this package cannot stand
    behind on either disposal that is not a refusal: written, it is bytes
    aegis's own reader reports as never stated; dropped, the signed token
    silently says less than the caller asked it to sign. The write door is
    aegis's own caller, so strictness costs no interoperability. Aegis policy
    at mint. The conforming sibling is what makes the refusal's scope
    observable: one entry, naming the member, not the structure.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the profile claims are the object
        """json
        { "address": { "streetAddress": "Sample 1", "region": 42 } }
        """
      And no access token is co-issued

    Scenario Outline: <wire>: the mint is refused, naming the member alone
      When I mint the content under the "id_token" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "address" and locates the fault at "address.region": Member "region" must be the shape it declares

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claim member a read cannot decode is dropped without discarding the members beside it

    The members of a structured claim are independently meaningful
    (OpenID Connect Core 1.0 §5.1.1) — a street address is a fact about the
    end-user whether or not the region beside it arrived in a shape this
    reader can hold. A foreign token is not bound by aegis's declarations, so
    an undecodable member is reported as one the token does not state, and
    the disposal must never spread: discarding the whole structure destroys
    information the issuer signed, silently. Aegis policy at the read. The
    unreadable member has a surviving sibling, the only shape in which the
    scoping is observable, and the bucket is asserted exactly so the dropped
    member is asserted absent.

    Background:
      Given the wire claims
        | iss     | "https://test.lindorm.io/"                    |
        | sub     | "user-1"                                      |
        | address | { "street_address": "Sample 1", "region": 42 } |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the token verifies and the address arrives with the member that passed alone
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified token is a "<format>"
      And the verified profile bucket is exactly the object
        """json
        { "address": { "streetAddress": "Sample 1" } }
        """

      Examples:
        | wire | typ             | format |
        | jose | JWT             | jwt    |
        | cose | application/cwt | cwt    |

  Rule: minting a token whose actor names a subject that is not a string is refused

    An actor's members identify the acting party (RFC 8693 §4.1), so a member
    whose value contradicts its declared shape changes who a signed token says
    acted if it is disposed of in silence. The write door is aegis's own
    caller, so the member is refused at mint — aegis policy — and the refusal
    names its position so the caller repairs the value. The members beside it
    are not the fault and are not named. The `default` profile declares no
    actor shape rule, so the refusal is the structure walker's own.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the actor claim is the object
        """json
        { "subject": 42, "clientId": "service-1" }
        """

    Scenario Outline: <wire>: the mint is refused, naming the member at its position
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and locates the fault at "act.subject": Member "subject" must be the shape it declares

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a foreign token whose actor subject is not a string is read as an actor that does not state one

    A foreign token is not bound by aegis's declarations, and an actor member
    the reader cannot decode into its declared type is a fact the reader
    cannot report in that type — reporting the raw value would hand a
    consumer a runtime type error in code the type checker passed. The
    actor's structure conforms, so the disposal stays scoped to the member:
    the claim is read as an actor that does not state it, and the token stays
    the delegated one its issuer signed. Aegis policy at the read.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"              |
        | sub | "user-1"                                |
        | act | { "sub": 42, "client_id": "service-1" } |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the token verifies and the actor keeps the member beside the fault
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified token is a "<format>"
      And the verified actor claim is exactly the object
        """json
        { "clientId": "service-1" }
        """

      Examples:
        | wire | typ             | format |
        | jose | JWT             | jwt    |
        | cose | application/cwt | cwt    |

    Scenario Outline: <wire>: the token stays the delegated one its issuer signed
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified delegation reports a delegated presentation

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: minting a token whose nested actor names a subject that is not a string is refused at its depth

    A delegation chain nests one actor inside another (RFC 8693 §4.1),
    putting the same member set at every depth, so the mint-side refusal
    holds one hop back exactly as it holds at the surface. Aegis policy at
    mint: the entry's key carries the full path from the claim down to the
    member, because a bare claim name cannot say which actor in a chain of
    identical member sets is malformed. The outer actor and the conforming
    member beside the fault are not named.

    Background:
      Given the content to mint
        | subject | user-1 |
      And the content expires in "1h"
      And the actor claim is the object
        """json
        { "subject": "outer-actor", "act": { "subject": 42, "clientId": "service-2" } }
        """

    Scenario Outline: <wire>: the mint is refused, keying the fault at the inner actor's member
      When I mint the content under the "default" profile on the <wire> wire
      Then minting is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "act" and locates the fault at "act.act.subject": Member "subject" must be the shape it declares

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a foreign token whose nested actor subject is not a string is read as a chain whose inner actor does not state one

    A delegation chain nests one actor inside another (RFC 8693 §4.1), and a
    foreign token is not bound by aegis's declarations at any depth. The
    disposal must not widen with distance from the surface: discarding the
    inner actor would erase a party from a chain whose whole purpose is
    recording who acted for whom. So the outer chain is read as written, the
    inner actor keeps the members beside the fault, and only the member the
    reader cannot hold goes unreported. Aegis policy at the read.

    Background:
      Given the wire claims
        | iss | "https://test.lindorm.io/"                                                 |
        | sub | "user-1"                                                                   |
        | act | { "sub": "outer-service", "act": { "sub": 42, "client_id": "service-2" } } |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the token verifies and the chain arrives with the inner actor's remaining member
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified token is a "<format>"
      And the verified actor claim is exactly the object
        """json
        { "subject": "outer-service", "act": { "clientId": "service-2" } }
        """

      Examples:
        | wire | typ             | format |
        | jose | JWT             | jwt    |
        | cose | application/cwt | cwt    |

    Scenario Outline: <wire>: the token stays the delegated one its issuer signed
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified delegation reports a delegated presentation

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

  Rule: an address that is not an address is refused, not read as an absent one

    The address claim is a structure of sub-fields (OpenID Connect Core 1.0
    §5.1.1), so a scalar under that name is a claim that does not conform to
    its own definition, written by an issuer this verifier does not control.
    Reporting the scalar hands the consumer a value in a field whose declared
    shape is an object; discarding it in silence reports the token as
    carrying no address, which is false — its issuer signed one. A reader may
    decline to describe what it cannot describe; it may not report a
    stranger's assertion as never made. Aegis policy at verify: the claim is
    refused, and the token with it. The entry names the position and what
    was wanted there, so the scenario cannot go green on a different fault
    reaching the same code.

    Background:
      Given the wire claims
        | iss     | "https://test.lindorm.io/"  |
        | sub     | "user-1"                    |
        | address | "Sample 1, 00100 Stockholm" |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the verify is refused, naming the address as the position that must be an object
      When I sign the wire claims as a claims token on the <wire> wire
      And I verify the token
      Then verification is refused as a domain error "claim_structure_invalid"
      And the refusal names the claim "address" and locates the fault at "address": Claim "address" must be an object

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claim carrying null on the wire is read as one the token does not state

    `null` is the only spelling of absence a JSON or CBOR payload can carry —
    neither encoding can express `undefined` — so it is the form an issuer's
    empty optional actually arrives in. It is not a value contradicting the
    claim's declared shape and must not be refused as one: an issuer writing
    `null` is stating nothing. The distinction is the whole boundary — a
    structured claim carrying a scalar is refused, the same claim carrying
    `null` was never stated. Aegis policy at the read. No aegis door writes a
    wire null at a claim key, so the token is a third party's, and the first
    scenario reads the nulls off the wire so the read is the thing judged.
    `email_verified` is a second claim of a different codec kind, so the rule
    is about the read and not about one structured claim.

    Background:
      Given the wire claims
        | iss            | "https://test.lindorm.io/" |
        | sub            | "user-1"                   |
        | address        | null                       |
        | email_verified | null                       |
      And the wire claims expire at "2024-01-01T09:00:00.000Z"

    Scenario Outline: <wire>: the nulls reach the wire, so it is the read that is judged
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      Then the raw payload carries "address" as null
      And the raw payload carries "email_verified" as null

      Examples:
        | wire | typ             |
        | jose | JWT             |
        | cose | application/cwt |

    Scenario Outline: <wire>: the token verifies and no profile bucket is reported
      When a third party signs the wire claims on the <wire> wire, typed "<typ>"
      And I verify the token
      Then the verified token is a "<format>"
      And the verified token carries no profile bucket

      Examples:
        | wire | typ             | format |
        | jose | JWT             | jwt    |
        | cose | application/cwt | cwt    |
