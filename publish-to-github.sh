#!/bin/bash

# 🚀 Script de Publication GitHub - The Green House IoT System
# ========================================================

echo "🌱 Publication du projet The Green House sur GitHub"
echo ""

# Vérification que nous sommes dans le bon dossier
if [ ! -f "README.md" ] || [ ! -d ".git" ]; then
    echo "❌ Erreur: Exécutez ce script depuis le dossier 'The Green House'"
    exit 1
fi

# Demander le nom d'utilisateur GitHub
echo "📝 Entrez votre nom d'utilisateur GitHub :"
read -p "Username: " github_username

if [ -z "$github_username" ]; then
    echo "❌ Nom d'utilisateur GitHub requis"
    exit 1
fi

# URL du repository
repo_url="https://github.com/$github_username/thegreenhouse_IoT.git"

echo ""
echo "🔗 Repository cible: $repo_url"
echo ""

# Vérifier si remote origin existe déjà
if git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  Remote 'origin' existe déjà. Suppression..."
    git remote remove origin
fi

# Ajouter le remote GitHub
echo "🌐 Connexion au repository GitHub..."
git remote add origin "$repo_url"

# Pousser le code
echo "📤 Publication du code sur GitHub..."
git branch -M main
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Votre projet est maintenant publié sur GitHub!"
    echo ""
    echo "🌐 URL de votre repository: https://github.com/$github_username/thegreenhouse_IoT"
    echo ""
    echo "📋 Projet prêt pour votre CV Dassault Systèmes! 🎯"
    echo ""
    echo "🔍 Caractéristiques mises en avant:"
    echo "   ✓ ESP32-S3 IoT Controller"
    echo "   ✓ RS485 Modbus Energy Monitoring"  
    echo "   ✓ MQTT Real-time Communication"
    echo "   ✓ Progressive Web App (PWA)"
    echo "   ✓ Industrial IoT Architecture"
else
    echo ""
    echo "❌ ERREUR lors de la publication!"
    echo ""
    echo "🛠️  Solutions possibles:"
    echo "   1. Vérifiez que le repository GitHub existe"
    echo "   2. Vérifiez vos identifiants GitHub"
    echo "   3. Assurez-vous d'avoir les droits d'écriture"
    echo ""
    echo "📞 Repository à créer sur GitHub:"
    echo "   Nom: thegreenhouse_IoT"
    echo "   Description: 🌱 Complete IoT Green House System - ESP32 MQTT PWA with RS485 Energy Monitoring"
    echo "   Visibilité: Public"
fi