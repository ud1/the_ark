let sassPlugin = require('esbuild-sass-plugin').sassPlugin;

require('esbuild').build({
  entryPoints: ['main.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [sassPlugin()],
}).catch(() => process.exit(1)) 
