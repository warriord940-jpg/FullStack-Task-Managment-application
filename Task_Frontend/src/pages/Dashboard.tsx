import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { taskService } from '@/services/taskService';
import { Task, TaskPatternSuggestions, TaskStatus } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Moon, Sun, Plus, LogOut, Edit, Trash2, AlertTriangle, BellRing, Flag, Lightbulb, Target, Flame, BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Dashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summaryTasks, setSummaryTasks] = useState<Task[]>([]);
  const [patternSuggestions, setPatternSuggestions] = useState<TaskPatternSuggestions | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tasksPerPage = 6;

  useEffect(() => {
    if (!user) {
      navigate('/signin');
      return;
    }
    loadTasks();
  }, [user, currentPage]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const [pagedResponse, summaryResponse, suggestionResponse] = await Promise.all([
        taskService.getTasks(currentPage, tasksPerPage),
        taskService.getTasks(1, 1000),
        taskService.getTaskSuggestions(),
      ]);

      setTasks(pagedResponse.tasks);
      setSummaryTasks(summaryResponse.tasks);
      setPatternSuggestions(suggestionResponse);
      setTotalTasks(pagedResponse.pagination?.total || 0);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to load tasks';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTaskSuggestions = async () => {
    const suggestionResponse = await taskService.getTaskSuggestions();
    setPatternSuggestions(suggestionResponse);
  };

  const handleStatusUpdate = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingTaskId(taskId);
    try {
      const updatedTask = await taskService.updateTaskStatus(taskId, newStatus);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? updatedTask : task
        )
      );
      setSummaryTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? updatedTask : task
        )
      );
      await refreshTaskSuggestions();
      toast({
        title: 'Success',
        description: 'Task status updated successfully',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to update task status';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await taskService.deleteTask(taskId);
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      setSummaryTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
      setTotalTasks((prevTotal) => Math.max(0, prevTotal - 1));
      await refreshTaskSuggestions();
      toast({
        title: 'Success',
        description: 'Task deleted successfully',
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Failed to delete task';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const isOverdueTask = (task: Task) => {
    if (!task.dueDate || task.status === 'completed') return false;
    return new Date(task.dueDate).getTime() < Date.now();
  };

  const isReminderDueTask = (task: Task) => {
    if (task.status === 'completed' || !task.reminderEnabled || !task.reminderAt) return false;
    return new Date(task.reminderAt).getTime() <= Date.now();
  };

  const overdueTasks = summaryTasks.filter(isOverdueTask);
  const reminderDueTasks = summaryTasks.filter(
    (task) => isReminderDueTask(task) && !isOverdueTask(task)
  );
  const priorityTasks = summaryTasks.filter(
    (task) => task.priority === 'High' && task.status !== 'completed'
  );
  const urgentTasks = summaryTasks.filter(
    (task) => task.status !== 'completed' && (task.priority === 'High' || isOverdueTask(task) || isReminderDueTask(task))
  );

  const formatDueDate = (value?: string | null) => {
    if (!value) return 'No due date';
    return new Date(value).toLocaleString();
  };

  const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const completedDateKeys = new Set(
    summaryTasks
      .filter((task) => task.status === 'completed' && task.completedAt)
      .map((task) => getDateKey(new Date(task.completedAt as string)))
  );

  const getCurrentStreak = () => {
    let streak = 0;
    const cursor = new Date();

    if (!completedDateKeys.has(getDateKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (completedDateKeys.has(getDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  };

  const streakDays = getCurrentStreak();
  const completedTasksCount = summaryTasks.filter((task) => task.status === 'completed').length;
  const pendingTasksCount = summaryTasks.filter((task) => task.status === 'pending').length;
  const completionRate = summaryTasks.length ? Math.round((completedTasksCount / summaryTasks.length) * 100) : 0;
  const analyticsStatusData = [
    { name: 'Completed', value: completedTasksCount, color: '#16a34a' },
    { name: 'Pending', value: pendingTasksCount, color: '#f59e0b' },
  ].filter((item) => item.value > 0);
  const weeklyProgressData = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = getDateKey(date);
    const label = date.toLocaleDateString(undefined, { weekday: 'short' });
    const completed = summaryTasks.filter(
      (task) => task.completedAt && getDateKey(new Date(task.completedAt)) === dateKey
    ).length;
    const created = summaryTasks.filter(
      (task) => task.createdAt && getDateKey(new Date(task.createdAt)) === dateKey
    ).length;

    return { day: label, completed, created };
  });
  const maxDailyActivity = Math.max(1, ...weeklyProgressData.map((item) => Math.max(item.completed, item.created)));
  const chartYAxisDomain: [number, number] = [0, maxDailyActivity];
  const displayedTasks = focusMode ? urgentTasks : tasks;

  const getPriorityBadgeClasses = (priority: Task['priority']) => {
    switch (priority) {
      case 'High':
        return 'border-red-200 bg-red-100 text-red-700';
      case 'Medium':
        return 'border-amber-200 bg-amber-100 text-amber-700';
      default:
        return 'border-emerald-200 bg-emerald-100 text-emerald-700';
    }
  };

  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const totalPages = Math.ceil(totalTasks / tasksPerPage);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Task Management</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.name} ({user?.role})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{focusMode ? 'Focus Tasks' : 'My Tasks'}</h2>
            {focusMode && (
              <p className="text-sm text-muted-foreground">Showing urgent pending work only.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={focusMode ? 'default' : 'outline'}
              onClick={() => {
                setFocusMode((enabled) => !enabled);
                setCurrentPage(1);
              }}
            >
              <Target className="mr-2 h-4 w-4" />
              {focusMode ? 'Exit Focus' : 'Focus Mode'}
            </Button>
            {!focusMode && (
              <Button onClick={() => navigate('/tasks/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            )}
          </div>
        </div>

        {!isLoading && !focusMode && (overdueTasks.length > 0 || reminderDueTasks.length > 0 || priorityTasks.length > 0 || patternSuggestions) && (
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <Card className="border-red-200 bg-red-50/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Task Reminders
                </CardTitle>
                <CardDescription>
                  {overdueTasks.length > 0
                    ? `${overdueTasks.length} task${overdueTasks.length > 1 ? 's are' : ' is'} overdue and needs attention.`
                    : reminderDueTasks.length > 0
                      ? `${reminderDueTasks.length} task${reminderDueTasks.length > 1 ? 's are' : ' is'} in the reminder window.`
                      : 'No due or overdue reminders right now.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overdueTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="rounded-md border border-red-200 bg-background/80 p-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">Overdue since {formatDueDate(task.dueDate)}</p>
                  </div>
                ))}
                {overdueTasks.length === 0 && reminderDueTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="rounded-md border border-red-200 bg-background/80 p-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">Due {formatDueDate(task.dueDate)}</p>
                  </div>
                ))}
                {overdueTasks.length === 0 && reminderDueTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Everything is on track.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <Flag className="h-5 w-5" />
                  Priority Tasks
                </CardTitle>
                <CardDescription>
                  {priorityTasks.length > 0
                    ? `${priorityTasks.length} high-priority task${priorityTasks.length > 1 ? 's are' : ' is'} still active.`
                    : 'No active high-priority tasks right now.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {priorityTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="rounded-md border border-amber-200 bg-background/80 p-3">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.reminderEnabled ? 'Reminder active' : 'Reminder off'}
                    </p>
                  </div>
                ))}
                {priorityTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing urgent at the moment.</p>
                )}
              </CardContent>
            </Card>

            {patternSuggestions && (
              <Card className="border-sky-200 bg-sky-50/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sky-700">
                    <Lightbulb className="h-5 w-5" />
                    Smart Suggestions
                  </CardTitle>
                  <CardDescription>
                    {patternSuggestions.metrics.completionRate}% completion rate,
                    {' '}
                    {patternSuggestions.metrics.upcomingTasks} due this week.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {patternSuggestions.suggestions.map((suggestion) => (
                    <div key={`${suggestion.type}-${suggestion.title}`} className="rounded-md border border-sky-200 bg-background/80 p-3">
                      <p className="font-medium">{suggestion.title}</p>
                      <p className="text-sm text-muted-foreground">{suggestion.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!isLoading && !focusMode && (
          <div className="mb-6 grid gap-4 lg:grid-cols-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Habit Streak
                </CardTitle>
                <CardDescription>Daily task completion momentum.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{streakDays}-day productivity streak</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {completedDateKeys.has(getDateKey(new Date()))
                    ? 'You have completed work today.'
                    : 'Complete a task today to keep the streak moving.'}
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Task Analytics
                </CardTitle>
                <CardDescription>
                  {completionRate}% complete across {summaryTasks.length} task{summaryTasks.length === 1 ? '' : 's'}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsStatusData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={4}
                        >
                          {analyticsStatusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-56 lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyProgressData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" />
                        <YAxis allowDecimals={false} domain={chartYAxisDomain} />
                        <Tooltip />
                        <Bar dataKey="completed" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="created" name="Created" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-6 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyProgressData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} domain={chartYAxisDomain} />
                      <Tooltip />
                      <Line type="monotone" dataKey="completed" name="Productivity" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 w-3/4 rounded bg-muted"></div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 h-3 w-full rounded bg-muted"></div>
                  <div className="h-3 w-2/3 rounded bg-muted"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayedTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {focusMode ? 'No urgent pending tasks. Your focus list is clear.' : 'No tasks yet. Create your first task!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedTasks.map((task) => (
                <Card
                  key={task.id}
                  className={isOverdueTask(task) ? 'border-red-300 shadow-sm shadow-red-100' : ''}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant={getStatusBadgeVariant(task.status)}>
                          {task.status}
                        </Badge>
                        <Badge variant="outline" className={getPriorityBadgeClasses(task.priority)}>
                          {task.priority}
                        </Badge>
                        {isOverdueTask(task) && (
                          <Badge variant="destructive">Late</Badge>
                        )}
                        {!isOverdueTask(task) && isReminderDueTask(task) && (
                          <Badge variant="secondary">Reminder Due</Badge>
                        )}
                        {task.delayRiskDetected && task.status !== 'completed' && (
                          <Badge variant="outline" className="border-sky-200 bg-sky-100 text-sky-700">
                            Delay Risk
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      Created {new Date(task.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">{task.description}</p>

                    <div className="mb-4 space-y-2 text-sm text-muted-foreground">
                      <p>Due: {formatDueDate(task.dueDate)}</p>
                      <p className="flex items-center gap-2">
                        <BellRing className="h-4 w-4" />
                        {task.reminderEnabled
                          ? `Reminder ${task.reminderMinutesBefore === 1440 ? '1 day' : `${task.reminderMinutesBefore} min`} before`
                          : 'Reminder disabled'}
                      </p>
                      {task.delayRiskDetected && task.delayRiskReason && task.status !== 'completed' && (
                        <p className="text-sky-700">{task.delayRiskReason}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-2 block text-xs font-medium">Update Status</label>
                      <Select
                        value={task.status}
                        onValueChange={(value: TaskStatus) => handleStatusUpdate(task.id, value)}
                        disabled={updatingTaskId === task.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/tasks/edit/${task.id}`)}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!focusMode && totalPages > 1 && (
              <div className="mt-8 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          onClick={() => setCurrentPage(i + 1)}
                          isActive={currentPage === i + 1}
                          className="cursor-pointer"
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
