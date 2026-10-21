import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Lock, Mail, User, Calendar, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Card, CardContent, CardFooter } from '../components/common/Card';
import { DisclaimerBanner } from '../components/common/DisclaimerBanner';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('1990-01-01');
  const [gender, setGender] = useState('MALE');
  const [acknowledgedDisclaimer, setAcknowledgedDisclaimer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password) {
      setError('Please fill out all required fields.');
      return;
    }

    if (!acknowledgedDisclaimer) {
      setError('You must acknowledge the non-diagnostic clinical disclaimer to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        fullName,
        email,
        password,
        dateOfBirth,
        gender,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
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
            Create Your Health Account
          </h2>
          <p className="text-xs text-slate-500">
            Initialize your encrypted personal health monitoring profile.
          </p>
        </div>

        <Card className="shadow-lg border-slate-200">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5 pt-6">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <Input
                label="Full Legal Name"
                placeholder="Dr. / Mr. / Ms. Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                required
              />

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
                label="Create Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                helperText="Minimum 6 characters"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Date of Birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  leftIcon={<Calendar className="w-4 h-4" />}
                  required
                />
                <Select
                  label="Biological Sex"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  options={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </div>

              {/* Consent checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 leading-snug">
                  <input
                    type="checkbox"
                    checked={acknowledgedDisclaimer}
                    onChange={(e) => setAcknowledgedDisclaimer(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                    required
                  />
                  <span>
                    I acknowledge that HealthSync AI provides <strong>statistical risk estimations only</strong> and is not a clinical diagnosis or medical device.
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full mt-2"
              >
                Create Account
              </Button>
            </CardContent>

            <CardFooter className="justify-center text-xs text-slate-500 bg-slate-50/50">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-sky-600 hover:text-sky-700 ml-1">
                Sign In
              </Link>
            </CardFooter>
          </form>
        </Card>

        <DisclaimerBanner compact />
      </div>
    </div>
  );
};
