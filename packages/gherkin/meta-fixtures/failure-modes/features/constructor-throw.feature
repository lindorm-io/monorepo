Feature: binding constructor failure

  Scenario: a step whose binding class cannot construct
    Given a step in a throwing class
    Then another step in the throwing class
