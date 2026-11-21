module.exports = {
  apps: [
    {
      name: 'plaquinhas',
      script: 'server.js',
      cwd: __dirname,
      // Sessoes ficam no MySQL, entao daria para usar cluster/multiplas instancias.
      // Com 1 instancia + fork o consumo de memoria e menor para uma VPS pequena.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true
    }
  ]
};
