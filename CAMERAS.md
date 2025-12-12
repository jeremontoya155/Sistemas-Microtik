# 📹 Sistema de Detección de Cámaras IP

## 🎯 Características

La nueva pestaña de **Cámaras** en el panel de administración detecta automáticamente todas las cámaras IP conectadas a tu red MikroTik.

## 🔍 Métodos de Detección

### 1. **Detección por MAC Vendor**
Identifica cámaras por los primeros 6 dígitos del MAC address:
- **Hikvision**: `00:12:12`, `44:19:B6`, `BC:AD:28`, `28:57:BE`, `C0:56:E3`
- **Dahua**: `00:12:41`, `08:57:00`, `C4:2F:90`, `68:DF:DD`
- **Axis**: `00:40:8C`, `AC:CC:8E`, `B8:A4:4F`
- **TP-Link**: `50:C7:BF`, `A4:2B:B0`, `1C:3B:F3`
- **Xiaomi**: `34:CE:00`, `78:11:DC`
- **Reolink**: `EC:71:DB`
- Y más...

### 2. **Detección por Hostname**
Busca palabras clave en el nombre del dispositivo:
- `camera`, `cam`, `ipcam`, `cctv`
- Nombres de marcas: `hikvision`, `dahua`, `axis`, etc.
- `nvr`, `dvr`, `surveillance`, `vigilancia`

## 📊 Información Mostrada

Para cada cámara detectada se muestra:
- ✅ **Estado**: Online/Offline en tiempo real
- 🏷️ **Marca**: Detectada automáticamente
- 📍 **IP**: Dirección IP asignada
- 🔢 **MAC**: Dirección MAC completa
- 📝 **Hostname**: Nombre del dispositivo
- 🔒 **Tipo**: IP Estática o Dinámica
- 🔍 **Método**: Cómo fue detectada (MAC Vendor / Hostname)

## 🎛️ Funciones Disponibles

### Estadísticas Globales
- **Total de Cámaras**: Todas las cámaras detectadas
- **En Línea**: Cámaras actualmente conectadas
- **Desconectadas**: Cámaras offline

### Acciones por Cámara
- 🌐 **Abrir Web**: Abre la interfaz web de la cámara (puerto 80 por defecto)
- 📡 **Ping**: Verifica conectividad con la cámara

## 🔄 Actualización Automática

El sistema actualiza la lista de cámaras:
- **Cada 20 segundos** automáticamente
- **Actualización manual** con el botón 🔄 Actualizar
- **En tiempo real** vía WebSocket cuando hay cambios

## 🚀 Uso

1. Abre el **Panel de Administración** desde el dashboard
2. Haz clic en la pestaña **📹 Cámaras**
3. Las cámaras se cargan automáticamente
4. Haz clic en **🌐 Abrir Web** para acceder a la interfaz de cada cámara

## 📝 Notas Importantes

- Las cámaras deben estar conectadas a la red del MikroTik
- Deben tener una IP asignada (DHCP o estática)
- La detección es automática, no requiere configuración
- Si una cámara no se detecta, verifica que tenga un hostname descriptivo

## 🔧 Puertos Comunes de Cámaras

Si el puerto 80 no funciona, prueba:
- **8000**: Hikvision, Dahua
- **8080**: Muchas marcas genéricas
- **443**: HTTPS (conexión segura)
- **554**: RTSP (streaming directo)

## 🎨 Interfaz Visual

- 🟢 Verde: Cámara en línea
- 🔴 Rojo: Cámara desconectada
- Tarjetas organizadas en grid responsive
- Iconos específicos por marca de cámara

---

¡Ahora puedes monitorear todas tus cámaras IP desde un solo lugar! 📹✨
