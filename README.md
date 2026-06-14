# virtual-fs-node

A FUSE filesystem that turns Markdown into live, executable context for AI agents.

This version supports a hybrid architecture that merges project code with dynamic diagnostic tools (.super.md) and features a non-blocking execution engine.

## Usage

### Prerequisites
- Node.js >= 14
- FUSE (libfuse on Linux, macFUSE on macOS)

### Installation
```bash
npm install
```

### Start
```bash
node index.js <project_directory>
```

The system will automatically mount the virtual filesystem. The mount point is configured in `.super_md/config.json`.

## Features

### Non-blocking Execution
The filesystem handles multiple concurrent read operations. Long-running scripts or diagnostic blocks do not block other filesystem operations.

### Execution Modes
The system can toggle between two modes using the terminal:
- **Edit Mode (1/e):** Files are displayed and editable as standard Markdown.
- **Exec Mode (2/x):** Code blocks are executed on read, returning only the output.

### Caching (TTL)
Results can be cached to improve performance. Append a time duration to the block tag using the `:time` syntax. Supported units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days).

Example:
```run-node:1h
// This block will only execute once every hour and every time you read it it will use the result in cache
console.log(Date.now());
```

## Code Blocks

### run-node
Executes inline JavaScript.
```run-node
const fs = require('fs');
const exists = fs.existsSync('src/main.js');
console.log(exists ? '[x] main.js exists' : '[ ] missing main.js');
```

### run
Executes shell commands in the project root.
```run
grep -r "require.*processor" . --exclude="*.super.md" | cut -d: -f1 | sed 's/^/- /'
```

### script
Executes scripts from the configured scripts directory.
```script
node fetch-notion-tasks.js
```

## Sidecar Pattern
Dynamic context can be associated with any file by creating a `.super.md` companion. 

Example: `lib/auth.js` -> `lib/auth.js.super.md`

When an AI agent reads the `.super.md` file in Exec Mode, it receives a real-time report of the associated file's status (dependencies, linting, tests, etc.) without human intervention.
