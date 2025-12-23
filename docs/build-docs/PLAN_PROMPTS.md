# AI PHASE PLANNING PROMPTS

Help agents stay on track and produce consistent, excellent code with multiple steps of planning and review.

## PHASE CHUNK CREATION

This creates the initial phase chunks for each agent to grab onto for context when implementing.

```text
Alright. Let's start the plan for phase X. Create a planning .MD document with the work chunked out into reasonable chunks. Each chunk should include

- architecture notes
- implementation guidance
- unit testing
- documentation create/update for changes made

Once all chunks are complete, there should be a final chunk for implementation review and creation of more in-depth integration tests for the phase.

Use the @CHUNKING_BEST_PRACTICES.md learnings file to inform your planning, architecture, and guidelines.

Also, give an analysis for what chunks are foundational vs what chunks can be implemented in parallel
```

## ANALYSIS POST PHASE

Run this analysis in iteration until risks and drift are acceptable

```text
Please do a deep analysis on the phase X implementation, and create a doc calls PHASE_X-X_COMPLETION_ANALYSIS.md that outlines all

- code smells
- drift from plan
- vulnerabilities
- functionality issues

Then have a chunked plan for remediation for any issues found.

Also ,please use your analysis and findings to update the @CHUNKING_BEST_PRACTICES.md  file. The idea is to use our analysis findings here to improve planning and execution for future chunk plans
```
