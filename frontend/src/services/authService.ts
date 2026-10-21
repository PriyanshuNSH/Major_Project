import { IAuthService } from './apiContracts';
import { User } from '../types';
import { DEMO_USER } from './mockData';

class AuthService implements IAuthService {
  private currentUser: User | null = null;
  private readonly STORAGE_KEY = 'healthsync_active_user_session';

  constructor() {
    // Proactively purge legacy mock user session keys from browser storage
    try {
      sessionStorage.removeItem('healthsync_demo_active_user');
      localStorage.removeItem('healthsync_demo_active_user');
    } catch {
      // ignore
    }

    const saved = sessionStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          !parsed ||
          parsed.fullName === 'Alex Sharma' ||
          parsed.email?.includes('alex.demo') ||
          parsed.id?.includes('8f8b8e0a')
        ) {
          this.currentUser = DEMO_USER;
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(DEMO_USER));
        } else {
          this.currentUser = parsed;
        }
      } catch {
        this.currentUser = DEMO_USER;
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(DEMO_USER));
      }
    } else {
      // Default to neutral demo user for evaluation
      this.currentUser = DEMO_USER;
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(DEMO_USER));
    }
  }

  async login(email: string, password: string): Promise<User> {
    // Simulated network delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const user: User = {
      ...DEMO_USER,
      email,
      fullName: email.split('@')[0].replace('.', ' ').toUpperCase(),
    };

    this.currentUser = user;
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  async register(data: { email: string; password: string; fullName: string; dateOfBirth: string; gender: string }): Promise<User> {
    await new Promise((resolve) => setTimeout(resolve, 700));

    if (!data.email || !data.password || !data.fullName) {
      throw new Error('Please fill in all required registration fields.');
    }

    const user: User = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email: data.email,
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender as any,
      role: 'patient',
      createdAt: new Date().toISOString(),
    };

    this.currentUser = user;
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  async logout(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.currentUser = null;
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }
}

export const authService = new AuthService();
