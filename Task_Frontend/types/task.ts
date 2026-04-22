export type TaskStatus = 'pending' | 'completed';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type ReminderMinutesBefore = 5 | 15 | 30 | 60 | 1440;

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  userId: string | { _id: string; name?: string; email?: string };
  dueDate?: string | null;
  priority: TaskPriority;
  reminderEnabled: boolean;
  reminderMinutesBefore: ReminderMinutesBefore;
  reminderAt?: string | null;
  reminderSent?: boolean;
}

export interface CreateTaskDto {
  title: string;
  description: string;
  status: TaskStatus;
  dueDate?: string | null;
  priority: TaskPriority;
  reminderEnabled: boolean;
  reminderMinutesBefore: ReminderMinutesBefore;
}

export interface UpdateTaskDto extends CreateTaskDto {
  id: string;
}

export interface UpdateTaskStatusDto {
  id: string;
  status: TaskStatus;
}
