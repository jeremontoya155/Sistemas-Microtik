/**
 * MikroTik Dashboard - Rutas
 * Define todas las rutas de la aplicación
 */

module.exports = (app, controller) => {
    
    // ==================== VISTAS ====================
    
    /**
     * GET / - Página principal (Dashboard Ejecutivo)
     */
    app.get('/', (req, res) => {
        res.render('index', {
            title: 'MikroTik Dashboard Ejecutivo',
            status: controller.getStatus()
        });
    });
    
    /**
     * GET /admin - Página de administración
     */
    app.get('/admin', (req, res) => {
        // Proteger acceso: sesión en memoria (root / pirineos25*)
        if (!req.session || !req.session.authenticated) {
            return res.redirect('/admin/login');
        }

        res.render('admin', {
            title: 'Panel de Administración MikroTik'
        });
    });

    // Pantalla de login simple (sin DB)
    app.get('/admin/login', (req, res) => {
        const error = req.query.error === '1';
        res.render('login', { title: 'Login Admin', error });
    });

    // Logout
    app.get('/admin/logout', (req, res) => {
        if (req.session) {
            req.session.destroy(() => {
                res.redirect('/admin/login');
            });
        } else {
            res.redirect('/admin/login');
        }
    });

    // Procesar login (credenciales desde .env)
    app.post('/admin/login', (req, res) => {
        const { username, password } = req.body || {};

        // Credenciales desde variables de entorno
        const adminUser = process.env.ADMIN_USERNAME || 'root';
        const adminPass = process.env.ADMIN_PASSWORD || 'pirineos25*';

        if (username === adminUser && password === adminPass) {
            req.session.authenticated = true;
            return res.redirect('/admin');
        }

        // Registrar intento fallido en el controlador (solo fallos)
        try {
            controller.logAuthFailure(username, req.ip);
        } catch (err) {
            console.error('Error registrando intento fallido:', err.message);
        }

        return res.redirect('/admin/login?error=1');
    });
    
    /**
     * GET /404 - Página de error 404
     */
    app.get('/404', (req, res) => {
        res.render('404', {
            title: 'Página no encontrada'
        });
    });
    
    // ==================== API: CONEXIÓN ====================
    
    /**
     * POST /api/connect - Conectar al MikroTik
     */
    app.post('/api/connect', async (req, res) => {
        try {
            const result = await controller.connect();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/disconnect - Desconectar del MikroTik
     */
    app.post('/api/disconnect', (req, res) => {
        controller.disconnect();
        res.json({
            success: true,
            message: 'Desconectado correctamente'
        });
    });
    
    /**
     * GET /api/status - Estado de la conexión
     */
    app.get('/api/status', (req, res) => {
        res.json(controller.getStatus());
    });
    
    // ==================== API: DATOS ====================
    
    /**
     * GET /api/data - Obtener todos los datos
     */
    app.get('/api/data', (req, res) => {
        res.json(controller.getData());
    });
    
    /**
     * GET /api/traffic - Datos de tráfico
     */
    app.get('/api/traffic', (req, res) => {
        res.json({
            traffic: controller.data.traffic,
            stats: controller.stats
        });
    });
    
    /**
     * GET /api/resources - Recursos del sistema
     */
    app.get('/api/resources', (req, res) => {
        res.json({
            resources: controller.data.resources
        });
    });
    
    /**
     * GET /api/system - Información del sistema
     */
    app.get('/api/system', (req, res) => {
        res.json({
            system: controller.data.system
        });
    });
    
    /**
     * GET /api/interfaces - Interfaces de red
     */
    app.get('/api/interfaces', (req, res) => {
        res.json({
            success: true,
            interfaces: controller.data.interfaces,
            total: controller.data.interfaces.length
        });
    });
    
    /**
     * POST /api/select-interface - Cambiar interfaz seleccionada para el gráfico
     */
    app.post('/api/select-interface', (req, res) => {
        try {
            const { interface: interfaceName } = req.body;
            
            if (!interfaceName) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe especificar una interfaz'
                });
            }
            
            controller.setSelectedInterface(interfaceName);
            
            res.json({
                success: true,
                message: `Interfaz cambiada a: ${interfaceName}`,
                selected: interfaceName
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * GET /api/devices - Dispositivos conectados
     */
    app.get('/api/devices', (req, res) => {
        res.json({
            devices: controller.data.devices,
            total: controller.data.devices.length
        });
    });
    
    /**
     * GET /api/cameras - Cámaras detectadas
     */
    app.get('/api/cameras', (req, res) => {
        const camerasData = controller.getCameras();
        res.json({
            success: true,
            cameras: camerasData.cameras,
            total: camerasData.cameras.length
        });
    });
    
    /**
     * POST /api/cameras/manual - Agregar cámara manualmente
     */
    app.post('/api/cameras/manual', async (req, res) => {
        try {
            const { ip, mac, hostname, brand } = req.body;
            
            if (!ip) {
                return res.status(400).json({
                    success: false,
                    message: 'La IP es obligatoria'
                });
            }
            
            // Agregar a la lista de cámaras
            const manualCamera = {
                id: 'manual-' + Date.now(),
                ip: ip,
                mac: mac || 'N/A',
                hostname: hostname || 'Cámara Manual',
                brand: brand || 'Manual',
                status: 'online',
                detectionMethod: 'Manual',
                static: true,
                manual: true
            };
            
            controller.cameras.push(manualCamera);
            controller.io.emit('cameras_update', { data: controller.cameras });
            
            res.json({
                success: true,
                message: 'Cámara agregada manualmente',
                camera: manualCamera
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * GET /api/logs - Logs del sistema
     */
    app.get('/api/logs', (req, res) => {
        res.json({
            logs: controller.data.logs
        });
    });
    
    /**
     * GET /api/wans - Estado de WANs
     */
    app.get('/api/wans', (req, res) => {
        const wans = Object.entries(controller.data.wans).map(([name, data]) => ({
            name,
            status: data.status ? 'UP' : 'DOWN',
            uptimePercentage: data.uptimePercentage,
            totalFailures: data.totalFailures,
            lastFailure: data.lastFailure
        }));
        
        res.json({
            wans,
            total: wans.length,
            up: wans.filter(w => w.status === 'UP').length,
            down: wans.filter(w => w.status === 'DOWN').length
        });
    });
    
    /**
     * GET /api/security - Datos de seguridad
     */
    app.get('/api/security', (req, res) => {
        res.json({
            security: controller.data.security
        });
    });
    
    // ==================== API: ACCIONES ====================
    
    /**
     * POST /api/device/disconnect - Desconectar un dispositivo
     */
    app.post('/api/device/disconnect', async (req, res) => {
        try {
            const { ip, mac } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            // Buscar y eliminar el lease DHCP
            const leases = await controller.conn.write('/ip/dhcp-server/lease/print');
            
            for (const lease of leases) {
                const leaseIp = lease.address || lease['active-address'];
                const leaseMac = lease['mac-address'];
                
                if (leaseIp === ip || leaseMac === mac) {
                    await controller.conn.write('/ip/dhcp-server/lease/remove', [
                        `=.id=${lease['.id']}`
                    ]);
                    
                    return res.json({
                        success: true,
                        message: `Dispositivo ${ip || mac} desconectado`
                    });
                }
            }
            
            res.status(404).json({
                success: false,
                message: 'Dispositivo no encontrado'
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/interface/toggle - Habilitar/Deshabilitar interfaz
     */
    app.post('/api/interface/toggle', async (req, res) => {
        try {
            const { name, action } = req.body; // action: 'enable' o 'disable'
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const interfaces = await controller.conn.write('/interface/print');
            
            for (const iface of interfaces) {
                if (iface.name === name) {
                    const disabled = action === 'disable' ? 'yes' : 'no';
                    
                    await controller.conn.write('/interface/set', [
                        `=.id=${iface['.id']}`,
                        `=disabled=${disabled}`
                    ]);
                    
                    return res.json({
                        success: true,
                        message: `Interfaz ${name} ${action === 'disable' ? 'deshabilitada' : 'habilitada'}`
                    });
                }
            }
            
            res.status(404).json({
                success: false,
                message: 'Interfaz no encontrada'
            });
            
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== API: GESTIÓN DE ROUTERS ====================
    
    /**
     * GET /api/routers - Obtener lista de routers configurados
     */
    app.get('/api/routers', (req, res) => {
        try {
            const routers = controller.getRouters();
            const activeId = controller.activeRouter ? controller.activeRouter.id : null;
            const defaultId = controller.routersConfig.defaultRouter;
            
            res.json({
                success: true,
                routers: routers.map(r => ({
                    ...r,
                    password: '***' // No enviar password al cliente
                })),
                activeRouter: activeId,
                defaultRouter: defaultId
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/routers/add - Agregar nuevo router
     */
    app.post('/api/routers/add', (req, res) => {
        try {
            const { name, host, username, password, port } = req.body;
            
            if (!name || !host || !username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan datos requeridos'
                });
            }
            
            const newRouter = controller.addRouter({ name, host, username, password, port });
            
            res.json({
                success: true,
                message: 'Router agregado correctamente',
                router: { ...newRouter, password: '***' }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * PUT /api/routers/:id - Actualizar router
     */
    app.put('/api/routers/:id', (req, res) => {
        try {
            const { id } = req.params;
            const updatedRouter = controller.updateRouter(id, req.body);
            
            res.json({
                success: true,
                message: 'Router actualizado',
                router: { ...updatedRouter, password: '***' }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * DELETE /api/routers/:id - Eliminar router
     */
    app.delete('/api/routers/:id', (req, res) => {
        try {
            const { id } = req.params;
            controller.deleteRouter(id);
            
            res.json({
                success: true,
                message: 'Router eliminado'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/routers/:id/default - Establecer router por defecto
     */
    app.post('/api/routers/:id/default', (req, res) => {
        try {
            const { id } = req.params;
            const router = controller.setDefaultRouter(id);
            
            res.json({
                success: true,
                message: `${router.name} establecido como router por defecto`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/routers/:id/switch - Cambiar a otro router
     */
    app.post('/api/routers/:id/switch', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await controller.switchRouter(id);
            
            res.json({
                success: result.success,
                message: result.message,
                router: controller.activeRouter
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== API: ADMINISTRACIÓN ====================
    
    /**
     * GET /api/admin/firewall/rules - Obtener reglas de firewall
     */
    app.get('/api/admin/firewall/rules', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const rules = await controller.connection.write('/ip/firewall/filter/print');
            
            res.json({
                success: true,
                rules: rules
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/firewall/add - Agregar regla de firewall
     */
    app.post('/api/admin/firewall/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = [];
            Object.entries(req.body).forEach(([key, value]) => {
                if (value) params.push(`=${key}=${value}`);
            });
            
            await controller.connection.write('/ip/firewall/filter/add', params);
            
            res.json({
                success: true,
                message: 'Regla agregada correctamente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/firewall/toggle - Habilitar/Deshabilitar regla de firewall
     */
    app.post('/api/admin/firewall/toggle', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id, disable } = req.body;
            
            await controller.connection.write('/ip/firewall/filter/set', [
                `=.id=${id}`,
                `=disabled=${disable ? 'yes' : 'no'}`
            ]);
            
            res.json({
                success: true,
                message: disable ? 'Regla deshabilitada' : 'Regla habilitada'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/firewall/delete - Eliminar regla de firewall
     */
    app.post('/api/admin/firewall/delete', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id } = req.body;
            
            await controller.connection.write('/ip/firewall/filter/remove', [
                `=.id=${id}`
            ]);
            
            res.json({
                success: true,
                message: 'Regla eliminada'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * GET /api/admin/nat/rules - Obtener reglas NAT
     */
    app.get('/api/admin/nat/rules', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const rules = await controller.connection.write('/ip/firewall/nat/print');
            
            res.json({
                success: true,
                rules: rules
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/nat/add - Agregar regla NAT
     */
    app.post('/api/admin/nat/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = Object.entries(req.body).map(([key, value]) => `=${key}=${value}`);
            await controller.connection.write(['/ip/firewall/nat/add', ...params]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/nat/edit - Editar regla NAT
     */
    app.post('/api/admin/nat/edit', async (req, res) => {
        try {
            const { id, changes } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = Object.entries(changes)
                .filter(([key, value]) => value)
                .map(([key, value]) => `=${key}=${value}`);
            
            await controller.connection.write([
                '/ip/firewall/nat/set',
                `=.id=${id}`,
                ...params
            ]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/nat/toggle - Habilitar/deshabilitar regla NAT
     */
    app.post('/api/admin/nat/toggle', async (req, res) => {
        try {
            const { id, disable } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write([
                '/ip/firewall/nat/set',
                `=.id=${id}`,
                `=disabled=${disable}`
            ]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/nat/delete - Eliminar regla NAT
     */
    app.post('/api/admin/nat/delete', async (req, res) => {
        try {
            const { id } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write(['/ip/firewall/nat/remove', `=.id=${id}`]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * GET /api/admin/wans-config - Obtener configuración de WANs administrada desde el panel
     */
    app.get('/api/admin/wans-config', (req, res) => {
        try {
            const config = controller.getAdminConfig();
            res.json({ success: true, config });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    /**
     * POST /api/admin/wans-config - Actualizar configuración de WANs (en memoria)
     */
    app.post('/api/admin/wans-config', (req, res) => {
        try {
            const newConfig = req.body || {};
            controller.setAdminConfig(newConfig);
            res.json({ success: true, config: controller.getAdminConfig() });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    /**
     * GET /api/admin/marked-devices - Obtener dispositivos marcados
     */
    app.get('/api/admin/marked-devices', (req, res) => {
        try {
            const config = controller.getAdminConfig();
            res.json({ success: true, markedDevices: config.markedDevices || [] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    /**
     * POST /api/admin/marked-devices - Actualizar dispositivos marcados
     */
    app.post('/api/admin/marked-devices', (req, res) => {
        try {
            const { markedDevices } = req.body || {};
            const cfg = controller.getAdminConfig();
            cfg.markedDevices = Array.isArray(markedDevices) ? markedDevices : cfg.markedDevices;
            controller.setAdminConfig(cfg);
            res.json({ success: true, markedDevices: cfg.markedDevices });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    
    /**
     * GET /api/admin/queue/simple - Obtener colas simples
     */
    app.get('/api/admin/queue/simple', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const queues = await controller.connection.write('/queue/simple/print');
            
            res.json({
                success: true,
                queues: queues
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/queue/add - Agregar cola simple
     */
    app.post('/api/admin/queue/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = Object.entries(req.body).map(([key, value]) => `=${key}=${value}`);
            await controller.connection.write(['/queue/simple/add', ...params]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/queue/toggle - Habilitar/deshabilitar cola
     */
    app.post('/api/admin/queue/toggle', async (req, res) => {
        try {
            const { id, disable } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write([
                '/queue/simple/set',
                `=.id=${id}`,
                `=disabled=${disable}`
            ]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    /**
     * POST /api/admin/queue/delete - Eliminar cola
     */
    app.post('/api/admin/queue/delete', async (req, res) => {
        try {
            const { id } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write(['/queue/simple/remove', `=.id=${id}`]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * GET /api/interfaces - Obtener interfaces
     */
    app.get('/api/interfaces', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const interfaces = await controller.connection.write('/interface/print');
            
            res.json({
                success: true,
                interfaces: interfaces
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== API: DHCP ====================
    
    /**
     * GET /api/admin/dhcp/leases - Obtener leases DHCP
     */
    app.get('/api/admin/dhcp/leases', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const leases = await controller.connection.write('/ip/dhcp-server/lease/print');
            
            res.json({
                success: true,
                leases: leases
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/dhcp/add - Agregar reserva DHCP
     */
    app.post('/api/admin/dhcp/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = [];
            Object.entries(req.body).forEach(([key, value]) => {
                if (value) params.push(`=${key}=${value}`);
            });
            
            await controller.connection.write('/ip/dhcp-server/lease/add', params);
            
            res.json({
                success: true,
                message: 'Reserva DHCP agregada correctamente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/dhcp/delete - Eliminar reserva DHCP
     */
    app.post('/api/admin/dhcp/delete', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id } = req.body;
            
            await controller.connection.write('/ip/dhcp-server/lease/remove', [
                `=.id=${id}`
            ]);
            
            res.json({
                success: true,
                message: 'Reserva DHCP eliminada'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/dhcp/make-static - Convertir lease a estático
     */
    app.post('/api/admin/dhcp/make-static', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id } = req.body;
            
            await controller.connection.write('/ip/dhcp-server/lease/make-static', [
                `=.id=${id}`
            ]);
            
            res.json({
                success: true,
                message: 'Lease convertido a estático'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== API: RUTAS ====================
    
    /**
     * GET /api/admin/routes - Obtener rutas
     */
    app.get('/api/admin/routes', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const routes = await controller.connection.write('/ip/route/print');
            
            res.json({
                success: true,
                routes: routes
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/routes/add - Agregar ruta estática
     */
    app.post('/api/admin/routes/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = [];
            Object.entries(req.body).forEach(([key, value]) => {
                if (value) params.push(`=${key}=${value}`);
            });
            
            await controller.connection.write('/ip/route/add', params);
            
            res.json({
                success: true,
                message: 'Ruta agregada correctamente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/routes/delete - Eliminar ruta
     */
    app.post('/api/admin/routes/delete', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id } = req.body;
            
            await controller.connection.write('/ip/route/remove', [
                `=.id=${id}`
            ]);
            
            res.json({
                success: true,
                message: 'Ruta eliminada'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/routes/toggle - Habilitar/Deshabilitar ruta
     */
    app.post('/api/admin/routes/toggle', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id, disable } = req.body;
            
            await controller.connection.write('/ip/route/set', [
                `=.id=${id}`,
                `=disabled=${disable ? 'yes' : 'no'}`
            ]);
            
            res.json({
                success: true,
                message: disable ? 'Ruta deshabilitada' : 'Ruta habilitada'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== API: USUARIOS ====================
    
    /**
     * GET /api/admin/users - Obtener usuarios del sistema
     */
    app.get('/api/admin/users', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const users = await controller.connection.write('/user/print');
            
            res.json({
                success: true,
                users: users
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/users/add - Agregar usuario
     */
    app.post('/api/admin/users/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = [];
            Object.entries(req.body).forEach(([key, value]) => {
                if (value) params.push(`=${key}=${value}`);
            });
            
            await controller.connection.write('/user/add', params);
            
            res.json({
                success: true,
                message: 'Usuario creado correctamente'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/users/delete - Eliminar usuario
     */
    app.post('/api/admin/users/delete', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id } = req.body;
            
            await controller.connection.write('/user/remove', [
                `=.id=${id}`
            ]);
            
            res.json({
                success: true,
                message: 'Usuario eliminado'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/users/toggle - Habilitar/Deshabilitar usuario
     */
    app.post('/api/admin/users/toggle', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const { id, disable } = req.body;
            
            await controller.connection.write('/user/set', [
                `=.id=${id}`,
                `=disabled=${disable ? 'yes' : 'no'}`
            ]);
            
            res.json({
                success: true,
                message: disable ? 'Usuario deshabilitado' : 'Usuario habilitado'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== SCHEDULER ====================
    
    /**
     * GET /api/admin/scheduler - Obtener tareas programadas
     */
    app.get('/api/admin/scheduler', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const tasks = await controller.connection.write('/system/scheduler/print');
            
            res.json({
                success: true,
                tasks: tasks
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/scheduler/add - Agregar tarea programada
     */
    app.post('/api/admin/scheduler/add', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const params = Object.entries(req.body).map(([key, value]) => `=${key}=${value}`);
            await controller.connection.write(['/system/scheduler/add', ...params]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/scheduler/toggle - Habilitar/Deshabilitar tarea
     */
    app.post('/api/admin/scheduler/toggle', async (req, res) => {
        try {
            const { id, disable } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write([
                '/system/scheduler/set',
                `=.id=${id}`,
                `=disabled=${disable}`
            ]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/scheduler/delete - Eliminar tarea
     */
    app.post('/api/admin/scheduler/delete', async (req, res) => {
        try {
            const { id } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write(['/system/scheduler/remove', `=.id=${id}`]);
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== BACKUP & SYSTEM ====================
    
    /**
     * POST /api/admin/backup/create - Crear backup
     */
    app.post('/api/admin/backup/create', async (req, res) => {
        try {
            const { name } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const backupName = name || `backup-${Date.now()}`;
            
            await controller.connection.write([
                '/system/backup/save',
                `=name=${backupName}`
            ]);
            
            res.json({ 
                success: true,
                message: `Backup "${backupName}" creado correctamente`,
                filename: backupName + '.backup'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * GET /api/admin/backup/list - Listar backups
     */
    app.get('/api/admin/backup/list', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const files = await controller.connection.write('/file/print');
            const backups = files.filter(file => file.name.endsWith('.backup'));
            
            res.json({
                success: true,
                backups: backups
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/backup/export - Exportar configuración
     */
    app.post('/api/admin/backup/export', async (req, res) => {
        try {
            const { name } = req.body;
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            const exportName = name || `export-${Date.now()}`;
            
            await controller.connection.write([
                '/export',
                `=file=${exportName}`
            ]);
            
            res.json({ 
                success: true,
                message: `Configuración exportada como "${exportName}.rsc"`,
                filename: exportName + '.rsc'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/system/reboot - Reiniciar router
     */
    app.post('/api/admin/system/reboot', async (req, res) => {
        try {
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            // Programar reinicio en 5 segundos
            await controller.connection.write('/system/reboot');
            
            res.json({ 
                success: true,
                message: 'Router reiniciándose...'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    /**
     * POST /api/admin/system/reset - Reset de fábrica
     */
    app.post('/api/admin/system/reset', async (req, res) => {
        try {
            const { confirm } = req.body;
            
            if (confirm !== 'RESET') {
                return res.status(400).json({
                    success: false,
                    message: 'Confirmación incorrecta. Escribe RESET para confirmar.'
                });
            }
            
            if (!controller.isConnected) {
                return res.status(400).json({
                    success: false,
                    message: 'No conectado al MikroTik'
                });
            }
            
            await controller.connection.write([
                '/system/reset-configuration',
                '=no-defaults=yes'
            ]);
            
            res.json({ 
                success: true,
                message: 'Router reseteándose a configuración de fábrica...'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });
    
    // ==================== HEALTH CHECK ====================
    
    /**
     * GET /health - Health check endpoint
     */
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            mikrotik: controller.getStatus()
        });
    });
};
