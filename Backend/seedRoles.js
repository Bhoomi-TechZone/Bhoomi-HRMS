require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./models/Role');

const roles = [
  {
    name: 'Admin',
    isDefault: true,
    permissions: [
      { module: 'broadcasts', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'assignments', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'goals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'projects', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'clients', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'deals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'accounts', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'proposals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'letters', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'assets', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'leaves', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'attendance', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'employees', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'roles', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'payroll', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'biometric-logs', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'recruitment', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'requests', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'sales', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'history', actions: ['read'] },
      { module: 'nda', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'sales-reports', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'devices', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'biometric-attendance', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'weekly-updates', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'calendar', actions: ['create', 'read', 'update', 'delete'] }
    ]
  },
  {
    name: 'HR',
    isDefault: true,
    permissions: [
      { module: 'broadcasts', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'goals', actions: ['create', 'read', 'update'] },
      { module: 'projects', actions: ['read'] },
      { module: 'assets', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'leaves', actions: ['read', 'update'] },
      { module: 'requests', actions: ['read', 'update'] },
      { module: 'employees', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'deals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'payroll', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'attendance', actions: ['read', 'update'] },
      { module: 'history', actions: ['read'] },
      { module: 'nda', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'sales-reports', actions: ['read'] },
      { module: 'devices', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'biometric-attendance', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'documents', actions: ['create', 'read', 'update', 'delete'] }, // HR has full access to documents
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'proposals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'weekly-updates', actions: ['read', 'update'] }, // Review
      { module: 'recruitment', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'calendar', actions: ['create', 'read', 'update', 'delete'] }
    ]
  },
  {
    name: 'Employee',
    isDefault: true,
    permissions: [
      { module: 'broadcasts', actions: ['read'] },
      { module: 'goals', actions: ['create', 'read', 'update'] },
      { module: 'projects', actions: ['read', 'update'] },
      { module: 'assets', actions: ['read'] },
      { module: 'leaves', actions: ['create', 'read'] },
      { module: 'requests', actions: ['create', 'read'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'leads', actions: ['read', 'update'] },
      { module: 'deals', actions: ['create', 'read', 'update'] },
      { module: 'attendance', actions: ['read'] },
      { module: 'nda', actions: ['read'] },
      { module: 'documents', actions: ['create', 'read'] }, // Employees can upload and view their own documents
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'weekly-updates', actions: ['create', 'read'] }, // Submit / View Own
      { module: 'calendar', actions: ['read'] }
    ]
  },
  {
    name: 'Sales',
    isDefault: true,
    permissions: [
      { module: 'broadcasts', actions: ['read'] },
      { module: 'goals', actions: ['create', 'read', 'update'] },
      { module: 'projects', actions: ['read'] },
      { module: 'assets', actions: ['read'] },
      { module: 'leaves', actions: ['create', 'read'] },
      { module: 'requests', actions: ['create', 'read'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'sales', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'deals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'attendance', actions: ['read'] },
      { module: 'nda', actions: ['read'] }, // Sales can upload and view their own documents
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'sales-reports', actions: ['create', 'read', 'update'] },
      { module: 'documents', actions: ['create', 'read'] }, // Sales can upload and view their own documents
      { module: 'weekly-updates', actions: ['create', 'read'] }, // Submit / View Own
      { module: 'calendar', actions: ['read'] }
    ]
  },
  {
    name: 'Manager',
    isDefault: false,
    permissions: [
      { module: 'broadcasts', actions: ['read', 'create'] },
      { module: 'goals', actions: ['create', 'read', 'update'] },
      { module: 'projects', actions: ['create', 'read', 'update'] },
      { module: 'assets', actions: ['read'] },
      { module: 'leaves', actions: ['read', 'update'] },
      { module: 'requests', actions: ['read', 'update'] },
      { module: 'employees', actions: ['read'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'leads', actions: ['read'] },
      { module: 'deals', actions: ['read', 'update'] },
      { module: 'payroll', actions: ['read'] },
      { module: 'attendance', actions: ['read', 'update'] },
      { module: 'history', actions: ['read'] },
      { module: 'sales-reports', actions: ['read'] },
      { module: 'documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'weekly-updates', actions: ['read', 'update'] }, // Manager can review
      { module: 'calendar', actions: ['create', 'read', 'update'] }
    ]
  },
  {
    name: 'Director',
    isDefault: false,
    permissions: [ // Director usually has Admin-like permissions
      { module: 'broadcasts', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'goals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'projects', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'assets', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'leaves', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'requests', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'employees', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'roles', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'leads', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'sales', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'deals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'payroll', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'attendance', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'history', actions: ['read'] },
      { module: 'nda', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'sales-reports', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'devices', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'biometric-attendance', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'proposals', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'weekly-updates', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'calendar', actions: ['create', 'read', 'update', 'delete'] }
    ]
  },
  {
    name: 'Developer',
    isDefault: false,
    permissions: [
      { module: 'broadcasts', actions: ['read'] },
      { module: 'goals', actions: ['create', 'read', 'update'] },
      { module: 'projects', actions: ['read', 'update'] },
      { module: 'assets', actions: ['read'] },
      { module: 'leaves', actions: ['create', 'read'] },
      { module: 'requests', actions: ['create', 'read'] },
      { module: 'profile', actions: ['read', 'update'] },
      { module: 'leads', actions: ['read'] }, // Developers might need to see leads if working on CRM features? Adjusted to read.
      { module: 'attendance', actions: ['read'] },
      { module: 'nda', actions: ['read'] },
      { module: 'documents', actions: ['create', 'read'] }, // Developers can upload docs
      { module: 'my-documents', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'my-payslips', actions: ['read'] },
      { module: 'weekly-updates', actions: ['create', 'read'] }, // Submit / View Own
      { module: 'calendar', actions: ['read'] }
    ]
  }
];

async function seedRoles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Update or create roles
    for (const roleData of roles) {
      const existingRole = await Role.findOne({ name: roleData.name });

      if (existingRole) {
        // Update existing role
        await Role.findByIdAndUpdate(existingRole._id, roleData, { runValidators: true });
        console.log(`✅ Updated role: ${roleData.name}`);
      } else {
        // Create new role
        await Role.create(roleData);
        console.log(`✅ Created role: ${roleData.name}`);
      }
    }

    console.log('\n🎉 Roles seeded successfully!');
    console.log('\nRole Permissions Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Documents Module:');
    console.log('  - Admin: create, read, update, delete (full access)');
    console.log('  - HR: create, read, update, delete (full access)');
    console.log('  - Manager: create, read, update, delete (full access)');
    console.log('');
    console.log('📄 My Documents & My Payslips:');
    console.log('  - All roles: read permission (view own data)');
    console.log('  - Employee: create, read (upload & view own documents)');
    console.log('  - Sales: create, read (upload & view own documents)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
    process.exit(1);
  }
}

seedRoles();
