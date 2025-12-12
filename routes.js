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
        res.render('admin', {
            title: 'Panel de Administración MikroTik'
        });
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
            interfaces: controller.data.interfaces,
            total: controller.data.interfaces.length
        });
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
