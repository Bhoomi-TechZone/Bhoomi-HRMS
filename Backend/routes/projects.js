 const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Role = require('../models/Role');
const User = require('../models/User');
const { sendNotification } = require('../utils/socketNotifier');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/projects');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and DOCX files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all unique project types
router.get('/types', auth, async (req, res) => {
  try {
    const types = await Project.distinct('projectTypes');
    res.json(types.filter(t => t));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project types' });
  }
});

// Get all projects (users see projects based on their permissions)
router.get('/', auth, async (req, res) => {
  try {
    const userRole = (req.user.role ? req.user.role.name : '').trim();
    const userRoleLower = userRole.toLowerCase();
    
    // Check if user has projects/accounts read permission OR is in management roles
    const hasReadPermission = req.user.role && req.user.role.permissions && req.user.role.permissions.some(
      p => p.module && ['projects', 'accounts'].includes(p.module.toLowerCase()) && p.actions.includes('read')
    );
    const managementRoles = ['admin', 'sales head', 'saleshead', 'head of sales', 'team leader', 'teamleader', 'hr manager', 'hr', 'manager', 'director', 'project manager'];
    const hasFullAccess = managementRoles.includes(userRoleLower) || hasReadPermission;

    let query = {};
    if (!hasFullAccess) {
      // Users without full access see only projects assigned to them or created by them
      query = {
        $or: [
          { assignedEmployees: req.user._id },
          { createdBy: req.user._id }
        ]
      };
    }

    const projects = await Project.find(query)
      .populate({
        path: 'assignedEmployees',
        select: 'firstName lastName employeeId department designation email officialEmail role',
        populate: { path: 'role', select: 'name' }
      })
      .populate('createdBy', 'firstName lastName')
      .populate('documents.uploadedBy', 'firstName lastName')
      .populate('activities.performedBy', 'firstName lastName')
      .populate('activities.targetUser', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

// Create project (users with create permission)
router.post('/', auth, checkPermission(['projects', 'assignments'], 'create'), upload.array('documents', 5), async (req, res) => {
  try {
    const assignedEmployees = req.body.assignedEmployees ? JSON.parse(req.body.assignedEmployees) : [];
    const projectTypes = req.body.projectTypes ? JSON.parse(req.body.projectTypes) : [];
    
    const datesMap = {};
    if (assignedEmployees.length > 0) {
      const now = new Date();
      assignedEmployees.forEach(id => {
        datesMap[id] = now;
      });
    }

    const activities = [{
      action: 'Project Created',
      performedBy: req.user._id
    }];

    if (assignedEmployees.length > 0) {
      assignedEmployees.forEach(id => {
        activities.push({
          action: 'Assigned',
          targetUser: id,
          performedBy: req.user._id
        });
      });
    }

    const projectData = {
      ...req.body,
      createdBy: req.user._id,
      assignedEmployees,
      projectTypes,
      employeeAssignmentDates: datesMap,
      activities
    };

    // Add uploaded files metadata
    if (req.files && req.files.length > 0) {
      projectData.documents = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: req.user._id
      }));
    }

    const project = await Project.create(projectData);

    await project.populate({
      path: 'assignedEmployees',
      select: 'firstName lastName employeeId department designation email officialEmail role',
      populate: { path: 'role', select: 'name' }
    });
    await project.populate('createdBy', 'firstName lastName');
    await project.populate('documents.uploadedBy', 'firstName lastName');

    // Notifications
    try {
      const io = req.app.get('socketio');
      
      // Notify assigned employees
      if (assignedEmployees.length > 0) {
        Promise.all(
          assignedEmployees
            .filter(empId => String(empId) !== String(req.user._id))
            .map(empId => 
              sendNotification(io, empId, 'Project Assigned', `You have been assigned to project: ${projectData.name}`, 'Project', `/assignments?projectId=${projectData._id}`)
            )
        ).catch(err => console.error(err));
      }

      // Notify Admins
      const adminRole = await Role.findOne({ name: 'Admin' }).select('_id');
      if (adminRole) {
        const admins = await User.find({ role: adminRole._id, isActive: true }).select('_id');
        Promise.all(admins.map(admin => {
          if (String(admin._id) !== String(req.user._id)) {
            return sendNotification(io, admin._id, 'Project Created', `${req.user.firstName} created project: ${projectData.name}`, 'Project', `/projects?projectId=${projectData._id}`);
          }
        })).catch(err => console.error(err));
      }
    } catch (notifyErr) {
      console.error('Error sending project notifications:', notifyErr);
    }

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    // Clean up uploaded files if project creation failed
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, err => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    // Handle duplicate projectId error (should be rare with new logic)
    if (error.code === 11000 && error.keyPattern?.projectId) {
      return res.status(500).json({ message: 'Unable to generate unique project ID. Please try again.' });
    }

    res.status(500).json({ message: 'Error creating project', error: error.message });
  }
});

// Update project
router.put('/:id', auth, checkPermission(['projects', 'assignments', 'accounts'], 'update'), upload.array('documents', 5), async (req, res) => {
  try {
    const updateData = { ...req.body };

    const oldProject = await Project.findById(req.params.id);
    if (!oldProject) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (req.body.assignedEmployees && typeof req.body.assignedEmployees === 'string') {
      updateData.assignedEmployees = JSON.parse(req.body.assignedEmployees);
    }
    
    if (req.body.projectTypes && typeof req.body.projectTypes === 'string') {
      updateData.projectTypes = JSON.parse(req.body.projectTypes);
    }

    if (updateData.assignedEmployees) {
      const currentDates = oldProject.employeeAssignmentDates ? Object.fromEntries(oldProject.employeeAssignmentDates) : {};
      const newDates = { ...currentDates };
      const now = new Date();
      
      updateData.assignedEmployees.forEach(id => {
        if (!newDates[id]) {
          newDates[id] = now;
        }
      });
      
      updateData.employeeAssignmentDates = newDates;
    }

    // Add new uploaded files to existing documents
    if (req.files && req.files.length > 0) {
      const project = oldProject;
      const newDocs = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: req.user._id
      }));
      updateData.documents = [...(project.documents || []), ...newDocs];
    }

    const newActivities = [];
    if (updateData.status && updateData.status !== oldProject.status) {
      newActivities.push({
        action: `Status Changed`,
        message: updateData.statusReason || `Status changed to ${updateData.status}`,
        performedBy: req.user._id,
        details: { oldStatus: oldProject.status, newStatus: updateData.status }
      });
    }

    if (updateData.assignedEmployees) {
      const oldAssigned = oldProject.assignedEmployees.map(id => id.toString());
      const newAssigned = updateData.assignedEmployees.map(id => id.toString());
      
      const added = newAssigned.filter(id => !oldAssigned.includes(id));
      const removed = oldAssigned.filter(id => !newAssigned.includes(id));
      
      added.forEach(id => {
        newActivities.push({
          action: 'Assigned',
          targetUser: id,
          performedBy: req.user._id
        });
      });
      
      removed.forEach(id => {
        newActivities.push({
          action: 'Unassigned',
          targetUser: id,
          performedBy: req.user._id
        });
      });
    }

    if (newActivities.length > 0) {
      updateData.$push = { activities: { $each: newActivities } };
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate({
        path: 'assignedEmployees',
        select: 'firstName lastName employeeId department designation email officialEmail role',
        populate: { path: 'role', select: 'name' }
      })
      .populate('createdBy', 'firstName lastName')
      .populate('documents.uploadedBy', 'firstName lastName')
      .populate('activities.performedBy', 'firstName lastName')
      .populate('activities.targetUser', 'firstName lastName');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Notifications
    try {
      const io = req.app.get('socketio');
      
      // Notify newly assigned employees
      if (updateData.assignedEmployees) {
        const oldAssigned = oldProject.assignedEmployees.map(id => String(id));
        const newAssigned = updateData.assignedEmployees.map(id => String(id));
        const newlyAdded = newAssigned.filter(id => !oldAssigned.includes(id));
        
        if (newlyAdded.length > 0) {
          Promise.all(
            newlyAdded
              .filter(empId => String(empId) !== String(req.user._id))
              .map(empId => 
                sendNotification(io, empId, 'Project Assigned', `You have been added to project: ${project.name}`, 'Project', `/assignments?projectId=${project._id}`)
              )
          ).catch(err => console.error(err));
        }
      }

      // Notify Admins about the update
      const adminRole = await Role.findOne({ name: 'Admin' }).select('_id');
      if (adminRole) {
        const admins = await User.find({ role: adminRole._id, isActive: true }).select('_id');
        Promise.all(admins.map(admin => {
          if (String(admin._id) !== String(req.user._id)) {
            return sendNotification(io, admin._id, 'Project Updated', `${req.user.firstName} updated project: ${project.name}`, 'Project', `/projects?projectId=${project._id}`);
          }
        })).catch(err => console.error(err));
      }
    } catch (notifyErr) {
      console.error('Error sending project update notifications:', notifyErr);
    }

    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, err => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    res.status(500).json({ message: 'Error updating project' });
  }
});

// Delete project
router.delete('/:id', auth, checkPermission(['projects', 'assignments'], 'delete'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Delete associated files
    if (project.documents && project.documents.length > 0) {
      project.documents.forEach(doc => {
        fs.unlink(doc.path, err => {
          if (err) console.error('Error deleting file:', err);
        });
      });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Error deleting project' });
  }
});

// Download project document
router.get('/:id/documents/:docId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const document = project.documents.id(req.params.docId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.download(document.path, document.originalName);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Error downloading document' });
  }
});

// Delete specific document from project
router.delete('/:id/documents/:docId', auth, checkPermission(['projects', 'assignments'], 'update'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const document = project.documents.id(req.params.docId);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Remove document from array
    project.documents.pull(req.params.docId);
    await project.save();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Error deleting document' });
  }
});
// Add a remark to a project
router.post('/:id/remarks', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Remark message is required' });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          activities: {
            action: 'Remark Added',
            message: message,
            performedBy: req.user._id
          }
        }
      },
      { new: true }
    )
    .populate({
      path: 'assignedEmployees',
      select: 'firstName lastName employeeId department designation email officialEmail role',
      populate: { path: 'role', select: 'name' }
    })
    .populate('createdBy', 'firstName lastName')
    .populate('documents.uploadedBy', 'firstName lastName')
    .populate('activities.performedBy', 'firstName lastName')
    .populate('activities.targetUser', 'firstName lastName');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error adding remark:', error);
    res.status(500).json({ message: 'Error adding remark' });
  }
});

module.exports = router;
