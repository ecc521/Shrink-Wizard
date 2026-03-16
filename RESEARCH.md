# Space Saver: macOS Transparent Compression Research

## Goal
Implement macOS transparent compression (`com.apple.decmpfs`) using pure JavaScript/TypeScript (via `zlib`) without relying on the `ditto` CLI.

## Current Understanding (Pre-Audit)
- macOS supports transparent compression through a specific extended attribute (xattr) named `com.apple.decmpfs`.
- When a file is compressed, the actual data is moved to a "resource fork" (or stored within the xattr itself if very small).
- The `decmpfs` header likely identifies the compression type (Zlib, etc.) and the original file size.

## Action Plan
1. **Header Analysis:** Reverse engineer the `com.apple.decmpfs` header structure.
2. **Resource Fork Mapping:** Determine the exact system call or Node.js logic required to write to the `..namedfork/rsrc` path.
3. **Zlib Integration:** Verify that standard Node.js `zlib` outputs compatible streams for the filesystem driver.

---
*Documented by Ryan Lowe on 2026-03-16*
