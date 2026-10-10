const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Broadcast = require('../models/Broadcast');
const BroadcastComment = require('../models/BroadcastComment');
const User = require('../models/User');
const { sendNotification } = require('../utils/socketNotifier');

// Get all broadcasts with comments
router.get('/', auth, async (req, res) => {
  try {
    const broadcasts = await Broadcast.find({ isActive: true })
      .populate({
        path: 'createdBy',
        select: 'firstName lastName role',
        populate: { path: 'role', select: 'name' }
      })
      .sort({ createdAt: -1 });
    
    // Fetch comments for each broadcast
    const broadcastsWithComments = await Promise.all(
      broadcasts.map(async (broadcast) => {
        const comments = await BroadcastComment.find({ broadcast: broadcast._id })
          .populate('commentedBy', 'firstName lastName')
          .sort({ createdAt: 1 });
        
        return {
          ...broadcast.toObject(),
          comments: comments,
          viewCount: broadcast.viewedBy.length
        };
      })
    );
    
    res.json(broadcastsWithComments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching broadcasts' });
  }
});

// Create broadcast
router.post('/', auth, checkPermission('broadcasts', 'create'), async (req, res) => {
  try {
    const { title, message, priority } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    if (!priority || !['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ message: 'Priority is required and must be low, medium, or high' });
    }

    const broadcast = await Broadcast.create({
      title: title.trim(),
      message: message.trim(),
      priority,
      createdBy: req.user._id,
      createdByRole: req.user?.role?.name || ''
    });
    
    await broadcast.populate({
      path: 'createdBy',
      select: 'firstName lastName role',
      populate: { path: 'role', select: 'name' }
    });

    // Notify all active users
    try {
      const users = await User.find({ isActive: true }).select('_id');
      const io = req.app.get('socketio');
      
      // Send notifications asynchronously to everyone EXCEPT the creator
      Promise.all(
        users
          .filter(u => u._id.toString() !== req.user._id.toString())
          .map(u => 
            sendNotification(
              io, 
              u._id, 
              'New Announcement', 
              `${req.user.firstName} posted: ${title}`, 
              'Announcement', 
              '/broadcasts'
            )
          )
      ).catch(err => console.error('Error broadcasting notifications:', err));
    } catch (notifyErr) {
      console.error('Error setting up broadcast notifications:', notifyErr);
    }

    res.status(201).json(broadcast);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error creating broadcast' });
  }
});

// Update broadcast
router.put('/:id', auth, checkPermission('broadcasts', 'update'), async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }

    // Only Admin, HR Manager, or the creator can update
    const isCreator = broadcast.createdBy.toString() === req.user._id.toString();
    const isAdminOrHR = req.user.role && (req.user.role.name === 'Admin' || req.user.role.name === 'HR Manager');

    if (!isCreator && !isAdminOrHR) {
      return res.status(403).json({ message: 'Access denied: You can only update your own broadcasts' });
    }

    const updatedBroadcast = await Broadcast.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');
    
    res.json(updatedBroadcast);
  } catch (error) {
    res.status(500).json({ message: 'Error updating broadcast' });
  }
});

// Delete broadcast
router.delete('/:id', auth, checkPermission('broadcasts', 'delete'), async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }

    // Only Admin, HR Manager, or the creator can delete
    const isCreator = broadcast.createdBy.toString() === req.user._id.toString();
    const isAdminOrHR = req.user.role && (req.user.role.name === 'Admin' || req.user.role.name === 'HR Manager');

    if (!isCreator && !isAdminOrHR) {
      return res.status(403).json({ message: 'Access denied: You can only delete your own broadcasts' });
    }

    await Broadcast.findByIdAndDelete(req.params.id);
    res.json({ message: 'Broadcast deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting broadcast' });
  }
});

// Mark broadcast as viewed
router.post('/:id/view', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }
    
    // Add user to viewedBy array if not already there
    if (!broadcast.viewedBy.includes(req.user._id)) {
      broadcast.viewedBy.push(req.user._id);
      await broadcast.save();
    }
    
    res.json({ message: 'Broadcast marked as viewed' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking broadcast as viewed' });
  }
});

// Get unviewed broadcasts count
router.get('/unviewed/count', auth, async (req, res) => {
  try {
    const count = await Broadcast.countDocuments({
      isActive: true,
      viewedBy: { $ne: req.user._id }
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unviewed count' });
  }
});

// Add comment to broadcast
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const { comment } = req.body;
    
    if (!comment || comment.trim() === '') {
      return res.status(400).json({ message: 'Comment cannot be empty' });
    }
    
    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }
    
    const newComment = await BroadcastComment.create({
      broadcast: req.params.id,
      comment: comment.trim(),
      commentedBy: req.user._id
    });

    broadcast.commentsCount = (broadcast.commentsCount || 0) + 1;
    await broadcast.save();
    
    await newComment.populate('commentedBy', 'firstName lastName');
    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: 'Error adding comment' });
  }
});

// React/Like a broadcast (toggle)
router.post('/:id/react', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }

    const alreadyLiked = broadcast.likes.some(userId => userId.toString() === req.user._id.toString());

    if (alreadyLiked) {
      broadcast.likes = broadcast.likes.filter(userId => userId.toString() !== req.user._id.toString());
    } else {
      broadcast.likes.push(req.user._id);
    }

    broadcast.likesCount = broadcast.likes.length;
    await broadcast.save();

    res.json({
      message: alreadyLiked ? 'Reaction removed' : 'Reaction added',
      likesCount: broadcast.likesCount,
      liked: !alreadyLiked
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating reaction' });
  }
});

// Share a broadcast
router.post('/:id/share', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }

    const alreadyShared = broadcast.shares.some(userId => userId.toString() === req.user._id.toString());

    if (!alreadyShared) {
      broadcast.shares.push(req.user._id);
    }

    broadcast.sharesCount = broadcast.shares.length;
    await broadcast.save();

    res.json({
      message: 'Broadcast shared successfully',
      sharesCount: broadcast.sharesCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sharing broadcast' });
  }
});

// Get list of users who liked a broadcast
router.get('/:id/likes', auth, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id)
      .populate({
        path: 'likes',
        select: 'firstName lastName role',
        populate: { path: 'role', select: 'name' }
      });

    if (!broadcast) {
      return res.status(404).json({ message: 'Broadcast not found' });
    }

    res.json(broadcast.likes || []);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching likes' });
  }
});

// Get comments for a broadcast
router.get('/:id/comments', auth, async (req, res) => {
  try {
    const comments = await BroadcastComment.find({ broadcast: req.params.id })
      .populate('commentedBy', 'firstName lastName')
      .sort({ createdAt: 1 });
    
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

// Delete comment
router.delete('/:broadcastId/comments/:commentId', auth, checkPermission('broadcasts', 'delete'), async (req, res) => {
  try {
    const comment = await BroadcastComment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    await BroadcastComment.findByIdAndDelete(req.params.commentId);
        const commentsCount = await BroadcastComment.countDocuments({ broadcast: req.params.broadcastId });
        await Broadcast.findByIdAndUpdate(req.params.broadcastId, { commentsCount });
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

// ===== ADMIN SPECIFIC ROUTES =====

// Admin: Get all broadcasts with all comments (Admin Panel View)
router.get('/admin/all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role || req.user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    const broadcasts = await Broadcast.find({ isActive: true })
      .populate({
        path: 'createdBy',
        select: 'firstName lastName employeeId role',
        populate: { path: 'role', select: 'name' }
      })
      .sort({ createdAt: -1 });
    
    // Fetch all comments for each broadcast with detailed user info
    const broadcastsWithComments = await Promise.all(
      broadcasts.map(async (broadcast) => {
        const comments = await BroadcastComment.find({ broadcast: broadcast._id })
          .populate('commentedBy', 'firstName lastName employeeId department designation')
          .sort({ createdAt: 1 });
        
        return {
          ...broadcast.toObject(),
          comments: comments,
          totalComments: comments.length,
          likesCount: broadcast.likesCount || 0,
          sharesCount: broadcast.sharesCount || 0,
          viewCount: broadcast.viewedBy.length
        };
      })
    );
    
    res.json(broadcastsWithComments);
  } catch (error) {
    console.error('Error fetching admin broadcasts:', error);
    res.status(500).json({ message: 'Error fetching broadcasts for admin' });
  }
});

// Admin: Get all comments across all broadcasts
router.get('/admin/comments/all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role || req.user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    const comments = await BroadcastComment.find()
      .populate('commentedBy', 'firstName lastName employeeId department designation')
      .populate('broadcast', 'title priority')
      .sort({ createdAt: -1 });
    
    res.json(comments);
  } catch (error) {
    console.error('Error fetching all comments for admin:', error);
    res.status(500).json({ message: 'Error fetching all comments' });
  }
});

// Admin: Get comments summary/stats
router.get('/admin/comments/stats', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role || req.user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    // Get total comments count
    const totalComments = await BroadcastComment.countDocuments();
    
    // Get comments count by user
    const commentsByUser = await BroadcastComment.aggregate([
      {
        $group: {
          _id: '$commentedBy',
          commentCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          commentCount: 1,
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          employeeId: '$user.employeeId'
        }
      },
      { $sort: { commentCount: -1 } },
      { $limit: 10 }
    ]);

    // Get recent comments (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentCommentsCount = await BroadcastComment.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      totalComments,
      recentCommentsCount,
      topCommenters: commentsByUser
    });
  } catch (error) {
    console.error('Error fetching comments stats:', error);
    res.status(500).json({ message: 'Error fetching comment statistics' });
  }
});

// Admin: Delete any comment
router.delete('/admin/comments/:commentId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role || req.user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    const comment = await BroadcastComment.findById(req.params.commentId)
      .populate('commentedBy', 'firstName lastName employeeId')
      .populate('broadcast', 'title');
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    await BroadcastComment.findByIdAndDelete(req.params.commentId);

    if (comment.broadcast?._id) {
      const commentsCount = await BroadcastComment.countDocuments({ broadcast: comment.broadcast._id });
      await Broadcast.findByIdAndUpdate(comment.broadcast._id, { commentsCount });
    }
    
    res.json({ 
      message: 'Comment deleted successfully by admin',
      deletedComment: {
        id: comment._id,
        comment: comment.comment,
        commentedBy: comment.commentedBy,
        broadcast: comment.broadcast,
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error deleting comment by admin:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

// Admin: Get broadcast analytics
router.get('/admin/analytics', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.role || req.user.role.name !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required' });
    }

    // Get broadcast statistics
    const totalBroadcasts = await Broadcast.countDocuments({ isActive: true });
    const totalComments = await BroadcastComment.countDocuments();
    
    // Get broadcasts with most comments
    const broadcastsWithCommentCount = await BroadcastComment.aggregate([
      {
        $group: {
          _id: '$broadcast',
          commentCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'broadcasts',
          localField: '_id',
          foreignField: '_id',
          as: 'broadcast'
        }
      },
      {
        $unwind: '$broadcast'
      },
      {
        $project: {
          broadcastId: '$_id',
          title: '$broadcast.title',
          priority: '$broadcast.priority',
          commentCount: 1,
          createdAt: '$broadcast.createdAt'
        }
      },
      { $sort: { commentCount: -1 } },
      { $limit: 5 }
    ]);

    res.json({
      totalBroadcasts,
      totalComments,
      averageCommentsPerBroadcast: totalBroadcasts > 0 ? (totalComments / totalBroadcasts).toFixed(2) : 0,
      mostCommentedBroadcasts: broadcastsWithCommentCount
    });
  } catch (error) {
    console.error('Error fetching broadcast analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

module.exports = router;
