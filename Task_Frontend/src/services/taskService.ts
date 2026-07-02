import {
  Task,
  CreateTaskDto,
  TaskPatternSuggestions,
  UpdateTaskDto,
} from "@/types/task";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true" || !API_BASE_URL;
const DEMO_TASKS_KEY = "demoTasks";

const getErrorMessage = async (response: Response, fallbackMessage: string) => {
  try {
    const data = await response.json();
    return data.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

const getCurrentUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.id || "demo-user";
  } catch {
    return "demo-user";
  }
};

const loadDemoTasks = (): Task[] => {
  try {
    return JSON.parse(localStorage.getItem(DEMO_TASKS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveDemoTasks = (tasks: Task[]) => {
  localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(tasks));
};

const getReminderAt = (task: CreateTaskDto | UpdateTaskDto) => {
  if (!task.dueDate || !task.reminderEnabled) return null;

  const dueTime = new Date(task.dueDate).getTime();
  if (Number.isNaN(dueTime)) return null;

  return new Date(dueTime - task.reminderMinutesBefore * 60 * 1000).toISOString();
};

const getDemoSuggestions = (tasks: Task[]): TaskPatternSuggestions => {
  const now = Date.now();
  const completedTasks = tasks.filter((task) => task.status === "completed");
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const overdueTasks = pendingTasks.filter(
    (task) => task.dueDate && new Date(task.dueDate).getTime() < now
  );
  const upcomingTasks = pendingTasks.filter((task) => {
    if (!task.dueDate) return false;
    const dueTime = new Date(task.dueDate).getTime();
    return dueTime >= now && dueTime <= now + 7 * 24 * 60 * 60 * 1000;
  });
  const highPriorityTasks = pendingTasks.filter((task) => task.priority === "High");
  const completionRate = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  return {
    metrics: {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.length,
      highPriorityTasks: highPriorityTasks.length,
      frequentDelayedTypes: [],
      completionRate,
    },
    suggestions: [
      tasks.length === 0
        ? {
            type: "starter",
            title: "Create your first task",
            message: "Add a due date to see automatic priority and reminder behavior in the live demo.",
          }
        : {
            type: "progress",
            title: "Demo progress",
            message: `${completionRate}% of your demo tasks are complete.`,
          },
      overdueTasks.length > 0
        ? {
            type: "overdue",
            title: "Overdue work",
            message: `${overdueTasks.length} pending task${overdueTasks.length === 1 ? " is" : "s are"} past due.`,
          }
        : {
            type: "planning",
            title: "Plan ahead",
            message: `${upcomingTasks.length} pending task${upcomingTasks.length === 1 ? " is" : "s are"} due in the next 7 days.`,
          },
    ],
  };
};

interface ServerTask {
  _id: string;
  title: string;
  description: string;
  status: Task["status"];
  createdAt: string;
  userId: Task["userId"];
  dueDate?: string | null;
  priority?: Task["priority"];
  reminderEnabled?: boolean;
  reminderMinutesBefore?: Task["reminderMinutesBefore"];
  reminderAt?: string | null;
  reminderSent?: boolean;
  delayRiskDetected?: boolean;
  delayRiskReason?: string | null;
  completedAt?: string | null;
}

const mapTask = (task: ServerTask): Task => ({
  id: task._id,
  title: task.title,
  description: task.description,
  status: task.status,
  createdAt: task.createdAt,
  userId: task.userId,
  dueDate: task.dueDate ?? null,
  priority: task.priority ?? "Low",
  reminderEnabled: Boolean(task.reminderEnabled),
  reminderMinutesBefore: task.reminderMinutesBefore ?? 30,
  reminderAt: task.reminderAt ?? null,
  reminderSent: task.reminderSent ?? false,
  delayRiskDetected: task.delayRiskDetected ?? false,
  delayRiskReason: task.delayRiskReason ?? null,
  completedAt: task.completedAt ?? null,
});

export const taskService = {
  getTasks: async (
    page: number = 1,
    limit: number = 10
  ): Promise<{ tasks: Task[]; pagination: { total: number; pages: number; page: number; limit: number } }> => {
    if (isDemoMode) {
      const userId = getCurrentUserId();
      const userTasks = loadDemoTasks()
        .filter((task) => task.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const start = (page - 1) * limit;
      const pagedTasks = userTasks.slice(start, start + limit);

      return {
        tasks: pagedTasks,
        pagination: {
          total: userTasks.length,
          pages: Math.max(1, Math.ceil(userTasks.length / limit)),
          page,
          limit,
        },
      };
    }

    const response = await fetch(
      `${API_BASE_URL}/tasks?page=${page}&limit=${limit}`,
      { headers: getAuthHeader() }
    );

    if (!response.ok) throw new Error("Failed to fetch tasks");

    const data = await response.json();

    return {
      tasks: data.tasks.map(mapTask),
      pagination: {
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 1,
        page: data.pagination?.page || 1,
        limit: data.pagination?.limit || limit,
      },
    };
  },

  getTaskById: async (taskId: string): Promise<Task> => {
    if (isDemoMode) {
      const task = loadDemoTasks().find(
        (demoTask) => demoTask.id === taskId && demoTask.userId === getCurrentUserId()
      );

      if (!task) throw new Error("Task not found");
      return task;
    }

    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to fetch task"));
    }

    const data = await response.json();
    return mapTask(data.task);
  },

  getTaskSuggestions: async (): Promise<TaskPatternSuggestions> => {
    if (isDemoMode) {
      return getDemoSuggestions(
        loadDemoTasks().filter((task) => task.userId === getCurrentUserId())
      );
    }

    const response = await fetch(`${API_BASE_URL}/tasks/suggestions`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to analyze task patterns"));
    }

    return response.json();
  },

  createTask: async (task: CreateTaskDto): Promise<Task> => {
    if (isDemoMode) {
      const nextTask: Task = {
        ...task,
        id: `demo-task-${Date.now()}`,
        userId: getCurrentUserId(),
        createdAt: new Date().toISOString(),
        reminderAt: getReminderAt(task),
        reminderSent: false,
        delayRiskDetected: false,
        delayRiskReason: null,
        completedAt: task.status === "completed" ? new Date().toISOString() : null,
      };
      const tasks = [nextTask, ...loadDemoTasks()];
      saveDemoTasks(tasks);
      return nextTask;
    }

    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to create task"));
    }

    const data = await response.json();
    return mapTask(data.task);
  },

  updateTask: async (task: UpdateTaskDto): Promise<Task> => {
    if (isDemoMode) {
      const tasks = loadDemoTasks();
      const existingTask = tasks.find(
        (demoTask) => demoTask.id === task.id && demoTask.userId === getCurrentUserId()
      );

      if (!existingTask) throw new Error("Task not found");

      const updatedTask: Task = {
        ...existingTask,
        ...task,
        reminderAt: getReminderAt(task),
        completedAt:
          task.status === "completed"
            ? existingTask.completedAt || new Date().toISOString()
            : null,
      };
      saveDemoTasks(tasks.map((demoTask) => (demoTask.id === task.id ? updatedTask : demoTask)));
      return updatedTask;
    }

    const response = await fetch(`${API_BASE_URL}/tasks/${task.id}`, {
      method: "PUT",
      headers: getAuthHeader(),
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to update task"));
    }

    const data = await response.json();
    return mapTask(data.task);
  },

  deleteTask: async (taskId: string): Promise<void> => {
    if (isDemoMode) {
      saveDemoTasks(
        loadDemoTasks().filter(
          (task) => !(task.id === taskId && task.userId === getCurrentUserId())
        )
      );
      return;
    }

    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to delete task"));
    }
  },

  updateTaskStatus: async (
    taskId: string,
    status: "pending" | "completed"
  ): Promise<Task> => {
    if (isDemoMode) {
      const tasks = loadDemoTasks();
      const existingTask = tasks.find(
        (demoTask) => demoTask.id === taskId && demoTask.userId === getCurrentUserId()
      );

      if (!existingTask) throw new Error("Task not found");

      const updatedTask: Task = {
        ...existingTask,
        status,
        completedAt:
          status === "completed"
            ? existingTask.completedAt || new Date().toISOString()
            : null,
      };
      saveDemoTasks(tasks.map((task) => (task.id === taskId ? updatedTask : task)));
      return updatedTask;
    }

    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: getAuthHeader(),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to update task status"));
    }

    const data = await response.json();
    return mapTask(data.task);
  },
};
