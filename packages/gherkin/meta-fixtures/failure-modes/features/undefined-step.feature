Feature: undefined step reporting
  Scenario: a step nobody implemented
    Given a gadget on the bench
    When I frobnicate "twice"
    Then the gadget hums
    And the gadget glows
