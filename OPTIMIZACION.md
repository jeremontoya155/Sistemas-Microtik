# Optimización de Recursos del Sistema

## 📊 Resumen de Cambios

Se han optimizado los intervalos de actualización para reducir significativamente el consumo de recursos del servidor.

## 🔧 Cambios Implementados

### 1. **Servidor (controller.js)**

#### Antes (Original):
- Tráfico: cada 1 segundo
- Recursos (CPU/RAM): cada 2 segundos  
- Interfaces: cada 10 segundos
- Dispositivos: cada 15 segundos
- Logs: cada 5 segundos
- WANs: cada 10 segundos
- Cámaras: cada 20 segundos
- Multi-router: cada 60 segundos

#### Después (Ultra-Optimizado para Mínimo Consumo CPU):
- Tráfico: cada **15 segundos** (↓ 93% de carga)
- Recursos (CPU/RAM): cada **30 segundos** (↓ 93% de carga)
- Interfaces: cada **60 segundos / 1 min** (↓ 83% de carga)
- Dispositivos: cada **90 segundos / 1.5 min** (↓ 83% de carga)
- Logs: cada **45 segundos** (↓ 89% de carga)
- WANs: cada **60 segundos / 1 min** (↓ 83% de carga)
- Cámaras: cada **120 segundos / 2 min** (↓ 83% de carga)
- Multi-router: cada **180 segundos / 3 min** (↓ 67% de carga)

### 2. **Cliente - Multi Dashboard (multi-dashboard.js & multi-dashboard-clean.js)**

#### Antes (Original):
- Actualización completa: cada 10 segundos

#### Después (Ultra-Optimizado):
- Actualización completa: cada **90 segundos / 1.5 minutos** (↓ 89% de carga)

## 📈 Beneficios

### Reducción de Carga:
- **Consultas al MikroTik**: reducidas en ~85-93%
- **Procesamiento del servidor**: reducido en ~90%
- **Tráfico de red**: reducido en ~90%
- **Uso de CPU**: reducido drásticamente (ideal para servidores con recursos limitados)
- **Memoria**: uso muy estable y predecible

### Rendimiento:
✅ El dashboard sigue siendo totalmente funcional
✅ Los datos de tráfico se actualizan cada 15 segundos (suficiente para monitoreo)
✅ Los recursos (CPU/RAM) se actualizan cada 30 segundos
✅ Los datos menos críticos (cámaras, dispositivos) se actualizan cada 1.5-2 minutos
✅ El multi-dashboard actualiza cada 1.5 minutos (ideal para monitoreo pasivo de múltiples routers)
✅ **Perfecto para entornos con recursos limitados o múltiples routers**

## ⚙️ Personalización

Si necesitas ajustar los intervalos, puedes modificarlos en:

**Servidor (`controller.js` - líneas ~755-773):**
```javascript
this.intervals.traffic = setInterval(() => this.updateTraffic(), 15000);
this.intervals.resources = setInterval(() => this.updateResources(), 30000);
this.intervals.interfaces = setInterval(() => this.loadInterfaces(), 60000);
this.intervals.devices = setInterval(() => this.loadDevices(), 90000);
this.intervals.logs = setInterval(() => this.loadLogs(), 45000);
this.intervals.wans = setInterval(() => this.loadWANs(), 60000);
this.intervals.cameras = setInterval(() => this.loadCameras(), 120000);
// etc...
```

**Multi-Router (`controller.js` - línea ~107):**
```javascript
this.monitoringIntervalTime = 180000; // 3 minutos
```

**Cliente (`public/js/multi-dashboard.js` - línea ~19):**
```javascript
updateInterval = setInterval(loadAllRouters, 90000); // 1.5 minutos
```

## 🎯 Recomendaciones

### Configuración Actual (Ultra-Optimizada):
✅ **Ideal para**: Servidores con recursos limitados, múltiples routers, monitoreo pasivo
✅ **Consumo CPU**: Mínimo (~90% menos que original)
✅ **Tiempo de actualización**: 15 segundos - 3 minutos según tipo de dato

### Si necesitas MENOS consumo aún:
- Aumentar tráfico a 30 segundos
- Aumentar recursos a 60 segundos
- Aumentar multi-router a 300 segundos (5 minutos)

### Si necesitas MÁS velocidad (más CPU):
- Reducir tráfico a 5 segundos
- Reducir recursos a 10 segundos
- Reducir multi-dashboard a 30 segundos

## ⚡ Próximos Pasos Opcionales

1. **Lazy Loading**: Cargar datos solo cuando se visualiza una sección
2. **WebSocket Selectivo**: Emitir actualizaciones solo a clientes conectados
3. **Caché de Datos**: Cachear respuestas comunes por 10-30 segundos
4. **Paginación**: Limitar cantidad de datos enviados (ej: últimos 20 logs en vez de 30)

---

**Fecha de optimización**: 24 de diciembre de 2025
**Versión**: 2.0 (Optimizada)
