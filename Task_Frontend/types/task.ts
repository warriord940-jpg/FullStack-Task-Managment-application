export type TaskStatus = 'pending' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  userId: string;
}

export interface CreateTaskDto {
  title: string;
  description: string;
  status: TaskStatus;
}

export interface UpdateTaskDto extends CreateTaskDto {
  id: string;
}

export interface UpdateTaskStatusDto {
  id: string;
  status: TaskStatus;
}
