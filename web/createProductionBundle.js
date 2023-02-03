let sassPlugin = require('esbuild-sass-plugin').sassPlugin;

require('esbuild').build({
  entryPoints: ['main.tsx'],
  define:{
    "process.env.NODE_ENV": "\"production\""
  },
  bundle: true,
  minify: true,
  outfile: 'dist/bundle.min.js',
  plugins: [sassPlugin()],
}).catch(() => process.exit(1)) 
