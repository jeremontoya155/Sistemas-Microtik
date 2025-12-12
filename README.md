# MikroTik Monitor Dashboard - Node.js Version

Sistema de monitoreo en tiempo real para routers MikroTik desarrollado con Node.js, Express, Socket.IO y EJS.

> 📖 **[Ver guía completa de despliegue automático →](DEPLOYMENT.md)**  
> ⚙️ **[Panel de Administración →](ADMIN.md)** - ¡NUEVO!

## 🚀 Características

- **Dashboard Ejecutivo**: Vista única optimizada para pantallas grandes (TVs, monitores)
- **Monitoreo en Tiempo Real**: Actualización automática vía WebSocket
- **WANs Monitoring**: Estado de todas las conexiones WAN con alertas
- **Recursos del Sistema**: CPU, memoria y disco en tiempo real
- **Interfaces de Red**: Estado de todas las interfaces
- **Dispositivos Conectados**: Lista de equipos con control de desconexión
- **Gráficos de Tráfico**: Visualización de RX/TX con Chart.js
- **Logs del Sistema**: Últimos 20 eventos con filtrado por tipo
- **Alertas Sonoras**: Notificaciones audibles para WANs caídas y eventos de seguridad

## 📋 Requisitos

- **Node.js**: v16 o superior
- **MikroTik Router**: Con API habilitada en el puerto 8728
- **Usuario API**: Credenciales con permisos de lectura y escritura

## 🔧 Instalación

1. **Clonar o descargar el proyecto**:
```bash
cd "c:\Users\jerem\Downloads\Microtik Real Node"
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:
   
   Editar el archivo `.env` con tus credenciales:

```env
MIKROTIK_HOST=181.116.241.192
MIKROTIK_USER=monitor
MIKROTIK_PASSWORD=Pirineos25*
MIKROTIK_PORT=8728
PORT=3000
NODE_ENV=development
```

## 🎯 Uso

### Modo Desarrollo (con auto-reload):
```bash
npm run dev
```

### Modo Producción:
```bash
npm start
```

La aplicación estará disponible en: **http://localhost:3000**

## 📁 Estructura del Proyecto

```
Microtik Real Node/
│
├── server.js              # Servidor principal Express + Socket.IO
├── controller.js          # Lógica de conexión y monitoreo de MikroTik
├── routes.js              # Definición de rutas API
├── package.json           # Dependencias y scripts
├── .env                   # Variables de entorno (NO subir a git)
│
├── views/
│   ├── index.ejs         # Dashboard principal
│   └── 404.ejs           # Página de error
│
├── public/
│   ├── css/
│   │   └── style.css     # Estilos del dashboard
│   └── js/
│       └── app.js        # JavaScript del cliente
│
└── README.md             # Este archivo
```

## 🌐 API Endpoints

### Conexión
- `POST /api/connect` - Conectar al router MikroTik
- `POST /api/disconnect` - Desconectar del router

### Datos en Tiempo Real
- `GET /api/status` - Estado de conexión
- `GET /api/traffic` - Datos de tráfico
- `GET /api/resources` - Uso de CPU/memoria
- `GET /api/devices` - Dispositivos conectados
- `GET /api/wans` - Estado de WANs

### Control
- `POST /api/device/disconnect` - Desconectar un dispositivo (body: `{mac: "XX:XX:XX:XX:XX:XX"}`)
- `POST /api/interface/toggle` - Habilitar/deshabilitar interfaz (body: `{interface: "ether1"}`)

### Health Check
- `GET /health` - Verificar estado del servidor

## 🔌 WebSocket Events

### Cliente → Servidor:
- `connect_mikrotik` - Solicitar conexión al router
- `disconnect_mikrotik` - Solicitar desconexión

### Servidor → Cliente:
- `connection_status` - Estado de conexión actualizado
- `wans_update` - Actualización de WANs
- `resources_update` - Actualización de recursos
- `interfaces_update` - Actualización de interfaces
- `devices_update` - Actualización de dispositivos
- `traffic_update` - Actualización de tráfico
- `logs_update` - Nuevos logs
- `wan_down_alert` - Alerta de WAN caída 🔊
- `security_alert` - Alerta de seguridad 🔊

## 🎨 Personalización

### Modificar intervalos de actualización

Editar `controller.js` en los métodos `startXXXUpdate()`:

```javascript
startTrafficUpdate() {
    this.intervals.traffic = setInterval(() => {
        this.updateTraffic();
    }, 1000); // Cambiar a 2000 para 2 segundos
}
```

### Cambiar colores del dashboard

Editar variables CSS en `public/css/style.css`:

```css
:root {
    --bg-primary: #1a1d29;
    --bg-secondary: #24273a;
    --accent: #5b9bd5;
    --success: #4caf50;
    --danger: #f44336;
}
```

## 🐛 Solución de Problemas

### Error: "Connection refused"
- Verificar que el router MikroTik tiene la API habilitada
- Confirmar el puerto 8728 está abierto
- Revisar credenciales en `.env`

### No se muestran datos en el dashboard
- Abrir la consola del navegador (F12) para ver errores
- Verificar conexión a Socket.IO en el navegador
- Revisar logs del servidor en la terminal

### Alertas de audio no suenan
- Algunos navegadores bloquean auto-reproducción de audio
- Interactuar con la página primero (click en cualquier lugar)

## 📦 Dependencias Principales

- **express**: 4.18.2 - Framework web
- **socket.io**: 4.6.1 - WebSocket en tiempo real
- **ejs**: 3.1.9 - Motor de plantillas
- **node-routeros**: 1.2.0 - Cliente API de MikroTik
- **dotenv**: 16.3.1 - Gestión de variables de entorno
- **nodemon**: 3.0.2 - Auto-reload en desarrollo

## 🔐 Seguridad

- **NO** subir el archivo `.env` a repositorios públicos
- Usar usuarios con permisos mínimos necesarios en MikroTik
- Considerar usar HTTPS en producción
- Implementar autenticación si se expone a internet

## 📝 Notas de Desarrollo

- La aplicación mantiene conexión persistente con el router
- Los datos se actualizan automáticamente según intervalos configurados
- Las alertas sonoras requieren interacción previa del usuario
- El dashboard está optimizado para pantallas de 1920x1080 o superiores

## 🆚 Diferencias con la Versión Python

- **Frontend más flexible**: EJS permite edición directa del HTML
- **Gestión simplificada**: npm scripts para desarrollo y producción
- **Hot-reload**: nodemon recarga automáticamente en desarrollo
- **WebSocket nativo**: Socket.IO más robusto que Flask-SocketIO
- **Ecosistema**: Más plugins y librerías disponibles en npm

## 📞 Soporte

Para problemas o preguntas:
1. Revisar los logs del servidor
2. Verificar la consola del navegador
3. Confirmar conectividad con el router MikroTik

## 📄 Licencia

Este proyecto es de uso interno. Todos los derechos reservados.

---

**Desarrollado con ❤️ usando Node.js + Express + Socket.IO**
