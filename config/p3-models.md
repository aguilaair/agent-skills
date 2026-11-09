# p3 model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` as a value: the role runs on the parent thread's model (omit the delegate_task model). Entries in a panel list still count toward its fan-out.
# Parentheses hold delegate_task options: a bare effort level, then any `option: value` pairs passed verbatim in target.options. An option left out takes the provider default (cursor Grok defaults to fastMode: true).
# Fallback: when a panel entry (arena, architect, interrogate) fails because its provider is out of usage, quota or credits, run that slot on the `panel fallback` model instead and say so. If the exhausted entry is itself on opencode-go, use cursor/glm-5p3-flash (high), so the fallback doesn't draw on the same exhausted plan.
# budget: medium (high)
feature, refactoring: claudeAgent/claude-sonnet-5-5 (high)
bug-fix: claudeAgent/claude-sonnet-5-5 (high)
perf-issue: claudeAgent/claude-sonnet-5-5 (high)
hillclimb: claudeAgent/claude-sonnet-5-5 (high)
judgment and prose: claudeAgent/claude-opus-5-5 (high)
hardest tasks: claudeAgent/claude-fable-5-2 (high)
how explorer: claudeAgent/claude-sonnet-5-5 (high)
how explainer: claudeAgent/claude-opus-5-5 (high)
why investigators: claudeAgent/claude-sonnet-5-5 (high)
why synthesizer: claudeAgent/claude-fable-5-2 (high)
reflect tooling: claudeAgent/claude-opus-5-5 (high)
reflect judgment, divergent, synthesizer: claudeAgent/claude-opus-5-5 (high)
arena runners: claudeAgent/claude-opus-5-5 (high), cursor/grok-4.7 (high, fastMode: false), opencode/opencode-go/deepseek-v4.1-flash (high)
arena cross-judge pool: claudeAgent/claude-opus-5-5 (high), cursor/grok-4.7 (high, fastMode: false), opencode/opencode-go/deepseek-v4.1-flash (high)
swarm workers: claudeAgent/claude-sonnet-5-5 (high)
architect runners: claudeAgent/claude-fable-5-2 (high), cursor/grok-4.7 (high, fastMode: false), opencode/opencode-go/deepseek-v4.1-flash (high)
interrogate reviewers: claudeAgent/claude-opus-5-5 (high), cursor/grok-4.7 (high, fastMode: false), opencode/opencode-go/deepseek-v4.1-flash (high)
panel fallback: opencode/opencode-go/glm-5.3-flash (high)
