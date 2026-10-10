const mongoose = require('mongoose');
const User = require('./models/User');
const Role = require('./models/Role');
require('dotenv').config({ override: true });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({ isActive: true }).populate('role', 'name');
  console.log("Users and roles:");
  users.forEach(u => {
    console.log(`${u.firstName} ${u.lastName} - Role: ${u.role ? u.role.name : 'NONE'}`);
  });
  process.exit(0);
}
check();
