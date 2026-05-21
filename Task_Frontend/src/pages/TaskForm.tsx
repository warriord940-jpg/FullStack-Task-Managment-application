import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { taskService } from '@/services/taskService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { ReminderMinutesBefore, TaskPriority, TaskStatus } from '@/types/task';

const REMINDER_OPTIONS: ReminderMinutesBefore[] = [5, 15, 30, 60, 1440];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? '00' : '30';
  const value = `${String(hours).padStart(2, '0')}:${minutes}`;
  const label = new Date(2000, 0, 1, hours, Number(minutes)).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return { value, label };
});
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const getAutomaticPriority = (value: string): TaskPriority => {
  if (!value) return 'Low';

  const dueTime = new Date(value).getTime();
  if (Number.isNaN(dueTime)) return 'Low';

  const timeUntilDue = dueTime - Date.now();
  if (timeUntilDue < ONE_DAY_MS) return 'High';
  if (timeUntilDue < 3 * ONE_DAY_MS) return 'Medium';
  return 'Low';
};

const getReminderMinutesForPriority = (taskPriority: TaskPriority): ReminderMinutesBefore => {
  switch (taskPriority) {
    case 'High':
      return 5;
    case 'Medium':
      return 60;
    default:
      return 1440;
  }
};

const formatDateTimeLocal = (value?: string | null) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

const getSelectedDate = (value: string) => {
  if (!value) return undefined;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const getTimeValue = (value: string) => {
  if (!value) return '09:00';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '09:00';

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const mergeDateAndTime = (date: Date, time: string) => {
  const [hours = '9', minutes = '0'] = time.split(':');
  const nextDate = new Date(date);
  nextDate.setHours(Number(hours), Number(minutes), 0, 0);
  return formatDateTimeLocal(nextDate.toISOString());
};

const TaskForm = () => {
  const { id } = useParams();
  const isEditMode = !!id;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [priority, setPriority] = useState<TaskPriority>('Low');
  const [dueDate, setDueDate] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<ReminderMinutesBefore>(30);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const selectedDueDate = getSelectedDate(dueDate);
  const dueTime = getTimeValue(dueDate);

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }

    if (isEditMode && id) {
      loadTask(id);
    }
  }, [user, id, isEditMode, navigate]);

  useEffect(() => {
    if (!dueDate) {
      setPriority('Low');
      setReminderEnabled(false);
      setReminderMinutesBefore(30);
      return;
    }

    const automaticPriority = getAutomaticPriority(dueDate);
    setPriority(automaticPriority);
    setReminderEnabled(true);
    setReminderMinutesBefore(getReminderMinutesForPriority(automaticPriority));
  }, [dueDate]);

  const loadTask = async (taskId: string) => {
    setIsLoading(true);
    try {
      const task = await taskService.getTaskById(taskId);
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(formatDateTimeLocal(task.dueDate));
      setReminderEnabled(task.reminderEnabled);
      setReminderMinutesBefore(task.reminderMinutesBefore);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load task',
        variant: 'destructive'
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        reminderEnabled,
        reminderMinutesBefore,
      };

      if (isEditMode) {
        await taskService.updateTask({ id: id!, ...payload });
        toast({
          title: 'Success',
          description: 'Task updated successfully'
        });
      } else {
        await taskService.createTask(payload);
        toast({
          title: 'Success',
          description: 'Task created successfully'
        });
      }
      navigate('/dashboard');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} task`,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDueDateSelect = (date?: Date) => {
    if (!date) {
      setDueDate('');
      return;
    }

    setDueDate(mergeDateAndTime(date, dueTime));
  };

  const handleDueTimeChange = (time: string) => {
    if (!selectedDueDate) return;
    setDueDate(mergeDateAndTime(selectedDueDate, time));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? 'Edit Task' : 'Create New Task'}</CardTitle>
            <CardDescription>
              {isEditMode ? 'Update your task details, reminder, and priority.' : 'Add a new task with a due date, reminder, and priority.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Task description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Auto Priority</Label>
                  <Select value={priority} disabled>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <div className="rounded-md border p-3">
                  <DayPicker
                    mode="single"
                    selected={selectedDueDate}
                    onSelect={handleDueDateSelect}
                    className="mx-auto"
                  />
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="dueTime">Time</Label>
                      <Select
                        value={dueTime}
                        onValueChange={handleDueTimeChange}
                        disabled={!selectedDueDate}
                      >
                        <SelectTrigger id="dueTime">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="self-end"
                      onClick={() => setDueDate('')}
                      disabled={!selectedDueDate}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="reminderEnabled">Auto Reminder</Label>
                    <p className="text-sm text-muted-foreground">
                      Reminder timing is selected from the deadline priority.
                    </p>
                  </div>
                  <input
                    id="reminderEnabled"
                    type="checkbox"
                    checked={reminderEnabled}
                    readOnly
                    className="h-4 w-4"
                  />
                </div>

                {reminderEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="reminderMinutesBefore">Auto Reminder Time</Label>
                    <Select
                      value={String(reminderMinutesBefore)}
                      disabled
                    >
                      <SelectTrigger id="reminderMinutesBefore">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option === 1440 ? '1 day before' : `${option} minutes before`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? 'Saving...' : isEditMode ? 'Update Task' : 'Create Task'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskForm;
