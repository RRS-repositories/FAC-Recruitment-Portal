module.exports = {
  apps: [{
    name: 'atlas-intake',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    kill_timeout: 12000,      // let an in-flight submission and its COMMIT finish
    max_restarts: 10,
    min_uptime: 5000,
    restart_delay: 5000,
    env: {
      NODE_ENV: 'production',
      TZ: 'Europe/London',
      // Everything else is set in server/.env, NOT here. Values pinned in this
      // block land in process.env before the app starts, and dotenv never
      // overwrites an existing variable — which would make .env silently
      // powerless. Same lesson as lending-stream-dsar-form's ecosystem file.
      //
      // Notifications are OFF unless ENQUIRY_NOTIFY_ENABLED=true in .env.
      // Enquiries are captured either way.
    },
  }],
};
