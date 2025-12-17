/**
 * Multi-Dashboard JS - Versión con Diseño Estético Mejorado
 * Incluye gráficos bonitos con Chart.js
 */

let allRoutersData = [];
let updateInterval = null;
let monitoringConfig = { routers: [] };
let routerCharts = {}; // Almacenar instancias de gráficos

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    loadMonitoringConfig();
    loadAllRouters();
    startAutoUpdate();
});

/**
 * Cargar configuración de WANs a monitorear
 */
async function loadMonitoringConfig() {
    try {
        const response = await fetch('/api/multi/monitoring-config');
        const data = await response.json();
        if (data.success && data.config) {
            monitoringConfig = data.config;
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

/**
 * Filtrar WANs según configuración
 */
function filterWANs(routerId, interfaces) {
    if (!interfaces || interfaces.length === 0) return [];
    
    // Buscar configuración del router
    const routerConfig = monitoringConfig.routers?.find(r => r.routerId === routerId);
    
    // Si no hay configuración, mostrar todas las WANs running
    if (!routerConfig || !routerConfig.wans || routerConfig.wans.length === 0) {
        return interfaces.filter(i => i.running && !i.disabled);
    }
    
    // Filtrar solo las WANs configuradas
    return interfaces.filter(i => 
        routerConfig.wans.includes(i.name) && i.running && !i.disabled
    );
}

/**
 * Cargar datos de todos los routers
 */
async function loadAllRouters() {
    try {
        const response = await fetch('/api/multi/all-routers');
        const data = await response.json();
        
        if (data.success) {
            allRoutersData = data.routers;
            updateSummary();
            renderRouters();
        }
    } catch (error) {
        console.error('Error cargando routers:', error);
    }
}

/**
 * Actualizar resumen general
 */
function updateSummary() {
    const connected = allRoutersData.filter(r => r.connected).length;
    const totalDevices = allRoutersData.reduce((sum, r) => 
        sum + (r.connected && r.devices ? r.devices.length : 0), 0
    );
    
    let totalRx = 0, totalTx = 0;
    allRoutersData.forEach(router => {
        if (router.connected && router.interfaces) {
            const wans = filterWANs(router.id, router.interfaces);
            wans.forEach(wan => {
                totalRx += wan.rxMbps || 0;
                totalTx += wan.txMbps || 0;
            });
        }
    });
    
    const totalWans = allRoutersData.reduce((sum, r) => {
        if (r.connected && r.interfaces) {
            return sum + filterWANs(r.id, r.interfaces).length;
        }
        return sum;
    }, 0);
    
    document.getElementById('total-routers').textContent = allRoutersData.length;
    document.getElementById('connected-routers').textContent = connected;
    document.getElementById('total-wans').textContent = totalWans;
    document.getElementById('total-devices').textContent = totalDevices;
    document.getElementById('total-rx').textContent = totalRx.toFixed(2);
    document.getElementById('total-tx').textContent = totalTx.toFixed(2);
}

/**
 * Renderizar todos los routers
 */
function renderRouters() {
    const container = document.getElementById('routers-container');
    container.innerHTML = '';
    
    allRoutersData.forEach(router => {
        const card = createRouterCard(router);
        container.appendChild(card);
    });
}

/**
 * Crear tarjeta de router con diseño estético
 */
function createRouterCard(router) {
    const card = document.createElement('div');
    card.className = `router-card ${!router.connected ? 'offline' : ''}`;
    card.id = `router-${router.id}`;
    
    if (!router.connected) {
        card.innerHTML = `
            <div class="router-header">
                <div class="router-title">
                    <h3 class="router-name">${router.name}</h3>
                    <span class="router-status offline">
                        <span class="status-dot"></span>
                        Desconectado
                    </span>
                </div>
                <div class="router-host">${router.host}</div>
            </div>
            <div class="router-body">
                <div class="offline-message">
                    <div class="icon">❌</div>
                    <p>Router desconectado o inaccesible</p>
                </div>
            </div>
        `;
        return card;
    }
    
    // Filtrar WANs según configuración
    const wans = filterWANs(router.id, router.interfaces || []);
    
    // Recursos
    const resources = router.resources || {};
    const cpuPercent = parseFloat(resources.cpuPercent) || 0;
    const ramPercent = parseFloat(resources.ramPercent) || 0;
    
    card.innerHTML = `
        <div class="router-header">
            <div class="router-title">
                <h3 class="router-name">${router.name}</h3>
                <span class="router-status">
                    <span class="status-dot"></span>
                    Conectado
                </span>
            </div>
            <div class="router-host">${router.host}</div>
        </div>
        <div class="router-body">
            <!-- Gráfico de Recursos -->
            <div class="section">
                <div class="section-title">📊 Recursos del Sistema</div>
                <div class="resource-chart">
                    <canvas id="chart-resources-${router.id}"></canvas>
                </div>
            </div>
            
            <!-- Grid de Recursos -->
            <div class="section">
                <div class="resources-grid">
                    <div class="resource-item">
                        <div class="resource-label">CPU</div>
                        <div class="resource-value">${cpuPercent.toFixed(1)}%</div>
                        <div class="resource-bar">
                            <div class="resource-bar-fill ${cpuPercent > 80 ? 'danger' : cpuPercent > 60 ? 'warning' : ''}" 
                                 style="width: ${cpuPercent}%"></div>
                        </div>
                    </div>
                    <div class="resource-item">
                        <div class="resource-label">RAM</div>
                        <div class="resource-value">${ramPercent.toFixed(1)}%</div>
                        <div class="resource-bar">
                            <div class="resource-bar-fill ${ramPercent > 80 ? 'danger' : ramPercent > 60 ? 'warning' : ''}" 
                                 style="width: ${ramPercent}%"></div>
                        </div>
                    </div>
                    <div class="resource-item">
                        <div class="resource-label">Uptime</div>
                        <div class="resource-value" style="font-size: 16px;">${resources.uptime || 'N/A'}</div>
                    </div>
                    <div class="resource-item">
                        <div class="resource-label">Versión</div>
                        <div class="resource-value" style="font-size: 14px;">${resources.version || 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <!-- WANs -->
            <div class="section">
                <div class="section-title">🌐 Interfaces WAN (${wans.length})</div>
                <div class="wans-list" id="wans-list-${router.id}">
                    ${wans.length > 0 ? createWANsList(router.id, wans) : '<p style="text-align:center;color:var(--text-secondary);">No hay WANs configuradas</p>'}
                </div>
            </div>
            
            <!-- Tráfico Total -->
            <div class="section">
                <div class="section-title">📈 Tráfico Total</div>
                <div class="traffic-summary">
                    <div class="traffic-item">
                        <div class="traffic-icon">⬇️</div>
                        <div class="traffic-value">${calculateTotalTraffic(wans, 'rx').toFixed(2)} Mbps</div>
                        <div class="traffic-label">Descarga</div>
                    </div>
                    <div class="traffic-item">
                        <div class="traffic-icon">⬆️</div>
                        <div class="traffic-value">${calculateTotalTraffic(wans, 'tx').toFixed(2)} Mbps</div>
                        <div class="traffic-label">Carga</div>
                    </div>
                </div>
            </div>
            
            <!-- Dispositivos -->
            <div class="section">
                <div class="devices-count">
                    <div class="devices-icon">💻</div>
                    <div class="devices-value">${router.devices ? router.devices.length : 0}</div>
                    <div class="devices-label">Dispositivos Conectados</div>
                </div>
            </div>
        </div>
    `;
    
    // Crear gráfico de recursos después de agregar al DOM
    setTimeout(() => {
        createResourcesChart(router.id, cpuPercent, ramPercent);
    }, 100);
    
    return card;
}

/**
 * Crear lista de WANs con mini gráficos
 */
function createWANsList(routerId, wans) {
    return wans.map(wan => `
        <div class="wan-item">
            <div class="wan-info">
                <div class="wan-status-dot ${!wan.running || wan.disabled ? 'disabled' : ''}"></div>
                <div class="wan-details">
                    <div class="wan-name">${wan.name}</div>
                    <div class="wan-ip">${wan.ipAddress || 'Sin IP'}</div>
                </div>
            </div>
            <div class="wan-traffic">
                <div class="wan-traffic-item">
                    <span class="wan-traffic-label">⬇️</span>
                    <span class="wan-traffic-value">${(wan.rxMbps || 0).toFixed(2)} Mbps</span>
                </div>
                <div class="wan-traffic-item">
                    <span class="wan-traffic-label">⬆️</span>
                    <span class="wan-traffic-value">${(wan.txMbps || 0).toFixed(2)} Mbps</span>
                </div>
            </div>
        </div>
        <div class="wan-chart-container" id="wan-chart-${routerId}-${wan.name.replace(/[^a-zA-Z0-9]/g, '')}">
            <canvas class="wan-chart" id="chart-wan-${routerId}-${wan.name.replace(/[^a-zA-Z0-9]/g, '')}"></canvas>
        </div>
    `).join('');
}

/**
 * Calcular tráfico total
 */
function calculateTotalTraffic(wans, direction) {
    return wans.reduce((sum, wan) => {
        return sum + (direction === 'rx' ? (wan.rxMbps || 0) : (wan.txMbps || 0));
    }, 0);
}

/**
 * Crear gráfico de recursos (CPU/RAM)
 */
function createResourcesChart(routerId, cpu, ram) {
    const canvas = document.getElementById(`chart-resources-${routerId}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (routerCharts[`resources-${routerId}`]) {
        routerCharts[`resources-${routerId}`].destroy();
    }
    
    routerCharts[`resources-${routerId}`] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['CPU', 'RAM', 'Libre'],
            datasets: [{
                data: [cpu, ram, 100 - ((cpu + ram) / 2)],
                backgroundColor: [
                    'rgba(91, 155, 213, 0.8)',
                    'rgba(76, 175, 80, 0.8)',
                    'rgba(100, 100, 100, 0.3)'
                ],
                borderColor: [
                    'rgba(91, 155, 213, 1)',
                    'rgba(76, 175, 80, 1)',
                    'rgba(100, 100, 100, 0.5)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e4e7eb',
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed.toFixed(1) + '%';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Iniciar actualización automática
 */
function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(async () => {
        await loadAllRouters();
    }, 10000); // 10 segundos
}

/**
 * Detener actualización automática
 */
function stopAutoUpdate() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}
