Feature: undefined step reporting

  Scenario: a step nobody implemented
    When I frobnicate "twice"
    Then the gadget hums
    And the gadget glows
