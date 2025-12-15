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

socket.on('cameras_update', (data) => {
    console.log('📹 Actualización de cámaras:', data);
    
    // Si estamos en la pestaña de cámaras, actualizar
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.getAttribute('data-tab') === 'cameras') {
        loadCameras();
    }
});

// ==================== FUNCIONES DE CARGA ==================== //

function loadTabData(tabId) {
    console.log('📥 Cargando datos de tab:', tabId);
    
    switch(tabId) {
        case 'routers':
            loadRouters();
            break;
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
        case 'cameras':
            loadCameras();
            break;
        case 'wans':
            loadWANsConfig();
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

// ==================== GESTIÓN DE ROUTERS ==================== //

async function loadRouters() {
    try {
        const response = await fetch('/api/routers');
        const data = await response.json();
        
        const list = document.getElementById('routers-list');
        
        if (!data.success || !data.routers || data.routers.length === 0) {
            list.innerHTML = '<div class="loading">No hay routers configurados. Agrega uno para comenzar.</div>';
            return;
        }
        
        list.innerHTML = data.routers.map(router => {
            const isActive = router.id === data.activeRouter;
            const isDefault = router.id === data.defaultRouter;
            
            return `
                <div class="rule-item ${isActive ? 'active-router' : ''}">
                    <div class="rule-info" style="flex:1;">
                        <div class="rule-title">
                            ${router.name}
                            ${isDefault ? '<span class="badge-status badge-active">⭐ POR DEFECTO</span>' : ''}
                            ${isActive ? '<span class="badge-status badge-connected">🟢 CONECTADO</span>' : ''}
                        </div>
                        <div class="rule-details">
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Host:</span>
                                <span>${router.host}:${router.port}</span>
                            </div>
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Usuario:</span>
                                <span>${router.username}</span>
                            </div>
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Agregado:</span>
                                <span>${new Date(router.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="rule-actions" style="flex-direction:column;gap:5px;">
                        ${!isActive ? `<button class="btn-rule btn-enable" onclick="switchToRouter('${router.id}')">🔄 Conectar</button>` : ''}
                        ${!isDefault ? `<button class="btn-rule btn-edit" onclick="setDefaultRouter('${router.id}')">⭐ Hacer Default</button>` : ''}
                        <button class="btn-rule btn-delete" onclick="deleteRouter('${router.id}')">🗑️ Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando routers:', error);
    }
}

function showAddRouter() {
    document.getElementById('modal-add-router').classList.add('active');
}

document.getElementById('form-add-router')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/routers/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Router agregado correctamente');
            closeModal('modal-add-router');
            loadRouters();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando router: ' + error.message);
    }
});

async function switchToRouter(id) {
    if (!confirm('¿Cambiar a este router? Se desconectará del actual.')) return;
    
    try {
        const response = await fetch(`/api/routers/${id}/switch`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ ${result.message}`);
            loadRouters();
            
            // Recargar estado de conexión
            checkConnection();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error cambiando de router: ' + error.message);
    }
}

async function setDefaultRouter(id) {
    try {
        const response = await fetch(`/api/routers/${id}/default`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ ' + result.message);
            loadRouters();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteRouter(id) {
    if (!confirm('¿Estás seguro de eliminar este router?')) return;
    
    try {
        const response = await fetch(`/api/routers/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Router eliminado');
            loadRouters();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
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
            <div class="rule-item ${rule.disabled === 'true' ? 'disabled' : ''}" style="max-width: 100%;">
                <div class="rule-info" style="flex: 1;">
                    <div class="rule-title">
                        ${rule.comment || `NAT #${rule['.id']}`}
                        <span class="badge-status badge-active">${rule.action?.toUpperCase()}</span>
                        ${rule.chain ? `<span class="badge-chain">${rule.chain.toUpperCase()}</span>` : ''}
                    </div>
                    <div class="rule-details" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13px;">
                        <div class="rule-detail-item">
                            <span class="rule-detail-label">Chain:</span>
                            <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="chain" value="${rule.chain || ''}" readonly>
                        </div>
                        ${rule.protocol ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Protocolo:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="protocol" value="${rule.protocol}" readonly>
                            </div>
                        ` : ''}
                        ${rule['in-interface'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Interface IN:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="in-interface" value="${rule['in-interface']}" readonly>
                            </div>
                        ` : ''}
                        ${rule['src-address'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">IP Origen:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="src-address" value="${rule['src-address']}" readonly>
                            </div>
                        ` : ''}
                        ${rule['dst-address'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">IP Destino:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="dst-address" value="${rule['dst-address']}" readonly>
                            </div>
                        ` : ''}
                        ${rule['dst-port'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Puerto Destino:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="dst-port" value="${rule['dst-port']}" readonly>
                            </div>
                        ` : ''}
                        ${rule['to-addresses'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">A IP:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="to-addresses" value="${rule['to-addresses']}" readonly>
                            </div>
                        ` : ''}
                        ${rule['to-ports'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">A Puerto:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="to-ports" value="${rule['to-ports']}" readonly>
                            </div>
                        ` : ''}
                        ${rule['out-interface'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Interface OUT:</span>
                                <input type="text" class="nat-edit-field" data-rule-id="${rule['.id']}" data-field="out-interface" value="${rule['out-interface']}" readonly>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="rule-actions" style="flex-direction: column; gap: 5px; min-width: 120px;">
                    <button class="btn-rule btn-edit" onclick="editNATRule('${rule['.id']}')">✏️ Editar</button>
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

document.getElementById('form-nat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/admin/nat/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Regla NAT agregada correctamente');
            closeModal('modal-nat');
            loadNATRules();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando regla NAT: ' + error.message);
    }
});

async function toggleNATRule(id, disable) {
    try {
        const response = await fetch('/api/admin/nat/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, disable })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadNATRules();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

function editNATRule(ruleId) {
    const fields = document.querySelectorAll(`.nat-edit-field[data-rule-id="${ruleId}"]`);
    const isEditing = fields[0].hasAttribute('readonly');
    
    if (isEditing) {
        // Habilitar edición
        fields.forEach(field => {
            field.removeAttribute('readonly');
            field.style.background = '#fff3cd';
            field.style.border = '2px solid #ffc107';
        });
        
        const editBtn = event.target;
        editBtn.textContent = '💾 Guardar';
        editBtn.classList.add('btn-save');
    } else {
        // Guardar cambios
        const changes = {};
        fields.forEach(field => {
            const fieldName = field.getAttribute('data-field');
            changes[fieldName] = field.value;
        });
        
        saveNATChanges(ruleId, changes);
    }
}

async function saveNATChanges(ruleId, changes) {
    try {
        const params = Object.entries(changes)
            .filter(([key, value]) => value)
            .map(([key, value]) => `=${key}=${value}`);
        
        const response = await fetch('/api/admin/nat/edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ruleId, changes })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Regla NAT actualizada');
            loadNATRules();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error actualizando regla: ' + error.message);
    }
}

async function deleteNATRule(id) {
    if (!confirm('¿Estás seguro de eliminar esta regla NAT?')) return;
    
    try {
        const response = await fetch('/api/admin/nat/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadNATRules();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
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
                        <span class="badge-status badge-active">${queue.disabled === 'true' ? 'DESHABILITADA' : 'ACTIVA'}</span>
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
                    ${queue.disabled === 'true' 
                        ? `<button class="btn-rule btn-enable" onclick="toggleQueue('${queue['.id']}', false)">Habilitar</button>`
                        : `<button class="btn-rule btn-disable" onclick="toggleQueue('${queue['.id']}', true)">Deshabilitar</button>`
                    }
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

document.getElementById('form-queue')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/admin/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Cola agregada correctamente');
            closeModal('modal-queue');
            loadQueues();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando cola: ' + error.message);
    }
});

async function toggleQueue(id, disable) {
    try {
        const response = await fetch('/api/admin/queue/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, disable })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadQueues();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteQueue(id) {
    if (!confirm('¿Estás seguro de eliminar esta cola?')) return;
    
    try {
        const response = await fetch('/api/admin/queue/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadQueues();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ==================== CÁMARAS ==================== //

async function loadCameras() {
    try {
        const response = await fetch('/api/cameras');
        const data = await response.json();
        
        const list = document.getElementById('cameras-list');
        
        if (!data.success || !data.cameras || data.cameras.length === 0) {
            list.innerHTML = '<div class="loading">No se detectaron cámaras en la red</div>';
            updateCameraStats(0, 0, 0);
            return;
        }
        
        // Actualizar estadísticas
        const online = data.cameras.filter(c => c.status === 'online').length;
        const offline = data.cameras.length - online;
        updateCameraStats(data.cameras.length, online, offline);
        
        // Generar HTML de las cámaras
        list.innerHTML = data.cameras.map(camera => {
            const statusClass = camera.status === 'online' ? 'camera-online' : 'camera-offline';
            const statusIcon = camera.status === 'online' ? '🟢' : '🔴';
            const brandIcon = getBrandIcon(camera.brand);
            
            return `
                <div class="camera-card ${statusClass}">
                    <div class="camera-header">
                        <div class="camera-brand">${brandIcon} ${camera.brand}</div>
                        <div class="camera-status">${statusIcon} ${camera.status.toUpperCase()}</div>
                    </div>
                    <div class="camera-body">
                        <div class="camera-name">${camera.hostname}</div>
                        <div class="camera-details">
                            <div class="camera-detail">
                                <span class="camera-label">IP:</span>
                                <span class="camera-value">${camera.ip}</span>
                            </div>
                            <div class="camera-detail">
                                <span class="camera-label">MAC:</span>
                                <span class="camera-value">${camera.mac}</span>
                            </div>
                            ${camera.static ? '<span class="badge-static">ESTÁTICA</span>' : '<span class="badge-dynamic">DINÁMICA</span>'}
                            <span class="badge-detection">${camera.detectionMethod}</span>
                        </div>
                    </div>
                    <div class="camera-footer">
                        ${camera.status === 'online' ? `
                            <button class="btn-camera btn-view" onclick="openCameraWeb('${camera.ip}')">
                                🌐 Abrir Web
                            </button>
                            <button class="btn-camera btn-ping" onclick="pingCamera('${camera.ip}')">
                                📡 Ping
                            </button>
                        ` : `
                            <button class="btn-camera btn-disabled" disabled>
                                ⚠️ Desconectada
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando cámaras:', error);
        const list = document.getElementById('cameras-list');
        list.innerHTML = '<div class="loading">Error cargando cámaras</div>';
    }
}

function updateCameraStats(total, online, offline) {
    document.getElementById('cameras-total').textContent = total;
    document.getElementById('cameras-online').textContent = online;
    document.getElementById('cameras-offline').textContent = offline;
}

function getBrandIcon(brand) {
    const icons = {
        'Hikvision': '📹',
        'Dahua': '🎥',
        'Axis': '📷',
        'TP-Link': '📸',
        'Xiaomi': '📹',
        'Reolink': '🎥',
        'Uniview': '📹',
        'Vivotek': '📷',
        'Foscam': '📸',
        'Wyze': '📹',
        'Desconocida': '❓'
    };
    return icons[brand] || '📹';
}

function openCameraWeb(ip) {
    // Intentar abrir en puerto 80 por defecto
    const url = `http://${ip}`;
    window.open(url, '_blank');
    
    // Mostrar mensaje con puertos alternativos
    setTimeout(() => {
        alert(`🌐 Abriendo cámara en: ${url}\n\nSi no funciona, prueba:\n• http://${ip}:8000\n• http://${ip}:8080\n• https://${ip}`);
    }, 500);
}

async function pingCamera(ip) {
    alert(`📡 Ping a ${ip}...\n\n(Esta función requiere herramientas adicionales del sistema)`);
    // En futuras versiones se puede implementar con el MikroTik
}

function showAddManualCamera() {
    document.getElementById('modal-camera-manual').classList.add('active');
}

document.getElementById('form-camera-manual')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/cameras/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Cámara agregada manualmente');
            closeModal('modal-camera-manual');
            loadCameras();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando cámara: ' + error.message);
    }
});

// ==================== WANs FAILOVER ==================== //

async function loadWANsConfig() {
    try {
        // Mostrar estado actual de WANs (informativo)
        const wansResponse = await fetch('/api/wans');
        const wansData = await wansResponse.json();
        const statusList = document.getElementById('wans-status-list');

        if (wansData.wans && wansData.wans.length > 0) {
            statusList.innerHTML = wansData.wans.map(wan => `
                <div class="wan-status-card ${wan.status === 'UP' ? 'wan-up' : 'wan-down'}">
                    <div class="wan-status-header">
                        <h4>${wan.name}</h4>
                        <span class="wan-badge ${wan.status === 'UP' ? 'badge-active' : 'badge-static'}">
                            ${wan.status === 'UP' ? '🟢 ACTIVA' : '🔴 CAÍDA'}
                        </span>
                    </div>
                    <div class="wan-status-details">
                        ${wan.uptimePercentage !== undefined ? `
                            <div class="wan-detail-item">
                                <span>Uptime:</span>
                                <strong>${wan.uptimePercentage.toFixed(1)}%</strong>
                            </div>
                        ` : ''}
                        ${wan.totalFailures !== undefined ? `
                            <div class="wan-detail-item">
                                <span>Fallos Totales:</span>
                                <strong>${wan.totalFailures}</strong>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            statusList.innerHTML = '<div class="loading">No se detectaron WANs</div>';
        }

        // Construir UI de administración: obtener lista de interfaces y la configuración actual
        const ifResp = await fetch('/api/interfaces');
        const ifData = await ifResp.json();
        const adminCfgResp = await fetch('/api/admin/wans-config');
        const adminCfgData = await adminCfgResp.json();
        const adminCfg = adminCfgData.config || { wans: {} };

        const ifList = ifData.interfaces || ifData || [];
        const adminListContainer = document.getElementById('wans-admin-list');

        if (!ifList || ifList.length === 0) {
            adminListContainer.innerHTML = '<div class="loading">No se encontraron interfaces</div>';
        } else {
            adminListContainer.innerHTML = ifList.map(iface => {
                const cfg = adminCfg.wans && adminCfg.wans[iface.name] ? adminCfg.wans[iface.name] : { selected: false, backup: false };
                return `
                    <div class="wan-admin-row" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                        <label style="flex:1;">${iface.name} <small class="muted">${iface.mac || ''}</small></label>
                        <label><input type="checkbox" class="wan-select-cb" data-iface="${iface.name}" ${cfg.selected ? 'checked' : ''}> WAN</label>
                        <label style="margin-left:8px;"><input type="radio" name="wan-backup" class="wan-backup-radio" value="${iface.name}" ${cfg.backup ? 'checked' : ''}> Backup</label>
                    </div>
                `;
            }).join('');
        }

        // Guardar configuración
        document.getElementById('btn-save-wans')?.addEventListener('click', async () => {
            try {
                const selectedElems = Array.from(document.querySelectorAll('.wan-select-cb'));
                const newCfg = { wans: {}, markedDevices: adminCfg.markedDevices || [] };

                selectedElems.forEach(cb => {
                    const name = cb.getAttribute('data-iface');
                    newCfg.wans[name] = newCfg.wans[name] || { selected: false, backup: false };
                    newCfg.wans[name].selected = cb.checked;
                });

                const backupRadio = document.querySelector('.wan-backup-radio:checked');
                if (backupRadio) {
                    const backupName = backupRadio.value;
                    newCfg.wans[backupName] = newCfg.wans[backupName] || { selected: true, backup: false };
                    newCfg.wans[backupName].backup = true;
                }

                const resp = await fetch('/api/admin/wans-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newCfg)
                });

                const r = await resp.json();
                if (r.success) {
                    alert('✅ Configuración WAN guardada');
                } else {
                    alert('❌ Error guardando configuración: ' + (r.message || ''));
                }
            } catch (err) {
                console.error('Error guardando configuración WAN:', err);
                alert('❌ Error guardando configuración WAN');
            }
        });

        // Cargar rutas por defecto (informativo)
        const routesResponse = await fetch('/api/admin/routes');
        const routesData = await routesResponse.json();
        const routesList = document.getElementById('wan-routes-list');
        if (routesData.success && routesData.routes && routesData.routes.length > 0) {
            const defaultRoutes = routesData.routes.filter(r => r['dst-address'] === '0.0.0.0/0' || r['dst-address'] === '0.0.0.0');
            if (defaultRoutes.length > 0) {
                routesList.innerHTML = defaultRoutes.map(route => `
                    <div class="route-item ${route.disabled === 'true' ? 'disabled' : ''}">
                        <div class="route-info">
                            <div class="route-gateway">
                                <strong>Gateway:</strong> ${route.gateway || 'N/A'}
                            </div>
                            <div class="route-details">
                                <span>Distancia: <strong>${route.distance || '1'}</strong></span>
                                <span>Check Gateway: <strong>${route['check-gateway'] || 'N/A'}</strong></span>
                                ${route['routing-mark'] ? `<span>Routing Mark: <strong>${route['routing-mark']}</strong></span>` : ''}
                            </div>
                        </div>
                        <div class="route-status">
                            ${route.disabled === 'true' ? '⚠️ Deshabilitada' : route.active === 'true' ? '✅ Activa' : '⏸️ Inactiva'}
                        </div>
                    </div>
                `).join('');
            } else {
                routesList.innerHTML = '<div class="loading">No hay rutas por defecto configuradas</div>';
            }
        } else {
            routesList.innerHTML = '<div class="loading">No se pudieron cargar las rutas</div>';
        }

    } catch (error) {
        console.error('Error cargando configuración de WANs:', error);
    }
}

// ==================== DHCP ==================== //

async function loadDHCPLeases() {
    try {
        const response = await fetch('/api/admin/dhcp/leases');
        const data = await response.json();
        
        const list = document.getElementById('dhcp-leases-list');
        
        if (!data.success || !data.leases || data.leases.length === 0) {
            list.innerHTML = '<div class="loading">No hay leases DHCP</div>';
            return;
        }
        
        list.innerHTML = data.leases.map(lease => {
            const isDynamic = lease.dynamic === 'true';
            const isActive = lease.status?.includes('bound');
            
            return `
                <div class="rule-item ${lease.disabled === 'true' ? 'disabled' : ''}">
                    <div class="rule-info">
                        <div class="rule-title">
                            ${lease['host-name'] || lease.comment || lease['mac-address']}
                            <span class="badge-status ${isActive ? 'badge-active' : 'badge-inactive'}">
                                ${isDynamic ? 'DINÁMICO' : 'ESTÁTICO'}
                            </span>
                        </div>
                        <div class="rule-details">
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">IP:</span>
                                <span>${lease.address || lease['active-address'] || 'N/A'}</span>
                            </div>
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">MAC:</span>
                                <span>${lease['mac-address'] || lease['active-mac-address'] || 'N/A'}</span>
                            </div>
                            ${lease.server ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">Servidor:</span>
                                    <span>${lease.server}</span>
                                </div>
                            ` : ''}
                            ${lease['expires-after'] ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">Expira:</span>
                                    <span>${lease['expires-after']}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="rule-actions">
                        ${isDynamic ? `
                            <button class="btn-rule btn-enable" onclick="makeStaticLease('${lease['.id']}')">
                                Hacer Estático
                            </button>
                        ` : ''}
                        <button class="btn-rule btn-delete" onclick="deleteDHCPLease('${lease['.id']}')">
                            Eliminar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando leases DHCP:', error);
    }
}

function showAddDHCPLease() {
    document.getElementById('modal-dhcp').classList.add('active');
}

document.getElementById('form-dhcp')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value && value !== 'on') data[key] = value;
    });
    
    // Hacer la reserva estática por defecto
    if (!data['make-static']) {
        data['make-static'] = 'yes';
    }
    
    try {
        const response = await fetch('/api/admin/dhcp/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Reserva DHCP agregada correctamente');
            closeModal('modal-dhcp');
            loadDHCPLeases();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando reserva: ' + error.message);
    }
});

async function makeStaticLease(id) {
    if (!confirm('¿Convertir este lease en una reserva estática?')) return;
    
    try {
        const response = await fetch('/api/admin/dhcp/make-static', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Lease convertido a estático');
            loadDHCPLeases();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteDHCPLease(id) {
    if (!confirm('¿Estás seguro de eliminar esta reserva DHCP?')) return;
    
    try {
        const response = await fetch('/api/admin/dhcp/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadDHCPLeases();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ==================== ROUTES ==================== //

async function loadRoutes() {
    try {
        const response = await fetch('/api/admin/routes');
        const data = await response.json();
        
        const list = document.getElementById('routes-list');
        
        if (!data.success || !data.routes || data.routes.length === 0) {
            list.innerHTML = '<div class="loading">No hay rutas configuradas</div>';
            return;
        }
        
        list.innerHTML = data.routes.map(route => {
            const isDynamic = route.dynamic === 'true';
            const isActive = route.active === 'true';
            
            return `
                <div class="rule-item ${route.disabled === 'true' ? 'disabled' : ''}">
                    <div class="rule-info">
                        <div class="rule-title">
                            ${route['dst-address'] || 'Ruta'}
                            <span class="badge-status ${isActive ? 'badge-active' : 'badge-inactive'}">
                                ${isDynamic ? 'DINÁMICA' : 'ESTÁTICA'}
                            </span>
                        </div>
                        <div class="rule-details">
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Gateway:</span>
                                <span>${route.gateway || 'N/A'}</span>
                            </div>
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Distancia:</span>
                                <span>${route.distance || '1'}</span>
                            </div>
                            ${route['gateway-status'] ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">Estado Gateway:</span>
                                    <span>${route['gateway-status']}</span>
                                </div>
                            ` : ''}
                            ${route.comment ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">Comentario:</span>
                                    <span>${route.comment}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="rule-actions">
                        ${!isDynamic ? `
                            ${route.disabled === 'true' 
                                ? `<button class="btn-rule btn-enable" onclick="toggleRoute('${route['.id']}', false)">Habilitar</button>`
                                : `<button class="btn-rule btn-disable" onclick="toggleRoute('${route['.id']}', true)">Deshabilitar</button>`
                            }
                            <button class="btn-rule btn-delete" onclick="deleteRoute('${route['.id']}')">Eliminar</button>
                        ` : '<span style="color: var(--text-secondary); font-size: 11px;">Ruta dinámica</span>'}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando rutas:', error);
    }
}

function showAddRoute() {
    document.getElementById('modal-route').classList.add('active');
}

document.getElementById('form-route')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/admin/routes/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Ruta agregada correctamente');
            closeModal('modal-route');
            loadRoutes();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando ruta: ' + error.message);
    }
});

async function toggleRoute(id, disable) {
    try {
        const response = await fetch('/api/admin/routes/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, disable })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadRoutes();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteRoute(id) {
    if (!confirm('¿Estás seguro de eliminar esta ruta?')) return;
    
    try {
        const response = await fetch('/api/admin/routes/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadRoutes();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ==================== USERS ==================== //

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        const list = document.getElementById('users-list');
        
        if (!data.success || !data.users || data.users.length === 0) {
            list.innerHTML = '<div class="loading">No hay usuarios configurados</div>';
            return;
        }
        
        list.innerHTML = data.users.map(user => {
            const isDisabled = user.disabled === 'true';
            
            return `
                <div class="rule-item ${isDisabled ? 'disabled' : ''}">
                    <div class="rule-info">
                        <div class="rule-title">
                            👤 ${user.name}
                            <span class="badge-status ${isDisabled ? 'badge-inactive' : 'badge-active'}">
                                ${isDisabled ? 'DESHABILITADO' : 'ACTIVO'}
                            </span>
                        </div>
                        <div class="rule-details">
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Grupo:</span>
                                <span>${user.group || 'N/A'}</span>
                            </div>
                            ${user['last-logged-in'] ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">Último acceso:</span>
                                    <span>${user['last-logged-in']}</span>
                                </div>
                            ` : ''}
                            ${user.address ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">IP permitida:</span>
                                    <span>${user.address}</span>
                                </div>
                            ` : ''}
                            ${user.comment ? `
                                <div class="rule-detail-item">
                                    <span class="rule-detail-label">Comentario:</span>
                                    <span>${user.comment}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="rule-actions">
                        ${user.name !== 'admin' ? `
                            ${isDisabled 
                                ? `<button class="btn-rule btn-enable" onclick="toggleUser('${user['.id']}', false)">Habilitar</button>`
                                : `<button class="btn-rule btn-disable" onclick="toggleUser('${user['.id']}', true)">Deshabilitar</button>`
                            }
                            <button class="btn-rule btn-delete" onclick="deleteUser('${user['.id']}', '${user.name}')">Eliminar</button>
                        ` : '<span style="color: var(--warning); font-size: 11px;">Usuario protegido</span>'}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

function showAddUser() {
    document.getElementById('modal-user').classList.add('active');
}

document.getElementById('form-user')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    // Validar que el nombre de usuario no sea 'admin'
    if (data.name && data.name.toLowerCase() === 'admin') {
        alert('❌ No se puede usar "admin" como nombre de usuario');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/users/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Usuario creado correctamente');
            closeModal('modal-user');
            loadUsers();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error creando usuario: ' + error.message);
    }
});

async function toggleUser(id, disable) {
    try {
        const response = await fetch('/api/admin/users/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, disable })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadUsers();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteUser(id, username) {
    if (username === 'admin') {
        alert('❌ No se puede eliminar el usuario admin');
        return;
    }
    
    if (!confirm(`⚠️ ¿Estás seguro de eliminar el usuario "${username}"?`)) return;
    
    try {
        const response = await fetch('/api/admin/users/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Usuario eliminado');
            loadUsers();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ==================== SCHEDULER ==================== //

async function loadScheduler() {
    try {
        const response = await fetch('/api/admin/scheduler');
        const data = await response.json();
        
        const list = document.getElementById('scheduler-list');
        
        if (!data.success || !data.tasks || data.tasks.length === 0) {
            list.innerHTML = '<div class="loading">No hay tareas programadas</div>';
            return;
        }
        
        list.innerHTML = data.tasks.map(task => `
            <div class="rule-item ${task.disabled === 'true' ? 'disabled' : ''}">
                <div class="rule-info">
                    <div class="rule-title">
                        ${task.name}
                        <span class="badge-status ${task.disabled === 'true' ? 'badge-static' : 'badge-active'}">
                            ${task.disabled === 'true' ? 'DESHABILITADA' : 'ACTIVA'}
                        </span>
                    </div>
                    <div class="rule-details">
                        ${task['start-date'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Fecha inicio:</span>
                                <span>${task['start-date']} ${task['start-time'] || ''}</span>
                            </div>
                        ` : ''}
                        ${task.interval ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Intervalo:</span>
                                <span>${task.interval}</span>
                            </div>
                        ` : ''}
                        ${task['run-count'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Ejecuciones:</span>
                                <span>${task['run-count']}</span>
                            </div>
                        ` : ''}
                        ${task['on-event'] ? `
                            <div class="rule-detail-item">
                                <span class="rule-detail-label">Script:</span>
                                <span class="code-text">${task['on-event'].substring(0, 100)}${task['on-event'].length > 100 ? '...' : ''}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="rule-actions">
                    ${task.disabled === 'true' 
                        ? `<button class="btn-rule btn-enable" onclick="toggleScheduler('${task['.id']}', false)">Habilitar</button>`
                        : `<button class="btn-rule btn-disable" onclick="toggleScheduler('${task['.id']}', true)">Deshabilitar</button>`
                    }
                    <button class="btn-rule btn-delete" onclick="deleteScheduler('${task['.id']}')">Eliminar</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error cargando tareas:', error);
        const list = document.getElementById('scheduler-list');
        list.innerHTML = '<div class="loading">Error cargando tareas programadas</div>';
    }
}

function showAddScheduler() {
    document.getElementById('modal-scheduler').classList.add('active');
}

document.getElementById('form-scheduler')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    formData.forEach((value, key) => {
        if (value) data[key] = value;
    });
    
    try {
        const response = await fetch('/api/admin/scheduler/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Tarea programada agregada correctamente');
            closeModal('modal-scheduler');
            loadScheduler();
            e.target.reset();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error agregando tarea: ' + error.message);
    }
});

async function toggleScheduler(id, disable) {
    try {
        const response = await fetch('/api/admin/scheduler/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, disable })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadScheduler();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

async function deleteScheduler(id) {
    if (!confirm('¿Estás seguro de eliminar esta tarea programada?')) return;
    
    try {
        const response = await fetch('/api/admin/scheduler/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        
        const result = await response.json();
        
        if (result.success) {
            loadScheduler();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// ==================== BACKUP ==================== //

async function loadBackups() {
    try {
        const response = await fetch('/api/admin/backup/list');
        const data = await response.json();
        
        const list = document.getElementById('backups-available');
        
        if (!data.success || !data.backups || data.backups.length === 0) {
            list.innerHTML = '<div class="loading">No hay backups disponibles</div>';
            return;
        }
        
        list.innerHTML = data.backups.map(backup => {
            const size = backup.size ? (parseInt(backup.size) / 1024).toFixed(2) + ' KB' : 'N/A';
            return `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-name">📦 ${backup.name}</div>
                        <div class="backup-details">
                            <span>Tamaño: ${size}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando backups:', error);
        const list = document.getElementById('backups-available');
        list.innerHTML = '<div class="loading">Error cargando backups</div>';
    }
}

async function createBackup() {
    if (!confirm('¿Crear un backup de la configuración actual?')) return;
    
    const name = prompt('Nombre del backup (opcional):');
    
    try {
        const response = await fetch('/api/admin/backup/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name || undefined })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ ' + result.message);
            loadBackups();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error creando backup: ' + error.message);
    }
}

async function exportConfig() {
    const name = prompt('Nombre del archivo de exportación (opcional):');
    
    try {
        const response = await fetch('/api/admin/backup/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name || undefined })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ ' + result.message);
            loadBackups();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error exportando configuración: ' + error.message);
    }
}

async function rebootRouter() {
    if (!confirm('⚠️ ¿Estás seguro de reiniciar el router?\n\nEl router se reiniciará inmediatamente y perderás la conexión.')) return;
    
    try {
        const response = await fetch('/api/admin/system/reboot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ ' + result.message + '\n\nEl router se está reiniciando. Espera unos minutos antes de intentar conectarte nuevamente.');
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error reiniciando router: ' + error.message);
    }
}

async function factoryReset() {
    if (!confirm('⚠️⚠️⚠️ ¿ESTÁS ABSOLUTAMENTE SEGURO?\n\nEsto borrará TODA la configuración del router y lo dejará en estado de fábrica.\n\n⚠️ PERDERÁS TODA LA CONFIGURACIÓN ACTUAL ⚠️')) return;
    
    const confirmation = prompt('Para confirmar, escribe EXACTAMENTE: RESET');
    
    if (confirmation !== 'RESET') {
        alert('❌ Operación cancelada. Confirmación incorrecta.');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/system/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: 'RESET' })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ ' + result.message + '\n\nEl router se está reseteando a configuración de fábrica.\n\nDeberás reconfigurarlo completamente.');
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error reseteando router: ' + error.message);
    }
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
