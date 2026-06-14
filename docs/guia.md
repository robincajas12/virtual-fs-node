# Virtual FS Node

A virtual filesystem that attaches computable metadata and execution layers to Markdown files.

## mechanics

The system mounts a directory via FUSE and intercepts read operations. Markdown code blocks are executed on-demand, and their output replaces the source block before the data reaches the caller.

## state management

The terminal interface allows switching between two modes:
- **Edit Mode (1/e):** standard source text access.
- **Exec Mode (2/x):** process output access.

## configuration

The `.super_md/config.json` file defines the mount point and working directories for the execution blocks.

## technical notes

- **Non-blocking core:** concurrent read operations are supported.
- **Persistent cache:** blocks can store results using the `:time` syntax.
- **Stdin execution:** code blocks are piped directly to runtimes to ensure data integrity.
