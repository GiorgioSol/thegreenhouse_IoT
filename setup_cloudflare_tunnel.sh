#!/bin/bash
# Script pour configurer CloudFlare Tunnel
# À exécuter sur un ordinateur de votre réseau domestique

# 1. Installer cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# 2. Authentification avec CloudFlare
cloudflared tunnel login

# 3. Créer le tunnel
cloudflared tunnel create esp32-tunnel

# 4. Configurer le tunnel pour pointer vers votre ESP32
cat > ~/.cloudflared/config.yml << EOF
tunnel: esp32-tunnel
credentials-file: /home/$USER/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Interface ESP32
  - hostname: esp32-home.your-domain.com
    service: http://192.168.178.46
  # Interface Next.js
  - hostname: dashboard-home.your-domain.com  
    service: http://192.168.178.21:3000
  - service: http_status:404
EOF

# 5. Démarrer le tunnel
cloudflared tunnel run esp32-tunnel