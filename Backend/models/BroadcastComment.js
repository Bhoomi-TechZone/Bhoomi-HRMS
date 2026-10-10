const mongoose = require('mongoose');

const broadcastCommentSchema = new mongoose.Schema({
  broadcast: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broadcast',
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  commentedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BroadcastComment', broadcastCommentSchema);
