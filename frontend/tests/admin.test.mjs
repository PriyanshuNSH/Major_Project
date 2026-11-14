/**
 * HealthSync AI — Super Admin Frontend Integration Test Suite (Phase 6.2)
 * Executed with Node.js native test runner: `node --test frontend/tests/admin.test.mjs`
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 6.2: Super Admin Dashboard, User Management & Audit Logging Frontend Verification', () => {
  let mockStorage = {};
  let originalFetch;
  let requestsMade = [];

  class TestAdminService {
    constructor() {
      this.TOKEN_STORAGE_KEY = 'healthsync_access_token';
    }

    getAccessToken() {
      return mockStorage[this.TOKEN_STORAGE_KEY] || null;
    }

    async fetchApi(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      const token = this.getAccessToken();
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      requestsMade.push({ path, options: { ...options, headers } });
      return await globalThis.fetch(path, { ...options, headers });
    }

    async handleResponse(res) {
      const payload = await res.json();
      if (!res.ok) {
        const detail = payload?.detail || payload?.message || `Request failed with status ${res.status}`;
        const title = payload?.title || 'Administrative Error';
        const err = new Error(detail);
        err.status = res.status;
        err.title = title;
        err.invalid_params = payload?.invalid_params;
        throw err;
      }
      return payload.data !== undefined ? payload.data : payload;
    }

    async getDashboardStats() {
      const res = await this.fetchApi('/api/v1/admin/dashboard/stats');
      const raw = await this.handleResponse(res);
      return {
        totalUsers: raw.total_users ?? 0,
        activeUsers: raw.active_users ?? 0,
        inactiveUsers: raw.inactive_users ?? 0,
        verifiedUsers: raw.verified_users ?? 0,
        unverifiedUsers: raw.unverified_users ?? 0,
        patientCount: raw.patient_count ?? 0,
        clinicianCount: raw.clinician_count ?? 0,
        adminCount: raw.admin_count ?? 0,
        totalDiabetesAssessments: raw.total_diabetes_assessments ?? 0,
        totalCardiovascularAssessments: raw.total_cardiovascular_assessments ?? 0,
        recentRegistrations: raw.recent_registrations || [],
        recentActivity: raw.recent_activity || [],
      };
    }

    async listUsers(params = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.role) query.set('role', params.role);
      if (params.isActive !== undefined) query.set('is_active', String(params.isActive));
      if (params.isVerified !== undefined) query.set('is_verified', String(params.isVerified));

      const res = await this.fetchApi(`/api/v1/admin/users?${query.toString()}`);
      return await this.handleResponse(res);
    }

    async getUserDetail(userId) {
      const res = await this.fetchApi(`/api/v1/admin/users/${userId}`);
      const u = await this.handleResponse(res);
      return {
        id: u.id,
        email: u.email,
        fullName: u.full_name || u.fullName,
        full_name: u.full_name || u.fullName,
        dateOfBirth: u.date_of_birth,
        gender: u.gender,
        role: u.role,
        isActive: u.is_active,
        isVerified: u.is_verified,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        profile: u.profile,
        assessmentCount: u.assessment_count ?? 0,
      };
    }

    async updateUserStatus(userId, isActive, reason) {
      const res = await this.fetchApi(`/api/v1/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive, reason }),
      });
      return await this.handleResponse(res);
    }

    async updateUserRole(userId, role, reason) {
      const res = await this.fetchApi(`/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role, reason }),
      });
      return await this.handleResponse(res);
    }

    async listAuditLogs(params = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.eventType) query.set('event_type', params.eventType);

      const res = await this.fetchApi(`/api/v1/admin/audit-logs?${query.toString()}`);
      const raw = await this.handleResponse(res);
      return {
        items: (raw.items || []).map((a) => ({
          id: a.id,
          userId: a.user_id,
          actorEmail: a.actor_email,
          actorName: a.actor_name,
          eventType: a.event_type,
          resourceType: a.resource_type,
          resourceId: a.resource_id,
          ipAddressHash: a.ip_address_hash,
          userAgent: a.user_agent,
          metadataJson: a.metadata_json,
          createdAt: a.created_at,
        })),
        total: raw.total ?? 0,
        page: raw.page ?? 1,
        limit: raw.limit ?? 25,
        totalPages: raw.total_pages ?? 1,
      };
    }

    async createAssignment(clinicianId, patientId, notes) {
      const res = await this.fetchApi('/api/v1/admin/assignments', {
        method: 'POST',
        body: JSON.stringify({ clinician_id: clinicianId, patient_id: patientId, notes }),
      });
      const a = await this.handleResponse(res);
      return {
        id: a.id,
        clinicianId: a.clinician_id,
        clinicianName: a.clinician_name,
        clinicianEmail: a.clinician_email,
        patientId: a.patient_id,
        patientName: a.patient_name,
        patientEmail: a.patient_email,
        assignedAt: a.assigned_at,
        isActive: a.is_active,
        notes: a.notes,
      };
    }

    async revokeAssignment(assignmentId) {
      const res = await this.fetchApi(`/api/v1/admin/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      return await this.handleResponse(res);
    }
  }

  const adminService = new TestAdminService();

  beforeEach(() => {
    mockStorage = {
      healthsync_access_token: 'test_admin_jwt_token_xyz',
    };
    requestsMade = [];
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockStorage = {};
  });

  test('1. getDashboardStats retrieves and normalizes aggregate counts with auth header', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/admin/dashboard/stats');
      assert.equal(options.headers['Authorization'], 'Bearer test_admin_jwt_token_xyz');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            total_users: 142,
            active_users: 130,
            inactive_users: 12,
            verified_users: 110,
            unverified_users: 32,
            patient_count: 120,
            clinician_count: 18,
            admin_count: 4,
            total_diabetes_assessments: 340,
            total_cardiovascular_assessments: 280,
            recent_registrations: [{ id: 'u1', email: 'a@example.com', full_name: 'A' }],
            recent_activity: [{ id: 'a1', event_type: 'user_role_changed' }],
          },
        }),
      };
    };

    const stats = await adminService.getDashboardStats();
    assert.equal(stats.totalUsers, 142);
    assert.equal(stats.activeUsers, 130);
    assert.equal(stats.verifiedUsers, 110);
    assert.equal(stats.patientCount, 120);
    assert.equal(stats.clinicianCount, 18);
    assert.equal(stats.adminCount, 4);
    assert.equal(stats.totalDiabetesAssessments, 340);
    assert.equal(stats.totalCardiovascularAssessments, 280);
    assert.equal(stats.recentRegistrations.length, 1);
    assert.equal(stats.recentActivity.length, 1);
  });

  test('2. listUsers propagates query parameters (search, role, isActive)', async () => {
    globalThis.fetch = async (url, options) => {
      assert.ok(url.includes('/api/v1/admin/users?'));
      assert.ok(url.includes('search=carter'));
      assert.ok(url.includes('role=clinician'));
      assert.ok(url.includes('is_active=true'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            items: [{ id: 'c1', full_name: 'Dr. Carter', role: 'clinician', is_active: true }],
            total: 1,
            page: 1,
            limit: 10,
            total_pages: 1,
          },
        }),
      };
    };

    const res = await adminService.listUsers({ search: 'carter', role: 'clinician', isActive: true });
    assert.equal(res.total, 1);
    assert.equal(res.items[0].full_name, 'Dr. Carter');
  });

  test('3. getUserDetail returns user metadata and handles 404', async () => {
    globalThis.fetch = async (url) => {
      if (url.includes('not-found-id')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({
            title: 'User Not Found',
            detail: 'User account not found.',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'u-valid',
            full_name: 'John Doe',
            assessment_count: 5,
            profile: { blood_group: 'O+' },
          },
        }),
      };
    };

    const detail = await adminService.getUserDetail('u-valid');
    assert.equal(detail.full_name, 'John Doe');
    assert.equal(detail.assessmentCount, 5);

    await assert.rejects(
      async () => await adminService.getUserDetail('not-found-id'),
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.title, 'User Not Found');
        return true;
      }
    );
  });

  test('4. updateUserStatus dispatches PATCH with active state and audit reason', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/admin/users/target-123/status');
      assert.equal(options.method, 'PATCH');
      const payload = JSON.parse(options.body);
      assert.equal(payload.is_active, false);
      assert.equal(payload.reason, 'Suspicious access pattern');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'target-123', is_active: false },
        }),
      };
    };

    const updated = await adminService.updateUserStatus('target-123', false, 'Suspicious access pattern');
    assert.equal(updated.is_active, false);
  });

  test('5. updateUserRole dispatches PATCH with role update', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/admin/users/target-456/role');
      assert.equal(options.method, 'PATCH');
      const payload = JSON.parse(options.body);
      assert.equal(payload.role, 'clinician');
      assert.equal(payload.reason, 'Board certification verified');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { id: 'target-456', role: 'clinician' },
        }),
      };
    };

    const updated = await adminService.updateUserRole('target-456', 'clinician', 'Board certification verified');
    assert.equal(updated.role, 'clinician');
  });

  test('6. updateUserStatus handles Self-Deactivation rejection (HTTP 400)', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        title: 'Self-Deactivation Prohibited',
        detail: 'Administrators cannot deactivate their own accounts.',
      }),
    });

    await assert.rejects(
      async () => await adminService.updateUserStatus('self-admin', false),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.title, 'Self-Deactivation Prohibited');
        return true;
      }
    );
  });

  test('7. updateUserRole handles Last-Admin Protection conflict (HTTP 409)', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 409,
      json: async () => ({
        title: 'Last Administrator Protection',
        detail: 'Cannot demote the last active administrator account.',
      }),
    });

    await assert.rejects(
      async () => await adminService.updateUserRole('last-admin', 'patient'),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.title, 'Last Administrator Protection');
        return true;
      }
    );
  });

  test('8. listAuditLogs queries audit endpoint with event_type filter', async () => {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes('/api/v1/admin/audit-logs?'));
      assert.ok(url.includes('event_type=user_role_changed'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            items: [{ id: 'a1', event_type: 'user_role_changed', resource_type: 'user' }],
            total: 1,
            page: 1,
            limit: 25,
            total_pages: 1,
          },
        }),
      };
    };

    const res = await adminService.listAuditLogs({ eventType: 'user_role_changed' });
    assert.equal(res.total, 1);
    assert.equal(res.items[0].eventType, 'user_role_changed');
  });

  test('9. createAssignment validates and dispatches clinician-patient link', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/admin/assignments');
      assert.equal(options.method, 'POST');
      const payload = JSON.parse(options.body);
      assert.equal(payload.clinician_id, 'clin-1');
      assert.equal(payload.patient_id, 'pat-1');
      return {
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: 'assign-1',
            clinician_id: 'clin-1',
            clinician_name: 'Dr. Sarah',
            patient_id: 'pat-1',
            patient_name: 'John',
            is_active: true,
          },
        }),
      };
    };

    const assignment = await adminService.createAssignment('clin-1', 'pat-1', 'Primary care');
    assert.equal(assignment.id, 'assign-1');
    assert.equal(assignment.clinicianName, 'Dr. Sarah');
    assert.equal(assignment.isActive, true);
  });

  test('10. revokeAssignment dispatches DELETE to assignment endpoint', async () => {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/admin/assignments/assign-1');
      assert.equal(options.method, 'DELETE');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { message: "Assignment 'assign-1' successfully revoked." },
        }),
      };
    };

    await adminService.revokeAssignment('assign-1');
    assert.equal(requestsMade.length, 1);
    assert.equal(requestsMade[0].options.method, 'DELETE');
  });
});
