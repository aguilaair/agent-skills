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

`install.sh` also links `~/.agents/p3-models.md` to `config/p3-models.md`, so
every machine runs the same p3 model roles. A real file already at that path
is moved to `p3-models.md.bak`. To change roles, edit `config/p3-models.md`
(or run `/setup-p3` with the global location, which writes through the link),
commit, push, and pull on the other machines. A role whose provider isn't set
up on a machine fails there, so set up Cursor and OpenCode wherever the file
names them, or put a project-root `p3-models.md` in place, which wins.

A skill's `agents/` folder holds prompt briefs it hands to delegated workers.
They are not harness agents. They live inside the skill so `install.sh` links
them along with it.
