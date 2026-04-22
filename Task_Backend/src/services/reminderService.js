const Task = require("../models/Task");

let reminderInterval = null;

const checkDueReminders = async () => {
  const now = new Date();

  try {
    const dueTasks = await Task.find({
      status: "pending",
      reminderEnabled: true,
      reminderSent: false,
      reminderAt: { $lte: now },
    }).populate("userId", "name email");

    for (const task of dueTasks) {
      console.log(
        `[Reminder] Task "${task.title}" is due at ${task.dueDate?.toISOString() || "N/A"} for ${task.userId?.email || "unknown user"}`
      );

      task.reminderSent = true;
      await task.save();
    }
  } catch (error) {
    console.error("Reminder worker error:", error);
  }
};

const startReminderService = () => {
  if (reminderInterval) {
    return;
  }

  checkDueReminders();
  reminderInterval = setInterval(checkDueReminders, 60 * 1000);
};

module.exports = { startReminderService };
