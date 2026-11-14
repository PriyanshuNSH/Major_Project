/**
 * HealthSync AI — Clinician Care Management Frontend Integration Test Suite (Phase 6.3)
 * Executed with Node.js native test runner: `node --test frontend/tests/clinician.test.mjs`
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 6.3: Clinician Management & Care Team Frontend Integration Verification', () => {
  let mockStorage = {};
  let originalFetch;
  let requestsMade = [];

  class TestClinicianService {
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
        const title = payload?.title || 'Clinical Error';
        const err = new Error(detail);
        err.status = res.status;
        err.title = title;
        err.invalid_params = payload?.invalid_params;
        throw err;
      }
      return payload.data !== undefined ? payload.data : payload;
    }

    async getDashboardStats() {
      const res = await this.fetchApi('/api/v1/clinician/dashboard/stats');
      const raw = await this.handleResponse(res);
      return {
        totalAssignedPatients: raw.total_assigned_patients ?? raw.totalAssignedPatients ?? 0,
        activeAssignedPatients: raw.active_assigned_patients ?? raw.activeAssignedPatients ?? 0,
        patientsWithDiabetesAssessments: raw.patients_with_diabetes_assessments ?? raw.patientsWithDiabetesAssessments ?? 0,
        patientsWithCardiovascularAssessments: raw.patients_with_cardiovascular_assessments ?? raw.patientsWithCardiovascularAssessments ?? 0,
        recentActivity: (raw.recent_activity || raw.recentActivity || []).map((a) => ({
          id: a.id,
          eventType: a.event_type || a.eventType,
          patientId: a.patient_id || a.patientId,
          patientName: a.patient_name || a.patientName,
          createdAt: a.created_at || a.createdAt,
        })),
        recentAssessments: (raw.recent_assessments || raw.recentAssessments || []).map((a) => ({
          id: a.id,
          patientId: a.patient_id || a.patientId,
          patientName: a.patient_name || a.patientName,
          moduleId: a.module_id || a.moduleId,
          moduleName: a.module_name || a.moduleName,
          riskScore: a.risk_score ?? a.riskScore ?? 0,
          riskLevel: a.risk_level || a.riskLevel || 'LOW',
          createdAt: a.created_at || a.createdAt,
        })),
      };
    }

    async listPatients(params = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.sortBy) query.set('sort_by', params.sortBy);
      if (params.sortOrder) query.set('sort_order', params.sortOrder);

      const res = await this.fetchApi(`/api/v1/clinician/patients?${query.toString()}`);
      const raw = await this.handleResponse(res);

      return {
        items: (raw.items || []).map((p) => ({
          id: p.id,
          email: p.email,
          fullName: p.full_name || p.fullName,
          dateOfBirth: p.date_of_birth || p.dateOfBirth,
          gender: p.gender,
          assignmentId: p.assignment_id || p.assignmentId,
          assignedAt: p.assigned_at || p.assignedAt,
          assignmentNotes: p.assignment_notes || p.assignmentNotes,
          diabetesAssessmentCount: p.diabetes_assessment_count ?? p.diabetesAssessmentCount ?? 0,
          heartAssessmentCount: p.heart_assessment_count ?? p.heartAssessmentCount ?? 0,
          latestAssessmentDate: p.latest_assessment_date || p.latestAssessmentDate,
          latestRiskLevel: p.latest_risk_level || p.latestRiskLevel,
        })),
        total: raw.total ?? 0,
        page: raw.page ?? 1,
        limit: raw.limit ?? 20,
        totalPages: raw.total_pages ?? raw.totalPages ?? 1,
      };
    }

    async getPatientDetail(patientId) {
      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}`);
      const raw = await this.handleResponse(res);
      return {
        id: raw.id,
        email: raw.email,
        fullName: raw.full_name || raw.fullName,
        dateOfBirth: raw.date_of_birth || raw.dateOfBirth,
        gender: raw.gender,
        profile: raw.profile
          ? {
              bloodGroup: raw.profile.blood_group || raw.profile.bloodGroup,
              heightCm: raw.profile.height_cm ?? raw.profile.heightCm,
              weightKg: raw.profile.weight_kg ?? raw.profile.weightKg,
              smokingStatus: raw.profile.smoking_status || raw.profile.smokingStatus,
              alcoholConsumption: raw.profile.alcohol_consumption || raw.profile.alcoholConsumption,
              physicalActivityLevel: raw.profile.physical_activity_level || raw.profile.physicalActivityLevel,
            }
          : null,
        assignment: {
          assignmentId: raw.assignment.assignment_id || raw.assignment.assignmentId,
          assignedAt: raw.assignment.assigned_at || raw.assignment.assignedAt,
          isActive: raw.assignment.is_active ?? raw.assignment.isActive ?? true,
          notes: raw.assignment.notes,
        },
        diabetesAssessmentCount: raw.diabetes_assessment_count ?? raw.diabetesAssessmentCount ?? 0,
        heartAssessmentCount: raw.heart_assessment_count ?? raw.heartAssessmentCount ?? 0,
        disclaimer: raw.disclaimer,
      };
    }

    async getPatientAssessments(patientId, params = {}) {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.moduleId) query.set('module_id', params.moduleId);

      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}/assessments?${query.toString()}`);
      const raw = await this.handleResponse(res);
      return {
        items: (raw.items || []).map((item) => ({
          id: item.id,
          userId: item.user_id || item.userId,
          moduleId: item.module_id || item.moduleId,
          moduleName: item.module_name || item.moduleName,
          riskScore: item.risk_score ?? item.riskScore,
          riskLevel: item.risk_level || item.riskLevel,
          topRiskFactor: item.top_risk_factor || item.topRiskFactor,
          createdAt: item.created_at || item.createdAt,
          isDemonstrationData: item.is_demonstration_data ?? item.isDemonstrationData ?? false,
          modelVersion: item.model_version || item.modelVersion,
        })),
        total: raw.total ?? 0,
        page: raw.page ?? 1,
        size: raw.size ?? params.limit ?? 10,
        pages: raw.pages ?? 1,
      };
    }

    async getAssessmentDetail(patientId, assessmentId) {
      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}/assessments/${assessmentId}`);
      const raw = await this.handleResponse(res);
      return {
        id: raw.id,
        userId: raw.user_id || raw.userId,
        moduleId: raw.module_id || raw.moduleId,
        moduleName: raw.module_name || raw.moduleName,
        modelVersion: raw.model_version || raw.modelVersion,
        riskScore: raw.risk_score ?? raw.riskScore,
        riskLevel: raw.risk_level || raw.riskLevel,
        confidenceInterval: raw.confidence_interval || raw.confidenceInterval || null,
        baseExpectedRisk: raw.base_expected_risk ?? raw.baseExpectedRisk ?? 0.15,
        drivers: raw.drivers || [],
        recommendations: raw.recommendations || [],
        inputBiomarkers: raw.input_biomarkers || raw.inputBiomarkers || {},
        clinicalNotes: raw.clinical_notes || raw.clinicalNotes,
        createdAt: raw.created_at || raw.createdAt,
        disclaimer: raw.disclaimer,
      };
    }

    async downloadPatientReport(patientId, assessmentId) {
      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}/assessments/${assessmentId}/report`);
      if (!res.ok) {
        let problem = { title: 'Download Error', detail: 'Could not generate report' };
        try {
          problem = await res.json();
        } catch {
          // fallback
        }
        const err = new Error(problem.detail);
        err.status = res.status;
        err.title = problem.title;
        throw err;
      }

      const docHash = res.headers.get('X-HealthSync-Document-Hash') || 'unverified';
      const disposition = res.headers.get('Content-Disposition') || '';
      let filename = `HealthSync_Clinical_Report_${assessmentId.slice(0, 8)}.pdf`;
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }

      const blob = await res.blob();
      return { blob, docHash, filename };
    }

    async listNotes(patientId, includeArchived = false) {
      const query = includeArchived ? '?include_archived=true' : '';
      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}/notes${query}`);
      const raw = await this.handleResponse(res);
      return (raw.items || []).map((n) => ({
        id: n.id,
        patientId: n.patient_id || n.patientId,
        clinicianId: n.clinician_id || n.clinicianId,
        clinicianName: n.clinician_name || n.clinicianName,
        content: n.content,
        isArchived: Boolean(n.is_archived ?? n.isArchived ?? false),
        createdAt: n.created_at || n.createdAt,
        updatedAt: n.updated_at || n.updatedAt,
      }));
    }

    async createNote(patientId, content) {
      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      const raw = await this.handleResponse(res);
      return {
        id: raw.id,
        patientId: raw.patient_id || raw.patientId,
        clinicianId: raw.clinician_id || raw.clinicianId,
        clinicianName: raw.clinician_name || raw.clinicianName,
        content: raw.content,
        isArchived: Boolean(raw.is_archived ?? raw.isArchived ?? false),
        createdAt: raw.created_at || raw.createdAt,
        updatedAt: raw.updated_at || raw.updatedAt,
      };
    }

    async updateNote(patientId, noteId, content, isArchived) {
      const body = {};
      if (content !== undefined) body.content = content;
      if (isArchived !== undefined) body.is_archived = isArchived;

      const res = await this.fetchApi(`/api/v1/clinician/patients/${patientId}/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const raw = await this.handleResponse(res);
      return {
        id: raw.id,
        patientId: raw.patient_id || raw.patientId,
        clinicianId: raw.clinician_id || raw.clinicianId,
        clinicianName: raw.clinician_name || raw.clinicianName,
        content: raw.content,
        isArchived: Boolean(raw.is_archived ?? raw.isArchived ?? false),
        createdAt: raw.created_at || raw.createdAt,
        updatedAt: raw.updated_at || raw.updatedAt,
      };
    }
  }

  let clinicianService;

  beforeEach(() => {
    mockStorage = { healthsync_access_token: 'test-clinician-jwt-token' };
    requestsMade = [];
    originalFetch = globalThis.fetch;
    clinicianService = new TestClinicianService();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mockStorage = {};
    requestsMade = [];
  });

  // TEST 1: Dashboard Stats
  test('1. getDashboardStats loads and normalizes metrics', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/v1/clinician/dashboard/stats');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            total_assigned_patients: 24,
            active_assigned_patients: 22,
            patients_with_diabetes_assessments: 16,
            patients_with_cardiovascular_assessments: 12,
            recent_activity: [
              { id: 'act-1', event_type: 'clinician_accessed_patient', patient_name: 'John Doe', created_at: '2026-11-14T10:00:00Z' },
            ],
            recent_assessments: [
              { id: 'ass-1', patient_id: 'p-1', patient_name: 'John Doe', module_id: 'diabetes', module_name: 'Type 2 Diabetes', risk_score: 0.28, risk_level: 'MODERATE', created_at: '2026-11-14T09:30:00Z' },
            ],
          },
        }),
      };
    };

    const stats = await clinicianService.getDashboardStats();
    assert.equal(stats.totalAssignedPatients, 24);
    assert.equal(stats.activeAssignedPatients, 22);
    assert.equal(stats.patientsWithDiabetesAssessments, 16);
    assert.equal(stats.patientsWithCardiovascularAssessments, 12);
    assert.equal(stats.recentActivity.length, 1);
    assert.equal(stats.recentAssessments.length, 1);
    assert.equal(stats.recentAssessments[0].riskScore, 0.28);
    assert.equal(stats.recentAssessments[0].riskLevel, 'MODERATE');
  });

  // TEST 2: List Patients with Query Params
  test('2. listPatients propagates query params (search, limit, page, sort)', async () => {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes('/api/v1/clinician/patients?'));
      assert.ok(url.includes('page=2'));
      assert.ok(url.includes('limit=15'));
      assert.ok(url.includes('search=Alice'));
      assert.ok(url.includes('sort_by=assigned_at'));
      assert.ok(url.includes('sort_order=desc'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            items: [
              {
                id: 'p-alice',
                email: 'alice@example.com',
                full_name: 'Alice Cooper',
                date_of_birth: '1985-05-12',
                gender: 'female',
                assignment_id: 'asgn-1',
                assigned_at: '2026-11-10T12:00:00Z',
                diabetes_assessment_count: 2,
                heart_assessment_count: 1,
                latest_risk_level: 'LOW',
              },
            ],
            total: 1,
            page: 2,
            limit: 15,
            total_pages: 1,
          },
        }),
      };
    };

    const res = await clinicianService.listPatients({
      page: 2,
      limit: 15,
      search: 'Alice',
      sortBy: 'assigned_at',
      sortOrder: 'desc',
    });

    assert.equal(res.total, 1);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].fullName, 'Alice Cooper');
    assert.equal(res.items[0].diabetesAssessmentCount, 2);
    assert.equal(res.items[0].latestRiskLevel, 'LOW');
  });

  // TEST 3: Patient Detail with Baseline Vitals
  test('3. getPatientDetail returns baseline vitals and assignment metadata', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/v1/clinician/patients/p-100');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'p-100',
            email: 'patient100@example.com',
            full_name: 'Bob Ross',
            date_of_birth: '1975-08-20',
            gender: 'male',
            profile: {
              blood_group: 'O_POSITIVE',
              height_cm: 180,
              weight_kg: 82,
              smoking_status: 'former',
              alcohol_consumption: 'moderate',
              physical_activity_level: 'active',
            },
            assignment: {
              assignment_id: 'asgn-100',
              assigned_at: '2026-11-01T08:00:00Z',
              is_active: true,
              notes: 'Care monitoring for elevated blood pressure.',
            },
            diabetes_assessment_count: 3,
            heart_assessment_count: 2,
            disclaimer: 'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.',
          },
        }),
      };
    };

    const detail = await clinicianService.getPatientDetail('p-100');
    assert.equal(detail.id, 'p-100');
    assert.equal(detail.fullName, 'Bob Ross');
    assert.ok(detail.profile);
    assert.equal(detail.profile.bloodGroup, 'O_POSITIVE');
    assert.equal(detail.profile.heightCm, 180);
    assert.equal(detail.profile.weightKg, 82);
    assert.equal(detail.assignment.isActive, true);
    assert.equal(detail.diabetesAssessmentCount, 3);
    assert.ok(detail.disclaimer.includes('Informational risk estimation only'));
  });

  // TEST 4: Patient Detail 404 for Unassigned Patient
  test('4. getPatientDetail handles 404 for unassigned patient', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/v1/clinician/patients/unassigned-p');
      return {
        ok: false,
        status: 404,
        json: async () => ({
          type: 'https://tools.ietf.org/html/rfc7807',
          title: 'Patient Not Found or Access Unauthorized',
          status: 404,
          detail: 'Patient not found or you do not have an active care team assignment for this patient.',
        }),
      };
    };

    await assert.rejects(
      async () => {
        await clinicianService.getPatientDetail('unassigned-p');
      },
      (err) => {
        assert.equal(err.status, 404);
        assert.ok(err.message.includes('not have an active care team assignment'));
        return true;
      }
    );
  });

  // TEST 5: Patient Assessment History
  test('5. getPatientAssessments returns longitudinal records filterable by module', async () => {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes('/api/v1/clinician/patients/p-100/assessments?'));
      assert.ok(url.includes('module_id=diabetes'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            items: [
              {
                id: 'ass-101',
                user_id: 'p-100',
                module_id: 'diabetes',
                module_name: 'Type 2 Diabetes Screening',
                risk_score: 0.42,
                risk_level: 'MODERATE',
                top_risk_factor: 'Elevated Fasting Glucose',
                created_at: '2026-11-12T14:00:00Z',
                is_demonstration_data: false,
                model_version: 'v2.1',
              },
            ],
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
          },
        }),
      };
    };

    const res = await clinicianService.getPatientAssessments('p-100', { moduleId: 'diabetes' });
    assert.equal(res.total, 1);
    assert.equal(res.items[0].moduleId, 'diabetes');
    assert.equal(res.items[0].riskScore, 0.42);
    assert.equal(res.items[0].topRiskFactor, 'Elevated Fasting Glucose');
  });

  // TEST 6: Assessment Detail with SHAP Drivers and Disclaimer
  test('6. getAssessmentDetail returns SHAP drivers, confidence interval, and disclaimer', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/v1/clinician/patients/p-100/assessments/ass-101');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'ass-101',
            user_id: 'p-100',
            module_id: 'diabetes',
            module_name: 'Type 2 Diabetes Screening',
            model_version: 'v2.1',
            risk_score: 0.42,
            risk_level: 'MODERATE',
            confidence_interval: [0.38, 0.46],
            base_expected_risk: 0.15,
            drivers: [
              {
                feature: 'glucose',
                displayName: 'Fasting Plasma Glucose',
                featureValue: '145 mg/dL',
                shapImpact: 0.18,
                direction: 'RISK_ELEVATING',
                clinicalContext: 'Elevated fasting blood sugar increases insulin resistance risk.',
              },
            ],
            recommendations: ['Maintain regular physical activity', 'Consult primary care physician'],
            input_biomarkers: { glucose: 145, bmi: 28.4 },
            created_at: '2026-11-12T14:00:00Z',
            disclaimer: 'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.',
          },
        }),
      };
    };

    const detail = await clinicianService.getAssessmentDetail('p-100', 'ass-101');
    assert.equal(detail.id, 'ass-101');
    assert.equal(detail.riskScore, 0.42);
    assert.deepEqual(detail.confidenceInterval, [0.38, 0.46]);
    assert.equal(detail.drivers.length, 1);
    assert.equal(detail.drivers[0].direction, 'RISK_ELEVATING');
    assert.equal(detail.drivers[0].feature, 'glucose');
    assert.ok(detail.disclaimer.includes('Informational risk estimation only'));
  });

  // TEST 7: Download PDF Report with SHA-256 Hash
  test('7. downloadPatientReport retrieves PDF blob with verification hash', async () => {
    const fakeHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/v1/clinician/patients/p-100/assessments/ass-101/report');
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="HealthSync_Diabetes_Report_Bob_Ross.pdf"',
          'X-HealthSync-Document-Hash': fakeHash,
        }),
        blob: async () => new Blob(['%PDF-1.4 simulated pdf data'], { type: 'application/pdf' }),
      };
    };

    const report = await clinicianService.downloadPatientReport('p-100', 'ass-101');
    assert.equal(report.docHash, fakeHash);
    assert.equal(report.filename, 'HealthSync_Diabetes_Report_Bob_Ross.pdf');
    assert.ok(report.blob instanceof Blob);
  });

  // TEST 8: List Care Team Clinical Notes
  test('8. listNotes returns care-team notes with author clinician name and archive status', async () => {
    globalThis.fetch = async (url) => {
      assert.ok(url.includes('/api/v1/clinician/patients/p-100/notes'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            items: [
              {
                id: 'note-1',
                patient_id: 'p-100',
                clinician_id: 'c-1',
                clinician_name: 'Dr. Jane Smith',
                content: 'Patient reports improved dietary control and regular daily walks.',
                is_archived: false,
                created_at: '2026-11-13T09:00:00Z',
                updated_at: '2026-11-13T09:00:00Z',
              },
            ],
            total: 1,
          },
        }),
      };
    };

    const notes = await clinicianService.listNotes('p-100');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].clinicianName, 'Dr. Jane Smith');
    assert.equal(notes[0].isArchived, false);
    assert.ok(notes[0].content.includes('Patient reports improved dietary control'));
  });

  // TEST 9: Create Note
  test('9. createNote posts validated content and returns new note', async () => {
    let capturedBody;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/clinician/patients/p-100/notes');
      assert.equal(options.method, 'POST');
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          data: {
            id: 'note-new',
            patient_id: 'p-100',
            clinician_id: 'c-1',
            clinician_name: 'Dr. Jane Smith',
            content: capturedBody.content,
            is_archived: false,
            created_at: '2026-11-14T11:00:00Z',
            updated_at: '2026-11-14T11:00:00Z',
          },
        }),
      };
    };

    const note = await clinicianService.createNote('p-100', 'Scheduled comprehensive metabolic panel for next Tuesday.');
    assert.equal(capturedBody.content, 'Scheduled comprehensive metabolic panel for next Tuesday.');
    assert.equal(note.id, 'note-new');
    assert.equal(note.isArchived, false);
  });

  // TEST 10: Update Note (Content & Archive Status)
  test('10. updateNote patches note content and archive status', async () => {
    let capturedBody;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/v1/clinician/patients/p-100/notes/note-1');
      assert.equal(options.method, 'PATCH');
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            id: 'note-1',
            patient_id: 'p-100',
            clinician_id: 'c-1',
            clinician_name: 'Dr. Jane Smith',
            content: capturedBody.content || 'Existing note content',
            is_archived: capturedBody.is_archived !== undefined ? capturedBody.is_archived : false,
            created_at: '2026-11-13T09:00:00Z',
            updated_at: '2026-11-14T12:00:00Z',
          },
        }),
      };
    };

    const updated = await clinicianService.updateNote('p-100', 'note-1', undefined, true);
    assert.equal(capturedBody.is_archived, true);
    assert.equal(updated.isArchived, true);
  });
});
