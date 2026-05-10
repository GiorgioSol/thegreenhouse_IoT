# ESP32 Remote Monitor

Une application web moderne pour surveiller et contrôler votre ESP32 Relay Controller à distance.

## 🚀 Fonctionnalités

- **Dashboard temps réel** : Surveillance des 6 canaux de relais
- **Contrôle à distance** : Changement d'état (OFF/AUTO/ON) depuis n'importe où
- **Configuration horaires** : Modification de la programmation AUTO
- **Monitoring système** : Température, mémoire, Wi-Fi, temps de fonctionnement
- **Interface responsive** : Compatible mobile et desktop
- **Accès sécurisé** : Connexion locale et tunnel distant

## 📋 Prérequis

- Node.js 18+ et npm
- ESP32 avec le firmware de contrôle de relais
- Réseau Wi-Fi pour la connexion locale

## 🛠 Installation

1. **Cloner et installer les dépendances :**
   ```bash
   cd ESP32_Remote_Monitor
   npm install
   ```

2. **Configuration de l'environnement :**
   ```bash
   # Copier le fichier d'environnement
   cp .env.local.example .env.local
   
   # Éditer .env.local avec vos paramètres
   nano .env.local
   ```

3. **Variables d'environnement importantes :**
   ```env
   # IP locale de votre ESP32
   ESP32_URL=http://192.168.1.100:80
   
   # Pour l'accès distant (optionnel)
   NGROK_TOKEN=your_ngrok_token_here
   TUNNEL_URL=https://your-tunnel-url.ngrok.io
   ```

## 🏃‍♂️ Utilisation

### Développement local
```bash
npm run dev
```
L'application sera accessible sur `http://localhost:3000`

### Production
```bash
npm run build
npm start
```

## 🌐 Accès depuis l'extérieur

### Option 1: Redirection de port (Recommandée)
1. Configurez votre box Internet pour rediriger le port 3000 vers votre ordinateur
2. Utilisez votre IP publique : `http://votre-ip-publique:3000`

### Option 2: Tunnel Ngrok
1. Installez ngrok : `npm install -g ngrok`
2. Obtenez un token sur [ngrok.com](https://ngrok.com)
3. Configurez le token : `ngrok authtoken YOUR_TOKEN`
4. Lancez le tunnel : `ngrok http 3000`
5. Utilisez l'URL fournie par ngrok

### Option 3: Service cloud (Avancé)
Déployez l'application sur Netlify, ou Heroku pour un accès permanent.

## 🔧 Configuration ESP32

Assurez-vous que votre ESP32 dispose des endpoints suivants :

- `GET /` : Page principale (HTML)
- `GET /status` : Statut des relais (JSON recommandé)
- `GET /setChannel?ch=X&state=Y` : Contrôle des canaux
- `POST /config` : Configuration des horaires

### Amélioration recommandée du firmware ESP32

Ajoutez cet endpoint JSON à votre ESP32 pour une meilleure intégration :

```cpp
server.on("/api/status", []() {
  String json = "{";
  json += "\"channels\":[";
  for (int i = 0; i < 6; i++) {
    if (i > 0) json += ",";
    json += "{";
    json += "\"id\":" + String(i) + ",";
    json += "\"state\":" + String(channelStates[i]) + ",";
    json += "\"active\":" + String(digitalRead(relayPins[i]) == LOW ? "true" : "false");
    json += "}";
  }
  json += "],";
  json += "\"time\":\"" + String(timeinfo.tm_hour) + ":" + String(timeinfo.tm_min) + "\",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"heap\":" + String(ESP.getFreeHeap());
  json += "}";
  
  server.send(200, "application/json", json);
});
```

## 📱 Utilisation de l'interface

### Dashboard
- **Boutons colorés** : OFF (rouge), AUTO (orange), ON (vert)
- **Indicateurs en temps réel** : État actuel des relais
- **Informations temporelles** : Heure actuelle et période AUTO

### Configuration horaires
- **Heure début/fin** : Définit la plage AUTO
- **Traverse minuit** : Support des horaires 22:00 → 08:00
- **Exemples prédéfinis** : Configurations courantes

### Monitoring système
- **Performances** : CPU, mémoire, température
- **Réseau** : Wi-Fi, IP, signal
- **Actions** : Redémarrage, export de données

## 🔒 Sécurité

### Réseau local
- L'application communique directement avec l'ESP32 sur le réseau local
- Aucune donnée n'est envoyée vers des serveurs externes

### Accès distant
- Utilisez un VPN pour un accès sécurisé
- Configurez un mot de passe sur votre ESP32
- Limitez l'accès par filtrage IP si possible

## 🛠 Développement

### Structure du projet
```
ESP32_Remote_Monitor/
├── app/
│   ├── components/         # Composants React
│   ├── services/          # Services API
│   ├── types/             # Types TypeScript
│   ├── globals.css        # Styles globaux
│   ├── layout.tsx         # Layout principal
│   └── page.tsx           # Page d'accueil
├── public/                # Ressources statiques
└── ...                    # Configuration Next.js
```

### Personnalisation
- **Couleurs** : Modifiez `tailwind.config.js`
- **Composants** : Ajoutez vos propres composants dans `app/components/`
- **API** : Étendez `ESP32Service.ts` pour de nouvelles fonctionnalités

## 📈 Fonctionnalités futures

- [ ] Graphiques historiques des activations
- [ ] Notifications push
- [ ] API REST complète
- [ ] Mode sombre
- [ ] Multi-utilisateurs avec authentification
- [ ] Sauvegarde cloud des configurations

## 🐛 Dépannage

### Impossible de se connecter à l'ESP32
1. Vérifiez l'IP dans `.env.local`
2. Testez la connexion : `ping 192.168.1.100`
3. Vérifiez que l'ESP32 est allumé et connecté au Wi-Fi

### Interface lente ou erreurs
1. Vérifiez la qualité du signal Wi-Fi
2. Réduisez la fréquence de polling dans `page.tsx`
3. Consultez la console du navigateur pour les erreurs

### Accès distant ne fonctionne pas
1. Vérifiez la redirection de port de votre box
2. Testez avec ngrok en local d'abord
3. Vérifiez les paramètres du firewall

## 📞 Support

Pour toute question ou problème :
1. Vérifiez d'abord la section dépannage
2. Consultez les logs de l'ESP32 via le moniteur série
3. Vérifiez la console du navigateur pour les erreurs JavaScript

## 📄 Licence

Ce projet est libre d'utilisation pour un usage personnel et éducatif.