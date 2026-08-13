import { defineConfig } from 'vite';

// Config for the Firestore security-rules suite only.
//
// It lives apart from vite.config.js because that config deliberately excludes
// this file: the rules tests need the Firestore emulator running, so they must
// not be part of the default `npm test` (which has to stay fast and offline).
//
// Run it with `npm run test:rules`, which starts the emulator around it. CI
// runs both suites.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/lib/firestore-rules.test.js'],
    // The emulator is a real service; give it room on a cold CI runner.
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
