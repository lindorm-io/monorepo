Feature: Mint-time facts a token's claims do not carry

  A profiled mint is told things the assembled claims cannot say for
  themselves: whether an access token was co-issued, and whether a value the
  caller wrote is a value a demand can bite on. Each rule refuses at the mint,
  before a signature exists, and names the fault in the caller's vocabulary
  so the caller repairs the value rather than looking for a field they already
  wrote. Every rule is aegis policy at mint and carries no tag; a description
  cites the document that makes the demanded claim required where the row
  names one.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: minting an id_token without stating whether an access token was co-issued is refused

    `at_hash` is required exactly where an access token is co-issued from the
    authorization endpoint (OpenID Connect Core 1.0 §3.2.2.10,
    OpenID Connect Core 1.0 §3.3.2.11), and optional in the code flow that
    defines it (OpenID Connect Core 1.0 §3.1.3.6). Whether one was co-issued
    is a fact only the issuer holds: nothing about the token distinguishes
    "no access token was issued" from "the issuer forgot to say". Treating the
    unstated case as false would silently issue the exact token the rule
    exists to prevent, so the fact is demanded rather than assumed — aegis
    policy at mint.

    Background:
      Given the content to mint
        | subject     | user-1 |
        | accessToken | at-1   |
      And an audience list whose only member is "client-1"

    Scenario Outline: <wire>: the mint is refused, naming the fact it was not told
      When I mint the content under the "id_token" profile on the <wire> wire
      Then minting is refused as a domain error "missing_sign_context"
      And the refusal names the missing mint context "accessTokenIssued"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting an id_token with a context bag that misspells the co-issuance key is refused

    A rule reading a fact under a name nobody supplied evaluates it as absent,
    which for a boolean reads as false: a misspelled key is not an error, it
    is a silent answer of "no". A supplied bag is therefore no evidence that
    the fact was supplied, so the check is on the name the rule reads. The
    context type is closed, so a typed caller cannot write the misspelling;
    the rule is stated for the doors that have no type behind them.

    Background:
      Given the content to mint
        | subject     | user-1 |
        | accessToken | at-1   |
      And an audience list whose only member is "client-1"
      And the mint context is the object
        """json
        { "accessTokenIssud": false }
        """

    Scenario Outline: <wire>: the mint is refused, naming the fact it was not told
      When I mint the content under the "id_token" profile on the <wire> wire
      Then minting is refused as a domain error "missing_sign_context"
      And the refusal names the missing mint context "accessTokenIssued"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose required claim is an empty string is refused

    A subject identifier of "" names nobody, so a presence rule satisfied by
    one guarantees nothing while reporting that it does. Presence has to mean
    the same thing at issue and on arrival: a verifier reads an empty required
    claim as missing, and an issuer that read it as present would mint tokens
    its own verifier refuses.

    Background:
      Given the content to mint
        | subject |  |
      And an audience list whose only member is "client-1"

    Scenario Outline: <wire>: the mint is refused, reporting the claim as missing
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "subject": Required claim "subject" is missing

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose required audience is an empty list is refused

    `aud` is the set of recipients a token is intended for (RFC 7519 §4.1.3),
    so an empty set names none of them: the token is addressed to nobody while
    reporting that it has an audience. A demand for a claim is a demand for
    its content, and a demand a container satisfies while holding nothing
    would be enforced at scalar claims and open at every list- and
    object-valued one, which is the half of the vocabulary that carries the
    restrictions and the bindings. Aegis policy at mint.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an empty audience list

    Scenario Outline: <wire>: the mint is refused, reporting the claim as missing
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "audience": Required claim "audience" is missing

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a token whose required claim is not of its declared type is refused

    Every registered claim declares the kind of value it holds, and the writer
    leaves off the wire a value its own reader would not read back. A required
    claim supplied as the wrong kind would satisfy the demand at the policy
    gate and then be absent from the token, under a profile whose whole point
    is that it is there. The refusal names the fault as what it is — not of
    its declared type, not missing — under the policy code, so it cannot be
    mistaken for a structure refusal that carries the same list shape. A typed
    caller cannot reach this; the rule is stated for a value read from a
    foreign source and handed on.

    Background:
      Given the content to mint is the object
        """json
        { "subject": 42, "audience": ["client-1"], "clientId": "client-1" }
        """

    Scenario Outline: <wire>: the mint is refused, naming the value's type as the fault
      When I mint the content under the "access_token" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "subject": Required claim "subject" is not of its declared type

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: minting a sender-constrained token whose confirmation binds no key is refused

    `cnf` is the container for the members that identify the
    proof-of-possession key a presenter must demonstrate possession of, on
    either encoding (RFC 7800 §3.1, RFC 8747 §3), and a confirmation holding
    no member names no key. A token issued that way is declared
    sender-constrained and is in fact a bearer token: a recipient checking the
    binding has nothing to check it against. A profile demanding a
    confirmation demands the binding, not the container — aegis policy at
    mint. No built-in profile requires a confirmation, so the rule is stated
    against one registered through the public door.

    Background:
      Given a registered profile "sender_constrained" that demands the claims "subject", "audience", "confirmation" and checks the shape of "confirmation"
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "https://rs.lindorm.io/"
      And the confirmation claim is the object
        """json
        {}
        """

    Scenario Outline: <wire>: the mint is refused, reporting the confirmation as missing
      When I mint the content under the "sender_constrained" profile on the <wire> wire
      Then minting is refused as a domain error "profile_policy_invalid"
      And the refusal reports the direction "mint" and locates the fault at "confirmation": Required claim "confirmation" is missing

      Examples:
        | wire |
        | jose |
        | cose |
