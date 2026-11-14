import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base: the build works at any path, including https://<user>.github.io/<repo>/.
  base: './',
  test: {
    // Agent worktrees live under .claude/; their copies of the tests must not run here.
    exclude: ['node_modules/**', 'dist/**', '.claude/**'],
  },
});
