#!/bin/bash
# Setup complet accès à distance ESP32 Green House
# Exécuter depuis la racine du projet

echo "🌱 Configuration accès à distance ESP32 Green House"
echo "==============================================="

# 1. Test de l'interface MQTT à distance (déjà fonctionnelle)
echo "📡 1. Test interface MQTT..."
if curl -s -I http://192.168.178.21:3000/remote.html | grep -q "200 OK"; then
    echo "✅ Interface MQTT fonctionnelle : http://192.168.178.21:3000/remote.html"
else
    echo "❌ Interface MQTT non accessible"
fi

# 2. Setup ngrok (tunnel temporaire)
echo "🌐 2. Configuration ngrok..."
if command -v ngrok >/dev/null 2>&1; then
    echo "✅ ngrok déjà installé"
else
    echo "📦 Installation ngrok..."
    brew install ngrok
fi

# 3. Démarrage tunnel ngrok en arrière-plan
echo "🔄 Démarrage tunnel ngrok..."
ngrok http 3000 --log=stdout > ngrok.log 2>&1 &
NGROK_PID=$!
sleep 5

# Récupération de l'URL publique ngrok
NGROK_URL=$(curl -s localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | cut -d'"' -f4 | head -1)
if [ ! -z "$NGROK_URL" ]; then
    echo "✅ Tunnel ngrok actif : $NGROK_URL"
    echo "📱 Accès iPhone depuis la rue : $NGROK_URL/remote.html"
else
    echo "⚠️ Tunnel ngrok en cours de démarrage..."
    echo "📄 Vérifiez ngrok.log pour l'URL publique"
fi

# 4. Instructions finales
echo ""
echo "📋 RÉSUMÉ - Accès depuis la rue :"
echo "================================="
echo "🟢 MQTT (recommandé)     : Copier remote.html sur un hébergement web"
echo "🟡 Ngrok (temporaire)    : $NGROK_URL/remote.html" 
echo "🔵 Cloudflare (permanent) : Exécuter setup_cloudflare_tunnel.sh"
echo ""
echo "💡 L'ESP32 communique via MQTT depuis n'importe quelle interface !"
echo "🔗 Interface MQTT locale : http://192.168.178.21:3000/remote.html"

# Sauvegarde des infos
cat > remote_access_info.txt << EOF
🌱 Green House - Accès à Distance
===============================

Interface MQTT (fonctionne partout) :
- Local : http://192.168.178.21:3000/remote.html
- À copier sur un hébergement web pour accès externe

Tunnel ngrok (temporaire) :
- URL : $NGROK_URL
- Interface : $NGROK_URL/remote.html
- PID : $NGROK_PID

Commandes utiles :
- Arrêter ngrok : kill $NGROK_PID
- Relancer ngrok : ngrok http 3000
- Logs ngrok : tail -f ngrok.log

ESP32 Topics MQTT :
- Status : esp32/status  
- Contrôle : esp32/relay/{1-6}/command
- Broker : broker.hivemq.com:8884 (WebSocket)
EOF

echo "📄 Informations sauvées : remote_access_info.txt"