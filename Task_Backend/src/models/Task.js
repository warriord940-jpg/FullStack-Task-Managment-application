const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  dueDate: { type: Date },
  priority: { type: String, enum: ['Low','Medium','High'], default: 'Low' },
  reminderEnabled: {
    type: Boolean,
    default: false
  },
  reminderMinutesBefore: {
    type: Number,
    default: 30
  },
  reminderAt: {
    type: Date,
    default: null
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  delayRiskDetected: {
    type: Boolean,
    default: false
  },
  delayRiskReason: {
    type: String,
    default: null
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  },
  completedAt: {
    type: Date,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Task', taskSchema);
