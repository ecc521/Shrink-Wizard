# Shrink Wizard

Shrink Wizard is a modern, cross-platform desktop application designed to reclaim disk space through lossless file re-compression. It seamlessly integrates OS-level transparent compression capabilities and advanced media optimization techniques with a sleek, dynamic React interface.

## Features

- **macOS Transparent Compression**: Utilizes native Apple File System Compression via `ditto` natively bundled in the OS to drastically reduce the footprint of standard applications and directories, without affecting runtime compatibility or signatures.
- **Windows CompactOS Integration**: Exposes the underlying Windows `compact.exe` utility, allowing you to compress the entire operating system layer or specific directories using `LZX` or `XPRESS` algorithms.
- **Lossless JPEG Optimization**: Strips bloated structural metadata and optimizes Huffman tables without altering a single pixel of visual data. It employs Mozilla's MozJPEG engine.
- **Archival JPEG XL Recompression**: Losslessly transpiles JPEG bitstreams into the modern, highly-efficient `.jxl` format for an additional 25-30% spatial savings, fully reversible back to the exact original JPEG.
- **Beautiful React Interface**: Built with Vite, React 18, and Framer Motion for a fluid, dark-mode-first user experience.

## Installation & Development

Shrink Wizard runs on Electron 29 and Node 20. Ensure you have Node.js and npm installed.

```bash
# Clone the repository
git clone https://github.com/ecc521/Space-Saver.git
cd Space-Saver

# Install dependencies
npm install

# Start the development server (Vite HMR + Electron)
npm run dev

# Build for production
npm run build

# Package the distributables for your current platform
npm run dist
```

## Environment Configuration

To develop locally with premium features (Pro Tier unlocking) and data persistence, you must configure the database and Stripe integrations. Create a `.env` file in the root directory and populate it with the following API variables:

### Database (Firebase)
Used for user authentication, tracking the 5GB limits, and managing "Pro" licenses securely via Firestore.
- `VITE_FIREBASE_API_KEY`: Your Firebase web API key.
- `VITE_FIREBASE_AUTH_DOMAIN`: Example: `your-project.firebaseapp.com`.
- `VITE_FIREBASE_PROJECT_ID`: Your Firebase project ID.
- `VITE_FIREBASE_STORAGE_BUCKET`: Example: `your-project.appspot.com`.
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: Your messaging sender ID.
- `VITE_FIREBASE_APP_ID`: Your Firebase web app ID.

**Deploying Database Rules:**
Shrink Wizard includes strict Security Rules (`firestore.rules`) out-of-the-box to prevent users from scraping or modifying License Keys. Once you install the Firebase CLI (`npm install -g firebase-tools`) and login (`firebase login`), deploy these rules to your project by running:
```bash
firebase deploy --only firestore:rules
```

### Stripe Integration
Used for secure checkout and payment processing.
- `VITE_STRIPE_PUBLIC_KEY`: Your Stripe publishable/public key (starts with `pk_test_` or `pk_live_`).
- `STRIPE_SECRET_KEY`: Your Stripe secret key. *Warning: Never bundle this into the Electron client directly, keep it in a secure backend or serverless function.*

## Binary Dependencies

### Native Binaries
For peak performance, Shrink Wizard bundles pre-compiled, native executables safely packaged in the `bin/` directory. 
- **Image Transcoding:** `jpegtran-mac-arm64` / `jpegtran-win-amd64.exe` (MozJPEG)
- **JPEG XL Engine:** `cjxl` & `djxl` reference implementations
- **Apple FS Compression:** Native macOS `ditto` (`--hfsCompression`)

*These binaries are sourced from official upstream releases, package managers, or trusted distributions.*

### WebAssembly MozJPEG (Fallback)
If a native binary is unavailable for the host platform, Shrink Wizard executes a pure-WebAssembly version of `jpegtran` powered by V8. The WASM artifact was manually compiled from the MozJPEG C source.

**How to rebuild the WASM artifact (`jpegtran.js` / `jpegtran.wasm`):**
We provide a Dockerfile inside `scripts/wasm-mozjpeg/` that sets up Emscripten and compiles the MozJPEG source code into WASM with Node file system access (`-s NODERAWFS=1`).

```bash
# Navigate to the docker context
cd scripts/wasm-mozjpeg

# Build the Docker image (this handles downloading and compiling MozJPEG)
docker build -t build-wasm-mozjpeg .

# Extract the compiled artifacts (.js and .wasm) to the host machine
docker create --name extract-container build-wasm-mozjpeg
docker cp extract-container:/usr/src/app/out/jpegtran.js ../../bin/jpegtran.js
docker cp extract-container:/usr/src/app/out/jpegtran.wasm ../../bin/jpegtran.wasm
docker rm extract-container
```

## Metadata Preservation
By default, the application runs `jpegtran` with the `-copy all` flag during lossless compression to strictly preserve all file metadata (ICC profiles, EXIF, XMP, etc.).

## License
Copyright © Tucker Willenborg
