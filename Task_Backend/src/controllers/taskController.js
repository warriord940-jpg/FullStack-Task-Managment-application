const Task = require("../models/Task");
const mongoose = require("mongoose");

const VALID_PRIORITIES = ["Low", "Medium", "High"];
const VALID_REMINDER_MINUTES = [5, 15, 30, 60, 1440];
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const DELAY_PATTERN_THRESHOLD = 2;
const DELAY_PATTERN_REMINDER_MINUTES = 5;
const TASK_TYPE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "my",
  "of",
  "on",
  "task",
  "the",
  "to",
]);

const getAutomaticPriority = (dueDate, now = new Date()) => {
  if (!dueDate) return "Low";

  const timeUntilDue = dueDate.getTime() - now.getTime();

  if (timeUntilDue < ONE_DAY_MS) return "High";
  if (timeUntilDue < 3 * ONE_DAY_MS) return "Medium";
  return "Low";
};

const getReminderMinutesForPriority = (priority) => {
  switch (priority) {
    case "High":
      return 5;
    case "Medium":
      return 60;
    default:
      return 1440;
  }
};

const isValidTaskId = (id) => mongoose.Types.ObjectId.isValid(id);

const getTaskTypeKey = (title = "") => {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !TASK_TYPE_STOP_WORDS.has(word));

  return words[0] || null;
};

const isDelayedTask = (task, now = new Date()) => {
  if (!task.dueDate) return false;
  if (task.status === "completed") {
    return task.completedAt && task.completedAt > task.dueDate;
  }

  return task.dueDate < now;
};

const getFrequentDelayedTypes = (tasks) => {
  const counts = tasks.reduce((groups, task) => {
    if (!isDelayedTask(task)) return groups;

    const typeKey = getTaskTypeKey(task.title);
    if (!typeKey) return groups;

    groups[typeKey] = (groups[typeKey] || 0) + 1;
    return groups;
  }, {});

  return Object.entries(counts)
    .filter(([, count]) => count >= DELAY_PATTERN_THRESHOLD)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
};

const buildDelayPatternAction = ({ dueDate, frequentDelayedType }) => {
  if (!dueDate || !frequentDelayedType) {
    return {
      delayRiskDetected: false,
      delayRiskReason: null,
    };
  }

  const reminderAt = new Date(dueDate.getTime() - DELAY_PATTERN_REMINDER_MINUTES * 60 * 1000);

  return {
    priority: "High",
    reminderEnabled: true,
    reminderMinutesBefore: DELAY_PATTERN_REMINDER_MINUTES,
    reminderAt,
    reminderSent: reminderAt <= new Date(),
    delayRiskDetected: true,
    delayRiskReason: `You often delay ${frequentDelayedType.type} tasks, so this task was automatically marked high priority with an earlier reminder.`,
  };
};

const getDelayPatternAction = async ({ userId, title, dueDate, currentTaskId }) => {
  const typeKey = getTaskTypeKey(title);
  if (!typeKey || !dueDate) {
    return buildDelayPatternAction({ dueDate, frequentDelayedType: null });
  }

  const filter = { userId };
  if (currentTaskId) {
    filter._id = { $ne: currentTaskId };
  }

  const tasks = await Task.find(filter);
  const frequentDelayedType = getFrequentDelayedTypes(tasks).find(
    (delayedType) => delayedType.type === typeKey
  );

  return buildDelayPatternAction({ dueDate, frequentDelayedType });
};

const getTaskPatternSuggestions = (tasks) => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * ONE_DAY_MS);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const overdueTasks = pendingTasks.filter((task) => task.dueDate && task.dueDate < now);
  const upcomingTasks = pendingTasks.filter(
    (task) => task.dueDate && task.dueDate >= now && task.dueDate <= sevenDaysFromNow
  );
  const highPriorityTasks = pendingTasks.filter((task) => task.priority === "High");
  const frequentDelayedTypes = getFrequentDelayedTypes(tasks);
  const completionRate = totalTasks ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const hourCounts = tasks.reduce((counts, task) => {
    const hour = task.createdAt ? new Date(task.createdAt).getHours() : null;
    if (hour === null || Number.isNaN(hour)) return counts;
    counts[hour] = (counts[hour] || 0) + 1;
    return counts;
  }, {});

  const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const suggestions = [];

  if (totalTasks < 3) {
    suggestions.push({
      type: "starter",
      title: "Build more task history",
      message: "Add a few more tasks with due dates so the app can learn your planning pattern more accurately.",
    });
  }

  if (overdueTasks.length > 0) {
    suggestions.push({
      type: "overdue",
      title: "Reduce overdue work",
      message: `${overdueTasks.length} pending task${overdueTasks.length > 1 ? "s are" : " is"} overdue. Move the most urgent one to today's focus list or extend its deadline.`,
    });
  }

  if (highPriorityTasks.length >= 3) {
    suggestions.push({
      type: "priority",
      title: "Too many urgent tasks",
      message: `${highPriorityTasks.length} active tasks are high priority. Break one large task into smaller steps or reschedule lower-impact work.`,
    });
  }

  if (upcomingTasks.length >= 5) {
    suggestions.push({
      type: "workload",
      title: "Heavy week ahead",
      message: `${upcomingTasks.length} tasks are due in the next 7 days. Consider moving flexible tasks before the week gets crowded.`,
    });
  }

  if (frequentDelayedTypes.length > 0) {
    const [mostDelayedType] = frequentDelayedTypes;
    suggestions.push({
      type: "frequent-delay",
      title: "Frequent delayed task type",
      message: `You often delay ${mostDelayedType.type} tasks. Future matching tasks will be marked high priority with an earlier reminder automatically.`,
    });
  }

  if (totalTasks >= 5 && completionRate < 50) {
    suggestions.push({
      type: "completion",
      title: "Completion rate needs attention",
      message: `Your completion rate is ${completionRate}%. Try setting smaller due-date windows and closing one pending task before creating new ones.`,
    });
  }

  if (mostActiveHour !== undefined) {
    const hour = Number(mostActiveHour);
    const label = new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
    });
    suggestions.push({
      type: "timing",
      title: "Use your active planning time",
      message: `You create tasks most often around ${label}. That may be a good time to review deadlines and reminders.`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: "healthy",
      title: "Your task pattern looks steady",
      message: "No major workload risks found right now. Keep using due dates so suggestions become smarter over time.",
    });
  }

  return {
    metrics: {
      totalTasks,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.length,
      highPriorityTasks: highPriorityTasks.length,
      frequentDelayedTypes,
      completionRate,
    },
    suggestions: suggestions.slice(0, 4),
  };
};

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
  const automaticPriority = nextDueDate ? getAutomaticPriority(nextDueDate) : null;
  const nextPriority = automaticPriority || updates.priority || currentTask?.priority || "Low";
  const shouldAutoReminder = Boolean(nextDueDate);
  const nextReminderEnabled =
    reminderEnabled !== undefined
      ? reminderEnabled
      : shouldAutoReminder || currentTask?.reminderEnabled || false;
  const nextReminderMinutesBefore = shouldAutoReminder
    ? getReminderMinutesForPriority(nextPriority)
    : reminderMinutesBefore !== undefined
      ? Number(reminderMinutesBefore)
      : currentTask?.reminderMinutesBefore || 30;

  if (!shouldAutoReminder && reminderMinutesBefore !== undefined && !VALID_REMINDER_MINUTES.includes(nextReminderMinutesBefore)) {
    throw new Error("Please provide a valid reminder time");
  }

  updates.priority = nextPriority;

  if (reminderEnabled !== undefined || shouldAutoReminder) {
    updates.reminderEnabled = nextReminderEnabled;
  }

  if (reminderMinutesBefore !== undefined || shouldAutoReminder) {
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

    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Please provide a valid task id" });
    }

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

// @route   GET /tasks/suggestions
// @desc    Analyze user task behavior and return smart suggestions
// @access  Private
exports.getTaskSuggestions = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { userId: req.user._id };
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    const pattern = getTaskPatternSuggestions(tasks);

    res.status(200).json(pattern);
  } catch (error) {
    console.error("Get task suggestions error:", error);
    res.status(500).json({ message: "Server error while analyzing task patterns" });
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
    const delayPatternAction =
      (status || "pending") === "pending"
        ? await getDelayPatternAction({
            userId: req.user._id,
            title,
            dueDate: reminderFields.dueDate || null,
          })
        : buildDelayPatternAction({ dueDate: null, frequentDelayedType: null });

    const task = await Task.create({
      title,
      description,
      status: status || "pending",
      completedAt: status === "completed" ? new Date() : null,
      userId: req.user._id,
      ...reminderFields,
      ...delayPatternAction,
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

    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Please provide a valid task id" });
    }

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
    if (status !== undefined) {
      task.status = status;
      task.completedAt = status === "completed" ? task.completedAt || new Date() : null;
    }

    const reminderFields = buildReminderFields({
      dueDate,
      priority,
      reminderEnabled,
      reminderMinutesBefore,
      currentTask: task,
    });

    Object.assign(task, reminderFields);

    const delayPatternAction =
      task.status === "pending"
        ? await getDelayPatternAction({
            userId: task.userId,
            title: task.title,
            dueDate: task.dueDate || null,
            currentTaskId: task._id,
          })
        : buildDelayPatternAction({ dueDate: null, frequentDelayedType: null });

    Object.assign(task, delayPatternAction);

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

    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Please provide a valid task id" });
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

    if (!isValidTaskId(id)) {
      return res.status(400).json({ message: "Please provide a valid task id" });
    }

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
    task.completedAt = status === "completed" ? task.completedAt || new Date() : null;
    const delayPatternAction =
      status === "pending"
        ? await getDelayPatternAction({
            userId: task.userId,
            title: task.title,
            dueDate: task.dueDate || null,
            currentTaskId: task._id,
          })
        : buildDelayPatternAction({ dueDate: null, frequentDelayedType: null });

    Object.assign(task, delayPatternAction);
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
