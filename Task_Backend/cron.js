
const cron = require('node-cron');
const Task = require('./models/task');

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const upcoming = new Date(now.getTime() + 10 * 60 * 1000);

  const tasks = await Task.find({
    dueDate: { $gte: now, $lte: upcoming }
  });

  tasks.forEach(task => {
    console.log(`Reminder: Task "${task.title}" is due soon!`);
  });
});
