---
name: gist-skills
description: How to save & load skills from my gist
metadata:
  url: https://gist.github.com/kuboon/e2954a108b3d4f7cef5b59c94785d2a1
  updated_on: 2026-04-01
---

# List skills

`gh gist list --filter "SKILL.md <other queries>"`

# Load skill

- get gist-id by "List skills"
- get contents by `gh gist view <gist-id>`
- save them to `<workdir-root>/.agents/skills/<skill-name>/*`

# Save or update

- metadata.url in frontmatter is not exist or no gist-url saved:
  - `gh gist create SKILL.md -p -d "<skill-name>/SKILL.md <tag> <tag> <tag>"`
- update metadata in frontmatter

```yaml
metadata:
  url: https://gist.github.com/kuboon/<gist-id>
  updated_on: 2026-04-01
```

- `gh gist edit <gist-id> "<update-filename>"`
