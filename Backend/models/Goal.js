const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projects: [{
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: false  // Optional for HR/Manager/Sales roles
    },
    projectName: {
      type: String,
      default: ''
    }
  }],
  // Backward compatibility - keep single project field
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  projectName: {
    type: String,
    default: ''
  },
  reviewRequest: {
    requested: {
      type: Boolean,
      default: false
    },
    description: {
      type: String,
      default: ''
    },
    teamLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['Pending', 'Seen', 'Approved', 'Rejected', 'Reverted'],
      default: 'Pending'
    },
    requestedAt: {
      type: Date
    },
    seenAt: {
      type: Date
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    },
    projectName: {
      type: String,
      default: ''
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId
    },
    taskName: {
      type: String,
      default: ''
    },
    history: [{
      description: {
        type: String,
        default: ''
      },
      teamLeader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['Pending', 'Seen', 'Approved', 'Rejected', 'Reverted']
      },
      requestedAt: {
        type: Date
      },
      seenAt: {
        type: Date
      },
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      },
      projectName: {
        type: String,
        default: ''
      },
      taskId: {
        type: mongoose.Schema.Types.ObjectId
      },
      taskName: {
        type: String,
        default: ''
      }
    }]
  },
  goals: [
    {
      name: {
        type: String,
        required: true
      },
      notes: {
        type: String,
        default: ''
      },
      isCompleted: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date
      },
      projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project'
      },
      projectName: {
        type: String,
        default: ''
      },

    }
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Custom validation - projects are optional for certain roles (HR/Manager/Sales)
// They can create tasks without being tied to a specific project
goalSchema.pre('validate', function (next) {
  // Validation removed to allow tasks without projects
  // This is now optional to support HR/Manager/Sales roles
  next();
});

module.exports = mongoose.model('Goal', goalSchema);
