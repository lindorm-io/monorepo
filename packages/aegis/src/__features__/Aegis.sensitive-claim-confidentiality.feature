Feature: Confidentiality of sensitive claims

  A claim is sensitive because of what it is, never because of which container
  the caller put it in: the confidentiality decision keys off the claim
  registry's category, so no input shape can route a sensitive value around
  it. Where the value can be sealed, the token is delivered encrypted; where
  it cannot, the value is omitted rather than signed in the clear. The
  cleartext boundary is stated on a claim the registry does not categorise,
  so that any movement of the boundary is visible. Every rule is aegis policy
  at mint and carries no tag; the wire is read off the bytes by the
  independent inspector wherever a claim's presence is the question.

  Background:
    Given the clock reads "2024-01-01T08:00:00.000Z"
    And a deployment at "https://test.lindorm.io/" whose vault holds an ES512 signing key

  Rule: a claim the registry categorises as sensitive forces an encrypted token whichever container carried it

    A national identity number on a cleartext wire is disclosed to every
    intermediary that handles the token and to anything that logs it, and the
    disclosure is irreversible. The claim sits in the general claims
    container here, not the sensitive one, so what forces the envelope is the
    registry's category alone. The vault holds both recipient keys: JOSE
    seals with the agreement key, while a COSE_Encrypt0 names no recipient and
    runs no recipient algorithm (RFC 9052 §5.2), so that wire is sealed with
    the symmetric key known out of band. The minted result reports the signed
    token's own kind with the envelope beside it, so the envelope is the
    assertion; the payload of a sealed token is ciphertext, so no cleartext
    exclusion could be checked here.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the content's claims container is the object
        """json
        { "nationalIdentityNumber": "19900101-1234" }
        """

    Scenario Outline: <wire>: the token is delivered sealed, its own kind reported beside the envelope
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the minted token is a "<format>"
      And the minted token reports the wrapper "<wrapper>"

      Examples:
        | wire | format | wrapper |
        | jose | jwt    | jwe     |
        | cose | cwt    | cwe     |

  Rule: naming a sensitive claim with an empty value still forces the confidentiality decision

    The gate asks whether the issuer wrote a sensitive claim, not whether the
    value carries information. An issuer assembling content from optional
    fields reaches an empty national identity number by exactly the path they
    reach a populated one, so a gate that read emptiness as absence would stop
    firing whenever the upstream field happened to be blank, and the same code
    path would protect some subjects and not others. Deciding from the name
    is what a registry-driven category exists for.

    Background:
      Given the vault also holds an ECDH-ES encryption key
      And the vault also holds a dir encryption key
      And the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the content's claims container is the object
        """json
        { "nationalIdentityNumber": "" }
        """

    Scenario Outline: <wire>: the token is delivered sealed, its own kind reported beside the envelope
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the minted token is a "<format>"
      And the minted token reports the wrapper "<wrapper>"

      Examples:
        | wire | format | wrapper |
        | jose | jwt    | jwe     |
        | cose | cwt    | cwe     |

  Rule: a sensitive claim is left out of the token entirely when no recipient key is available

    Confidentiality fails closed. When a sensitive claim cannot be sealed —
    the vault holds no recipient key — the only safe outcome is to omit it:
    signing it in the clear would disclose it irreversibly while the caller
    believes the sensitivity marking did something. Omission costs the
    audience a claim; emission costs the subject the value. The non-sensitive
    neighbour rides the same container, so its presence is what shows the
    claim was removed for what it is and not because the container was
    discarded wholesale. A claim with no registered CWT key travels COSE under
    its text name, so the spelling read off the bytes is the same on either
    wire.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the content's claims container is the object
        """json
        { "nationalIdentityNumber": "19900101-1234", "nickname": "nick" }
        """

    Scenario Outline: <wire>: the token is signed in the clear, with no envelope
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the minted token is a "<format>"
      And the minted token reports no wrapper

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the sensitive claim does not reach the wire
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the raw payload carries no "national_identity_number"

      Examples:
        | wire |
        | jose |
        | cose |

    Scenario Outline: <wire>: the non-sensitive neighbour still rides the token
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the raw payload carries "nickname" "nick"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claim supplied through the claims container is published on the cleartext wire

    The claims container is the caller's route for additional non-confidential
    claims: its content is spread onto the domain layer verbatim and published
    for the audience to read. Stating where the cleartext boundary sits is
    what makes any movement of it visible rather than silent. The claim is one
    the registry does not know at all, so nothing marks the content sensitive
    and no recipient key is stocked: one stocked here would be inert, reading
    as a precondition of a capability that has none.

    Background:
      Given the content to mint
        | subject | user-1 |
      And an audience list whose only member is "client-1"
      And the content's claims container is the object
        """json
        { "favouriteColour": "green" }
        """

    Scenario Outline: <wire>: the token is signed in the clear, with no envelope
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the minted token is a "<format>"
      And the minted token reports no wrapper

      Examples:
        | wire | format |
        | jose | jwt    |
        | cose | cwt    |

    Scenario Outline: <wire>: the claim reaches the cleartext wire under its wire name
      When I mint the content under the "userinfo" profile on the <wire> wire
      Then the raw payload carries "favourite_colour" "green"

      Examples:
        | wire |
        | jose |
        | cose |

  Rule: a claim supplied through the sensitive container is delivered as an encrypted token

    Confidentiality of a sensitive claim is delivered by sealing the token,
    not by omitting the claim — the audience still needs the value. So an
    encryptable profile handed a sensitive container must produce an
    encrypted artifact, and that is what makes encryption an available
    outcome for the profile at all. Both recipient keys are stocked for the
    reason the first rule gives; the envelope is the assertion because a
    sealed payload is ciphertext.

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

    Scenario Outline: <wire>: the token is delivered sealed, its own kind reported beside the envelope
      When I mint the content under the "id_token" profile on the <wire> wire
      Then the minted token is a "<format>"
      And the minted token reports the wrapper "<wrapper>"

      Examples:
        | wire | format | wrapper |
        | jose | jwt    | jwe     |
        | cose | cwt    | cwe     |
