# 🚀 Guía de Despliegue Automático - MikroTik Dashboard

## 📋 Opciones de Despliegue

### ✅ **Opción 1: GitHub Actions + SSH (Recomendada)**

**Ventajas:**
- ✅ Totalmente automático
- ✅ No requiere servidor webhook adicional
- ✅ Gratuito en GitHub
- ✅ Incluye CI/CD completo

**Configuración:**

1. **En tu servidor (VPS, Droplet, etc.):**

```bash
# Instalar Node.js y PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# Clonar el repositorio
cd /opt
sudo git clone https://github.com/TU_USUARIO/TU_REPO.git
cd TU_REPO
npm install

# Iniciar con PM2
pm2 start server.js --name mikrotik-dashboard
pm2 save
pm2 startup
```

2. **Configurar SSH en GitHub:**

```bash
# En tu computadora local, generar clave SSH si no tienes
ssh-keygen -t ed25519 -C "deploy@github"

# Copiar la clave pública al servidor
ssh-copy-id usuario@tu-servidor.com

# Copiar la clave PRIVADA (completa)
cat ~/.ssh/id_ed25519
```

3. **En GitHub > Settings > Secrets and variables > Actions:**

Agregar estos secrets:
- `SERVER_HOST`: La IP o dominio de tu servidor (ej: `123.45.67.89`)
- `SERVER_USER`: Usuario SSH (ej: `root` o `ubuntu`)
- `SSH_PRIVATE_KEY`: La clave privada COMPLETA (desde `-----BEGIN` hasta `-----END`)
- `SERVER_PORT`: Puerto SSH (opcional, por defecto 22)

4. **Editar el archivo `.github/workflows/deploy.yml`:**

Cambia esta línea:
```yaml
cd /ruta/a/tu/aplicacion
```

Por la ruta real:
```yaml
cd /opt/TU_REPO
```

5. **¡Listo! Ahora cada vez que hagas push a main:**

```bash
git add .
git commit -m "Mi cambio"
git push origin main
# 🚀 Se desplegará automáticamente
```

---

### 🐳 **Opción 2: GitHub Actions + Docker**

**Ventajas:**
- ✅ Aislamiento total
- ✅ Fácil de escalar
- ✅ Portable

**Configuración:**

1. **En tu servidor:**

```bash
# Instalar Docker y Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt-get install docker-compose-plugin

# Clonar repo
cd /opt
git clone https://github.com/TU_USUARIO/TU_REPO.git
cd TU_REPO

# Iniciar con Docker Compose
docker compose up -d
```

2. **Configurar secrets en GitHub** (igual que Opción 1)

3. **Editar `.github/workflows/docker-deploy.yml`** con tu ruta

4. **Push y listo:**

```bash
git push origin main
# 🐳 Se construye la imagen y se despliega
```

---

### 🎣 **Opción 3: Webhook Server (Simple)**

**Ventajas:**
- ✅ Control total
- ✅ Más simple
- ✅ Sin dependencias externas

**Configuración:**

1. **En tu servidor:**

```bash
# Dar permisos de ejecución al script
chmod +x /opt/TU_REPO/scripts/update.sh

# Editar el script y cambiar la ruta
nano /opt/TU_REPO/scripts/update.sh
# Cambiar: APP_DIR="/ruta/a/tu/aplicacion"
# Por: APP_DIR="/opt/TU_REPO"

# Mover el script a una ubicación segura
sudo mkdir -p /opt/scripts
sudo cp /opt/TU_REPO/scripts/update.sh /opt/scripts/update-mikrotik-dashboard.sh
sudo chmod +x /opt/scripts/update-mikrotik-dashboard.sh

# Iniciar el webhook server
cd /opt/TU_REPO/scripts
pm2 start webhook-server.js --name webhook-server
pm2 save
```

2. **En GitHub > Settings > Webhooks > Add webhook:**

- **Payload URL:** `http://TU_IP:9000/webhook`
- **Content type:** `application/json`
- **Secret:** `tu-secreto-super-seguro` (el mismo del código)
- **Events:** Just the push event

3. **Configurar firewall (si es necesario):**

```bash
sudo ufw allow 9000/tcp
```

4. **¡Listo! Prueba:**

```bash
git push origin main
# El webhook se activará automáticamente
```

---

## 🔒 Seguridad

### Para todas las opciones:

1. **Usar variables de entorno:**

```bash
# En tu servidor, crear archivo .env
nano /opt/TU_REPO/.env
```

Agregar:
```env
MIKROTIK_HOST=181.116.241.192
MIKROTIK_USER=monitor
MIKROTIK_PASS=Pirineos25*
MIKROTIK_PORT=8728
PORT=3000
```

2. **Configurar firewall:**

```bash
# Solo permitir puertos necesarios
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # Aplicación
sudo ufw enable
```

3. **Usar HTTPS con nginx (recomendado):**

```bash
sudo apt install nginx certbot python3-certbot-nginx

# Configurar nginx como proxy reverso
sudo nano /etc/nginx/sites-available/mikrotik-dashboard
```

Agregar:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mikrotik-dashboard /etc/nginx/sites-enabled/
sudo certbot --nginx -d tu-dominio.com
sudo systemctl restart nginx
```

---

## 📊 Monitoreo

Ver logs de despliegue:

```bash
# Logs de PM2
pm2 logs mikrotik-dashboard

# Logs de webhook (Opción 3)
tail -f /var/log/mikrotik-dashboard-deploy.log

# Logs de GitHub Actions
# Ve a: https://github.com/TU_USUARIO/TU_REPO/actions
```

---

## 🆘 Troubleshooting

### El despliegue falla en GitHub Actions:

```bash
# Verificar que el servidor sea accesible
ssh usuario@tu-servidor.com

# Verificar que PM2 esté corriendo
pm2 status

# Ver logs
pm2 logs
```

### El webhook no funciona:

```bash
# Verificar que el servidor esté escuchando
curl http://localhost:9000/health

# Ver logs del webhook server
pm2 logs webhook-server

# Verificar configuración en GitHub
# Settings > Webhooks > Recent Deliveries
```

### La aplicación no inicia:

```bash
# Ver errores
pm2 logs mikrotik-dashboard --err

# Verificar dependencias
cd /opt/TU_REPO
npm install

# Reiniciar
pm2 restart mikrotik-dashboard
```

---

## 📝 Workflow Recomendado

```bash
# 1. Hacer cambios localmente
git checkout -b mi-feature
# ... hacer cambios ...
git add .
git commit -m "feat: nueva funcionalidad"

# 2. Probar localmente
npm start

# 3. Push a GitHub
git push origin mi-feature

# 4. Crear Pull Request en GitHub
# Review y merge a main

# 5. ¡Se despliega automáticamente! 🚀
```

---

## 🎯 Siguiente Paso

**Elige la opción que prefieras y sigue los pasos.** 

Mi recomendación: **Opción 1 (GitHub Actions + SSH)** por ser la más profesional y completa.

¿Necesitas ayuda con alguna configuración específica?
