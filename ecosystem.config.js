// PM2 process file. Start with pm2-start.bat (or: pm2 start ecosystem.config.js).
module.exports = {
  apps: [
    {
      name: 'aph-pph-forms',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      max_memory_restart: '300M',
      time: true,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
    },
  ],
};
