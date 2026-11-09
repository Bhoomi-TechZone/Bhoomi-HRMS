const checkPermission = (moduleOrModules, actionOrActions) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;

      if (!userRole) {
        return res.status(403).json({ message: 'Access denied: No role assigned' });
      }

      const roleName = (typeof userRole === 'object' && userRole !== null ? userRole.name : userRole || '').toLowerCase().trim();
      // Admin, Super Admin, Director roles have full access
      if (roleName === 'admin' || roleName === 'super admin' || roleName === 'director' || req.user?.isAdmin) {
        return next();
      }

      if (!userRole.permissions || !Array.isArray(userRole.permissions) || userRole.permissions.length === 0) {
        return res.status(403).json({ message: 'Access denied: No permissions assigned' });
      }

      const modules = (Array.isArray(moduleOrModules) ? moduleOrModules : [moduleOrModules]).map(m => m.toLowerCase().trim());
      const actions = (Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]).map(a => a.toLowerCase().trim());

      const hasPerm = modules.some(module => {
        const modulePermission = userRole.permissions.find(p => p.module && p.module.toLowerCase().trim() === module);
        if (!modulePermission || !Array.isArray(modulePermission.actions)) return false;
        const roleActions = modulePermission.actions.map(a => a.toLowerCase().trim());
        return actions.some(action => roleActions.includes(action));
      });

      if (!hasPerm) {
        return res.status(403).json({ message: `Access denied: No ${actions.join(' or ')} permission for ${modules.join(' or ')}` });
      }

      return next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

module.exports = checkPermission;
