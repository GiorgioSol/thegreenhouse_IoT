#!/bin/bash
# Configuration ngrok pour accès distant ESP32
# Solution rapide et simple

# 1. Installer ngrok
echo "📦 Installation de ngrok..."
brew install ngrok

# 2. Créer un compte gratuit sur https://ngrok.com et obtenir votre token
echo "🔑 Configurez votre token ngrok:"
echo "ngrok authtoken VOTRE_TOKEN_ICI"

# 3. Exposer l'interface Next.js
echo "🌐 Exposition de l'interface Next.js..."
ngrok http 3000 --log=stdout > ngrok.log 2>&1 &

# 4. Exposer l'ESP32 directement (optionnel)
echo "🔌 Exposition de l'ESP32..."
ngrok http 192.168.178.46 --log=stdout > ngrok_esp32.log 2>&1 &

echo "✅ Tunnels démarrés !"
echo "📱 Vérifiez vos URLs sur: http://localhost:4040"
echo "📋 Ou dans les logs: tail -f ngrok.log"