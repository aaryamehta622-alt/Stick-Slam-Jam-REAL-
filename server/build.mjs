import { build } from 'esbuild';
await build({entryPoints:['src/index.ts'],bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',outfile:'dist/index.js',sourcemap:true});
