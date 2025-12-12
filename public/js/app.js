// ==================== CONFIGURACIÓN ==================== //

const socket = io();
let trafficChart = null;
let cpuChart = null;

// ==================== ELEMENTOS DEL DOM ==================== //

const elements = {
    connectionStatus: document.getElementById('connection-status'),
    statusDot: document.getElementById('status-dot'),
    btnConnect: document.getElementById('btn-connect'),
    
    // WANs
    wansGrid: document.getElementById('wans-grid'),
    wansCount: document.getElementById('wans-count'),
    
    // Recursos
    cpuBar: document.getElementById('cpu-bar'),
    cpuValue: document.getElementById('cpu-value'),
    memoryBar: document.getElementById('memory-bar'),
    memoryValue: document.getElementById('memory-value'),
    diskBar: document.getElementById('disk-bar'),
    diskValue: document.getElementById('disk-value'),
    
    // Interfaces
    interfacesCount: document.getElementById('interfaces-count'),
    interfacesList: document.getElementById('interfaces-list'),
    
    // Dispositivos
    devicesCount: document.getElementById('devices-count'),
    devicesActive: document.getElementById('devices-active'),
    
    // Tráfico
    rxValue: document.getElementById('rx-value'),
    txValue: document.getElementById('tx-value'),
    
    // Logs
    logsList: document.getElementById('logs-list'),
    
    // Control de dispositivos
    devicesControlList: document.getElementById('devices-control-list'),
    
    // Audio
    alertAudio: document.getElementById('alert-audio')
};

// ==================== FORMATEO DE DATOS ==================== //

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatBps(bps) {
    if (bps === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(uptime) {
    if (!uptime) return 'N/A';
    const match = uptime.match(/(\d+d)?(\d+h)?(\d+m)?/);
    if (!match) return uptime;
    
    const days = match[1] ? parseInt(match[1]) : 0;
    const hours = match[2] ? parseInt(match[2]) : 0;
    const minutes = match[3] ? parseInt(match[3]) : 0;
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// ==================== CONEXIÓN ==================== //

elements.btnConnect.addEventListener('click', () => {
    const isConnected = elements.statusDot.classList.contains('connected');
    
    if (isConnected) {
        socket.emit('disconnect_mikrotik');
        elements.btnConnect.textContent = 'Desconectando...';
        elements.btnConnect.disabled = true;
    } else {
        socket.emit('connect_mikrotik');
        elements.btnConnect.textContent = 'Conectando...';
        elements.btnConnect.disabled = true;
    }
});

// ==================== SOCKET.IO EVENTS ==================== //

socket.on('connect', () => {
    console.log('✅ Conectado al servidor Socket.IO');
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado del servidor Socket.IO');
});

socket.on('connection_status', (data) => {
    console.log('📡 Estado de conexión:', data);
    
    elements.connectionStatus.textContent = data.connected ? 'Conectado' : 'Desconectado';
    
    if (data.connected) {
        elements.statusDot.classList.add('connected');
        elements.btnConnect.textContent = 'Desconectar';
        elements.btnConnect.classList.add('connected');
    } else {
        elements.statusDot.classList.remove('connected');
        elements.btnConnect.textContent = 'Conectar';
        elements.btnConnect.classList.remove('connected');
    }
    
    elements.btnConnect.disabled = false;
    
    if (data.error) {
        console.error('❌ Error de conexión:', data.error);
    }
});

socket.on('wans_update', (data) => {
    console.log('📡 WANs update recibido');
    updateWANs(data);
});

socket.on('resources_update', (data) => {
    console.log('⚡ Recursos update recibido');
    updateResources(data);
});

socket.on('interfaces_update', (data) => {
    console.log('🔌 Interfaces update recibido');
    updateInterfaces(data);
});

socket.on('devices_update', (data) => {
    console.log('💻 Dispositivos update recibido');
    updateDevices(data);
});

socket.on('traffic_update', (data) => {
    updateTraffic(data);
});

socket.on('logs_update', (data) => {
    console.log('📋 Logs update recibido');
    updateLogs(data);
});

socket.on('wan_down_alert', (data) => {
    playAlert();
    console.warn('¡Alerta! WAN caída:', data);
});

socket.on('security_alert', (data) => {
    playAlert();
    console.warn('¡Alerta de seguridad!', data);
});

// ==================== ACTUALIZACIÓN DE WANs ==================== //

function updateWANs(data) {
    const wans = data.wans || data || [];
    
    if (!wans || wans.length === 0) {
        elements.wansGrid.innerHTML = '<div class="loading">Sin datos de WANs</div>';
        elements.wansCount.textContent = '0';
        return;
    }
    
    elements.wansCount.textContent = wans.length;
    
    elements.wansGrid.innerHTML = wans.map(wan => `
        <div class="wan-item ${wan.running ? 'up' : 'down'}">
            <div class="wan-name">${wan.name}</div>
            <div class="wan-status ${wan.running ? 'up' : 'down'}">
                ${wan.running ? 'UP' : 'DOWN'}
            </div>
            ${wan.uptime ? `<div class="wan-uptime">${formatUptime(wan.uptime)}</div>` : ''}
        </div>
    `).join('');
}

// ==================== ACTUALIZACIÓN DE RECURSOS ==================== //

function updateResources(resources) {
    if (!resources) return;
    
    // CPU
    if (resources.cpu !== undefined) {
        const cpu = Math.round(resources.cpu);
        elements.cpuBar.style.width = cpu + '%';
        elements.cpuValue.textContent = cpu + '%';
        
        // Cambiar color según uso
        if (cpu < 60) {
            elements.cpuBar.style.background = 'linear-gradient(90deg, var(--accent), var(--success))';
        } else if (cpu < 80) {
            elements.cpuBar.style.background = 'linear-gradient(90deg, var(--warning), var(--warning))';
        } else {
            elements.cpuBar.style.background = 'linear-gradient(90deg, var(--danger), var(--danger))';
        }
    }
    
    // Memoria
    if (resources.memory !== undefined) {
        const memory = Math.round(resources.memory);
        elements.memoryBar.style.width = memory + '%';
        elements.memoryValue.textContent = memory + '%';
    }
    
    // Disco (si está disponible)
    if (resources.disk !== undefined) {
        const disk = Math.round(resources.disk);
        elements.diskBar.style.width = disk + '%';
        elements.diskValue.textContent = disk + '%';
    }
    
    // Actualizar mini-chart de CPU si existe
    if (cpuChart && resources.cpu !== undefined) {
        updateCPUChart(resources.cpu);
    }
}

// ==================== ACTUALIZACIÓN DE INTERFACES ==================== //

function updateInterfaces(data) {
    const interfaces = data.interfaces || data || [];
    
    if (!interfaces || interfaces.length === 0) {
        elements.interfacesList.innerHTML = '<div class="loading">Sin datos de interfaces</div>';
        elements.interfacesCount.textContent = '0';
        return;
    }
    
    elements.interfacesCount.textContent = interfaces.length;
    
    elements.interfacesList.innerHTML = interfaces.map(iface => `
        <div class="interface-item ${iface.running ? 'running' : 'disabled'}">
            <span class="interface-name">${iface.name}</span>
            <span class="interface-status ${iface.running ? 'running' : 'disabled'}">
                ${iface.running ? 'RUNNING' : 'DISABLED'}
            </span>
        </div>
    `).join('');
}

// ==================== ACTUALIZACIÓN DE DISPOSITIVOS ==================== //

function updateDevices(data) {
    const devices = data.devices || data || [];
    
    if (!devices || devices.length === 0) {
        elements.devicesCount.textContent = '0';
        elements.devicesActive.textContent = '0';
        elements.devicesControlList.innerHTML = '<div class="loading">Sin dispositivos conectados</div>';
        return;
    }
    
    const activeDevices = devices.filter(d => d.active).length;
    elements.devicesCount.textContent = devices.length;
    elements.devicesActive.textContent = activeDevices;
    
    elements.devicesControlList.innerHTML = devices.map(device => {
        // Mostrar hostname si existe y es diferente de "Desconocido"
        const hasHostname = device.hostname && device.hostname !== 'Desconocido';
        
        return `
            <div class="device-control-item">
                <div class="device-info">
                    ${hasHostname ? `
                        <div class="device-name">${device.hostname}</div>
                        <div class="device-mac">MAC: ${device.mac}</div>
                    ` : `
                        <div class="device-name">${device.mac}</div>
                    `}
                    <div class="device-ip">IP: ${device.address || 'N/A'}</div>
                    ${device.comment ? `<div class="device-comment">${device.comment}</div>` : ''}
                </div>
                <div class="device-actions">
                    <button class="btn-device btn-disconnect" onclick="disconnectDevice('${device.mac}')">
                        Desconectar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== ACTUALIZACIÓN DE TRÁFICO ==================== //

function updateTraffic(data) {
    if (!data || (!data.rx && !data.tx)) return;
    
    console.log('📊 Datos de tráfico recibidos:', data); // Debug
    
    // Los datos ya vienen en Mbps desde el servidor
    const rxMbps = data.rx || 0;
    const txMbps = data.tx || 0;
    
    // Actualizar valores - mostrar en Mbps directamente
    elements.rxValue.textContent = `${rxMbps.toFixed(2)} Mbps`;
    elements.txValue.textContent = `${txMbps.toFixed(2)} Mbps`;
    
    // Actualizar gráfico
    if (trafficChart) {
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();
        
        if (trafficChart.data.labels.length > 60) {
            trafficChart.data.labels.shift();
            trafficChart.data.datasets[0].data.shift();
            trafficChart.data.datasets[1].data.shift();
        }
        
        trafficChart.data.labels.push(timeLabel);
        // Los datos ya están en Mbps, NO dividir por 1000000
        trafficChart.data.datasets[0].data.push(rxMbps);
        trafficChart.data.datasets[1].data.push(txMbps);
        trafficChart.update('none');
    }
}

// ==================== ACTUALIZACIÓN DE LOGS ==================== //

function updateLogs(data) {
    const logs = data.logs || data || [];
    
    if (!logs || logs.length === 0) {
        elements.logsList.innerHTML = '<div class="loading">Sin logs recientes</div>';
        return;
    }
    
    elements.logsList.innerHTML = logs.slice(0, 20).map(log => {
        let logClass = '';
        const message = log.message.toLowerCase();
        
        if (message.includes('error') || message.includes('failed')) {
            logClass = 'error';
        } else if (message.includes('warning') || message.includes('alert')) {
            logClass = 'warning';
        }
        
        return `
            <div class="log-entry ${logClass}">
                <span class="log-time">${log.time}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `;
    }).join('');
}

// ==================== GRÁFICOS ==================== //

function initTrafficChart() {
    const ctx = document.getElementById('traffic-chart');
    if (!ctx) {
        console.error('❌ Elemento traffic-chart no encontrado en el DOM');
        return;
    }
    
    console.log('✅ Inicializando gráfico de tráfico...');
    trafficChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'RX (Mbps)',
                    data: [],
                    borderColor: 'rgb(76, 175, 80)',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'TX (Mbps)',
                    data: [],
                    borderColor: 'rgb(244, 67, 54)',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxTicksLimit: 10
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e4e7eb'
                    }
                }
            }
        }
    });
}

function initCPUChart() {
    const ctx = document.getElementById('cpu-mini-chart');
    if (!ctx) return;
    
    cpuChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU %',
                data: [],
                borderColor: 'rgb(91, 155, 213)',
                backgroundColor: 'rgba(91, 155, 213, 0.2)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    display: false
                },
                x: {
                    display: false
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function updateCPUChart(cpu) {
    if (!cpuChart) return;
    
    if (cpuChart.data.labels.length > 30) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }
    
    cpuChart.data.labels.push('');
    cpuChart.data.datasets[0].data.push(cpu);
    cpuChart.update('none');
}

// ==================== ACCIONES DE DISPOSITIVOS ==================== //

async function disconnectDevice(mac) {
    if (!confirm(`¿Desconectar dispositivo ${mac}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/device/disconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mac })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('Dispositivo desconectado:', mac);
        } else {
            alert('Error al desconectar dispositivo: ' + (result.error || 'Error desconocido'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al desconectar dispositivo');
    }
}

// ==================== ALERTAS ==================== //

function playAlert() {
    if (elements.alertAudio) {
        elements.alertAudio.play().catch(err => {
            console.warn('No se pudo reproducir el audio de alerta:', err);
        });
    }
}

// ==================== INICIALIZACIÓN ==================== //

document.addEventListener('DOMContentLoaded', () => {
    console.log('Aplicación iniciada');
    
    // Inicializar gráficos
    initTrafficChart();
    initCPUChart();
    
    // Actualizar reloj cada segundo
    setInterval(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES');
        const header = document.querySelector('.header-left p');
        if (header) {
            header.textContent = timeString;
        }
    }, 1000);
});
