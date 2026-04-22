const Task = require("../models/Task");

const VALID_PRIORITIES = ["Low", "Medium", "High"];
const VALID_REMINDER_MINUTES = [5, 15, 30, 60, 1440];

const buildReminderFields = ({ dueDate, priority, reminderEnabled, reminderMinutesBefore, currentTask }) => {
  const updates = {};

  if (priority !== undefined) {
    if (!VALID_PRIORITIES.includes(priority)) {
      throw new Error("Please provide a valid priority (Low, Medium, or High)");
    }
    updates.priority = priority;
  }

  if (dueDate !== undefined) {
    if (!dueDate) {
      updates.dueDate = null;
    } else {
      const parsedDueDate = new Date(dueDate);
      if (Number.isNaN(parsedDueDate.getTime())) {
        throw new Error("Please provide a valid due date");
      }
      updates.dueDate = parsedDueDate;
    }
  }

  const nextDueDate =
    updates.dueDate !== undefined ? updates.dueDate : currentTask?.dueDate || null;
  const nextReminderEnabled =
    reminderEnabled !== undefined
      ? reminderEnabled
      : currentTask?.reminderEnabled || false;
  const nextReminderMinutesBefore =
    reminderMinutesBefore !== undefined
      ? Number(reminderMinutesBefore)
      : currentTask?.reminderMinutesBefore || 30;

  if (reminderMinutesBefore !== undefined && !VALID_REMINDER_MINUTES.includes(nextReminderMinutesBefore)) {
    throw new Error("Please provide a valid reminder time");
  }

  if (reminderEnabled !== undefined) {
    updates.reminderEnabled = reminderEnabled;
  }

  if (reminderMinutesBefore !== undefined) {
    updates.reminderMinutesBefore = nextReminderMinutesBefore;
  }

  if (nextReminderEnabled) {
    if (!nextDueDate) {
      throw new Error("A due date is required when reminders are enabled");
    }

    const reminderAt = new Date(nextDueDate.getTime() - nextReminderMinutesBefore * 60 * 1000);
    updates.reminderAt = reminderAt;
    updates.reminderSent = reminderAt <= new Date();
  } else if (
    reminderEnabled !== undefined ||
    reminderMinutesBefore !== undefined ||
    dueDate !== undefined
  ) {
    updates.reminderAt = null;
    updates.reminderSent = false;
  }

  return updates;
};

// @route   GET /tasks
// @desc    Get all tasks with pagination
// @access  Private
exports.getTasks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Users see only their tasks, admins see all tasks
    const filter = req.user.role === "admin" ? {} : { userId: req.user._id };

    const tasks = await Task.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Task.countDocuments(filter);

    res.status(200).json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ message: "Server error while fetching tasks" });
  }
};

// @route   GET /tasks/:id
// @desc    Get a single task
// @access  Private
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id).populate("userId", "name email");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (
      req.user.role !== "admin" &&
      task.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized to view this task" });
    }

    res.status(200).json({ task });
  } catch (error) {
    console.error("Get task error:", error);
    res.status(500).json({ message: "Server error while fetching task" });
  }
};

// @route   POST /tasks
// @desc    Create a new task
// @access  Private
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      dueDate,
      priority,
      reminderEnabled,
      reminderMinutesBefore,
    } = req.body;

    // Validation
    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "Please provide title and description" });
    }

    const reminderFields = buildReminderFields({
      dueDate,
      priority,
      reminderEnabled,
      reminderMinutesBefore,
    });

    const task = await Task.create({
      title,
      description,
      status: status || "pending",
      userId: req.user._id,
      ...reminderFields,
    });

    const populatedTask = await Task.findById(task._id).populate(
      "userId",
      "name email"
    );

    res.status(201).json({
      message: "Task created successfully",
      task: populatedTask,
    });
  } catch (error) {
    console.error("Create task error:", error);
    if (error.message?.startsWith("Please provide") || error.message?.includes("required when reminders")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error while creating task" });
  }
};

// @route   PUT /tasks/:id
// @desc    Update a task
// @access  Private
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      dueDate,
      priority,
      reminderEnabled,
      reminderMinutesBefore,
    } = req.body;

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Users can only update their own tasks, admins can update any task
    if (
      req.user.role !== "admin" &&
      task.userId.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this task" });
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;

    const reminderFields = buildReminderFields({
      dueDate,
      priority,
      reminderEnabled,
      reminderMinutesBefore,
      currentTask: task,
    });

    Object.assign(task, reminderFields);

    await task.save();

    const updatedTask = await Task.findById(id).populate(
      "userId",
      "name email"
    );

    res.status(200).json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Update task error:", error);
    if (error.message?.startsWith("Please provide") || error.message?.includes("required when reminders")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error while updating task" });
  }
};

// @route   DELETE /tasks/:id
// @desc    Delete a task
// @access  Private
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (
      req.user.role !== "admin" &&
      task.userId.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this task" });
    }

    await Task.findByIdAndDelete(id);

    res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ message: "Server error while deleting task" });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ["pending", "completed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Please provide a valid status (pending, or completed)",
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (
      req.user.role !== "admin" &&
      task.userId.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this task" });
    }

    task.status = status;
    await task.save();

    const updatedTask = await Task.findById(id).populate(
      "userId",
      "name email"
    );

    res.status(200).json({
      message: "Task status updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Update status error:", error);
    res
      .status(500)
      .json({ message: "Server error while updating task status" });
  }
};
