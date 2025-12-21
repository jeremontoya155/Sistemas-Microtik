/**
 * MikroTik Controller - Lógica de Negocio
 * Maneja toda la comunicación con el router MikroTik
 * Replicando EXACTAMENTE la lógica de Python que funciona
 */

const RouterOSAPI = require('node-routeros').RouterOSAPI;
const fs = require('fs');
const path = require('path');

class MikroTikController {
    constructor(io) {
        this.io = io;
        
        // Ruta al archivo de configuración de routers
        this.configFile = path.join(__dirname, 'mikrotiks.json');
        
        // Router activo actualmente
        this.activeRouter = null;
        
        // Datos de conexión (pueden cambiar según el router seleccionado)
        this.host = process.env.MIKROTIK_HOST || '181.116.241.192';
        this.username = process.env.MIKROTIK_USER || 'monitor';
        this.password = process.env.MIKROTIK_PASSWORD || 'Pirineos25*';
        this.port = parseInt(process.env.MIKROTIK_PORT) || 8728;
        
        this.connection = null;
        this.isConnected = false;
        this.monitoring = false;
        this.connectionTime = null;
        
        // Estructuras de datos
        this.maxDataPoints = 100;
        this.timeData = [];
        this.txData = [];
        this.rxData = [];
        this.cpuData = [];
        this.memoryData = [];
        
        // Estadísticas
        this.totalPacketsRx = 0;
        this.totalPacketsTx = 0;
        this.totalErrors = 0;
        this.totalDrops = 0;
        this.peakRx = 0;
        this.peakTx = 0;
        
        // Datos adicionales
        this.systemInfo = {};
        this.interfaces = [];
        this.dhcpLeases = [];
        this.logs = [];
        this.wanInterfaces = {};
        this.wanChanges = [];
        this.securityEvents = [];
        this.attackCount = 0;
        this.blockedAttacks = 0;
        
        // Cámaras detectadas
        this.cameras = [];
        
        // Sistema de monitoreo multi-router
        this.routersStatus = new Map(); // Estado de cada router
        this.routersHistory = []; // Historial de caídas
        this.monitoringInterval = null;
        this.monitoringIntervalTime = 60000; // 60 segundos (1 minuto)
        
        // Base de datos EXTENSA de vendors de cámaras (primeros 6 o 8 dígitos del MAC)
        this.cameraVendors = {
            // Hikvision (más variantes)
            '00:12:12': 'Hikvision', '44:19:B6': 'Hikvision', 'BC:AD:28': 'Hikvision',
            '28:57:BE': 'Hikvision', 'C0:56:E3': 'Hikvision', '4C:BD:8F': 'Hikvision',
            '54:C4:15': 'Hikvision', '68:E1:66': 'Hikvision', '84:25:DB': 'Hikvision',
            'A4:14:37': 'Hikvision', 'D4:4B:5E': 'Hikvision', 'E0:23:FF': 'Hikvision',
            // Dahua (más variantes) - AMPLIADO con tu red
            '00:12:41': 'Dahua', '08:57:00': 'Dahua', 'C4:2F:90': 'Dahua',
            '68:DF:DD': 'Dahua', '80:1F:12': 'Dahua', 'F4:BD:1D': 'Dahua',
            'C8:3A:35': 'Dahua', 'E8:CC:18': 'Dahua', 
            'F8:CE:07': 'Dahua', // ⭐ TU RED - Múltiples cámaras Dahua
            'A0:BD:1D': 'Dahua', 'F4:8C:EB': 'Dahua',
            // Axis Communications
            '00:40:8C': 'Axis', 'AC:CC:8E': 'Axis', 'B8:A4:4F': 'Axis',
            '00:09:0F': 'Axis', '00:50:C2': 'Axis',
            // TP-Link / Tapo
            '50:C7:BF': 'TP-Link', 'A4:2B:B0': 'TP-Link', '1C:3B:F3': 'TP-Link',
            '98:DA:C4': 'TP-Link', 'C0:25:E9': 'TP-Link', 'D8:07:B6': 'TP-Link',
            'E8:48:B8': 'TP-Link', 'F4:F2:6D': 'TP-Link',
            // Uniview
            '00:12:16': 'Uniview', '48:F8:50': 'Uniview',
            // Vivotek
            '00:02:D1': 'Vivotek', '00:0E:65': 'Vivotek',
            // Foscam
            '00:1F:AF': 'Foscam', '3C:67:8C': 'Foscam', '98:5D:AD': 'Foscam',
            // Xiaomi / Yi / Imilab
            '34:CE:00': 'Xiaomi', '78:11:DC': 'Xiaomi', '64:90:C1': 'Xiaomi',
            '78:8A:20': 'Xiaomi', 'F0:B4:29': 'Xiaomi', '50:EC:50': 'Xiaomi',
            // Wyze
            '2C:AA:8E': 'Wyze', '7C:78:B2': 'Wyze',
            // Reolink
            'EC:71:DB': 'Reolink', '00:03:7F': 'Reolink',
            // Amcrest
            '9C:8E:CD': 'Amcrest', '00:1D:0F': 'Amcrest',
            // Lorex
            '00:11:32': 'Lorex',
            // Swann
            '00:0C:E5': 'Swann', '3C:15:C2': 'Swann',
            // Samsung Wisenet
            '00:09:18': 'Samsung', '00:16:6C': 'Samsung', 'A0:91:69': 'Samsung',
            'C4:71:54': 'Samsung', 'E4:7C:F9': 'Samsung',
            // Sony
            '00:04:1F': 'Sony', '00:1D:BA': 'Sony', '08:00:46': 'Sony',
            // Panasonic
            '00:0D:C5': 'Panasonic', '00:80:F0': 'Panasonic', '8C:F5:A3': 'Panasonic',
            // Bosch
            '00:0F:7C': 'Bosch', '00:11:25': 'Bosch',
            // Hanwha (ex Samsung Techwin)
            '00:09:18': 'Hanwha', '00:12:23': 'Hanwha',
            // Avigilon
            '00:18:85': 'Avigilon',
            // Mobotix
            '00:03:C5': 'Mobotix',
            // Geovision
            '00:06:5B': 'Geovision',
            // ACTi
            '00:04:21': 'ACTi',
            // Ubiquiti UniFi Protect
            '00:27:22': 'Ubiquiti', '24:5A:4C': 'Ubiquiti', '70:A7:41': 'Ubiquiti',
            '74:83:C2': 'Ubiquiti', '78:45:58': 'Ubiquiti', 'B4:FB:E4': 'Ubiquiti',
            'DC:9F:DB': 'Ubiquiti', 'F0:9F:C2': 'Ubiquiti',
            // Nest / Google
            '18:B4:30': 'Google Nest', '64:16:66': 'Google Nest',
            // Ring
            '74:C6:3B': 'Ring', 'B0:C7:45': 'Ring',
            // Arlo
            '00:18:DD': 'Arlo',
            // Blink
            'A0:02:DC': 'Blink',
            // Eufy
            'E0:B9:4D': 'Eufy',
            // Ezviz
            '08:10:77': 'Ezviz', '18:67:B0': 'Ezviz',
            // Imou (Dahua sub-brand)
            'F0:79:59': 'Imou',
            // Annke
            '08:EA:40': 'Annke',
            // Zosi
            '00:48:8D': 'Zosi',
            // Hiwatch (Hikvision sub-brand)
            '6C:07:8D': 'Hiwatch',
            // Provision-ISR
            '00:1E:8C': 'Provision-ISR',
            // Honeywell
            '00:01:90': 'Honeywell', '00:40:84': 'Honeywell',
            // Vendors adicionales de tu red
            '30:DD:AA': 'Cámara IP', // Vendor común en cámaras genéricas
            'CC:88:C7': 'Cámara IP', // Vendor de cámaras IP
            '38:CA:73': 'Cámara IP', // Vendor genérico
            'C2:E0:3C': 'Cámara IP', // Posible vendor local
            'FA:0B:AB': 'Cámara IP', // Vendor común
            '74:56:3C': 'Cámara IP', // Otro vendor común
            '64:49:7D': 'Cámara IP', // Vendor de dispositivos IP
            '1C:1B:0D': 'Cámara IP', // Vendor común
            'F4:B1:C2': 'Cámara IP', // Vendor de equipos de red
            'B4:4C:3B': 'Cámara IP', // Vendor común en CCTV
            '3C:E3:6B': 'Cámara IP', // Vendor de equipos de seguridad
            'BE:33:6E': 'Cámara IP', // Vendor local
            'FC:B6:9D': 'Cámara IP', // Otro vendor común
            '40:49:0F': 'Cámara IP', // Vendor de cámaras genéricas
            '16:3D:10': 'Cámara IP'  // Vendor común en equipos de red
        };
        
        // Contadores para tráfico (global y por interfaz)
        this.prevRx = 0;
        this.prevTx = 0;
        this.counter = 0;
        
        // Tráfico por interfaz
        this.interfaceTraffic = {}; // { interfaceName: { prevRx, prevTx, rxMbps, txMbps } }
        this.selectedInterface = 'all'; // Interfaz seleccionada para el gráfico

        // Configuración de administración (en memoria)
        this.adminConfig = {
            // wans: { <ifName>: { backup: false, selected: true } }
            wans: {},
            // dispositivos marcados (macs)
            markedDevices: []
        };

        // Configuración de monitoreo multi-dashboard
        this.monitoringConfig = {
            // routers: [{ routerId: '123', wans: ['ether1', 'ether2'] }]
            routers: []
        };
        this.loadMonitoringConfig();
        
        // Configuración de umbrales de salud
        this.healthConfigFile = path.join(__dirname, 'health-config.json');
        this.healthConfig = {
            routerOfflineThreshold: 0,
            wanOfflineThreshold: 1,
            cpuWarning: 70,
            cpuCritical: 90,
            memoryWarning: 75,
            memoryCritical: 90
        };
        this.loadHealthConfig();
        
        // Intervalos
        this.intervals = {};
        
        // Cargar configuración de routers al iniciar
        this.loadRoutersConfig();
        
        // Iniciar monitoreo de todos los routers
        if (this.routersConfig.routers.length > 0) {
            setTimeout(() => {
                this.startRoutersMonitoring();
            }, 5000); // Esperar 5 segundos después de iniciar
        }
        
        console.log('✅ MikroTikController inicializado');
    }
    
    // ==================== GESTIÓN DE MÚLTIPLES ROUTERS ====================
    
    loadRoutersConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, 'utf8');
                const config = JSON.parse(data);
                this.routersConfig = config;
                
                // Si hay un router por defecto, cargarlo
                if (config.defaultRouter) {
                    this.activeRouter = config.routers.find(r => r.id === config.defaultRouter);
                    if (this.activeRouter) {
                        this.host = this.activeRouter.host;
                        this.username = this.activeRouter.username;
                        this.password = this.activeRouter.password;
                        this.port = this.activeRouter.port;
                        console.log(`📡 Router por defecto cargado: ${this.activeRouter.name}`);
                    }
                }
            } else {
                this.routersConfig = { routers: [], defaultRouter: null, lastUpdated: null };
            }
        } catch (error) {
            console.error('Error cargando configuración de routers:', error.message);
            this.routersConfig = { routers: [], defaultRouter: null, lastUpdated: null };
        }
    }
    
    saveRoutersConfig() {
        try {
            this.routersConfig.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.configFile, JSON.stringify(this.routersConfig, null, 2), 'utf8');
            console.log('✅ Configuración de routers guardada');
        } catch (error) {
            console.error('Error guardando configuración:', error.message);
            throw error;
        }
    }
    
    getRouters() {
        return this.routersConfig.routers || [];
    }
    
    addRouter(routerData) {
        const newRouter = {
            id: Date.now().toString(),
            name: routerData.name,
            host: routerData.host,
            username: routerData.username,
            password: routerData.password,
            port: routerData.port || 8728,
            createdAt: new Date().toISOString()
        };
        
        this.routersConfig.routers.push(newRouter);
        
        // Si es el primero, marcarlo como default
        if (this.routersConfig.routers.length === 1) {
            this.routersConfig.defaultRouter = newRouter.id;
        }
        
        this.saveRoutersConfig();
        return newRouter;
    }
    
    updateRouter(id, routerData) {
        const index = this.routersConfig.routers.findIndex(r => r.id === id);
        if (index === -1) throw new Error('Router no encontrado');
        
        // Si no se proporciona password, mantener el existente
        const updatedData = { ...routerData };
        if (!updatedData.password) {
            delete updatedData.password;
        }
        
        this.routersConfig.routers[index] = {
            ...this.routersConfig.routers[index],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        this.saveRoutersConfig();
        return this.routersConfig.routers[index];
    }
    
    deleteRouter(id) {
        this.routersConfig.routers = this.routersConfig.routers.filter(r => r.id !== id);
        
        // Si era el default, limpiar
        if (this.routersConfig.defaultRouter === id) {
            this.routersConfig.defaultRouter = this.routersConfig.routers.length > 0 
                ? this.routersConfig.routers[0].id 
                : null;
        }
        
        this.saveRoutersConfig();
    }
    
    setDefaultRouter(id) {
        const router = this.routersConfig.routers.find(r => r.id === id);
        if (!router) throw new Error('Router no encontrado');
        
        this.routersConfig.defaultRouter = id;
        this.saveRoutersConfig();
        
        return router;
    }
    
    async switchRouter(id) {
        const router = this.routersConfig.routers.find(r => r.id === id);
        if (!router) throw new Error('Router no encontrado');
        
        // Desconectar el actual si está conectado
        if (this.isConnected) {
            this.disconnect();
        }
        
        // Cambiar credenciales
        this.host = router.host;
        this.username = router.username;
        this.password = router.password;
        this.port = router.port;
        this.activeRouter = router;
        
        console.log(`🔄 Cambiado a router: ${router.name} (${router.host})`);
        
        // Intentar conectar automáticamente
        return await this.connect();
    }
    
    // ==================== CONEXIÓN ====================
    
    async connect() {
        try {
            console.log('🔌 Intentando conectar a MikroTik...');
            console.log(`📍 Host: ${this.host}:${this.port}`);
            console.log(`👤 Usuario: ${this.username}`);
            
            // Crear conexión (como Python: RouterOsApiPool)
            this.connection = new RouterOSAPI({
                host: this.host,
                user: this.username,
                password: this.password,
                port: this.port,
                timeout: 10
            });
            
            // Conectar
            await this.connection.connect();
            
            // Obtener identidad del sistema (como Python)
            const identity = await this.connection.write('/system/identity/print');
            const routerName = identity[0].name;
            
            this.isConnected = true;
            this.connectionTime = new Date();
            
            console.log(`✅ Conectado a: ${routerName}`);
            
            // Cargar datos iniciales inmediatamente
            await this.loadInitialData();
            
            // Iniciar monitoreo en tiempo real
            this.startMonitoring();
            
            // Emitir estado de conexión
            this.io.emit('connection_status', {
                connected: true,
                router: routerName,
                time: this.connectionTime
            });
            
            return {
                success: true,
                message: `Conectado a ${routerName}`
            };
            
        } catch (error) {
            console.error('❌ Error conectando:', error.message);
            this.isConnected = false;
            
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }
    
    disconnect() {
        console.log('🔌 Desconectando...');
        
        this.monitoring = false;
        
        // Detener todos los intervalos
        Object.values(this.intervals).forEach(interval => clearInterval(interval));
        this.intervals = {};
        
        // Cerrar conexión
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        
        this.isConnected = false;
        this.connectionTime = null;
        
        console.log('✅ Desconectado');
        
        this.io.emit('connection_status', {
            connected: false
        });
    }
    
    // ==================== CARGA INICIAL DE DATOS ====================
    
    async loadInitialData() {
        console.log('📊 Cargando datos iniciales...');
        
        try {
            // Cargar en paralelo (como Python)
            await Promise.all([
                this.loadSystemInfo(),
                this.loadInterfaces(),
                this.loadDevices(),
                this.loadLogs(),
                this.loadWANs()
            ]);
            
            console.log('✅ Datos iniciales cargados');
        } catch (error) {
            console.error('❌ Error cargando datos iniciales:', error.message);
        }
    }
    
    async loadSystemInfo() {
        try {
            // Obtener info del sistema (como Python: /system/identity y /system/resource)
            const [identity, resource] = await Promise.all([
                this.connection.write('/system/identity/print'),
                this.connection.write('/system/resource/print')
            ]);
            
            this.systemInfo = {
                identity: identity[0].name,
                board: resource[0]['board-name'],
                version: resource[0].version,
                architecture: resource[0]['architecture-name'],
                cpuCount: resource[0]['cpu-count'],
                uptime: resource[0].uptime
            };
            
            this.io.emit('system_info', this.systemInfo);
            console.log(`✅ Sistema: ${this.systemInfo.identity}`);
            
        } catch (error) {
            console.error('Error cargando system info:', error.message);
        }
    }
    
    async loadInterfaces() {
        try {
            const interfaces = await this.connection.write('/interface/print');
            
            // Obtener direcciones IP de las interfaces
            let ipAddresses = [];
            try {
                ipAddresses = await this.connection.write('/ip/address/print');
            } catch (err) {
                console.warn('No se pudieron obtener direcciones IP:', err.message);
            }
            
            this.interfaces = interfaces.map(iface => {
                // Buscar la IP asignada a esta interfaz
                const ipInfo = ipAddresses.find(ip => ip.interface === iface.name);
                
                return {
                    name: iface.name,
                    type: iface.type,
                    running: iface.running === 'true',
                    disabled: iface.disabled === 'true',
                    mac: iface['mac-address'] || 'N/A',
                    mtu: iface.mtu || 'N/A',
                    comment: iface.comment || '',
                    // Información de IP
                    ipAddress: ipInfo ? ipInfo.address : 'Sin IP',
                    network: ipInfo ? ipInfo.network : '',
                    // Tráfico
                    rxBytesRaw: parseInt(iface['rx-byte'] || 0),
                    txBytesRaw: parseInt(iface['tx-byte'] || 0),
                    rxBytes: this.formatBytes(parseInt(iface['rx-byte'] || 0)),
                    txBytes: this.formatBytes(parseInt(iface['tx-byte'] || 0)),
                    rxPackets: parseInt(iface['rx-packet'] || 0),
                    txPackets: parseInt(iface['tx-packet'] || 0),
                    rxErrors: parseInt(iface['rx-error'] || 0),
                    txErrors: parseInt(iface['tx-error'] || 0)
                };
            });
            
            this.io.emit('interfaces_update', { interfaces: this.interfaces });
            console.log(`✅ ${this.interfaces.length} interfaces cargadas`);
            
        } catch (error) {
            console.error('Error cargando interfaces:', error.message);
        }
    }
    
    async loadDevices() {
        try {
            // Intentar obtener DHCP leases (como Python)
            let leases = [];
            
            try {
                leases = await this.connection.write('/ip/dhcp-server/lease/print');
                console.log(`📋 ${leases.length} DHCP leases encontrados`);
            } catch (err) {
                console.log('⚠️ No se pudieron obtener DHCP leases, intentando ARP...');
                try {
                    leases = await this.connection.write('/ip/arp/print');
                    console.log(`📋 ${leases.length} entradas ARP encontradas`);
                } catch (arpErr) {
                    console.error('❌ Error obteniendo ARP:', arpErr.message);
                    leases = [];
                }
            }
            
            this.dhcpLeases = leases
                .filter(lease => {
                    const status = lease.status || '';
                    const complete = lease.complete || '';
                    const dynamic = lease.dynamic || '';
                    // Incluir dispositivos bound o dinámicos activos
                    return status.includes('bound') || complete === 'true' || dynamic === 'true';
                })
                .map(lease => {
                    // Obtener el nombre del dispositivo de múltiples fuentes
                    let hostname = 'Desconocido';
                    
                    // Prioridad: host-name > comment > server
                    if (lease['host-name'] && lease['host-name'] !== '') {
                        hostname = lease['host-name'];
                    } else if (lease.comment && lease.comment !== '') {
                        hostname = lease.comment;
                    } else if (lease.server && lease.server !== '') {
                        hostname = lease.server;
                    } else if (lease['active-address']) {
                        // Si es ARP, usar la IP como identificador
                        hostname = `Dispositivo ${lease['active-address']}`;
                    }
                    
                    return {
                        address: lease.address || lease['active-address'] || 'N/A',
                        mac: lease['mac-address'] || lease['active-mac-address'] || 'N/A',
                        hostname: hostname,
                        status: lease.status || 'active',
                        expires: lease['expires-after'] || 'Permanente',
                        active: true,
                        comment: lease.comment || ''
                    };
                });
            
            this.io.emit('devices_update', { devices: this.dhcpLeases });
            console.log(`✅ ${this.dhcpLeases.length} dispositivos cargados`);
            
        } catch (error) {
            console.error('❌ Error cargando dispositivos:', error.message);
            this.dhcpLeases = [];
        }
    }
    
    async loadLogs() {
        try {
            const allLogs = await this.connection.write('/log/print');
            
            // Tomar los últimos 30 logs (como Python)
            const recentLogs = allLogs.slice(-30).reverse();
            
            this.logs = recentLogs.map(log => ({
                time: log.time || '',
                topics: log.topics || 'info',
                message: log.message || 'Sin mensaje'
            }));
            
            // Analizar seguridad en los logs
            this.analyzeSecurityLogs();
            
            this.io.emit('logs_update', { logs: this.logs });
            console.log(`✅ ${this.logs.length} logs cargados`);
            
        } catch (error) {
            console.error('Error cargando logs:', error.message);
            this.logs = [];
        }
    }
    
    analyzeSecurityLogs() {
        this.attackCount = 0;
        this.blockedAttacks = 0;
        this.securityEvents = [];
        let failedLogins = 0;
        
        this.logs.forEach(log => {
            const message = log.message.toLowerCase();
            const topics = log.topics.toLowerCase();
            
            // Detectar intentos de login fallidos EN EL MIKROTIK (no web)
            if ((message.includes('login') && message.includes('failed')) ||
                (message.includes('authentication failed')) ||
                (message.includes('invalid user')) ||
                (topics.includes('critical') && message.includes('login'))) {
                this.attackCount++;
                failedLogins++;
                this.securityEvents.push({
                    time: log.time,
                    type: 'failed_login',
                    severity: 'high',
                    message: log.message,
                    source: 'mikrotik'
                });
            }
            
            // Detectar ataques bloqueados por firewall
            if (topics.includes('firewall') || message.includes('blocked') || message.includes('dropped')) {
                this.blockedAttacks++;
                this.securityEvents.push({
                    time: log.time,
                    type: 'firewall_block',
                    severity: 'medium',
                    message: log.message
                });
            }
        });
        
        console.log(`🔐 Intentos de login fallidos detectados en MikroTik: ${failedLogins}`);
        
        this.io.emit('security_update', {
            events: this.securityEvents.slice(-20),
            attacks: this.attackCount,
            blocked: this.blockedAttacks,
            failedLogins: failedLogins
        });
    }
    
    async loadWANs() {
        try {
            const interfaces = await this.connection.write('/interface/print');
            
            console.log(`📡 Total interfaces encontradas: ${interfaces.length}`);
            
            // Detectar WANs - usando múltiples criterios
            const wanKeywords = ['wan', 'ether1', 'ether-1', 'pppoe', 'lte', 'sfp', 'ether2'];
            
            const wanData = [];
            
            interfaces.forEach(iface => {
                const name = iface.name.toLowerCase();
                const comment = (iface.comment || '').toLowerCase();
                
                // Verificar si es WAN por nombre o comentario
                const isWanByName = wanKeywords.some(keyword => name.includes(keyword));
                const isWanByComment = comment.includes('wan') || comment.includes('internet');
                
                if (isWanByName || isWanByComment) {
                    const running = iface.running === 'true';
                    const disabled = iface.disabled === 'true';
                    
                    // Una WAN está UP si está running Y NO está disabled
                    const isUp = running && !disabled;
                    
                    console.log(`🔍 WAN detectada: ${iface.name} - Running: ${running}, Disabled: ${disabled}, UP: ${isUp}`);
                    
                    // Guardar en el registro histórico
                    if (!this.wanInterfaces[iface.name]) {
                        this.wanInterfaces[iface.name] = {
                            status: isUp,
                            uptimePercentage: 100,
                            downtime: 0,
                            totalFailures: 0,
                            lastCheck: new Date()
                        };
                    }
                    
                    // Actualizar estado
                    this.wanInterfaces[iface.name].status = isUp;
                    this.wanInterfaces[iface.name].lastCheck = new Date();
                    
                    // Agregar a la lista de WANs
                    wanData.push({
                        name: iface.name,
                        running: isUp,
                        status: isUp ? 'UP' : 'DOWN',
                        disabled: disabled,
                        comment: iface.comment || '',
                        type: iface.type || 'ether'
                    });
                }
            });
            
            // Si no se detectaron WANs, mostrar todas las interfaces para debug
            if (wanData.length === 0) {
                console.log('⚠️ No se detectaron WANs. Interfaces disponibles:');
                interfaces.forEach(iface => {
                    console.log(`  - ${iface.name} (${iface.type}) - Running: ${iface.running}, Comment: ${iface.comment || 'N/A'}`);
                });
            }
            
            this.io.emit('wans_update', {
                wans: wanData,
                changes: []
            });
            
            console.log(`✅ ${wanData.length} WANs emitidas al frontend`);
            
        } catch (error) {
            console.error('❌ Error cargando WANs:', error.message);
            console.error(error.stack);
        }
    }
    
    // ==================== MONITOREO EN TIEMPO REAL ====================
    
    startMonitoring() {
        if (this.monitoring) {
            console.log('⚠️ Monitoreo ya está activo');
            return;
        }
        
        this.monitoring = true;
        console.log('🔄 Iniciando monitoreo en tiempo real...');
        
        // Tráfico cada 1 segundo (como Python)
        this.intervals.traffic = setInterval(() => this.updateTraffic(), 1000);
        
        // Recursos cada 2 segundos (como Python)
        this.intervals.resources = setInterval(() => this.updateResources(), 2000);
        
        // Interfaces cada 10 segundos
        this.intervals.interfaces = setInterval(() => this.loadInterfaces(), 10000);
        
        // Dispositivos cada 15 segundos
        this.intervals.devices = setInterval(() => this.loadDevices(), 15000);
        
        // Logs cada 5 segundos
        this.intervals.logs = setInterval(() => this.loadLogs(), 5000);
        
        // WANs cada 10 segundos
        this.intervals.wans = setInterval(() => this.loadWANs(), 10000);
        
        // Cámaras cada 20 segundos
        this.intervals.cameras = setInterval(() => this.loadCameras(), 20000);
        
        console.log('✅ Monitoreo iniciado');
    }
    
    async updateTraffic() {
        if (!this.isConnected || !this.monitoring) return;
        
        try {
            const interfaces = await this.connection.write('/interface/print');
            
            let totalRx = 0;
            let totalTx = 0;
            let totalRxPackets = 0;
            let totalTxPackets = 0;
            let totalErrors = 0;
            let totalDrops = 0;
            
            // Calcular tráfico por interfaz individual
            interfaces.forEach(iface => {
                const ifaceName = iface.name;
                const ifaceRx = parseInt(iface['rx-byte'] || 0);
                const ifaceTx = parseInt(iface['tx-byte'] || 0);
                
                if (iface.running === 'true') {
                    // Acumular totales
                    totalRx += ifaceRx;
                    totalTx += ifaceTx;
                    totalRxPackets += parseInt(iface['rx-packet'] || 0);
                    totalTxPackets += parseInt(iface['tx-packet'] || 0);
                    totalErrors += parseInt(iface['rx-error'] || 0) + parseInt(iface['tx-error'] || 0);
                    totalDrops += parseInt(iface['rx-drop'] || 0) + parseInt(iface['tx-drop'] || 0);
                    
                    // Inicializar tracking de interfaz si no existe
                    if (!this.interfaceTraffic[ifaceName]) {
                        this.interfaceTraffic[ifaceName] = {
                            prevRx: ifaceRx,
                            prevTx: ifaceTx,
                            rxMbps: 0,
                            txMbps: 0
                        };
                    } else {
                        // Calcular velocidad para esta interfaz
                        const rxSpeed = (ifaceRx - this.interfaceTraffic[ifaceName].prevRx) * 8 / 1000000;
                        const txSpeed = (ifaceTx - this.interfaceTraffic[ifaceName].prevTx) * 8 / 1000000;
                        
                        this.interfaceTraffic[ifaceName].rxMbps = Math.max(0, rxSpeed);
                        this.interfaceTraffic[ifaceName].txMbps = Math.max(0, txSpeed);
                        this.interfaceTraffic[ifaceName].prevRx = ifaceRx;
                        this.interfaceTraffic[ifaceName].prevTx = ifaceTx;
                    }
                }
            });
            
            // Calcular velocidades (como Python)
            // IMPORTANTE: Emitir datos desde el primer ciclo
            let rxMbps = 0;
            let txMbps = 0;
            
            if (this.counter > 0 && this.prevRx > 0 && this.prevTx > 0) {
                // Calcular diferencia de bytes y convertir a Mbps
                const rxSpeed = (totalRx - this.prevRx) * 8 / 1000000; // bytes * 8 bits / 1M = Mbps
                const txSpeed = (totalTx - this.prevTx) * 8 / 1000000;
                
                rxMbps = Math.max(0, rxSpeed);
                txMbps = Math.max(0, txSpeed);
                
                // Actualizar picos
                if (rxMbps > this.peakRx) this.peakRx = rxMbps;
                if (txMbps > this.peakTx) this.peakTx = txMbps;
            }
            
            // Mantener array con longitud máxima
            if (this.timeData.length >= this.maxDataPoints) {
                this.timeData.shift();
                this.rxData.shift();
                this.txData.shift();
            }
            
            this.timeData.push(this.counter);
            this.rxData.push(rxMbps);
            this.txData.push(txMbps);
            
            // Determinar qué datos enviar según la interfaz seleccionada
            let displayRx = rxMbps;
            let displayTx = txMbps;
            
            if (this.selectedInterface !== 'all' && this.interfaceTraffic[this.selectedInterface]) {
                displayRx = this.interfaceTraffic[this.selectedInterface].rxMbps;
                displayTx = this.interfaceTraffic[this.selectedInterface].txMbps;
            }
            
            // Preparar datos de tráfico por WAN (solo las seleccionadas en adminConfig)
            const wanTrafficData = {};
            if (this.adminConfig && this.adminConfig.wans) {
                Object.entries(this.adminConfig.wans).forEach(([wanName, wanCfg]) => {
                    if (wanCfg.selected && this.interfaceTraffic[wanName]) {
                        wanTrafficData[wanName] = {
                            rx: parseFloat(this.interfaceTraffic[wanName].rxMbps.toFixed(2)),
                            tx: parseFloat(this.interfaceTraffic[wanName].txMbps.toFixed(2)),
                            isBackup: wanCfg.backup || false
                        };
                    }
                });
            }
            
            // Emitir datos via WebSocket SIEMPRE (incluso en primer ciclo)
            const trafficData = {
                time: this.counter,
                rx: parseFloat(displayRx.toFixed(2)),
                tx: parseFloat(displayTx.toFixed(2)),
                totalRx: this.formatBytes(totalRx),
                totalTx: this.formatBytes(totalTx),
                peakRx: parseFloat(this.peakRx.toFixed(2)),
                peakTx: parseFloat(this.peakTx.toFixed(2)),
                packetsRx: totalRxPackets,
                packetsTx: totalTxPackets,
                errors: totalErrors,
                drops: totalDrops,
                selectedInterface: this.selectedInterface,
                interfaceTraffic: this.interfaceTraffic,
                wanTraffic: wanTrafficData // Tráfico específico de WANs configuradas
            };
            
            this.io.emit('traffic_update', trafficData);
            
            // Log cada 10 segundos para debug
            if (this.counter % 10 === 0) {
                console.log(`📊 Tráfico: RX=${rxMbps.toFixed(2)} Mbps, TX=${txMbps.toFixed(2)} Mbps`);
            }
            
            this.prevRx = totalRx;
            this.prevTx = totalTx;
            this.totalPacketsRx = totalRxPackets;
            this.totalPacketsTx = totalTxPackets;
            this.totalErrors = totalErrors;
            this.totalDrops = totalDrops;
            this.counter++;
            
        } catch (error) {
            console.error('❌ Error actualizando tráfico:', error.message);
        }
    }
    
    async updateResources() {
        if (!this.isConnected || !this.monitoring) return;
        
        try {
            const resource = await this.connection.write('/system/resource/print');
            const data = resource[0];
            
            const cpuLoad = parseInt(data['cpu-load'] || 0);
            const freeMemory = parseInt(data['free-memory'] || 0);
            const totalMemory = parseInt(data['total-memory'] || 0);
            
            const memoryUsed = totalMemory - freeMemory;
            const memoryPercent = totalMemory > 0 ? (memoryUsed / totalMemory * 100) : 0;
            
            // Mantener array con longitud máxima
            if (this.cpuData.length >= this.maxDataPoints) {
                this.cpuData.shift();
                this.memoryData.shift();
            }
            
            this.cpuData.push(cpuLoad);
            this.memoryData.push(memoryPercent);
            
            this.io.emit('resources_update', {
                cpu: cpuLoad,
                memory: parseFloat(memoryPercent.toFixed(1)),
                memoryTotal: this.formatBytes(totalMemory),
                memoryFree: this.formatBytes(freeMemory),
                memoryUsed: this.formatBytes(memoryUsed),
                uptime: data.uptime
            });
            
        } catch (error) {
            console.error('Error actualizando recursos:', error.message);
        }
    }
    
    // ==================== MÉTODOS DE API ====================
    
    getStatus() {
        return {
            connected: this.isConnected,
            monitoring: this.monitoring,
            connectionTime: this.connectionTime,
            router: this.systemInfo.identity || 'N/A'
        };
    }
    
    getTrafficData() {
        return {
            time: this.timeData,
            rx: this.rxData,
            tx: this.txData,
            peakRx: this.peakRx,
            peakTx: this.peakTx
        };
    }
    
    getSystemInfo() {
        return this.systemInfo;
    }
    
    getInterfaces() {
        return { interfaces: this.interfaces };
    }
    
    getDevices() {
        return { devices: this.dhcpLeases };
    }
    
    getLogs() {
        return { logs: this.logs };
    }
    
    getSecurity() {
        return {
            events: this.securityEvents.slice(-20),
            attacks: this.attackCount,
            blocked: this.blockedAttacks
        };
    }
    
    getWANs() {
        const wanData = Object.entries(this.wanInterfaces).map(([name, data]) => ({
            name: name,
            status: data.status ? 'UP' : 'DOWN',
            uptimePercentage: data.uptimePercentage,
            downtimeMinutes: Math.round(data.downtime / 60),
            totalFailures: data.totalFailures
        }));
        
        return {
            wans: wanData,
            changes: this.wanChanges
        };
    }

    // ==================== ADMIN CONFIG ====================

    getAdminConfig() {
        return this.adminConfig;
    }

    setAdminConfig(newConfig) {
        if (!newConfig) return;
        if (newConfig.wans) this.adminConfig.wans = newConfig.wans;
        if (newConfig.markedDevices) this.adminConfig.markedDevices = newConfig.markedDevices;
        // Emitir evento para que UI se actualice si hace falta
        this.io.emit('admin_config_update', this.adminConfig);
    }

    // ==================== MONITORING CONFIG ====================

    loadMonitoringConfig() {
        const configPath = path.join(__dirname, 'monitoring-config.json');
        try {
            if (fs.existsSync(configPath)) {
                const data = fs.readFileSync(configPath, 'utf8');
                this.monitoringConfig = JSON.parse(data);
                console.log('✅ Configuración de monitoreo cargada');
            } else {
                // Crear config por defecto si no existe
                this.monitoringConfig = { routers: [] };
                this.saveMonitoringConfig(this.monitoringConfig);
            }
        } catch (error) {
            console.error('❌ Error al cargar configuración de monitoreo:', error.message);
            this.monitoringConfig = { routers: [] };
        }
    }

    getMonitoringConfig() {
        return this.monitoringConfig;
    }

    saveMonitoringConfig(newConfig) {
        const configPath = path.join(__dirname, 'monitoring-config.json');
        try {
            if (!newConfig || !newConfig.routers) {
                throw new Error('Configuración inválida');
            }

            this.monitoringConfig = newConfig;
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
            console.log('✅ Configuración de monitoreo guardada');
            
            // Emitir evento para que el multi-dashboard se actualice
            this.io.emit('monitoring_config_update', this.monitoringConfig);
        } catch (error) {
            console.error('❌ Error al guardar configuración de monitoreo:', error.message);
            throw error;
        }
    }

    // ==================== CONFIGURACIÓN DE SALUD ====================

    loadHealthConfig() {
        try {
            if (fs.existsSync(this.healthConfigFile)) {
                const data = fs.readFileSync(this.healthConfigFile, 'utf8');
                this.healthConfig = { ...this.healthConfig, ...JSON.parse(data) };
                console.log('✅ Configuración de umbrales de salud cargada');
            } else {
                // Crear config por defecto si no existe
                this.saveHealthConfig(this.healthConfig);
            }
        } catch (error) {
            console.error('❌ Error al cargar configuración de salud:', error.message);
        }
    }

    getHealthConfig() {
        return this.healthConfig;
    }

    saveHealthConfig(newConfig) {
        try {
            this.healthConfig = { ...this.healthConfig, ...newConfig };
            fs.writeFileSync(this.healthConfigFile, JSON.stringify(this.healthConfig, null, 2), 'utf8');
            console.log('✅ Configuración de salud guardada:', this.healthConfig);
            
            // Emitir evento para que el multi-dashboard se actualice
            this.io.emit('health_config_update', this.healthConfig);
        } catch (error) {
            console.error('❌ Error al guardar configuración de salud:', error.message);
            throw error;
        }
    }

    // ==================== REGISTRO DE FALLOS ====================

    // Registrar intento de autenticación fallido (solo fallos)
    logAuthFailure(username, ip) {
        const event = {
            time: new Date().toISOString(),
            type: 'auth_failed',
            username: username || 'unknown',
            ip: ip || 'unknown',
            message: 'Intento de inicio de sesión fallido'
        };
        this.securityEvents.push(event);
        // emitir un evento de seguridad
        this.io.emit('security_event', event);
        console.log('🔐 Intento de login fallido registrado:', event);
    }
    
    // Cambiar interfaz seleccionada para el gráfico
    setSelectedInterface(interfaceName) {
        this.selectedInterface = interfaceName;
        console.log(`📡 Interfaz seleccionada para gráfico: ${interfaceName}`);
    }
    
    getInterfaces() {
        return this.interfaces;
    }
    
    // ==================== DETECCIÓN DE CÁMARAS ====================
    
    async loadCameras() {
        if (!this.isConnected) return;
        
        try {
            // Obtener todos los dispositivos DHCP
            const leases = await this.connection.write('/ip/dhcp-server/lease/print');
            const arpList = await this.connection.write('/ip/arp/print');
            
            const cameras = [];
            
            for (const device of leases) {
                const mac = device['mac-address'] || device['active-mac-address'] || '';
                const ip = device['active-address'] || device.address || '';
                const hostname = device['host-name'] || device.comment || device.server || '';
                
                // Verificar si es una cámara
                let isCamera = false;
                let brand = 'Desconocida';
                let detectionMethod = '';
                
                // 1. Detectar por MAC vendor (múltiples intentos con diferentes longitudes)
                let macPrefix8 = mac.substring(0, 8).toUpperCase(); // XX:XX:XX
                let macPrefix7 = mac.substring(0, 7).toUpperCase(); // XX:XX:X
                let macPrefix6 = mac.substring(0, 6).toUpperCase(); // XX:XX
                
                // Intentar con 8 caracteres primero (más específico)
                if (this.cameraVendors[macPrefix8]) {
                    isCamera = true;
                    brand = this.cameraVendors[macPrefix8];
                    detectionMethod = 'MAC Vendor (8)';
                } 
                // Intentar con 7 caracteres
                else if (this.cameraVendors[macPrefix7]) {
                    isCamera = true;
                    brand = this.cameraVendors[macPrefix7];
                    detectionMethod = 'MAC Vendor (7)';
                }
                // Intentar con 6 caracteres (más genérico pero cubre más casos)
                else if (this.cameraVendors[macPrefix6]) {
                    isCamera = true;
                    brand = this.cameraVendors[macPrefix6];
                    detectionMethod = 'MAC Vendor (6)';
                }
                
                // 2. Detectar por hostname (MUCHÍSIMAS más palabras clave)
                const lowerHostname = hostname.toLowerCase();
                const cameraKeywords = [
                    // Generales
                    'camera', 'cam', 'ipcam', 'ip-cam', 'ipc', 'cctv', 'webcam',
                    'nvr', 'dvr', 'xvr', 'surveillance', 'vigilancia', 'seguridad',
                    'recorder', 'monitor', 'cámara', 'camara',
                    // Marcas principales
                    'hikvision', 'hik', 'dahua', 'axis', 'vivotek', 'foscam',
                    'uniview', 'reolink', 'amcrest', 'lorex', 'swann',
                    'samsung', 'wisenet', 'sony', 'panasonic', 'bosch',
                    'hanwha', 'avigilon', 'mobotix', 'geovision', 'acti',
                    // Marcas consumo
                    'tapo', 'tp-link', 'xiaomi', 'yi', 'imilab', 'wyze',
                    'nest', 'ring', 'arlo', 'blink', 'eufy', 'ezviz',
                    'imou', 'annke', 'zosi', 'hiwatch',
                    // Términos técnicos
                    'dome', 'bullet', 'ptz', 'turret', 'fisheye',
                    'speed', 'thermal', 'ir', 'night', 'outdoor', 'indoor'
                ];
                
                for (const keyword of cameraKeywords) {
                    if (lowerHostname.includes(keyword)) {
                        isCamera = true;
                        if (!detectionMethod) detectionMethod = 'Hostname';
                        
                        // Intentar extraer marca del hostname (AMPLIADO)
                        if (lowerHostname.includes('hikvision') || lowerHostname.includes('hik')) brand = 'Hikvision';
                        else if (lowerHostname.includes('dahua')) brand = 'Dahua';
                        else if (lowerHostname.includes('axis')) brand = 'Axis';
                        else if (lowerHostname.includes('tp-link') || lowerHostname.includes('tapo')) brand = 'TP-Link';
                        else if (lowerHostname.includes('xiaomi') || lowerHostname.includes('yi') || lowerHostname.includes('imilab')) brand = 'Xiaomi';
                        else if (lowerHostname.includes('reolink')) brand = 'Reolink';
                        else if (lowerHostname.includes('uniview')) brand = 'Uniview';
                        else if (lowerHostname.includes('vivotek')) brand = 'Vivotek';
                        else if (lowerHostname.includes('foscam')) brand = 'Foscam';
                        else if (lowerHostname.includes('amcrest')) brand = 'Amcrest';
                        else if (lowerHostname.includes('lorex')) brand = 'Lorex';
                        else if (lowerHostname.includes('swann')) brand = 'Swann';
                        else if (lowerHostname.includes('samsung') || lowerHostname.includes('wisenet')) brand = 'Samsung';
                        else if (lowerHostname.includes('sony')) brand = 'Sony';
                        else if (lowerHostname.includes('panasonic')) brand = 'Panasonic';
                        else if (lowerHostname.includes('bosch')) brand = 'Bosch';
                        else if (lowerHostname.includes('ubiquiti') || lowerHostname.includes('unifi')) brand = 'Ubiquiti';
                        else if (lowerHostname.includes('nest') || lowerHostname.includes('google')) brand = 'Google Nest';
                        else if (lowerHostname.includes('ring')) brand = 'Ring';
                        else if (lowerHostname.includes('arlo')) brand = 'Arlo';
                        else if (lowerHostname.includes('blink')) brand = 'Blink';
                        else if (lowerHostname.includes('eufy')) brand = 'Eufy';
                        else if (lowerHostname.includes('ezviz')) brand = 'Ezviz';
                        else if (lowerHostname.includes('wyze')) brand = 'Wyze';
                        else if (lowerHostname.includes('imou')) brand = 'Imou';
                        else if (lowerHostname.includes('annke')) brand = 'Annke';
                        else if (lowerHostname.includes('zosi')) brand = 'Zosi';
                        
                        break;
                    }
                }
                
                // 3. Detección adicional por rango de IP común en cámaras
                // Muchas instalaciones usan rangos específicos para cámaras
                if (!isCamera && ip) {
                    const ipParts = ip.split('.');
                    if (ipParts.length === 4) {
                        const lastOctet = parseInt(ipParts[3]);
                        
                        // Rangos comunes: .200-.254, .100-.199
                        // O si el hostname está vacío y la IP es alta
                        if ((lastOctet >= 200 && lastOctet <= 254) || 
                            (lastOctet >= 100 && lastOctet <= 199)) {
                            
                            // Si no tiene hostname o es muy genérico, podría ser cámara
                            if (!hostname || hostname.length < 3 || 
                                hostname.match(/^[A-F0-9:-]+$/i)) {
                                
                                // Marcar como posible cámara sin marca identificada
                                isCamera = true;
                                brand = 'Cámara IP (Genérica)';
                                detectionMethod = 'Rango IP + Sin hostname';
                            }
                        }
                    }
                }
                
                if (isCamera) {
                    // Obtener información adicional del ARP
                    const arpEntry = arpList.find(a => a.address === ip);
                    const isOnline = arpEntry ? true : (device.status === 'bound');
                    
                    cameras.push({
                        id: device['.id'],
                        ip: ip,
                        mac: mac,
                        hostname: hostname || 'Sin nombre',
                        brand: brand,
                        status: isOnline ? 'online' : 'offline',
                        detectionMethod: detectionMethod,
                        lastSeen: device['last-seen'] || 'N/A',
                        static: device.dynamic === 'false' || device.dynamic === false
                    });
                }
            }
            
            this.cameras = cameras;
            
            // Emitir actualización
            this.io.emit('cameras_update', { data: cameras });
            
            console.log(`📹 Cámaras detectadas: ${cameras.length}`);
            
        } catch (error) {
            console.error('❌ Error cargando cámaras:', error.message);
        }
    }
    
    getCameras() {
        return { cameras: this.cameras };
    }
    
    getDashboardSummary() {
        return {
            connected: this.isConnected,
            system: this.systemInfo,
            wans: this.getWANs().wans,
            devices: {
                total: this.dhcpLeases.length,
                active: this.dhcpLeases.filter(d => d.active).length
            },
            interfaces: {
                total: this.interfaces.length,
                active: this.interfaces.filter(i => i.running).length,
                disabled: this.interfaces.filter(i => i.disabled).length
            },
            security: {
                attacks: this.attackCount,
                blocked: this.blockedAttacks,
                events: this.securityEvents.slice(-5)
            },
            traffic: {
                currentRx: this.rxData[this.rxData.length - 1] || 0,
                currentTx: this.txData[this.txData.length - 1] || 0,
                peakRx: this.peakRx,
                peakTx: this.peakTx,
                errors: this.totalErrors,
                drops: this.totalDrops
            },
            uptime: this.connectionTime ? Math.floor((Date.now() - this.connectionTime) / 1000) : 0
        };
    }
    
    // ==================== MULTI-ROUTER ====================
    
    /**
     * Obtiene datos de todos los routers configurados en paralelo
     */
    async getAllRoutersData() {
        const routers = this.getRouters();
        
        if (routers.length === 0) {
            return [];
        }

        // Conectar a todos los routers en paralelo
        const promises = routers.map(async (router) => {
            const RouterOSAPI = require('node-routeros').RouterOSAPI;
            const conn = new RouterOSAPI({
                host: router.host,
                user: router.username,
                password: router.password,
                port: router.port || 8728,
                timeout: 5
            });

            try {
                await conn.connect();

                // Obtener datos básicos en paralelo
                const [resources, interfaces, dhcp, system] = await Promise.all([
                    conn.write('/system/resource/print').then(data => data[0]),
                    conn.write('/interface/print').then(data => data),
                    conn.write('/ip/dhcp-server/lease/print').then(data => data),
                    conn.write('/system/identity/print').then(data => data[0])
                ]);

                // Obtener IPs de interfaces
                const ipAddresses = await conn.write('/ip/address/print');

                // Procesar interfaces
                const processedInterfaces = interfaces.map(iface => {
                    const ipInfo = ipAddresses.find(ip => ip.interface === iface.name);
                    return {
                        name: iface.name,
                        type: iface.type,
                        running: iface.running === 'true',
                        disabled: iface.disabled === 'true',
                        comment: iface.comment || '',
                        ipAddress: ipInfo ? ipInfo.address : 'Sin IP',
                        rxBytes: parseInt(iface['rx-byte']) || 0,
                        txBytes: parseInt(iface['tx-byte']) || 0
                    };
                });

                // Contar dispositivos activos
                const activeDevices = dhcp.filter(lease => lease.status === 'bound').length;
                
                // Obtener dispositivos con nombre
                const devicesList = dhcp
                    .filter(lease => lease['host-name'] && lease['host-name'].trim() !== '')
                    .map(lease => ({
                        hostName: lease['host-name'],
                        ipAddress: lease.address || '',
                        macAddress: lease['mac-address'] || '',
                        status: lease.status || 'unknown'
                    }));
                
                // Obtener logs de seguridad y eventos críticos
                let securityLogs = [];
                try {
                    // Obtener múltiples tipos de logs en paralelo
                    const [authLogs, linkLogs, errorLogs] = await Promise.all([
                        // Logs de autenticación fallida
                        conn.write('/log/print', [
                            '?topics=~system,!debug',
                            '?message=~login failure'
                        ]).catch(() => []),
                        // Logs de caídas de link/interfaces
                        conn.write('/log/print', [
                            '?topics=~interface,!debug',
                            '?message=~link down|disconnected'
                        ]).catch(() => []),
                        // Logs de errores críticos
                        conn.write('/log/print', [
                            '?topics=~error,!debug'
                        ]).catch(() => [])
                    ]);
                    
                    // Combinar y ordenar por tiempo
                    const allLogs = [...authLogs, ...linkLogs, ...errorLogs]
                        .map(log => ({
                            time: log.time || '',
                            message: log.message || '',
                            topics: log.topics || ''
                        }))
                        .slice(0, 10); // Últimos 10 eventos
                    
                    securityLogs = allLogs;
                } catch (logError) {
                    console.log(`No se pudieron obtener logs de ${router.name}`);
                }

                await conn.close();

                return {
                    id: router.id,
                    name: router.name,
                    host: router.host,
                    connected: true,
                    identity: system.name || router.name,
                    resources: {
                        cpuLoad: parseInt(resources['cpu-load']) || 0,
                        freeMemory: parseInt(resources['free-memory']) || 0,
                        totalMemory: parseInt(resources['total-memory']) || 0,
                        uptime: resources.uptime || '0s',
                        version: resources.version || 'N/A'
                    },
                    interfaces: processedInterfaces,
                    devices: {
                        total: dhcp.length,
                        active: activeDevices,
                        list: devicesList
                    },
                    logs: securityLogs,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error(`Error al conectar con ${router.name}:`, error.message);
                return {
                    id: router.id,
                    name: router.name,
                    host: router.host,
                    connected: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        });

        return await Promise.all(promises);
    }

    /**
     * Inicia el monitoreo continuo de todos los routers
     */
    startRoutersMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        console.log('🔍 Iniciando monitoreo de routers...');
        
        // Ejecutar inmediatamente
        this.checkAllRoutersStatus();
        
        // Luego cada 30 segundos
        this.monitoringInterval = setInterval(() => {
            this.checkAllRoutersStatus();
        }, this.monitoringIntervalTime);
    }

    /**
     * Detiene el monitoreo de routers
     */
    stopRoutersMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('⏸️ Monitoreo de routers detenido');
        }
    }

    /**
     * Verifica el estado de todos los routers configurados
     */
    async checkAllRoutersStatus() {
        const routers = this.getRouters();
        
        if (routers.length === 0) {
            return;
        }

        const promises = routers.map(async (router) => {
            const RouterOSAPI = require('node-routeros').RouterOSAPI;
            const conn = new RouterOSAPI({
                host: router.host,
                user: router.username,
                password: router.password,
                port: router.port || 8728,
                timeout: 5
            });

            const previousStatus = this.routersStatus.get(router.id);
            let currentStatus = {
                id: router.id,
                name: router.name,
                host: router.host,
                connected: false,
                lastCheck: new Date().toISOString(),
                error: null
            };

            try {
                await conn.connect();
                const identity = await conn.write('/system/identity/print');
                await conn.close();

                currentStatus.connected = true;
                currentStatus.identity = identity[0]?.name || router.name;

                // Si estaba caído y ahora está up, notificar recuperación
                if (previousStatus && !previousStatus.connected && currentStatus.connected) {
                    this.notifyRouterRecovered(router);
                }

            } catch (error) {
                currentStatus.error = error.message;
                currentStatus.connected = false;

                // Si estaba up y ahora está down, notificar caída
                if (!previousStatus || (previousStatus.connected && !currentStatus.connected)) {
                    this.notifyRouterDown(router, error.message);
                }
            }

            this.routersStatus.set(router.id, currentStatus);
            return currentStatus;
        });

        const results = await Promise.all(promises);
        
        // Emitir estado actualizado a todos los clientes
        this.io.emit('routers-status', {
            routers: Array.from(this.routersStatus.values()),
            timestamp: new Date().toISOString()
        });

        return results;
    }

    /**
     * Notifica cuando un router se cae
     */
    notifyRouterDown(router, error) {
        const event = {
            type: 'router-down',
            routerId: router.id,
            routerName: router.name,
            host: router.host,
            error: error,
            timestamp: new Date().toISOString()
        };

        this.routersHistory.unshift(event);
        
        // Mantener solo los últimos 50 eventos
        if (this.routersHistory.length > 50) {
            this.routersHistory = this.routersHistory.slice(0, 50);
        }

        console.error(`❌ Router CAÍDO: ${router.name} (${router.host}) - ${error}`);
        
        // Emitir alerta a todos los clientes conectados
        this.io.emit('router-alert', event);
    }

    /**
     * Notifica cuando un router se recupera
     */
    notifyRouterRecovered(router) {
        const event = {
            type: 'router-recovered',
            routerId: router.id,
            routerName: router.name,
            host: router.host,
            timestamp: new Date().toISOString()
        };

        this.routersHistory.unshift(event);
        
        if (this.routersHistory.length > 50) {
            this.routersHistory = this.routersHistory.slice(0, 50);
        }

        console.log(`✅ Router RECUPERADO: ${router.name} (${router.host})`);
        
        this.io.emit('router-alert', event);
    }

    /**
     * Obtiene el historial de eventos de routers
     */
    getRoutersHistory() {
        return this.routersHistory;
    }

    /**
     * Obtiene el estado actual de todos los routers
     */
    getRoutersStatus() {
        return Array.from(this.routersStatus.values());
    }

    // ==================== UTILIDADES ====================
    
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;
        
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        
        return `${value.toFixed(2)} ${units[unitIndex]}`;
    }
}

module.exports = MikroTikController;
