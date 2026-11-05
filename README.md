# agent-skills

Personal agent skills, kept in sync across machines. Currently the p3 stack:
p3-mode and its playbooks, setup-p3, scope, buildit, the routed skills
(how, why, arena, swarm, architect, interrogate, reflect, …) and the
`principle-*` skills. Based on
[uzairansaruzi/p3-stack](https://github.com/uzairansaruzi/p3-stack)
(MIT, see `LICENSE`) at 09909eb, with local changes, and synced with
[pstack](https://github.com/cursor/plugins/tree/main/pstack) up to
`c742dd6` (2026-10-27). That sync added `ketchup`, `ketchup-video`, `sharpen`,
`in-your-own-words`, `statechart`, and the two formal-verification skills.

Also `release-announcement`: the Terradot prod-deploy changelog for Slack and
its on-brand bento image (`render.sh` installs `playwright-core` once into
`~/.cache/release-announcement` and renders with the system Chrome).

And `explainer-video`: a narrated explainer film, its short cut, and a
click-through presenter deck, all from one HTML composition.

And `feature-video`: a short before/after video of a feature change for the
ops team, in English and Brazilian Portuguese, filmed on the branch's real
screens. Unlike `explainer-video` it ships its engine (`fv.sh`); the first run
installs Kokoro TTS, faster-whisper and `playwright-core` into
`~/.cache/feature-video`.

And `release-kit`: ties `feature-video` and `release-announcement` together.
`prep` runs on a schedule and drafts the feature videos missing for PRs merged
since the last #software announcement. `ship` writes the changelog and bento
image and bundles them with the approved videos under `~/release-kit/`.

## Install or update

```bash
git clone https://github.com/aguilaair/agent-skills.git ~/agent-skills
~/agent-skills/install.sh

# later, on any machine
git -C ~/agent-skills pull && ~/agent-skills/install.sh
```

`install.sh` links each `skills/<name>` into `~/.agents/skills/` and
`~/.claude/skills/`, prunes links to skills removed from the repo, and skips
names that already exist as real directories. Keep the clone where you ran it:
the links are absolute.

After installing on a new machine, run `/setup-p3` in T3 Code to write
`~/.agents/p3-models.md` for that machine's providers.

A skill's `agents/` folder holds prompt briefs it hands to delegated workers.
They are not harness agents. They live inside the skill so `install.sh` links
them along with it.
