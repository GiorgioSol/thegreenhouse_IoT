const { spawn } = require('child_process');

// Démarrer Next.js avec binding sur toutes les interfaces
const nextProcess = spawn('npm', ['run', 'dev'], {
  env: { 
    ...process.env, 
    HOSTNAME: '0.0.0.0',
    PORT: '3000'
  },
  stdio: 'inherit'
});

nextProcess.on('close', (code) => {
  console.log(`Serveur Next.js fermé avec le code ${code}`);
});

console.log('🚀 Serveur Next.js démarré sur http://0.0.0.0:3000');
console.log('📱 Accès iPhone: http://192.168.178.21:3000');
