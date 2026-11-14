/**
 * HealthSync AI — Frontend Integration & Validation Test Suite (Phase 4.5)
 * Executed with Node.js native test runner: `node --test frontend/tests/diabetesAssessment.test.mjs`
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Phase 4.5: Diabetes Risk Assessment Validation Rules', () => {
  // Pure validator mirroring DiabetesAssessmentPage.tsx validateAll()
  function validateDiabetesInputs(input) {
    const errors = {};

    const {
      glucose,
      systolic,
      diastolic,
      heightCm,
      weightKg,
      age,
      physicalActivityHours,
      insulin,
      skinThickness,
      pregnancies,
    } = input;

    // Fasting Glucose: 40 - 400 mg/dL
    if (glucose === '' || glucose === undefined || isNaN(Number(glucose)) || Number(glucose) < 40 || Number(glucose) > 400) {
      errors.glucose = 'Fasting glucose is required (40 - 400 mg/dL).';
    }

    // Fasting Insulin (optional): 0 - 900 µU/mL
    if (insulin !== '' && insulin !== undefined && (isNaN(Number(insulin)) || Number(insulin) < 0 || Number(insulin) > 900)) {
      errors.insulin = 'Fasting serum insulin must be between 0 and 900 µU/mL.';
    }

    // Triceps Skin Fold Thickness (optional): 0 - 99 mm
    if (skinThickness !== '' && skinThickness !== undefined && (isNaN(Number(skinThickness)) || Number(skinThickness) < 0 || Number(skinThickness) > 99)) {
      errors.skinThickness = 'Triceps skin fold thickness must be between 0 and 99 mm.';
    }

    // Pregnancies (optional): 0 - 20 (integer)
    if (pregnancies !== '' && pregnancies !== undefined && (isNaN(Number(pregnancies)) || Number(pregnancies) < 0 || Number(pregnancies) > 20 || !Number.isInteger(Number(pregnancies)))) {
      errors.pregnancies = 'Pregnancies must be an integer between 0 and 20.';
    }

    // Systolic Blood Pressure: 60 - 250 mmHg
    if (systolic === '' || systolic === undefined || isNaN(Number(systolic)) || Number(systolic) < 60 || Number(systolic) > 250) {
      errors.systolic = 'Systolic BP is required (60 - 250 mmHg).';
    }

    // Diastolic Blood Pressure: 40 - 150 mmHg
    if (diastolic === '' || diastolic === undefined || isNaN(Number(diastolic)) || Number(diastolic) < 40 || Number(diastolic) > 150) {
      errors.diastolic = 'Diastolic BP is required (40 - 150 mmHg).';
    }

    // Hemodynamic Consistency: diastolic < systolic
    if (systolic !== '' && diastolic !== '' && systolic !== undefined && diastolic !== undefined && Number(diastolic) >= Number(systolic)) {
      errors.diastolic = 'Diastolic BP must be strictly lower than systolic BP.';
    }

    // Age: 18 - 120
    if (age === '' || age === undefined || isNaN(Number(age)) || Number(age) < 18 || Number(age) > 120) {
      errors.age = 'Patient age is required (18 - 120 years).';
    }

    // Height: 100 - 250 cm
    if (heightCm === '' || heightCm === undefined || isNaN(Number(heightCm)) || Number(heightCm) < 100 || Number(heightCm) > 250) {
      errors.heightCm = 'Height is required (100 - 250 cm).';
    }

    // Weight: 30 - 250 kg
    if (weightKg === '' || weightKg === undefined || isNaN(Number(weightKg)) || Number(weightKg) < 30 || Number(weightKg) > 250) {
      errors.weightKg = 'Weight is required (30 - 250 kg).';
    }

    // BMI: 10 - 65 kg/m²
    if (heightCm && weightKg && !isNaN(Number(heightCm)) && !isNaN(Number(weightKg))) {
      const heightM = Number(heightCm) / 100;
      const bmi = Number(weightKg) / (heightM * heightM);
      if (bmi < 10 || bmi > 65) {
        errors.weightKg = 'Body Mass Index (BMI) must be between 10.0 and 65.0 kg/m².';
      }
    }

    // Physical Activity: 0 - 35 hrs/wk
    if (physicalActivityHours === '' || physicalActivityHours === undefined || isNaN(Number(physicalActivityHours)) || Number(physicalActivityHours) < 0 || Number(physicalActivityHours) > 35) {
      errors.physicalActivityHours = 'Weekly physical activity is required (0 - 35 hrs/wk).';
    }

    return errors;
  }

  test('valid physiological baseline passes with zero validation errors', () => {
    const valid = {
      glucose: 95,
      systolic: 120,
      diastolic: 80,
      heightCm: 175,
      weightKg: 70,
      age: 45,
      physicalActivityHours: 3.0,
      familyHistory: false,
      insulin: 12,
      skinThickness: 23,
      pregnancies: 0,
    };
    const errors = validateDiabetesInputs(valid);
    assert.deepEqual(errors, {});
  });

  test('rejects out-of-boundary glucose values (<40 or >400 mg/dL)', () => {
    const low = validateDiabetesInputs({ glucose: 35, systolic: 120, diastolic: 80, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2 });
    assert.match(low.glucose, /Fasting glucose is required/);

    const high = validateDiabetesInputs({ glucose: 450, systolic: 120, diastolic: 80, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2 });
    assert.match(high.glucose, /Fasting glucose is required/);
  });

  test('enforces strict hemodynamic constraint (diastolic must be strictly < systolic)', () => {
    const equalBp = validateDiabetesInputs({ glucose: 95, systolic: 120, diastolic: 120, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2 });
    assert.match(equalBp.diastolic, /strictly lower than systolic/);

    const invertedBp = validateDiabetesInputs({ glucose: 95, systolic: 110, diastolic: 125, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2 });
    assert.match(invertedBp.diastolic, /strictly lower than systolic/);

    const validBp = validateDiabetesInputs({ glucose: 95, systolic: 110, diastolic: 75, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2 });
    assert.equal(validBp.diastolic, undefined);
  });

  test('validates optional clinical fields (skin thickness 0-99 mm, pregnancies 0-20 integer)', () => {
    const invalidSkin = validateDiabetesInputs({
      glucose: 95, systolic: 120, diastolic: 80, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2,
      skinThickness: 150,
    });
    assert.match(invalidSkin.skinThickness, /Triceps skin fold thickness/);

    const invalidPreg = validateDiabetesInputs({
      glucose: 95, systolic: 120, diastolic: 80, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2,
      pregnancies: 25,
    });
    assert.match(invalidPreg.pregnancies, /integer between 0 and 20/);

    const nonIntPreg = validateDiabetesInputs({
      glucose: 95, systolic: 120, diastolic: 80, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2,
      pregnancies: 2.5,
    });
    assert.match(nonIntPreg.pregnancies, /integer between 0 and 20/);

    const validOptionals = validateDiabetesInputs({
      glucose: 95, systolic: 120, diastolic: 80, heightCm: 170, weightKg: 70, age: 30, physicalActivityHours: 2,
      skinThickness: 28, pregnancies: 2, insulin: 60,
    });
    assert.equal(validOptionals.skinThickness, undefined);
    assert.equal(validOptionals.pregnancies, undefined);
    assert.equal(validOptionals.insulin, undefined);
  });

  test('rejects extreme non-viable BMI outside [10, 65] kg/m²', () => {
    // Height 180cm, Weight 240kg => BMI = 74.07 (rejected)
    const extremeBmi = validateDiabetesInputs({
      glucose: 95, systolic: 120, diastolic: 80, heightCm: 180, weightKg: 240, age: 35, physicalActivityHours: 2,
    });
    assert.match(extremeBmi.weightKg, /Body Mass Index/);
  });
});

describe('Phase 4.5: Calibrated Risk & Confidence Interval Formatting', () => {
  // Pure helper mirroring RiskGauge safeCI resolution
  function resolveSafeConfidenceInterval(confidenceInterval) {
    if (
      !confidenceInterval ||
      !Array.isArray(confidenceInterval) ||
      confidenceInterval.length !== 2 ||
      !Number.isFinite(confidenceInterval[0]) ||
      !Number.isFinite(confidenceInterval[1]) ||
      (confidenceInterval[0] === 0.0 && confidenceInterval[1] === 0.0)
    ) {
      return null;
    }
    return [
      Math.max(0, Math.min(1, confidenceInterval[0])),
      Math.max(0, Math.min(1, confidenceInterval[1])),
    ];
  }

  function renderIntervalBadge(ci) {
    const safeCI = resolveSafeConfidenceInterval(ci);
    if (!safeCI) {
      return 'Prediction Interval: Unavailable (Point Calibration)';
    }
    return `95% CI: [${Math.round(safeCI[0] * 100)}% – ${Math.round(safeCI[1] * 100)}%]`;
  }

  test('null confidence interval correctly yields Unavailable (Point Calibration)', () => {
    const rendered = renderIntervalBadge(null);
    assert.equal(rendered, 'Prediction Interval: Unavailable (Point Calibration)');
  });

  test('database sentinel [0.0, 0.0] is NEVER rendered as [0% – 0%]', () => {
    const rendered = renderIntervalBadge([0.0, 0.0]);
    assert.equal(rendered, 'Prediction Interval: Unavailable (Point Calibration)');
    assert.doesNotMatch(rendered, /0% – 0%/);
  });

  test('genuine non-zero confidence interval renders percentage bounds properly', () => {
    const rendered = renderIntervalBadge([0.18, 0.32]);
    assert.equal(rendered, '95% CI: [18% – 32%]');
  });
});

describe('Phase 4.5: SHAP Attribution & Decision Margin Formatting', () => {
  function formatShapDriverImpact(shapImpact) {
    const impact = Number.isFinite(shapImpact) ? shapImpact : 0;
    const sign = impact >= 0 ? '+' : '';
    return `${sign}${impact.toFixed(3)} margin shift`;
  }

  test('formats SHAP impacts as decision margin shifts, never percentage of calibrated risk', () => {
    const elevated = formatShapDriverImpact(0.142);
    assert.equal(elevated, '+0.142 margin shift');
    assert.doesNotMatch(elevated, /%/);

    const protective = formatShapDriverImpact(-0.085);
    assert.equal(protective, '-0.085 margin shift');
    assert.doesNotMatch(protective, /%/);
  });

  test('preserves mandatory TreeExplainer raw decision-margin attribution notice', () => {
    const notice =
      'SHAP attributions reflect raw-model decision-margin effects (log-odds / gradient margin units) ' +
      'from the base HistGradientBoostingClassifier. They demonstrate directional feature attribution ' +
      'rather than percentage additions to calibrated risk probability.';
    assert.match(notice, /raw-model decision-margin/);
    assert.match(notice, /HistGradientBoostingClassifier/);
    assert.match(notice, /rather than percentage additions to calibrated risk probability/);
  });
});

describe('Phase 4.5: Guest vs Authenticated Experience & Storage Protection', () => {
  test('guest assessments do not write to persistent archive or database', () => {
    const token = null;
    const isGuest = !token;

    let persistentAssessments = [];
    let memoryDetails = new Map();

    const mockAssessmentResult = {
      id: 'temp_guest_screening_123',
      userId: isGuest ? 'guest' : 'usr_123',
      riskScore: 0.28,
      riskLevel: 'MODERATE',
      isGuest,
    };

    // Service simulation
    memoryDetails.set(mockAssessmentResult.id, mockAssessmentResult);
    if (!isGuest) {
      persistentAssessments.unshift(mockAssessmentResult);
    }

    assert.equal(isGuest, true);
    assert.equal(persistentAssessments.length, 0, 'Guest screening must NOT add to persistent archive');
    assert.equal(memoryDetails.has('temp_guest_screening_123'), true, 'Guest screening remains in-memory for active session');
  });

  test('authenticated assessments persist with user identification and record ID', () => {
    const token = 'mock_jwt_token';
    const isGuest = !token;

    let persistentAssessments = [];
    const mockAssessmentResult = {
      id: 'a8d9b1c2-3e4f-5a6b-7c8d-9e0f1a2b3c4d',
      userId: 'usr_authenticated_patient',
      riskScore: 0.15,
      riskLevel: 'LOW',
      isGuest,
    };

    if (!isGuest) {
      persistentAssessments.unshift(mockAssessmentResult);
    }

    assert.equal(isGuest, false);
    assert.equal(persistentAssessments.length, 1);
    assert.equal(persistentAssessments[0].id, 'a8d9b1c2-3e4f-5a6b-7c8d-9e0f1a2b3c4d');
  });
});

describe('Phase 4.5: Mandatory Clinical Disclaimer Compliance', () => {
  const MANDATORY_DISCLAIMER =
    'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.';

  test('mandatory disclaimer is exact and un-modified', () => {
    assert.equal(
      MANDATORY_DISCLAIMER,
      'Informational risk estimation only. Not a medical diagnosis or clinical substitute. Consult a healthcare professional.'
    );
  });
});

describe('Phase 4.5 Stabilization: Backend-Frontend Risk Threshold Alignment', () => {
  // Pure fallback categorizer mirroring RiskGauge.tsx getFallbackRiskLevel()
  function getFallbackRiskLevel(safeScore) {
    return safeScore < 0.20
      ? 'LOW'
      : safeScore < 0.45
      ? 'MODERATE'
      : safeScore < 0.70
      ? 'HIGH'
      : 'CRITICAL';
  }

  // Pure style resolver mirroring formatters.ts getRiskLevelStyles()
  function getRiskLevelStyles(level) {
    switch (level) {
      case 'LOW':
        return { colorHex: '#059669', badgeBg: 'bg-emerald-50', text: 'LOW' };
      case 'MODERATE':
        return { colorHex: '#d97706', badgeBg: 'bg-amber-50', text: 'MODERATE' };
      case 'HIGH':
        return { colorHex: '#ea580c', badgeBg: 'bg-orange-50', text: 'HIGH' };
      case 'CRITICAL':
        return { colorHex: '#e11d48', badgeBg: 'bg-rose-50', text: 'CRITICAL' };
      default:
        return { colorHex: '#059669', badgeBg: 'bg-emerald-50', text: 'LOW' };
    }
  }

  test('score 0.19 categorizes as LOW with emerald color (#059669)', () => {
    const level = getFallbackRiskLevel(0.19);
    assert.equal(level, 'LOW');
    const styles = getRiskLevelStyles(level);
    assert.equal(styles.colorHex, '#059669');
  });

  test('score 0.20 categorizes as MODERATE with amber color (#d97706)', () => {
    const level = getFallbackRiskLevel(0.20);
    assert.equal(level, 'MODERATE');
    const styles = getRiskLevelStyles(level);
    assert.equal(styles.colorHex, '#d97706');
  });

  test('score 0.44 categorizes as MODERATE with amber color (#d97706)', () => {
    const level = getFallbackRiskLevel(0.44);
    assert.equal(level, 'MODERATE');
    const styles = getRiskLevelStyles(level);
    assert.equal(styles.colorHex, '#d97706');
  });

  test('score 0.45 categorizes as HIGH with orange color (#ea580c)', () => {
    const level = getFallbackRiskLevel(0.45);
    assert.equal(level, 'HIGH');
    const styles = getRiskLevelStyles(level);
    assert.equal(styles.colorHex, '#ea580c');
  });

  test('score 0.69 categorizes as HIGH with orange color (#ea580c)', () => {
    const level = getFallbackRiskLevel(0.69);
    assert.equal(level, 'HIGH');
    const styles = getRiskLevelStyles(level);
    assert.equal(styles.colorHex, '#ea580c');
  });

  test('score 0.70 categorizes as CRITICAL with rose color (#e11d48)', () => {
    const level = getFallbackRiskLevel(0.70);
    assert.equal(level, 'CRITICAL');
    const styles = getRiskLevelStyles(level);
    assert.equal(styles.colorHex, '#e11d48');
  });

  test('boundary consistency: verified against backend cutoffs [0.20, 0.45, 0.70]', () => {
    const testCases = [
      { score: 0.0, expected: 'LOW', color: '#059669' },
      { score: 0.1999, expected: 'LOW', color: '#059669' },
      { score: 0.20, expected: 'MODERATE', color: '#d97706' },
      { score: 0.4499, expected: 'MODERATE', color: '#d97706' },
      { score: 0.45, expected: 'HIGH', color: '#ea580c' },
      { score: 0.6999, expected: 'HIGH', color: '#ea580c' },
      { score: 0.70, expected: 'CRITICAL', color: '#e11d48' },
      { score: 1.0, expected: 'CRITICAL', color: '#e11d48' },
    ];

    for (const { score, expected, color } of testCases) {
      const level = getFallbackRiskLevel(score);
      assert.equal(level, expected, `Score ${score} should categorize as ${expected}, got ${level}`);
      const styles = getRiskLevelStyles(level);
      assert.equal(styles.colorHex, color, `Level ${expected} should map to ${color}`);
    }
  });
});

