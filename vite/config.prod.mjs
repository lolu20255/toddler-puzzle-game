import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue'

// Expose the app version (from package.json) to the bundle as a global
// constant. Cheaper than importing the whole JSON file into a runtime module.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        }
    }
}

export default defineConfig({
    base: './',
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version)
    },
    plugins: [
        vue(),
        phasermsg()
    ],
    resolve: {
        alias: {
          '@': fileURLToPath(new URL('../src', import.meta.url))
        }
      },
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    }
});
