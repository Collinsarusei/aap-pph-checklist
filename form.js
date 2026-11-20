'use strict';
// Form definition: transcribed from "Maternity Unit: APH/PPH Risk Assessment Checklist"
// (Form No. MAT/CLIN/___). Both the data-entry page and the printed PDF are
// generated from this one definition, so edit the form here only.

const YN = ['Yes', 'No'];
const YNU = ['Yes', 'No', 'Unknown'];
const YNNA = ['Yes', 'No', 'N/A'];

const FORM = {
  title: 'MATERNITY UNIT: APH/PPH RISK ASSESSMENT CHECKLIST',
  formNo: 'MAT/CLIN/',
  departments: ['Maternity', 'MCH'],

  header: [
    { id: 'patient_name', label: 'Patient Name', type: 'text', required: true },
    { id: 'hospital_no', label: 'Hospital No.', type: 'text', required: true, placeholder: "Patient's hospital number" },
    { id: 'gravida_para', label: 'Gravida/Para', type: 'text', placeholder: 'e.g. G3P2' },
    { id: 'gestation', label: 'Gestation (weeks)', type: 'number', min: 0, max: 45 },
    { id: 'assessed_at', label: 'Date/Time of Assessment', type: 'datetime', required: true },
  ],

  sections: [
    {
      id: 'A',
      title: 'SECTION A: ANTEPARTUM HAEMORRHAGE (APH) RISK ASSESSMENT',
      note: 'APH is vaginal bleeding after 20 completed weeks of pregnancy, according to the Kenyan clinical guidelines. Any bleeding requires prompt clinical assessment.',
      groups: [
        {
          col: 'Risk factor/history',
          instruction: 'Tick Yes, No, or Unknown for each item.',
          columns: YNU,
          items: [
            ['a1', 'Previous APH in this pregnancy'],
            ['a2', 'Previous placenta praevia or placental abruption'],
            ['a3', 'Placenta praevia or low-lying placenta in current pregnancy'],
            ['a4', 'Previous caesarean section or uterine surgery'],
            ['a5', 'Suspected placenta accreta spectrum'],
            ['a6', 'Hypertension or pre-eclampsia'],
            ['a7', 'Abdominal trauma or recent injury'],
            ['a8', 'Multiple pregnancy'],
            ['a9', 'Known bleeding disorder or anticoagulant use'],
            ['a10', 'Previous unexplained vaginal bleeding'],
          ],
        },
        {
          heading: 'Current clinical assessment',
          findings: true,
          items: [
            ['ac1', 'Vaginal bleeding present', YN],
            ['ac2', 'Estimated amount of bleeding', ['Spotting', 'Moderate', 'Heavy', 'Ongoing']],
            ['ac3', 'Abdominal pain or uterine tenderness', YN],
            ['ac4', 'Uterine contractions', YN],
            ['ac5', 'Maternal vital signs assessed', YN],
            ['ac6', 'Fetal heart rate assessed, where appropriate', YN],
            ['ac7', 'Placental location known from ultrasound', YNU],
            ['ac8', 'Haemoglobin/blood group and crossmatch assessed as clinically indicated', YN],
            ['ac9', 'Obstetric clinician notified, if indicated', YNNA],
          ],
        },
      ],
      footnote: {
        title: 'Important safety precautions',
        bullets: [
          'Any APH requires prompt assessment by an appropriately qualified clinician.',
          'If APH is suspected, <b>do not perform a digital vaginal examination until placenta praevia has been excluded</b>.',
          'Heavy bleeding, shock, severe abdominal pain, or fetal compromise requires immediate emergency response and obstetric management.',
          "Follow the hospital's APH protocol for stabilization, investigations, referral, and delivery planning.",
        ],
      },
    },

    {
      id: 'B',
      title: 'SECTION B: POSTPARTUM HAEMORRHAGE (PPH) RISK ASSESSMENT',
      note: 'Assess PPH risk during antenatal admission, on admission in labour, during labour, and after birth. Reassess whenever the clinical situation changes.',
      groups: [
        {
          heading: 'B1. Antenatal and Maternal Risk Factors',
          col: 'Risk factor',
          columns: YN,
          items: [
            ['b1_1', 'Previous PPH'],
            ['b1_2', 'Anaemia or low haemoglobin'],
            ['b1_3', 'Previous caesarean section or uterine surgery'],
            ['b1_4', 'Placenta praevia or low-lying placenta'],
            ['b1_5', 'Suspected placenta accreta spectrum'],
            ['b1_6', 'Multiple pregnancy (twins or more)'],
            ['b1_7', 'Polyhydramnios'],
            ['b1_8', 'Suspected macrosomia (large baby)'],
            ['b1_9', 'Grand multiparity (parity four or more)'],
            ['b1_10', 'Uterine fibroids or other uterine abnormalities'],
            ['b1_11', 'Hypertension or pre-eclampsia'],
            ['b1_12', 'Known bleeding disorder or coagulopathy'],
            ['b1_13', 'Antepartum haemorrhage or suspected placental abruption'],
            ['b1_14', 'Previous retained placenta or manual removal of placenta'],
          ],
        },
        {
          heading: 'B2. Intrapartum Risk Factors',
          col: 'Risk factor',
          columns: YN,
          items: [
            ['b2_1', 'Prolonged labour'],
            ['b2_2', 'Induction or augmentation of labour'],
            ['b2_3', 'Precipitate labour'],
            ['b2_4', 'Caesarean birth'],
            ['b2_5', 'Instrumental delivery (vacuum or forceps)'],
            ['b2_6', 'Episiotomy or significant genital tract trauma'],
            ['b2_7', 'Shoulder dystocia'],
            ['b2_8', 'Suspected or confirmed uterine rupture'],
            ['b2_9', 'Retained placenta or delayed placental delivery'],
            ['b2_10', 'Incomplete placenta or retained placental tissue suspected'],
            ['b2_11', 'Intrapartum fever or suspected infection'],
            ['b2_12', 'Uterine overdistension (multiple pregnancy, polyhydramnios, or macrosomia)'],
            ['b2_13', 'Uterine atony after birth'],
            ['b2_14', 'Active bleeding or suspected coagulation abnormality'],
          ],
        },
      ],
      footnote: {
        text: 'These risk factors are consistent with recognised obstetric guidance. Their presence should prompt an individualized care plan, but <b>the absence of risk factors does not eliminate the possibility of PPH</b>.',
      },
    },

    {
      id: 'C',
      title: 'SECTION C: RISK CLASSIFICATION AND CARE PLAN',
      note: "For practical use, the following is a proposed local classification. It should be approved by the hospital's obstetric team and aligned with the current hospital protocol.",
      classification: [
        ['Standard risk', 'No significant risk factors identified and no current complications.', 'Routine maternity care, prevention measures, objective blood-loss assessment, and continued monitoring.'],
        ['Increased risk', 'One or more significant risk factors, such as previous PPH, anaemia, grand multiparity, multiple pregnancy, or prolonged labour.', 'Inform the responsible clinician; document an individualized plan for birth, third-stage management, monitoring, and escalation.'],
        ['High risk', 'Major risk factors such as suspected placenta accreta, placenta praevia with significant bleeding, severe anaemia, a known bleeding disorder, or multiple significant risk factors.', 'Senior obstetric review; plan delivery location and timing as appropriate; assess blood availability, anaesthesia support, theatre readiness, and escalation/referral arrangements.'],
        ['Emergency', 'Active significant bleeding, haemodynamic instability, suspected uterine rupture, or other evidence of maternal compromise.', 'Activate the emergency obstetric response immediately. Do not wait to complete this checklist.'],
      ],
      footnote: {
        text: '<b>Important:</b> This is a proposed operational classification, not a validated numerical scoring system. A woman may deteriorate even when initially classified as standard risk.',
      },
    },

    {
      id: 'D',
      title: 'SECTION D: PPH PREPAREDNESS CHECKLIST',
      note: 'Complete for women identified as having increased or high risk.',
      groups: [
        {
          col: 'Preparedness item',
          columns: YNNA,
          items: [
            ['d1', 'Responsible obstetric clinician informed'],
            ['d2', 'Risk documented in maternity notes and handover'],
            ['d3', 'Haemoglobin reviewed'],
            ['d4', 'Blood group and Rh status confirmed'],
            ['d5', 'Blood sample for grouping/crossmatching arranged when indicated'],
            ['d6', 'Intravenous access plan documented'],
            ['d7', 'Blood and blood products availability assessed according to risk'],
            ['d8', 'Uterotonics available according to hospital protocol'],
            ['d9', 'PPH emergency trolley and equipment checked'],
            ['d10', 'Quantitative blood-loss measurement equipment available'],
            ['d11', 'Theatre and anaesthesia arrangements reviewed where indicated'],
            ['d12', 'Referral or escalation plan documented where necessary'],
            ['d13', 'Post-delivery monitoring plan documented'],
          ],
        },
      ],
    },

    {
      id: 'E',
      title: 'SECTION E: POST-DELIVERY MONITORING',
      note: 'Complete after every birth, regardless of the initial risk category.',
      fields: [
        { id: 'e_time_of_birth', label: 'Time of birth', type: 'datetime' },
        { id: 'e_mode', label: 'Mode of delivery', type: 'choice', options: ['SVD', 'Assisted vaginal birth', 'Caesarean section'] },
        { id: 'e_placenta', label: 'Placenta delivered and completeness assessed', type: 'choice', options: YN },
        { id: 'e_tone', label: 'Uterine tone assessed', type: 'choice', options: ['Firm', 'Boggy', 'Other'], other: 'e_tone_other' },
        { id: 'e_blood_loss', label: 'Blood loss objectively measured and recorded', type: 'number', unit: 'mL', min: 0, max: 10000 },
        { id: 'e_pulse', label: 'Pulse', type: 'number', unit: 'bpm', min: 0, max: 300 },
        { id: 'e_bp', label: 'Blood pressure', type: 'text', unit: 'mmHg', placeholder: '120/80' },
        { id: 'e_rr', label: 'Respiratory rate', type: 'number', unit: '/min', min: 0, max: 100 },
        { id: 'e_loc', label: 'Level of consciousness/general condition', type: 'text' },
        { id: 'e_bleeding', label: 'Bleeding ongoing?', type: 'choice', options: YN },
        { id: 'e_clinician_notified', label: 'Responsible clinician notified, if indicated', type: 'choice', options: YNNA },
        { id: 'e_plan', label: 'Further action and monitoring plan', type: 'textarea' },
      ],
      footnote: {
        text: "The WHO's 2025 consolidated PPH guideline recommends initiating first-response treatment when objectively measured blood loss reaches <b>300 mL or more with an abnormal haemodynamic sign</b>, or <b>500 mL or more</b>, whichever occurs first within 24 hours after birth. Clinical deterioration or concerning bleeding requires prompt action even before these thresholds are reached. Particular vigilance is needed during the first two hours after birth. Follow the current Kenyan protocol adopted by the hospital.",
      },
    },

    {
      id: 'F',
      title: 'SECTION F: ASSESSMENT SUMMARY AND HANDOVER',
      fields: [
        { id: 'aph_risk', label: 'APH risk identified', type: 'choice', options: YN, required: true },
        { id: 'pph_category', label: 'PPH risk category', type: 'choice', options: ['Standard', 'Increased', 'High', 'Emergency'], required: true },
        { id: 'key_risks', label: 'Key risk factors identified', type: 'textarea' },
        { id: 'care_plan', label: 'Care plan/actions required', type: 'textarea' },
        { id: 'clinician_informed', label: 'Clinician informed', type: 'text' },
        { id: 'assessor_name', label: 'Name and designation of assessing staff', type: 'text', required: true },
        { id: 'reassessment_due', label: 'Reassessment due', type: 'datetime' },
      ],
    },
  ],
};

// Flat list of every answer field id with its allowed options (for validation).
function allFields() {
  const out = [];
  for (const h of FORM.header) out.push({ ...h });
  for (const s of FORM.sections) {
    for (const g of s.groups || []) {
      for (const it of g.items) {
        const [id, label, opts] = it;
        out.push({ id, label, type: 'choice', options: opts || g.columns });
      }
    }
    for (const f of s.fields || []) {
      out.push({ ...f });
      if (f.other) out.push({ id: f.other, label: f.label + ' (other)', type: 'text' });
    }
  }
  return out;
}

module.exports = { FORM, allFields };
