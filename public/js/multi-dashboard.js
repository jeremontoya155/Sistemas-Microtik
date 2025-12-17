/**
 * Multi-Dashboard - Cliente JavaScript
 * Muestra todos los MikroTiks configurados en paralelo
 */

let allRouters = [];
let updateInterval = null;
let charts = {};
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
            updateSummary();
            renderRouters();
            updateConnectionStatus();
        }
    } catch (error) {
        console.error('Error al cargar routers:', error);
        document.getElementById('connection-status').textContent = 'Error de conexión';
        document.getElementById('status-dot').className = 'status-dot offline';
    }
}

// ==================== ACTUALIZAR RESUMEN ====================

function updateSummary() {
    const connectedRouters = allRouters.filter(r => r.connected).length;
    const totalWans = allRouters.reduce((sum, r) => {
        if (!r.interfaces) return sum;
        const wanInterfaces = getFilteredWANs(r.id, r.interfaces);
        return sum + wanInterfaces.length;
    }, 0);
    const totalDevices = allRouters.reduce((sum, r) => sum + (r.devices?.active || 0), 0);
    
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
    
    const grid = document.getElementById('routers-grid-compact');
    
    if (allRouters.length === 0) {
        grid.innerHTML = `
            <div class="loading-multi" style="grid-column: 1 / -1;">
                <p>⚠️ No hay routers configurados. Ve al panel de administración para agregar routers.</p>
                <a href="/admin" class="btn btn-primary" style="margin-top: 20px;">Ir a Administración</a>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = allRouters.map(router => createRouterCard(router)).join('');
}

function getFilteredWANs(routerId, interfaces) {
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
    const activeDevices = router.devices.active || 0;
    
    // Calcular tráfico total
    const totalRx = router.interfaces.reduce((sum, i) => sum + (i.rxBytes || 0), 0);
    const totalTx = router.interfaces.reduce((sum, i) => sum + (i.txBytes || 0), 0);
    
    return `
        <div class="router-card online" data-router-id="${router.id}">
            <!-- Header Compacto -->
            <div class="router-header">
                <div>
                    <h3>🟢 ${router.name}</h3>
                    <span class="router-host">${router.host}</span>
                </div>
            </div>
            
            <div class="router-body">
                <!-- Recursos Compactos en 2 Columnas -->
                <div class="mini-section">
                    <h4>⚡ Recursos</h4>
                    <div class="resources-grid">
                        <div class="resource-item">
                            <span class="resource-label">CPU</span>
                            <span class="resource-value" style="color: ${getColorForValue(router.resources.cpuLoad)}">${router.resources.cpuLoad}%</span>
                        </div>
                        <div class="resource-item">
                            <span class="resource-label">RAM</span>
                            <span class="resource-value" style="color: ${getColorForValue(memoryPercent)}">${memoryPercent}%</span>
                        </div>
                        <div class="resource-item">
                            <span class="resource-label">Uptime</span>
                            <span class="resource-value">${router.resources.uptime.split(',')[0]}</span>
                        </div>
                        <div class="resource-item">
                            <span class="resource-label">Dispositivos</span>
                            <span class="resource-value">${activeDevices}/${router.devices.total}</span>
                        </div>
                    </div>
                </div>
                
                <!-- WANs Principales -->
                <div class="mini-section">
                    <h4>📡 Estado WANs (${wanInterfaces.length})</h4>
                    <div class="wans-compact">
                        ${wanInterfaces.slice(0, 4).map(iface => `
                            <div class="wan-compact-item">
                                <div class="wan-name-row">
                                    <span class="wan-dot" style="background: ${iface.running ? 'var(--success)' : 'var(--danger)'}"></span>
                                    <span class="wan-name">${iface.name}</span>
                                </div>
                                <div class="wan-traffic-row">
                                    <span class="traffic-rx">↓${formatBytes(iface.rxBytes)}</span>
                                    <span class="traffic-tx">↑${formatBytes(iface.txBytes)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Tráfico Total Mini -->
                <div class="mini-section">
                    <h4>� Tráfico Total</h4>
                    <div class="traffic-summary">
                        <div class="traffic-item">
                            <span class="traffic-icon">↓</span>
                            <span class="traffic-label">Descarga</span>
                            <span class="traffic-value">${formatBytes(totalRx)}</span>
                        </div>
                        <div class="traffic-item">
                            <span class="traffic-icon">↑</span>
                            <span class="traffic-label">Subida</span>
                            <span class="traffic-value">${formatBytes(totalTx)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================== GRÁFICOS ====================
// Función deshabilitada para diseño más compacto
// Se puede re-habilitar si se desea agregar gráficos individuales por router

// ==================== UTILIDADES ====================

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getColorForValue(value) {
    if (value < 50) return 'var(--success)';
    if (value < 80) return 'var(--warning)';
    return 'var(--danger)';
}
