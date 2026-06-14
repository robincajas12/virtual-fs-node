# virtual-fs-node

A virtual filesystem that attaches computable metadata and execution layers to Markdown files.

Virtual FS Node mounts a directory via FUSE and intercepts file read operations. Content is processed on-demand by executing embedded code blocks.

## Usage

### Prerequisites
- Node.js >= 14
- FUSE

### Start
```bash
node index.js <project_directory>
```

## State Management
- **Edit Mode (1/e):** Standard source text.
- **Exec Mode (2/x):** Process output.

## Execution Blocks

### run-node
```run-node
console.log(1 + 1);
```

### run
```run
echo "hello"
```

### script
```script
./my-script
```

### Caching
Append a duration to a block tag. Syntax: `:time` (e.g., `:1h`).
```run:10m
echo "cached result"
```
