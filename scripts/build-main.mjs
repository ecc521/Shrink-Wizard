import { build } from 'esbuild';

build({
  entryPoints: ['src/main/index.ts', 'src/preload/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['electron'],
  outExtension: { '.js': '.cjs' },
  outdir: 'dist-electron',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: true,
}).catch(() => process.exit(1));
