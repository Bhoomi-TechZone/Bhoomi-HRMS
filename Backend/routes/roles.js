const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Role = require('../models/Role');

// Get roles list for dropdowns (no permission required - just authentication)
router.get('/list', auth, async (req, res) => {
  try {
    const roles = await Role.find().select('_id name');
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles list:', error);
    res.status(500).json({ message: 'Error fetching roles list' });
  }
});

// Get all roles
router.get('/', auth, checkPermission('roles', 'read'), async (req, res) => {
  try {
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roles' });
  }
});

// Create role
router.post('/', auth, checkPermission('roles', 'create'), async (req, res) => {
  try {
    console.log('Creating role with data:', JSON.stringify(req.body, null, 2));
    const role = await Role.create(req.body);
    console.log('Role created successfully:', role._id);
    res.status(201).json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    console.error('Error details:', error.message);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({ 
      message: 'Error creating role',
      error: error.message,
      details: error.errors 
    });
  }
});

// Update role
router.put('/:id', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    console.log('Updating role with data:', JSON.stringify(req.body, null, 2));
    const role = await Role.findById(req.params.id);
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    // Warning when updating Admin or Director roles (but allow it)
    if (role.name === 'Admin' || role.name === 'Director') {
      console.warn(`⚠️  WARNING: Updating critical system role: ${role.name}`);
      
      // Ensure at least one admin can still manage roles
      if (req.body.permissions !== undefined) {
        const hasRolesUpdate = req.body.permissions.some(p => 
          p.module === 'roles' && p.actions.includes('update')
        );
        
        if (!hasRolesUpdate) {
          console.warn(`⚠️  WARNING: Removing 'roles update' permission from ${role.name} role may prevent role management`);
        }
      }
    }
    
    if (req.body.name !== undefined) role.name = req.body.name;
    if (req.body.permissions !== undefined) role.permissions = req.body.permissions;
    if (req.body.isDefault !== undefined) role.isDefault = req.body.isDefault;
    
    await role.save();
    
    console.log('Role updated successfully:', role._id);
    res.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    console.error('Error details:', error.message);
    if (error.errors) {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({ 
      message: 'Error updating role',
      error: error.message,
      details: error.errors 
    });
  }
});

// Delete role
router.delete('/:id', auth, checkPermission('roles', 'delete'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    if (role.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default role' });
    }
    
    await role.deleteOne();
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting role' });
  }
});

module.exports = router;
