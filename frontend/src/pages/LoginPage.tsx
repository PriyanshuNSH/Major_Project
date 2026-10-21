import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card, CardContent, CardFooter } from '../components/common/Card';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo.user@healthsync.ai');
    setPassword('DemoPass123!');
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs group-hover:bg-slate-800 transition-colors">
              <Activity className="w-5 h-5 text-sky-400" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">
              HealthSync <span className="text-sky-600">AI</span>
            </span>
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Sign In to Your Health Portal
          </h2>
          <p className="text-xs text-slate-500">
            Access your longitudinal risk assessments and clinical report history.
          </p>
        </div>

        {/* Demo Credentials Quick-Fill Card */}
        <div className="bg-sky-50 border border-sky-200/90 rounded-xl p-3 flex items-center justify-between text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Reviewing prototype? Fill mock credentials with one click.</span>
          </div>
          <button
            type="button"
            onClick={fillDemoCredentials}
            className="px-2.5 py-1 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-colors cursor-pointer shrink-0"
          >
            Auto-Fill
          </button>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg border-slate-200">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Account Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                helperText="Must be at least 6 characters"
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full mt-2"
              >
                Sign In
              </Button>
            </CardContent>

            <CardFooter className="justify-center text-xs text-slate-500 bg-slate-50/50">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-sky-600 hover:text-sky-700 ml-1">
                Create Account
              </Link>
            </CardFooter>
          </form>
        </Card>

        {/* Medical disclaimer */}
        <DisclaimerBanner compact />
      </div>
    </div>
  );
};
