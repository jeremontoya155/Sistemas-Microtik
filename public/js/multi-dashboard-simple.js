/**
 * Multi-Dashboard - Cliente JavaScript (Versión Simple)
 * Muestra todos los MikroTiks configurados en paralelo
 */

let allRouters = [];
let updateInterval = null;
let monitoringConfig = { routers: [] };
let healthThresholds = {
    routerOfflineThreshold: 0, // Si hay routers caídos
    wanOfflineThreshold: 1,    // Cuántas WANs caídas son aceptables
    cpuWarning: 70,            // % CPU para advertencia
    cpuCritical: 90,           // % CPU para crítico
    memoryWarning: 75,         // % Memoria para advertencia
    memoryCritical: 90         // % Memoria para crítico
};

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    loadHealthThresholds();
    loadMonitoringConfig();
    loadAllRouters();
    
    // Actualizar cada 10 segundos
    updateInterval = setInterval(loadAllRouters, 10000);
});

// ==================== CARGA DE CONFIGURACIÓN ====================

async function loadHealthThresholds() {
    try {
        const response = await fetch('/api/multi/health-config');
        const data = await response.json();
        
        if (data.success && data.config) {
            healthThresholds = { ...healthThresholds, ...data.config };
            console.log('✅ Umbrales de salud cargados:', healthThresholds);
        }
    } catch (error) {
        console.log('ℹ️ Usando umbrales por defecto');
    }
}

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
    
    // Actualizar tarjeta de estado general
    updateHealthStatus();
}

// ==================== ESTADO GENERAL DE SALUD ====================

function updateHealthStatus() {
    const totalRouters = allRouters.length;
    const connectedRouters = allRouters.filter(r => r.connected).length;
    const offlineRouters = totalRouters - connectedRouters;
    
    // Contar WANs caídas
    let totalWans = 0;
    let offlineWans = 0;
    allRouters.forEach(r => {
        if (!r.interfaces) return;
        const wans = getFilteredWANs(r.id, r.interfaces);
        totalWans += wans.length;
        offlineWans += wans.filter(w => !w.running).length;
    });
    
    // Detectar problemas de CPU/Memoria
    let cpuIssues = 0;
    let memoryIssues = 0;
    allRouters.forEach(r => {
        if (!r.connected || !r.resources) return;
        
        const cpuLoad = r.resources.cpuLoad || 0;
        const memoryPercent = ((r.resources.totalMemory - r.resources.freeMemory) / r.resources.totalMemory * 100);
        
        if (cpuLoad >= healthThresholds.cpuCritical) cpuIssues++;
        if (memoryPercent >= healthThresholds.memoryCritical) memoryIssues++;
    });
    
    // Determinar estado general
    let status = 'good';
    let emoji = '😊';
    let title = 'Todo funcionando perfecto';
    let subtitle = 'Todos los sistemas operativos';
    let problems = [];
    
    // CRÍTICO: Routers caídos o muchas WANs caídas
    if (offlineRouters > healthThresholds.routerOfflineThreshold) {
        status = 'critical';
        emoji = '😱';
        title = '¡Problemas Críticos Detectados!';
        subtitle = 'Se requiere atención inmediata';
        problems.push(`${offlineRouters} router(s) caído(s)`);
    } else if (offlineWans > healthThresholds.wanOfflineThreshold) {
        status = 'critical';
        emoji = '😱';
        title = '¡Conexiones WAN Caídas!';
        subtitle = 'Revisar conectividad de internet';
        problems.push(`${offlineWans} WAN(s) sin conexión`);
    } else if (cpuIssues > 0 || memoryIssues > 0) {
        status = 'warning';
        emoji = '😟';
        title = 'Rendimiento Degradado';
        subtitle = 'Algunos routers bajo estrés';
        if (cpuIssues > 0) problems.push(`${cpuIssues} router(s) con CPU alta`);
        if (memoryIssues > 0) problems.push(`${memoryIssues} router(s) con memoria alta`);
    } else if (offlineWans > 0) {
        status = 'warning';
        emoji = '😐';
        title = 'Funcionamiento Normal con Alertas';
        subtitle = 'Algunas conexiones degradadas';
        problems.push(`${offlineWans} WAN(s) en backup`);
    }
    
    // Actualizar UI
    const card = document.getElementById('health-status-card');
    const icon = document.getElementById('health-icon');
    const titleEl = document.getElementById('health-title');
    const subtitleEl = document.getElementById('health-subtitle');
    const detailsEl = document.getElementById('health-details');
    
    // Limpiar clases anteriores
    card.className = 'health-status-card';
    card.classList.add(`status-${status}`);
    
    // Actualizar emoji
    icon.querySelector('.emoji-face').textContent = emoji;
    
    // Actualizar textos
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
    
    // Actualizar detalles
    const statsHtml = `
        <span class="health-stat ${offlineRouters > 0 ? '❌' : '✓'}">${offlineRouters > 0 ? '❌' : '✓'} ${connectedRouters}/${totalRouters} Routers Online</span>
        <span class="health-stat ${offlineWans > healthThresholds.wanOfflineThreshold ? '❌' : '✓'}">${offlineWans > healthThresholds.wanOfflineThreshold ? '❌' : '✓'} ${totalWans - offlineWans}/${totalWans} WANs Activas</span>
        <span class="health-stat ${problems.length > 0 ? '⚠️' : '✓'}">${problems.length > 0 ? '⚠️' : '✓'} ${problems.length > 0 ? problems.join(', ') : 'Sin problemas críticos'}</span>
    `;
    detailsEl.innerHTML = statsHtml;
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
                    <div>
                        <h3>🔴 ${router.name}</h3>
                        <span class="router-host">${router.host}</span>
                    </div>
                    <div class="header-badges">
                        <span class="badge badge-danger">✗ Offline</span>
                    </div>
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
                <div class="header-badges">
                    <span class="badge badge-success">✓ Online</span>
                    <span class="badge badge-version">${router.resources.version.split(' ')[0] || 'v?'}</span>
                </div>
            </div>
            
            <!-- Body -->
            <div class="router-body">
                <!-- Recursos -->
                <div class="section">
                    <h4>⚡ Recursos del Sistema</h4>
                    <div class="resource-item">
                        <div class="resource-header">
                            <span class="label">CPU</span>
                            <span class="value ${getColorClass(router.resources.cpuLoad)}">${router.resources.cpuLoad}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${getColorClass(router.resources.cpuLoad)}" style="width: ${router.resources.cpuLoad}%"></div>
                        </div>
                    </div>
                    <div class="resource-item">
                        <div class="resource-header">
                            <span class="label">Memoria</span>
                            <span class="value ${getColorClass(memoryPercent)}">${memoryPercent}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${getColorClass(memoryPercent)}" style="width: ${memoryPercent}%"></div>
                        </div>
                    </div>
                    <div class="resource-item">
                        <div class="resource-header">
                            <span class="label">Uptime</span>
                            <span class="value">⏱️ ${formatUptime(router.resources.uptime)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- WANs -->
                <div class="section">
                    <h4>🌐 WANs Monitoreadas (${wanInterfaces.length})</h4>
                    <div class="wans-list">
                        ${wanInterfaces.length > 0 ? wanInterfaces.map(wan => {
                            const totalTraffic = (wan.rxBytes + wan.txBytes);
                            const trafficLevel = getTrafficLevel(totalTraffic);
                            return `
                            <div class="wan-item">
                                <span class="wan-dot ${wan.running ? 'online' : 'offline'}"></span>
                                <div class="wan-info">
                                    <span class="wan-name">${wan.name}</span>
                                    <div class="wan-sparkline">
                                        <div class="spark-bar" style="height: ${Math.min((wan.rxBytes / 1000000) % 100, 80)}%"></div>
                                        <div class="spark-bar" style="height: ${Math.min((wan.rxBytes / 800000) % 100, 90)}%"></div>
                                        <div class="spark-bar" style="height: ${Math.min((wan.rxBytes / 600000) % 100, 70)}%"></div>
                                        <div class="spark-bar" style="height: ${Math.min((wan.rxBytes / 400000) % 100, 85)}%"></div>
                                        <div class="spark-bar" style="height: ${Math.min((wan.rxBytes / 200000) % 100, 95)}%"></div>
                                    </div>
                                </div>
                                <span class="wan-traffic">
                                    <span style="color: #4caf50;">↓${formatBytes(wan.rxBytes)}</span>
                                    <span style="color: #2196f3;">↑${formatBytes(wan.txBytes)}</span>
                                </span>
                            </div>
                        `}).join('') : '<div class="no-data">No hay WANs configuradas para monitorear</div>'}
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
                
                <!-- Logs de Seguridad y Alertas -->
                <div class="section">
                    <h4>
                        🔒 Logs y Alertas
                        ${router.logs && router.logs.length > 0 ? 
                            `<span class="alert-badge">${router.logs.length}</span>` 
                            : ''
                        }
                    </h4>
                    <div class="logs-list">
                        ${router.logs && router.logs.length > 0 ? 
                            router.logs.slice(0, 4).map(log => {
                                const isCritical = detectCriticalEvent(log.message);
                                const logType = getLogType(log.message);
                                return `
                                <div class="log-item ${logType}">
                                    <div class="log-header">
                                        <span class="log-icon">${getLogIcon(logType)}</span>
                                        <span class="log-time">${formatLogTime(log.time)}</span>
                                        ${isCritical ? '<span class="critical-badge">CRÍTICO</span>' : ''}
                                    </div>
                                    <span class="log-msg">${log.message}</span>
                                </div>
                            `}).join('') 
                            : '<div class="no-data">✅ Sin eventos críticos recientes</div>'
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

function getTrafficLevel(bytes) {
    if (bytes > 1000000000) return 'high'; // > 1GB
    if (bytes > 100000000) return 'medium'; // > 100MB
    return 'low';
}

function detectCriticalEvent(message) {
    if (!message) return false;
    const criticalKeywords = [
        'link down',
        'connection lost',
        'interface disabled',
        'microcorte',
        'timeout',
        'unreachable',
        'failed',
        'error',
        'critical'
    ];
    const msgLower = message.toLowerCase();
    return criticalKeywords.some(keyword => msgLower.includes(keyword));
}

function getLogType(message) {
    if (!message) return 'info';
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('login failure') || msgLower.includes('authentication failed')) {
        return 'security';
    }
    if (msgLower.includes('link down') || msgLower.includes('interface') || msgLower.includes('disconnected')) {
        return 'network';
    }
    if (msgLower.includes('error') || msgLower.includes('failed') || msgLower.includes('critical')) {
        return 'error';
    }
    if (msgLower.includes('warning') || msgLower.includes('timeout')) {
        return 'warning';
    }
    
    return 'info';
}

function getLogIcon(type) {
    const icons = {
        security: '🔐',
        network: '📡',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}
