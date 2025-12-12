// ==================== CONFIGURACIÓN ==================== //

const socket = io();

// ==================== ELEMENTOS DEL DOM ==================== //

const elements = {
    connectionStatus: document.getElementById('connection-status'),
    statusDot: document.getElementById('status-dot')
};

// ==================== TABS ==================== //

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remover active de todos
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Activar el seleccionado
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById('tab-' + tabId).classList.add('active');
        
        // Cargar datos del tab
        loadTabData(tabId);
    });
});

// ==================== SOCKET.IO EVENTS ==================== //

socket.on('connect', () => {
    console.log('✅ Conectado al servidor');
    checkConnection();
});

socket.on('connection_status', (data) => {
    console.log('📡 Estado de conexión:', data);
    
    elements.connectionStatus.textContent = data.connected ? 'Conectado' : 'Desconectado';
    
    if (data.connected) {
        elements.statusDot.classList.add('connected');
    } else {
        elements.statusDot.classList.remove('connected');
    }
});

// ==================== FUNCIONES DE CARGA ==================== //

function loadTabData(tabId) {
    console.log('📥 Cargando datos de tab:', tabId);
    
    switch(tabId) {
        case 'firewall':
            loadFirewallRules();
            break;
        case 'nat':
            loadNATRules();
            loadInterfaces();
            break;
        case 'bandwidth':
            loadQueues();
            break;
        case 'dhcp':
            loadDHCPLeases();
            break;
        case 'routes':
            loadRoutes();
            break;
        case 'users':
            loadUsers();
            break;
        case 'scheduler':
            loadScheduler();
            break;
        case 'backup':
            loadBackups();
            break;
    }
}

async function checkConnection() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.connected) {
            // Cargar datos del tab activo
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                loadTabData(activeTab.getAttribute('data-tab'));
            }
        }
    } catch (error) {
        console.error('Error verificando conexión:', error);
    }
}

// ==================== FIREWALL ==================== //

async function loadFirewallRules() {
    try {
        const response = await fetch('/api/admin/firewall/rules');
        const data = await response.json();
        
        const list = document.getElementById('firewall-rules-list');
        
        if (!data.success || !data.rules || data.rules.length === 0) {
            list.innerHTML = '<div class="loading">No hay reglas de firewall</div>';
            return;
        }
        
        list.innerHTML = data.rules.map(rule => `
            <div class="rule-item ${rule.disabled === 'true' ? 'disabled' : ''}">
                <div class="rule-info">
                    <div class="rule-title">
                        ${rule.comment || `Regla #${rule['.id']}`}
                        <span class="badge-status badge-${rule.action}">${rule.action?.toUpperCase()}</span>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail-item">
                            <span class="rule-detail-label">Chain:</span>
                            <span>${rule.chain}</span>
                        </div>
                        ${rule.protocol ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Protocolo:</span>
                                <span>${rule.protocol}</span>
                            </div>
                        ` : ''}
                        ${rule['src-address'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Origen:</span>
                                <span>${rule['src-address']}</span>
                            </div>
                        ` : ''}
                        ${rule['dst-address'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Destino:</span>
                                <span>${rule['dst-address']}</span>
                            </div>
                        ` : ''}
                        ${rule['dst-port'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Puerto:</span>
                                <span>${rule['dst-port']}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="rule-actions">
                    ${rule.disabled === 'true' 
                        ? `<button class="btn-rule btn-enable" onclick="toggleFirewallRule('${rule['.id']}', false)">Habilitar</button>`
                        : `<button class="btn-rule btn-disable" onclick="toggleFirewallRule('${rule['.id']}', true)">Deshabilitar</button>`
                    }
                    <button class="btn-rule btn-delete" onclick="deleteFirewallRule('${rule['.id']}')">Eliminar</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando reglas de firewall:', error);
    }
}

function showAddFirewallRule() {
    document.getElementById('modal-firewall').classList.add('active');
}

document.getElementById('form-firewall')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/admin/firewall/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Regla agregada correctamente');
            closeModal('modal-firewall');
            loadFirewallRules();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando regla: ' + error.message);
    }
});

async function toggleFirewallRule(id, disable) {
    try {
        const response = await fetch('/api/admin/firewall/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, disable })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadFirewallRules();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteFirewallRule(id) {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    
    try {
        const response = await fetch('/api/admin/firewall/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadFirewallRules();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ==================== NAT ==================== //

async function loadNATRules() {
    try {
        const response = await fetch('/api/admin/nat/rules');
        const data = await response.json();
        
        const list = document.getElementById('nat-rules-list');
        
        if (!data.success || !data.rules || data.rules.length === 0) {
            list.innerHTML = '<div class="loading">No hay reglas NAT configuradas</div>';
            return;
        }
        
        list.innerHTML = data.rules.map(rule => `
            <div class="rule-item ${rule.disabled === 'true' ? 'disabled' : ''}">
                <div class="rule-info">
                    <div class="rule-title">
                        ${rule.comment || `NAT #${rule['.id']}`}
                        <span class="badge-status badge-active">${rule.action?.toUpperCase()}</span>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail-item">
                            <span class="rule-detail-label">Chain:</span>
                            <span>${rule.chain}</span>
                        </div>
                        ${rule.protocol ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Protocolo:</span>
                                <span>${rule.protocol}</span>
                            </div>
                        ` : ''}
                        ${rule['dst-port'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Puerto:</span>
                                <span>${rule['dst-port']}</span>
                            </div>
                        ` : ''}
                        ${rule['to-addresses'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">A IP:</span>
                                <span>${rule['to-addresses']}</span>
                            </div>
                        ` : ''}
                        ${rule['to-ports'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">A Puerto:</span>
                                <span>${rule['to-ports']}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="rule-actions">
                    ${rule.disabled === 'true' 
                        ? `<button class="btn-rule btn-enable" onclick="toggleNATRule('${rule['.id']}', false)">Habilitar</button>`
                        : `<button class="btn-rule btn-disable" onclick="toggleNATRule('${rule['.id']}', true)">Deshabilitar</button>`
                    }
                    <button class="btn-rule btn-delete" onclick="deleteNATRule('${rule['.id']}')">Eliminar</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando reglas NAT:', error);
    }
}

async function loadInterfaces() {
    try {
        const response = await fetch('/api/interfaces');
        const data = await response.json();
        
        if (data.success && data.interfaces) {
            const select = document.getElementById('nat-interfaces');
            select.innerHTML = '<option value="">Todas</option>' + 
                data.interfaces.map(iface => 
                    `<option value="${iface.name}">${iface.name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error cargando interfaces:', error);
    }
}

function showAddNATRule() {
    document.getElementById('modal-nat').classList.add('active');
}

// ==================== QUEUE (Bandwidth) ==================== //

async function loadQueues() {
    try {
        const response = await fetch('/api/admin/queue/simple');
        const data = await response.json();
        
        const list = document.getElementById('queue-list');
        
        if (!data.success || !data.queues || data.queues.length === 0) {
            list.innerHTML = '<div class="loading">No hay colas configuradas</div>';
            return;
        }
        
        list.innerHTML = data.queues.map(queue => `
            <div class="rule-item ${queue.disabled === 'true' ? 'disabled' : ''}">
                <div class="rule-info">
                    <div class="rule-title">
                        ${queue.name}
                        <span class="badge-status badge-active">ACTIVA</span>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail-item">
                            <span class="rule-detail-label">Target:</span>
                            <span>${queue.target}</span>
                        </div>
                        ${queue['max-limit'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Límite:</span>
                                <span>${queue['max-limit']}</span>
                            </div>
                        ` : ''}
                        ${queue.comment ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Comentario:</span>
                                <span>${queue.comment}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="rule-actions">
                    <button class="btn-rule btn-delete" onclick="deleteQueue('${queue['.id']}')">Eliminar</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando colas:', error);
    }
}

function showAddQueue() {
    document.getElementById('modal-queue').classList.add('active');
}

// ==================== DHCP ==================== //

async function loadDHCPLeases() {
    // Similar a las anteriores
    const list = document.getElementById('dhcp-leases-list');
    list.innerHTML = '<div class="loading">Función en desarrollo...</div>';
}

function showAddDHCPLease() {
    document.getElementById('modal-dhcp').classList.add('active');
}

// ==================== ROUTES ==================== //

async function loadRoutes() {
    const list = document.getElementById('routes-list');
    list.innerHTML = '<div class="loading">Función en desarrollo...</div>';
}

function showAddRoute() {
    document.getElementById('modal-route').classList.add('active');
}

// ==================== USERS ==================== //

async function loadUsers() {
    const list = document.getElementById('users-list');
    list.innerHTML = '<div class="loading">Función en desarrollo...</div>';
}

function showAddUser() {
    document.getElementById('modal-user').classList.add('active');
}

// ==================== SCHEDULER ==================== //

async function loadScheduler() {
    const list = document.getElementById('scheduler-list');
    list.innerHTML = '<div class="loading">Función en desarrollo...</div>';
}

function showAddScheduler() {
    document.getElementById('modal-scheduler').classList.add('active');
}

// ==================== BACKUP ==================== //

async function loadBackups() {
    const list = document.getElementById('backups-available');
    list.innerHTML = '<div class="loading">Función en desarrollo...</div>';
}

async function createBackup() {
    if (!confirm('¿Crear un backup de la configuración actual?')) return;
    
    alert('🔄 Función en desarrollo...');
}

async function exportConfig() {
    alert('🔄 Función en desarrollo...');
}

async function rebootRouter() {
    if (!confirm('⚠️ ¿Estás seguro de reiniciar el router?')) return;
    
    alert('🔄 Función en desarrollo...');
}

async function factoryReset() {
    if (!confirm('⚠️⚠️⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO? Esto borrará TODA la configuración.')) return;
    if (!confirm('Esta es tu última oportunidad. ¿Continuar con el reset de fábrica?')) return;
    
    alert('🔄 Función en desarrollo...');
}

// ==================== MODAL ==================== //

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Cerrar modal al hacer click fuera
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ==================== INICIALIZACIÓN ==================== //

document.addEventListener('DOMContentLoaded', () => {
    console.log('Panel de administración iniciado');
    checkConnection();
    
    // Actualizar reloj
    setInterval(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES');
        const header = document.querySelector('.header-left p');
        if (header) {
            header.textContent = timeString;
        }
    }, 1000);
});
