/**
 * PM2 ecosystem config for Kartawarta production.
 *
 * Default: single fork mode (current production setup).
 * To enable cluster mode (multi-core), set CLUSTER=1 env or pass --instances 2.
 *
 * Usage on VPS:
 *   pm2 start ecosystem.config.js                  # single fork
 *   CLUSTER=1 pm2 start ecosystem.config.js        # cluster, all CPU cores
 *   pm2 reload ecosystem.config.js                 # zero-downtime reload
 *
 * Note: Switching to cluster mode means in-memory state (rate-limit Map,
 * Sentry instance, AI client cache) is per-worker. Plan accordingly:
 * for global rate-limit, switch src/lib/rate-limit.ts to Redis-backed.
 */

const isCluster = process.env.CLUSTER === "1" || process.env.CLUSTER === "true";

module.exports = {
  apps: [
    {
      name: "kartawarta",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      cwd: "/var/www/kartawarta",
      exec_mode: isCluster ? "cluster" : "fork",
      instances: isCluster ? "max" : 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      // Logs
      out_file: "/root/.pm2/logs/kartawarta-out.log",
      error_file: "/root/.pm2/logs/kartawarta-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Graceful shutdown
      kill_timeout: 10000,
      // Restart policy: max 10 restarts in 10 minutes, then stop
      max_restarts: 10,
      min_uptime: "60s",
    },
    {
      // YouTube auto-clip worker — separate process (heavy yt-dlp + ffmpeg +
      // Deepgram). Requires ffmpeg + yt-dlp installed on the VPS and env:
      // DATABASE_URL, DEEPGRAM_API_KEY, CRON_SECRET, APP_URL.
      name: "kartawarta-youtube-worker",
      script: "tools/youtube-clip-worker.mjs",
      cwd: "/var/www/kartawarta",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1500M",
      env: {
        NODE_ENV: "production",
        APP_URL: "http://127.0.0.1:3000",
      },
      out_file: "/root/.pm2/logs/kartawarta-youtube-worker-out.log",
      error_file: "/root/.pm2/logs/kartawarta-youtube-worker-error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      kill_timeout: 15000,
      max_restarts: 10,
      min_uptime: "60s",
    },
  ],
};
