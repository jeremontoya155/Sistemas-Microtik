#!/bin/bash

# Script para actualizar automáticamente la aplicación
# Guarda este archivo en tu servidor como: /opt/scripts/update-mikrotik-dashboard.sh

APP_DIR="/ruta/a/tu/aplicacion"
LOG_FILE="/var/log/mikrotik-dashboard-deploy.log"

echo "[$(date)] 🔄 Iniciando actualización..." >> $LOG_FILE

cd $APP_DIR || exit 1

# Pull los últimos cambios
echo "[$(date)] 📥 Descargando cambios de GitHub..." >> $LOG_FILE
git pull origin main >> $LOG_FILE 2>&1

# Instalar dependencias
echo "[$(date)] 📦 Instalando dependencias..." >> $LOG_FILE
npm install >> $LOG_FILE 2>&1

# Reiniciar la aplicación con PM2
echo "[$(date)] 🔄 Reiniciando aplicación..." >> $LOG_FILE
pm2 restart mikrotik-dashboard >> $LOG_FILE 2>&1

echo "[$(date)] ✅ Actualización completada" >> $LOG_FILE
echo "-----------------------------------" >> $LOG_FILE
