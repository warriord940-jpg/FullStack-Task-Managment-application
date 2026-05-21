import {
  Task,
  CreateTaskDto,
  TaskPatternSuggestions,
  UpdateTaskDto,
} from "@/types/task";

const API_BASE_URL = import.meta.env.VITE_API_URL|| "http://localhost:5000";

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
    const response = await fetch(`${API_BASE_URL}/tasks/suggestions`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, "Failed to analyze task patterns"));
    }

    return response.json();
  },

  createTask: async (task: CreateTaskDto): Promise<Task> => {
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
