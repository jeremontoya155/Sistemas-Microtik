/**
 * Multi-Dashboard - Cliente JavaScript (Versión Simple)
 * Muestra todos los MikroTiks configurados en paralelo
 */

let allRouters = [];
let updateInterval = null;
let monitoringConfig = { routers: [] };

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    loadMonitoringConfig();
    loadAllRouters();
    
    // Actualizar cada 10 segundos
    updateInterval = setInterval(loadAllRouters, 10000);
});

// ==================== RELOJ ====================

function initClock() {
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateStr = now.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('clock').textContent = `${timeStr} - ${dateStr}`;
    }, 1000);
}

// ==================== CARGA DE DATOS ====================

async function loadMonitoringConfig() {
    try {
        const response = await fetch('/api/multi/monitoring-config');
        const data = await response.json();
        
        if (data.success && data.config) {
            monitoringConfig = data.config;
            console.log('✅ Configuración de monitoreo cargada:', monitoringConfig);
        }
    } catch (error) {
        console.error('❌ Error al cargar configuración de monitoreo:', error);
    }
}

async function loadAllRouters() {
    try {
        const response = await fetch('/api/multi/all-routers');
        const data = await response.json();
        
        if (data.success) {
            allRouters = data.routers;
            renderRouters();
        }
    } catch (error) {
        console.error('Error al cargar routers:', error);
        document.getElementById('connection-status').textContent = 'Error de conexión';
        document.getElementById('status-dot').className = 'status-dot offline';
    }
}

// ==================== ACTUALIZAR RESUMEN ====================

function getFilteredWANs(routerId, interfaces) {
    if (!interfaces) return [];
    
    // Buscar configuración para este router
    const routerConfig = monitoringConfig.routers.find(r => r.routerId === routerId);
    
    // Si no hay configuración, mostrar todas las WANs (por defecto)
    if (!routerConfig || !routerConfig.wans || routerConfig.wans.length === 0) {
        return interfaces.filter(i => i.running && !i.disabled);
    }
    
    // Filtrar solo las WANs configuradas
    return interfaces.filter(i => 
        i.running && 
        !i.disabled && 
        routerConfig.wans.includes(i.name)
    );
}

function updateSummary() {
    const connectedRouters = allRouters.filter(r => r.connected).length;
    const totalWans = allRouters.reduce((sum, r) => {
        if (!r.interfaces) return sum;
        const filteredWans = getFilteredWANs(r.id, r.interfaces);
        return sum + filteredWans.length;
    }, 0);
    const totalDevices = allRouters.reduce((sum, r) => sum + (r.devices?.total || 0), 0);
    
    // Calcular tráfico total RX y TX
    let totalRx = 0;
    let totalTx = 0;
    allRouters.forEach(r => {
        if (r.interfaces) {
            r.interfaces.forEach(i => {
                totalRx += (i.rxBytes || 0);
                totalTx += (i.txBytes || 0);
            });
        }
    });
    
    document.getElementById('total-routers').textContent = `${connectedRouters}/${allRouters.length}`;
    document.getElementById('total-wans').textContent = totalWans;
    document.getElementById('total-devices').textContent = totalDevices;
    document.getElementById('total-rx').textContent = formatBytes(totalRx);
    document.getElementById('total-tx').textContent = formatBytes(totalTx);
}

function updateConnectionStatus() {
    const connected = allRouters.filter(r => r.connected).length;
    const total = allRouters.length;
    
    if (connected === total && total > 0) {
        document.getElementById('status-dot').className = 'status-dot online';
        document.getElementById('connection-status').textContent = `✅ Todos conectados (${connected}/${total})`;
    } else if (connected > 0) {
        document.getElementById('status-dot').className = 'status-dot warning';
        document.getElementById('connection-status').textContent = `⚠️ Conectados (${connected}/${total})`;
    } else {
        document.getElementById('status-dot').className = 'status-dot offline';
        document.getElementById('connection-status').textContent = `❌ Sin conexión`;
    }
}

// ==================== RENDERIZAR ROUTERS ====================

function renderRouters() {
    updateSummary();
    updateConnectionStatus();
    
    const grid = document.getElementById('routers-grid');
    
    if (allRouters.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <p>⚠️ No hay routers configurados.</p>
                <a href="/admin" class="btn btn-primary" style="margin-top: 20px;">Ir a Administración</a>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = allRouters.map(router => createRouterCard(router)).join('');
}

function createRouterCard(router) {
    if (!router.connected) {
        return `
            <div class="router-card offline">
                <div class="router-header">
                    <h3>🔴 ${router.name}</h3>
                    <span class="router-host">${router.host}</span>
                </div>
                <div class="router-body">
                    <div class="error-message">
                        <p>❌ Sin conexión</p>
                        <small>${router.error || 'No se pudo conectar'}</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    const memoryPercent = ((router.resources.totalMemory - router.resources.freeMemory) / router.resources.totalMemory * 100).toFixed(1);
    const wanInterfaces = getFilteredWANs(router.id, router.interfaces);
    const activeDevices = router.devices?.active || 0;
    const totalDevices = router.devices?.total || 0;
    
    // Obtener dispositivos principales con nombre
    const topDevices = router.devices?.list ? 
        router.devices.list
            .filter(d => d.hostName && d.hostName.trim() !== '')
            .slice(0, 3) : [];
    
    return `
        <div class="router-card online">
            <!-- Header -->
            <div class="router-header">
                <div>
                    <h3>🟢 ${router.name}</h3>
                    <span class="router-host">${router.host}</span>
                </div>
            </div>
            
            <!-- Body -->
            <div class="router-body">
                <!-- Recursos -->
                <div class="section">
                    <h4>⚡ Recursos</h4>
                    <div class="resource-item">
                        <span class="label">CPU:</span>
                        <span class="value ${getColorClass(router.resources.cpuLoad)}">${router.resources.cpuLoad}%</span>
                    </div>
                    <div class="resource-item">
                        <span class="label">Memoria:</span>
                        <span class="value ${getColorClass(memoryPercent)}">${memoryPercent}%</span>
                    </div>
                    <div class="resource-item">
                        <span class="label">Uptime:</span>
                        <span class="value">${formatUptime(router.resources.uptime)}</span>
                    </div>
                </div>
                
                <!-- WANs -->
                <div class="section">
                    <h4>🌐 WANs Monitoreadas (${wanInterfaces.length})</h4>
                    <div class="wans-list">
                        ${wanInterfaces.length > 0 ? wanInterfaces.map(wan => `
                            <div class="wan-item">
                                <span class="wan-dot ${wan.running ? 'online' : 'offline'}"></span>
                                <span class="wan-name">${wan.name}</span>
                                <span class="wan-traffic">
                                    ↓${formatBytes(wan.rxBytes)} ↑${formatBytes(wan.txBytes)}
                                </span>
                            </div>
                        `).join('') : '<div class="no-data">No hay WANs configuradas para monitorear</div>'}
                    </div>
                </div>
                
                <!-- Dispositivos Principales -->
                <div class="section">
                    <h4>💻 Dispositivos (${activeDevices}/${totalDevices})</h4>
                    ${topDevices.length > 0 ? `
                        <div class="devices-list">
                            ${topDevices.map(device => `
                                <div class="device-item">
                                    <span class="device-icon">🖥️</span>
                                    <div class="device-info-col">
                                        <span class="device-name">${device.hostName}</span>
                                        <span class="device-ip">${device.ipAddress || 'Sin IP'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="no-data">No hay dispositivos con nombre</div>'}
                </div>
                
                <!-- Logs de Seguridad -->
                <div class="section">
                    <h4>🔒 Intentos de Login Fallidos</h4>
                    <div class="logs-list">
                        ${router.logs && router.logs.length > 0 ? 
                            router.logs.slice(0, 3).map(log => `
                                <div class="log-item">
                                    <span class="log-time">${formatLogTime(log.time)}</span>
                                    <span class="log-msg">${log.message}</span>
                                </div>
                            `).join('') 
                            : '<div class="no-data">✅ Sin intentos fallidos recientes</div>'
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================== UTILIDADES ====================

function getColorClass(value) {
    if (value < 60) return 'success';
    if (value < 80) return 'warning';
    return 'danger';
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(uptime) {
    if (!uptime) return 'N/A';
    
    // Si tiene formato "Xw Xd XX:XX:XX"
    const match = uptime.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+):(\d+):(\d+))?/);
    if (match) {
        const weeks = parseInt(match[1]) || 0;
        const days = parseInt(match[2]) || 0;
        const hours = parseInt(match[3]) || 0;
        const minutes = parseInt(match[4]) || 0;
        
        if (weeks > 0) return `${weeks}sem ${days}d`;
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
    
    // Fallback: retornar solo la parte de días si existe
    return uptime.split(',')[0] || uptime;
}

function formatLogTime(timeStr) {
    if (!timeStr) return '';
    
    // Si es ISO string, convertir a hora local
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    return timeStr;
}
