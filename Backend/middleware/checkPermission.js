const checkPermission = (moduleOrModules, actionOrActions) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;

      if (!userRole || !userRole.permissions) {
        return res.status(403).json({ message: 'Access denied: No permissions assigned' });
      }

      const modules = (Array.isArray(moduleOrModules) ? moduleOrModules : [moduleOrModules]).map(m => m.toLowerCase().trim());
      const actions = (Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]).map(a => a.toLowerCase().trim());
      
      if (userRole.permissions && Array.isArray(userRole.permissions) && userRole.permissions.length > 0) {
        const hasPerm = modules.some(module => {
          const modulePermission = userRole.permissions.find(p => p.module && p.module.toLowerCase().trim() === module);
          if (!modulePermission || !Array.isArray(modulePermission.actions)) return false;
          const roleActions = modulePermission.actions.map(a => a.toLowerCase().trim());
          return actions.some(action => roleActions.includes(action));
        });

        if (!hasPerm) {
          console.log(`Access denied for role ${userRole.name}: No ${actions.join(' or ')} permission for ${modules.join(' or ')}`);
          return res.status(403).json({ message: `Access denied: No ${actions.join(' or ')} permission for ${modules.join(' or ')}` });
        }

        return next();
      }

      // Default fallback if role has no permissions array configured
      if ((userRole.name && userRole.name.toLowerCase().trim() === 'admin') || userRole === 'Admin') {
        return next();
      }

      return res.status(403).json({ message: 'Access denied: No permissions assigned' });

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

module.exports = checkPermission;
