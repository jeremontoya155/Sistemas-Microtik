/**
 * MikroTik Controller - Lógica de Negocio
 * Maneja toda la comunicación con el router MikroTik
 * Replicando EXACTAMENTE la lógica de Python que funciona
 */

const RouterOSAPI = require('node-routeros').RouterOSAPI;

class MikroTikController {
    constructor(io) {
        this.io = io;
        
        // Datos de conexión (EXACTAMENTE como Python)
        this.host = '181.116.241.192';
        this.username = 'monitor';
        this.password = 'Pirineos25*';
        this.port = 8728;
        
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
        
        // Contadores para tráfico
        this.prevRx = 0;
        this.prevTx = 0;
        this.counter = 0;
        
        // Intervalos
        this.intervals = {};
        
        console.log('✅ MikroTikController inicializado');
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
            
            this.interfaces = interfaces.map(iface => ({
                name: iface.name,
                type: iface.type,
                running: iface.running === 'true',
                disabled: iface.disabled === 'true',
                mac: iface['mac-address'] || 'N/A',
                mtu: iface.mtu || 'N/A',
                rxBytes: this.formatBytes(parseInt(iface['rx-byte'] || 0)),
                txBytes: this.formatBytes(parseInt(iface['tx-byte'] || 0)),
                rxPackets: parseInt(iface['rx-packet'] || 0),
                txPackets: parseInt(iface['tx-packet'] || 0),
                rxErrors: parseInt(iface['rx-error'] || 0),
                txErrors: parseInt(iface['tx-error'] || 0)
            }));
            
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
            } catch (err) {
                console.log('⚠️ No se pudieron obtener DHCP leases, intentando ARP...');
                leases = await this.connection.write('/ip/arp/print');
            }
            
            this.dhcpLeases = leases
                .filter(lease => {
                    const status = lease.status || '';
                    const complete = lease.complete || '';
                    return status.includes('bound') || complete === 'true';
                })
                .map(lease => ({
                    address: lease.address || lease['active-address'] || 'N/A',
                    mac: lease['mac-address'] || lease['active-mac-address'] || 'N/A',
                    hostname: lease['host-name'] || lease.comment || 'Desconocido',
                    status: lease.status || 'active',
                    expires: lease['expires-after'] || 'N/A',
                    active: true
                }));
            
            this.io.emit('devices_update', { devices: this.dhcpLeases });
            console.log(`✅ ${this.dhcpLeases.length} dispositivos cargados`);
            
        } catch (error) {
            console.error('Error cargando dispositivos:', error.message);
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
        
        this.logs.forEach(log => {
            const message = log.message.toLowerCase();
            const topics = log.topics.toLowerCase();
            
            // Detectar intentos de login fallidos
            if (message.includes('login') && message.includes('failed')) {
                this.attackCount++;
                this.securityEvents.push({
                    time: log.time,
                    type: 'failed_login',
                    severity: 'high',
                    message: log.message
                });
            }
            
            // Detectar ataques bloqueados por firewall
            if (topics.includes('firewall') || message.includes('blocked')) {
                this.blockedAttacks++;
                this.securityEvents.push({
                    time: log.time,
                    type: 'firewall_block',
                    severity: 'medium',
                    message: log.message
                });
            }
        });
        
        this.io.emit('security_update', {
            events: this.securityEvents.slice(-20),
            attacks: this.attackCount,
            blocked: this.blockedAttacks
        });
    }
    
    async loadWANs() {
        try {
            const interfaces = await this.connection.write('/interface/print');
            
            // Detectar WANs (como Python: wan, ether1, pppoe, lte, sfp)
            const wanKeywords = ['wan', 'ether1', 'pppoe', 'lte', 'sfp'];
            
            interfaces.forEach(iface => {
                const name = iface.name.toLowerCase();
                const isWan = wanKeywords.some(keyword => name.includes(keyword));
                
                if (isWan) {
                    const running = iface.running === 'true';
                    const disabled = iface.disabled !== 'true';
                    const status = running && disabled;
                    
                    this.wanInterfaces[iface.name] = {
                        status: status,
                        uptimePercentage: 100,
                        downtime: 0,
                        totalFailures: 0,
                        lastCheck: new Date()
                    };
                }
            });
            
            const wanData = Object.entries(this.wanInterfaces).map(([name, data]) => ({
                name: name,
                status: data.status ? 'UP' : 'DOWN',
                uptimePercentage: data.uptimePercentage,
                downtimeMinutes: 0,
                totalFailures: 0
            }));
            
            this.io.emit('wan_update', {
                wans: wanData,
                changes: []
            });
            
            console.log(`✅ ${Object.keys(this.wanInterfaces).length} WANs detectadas`);
            
        } catch (error) {
            console.error('Error cargando WANs:', error.message);
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
            
            interfaces.forEach(iface => {
                if (iface.running === 'true') {
                    totalRx += parseInt(iface['rx-byte'] || 0);
                    totalTx += parseInt(iface['tx-byte'] || 0);
                    totalRxPackets += parseInt(iface['rx-packet'] || 0);
                    totalTxPackets += parseInt(iface['tx-packet'] || 0);
                    totalErrors += parseInt(iface['rx-error'] || 0) + parseInt(iface['tx-error'] || 0);
                    totalDrops += parseInt(iface['rx-drop'] || 0) + parseInt(iface['tx-drop'] || 0);
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
            
            // Emitir datos via WebSocket SIEMPRE (incluso en primer ciclo)
            const trafficData = {
                time: this.counter,
                rx: parseFloat(rxMbps.toFixed(2)),
                tx: parseFloat(txMbps.toFixed(2)),
                totalRx: this.formatBytes(totalRx),
                totalTx: this.formatBytes(totalTx),
                peakRx: parseFloat(this.peakRx.toFixed(2)),
                peakTx: parseFloat(this.peakTx.toFixed(2)),
                packetsRx: totalRxPackets,
                packetsTx: totalTxPackets,
                errors: totalErrors,
                drops: totalDrops
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
