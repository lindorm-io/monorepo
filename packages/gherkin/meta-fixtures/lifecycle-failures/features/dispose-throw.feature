Feature: disposal throw

  Scenario: disposal continues past the throwing context
    Given a disposing step
    Then the disposing step ran

  Scenario: a step failure stays primary and the disposal failure appends
    Given a disposing step that fails
    Then the scenario stops before this step
