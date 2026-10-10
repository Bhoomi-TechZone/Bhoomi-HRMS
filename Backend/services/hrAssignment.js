const User = require('../models/User');
const Role = require('../models/Role');
const LeadAssignment = require('../models/LeadAssignment');

/**
 * Intelligent HR Assignment Service
 * Distributes leads based on Source -> Department -> Workload (Lowest Active Leads).
 */
const getNextHR = async (source = '') => {
    try {
        // 1. Determine Target Role based on Source
        let targetRoleName = 'HR'; // Default role
        if (source === 'LinkedIn') targetRoleName = 'HR';

        console.log(`Assignment Logic: Source '${source}' -> Target Role '${targetRoleName}'`);

        // 2. Find the Target Role ID
        let targetRole = await Role.findOne({ name: targetRoleName });

        // Fallback if role doesn't exist (e.g., 'Sales' role missing)
        if (!targetRole && targetRoleName !== 'HR') {
            console.warn(`Role '${targetRoleName}' not found. Falling back to 'HR'.`);
            targetRoleName = 'HR';
            targetRole = await Role.findOne({ name: 'HR' });
        }

        if (!targetRole) {
            console.error('Critical: No suitable Role found for assignment.');
            return null;
        }

        // 3. Find All Active Users with Target Role
        let assignableUsers = await User.find({
            role: targetRole._id,
            isActive: true
        }).select('_id firstName lastName email department');

        // Fallback: If no users found in target role (e.g. no active Sales people), fallback to HR
        if (assignableUsers.length === 0 && targetRoleName !== 'HR') {
            console.log(`No active users found in Role '${targetRoleName}'. Falling back to 'HR'.`);
            const hrRole = await Role.findOne({ name: 'HR' });
            if (hrRole) {
                assignableUsers = await User.find({ role: hrRole._id, isActive: true }).select('_id firstName lastName email department');
            }
        }

        if (assignableUsers.length === 0) return null;

        // 4. Calculate Workload for each User (Count 'New', 'Contacted', 'Interested' leads)
        // IMPORTANT: Status values must match the LeadAssignment schema enum exactly (case-sensitive)
        const workloadPromises = assignableUsers.map(async (user) => {
            const count = await LeadAssignment.countDocuments({
                employee: user._id,
                status: { $in: ['New', 'Contacted', 'Interested'] }
            });
            return { user, count };
        });

        const userWorkloads = await Promise.all(workloadPromises);

        // 5. Sort by Workload (Ascending) -> Load Balancing
        userWorkloads.sort((a, b) => a.count - b.count);

        // Return the User with the lowest workload
        const bestUser = userWorkloads[0].user;
        console.log(`Assigning lead (Source: ${source}) to: ${bestUser.firstName} ${bestUser.lastName} (${bestUser.department || targetRoleName}) - Active Leads: ${userWorkloads[0].count}`);

        return bestUser._id;

    } catch (error) {
        console.error('Error in HR Assignment:', error);
        return null;
    }
};

module.exports = { getNextHR };
