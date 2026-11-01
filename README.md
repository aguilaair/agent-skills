# agent-skills

Personal agent skills, kept in sync across machines. Currently the p3 stack:
p3-mode and its playbooks, setup-p3, autonomous-poteto, the routed skills
(how, why, arena, swarm, architect, interrogate, reflect, …) and the
`principle-*` skills. Based on
[uzairansaruzi/p3-stack](https://github.com/uzairansaruzi/p3-stack)
(MIT, see `LICENSE`) at 09909eb, with local changes.

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

`agents/` holds prompt briefs that the skills hand to delegated workers.
They are not harness agents and are not installed anywhere.
