/**
 * Servidor de Webhook para auto-despliegue
 * Escucha webhooks de GitHub y ejecuta el script de actualización
 * 
 * Instalación en tu servidor:
 * 1. npm install express crypto
 * 2. node webhook-server.js
 * 3. Configura el webhook en GitHub: https://github.com/TU_USUARIO/TU_REPO/settings/hooks
 *    - URL: http://TU_IP:9000/webhook
 *    - Content type: application/json
 *    - Secret: tu-secreto-super-seguro
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const app = express();

const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'tu-secreto-super-seguro';

app.use(express.json());

// Verificar firma de GitHub
function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) return false;
    
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

app.post('/webhook', (req, res) => {
    console.log('📨 Webhook recibido');
    
    // Verificar firma
    if (!verifySignature(req)) {
        console.error('❌ Firma inválida');
        return res.status(401).send('Unauthorized');
    }
    
    // Verificar que es un push a main
    if (req.body.ref !== 'refs/heads/main') {
        console.log('⏭️  Push no es a main, ignorando');
        return res.status(200).send('OK - Not main branch');
    }
    
    console.log('✅ Firma válida, ejecutando actualización...');
    
    // Ejecutar script de actualización
    exec('bash /opt/scripts/update-mikrotik-dashboard.sh', (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Error ejecutando script:', error);
            return res.status(500).send('Error');
        }
        
        console.log('📋 Output:', stdout);
        if (stderr) console.error('⚠️  Stderr:', stderr);
        
        console.log('✅ Actualización completada');
    });
    
    res.status(200).send('Deployment started');
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`🎣 Webhook server escuchando en puerto ${PORT}`);
    console.log(`📝 Endpoint: http://localhost:${PORT}/webhook`);
});
