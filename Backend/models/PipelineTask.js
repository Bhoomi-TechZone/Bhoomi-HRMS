const mongoose = require('mongoose');

const pipelineTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    dueDate: {
      type: String,
      default: '',
      trim: true
    },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium'
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending'
    },
    completed: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      default: 'Follow-up',
      trim: true
    },
    assignee: {
      type: String,
      default: 'Artiflow',
      trim: true
    },
    associatedDealId: {
      type: String,
      default: '',
      trim: true
    },
    associatedDealName: {
      type: String,
      default: '',
      trim: true
    },
    associatedContactId: {
      type: String,
      default: '',
      trim: true
    },
    associatedContactName: {
      type: String,
      default: '',
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PipelineTask', pipelineTaskSchema);
