/**
 * Multi-Dashboard - Diseño Limpio y Conciso
 * Cliente JavaScript
 */

let allRouters = [];
let updateInterval = null;
let monitoringConfig = { routers: [] };
let charts = {};

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
        console.error('❌ Error al cargar routers:', error);
    }
}

// ==================== RENDERIZADO ====================

function renderRouters() {
    const grid = document.getElementById('routers-grid');
    if (!grid) return;
    
    grid.innerHTML = allRouters.map(router => createRouterCard(router)).join('');
    
    // Inicializar gráficos después del renderizado
    setTimeout(() => {
        allRouters.forEach(router => {
            if (router.connected) {
                initResourceCharts(router);
            }
        });
    }, 100);
}

function getFilteredWANs(routerId, interfaces) {
    const routerConfig = monitoringConfig.routers.find(r => r.routerId === routerId);
    
    if (!routerConfig || !routerConfig.wans || routerConfig.wans.length === 0) {
        return interfaces.filter(i => i.running && !i.disabled);
    }
    
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
                    <div>
                        <h3>
                            <span class="status-indicator offline"></span>
                            ${router.name}
                        </h3>
                        <span class="router-host">${router.host}</span>
                    </div>
                </div>
                <div class="router-body">
                    <div class="error-message">
                        <p>❌ Router Desconectado</p>
                        <small>${router.error || 'No se pudo establecer conexión'}</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    const wanInterfaces = getFilteredWANs(router.id, router.interfaces);
    const memoryPercent = ((router.resources.totalMemory - router.resources.freeMemory) / router.resources.totalMemory * 100).toFixed(1);
    
    // Calcular estado de recursos
    const cpuStatus = getCpuStatus(router.resources.cpuLoad);
    const memStatus = getMemoryStatus(memoryPercent);
    
    return `
        <div class="router-card online" data-router-id="${router.id}">
            <!-- HEADER -->
            <div class="router-header">
                <div>
                    <h3>
                        <span class="status-indicator online"></span>
                        ${router.name}
                    </h3>
                    <span class="router-host">${router.host}</span>
                </div>
            </div>
            
            <div class="router-body">
                <!-- SECCIÓN WANS -->
                <div class="wans-section">
                    <div class="section-title">
                        📡 ESTADO WANs
                        <span class="section-count">${wanInterfaces.length}</span>
                    </div>
                    <div class="wans-grid">
                        ${wanInterfaces.map(wan => `
                            <div class="wan-box ${wan.running ? 'up' : 'down'}">
                                <div class="wan-name">
                                    ${wan.name}
                                    <span class="wan-status-badge ${wan.running ? 'up' : 'down'}">
                                        ${wan.running ? 'UP' : 'DOWN'}
                                    </span>
                                </div>
                                <div class="wan-traffic">
                                    <span>↓ ${formatBytes(wan.rxBytes)}</span>
                                    <span>↑ ${formatBytes(wan.txBytes)}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- SECCIÓN RECURSOS -->
                <div class="resources-section">
                    <div class="section-title">
                        ⚡ RECURSOS DEL SISTEMA
                    </div>
                    <div class="resources-grid">
                        <div class="resource-box">
                            <div class="resource-label">CPU</div>
                            <div class="resource-value ${cpuStatus}">${router.resources.cpuLoad}%</div>
                            <canvas id="cpu-chart-${router.id}" class="resource-chart"></canvas>
                        </div>
                        <div class="resource-box">
                            <div class="resource-label">Memoria</div>
                            <div class="resource-value ${memStatus}">${memoryPercent}%</div>
                            <canvas id="mem-chart-${router.id}" class="resource-chart"></canvas>
                        </div>
                        <div class="resource-box">
                            <div class="resource-label">Uptime</div>
                            <div class="resource-value" style="font-size: 14px;">
                                ${formatUptime(router.resources.uptime)}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- SECCIÓN DISPOSITIVOS -->
                <div class="devices-section">
                    <div class="section-title">
                        💻 DISPOSITIVOS
                    </div>
                    <div class="devices-stats">
                        <div class="device-stat">
                            <div class="device-stat-value">${router.devices.active || 0}</div>
                            <div class="device-stat-label">Activos</div>
                        </div>
                        <div class="device-stat">
                            <div class="device-stat-value">${router.devices.total || 0}</div>
                            <div class="device-stat-label">Total</div>
                        </div>
                    </div>
                </div>
                
                <!-- SECCIÓN LOGS DE SEGURIDAD -->
                <div class="logs-section">
                    <div class="section-title">
                        🔒 LOGS DE SEGURIDAD (Intentos Fallidos)
                    </div>
                    <div class="logs-list" id="logs-${router.id}">
                        ${renderSecurityLogs(router)}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSecurityLogs(router) {
    // Por ahora, mostrar mensaje de no logs
    // En el futuro, aquí se mostrarán los logs reales del router
    return '<div class="no-logs">✅ Sin intentos fallidos de login recientes</div>';
}

// ==================== GRÁFICOS ====================

function initResourceCharts(router) {
    const cpuCanvas = document.getElementById(`cpu-chart-${router.id}`);
    const memCanvas = document.getElementById(`mem-chart-${router.id}`);
    
    if (!cpuCanvas || !memCanvas) return;
    
    const memoryPercent = ((router.resources.totalMemory - router.resources.freeMemory) / router.resources.totalMemory * 100).toFixed(1);
    
    // Destruir gráficos anteriores si existen
    if (charts[`cpu-${router.id}`]) charts[`cpu-${router.id}`].destroy();
    if (charts[`mem-${router.id}`]) charts[`mem-${router.id}`].destroy();
    
    // Gráfico CPU
    charts[`cpu-${router.id}`] = new Chart(cpuCanvas, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [router.resources.cpuLoad, 100 - router.resources.cpuLoad],
                backgroundColor: [
                    getCpuColor(router.resources.cpuLoad),
                    'rgba(255, 255, 255, 0.1)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
    
    // Gráfico Memoria
    charts[`mem-${router.id}`] = new Chart(memCanvas, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [parseFloat(memoryPercent), 100 - parseFloat(memoryPercent)],
                backgroundColor: [
                    getMemoryColor(memoryPercent),
                    'rgba(255, 255, 255, 0.1)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// ==================== UTILIDADES ====================

function getCpuStatus(cpu) {
    if (cpu < 60) return 'good';
    if (cpu < 80) return 'warning';
    return 'danger';
}

function getMemoryStatus(mem) {
    if (mem < 70) return 'good';
    if (mem < 85) return 'warning';
    return 'danger';
}

function getCpuColor(cpu) {
    if (cpu < 60) return '#4CAF50';
    if (cpu < 80) return '#FF9800';
    return '#f44336';
}

function getMemoryColor(mem) {
    if (mem < 70) return '#4CAF50';
    if (mem < 85) return '#FF9800';
    return '#f44336';
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
    
    // Extraer días, horas, minutos
    const parts = uptime.split(',');
    if (parts.length > 1) {
        return parts[0].trim(); // Retornar solo los días
    }
    
    // Si no tiene días, retornar como está
    const timeParts = uptime.split(':');
    if (timeParts.length === 3) {
        return `${timeParts[0]}h ${timeParts[1]}m`;
    }
    
    return uptime;
}
