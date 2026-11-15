import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** Short commit shown by the ?debug=perf readout, so a tester can tell which build is loaded. */
function commit(): string {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'unknown'; }
}

export default defineConfig({
  // Relative base: the build works at any path, including https://<user>.github.io/<repo>/.
  base: './',
  define: { __COMMIT__: JSON.stringify(commit()) },
  test: {
    // Agent worktrees live under .claude/; their copies of the tests must not run here.
    exclude: ['node_modules/**', 'dist/**', '.claude/**', 'e2e/**'],
  },
});
