# virtual-fs-node

A FUSE filesystem that turns Markdown into live, executable context for AI agents.

When an AI agent reads a `.md` file from the mount point, the system intercepts the syscall, executes any embedded code blocks against your real project files, and returns the live output — instead of the static source. No APIs, no custom tools. The file itself is the interface.

## Install

```bash
npm install
```

Requires Node.js ≥ 14 and FUSE installed on your OS (`libfuse` on Linux, `macFUSE` on macOS).

## Start

```bash
node index.js <index> <config.json>
```

```bash
# example
node index.js myproject config.json

# agent or terminal can now read
cat mnt/myproject/api-checklist.md
```

## Config

```json
{
  "SOURCE_DIR":  "./textos",
  "MOUNT_POINT": "./mnt/myproject",
  "WORKING_DIR": "./myproject",
  "SCRIPTS_DIR": "./scripts"
}
```

| Key           | Description                                              |
|---------------|----------------------------------------------------------|
| `SOURCE_DIR`  | Where your `.md` checklist files live                    |
| `MOUNT_POINT` | Where agents read from                                   |
| `WORKING_DIR` | Working directory for `run-node` and `run` blocks        |
| `SCRIPTS_DIR` | Working directory for `script` blocks                    |

## Available blocks

### `run-node`
Runs inline JavaScript. Use `require('fs')`, `require('path')`, etc. Executes in `WORKING_DIR`.

````markdown
```run-node
const fs = require('fs')
const ok = fs.existsSync('migrations/001_create_users.sql')
console.log(ok ? '[x] users migration' : '[ ] users migration ⚠')
if (!ok) console.log('    Missing: migrations/001_create_users.sql')
```
````

### `run`
Runs a shell command in `WORKING_DIR`.

````markdown
```run
npm test --silent 2>&1 | tail -5
```
````

### `script`
Runs a shell command in `SCRIPTS_DIR`.

````markdown
```script
node check-env.js
```
````

All blocks have a 5s timeout. On error, the block is replaced with `[Error: …]` — the filesystem keeps running.

## Example

`textos/api-checklist.md`:

````markdown
// AUTH — Routes & middleware
```run-node
const fs = require('fs')
const src = fs.readFileSync('src/index.js', 'utf8')
console.log(src.includes('/auth/register') ? '[x] POST /auth/register' : '[ ] POST /auth/register ⚠')
```

// DATABASE
```run-node
const fs = require('fs')
const ok = fs.existsSync('migrations/001_create_users.sql')
console.log(ok ? '[x] users migration' : '[ ] users migration ⚠')
if (!ok) console.log('    Missing: migrations/001_create_users.sql')
```
````

Agent reads the file, sees what's missing, creates the files, reads again:

```
// AUTH — Routes & middleware
[x] POST /auth/register

// DATABASE
[ ] users migration ⚠
    Missing: migrations/001_create_users.sql
```

Agent writes the file. Reads again:

```
// AUTH — Routes & middleware
[x] POST /auth/register

// DATABASE
[x] users migration
```

Done. The file re-executes on every read — no cache, no polling, no stale state.
