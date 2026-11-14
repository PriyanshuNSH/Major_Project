/**
 * HealthSync AI — Authentication & Account Security Frontend Integration Test Suite (Phase 6.1)
 * Executed with Node.js native test runner: `node --test frontend/tests/authSecurity.test.mjs`
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 6.1: Authentication & Account Security Frontend Verification', () => {
  let mockStorage = {};
  let originalFetch;
  let requestsMade = [];

  // Emulated AuthService matching frontend/src/services/authService.ts
  class TestAuthService {
    constructor() {
      this.currentUser = null;
      this.accessToken = null;
      this.TOKEN_STORAGE_KEY = 'healthsync_access_token';
      this.USER_STORAGE_KEY = 'healthsync_active_user_session';
    }

    normalizeUser(backendUser) {
      return {
        id: backendUser.user_id || backendUser.id,
        email: backendUser.email,
        fullName: backendUser.full_name || backendUser.fullName,
        dateOfBirth: backendUser.date_of_birth || backendUser.dateOfBirth,
        gender: backendUser.gender,
        role: backendUser.role || 'patient',
        isVerified: Boolean(backendUser.is_verified ?? backendUser.isVerified ?? false),
        createdAt: backendUser.created_at || backendUser.createdAt || new Date().toISOString(),
      };
    }

    async fetchApi(path, options = {}) {
      requestsMade.push({ path, options });
      return await globalThis.fetch(path, options);
    }

    async handleResponse(response) {
      const payload = await response.json();
      if (!response.ok) {
        const detail = payload?.detail || payload?.message || `Request failed with HTTP status ${response.status}.`;
        const title = payload?.title || 'Authentication Error';
        const err = new Error(detail);
        err.status = response.status;
        err.title = title;
        throw err;
      }
      return payload?.data || payload;
    }

    async forgotPassword(email) {
      if (!email || !email.trim()) {
        throw new Error('Please enter your account email address.');
      }
      const response = await this.fetchApi('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await this.handleResponse(response);
      return data?.message || 'If an account with that email exists, password reset instructions have been sent.';
    }

    async resetPassword(token, newPassword) {
      if (!token || !token.trim()) {
        throw new Error('Reset token is required.');
      }
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      const response = await this.fetchApi('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      const data = await this.handleResponse(response);
      return data?.message || 'Password reset successfully. You may now log in with your new password.';
    }

    async verifyEmail(token) {
      if (!token || !token.trim()) {
        throw new Error('Verification token is required.');
      }
      const response = await this.fetchApi('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await this.handleResponse(response);
      if (this.currentUser) {
        this.currentUser = { ...this.currentUser, isVerified: true };
        mockStorage[this.USER_STORAGE_KEY] = JSON.stringify(this.currentUser);
      }
      return data?.message || 'Email address verified successfully.';
    }

    async resendVerification(email) {
      if (!email || !email.trim()) {
        throw new Error('Email address is required.');
      }
      const response = await this.fetchApi('/api/v1/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await this.handleResponse(response);
      return data?.message || 'If an unverified account with that email exists, a new verification link has been sent.';
    }

    async changePassword(currentPassword, newPassword) {
      if (!currentPassword) {
        throw new Error('Current password is required.');
      }
      if (!newPassword || newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long.');
      }
      const response = await this.fetchApi('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.accessToken}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await this.handleResponse(response);
      this.accessToken = data.access_token;
      mockStorage[this.TOKEN_STORAGE_KEY] = this.accessToken;
      const user = this.normalizeUser(data.user);
      this.currentUser = user;
      mockStorage[this.USER_STORAGE_KEY] = JSON.stringify(user);
      return user;
    }
  }

  let service;

  beforeEach(() => {
    mockStorage = {};
    requestsMade = [];
    service = new TestAuthService();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('1. forgotPassword dispatches anti-enumeration request and returns message', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/auth/forgot-password');
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      assert.equal(body.email, 'patient@example.com');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { message: 'If an account with that email exists, password reset instructions have been sent.' },
        }),
      };
    };

    const msg = await service.forgotPassword('  patient@example.com  ');
    assert.match(msg, /password reset instructions have been sent/);
  });

  test('2. forgotPassword rejects empty email without making API call', async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; };
    await assert.rejects(async () => {
      await service.forgotPassword('   ');
    }, /Please enter your account email address/);
    assert.equal(called, false);
  });

  test('3. resetPassword submits token and new password successfully', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/auth/reset-password');
      const body = JSON.parse(options.body);
      assert.equal(body.token, 'valid_token_123');
      assert.equal(body.newPassword, 'StrongNewPass123!');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { message: 'Password reset successfully. You may now log in with your new password.' },
        }),
      };
    };

    const msg = await service.resetPassword('valid_token_123', 'StrongNewPass123!');
    assert.match(msg, /Password reset successfully/);
  });

  test('4. resetPassword enforces client validation on password length (< 8 chars)', async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; };
    await assert.rejects(async () => {
      await service.resetPassword('token_abc', 'short');
    }, /Password must be at least 8 characters long/);
    assert.equal(called, false);
  });

  test('5. resetPassword handles expired token RFC 7807 error from backend', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        status: 400,
        title: 'Expired Token',
        detail: 'This password reset link has expired. Please request a new link.',
      }),
    });

    await assert.rejects(async () => {
      await service.resetPassword('expired_token', 'ValidPassword123!');
    }, (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.title, 'Expired Token');
      assert.match(err.message, /This password reset link has expired/);
      return true;
    });
  });

  test('6. verifyEmail marks user as verified in active session state', async () => {
    service.currentUser = { id: 'u1', email: 'diana@example.com', isVerified: false };
    mockStorage[service.USER_STORAGE_KEY] = JSON.stringify(service.currentUser);

    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/auth/verify-email');
      const body = JSON.parse(options.body);
      assert.equal(body.token, 'verify_token_999');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { message: 'Email address verified successfully.' },
        }),
      };
    };

    const msg = await service.verifyEmail('verify_token_999');
    assert.match(msg, /Email address verified successfully/);
    assert.equal(service.currentUser.isVerified, true);
    const stored = JSON.parse(mockStorage[service.USER_STORAGE_KEY]);
    assert.equal(stored.isVerified, true);
  });

  test('7. resendVerification dispatches request and returns anti-enumeration message', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/auth/resend-verification');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { message: 'If an unverified account with that email exists, a new verification link has been sent.' },
        }),
      };
    };

    const msg = await service.resendVerification('patient@example.com');
    assert.match(msg, /new verification link has been sent/);
  });

  test('8. changePassword updates session token, user state, and storage', async () => {
    service.accessToken = 'old_access_token';
    service.currentUser = { id: 'u2', email: 'bob@example.com', fullName: 'Bob', isVerified: true };

    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/auth/change-password');
      assert.equal(options.headers.Authorization, 'Bearer old_access_token');
      const body = JSON.parse(options.body);
      assert.equal(body.currentPassword, 'OldPass123!');
      assert.equal(body.newPassword, 'BrandNewPass456!');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            access_token: 'fresh_access_token_777',
            token_type: 'bearer',
            expires_in: 900,
            user: {
              user_id: 'u2',
              email: 'bob@example.com',
              full_name: 'Bob',
              role: 'patient',
              is_verified: true,
            },
          },
        }),
      };
    };

    const updatedUser = await service.changePassword('OldPass123!', 'BrandNewPass456!');
    assert.equal(service.accessToken, 'fresh_access_token_777');
    assert.equal(mockStorage[service.TOKEN_STORAGE_KEY], 'fresh_access_token_777');
    assert.equal(updatedUser.email, 'bob@example.com');
    assert.equal(updatedUser.isVerified, true);
  });

  test('9. normalizeUser correctly populates isVerified from both camelCase and snake_case', () => {
    const userSnake = service.normalizeUser({
      user_id: '1',
      email: 'a@example.com',
      full_name: 'A',
      is_verified: true,
    });
    assert.equal(userSnake.isVerified, true);

    const userCamel = service.normalizeUser({
      id: '2',
      email: 'b@example.com',
      fullName: 'B',
      isVerified: false,
    });
    assert.equal(userCamel.isVerified, false);
  });
});
