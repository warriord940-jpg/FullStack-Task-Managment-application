import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CheckSquare } from 'lucide-react';

const Index = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/dashboard');
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="text-center space-y-6 p-8">
        <div className="flex justify-center">
          <CheckSquare className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Task Management System</h1>
        <p className="text-xl text-muted-foreground max-w-md">
          Organize your tasks efficiently with our modern task management application
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button size="lg" onClick={() => navigate('/signin')}>
            Sign In
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/signup')}>
            Sign Up
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
