export default function SimplePage() {
  return (
    <html>
      <head>
        <title>Test Green House</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>🌱 Green House Control - Test Simple</h1>
        <div style={{ backgroundColor: '#e8f5e8', padding: '15px', borderRadius: '5px' }}>
          <p>✅ <strong>Serveur Next.js fonctionne !</strong></p>
          <p>📱 <strong>Accès réseau : OK</strong></p>
          <p>🌐 <strong>Prêt pour iPhone</strong></p>
        </div>
        
        <h2>Instructions iPhone :</h2>
        <ol style={{ lineHeight: '1.6' }}>
          <li><strong>Ouvrir Safari</strong> sur votre iPhone</li>
          <li><strong>Taper EXACTEMENT :</strong><br />
              <code style={{ backgroundColor: '#f0f0f0', padding: '5px' }}>
                http://192.168.178.21:3000/simple
              </code>
          </li>
          <li><strong>Si Safari dit "pas sécurisé" :</strong>
              <ul>
                <li>Ignorer l'avertissement</li>
                <li>Ou installer Chrome sur iPhone</li>
              </ul>
          </li>
          <li><strong>Pour installer la PWA :</strong>
              <ul>
                <li>Appuyer sur "Partager" 📤</li>
                <li>Choisir "Ajouter à l'écran d'accueil"</li>
              </ul>
          </li>
        </ol>

        <button 
          onClick={() => alert('🎉 PWA fonctionne !')}
          style={{
            padding: '15px 25px',
            fontSize: '18px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          Tester PWA
        </button>
      </body>
    </html>
  );
}