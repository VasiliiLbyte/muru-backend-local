// Staging PM2 config — separate process from prod (muru-backend).
// PORT is NOT set here: read from .env via dotenv (backend/src/utils/env.ts),
// resolved relative to process cwd (= repo root when started from here).
// Paths are relative so the repo can live in any directory on VPS.
module.exports = {
  apps: [
    {
      name: 'muru-backend-staging',
      script: './backend/dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/backend-staging-error.log',
      out_file: './logs/backend-staging-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
