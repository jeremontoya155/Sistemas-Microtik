/**
 * Multi-Dashboard - Cliente JavaScript (Versión Optimizada)
 * Sistema de monitoreo consolidado de múltiples routers MikroTik
 * 
 * Características:
 * - Monitoreo en tiempo real de múltiples routers
 * - Sistema de salud con indicadores visuales (verde/amarillo/rojo)
 * - Diagnóstico inteligente paso a paso
 * - Análisis detallado de CPU, memoria y tráfico
 */

// ==================== VARIABLES GLOBALES ====================

const APP_CONFIG = {
    updateInterval: 10000,      // Actualizar cada 10 segundos
    maxRetries: 3,              // Reintentos en caso de error
    debugMode: false            // Modo debug para logs detallados
};

let allRouters = [];
let updateInterval = null;
let monitoringConfig = { routers: [] };

// Configuración de umbrales de salud (se carga desde el servidor)
let healthThresholds = {
    routerOfflineThreshold: 0,
    wanOfflineThreshold: 1,
    cpuWarning: 70,
    cpuCritical: 90,
    memoryWarning: 75,
    memoryCritical: 90
};

// Sistema de diagnóstico inteligente
const diagnosticFlow = {
    currentRouter: null,
    currentStep: 0,
    steps: [],
    reset() {
        this.currentRouter = null;
        this.currentStep = 0;
        this.steps = [];
    }
};

// Cache de datos para optimización
const dataCache = {
    lastUpdate: null,
    routers: [],
    ttl: 5000 // Time to live: 5 segundos
};

// ==================== INICIALIZACIÓN ====================

/**
 * Inicializa la aplicación cuando el DOM está listo
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Multi-Dashboard...');
    
    // Inicializar componentes
    initClock();
    initEventListeners();
    
    // Cargar configuraciones
    Promise.all([
        loadHealthThresholds(),
        loadMonitoringConfig()
    ]).then(() => {
        console.log('✅ Configuraciones cargadas');
        // Cargar datos iniciales
        loadAllRouters();
        
        // Iniciar actualización automática
        startAutoUpdate();
    }).catch(error => {
        console.error('❌ Error en inicialización:', error);
        showNotification('Error al inicializar el dashboard', 'error');
    });
});

/**
 * Inicializa listeners de eventos
 */
function initEventListeners() {
    // Cerrar modales con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // Visibilidad de página (pausar actualizaciones cuando no está visible)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('⏸️ Página oculta, pausando actualizaciones');
            stopAutoUpdate();
        } else {
            console.log('▶️ Página visible, reanudando actualizaciones');
            startAutoUpdate();
            loadAllRouters(); // Actualizar inmediatamente al volver
        }
    });
}

/**
 * Inicia la actualización automática
 */
function startAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    updateInterval = setInterval(loadAllRouters, APP_CONFIG.updateInterval);
    console.log(`⏱️ Actualización automática cada ${APP_CONFIG.updateInterval/1000}s`);
}

/**
 * Detiene la actualización automática
 */
function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

/**
 * Cierra todos los modales abiertos
 */
function closeAllModals() {
    closeAnalysisModal();
    closeDiagnosticModal();
}

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
                        <button class="btn-diagnostic" onclick='startDiagnostic(${JSON.stringify(router).replace(/'/g, "&#39;")})' title="Iniciar diagnóstico paso a paso">
                            🩺 Diagnosticar
                        </button>
                    </div>
                </div>
                <div class="router-body">
                    <div class="error-message">
                        <p>❌ Sin conexión</p>
                        <small>${router.error || 'No se pudo conectar'}</small>
                        <button class="btn-diagnostic-full" onclick='startDiagnostic(${JSON.stringify(router).replace(/'/g, "&#39;")})'>
                            🔍 Iniciar Diagnóstico Guiado
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    const memoryPercent = ((router.resources.totalMemory - router.resources.freeMemory) / router.resources.totalMemory * 100).toFixed(1);
    const wanInterfaces = getFilteredWANs(router.id, router.interfaces);
    const activeDevices = router.devices?.active || 0;
    const totalDevices = router.devices?.total || 0;
    
    // Detectar si tiene problemas
    const hasCPUProblem = router.resources.cpuLoad >= healthThresholds.cpuWarning;
    const hasMemoryProblem = memoryPercent >= healthThresholds.memoryWarning;
    const hasWANProblem = wanInterfaces.filter(w => !w.running).length > 0;
    const hasProblems = hasCPUProblem || hasMemoryProblem || hasWANProblem;
    
    // Obtener dispositivos principales con nombre
    const topDevices = router.devices?.list ? 
        router.devices.list
            .filter(d => d.hostName && d.hostName.trim() !== '')
            .slice(0, 3) : [];
    
    return `
        <div class="router-card online ${hasProblems ? 'router-has-problems' : ''}">
            <!-- Header -->
            <div class="router-header">
                <div>
                    <h3>🟢 ${router.name}</h3>
                    <span class="router-host">${router.host}</span>
                </div>
                <div class="header-badges">
                    <span class="badge badge-success">✓ Online</span>
                    <span class="badge badge-version">${router.resources.version.split(' ')[0] || 'v?'}</span>
                    ${hasProblems ? `
                        <button class="btn-diagnostic" onclick='startDiagnostic(${JSON.stringify(router).replace(/'/g, "&#39;")})' title="Iniciar diagnóstico paso a paso">
                            🩺 Diagnosticar
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <!-- Body -->
            <div class="router-body">
                <!-- Recursos -->
                <div class="section">
                    <h4>⚡ Recursos del Sistema</h4>
                    <div class="resource-item ${router.resources.cpuLoad >= healthThresholds.cpuCritical ? 'resource-critical' : ''}">
                        <div class="resource-header">
                            <span class="label">CPU</span>
                            <span class="value ${getColorClass(router.resources.cpuLoad)}">${router.resources.cpuLoad}%</span>
                            ${router.resources.cpuLoad >= healthThresholds.cpuCritical ? 
                                `<button class="btn-analyze" onclick="analyzeRouterCPU('${router.id}', '${router.name}')" title="Analizar qué está consumiendo CPU">
                                    🔍 Analizar
                                </button>` : ''}
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${getColorClass(router.resources.cpuLoad)}" style="width: ${router.resources.cpuLoad}%"></div>
                        </div>
                    </div>
                    <div class="resource-item ${memoryPercent >= healthThresholds.memoryCritical ? 'resource-critical' : ''}">
                        <div class="resource-header">
                            <span class="label">Memoria</span>
                            <span class="value ${getColorClass(memoryPercent)}">${memoryPercent}%</span>
                            ${memoryPercent >= healthThresholds.memoryCritical ? 
                                `<button class="btn-analyze" onclick="analyzeRouterMemory('${router.id}', '${router.name}')" title="Analizar consumo de memoria">
                                    🔍 Analizar
                                </button>` : ''}
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
        network: '🌐',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

// ==================== ANÁLISIS DE ROUTER ====================

async function analyzeRouterCPU(routerId, routerName) {
    console.log(`🔍 Analizando CPU del router: ${routerName} (${routerId})`);
    
    // Mostrar modal de análisis
    showAnalysisModal({
        routerId: routerId,
        routerName: routerName,
        type: 'cpu',
        title: `🔥 Análisis de CPU - ${routerName}`,
        subtitle: 'Identificando procesos y conexiones que consumen recursos'
    });
    
    try {
        // Llamar al backend para obtener análisis detallado
        const response = await fetch(`/api/routers/${routerId}/analyze/cpu`);
        const data = await response.json();
        
        if (data.success) {
            updateAnalysisModal(data.analysis);
        } else {
            updateAnalysisModal({
                error: data.message || 'No se pudo obtener el análisis'
            });
        }
    } catch (error) {
        console.error('Error al analizar CPU:', error);
        updateAnalysisModal({
            error: 'Error de conexión al obtener análisis'
        });
    }
}

async function analyzeRouterMemory(routerId, routerName) {
    console.log(`🔍 Analizando Memoria del router: ${routerName} (${routerId})`);
    
    showAnalysisModal({
        routerId: routerId,
        routerName: routerName,
        type: 'memory',
        title: `🧠 Análisis de Memoria - ${routerName}`,
        subtitle: 'Revisando uso de memoria y procesos activos'
    });
    
    try {
        const response = await fetch(`/api/routers/${routerId}/analyze/memory`);
        const data = await response.json();
        
        if (data.success) {
            updateAnalysisModal(data.analysis);
        } else {
            updateAnalysisModal({
                error: data.message || 'No se pudo obtener el análisis'
            });
        }
    } catch (error) {
        console.error('Error al analizar memoria:', error);
        updateAnalysisModal({
            error: 'Error de conexión al obtener análisis'
        });
    }
}

function showAnalysisModal(info) {
    // Crear modal si no existe
    let modal = document.getElementById('analysis-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'analysis-modal';
        modal.className = 'analysis-modal';
        modal.innerHTML = `
            <div class="analysis-modal-content">
                <div class="analysis-modal-header">
                    <h2 id="analysis-title">Análisis</h2>
                    <p id="analysis-subtitle"></p>
                    <button class="analysis-close" onclick="closeAnalysisModal()">✕</button>
                </div>
                <div class="analysis-modal-body" id="analysis-body">
                    <div class="loading-analysis">
                        <div class="spinner"></div>
                        <p>Analizando datos del router...</p>
                    </div>
                </div>
                <div class="analysis-modal-footer">
                    <button class="btn btn-secondary" onclick="closeAnalysisModal()">Cerrar</button>
                    <button class="btn btn-primary" onclick="goToAdmin('${info.routerId}')">
                        🛠️ Ir al Admin
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Actualizar contenido
    document.getElementById('analysis-title').textContent = info.title;
    document.getElementById('analysis-subtitle').textContent = info.subtitle;
    
    // Mostrar modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function updateAnalysisModal(analysis) {
    const body = document.getElementById('analysis-body');
    
    if (analysis.error) {
        body.innerHTML = `
            <div class="analysis-error">
                <div class="error-icon">❌</div>
                <h3>Error al obtener análisis</h3>
                <p>${analysis.error}</p>
            </div>
        `;
        return;
    }
    
    // Mostrar análisis detallado
    let html = '<div class="analysis-results">';
    
    // Top Procesos (si existe)
    if (analysis.topProcesses && analysis.topProcesses.length > 0) {
        html += `
            <div class="analysis-section">
                <h3>📊 Top Procesos Consumiendo CPU</h3>
                <div class="processes-list">
                    ${analysis.topProcesses.map((proc, idx) => `
                        <div class="process-item">
                            <span class="process-rank">#${idx + 1}</span>
                            <div class="process-info">
                                <span class="process-name">${proc.name || 'Proceso desconocido'}</span>
                                <span class="process-cpu">${proc.cpu || 0}% CPU</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Top Conexiones por Bandwidth
    if (analysis.topConnections && analysis.topConnections.length > 0) {
        html += `
            <div class="analysis-section">
                <h3>🌐 Top Conexiones por Tráfico</h3>
                <div class="connections-list">
                    ${analysis.topConnections.map((conn, idx) => `
                        <div class="connection-item">
                            <span class="conn-rank">#${idx + 1}</span>
                            <div class="conn-info">
                                <span class="conn-ip">${conn.srcAddress || 'N/A'} → ${conn.dstAddress || 'N/A'}</span>
                                <span class="conn-traffic">
                                    ↓ ${formatBytes(conn.rxBytes || 0)} / 
                                    ↑ ${formatBytes(conn.txBytes || 0)}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Dispositivos más activos
    if (analysis.topDevices && analysis.topDevices.length > 0) {
        html += `
            <div class="analysis-section">
                <h3>💻 Dispositivos Más Activos</h3>
                <div class="devices-analysis-list">
                    ${analysis.topDevices.map((device, idx) => `
                        <div class="device-analysis-item">
                            <span class="device-rank">#${idx + 1}</span>
                            <div class="device-analysis-info">
                                <span class="device-analysis-name">${device.hostName || device.ipAddress || 'Desconocido'}</span>
                                <span class="device-analysis-ip">${device.ipAddress || 'Sin IP'}</span>
                                <span class="device-analysis-traffic">
                                    Tráfico: ${formatBytes(device.totalTraffic || 0)}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Recursos generales
    if (analysis.resources) {
        html += `
            <div class="analysis-section">
                <h3>📈 Estado General de Recursos</h3>
                <div class="resources-summary">
                    <div class="resource-summary-item">
                        <span class="resource-label">CPU</span>
                        <span class="resource-value ${getColorClass(analysis.resources.cpuLoad || 0)}">
                            ${analysis.resources.cpuLoad || 0}%
                        </span>
                    </div>
                    <div class="resource-summary-item">
                        <span class="resource-label">Memoria</span>
                        <span class="resource-value ${getColorClass(analysis.resources.memoryPercent || 0)}">
                            ${analysis.resources.memoryPercent || 0}%
                        </span>
                    </div>
                    <div class="resource-summary-item">
                        <span class="resource-label">Uptime</span>
                        <span class="resource-value">${analysis.resources.uptime || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    body.innerHTML = html;
}

function closeAnalysisModal() {
    const modal = document.getElementById('analysis-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ==================== SISTEMA DE DIAGNÓSTICO INTELIGENTE ====================

/**
 * Inicia el flujo de diagnóstico para un router con problemas
 */
function startDiagnostic(router) {
    diagnosticFlow.currentRouter = router;
    diagnosticFlow.currentStep = 0;
    diagnosticFlow.steps = buildDiagnosticSteps(router);
    
    showDiagnosticModal();
}

/**
 * Construye los pasos de diagnóstico según los problemas detectados
 */
function buildDiagnosticSteps(router) {
    const steps = [];
    
    if (!router.connected) {
        // Router offline
        steps.push({
            title: '🔴 Router Sin Conexión',
            description: `${router.name} no responde`,
            checks: [
                { text: 'Verificar conectividad de red', action: 'ping', status: 'pending' },
                { text: 'Revisar estado del enlace WAN', action: 'check-wan', status: 'pending' },
                { text: 'Verificar credenciales de acceso', action: 'check-auth', status: 'pending' },
                { text: 'Revisar logs del sistema', action: 'view-logs', status: 'pending' }
            ],
            suggestions: [
                '💡 Verificar que el router esté encendido',
                '💡 Revisar configuración de firewall que pueda bloquear el puerto 8728',
                '💡 Confirmar que el servicio API esté habilitado en el MikroTik'
            ]
        });
        return steps;
    }
    
    const cpuLoad = router.resources?.cpuLoad || 0;
    const memoryPercent = router.resources ? 
        ((router.resources.totalMemory - router.resources.freeMemory) / router.resources.totalMemory * 100) : 0;
    
    // Paso 1: Identificar el problema principal
    if (cpuLoad >= healthThresholds.cpuCritical || cpuLoad >= healthThresholds.cpuWarning) {
        steps.push({
            title: '⚡ Paso 1: CPU Elevada Detectada',
            description: `CPU al ${cpuLoad}% en ${router.name}`,
            checks: [
                { text: `Ver procesos que más consumen CPU`, action: 'view-top-processes', status: 'pending', routerId: router.id },
                { text: 'Revisar conexiones activas', action: 'view-connections', status: 'pending', routerId: router.id },
                { text: 'Analizar tráfico por interfaz', action: 'view-traffic', status: 'pending', routerId: router.id },
                { text: 'Ver logs recientes', action: 'view-logs', status: 'pending', routerId: router.id }
            ],
            suggestions: [
                '💡 Posibles causas: Tráfico elevado, ataques DDoS, procesos huérfanos',
                '💡 Revisar reglas de firewall que puedan estar procesando mucho tráfico',
                '💡 Verificar si hay loops de red o broadcast storms'
            ]
        });
        
        // Paso 2: Analizar tráfico
        steps.push({
            title: '📊 Paso 2: Análisis de Tráfico',
            description: 'Identificar qué está consumiendo ancho de banda',
            checks: [
                { text: 'Top 10 IPs por consumo de datos', action: 'top-bandwidth-ips', status: 'pending', routerId: router.id },
                { text: 'Protocolos más utilizados', action: 'top-protocols', status: 'pending', routerId: router.id },
                { text: 'Puertos con más conexiones', action: 'top-ports', status: 'pending', routerId: router.id },
                { text: 'Detectar posibles ataques', action: 'detect-attacks', status: 'pending', routerId: router.id }
            ],
            suggestions: [
                '💡 Buscar IPs con consumo anormal',
                '💡 Identificar descargas masivas o streaming',
                '💡 Revisar si hay dispositivos comprometidos'
            ]
        });
        
        // Paso 3: Acciones correctivas
        steps.push({
            title: '🔧 Paso 3: Acciones Correctivas',
            description: 'Medidas para resolver el problema',
            checks: [
                { text: 'Limitar ancho de banda de IPs problemáticas', action: 'limit-bandwidth', status: 'pending', routerId: router.id },
                { text: 'Bloquear IPs sospechosas', action: 'block-ips', status: 'pending', routerId: router.id },
                { text: 'Reiniciar servicios del router', action: 'restart-services', status: 'pending', routerId: router.id },
                { text: 'Generar reporte del incidente', action: 'generate-report', status: 'pending', routerId: router.id }
            ],
            suggestions: [
                '⚠️ Aplicar reglas de QoS si es necesario',
                '⚠️ Considerar aumentar recursos del router si el problema es recurrente',
                '⚠️ Documentar el incidente para análisis futuro'
            ]
        });
    }
    
    if (memoryPercent >= healthThresholds.memoryCritical || memoryPercent >= healthThresholds.memoryWarning) {
        steps.push({
            title: '🧠 Paso 1: Memoria Elevada',
            description: `Memoria al ${memoryPercent.toFixed(1)}% en ${router.name}`,
            checks: [
                { text: 'Ver uso de memoria por proceso', action: 'view-memory-usage', status: 'pending', routerId: router.id },
                { text: 'Revisar tablas de conexiones', action: 'view-connection-tables', status: 'pending', routerId: router.id },
                { text: 'Analizar cache y buffers', action: 'view-cache', status: 'pending', routerId: router.id },
                { text: 'Verificar leases DHCP activos', action: 'view-dhcp-leases', status: 'pending', routerId: router.id }
            ],
            suggestions: [
                '💡 Limpiar logs antiguos del sistema',
                '💡 Reducir timeout de conexiones en firewall',
                '💡 Considerar reinicio del router si es crítico'
            ]
        });
    }
    
    // Verificar WANs caídas
    const wanInterfaces = router.interfaces ? router.interfaces.filter(i => i.running === false || i.disabled) : [];
    if (wanInterfaces.length > 0) {
        steps.push({
            title: '🌐 Paso 1: WANs Caídas',
            description: `${wanInterfaces.length} WAN(s) sin conexión`,
            checks: [
                { text: 'Verificar estado físico de interfaces', action: 'check-interfaces', status: 'pending', routerId: router.id },
                { text: 'Ping a gateway predeterminado', action: 'ping-gateway', status: 'pending', routerId: router.id },
                { text: 'Revisar logs de conexión WAN', action: 'view-wan-logs', status: 'pending', routerId: router.id },
                { text: 'Verificar configuración PPPoE/DHCP', action: 'check-wan-config', status: 'pending', routerId: router.id }
            ],
            suggestions: [
                '💡 Contactar con ISP si el problema persiste',
                '💡 Verificar cables y conectores físicos',
                '💡 Revisar si hay mantenimiento programado del proveedor'
            ]
        });
    }
    
    // Si no hay problemas críticos
    if (steps.length === 0) {
        steps.push({
            title: '✅ Sistema Operando Normalmente',
            description: `${router.name} está funcionando correctamente`,
            checks: [
                { text: 'Verificar backup reciente', action: 'check-backup', status: 'pending', routerId: router.id },
                { text: 'Revisar actualizaciones disponibles', action: 'check-updates', status: 'pending', routerId: router.id },
                { text: 'Optimizar reglas de firewall', action: 'optimize-firewall', status: 'pending', routerId: router.id },
                { text: 'Generar reporte de salud', action: 'health-report', status: 'pending', routerId: router.id }
            ],
            suggestions: [
                '💡 Mantener el sistema actualizado',
                '💡 Revisar configuración de seguridad periódicamente',
                '💡 Programar backups automáticos'
            ]
        });
    }
    
    return steps;
}

/**
 * Muestra el modal de diagnóstico
 */
function showDiagnosticModal() {
    let modal = document.getElementById('diagnostic-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'diagnostic-modal';
        modal.className = 'diagnostic-modal';
        modal.innerHTML = `
            <div class="diagnostic-modal-content">
                <div class="diagnostic-header">
                    <h2>🔍 Asistente de Diagnóstico</h2>
                    <button class="modal-close-btn" onclick="closeDiagnosticModal()">✕</button>
                </div>
                <div class="diagnostic-body" id="diagnostic-body"></div>
                <div class="diagnostic-footer">
                    <button class="btn-diagnostic-prev" onclick="prevDiagnosticStep()" id="btn-prev">⬅️ Anterior</button>
                    <button class="btn-diagnostic-next" onclick="nextDiagnosticStep()" id="btn-next">Siguiente ➡️</button>
                    <button class="btn-diagnostic-close" onclick="closeDiagnosticModal()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    renderDiagnosticStep();
}

/**
 * Renderiza el paso actual del diagnóstico
 */
function renderDiagnosticStep() {
    const step = diagnosticFlow.steps[diagnosticFlow.currentStep];
    const body = document.getElementById('diagnostic-body');
    
    if (!step) return;
    
    const router = diagnosticFlow.currentRouter;
    
    let html = `
        <div class="diagnostic-step">
            <div class="step-indicator">
                Paso ${diagnosticFlow.currentStep + 1} de ${diagnosticFlow.steps.length}
            </div>
            
            <h3>${step.title}</h3>
            <p class="step-description">${step.description}</p>
            
            <div class="step-checks">
                <h4>✔️ Verificaciones:</h4>
                <ul class="checks-list">
                    ${step.checks.map((check, idx) => `
                        <li class="check-item check-${check.status}">
                            <span class="check-icon">${getCheckIcon(check.status)}</span>
                            <span class="check-text">${check.text}</span>
                            <button class="btn-execute-check" onclick="executeCheck('${check.action}', ${idx}, '${router.id}')" 
                                ${check.status === 'completed' ? 'disabled' : ''}>
                                ${check.status === 'completed' ? '✓ Completado' : 
                                  check.status === 'running' ? '⏳ Ejecutando...' : '▶️ Ejecutar'}
                            </button>
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="step-suggestions">
                <h4>💡 Sugerencias:</h4>
                <ul class="suggestions-list">
                    ${step.suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;
    
    body.innerHTML = html;
    
    // Actualizar botones de navegación
    document.getElementById('btn-prev').disabled = diagnosticFlow.currentStep === 0;
    document.getElementById('btn-next').textContent = 
        diagnosticFlow.currentStep === diagnosticFlow.steps.length - 1 ? 'Finalizar' : 'Siguiente ➡️';
}

function getCheckIcon(status) {
    switch(status) {
        case 'completed': return '✅';
        case 'running': return '⏳';
        case 'failed': return '❌';
        default: return '⭕';
    }
}

/**
 * Ejecuta una verificación específica
 */
async function executeCheck(action, checkIndex, routerId) {
    const step = diagnosticFlow.steps[diagnosticFlow.currentStep];
    const check = step.checks[checkIndex];
    
    check.status = 'running';
    renderDiagnosticStep();
    
    try {
        let result;
        
        switch(action) {
            case 'view-top-processes':
            case 'view-connections':
            case 'view-traffic':
                // Abrir análisis detallado
                await showRouterAnalysis(routerId);
                check.status = 'completed';
                break;
                
            case 'view-logs':
                // Redirigir al admin con logs
                window.open(`/admin#logs-${routerId}`, '_blank');
                check.status = 'completed';
                break;
                
            case 'top-bandwidth-ips':
            case 'top-protocols':
            case 'top-ports':
                // Aquí podrías llamar a endpoints específicos del backend
                alert(`Función "${action}" próximamente disponible.\nRedirigiendo al panel de administración...`);
                window.open('/admin', '_blank');
                check.status = 'completed';
                break;
                
            default:
                alert(`Acción: ${action}\n\nEsta verificación te guiará en el proceso manual.`);
                check.status = 'completed';
        }
        
    } catch (error) {
        console.error('Error ejecutando check:', error);
        check.status = 'failed';
        alert(`Error: ${error.message}`);
    }
    
    renderDiagnosticStep();
}

function nextDiagnosticStep() {
    if (diagnosticFlow.currentStep < diagnosticFlow.steps.length - 1) {
        diagnosticFlow.currentStep++;
        renderDiagnosticStep();
    } else {
        closeDiagnosticModal();
        alert('✅ Diagnóstico completado.\n\nSi el problema persiste, considera contactar soporte técnico.');
    }
}

function prevDiagnosticStep() {
    if (diagnosticFlow.currentStep > 0) {
        diagnosticFlow.currentStep--;
        renderDiagnosticStep();
    }
}

function closeDiagnosticModal() {
    const modal = document.getElementById('diagnostic-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function goToAdmin(routerId) {
    // Redirigir al admin y cambiar al router seleccionado
    window.location.href = `/admin?router=${routerId}`;
}
