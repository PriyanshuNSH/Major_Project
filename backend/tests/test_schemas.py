"""
HealthSync AI — Biomarker & Schema Validation Tests
"""

import pytest
from pydantic import ValidationError
from app.schemas.diabetes import DiabetesInput
from app.schemas.heart import HeartDiseaseInput


def test_valid_diabetes_input_succeeds():
    """Verify that clinically valid inputs pass schema validation."""
    payload = {
        "glucose": 115.0,
        "blood_pressure_systolic": 125.0,
        "blood_pressure_diastolic": 80.0,
        "bmi": 27.2,
        "age": 45,
        "physical_activity_hours_week": 3.0,
        "family_history_diabetes": True,
        "insulin": 85.0,
        "skin_thickness": 22.0,
        "pregnancies": 1,
    }
    instance = DiabetesInput(**payload)
    assert instance.glucose == 115.0
    assert instance.blood_pressure_systolic == 125.0
    assert instance.blood_pressure_diastolic == 80.0


def test_diabetes_input_rejects_out_of_bounds_glucose():
    """Verify that unfeasible glucose values (< 40 or > 400 mg/dL) are rejected."""
    with pytest.raises(ValidationError) as exc_info:
        DiabetesInput(
            glucose=35.0,  # Below 40
            blood_pressure_systolic=120.0,
            blood_pressure_diastolic=80.0,
            bmi=25.0,
            age=30,
            physical_activity_hours_week=2.0,
            family_history_diabetes=False,
        )
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("glucose",) for e in errors)

    with pytest.raises(ValidationError) as exc_info2:
        DiabetesInput(
            glucose=550.0,  # Above 400
            blood_pressure_systolic=120.0,
            blood_pressure_diastolic=80.0,
            bmi=25.0,
            age=30,
            physical_activity_hours_week=2.0,
            family_history_diabetes=False,
        )
    errors2 = exc_info2.value.errors()
    assert any(e["loc"] == ("glucose",) for e in errors2)


def test_diabetes_input_enforces_hemodynamic_consistency():
    """Verify that diastolic BP >= systolic BP triggers validation error."""
    with pytest.raises(ValidationError) as exc_info:
        DiabetesInput(
            glucose=100.0,
            blood_pressure_systolic=110.0,
            blood_pressure_diastolic=120.0,  # Diastolic > Systolic
            bmi=24.0,
            age=35,
            physical_activity_hours_week=2.0,
            family_history_diabetes=False,
        )
    assert "must be strictly lower than systolic" in str(exc_info.value)


def test_diabetes_input_rejects_underage():
    """Verify pediatric ages (< 18) are rejected per adult cohort scope."""
    with pytest.raises(ValidationError) as exc_info:
        DiabetesInput(
            glucose=90.0,
            blood_pressure_systolic=115.0,
            blood_pressure_diastolic=75.0,
            bmi=22.0,
            age=16,  # Under 18
            physical_activity_hours_week=5.0,
            family_history_diabetes=False,
        )
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("age",) for e in errors)


def test_valid_heart_input_succeeds():
    """Verify that clinically valid heart disease inputs pass validation."""
    payload = {
        "age": 52,
        "sex": 1,
        "chest_pain_type": 2,
        "resting_bp": 130.0,
        "serum_cholesterol": 210.0,
        "fasting_blood_sugar": False,
        "resting_ecg": 0,
        "max_heart_rate": 150.0,
        "exercise_angina": False,
        "oldpeak": 1.0,
        "st_slope": 1,
    }
    instance = HeartDiseaseInput(**payload)
    assert instance.age == 52
    assert instance.serum_cholesterol == 210.0


def test_heart_input_rejects_invalid_discrete_options():
    """Verify categorical ranges are strictly enforced."""
    with pytest.raises(ValidationError) as exc_info:
        HeartDiseaseInput(
            age=52,
            sex=1,
            chest_pain_type=5,  # Valid is 0..3
            resting_bp=130.0,
            serum_cholesterol=210.0,
            fasting_blood_sugar=False,
            resting_ecg=0,
            max_heart_rate=150.0,
            exercise_angina=False,
            oldpeak=1.0,
            st_slope=1,
        )
    errors = exc_info.value.errors()
    assert any(e["loc"] == ("chest_pain_type",) for e in errors)


def test_heart_input_rejects_invalid_sex():
    """Verify biological sex is strictly bounded to 0 (female) or 1 (male)."""
    with pytest.raises(ValidationError) as exc_info:
        HeartDiseaseInput(
            age=50,
            sex=2,  # Invalid
            chest_pain_type=1,
            resting_bp=120.0,
            serum_cholesterol=200.0,
            fasting_blood_sugar=False,
            resting_ecg=0,
            max_heart_rate=140.0,
            exercise_angina=False,
            oldpeak=0.0,
            st_slope=1,
        )
    assert any(e["loc"] == ("sex",) for e in exc_info.value.errors())


def test_heart_input_rejects_out_of_bounds_vitals():
    """Verify resting BP and cholesterol physiological boundaries."""
    # resting_bp exceeds max 260
    with pytest.raises(ValidationError) as exc_info:
        HeartDiseaseInput(
            age=50,
            sex=1,
            chest_pain_type=1,
            resting_bp=280.0,
            serum_cholesterol=200.0,
            fasting_blood_sugar=False,
            resting_ecg=0,
            max_heart_rate=140.0,
            exercise_angina=False,
            oldpeak=0.0,
            st_slope=1,
        )
    assert any(e["loc"] == ("resting_bp",) for e in exc_info.value.errors())

    # serum_cholesterol below min 100
    with pytest.raises(ValidationError) as exc_info2:
        HeartDiseaseInput(
            age=50,
            sex=1,
            chest_pain_type=1,
            resting_bp=120.0,
            serum_cholesterol=80.0,
            fasting_blood_sugar=False,
            resting_ecg=0,
            max_heart_rate=140.0,
            exercise_angina=False,
            oldpeak=0.0,
            st_slope=1,
        )
    assert any(e["loc"] == ("serum_cholesterol",) for e in exc_info2.value.errors())


def test_heart_input_rejects_underage():
    """Verify adult cohort restriction (age >= 18)."""
    with pytest.raises(ValidationError) as exc_info:
        HeartDiseaseInput(
            age=16,
            sex=1,
            chest_pain_type=1,
            resting_bp=120.0,
            serum_cholesterol=180.0,
            fasting_blood_sugar=False,
            resting_ecg=0,
            max_heart_rate=140.0,
            exercise_angina=False,
            oldpeak=0.0,
            st_slope=1,
        )
    assert any(e["loc"] == ("age",) for e in exc_info.value.errors())

