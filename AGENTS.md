# Shrink Wizard - AI Agent Guidelines

This document outlines the core principles and constraints for any AI agent or developer contributing to this repository.

## 1. Target Audience: Non-Technical Users

- **Simplicity First:** The UI must be dead-simple and intuitive. Avoid exposing highly technical jargon (e.g., "zlib", "MozJPEG", "Huffman tables") in user-facing elements.
- **Qualitative Descriptions:** Explain computational trade-offs using accessible terminology (e.g., "Fastest vs. Strongest" instead of algorithmic names).
- **Seamless UX:** Users should never have to manually configure environments or install external dependencies (like Homebrew or command-line tools). All required tools (e.g., native OS binaries, `cjxl`, `jpegtran`) must be seamlessly architected and bundled.

## 2. Strict Requirement: 100% Lossless Compression Only

- **Zero Data Degradation:** Shrink Wizard is strictly designed for _lossless_ space reclamation. You must **never** implement or default to any lossy compression techniques that reduce visual, audio, or structural fidelity.
- **Metadata Preservation:** All EXIF data, ICC color profiles, and file metadata must be perfectly preserved during compression, unless the user explicitly opts to strip them.
- **Complete Reversibility & Losslessness Definition:** For pure filesystem operations (like Transparent Compression), alterations must be completely reversible bit-for-bit. However, for image transcoding (like JPEG to JXL), cryptographic hash identity of the restored file is NOT required. The strict requirement is 100% pixel perfection and complete preservation of all original metadata.

## 3. Repository Architecture (Website Submodule)

- **Submodule Pattern:** The `website/` directory maps to the `ecc521/shrinkwizard.com` repository. It serves as the primary marketing site. Ensure that you navigate to this boundary before modifying marketing assets, and push those independently.
- **Tech Stack & Styling:** The website is deliberately built in pure Vanilla HTML, CSS, and JS. Do not attempt to run Vite/React build commands targeting it. The CSS (`styles.css`) dynamically shares similar design principles (dark mode, glassmorphism, accent colors like `--accent-primary`, and Inter font family) with the parent React/Electron desktop application to ensure a cohesive Shrink Wizard brand experience.
- **Distribution:** Download buttons in the website must be dynamically mapped (via browser user agent APIs) to directly point to the latest GitHub Releases distribution binaries (`.dmg`, `.exe`, `.deb`) of this root repository.
