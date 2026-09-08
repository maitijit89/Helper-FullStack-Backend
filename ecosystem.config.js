module.exports = {
  apps: [
    {
      name: 'helper-backend',
      script: 'dist/server.js',
      instances: 'max', // Automatically spawns workers across all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G', // Automatic recycling if memory exceeds 1GB
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      exp_backoff_restart_delay: 100,
      listen_timeout: 10000,
      kill_timeout: 5000,
      time: true,
    },
  ],
};
