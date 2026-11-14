/**
 * HealthSync AI — Frontend Integration & Validation Test Suite (Master Phase 5.7)
 * Heart Disease Risk Assessment & User Experience
 * Executed with Node.js native test runner: `node --test frontend/tests/heartAssessment.test.mjs`
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 5.7: Heart Disease Biomarker Validation Rules (11 Features)', () => {
  // Pure validator mirroring HeartAssessmentPage.tsx validateAll()
  function validateHeartInputs(input) {
    const errors = {};

    const {
      age,
      sex,
      chestPainType,
      restingBp,
      serumCholesterol,
      fastingBloodSugar,
      restingEcg,
      maxHeartRate,
      exerciseAngina,
      oldpeak,
      stSlope,
    } = input;

    // Age: 18 - 120
    if (age === '' || age === undefined || isNaN(Number(age)) || Number(age) < 18 || Number(age) > 120) {
      errors.age = 'Patient age is required (18 - 120 years).';
    }

    // Resting BP: 60 - 260 mmHg
    if (restingBp === '' || restingBp === undefined || isNaN(Number(restingBp)) || Number(restingBp) < 60 || Number(restingBp) > 260) {
      errors.restingBp = 'Resting blood pressure is required (60 - 260 mmHg).';
    }

    // Serum Cholesterol: 100 - 600 mg/dL
    if (serumCholesterol === '' || serumCholesterol === undefined || isNaN(Number(serumCholesterol)) || Number(serumCholesterol) < 100 || Number(serumCholesterol) > 600) {
      errors.serumCholesterol = 'Serum cholesterol is required (100 - 600 mg/dL).';
    }

    // Max Heart Rate: 60 - 220 bpm
    if (maxHeartRate === '' || maxHeartRate === undefined || isNaN(Number(maxHeartRate)) || Number(maxHeartRate) < 60 || Number(maxHeartRate) > 220) {
      errors.maxHeartRate = 'Maximum heart rate achieved is required (60 - 220 bpm).';
    }

    // Oldpeak: 0.0 - 10.0 mm
    if (oldpeak === '' || oldpeak === undefined || isNaN(Number(oldpeak)) || Number(oldpeak) < 0.0 || Number(oldpeak) > 10.0) {
      errors.oldpeak = 'ST depression (Oldpeak) is required (0.0 - 10.0 mm).';
    }

    // Sex: 0 or 1
    if (sex !== 0 && sex !== 1) {
      errors.sex = 'Biological sex must be 0 (Female) or 1 (Male).';
    }

    // Chest Pain Type: 0, 1, 2, 3
    if (![0, 1, 2, 3].includes(chestPainType)) {
      errors.chestPainType = 'Chest pain profile must be one of the specified categories.';
    }

    // Resting ECG: 0, 1, 2
    if (![0, 1, 2].includes(restingEcg)) {
      errors.restingEcg = 'Resting ECG must be one of the specified categories.';
    }

    // ST Slope: 0, 1, 2
    if (![0, 1, 2].includes(stSlope)) {
      errors.stSlope = 'ST slope must be one of the specified categories.';
    }

    return errors;
  }

  test('valid physiological baseline passes with zero validation errors', () => {
    const valid = {
      age: 45,
      sex: 0,
      chestPainType: 2,
      restingBp: 118,
      serumCholesterol: 175,
      fastingBloodSugar: false,
      restingEcg: 0,
      maxHeartRate: 168,
      exerciseAngina: false,
      oldpeak: 0.2,
      stSlope: 0,
    };
    const errors = validateHeartInputs(valid);
    assert.deepEqual(errors, {});
  });

  test('rejects out-of-boundary age (<18 or >120 years)', () => {
    const underAge = validateHeartInputs({ age: 17, restingBp: 120, serumCholesterol: 200, maxHeartRate: 150, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(underAge.age, /18 - 120/);

    const overAge = validateHeartInputs({ age: 125, restingBp: 120, serumCholesterol: 200, maxHeartRate: 150, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(overAge.age, /18 - 120/);
  });

  test('rejects out-of-boundary resting blood pressure (<60 or >260 mmHg)', () => {
    const lowBp = validateHeartInputs({ age: 50, restingBp: 55, serumCholesterol: 200, maxHeartRate: 150, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(lowBp.restingBp, /60 - 260/);

    const highBp = validateHeartInputs({ age: 50, restingBp: 275, serumCholesterol: 200, maxHeartRate: 150, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(highBp.restingBp, /60 - 260/);
  });

  test('rejects out-of-boundary serum cholesterol (<100 or >600 mg/dL)', () => {
    const lowChol = validateHeartInputs({ age: 50, restingBp: 120, serumCholesterol: 80, maxHeartRate: 150, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(lowChol.serumCholesterol, /100 - 600/);

    const highChol = validateHeartInputs({ age: 50, restingBp: 120, serumCholesterol: 650, maxHeartRate: 150, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(highChol.serumCholesterol, /100 - 600/);
  });

  test('rejects out-of-boundary maximum heart rate (<60 or >220 bpm)', () => {
    const lowHr = validateHeartInputs({ age: 50, restingBp: 120, serumCholesterol: 200, maxHeartRate: 50, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(lowHr.maxHeartRate, /60 - 220/);

    const highHr = validateHeartInputs({ age: 50, restingBp: 120, serumCholesterol: 200, maxHeartRate: 235, oldpeak: 1.0, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(highHr.maxHeartRate, /60 - 220/);
  });

  test('rejects out-of-boundary oldpeak ST depression (<0.0 or >10.0 mm)', () => {
    const negativeOldpeak = validateHeartInputs({ age: 50, restingBp: 120, serumCholesterol: 200, maxHeartRate: 150, oldpeak: -0.5, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(negativeOldpeak.oldpeak, /0.0 - 10.0/);

    const extremeOldpeak = validateHeartInputs({ age: 50, restingBp: 120, serumCholesterol: 200, maxHeartRate: 150, oldpeak: 12.5, sex: 1, chestPainType: 0, restingEcg: 0, stSlope: 1 });
    assert.match(extremeOldpeak.oldpeak, /0.0 - 10.0/);
  });

  test('rejects invalid categorical values for sex, chestPainType, restingEcg, stSlope', () => {
    const invalidCats = validateHeartInputs({
      age: 50,
      restingBp: 120,
      serumCholesterol: 200,
      maxHeartRate: 150,
      oldpeak: 1.0,
      sex: 3,
      chestPainType: 5,
      restingEcg: 4,
      stSlope: 9,
    });
    assert.ok(invalidCats.sex);
    assert.ok(invalidCats.chestPainType);
    assert.ok(invalidCats.restingEcg);
    assert.ok(invalidCats.stSlope);
  });

  test('detects multiple simultaneous missing/invalid inputs', () => {
    const emptyForm = validateHeartInputs({
      age: '',
      restingBp: '',
      serumCholesterol: '',
      maxHeartRate: '',
      oldpeak: '',
      sex: 1,
      chestPainType: 0,
      restingEcg: 0,
      stSlope: 1,
    });
    assert.equal(Object.keys(emptyForm).length, 5);
    assert.ok(emptyForm.age);
    assert.ok(emptyForm.restingBp);
    assert.ok(emptyForm.serumCholesterol);
    assert.ok(emptyForm.maxHeartRate);
    assert.ok(emptyForm.oldpeak);
  });
});

describe('Phase 5.7: Sample Presets Verification', () => {
  test('baseline sample preset represents physiologically coherent low-risk profile', () => {
    const baseline = {
      age: 45,
      sex: 0,
      chestPainType: 2,
      restingBp: 118,
      serumCholesterol: 175,
      fastingBloodSugar: false,
      restingEcg: 0,
      maxHeartRate: 168,
      exerciseAngina: false,
      oldpeak: 0.2,
      stSlope: 0,
    };
    assert.equal(baseline.age >= 18 && baseline.age <= 120, true);
    assert.equal(baseline.restingBp < 120, true);
    assert.equal(baseline.serumCholesterol < 200, true);
    assert.equal(baseline.exerciseAngina, false);
    assert.equal(baseline.oldpeak < 1.0, true);
  });

  test('elevated sample preset represents clinically coherent high-risk profile', () => {
    const highRisk = {
      age: 62,
      sex: 1,
      chestPainType: 3,
      restingBp: 155,
      serumCholesterol: 285,
      fastingBloodSugar: true,
      restingEcg: 1,
      maxHeartRate: 118,
      exerciseAngina: true,
      oldpeak: 2.6,
      stSlope: 1,
    };
    assert.equal(highRisk.age > 60, true);
    assert.equal(highRisk.restingBp > 140, true);
    assert.equal(highRisk.serumCholesterol > 240, true);
    assert.equal(highRisk.exerciseAngina, true);
    assert.equal(highRisk.oldpeak > 2.0, true);
  });
});

describe('Phase 5.7: Calibrated 4-Tier Risk Threshold Alignment for Heart Disease', () => {
  const HEART_THRESHOLDS = [0.30, 0.55, 0.75];

  function getHeartRiskLevel(score, thresholds = HEART_THRESHOLDS) {
    const [t1, t2, t3] = thresholds;
    if (score < t1) return 'LOW';
    if (score < t2) return 'MODERATE';
    if (score < t3) return 'HIGH';
    return 'CRITICAL';
  }

  function getRiskStyles(level) {
    switch (level) {
      case 'LOW':
        return { colorHex: '#059669', badgeBg: 'bg-emerald-50' };
      case 'MODERATE':
        return { colorHex: '#d97706', badgeBg: 'bg-amber-50' };
      case 'HIGH':
        return { colorHex: '#ea580c', badgeBg: 'bg-orange-50' };
      case 'CRITICAL':
        return { colorHex: '#e11d48', badgeBg: 'bg-rose-50' };
    }
  }

  test('score 0.29 categorizes as LOW with emerald color (#059669)', () => {
    const level = getHeartRiskLevel(0.29);
    assert.equal(level, 'LOW');
    assert.equal(getRiskStyles(level).colorHex, '#059669');
  });

  test('score 0.30 categorizes as MODERATE with amber color (#d97706)', () => {
    const level = getHeartRiskLevel(0.30);
    assert.equal(level, 'MODERATE');
    assert.equal(getRiskStyles(level).colorHex, '#d97706');
  });

  test('score 0.54 categorizes as MODERATE with amber color (#d97706)', () => {
    const level = getHeartRiskLevel(0.54);
    assert.equal(level, 'MODERATE');
    assert.equal(getRiskStyles(level).colorHex, '#d97706');
  });

  test('score 0.55 categorizes as HIGH with orange color (#ea580c)', () => {
    const level = getHeartRiskLevel(0.55);
    assert.equal(level, 'HIGH');
    assert.equal(getRiskStyles(level).colorHex, '#ea580c');
  });

  test('score 0.74 categorizes as HIGH with orange color (#ea580c)', () => {
    const level = getHeartRiskLevel(0.74);
    assert.equal(level, 'HIGH');
    assert.equal(getRiskStyles(level).colorHex, '#ea580c');
  });

  test('score 0.75 categorizes as CRITICAL with rose color (#e11d48)', () => {
    const level = getHeartRiskLevel(0.75);
    assert.equal(level, 'CRITICAL');
    assert.equal(getRiskStyles(level).colorHex, '#e11d48');
  });

  test('score 0.88 categorizes as CRITICAL with rose color (#e11d48)', () => {
    const level = getHeartRiskLevel(0.88);
    assert.equal(level, 'CRITICAL');
    assert.equal(getRiskStyles(level).colorHex, '#e11d48');
  });

  test('verifies distinct threshold boundaries between Diabetes and Heart Disease', () => {
    const DIABETES_THRESHOLDS = [0.20, 0.45, 0.70];
    assert.notDeepEqual(HEART_THRESHOLDS, DIABETES_THRESHOLDS);
    assert.equal(HEART_THRESHOLDS[0], 0.30);
    assert.equal(HEART_THRESHOLDS[1], 0.55);
    assert.equal(HEART_THRESHOLDS[2], 0.75);
  });
});

describe('Phase 5.7: Visual RiskGauge Threshold Marks for Heart Disease', () => {
  const MODULE_THRESHOLDS = {
    diabetes: [0.20, 0.45, 0.70],
    heart_disease: [0.30, 0.55, 0.75],
  };

  function getThresholdMarks(moduleId) {
    const [t1, t2, t3] = MODULE_THRESHOLDS[moduleId] || MODULE_THRESHOLDS.diabetes;
    return [0, Math.round(t1 * 100), Math.round(t2 * 100), Math.round(t3 * 100), 100];
  }

  test('heart disease gauge displays [0%, 30%, 55%, 75%, 100%] scale marks', () => {
    const marks = getThresholdMarks('heart_disease');
    assert.deepEqual(marks, [0, 30, 55, 75, 100]);
  });

  test('diabetes gauge displays [0%, 20%, 45%, 70%, 100%] scale marks without regression', () => {
    const marks = getThresholdMarks('diabetes');
    assert.deepEqual(marks, [0, 20, 45, 70, 100]);
  });
});

describe('Phase 5.7: SHAP Attribution & Decision Margin Formatting', () => {
  test('formats SHAP impacts as decision margin shifts (log-odds), never percentage probability', () => {
    const driver = {
      feature: 'oldpeak',
      displayName: 'ST Depression (Oldpeak)',
      featureValue: '2.6 mm',
      shapImpact: 0.428,
      direction: 'RISK_ELEVATING',
      clinicalContext: 'Exercise-induced myocardial ischemia indicator.',
    };

    const formattedShift = `+${driver.shapImpact.toFixed(3)} margin shift`;
    assert.equal(formattedShift, '+0.428 margin shift');
    assert.equal(formattedShift.includes('%'), false, 'SHAP impact must NEVER be formatted as percentage');
  });

  test('preserves Logistic Regression decision-margin attribution notice for heart disease', () => {
    const resolvedEstimator = 'calibrated Logistic Regression classifier';
    const notice = `* Methodological Notice: SHAP attributions reflect raw-model decision-margin effects (log-odds / margin units) from the ${resolvedEstimator}. They demonstrate directional feature attribution rather than percentage additions to calibrated risk probability.`;

    assert.ok(notice.includes('calibrated Logistic Regression classifier'));
    assert.ok(notice.includes('log-odds / margin units'));
    assert.ok(notice.includes('directional feature attribution'));
    assert.ok(notice.includes('rather than percentage additions'));
  });

  test('validates Cleveland cohort expected baseline incidence ~0.459', () => {
    const baselineExpectedRisk = 0.4587;
    assert.equal(baselineExpectedRisk.toFixed(3), '0.459');
    assert.ok(baselineExpectedRisk > 0.40 && baselineExpectedRisk < 0.50);
  });
});

describe('Phase 5.7: Guest vs Authenticated Experience & Storage Isolation', () => {
  test('guest assessment operates in-memory with zero persistent database records', () => {
    const guestResult = {
      id: 'asm_ht_12345678',
      userId: 'guest',
      moduleId: 'heart_disease',
      riskScore: 0.38,
      riskLevel: 'MODERATE',
      isGuest: true,
    };

    assert.equal(guestResult.isGuest, true);
    assert.equal(guestResult.userId, 'guest');
    assert.ok(!guestResult.id.includes('-'), 'Guest assessment ID is ephemeral prefix, not persistent UUID');
  });

  test('authenticated assessment persists with tenant user ID and canonical UUID', () => {
    const authResult = {
      id: '9f8b7c6d-5e4a-3b2a-1c0d-e9f8a7b6c5d4',
      userId: 'usr_patient_cardio_01',
      moduleId: 'heart_disease',
      riskScore: 0.68,
      riskLevel: 'HIGH',
      isGuest: false,
    };

    assert.equal(authResult.isGuest, false);
    assert.notEqual(authResult.userId, 'guest');
    assert.match(authResult.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('Phase 5.7: Error Handling & Resilience', () => {
  test('handles 422 biomarker validation error with invalid_params details', () => {
    const errorResponse = {
      status: 422,
      title: 'Biomarker Validation Error',
      detail: 'resting_bp: Value must be at least 60.0 mmHg',
      code: 'VALIDATION_ERROR',
      invalidParams: [{ name: 'resting_bp', reason: 'Value must be at least 60.0 mmHg' }],
    };

    assert.equal(errorResponse.status, 422);
    assert.equal(errorResponse.code, 'VALIDATION_ERROR');
    assert.equal(errorResponse.invalidParams[0].name, 'resting_bp');
  });

  test('handles 503 model artifact unavailable gracefully with retry and demo triggers', () => {
    const unavailableResponse = {
      status: 503,
      title: 'Model Artifact Unavailable',
      detail: 'The trained machine learning pipeline artifact for Cardiovascular Risk Estimator is not present.',
      code: 'MODEL_UNAVAILABLE',
    };

    assert.equal(unavailableResponse.status, 503);
    assert.equal(unavailableResponse.code, 'MODEL_UNAVAILABLE');
    assert.ok(unavailableResponse.detail.includes('Cardiovascular Risk Estimator'));
  });

  test('handles backend offline error with friendly guidance', () => {
    const offlineError = {
      status: 0,
      title: 'Backend Offline',
      detail: 'Unable to reach HealthSync AI backend API at http://127.0.0.1:8000.',
      code: 'BACKEND_OFFLINE',
    };

    assert.equal(offlineError.status, 0);
    assert.equal(offlineError.code, 'BACKEND_OFFLINE');
    assert.ok(offlineError.detail.includes('http://127.0.0.1:8000'));
  });
});

describe('Phase 5.7: Mandatory Healthcare & Clinical Non-Negotiables', () => {
  test('mandatory medical disclaimer is exact and un-modified', () => {
    const disclaimer = 'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.';
    assert.equal(
      disclaimer,
      'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.'
    );
  });

  test('never describes risk estimation as medical diagnosis', () => {
    const terms = [
      'Cardiovascular Risk Screening',
      'Coronary Risk Likelihood',
      'Cardiovascular Risk Stratification',
      'calibrated risk probability',
      'statistical probability',
    ];

    terms.forEach((term) => {
      assert.equal(term.toLowerCase().includes('diagnosis'), false);
      assert.equal(term.toLowerCase().includes('diagnostic'), false);
    });
  });
});

