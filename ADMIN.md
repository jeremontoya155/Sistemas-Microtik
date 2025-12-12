# 🎛️ Panel de Administración MikroTik

## 📋 Descripción

Panel de administración completo para gestionar tu router MikroTik desde una interfaz web moderna y fácil de usar.

## 🚀 Acceso

Una vez que el servidor esté corriendo, accede a:

- **Dashboard Principal**: `http://localhost:3000/`
- **Panel de Administración**: `http://localhost:3000/admin`

## ✨ Funcionalidades Implementadas

### 🔥 Firewall
- ✅ Ver todas las reglas de firewall
- ✅ Agregar nuevas reglas
- ✅ Habilitar/Deshabilitar reglas
- ✅ Eliminar reglas
- ✅ Filtrar por chain (input, forward, output)
- ✅ Configurar protocolos (TCP, UDP, ICMP)
- ✅ Definir IPs origen y destino
- ✅ Especificar puertos

### 🔄 NAT (Network Address Translation)
- ✅ Ver reglas NAT existentes
- ✅ Port Forwarding (DSTNAT)
- ✅ Masquerade (SRCNAT)
- ✅ Configurar redirección de puertos
- ⏳ Agregar nuevas reglas NAT (en desarrollo)

### 📊 Control de Ancho de Banda (Queue)
- ✅ Ver colas configuradas
- ⏳ Crear nuevas colas simples
- ⏳ Limitar velocidad por IP o red
- ⏳ Configurar prioridades
- ⏳ Límites de descarga y subida

### 🌐 DHCP Server
- ⏳ Ver leases activos
- ⏳ Crear reservas DHCP (IPs estáticas)
- ⏳ Gestionar configuración del servidor DHCP

### 🗺️ Rutas (Routing)
- ⏳ Ver tabla de rutas
- ⏳ Agregar rutas estáticas
- ⏳ Configurar gateways
- ⏳ Establecer métricas

### 👥 Usuarios del Sistema
- ⏳ Listar usuarios
- ⏳ Crear nuevos usuarios
- ⏳ Asignar permisos (full, read, write)
- ⏳ Eliminar usuarios

### ⏰ Tareas Programadas (Scheduler)
- ⏳ Ver tareas programadas
- ⏳ Crear nuevas tareas
- ⏳ Programar backups automáticos
- ⏳ Ejecutar scripts personalizados

### 💾 Backup & Restore
- ⏳ Crear backups de configuración
- ⏳ Exportar configuración (.rsc)
- ⏳ Listar backups disponibles
- ⏳ Restaurar backups
- ⏳ Reiniciar router
- ⏳ Reset de fábrica

**Leyenda:**
- ✅ = Implementado y funcional
- ⏳ = Planificado (estructura lista, implementación pendiente)

## 🔧 Uso

### Firewall - Agregar Regla

**Ejemplo 1: Bloquear puerto 23 (Telnet)**

```
Chain: INPUT
Acción: DROP
Protocolo: TCP
Puerto Destino: 23
Comentario: Bloquear Telnet
```

**Ejemplo 2: Permitir SSH solo desde red local**

```
Chain: INPUT
Acción: ACCEPT
Protocolo: TCP
IP Origen: 192.168.1.0/24
Puerto Destino: 22
Comentario: SSH solo red local
```

**Ejemplo 3: Bloquear una IP específica**

```
Chain: FORWARD
Acción: DROP
IP Origen: 1.2.3.4
Comentario: Bloquear IP sospechosa
```

### NAT - Port Forwarding

**Ejemplo: Servidor web interno**

```
Tipo: DSTNAT
Acción: DST-NAT
Protocolo: TCP
Puerto Externo: 80
IP Interna: 192.168.1.100
Puerto Interno: 80
Comentario: Servidor web
```

### Control de Ancho de Banda

**Ejemplo: Limitar velocidad de un dispositivo**

```
Nombre: Cliente-Oficina
IP/Red: 192.168.1.50/32
Límite Download: 10M
Límite Upload: 5M
Prioridad: 5
Comentario: Computadora de oficina
```

## 🔒 Seguridad

### Recomendaciones:

1. **Cambia las credenciales por defecto** del MikroTik
2. **Usa HTTPS** en producción (configura nginx con SSL)
3. **Limita el acceso** al panel de administración por IP
4. **Haz backups regulares** antes de hacer cambios importantes
5. **Prueba las reglas** en un entorno de prueba primero

### Restricción por IP (opcional)

Para permitir solo ciertas IPs al panel de admin, agrega en `routes.js`:

```javascript
// Middleware de autenticación
const adminAuth = (req, res, next) => {
    const allowedIPs = ['192.168.1.10', '192.168.1.20'];
    const clientIP = req.ip;
    
    if (allowedIPs.includes(clientIP)) {
        next();
    } else {
        res.status(403).send('Acceso denegado');
    }
};

app.get('/admin', adminAuth, (req, res) => {
    // ... código existente
});
```

## 📚 API Endpoints

### Firewall

- `GET /api/admin/firewall/rules` - Obtener todas las reglas
- `POST /api/admin/firewall/add` - Agregar nueva regla
- `POST /api/admin/firewall/toggle` - Habilitar/Deshabilitar
- `POST /api/admin/firewall/delete` - Eliminar regla

### NAT

- `GET /api/admin/nat/rules` - Obtener reglas NAT
- `POST /api/admin/nat/add` - Agregar regla NAT (pendiente)

### Queue

- `GET /api/admin/queue/simple` - Obtener colas
- `POST /api/admin/queue/add` - Agregar cola (pendiente)

### General

- `GET /api/interfaces` - Obtener todas las interfaces

## 🎨 Personalización

### Cambiar colores

Edita `public/css/admin.css` y modifica las variables CSS:

```css
:root {
    --bg-primary: #1a1d29;
    --bg-secondary: #24273a;
    --accent: #5b9bd5;
    --success: #4caf50;
    --warning: #ff9800;
    --danger: #f44336;
}
```

## 🐛 Troubleshooting

### Las reglas no se cargan

1. Verifica que estés conectado al MikroTik
2. Revisa la consola del navegador (F12) para errores
3. Verifica que el usuario tenga permisos suficientes

### Error al agregar regla

1. Verifica que todos los campos requeridos estén completos
2. Asegúrate de que las IPs tengan formato correcto
3. Revisa los logs del servidor: `pm2 logs mikrotik-dashboard`

## 🚧 Próximas Funcionalidades

- [ ] Implementación completa de todas las pestañas
- [ ] Autenticación de usuarios (login/logout)
- [ ] Historial de cambios (audit log)
- [ ] Modo oscuro/claro
- [ ] Export/Import de configuraciones
- [ ] Dashboard de estadísticas avanzadas
- [ ] Alertas y notificaciones
- [ ] API REST completa
- [ ] Soporte multi-router

## 💡 Contribuir

Si quieres agregar más funcionalidades:

1. Las vistas están en `views/admin.ejs`
2. Los estilos en `public/css/admin.css`
3. El JavaScript del cliente en `public/js/admin.js`
4. Las rutas API en `routes.js`
5. La lógica del controlador en `controller.js`

## 📝 Notas

- Todas las operaciones se realizan directamente en el router MikroTik
- Los cambios son inmediatos y permanentes
- **Siempre haz un backup antes de hacer cambios importantes**
- En caso de error, puedes restaurar desde el backup

## 🆘 Soporte

Si encuentras algún problema o tienes sugerencias:

1. Revisa los logs: `pm2 logs`
2. Verifica la conexión al MikroTik
3. Consulta la documentación de MikroTik API

---

**¡Disfruta administrando tu red con facilidad!** 🚀
