/**
 * rehab.js — diagnosis → evidence-based exercise protocols.
 *
 * Maps an ICD-10 diagnosis to a recommended starter set of therapeutic
 * exercises so the doctor sees condition-appropriate options the moment a
 * diagnosis is chosen, instead of picking from a flat list.
 *
 * Coverage reflects the clinic's main caseload — neurological, post-operative
 * and musculoskeletal — and follows the latest APTA (American Physical Therapy
 * Association) clinical practice guidelines from its Academy of Neurologic
 * Physical Therapy and Academy of Orthopaedic Physical Therapy. Each item
 * carries a sensible starting dosage; the treating clinician adjusts to the
 * individual patient.
 *
 * Matching is first-match: neuro and post-operative conditions are listed
 * before regional MSK sets so they take precedence. `match(dx)` receives
 * { code, label }.
 */

const re = (s) => new RegExp(s, 'i')

export const REHAB_PROTOCOLS = [
  // ============================================================
  // NEUROLOGICAL REHAB (APTA Academy of Neurologic Physical Therapy)
  // Listed first so neuro diagnoses match ahead of regional MSK sets.
  // ============================================================
  {
    id: 'stroke',
    label: 'Stroke / hemiplegia',
    src: 'APTA Neurologic PT CPG · locomotor & stroke rehab (2020)',
    match: (d) => /^G81/.test(d.code) || /^I6[39]/.test(d.code) || re('hemiplegia|hemiparesis|stroke|cva').test(d.label),
    items: [
      { name: 'Sit-to-stand (task-specific)', dose: '8–10 reps × 3' },
      { name: 'Weight-bearing through affected limb', dose: '5–10 min' },
      { name: 'Moderate-to-high intensity gait training', dose: '20–30 min' },
      { name: 'Standing reach / dynamic balance', dose: '10 reps × 3' },
      { name: 'Affected upper-limb task practice (reach-grasp)', dose: '15–20 min' },
      { name: 'Step-ups / stair practice', dose: '10/side × 2' },
      { name: 'Bridging (pelvic control)', dose: '10–15 × 3' },
    ],
  },
  {
    id: 'parkinson',
    label: "Parkinson's disease / parkinsonism",
    src: 'APTA Parkinson Disease CPG (2022)',
    match: (d) => /^G2[01]/.test(d.code) || re('parkinson').test(d.label),
    items: [
      { name: 'Moderate–high intensity aerobic (treadmill/cycle)', dose: '30 min, 3×/wk' },
      { name: 'Large-amplitude movement training (LSVT BIG)', dose: '15–20 min' },
      { name: 'Resistance training (major muscle groups)', dose: '8–12 × 2–3' },
      { name: 'Balance & agility training', dose: '15–20 min' },
      { name: 'Gait training with external cueing', dose: '15–20 min' },
      { name: 'Trunk rotation & posture mobility', dose: '10 reps × 2' },
    ],
  },
  {
    id: 'ms',
    label: 'Multiple sclerosis',
    src: 'APTA Neurologic PT guidelines · MS',
    match: (d) => /^G35/.test(d.code) || re('multiple sclerosis').test(d.label),
    items: [
      { name: 'Aerobic conditioning (fatigue-managed)', dose: '20–30 min, RPE-guided' },
      { name: 'Resistance training (progressive)', dose: '8–12 × 2' },
      { name: 'Balance training', dose: '15 min' },
      { name: 'Stretching for spasticity', dose: '30–60s × 3' },
      { name: 'Gait / endurance practice', dose: '15–20 min' },
    ],
  },
  {
    id: 'sci',
    label: 'Spinal cord injury / paraplegia',
    src: 'APTA Locomotor Function CPG (2020)',
    match: (d) => /^G82/.test(d.code) || /^G83\.4/.test(d.code) || re('paraplegia|tetraplegia|quadriplegia|cord injury|cauda equina').test(d.label),
    items: [
      { name: 'Supported standing / weight-bearing program', dose: '15–30 min' },
      { name: 'Locomotor / body-weight-supported gait training', dose: '20–30 min' },
      { name: 'Trunk & seated balance control', dose: '10–15 min' },
      { name: 'Resistance training of preserved muscles', dose: '8–12 × 3' },
      { name: 'Transfer training', dose: 'task practice' },
      { name: 'ROM & spasticity management', dose: '30–60s × 3' },
    ],
  },
  {
    id: 'cp',
    label: 'Cerebral palsy',
    src: 'APTA Neurologic PT guidelines · cerebral palsy',
    match: (d) => /^G80/.test(d.code) || re('cerebral palsy').test(d.label),
    items: [
      { name: 'Functional strengthening (sit-to-stand, squats)', dose: '8–12 × 3' },
      { name: 'Stretching for spasticity (hamstrings, calf, hip)', dose: '30–60s × 3' },
      { name: 'Gait training', dose: '15–20 min' },
      { name: 'Balance & postural control', dose: '15 min' },
      { name: 'Task-specific motor practice', dose: '15–20 min' },
    ],
  },
  {
    id: 'bells',
    label: "Bell's palsy / facial paralysis",
    src: 'APTA guidelines · facial neuromuscular re-education',
    match: (d) => /^G51\.0/.test(d.code) || re("bell'?s palsy|facial palsy|facial paralysis").test(d.label),
    items: [
      { name: 'Mirror facial neuromuscular re-education', dose: '10 reps × 2/day' },
      { name: 'Eyebrow raise / frown', dose: '10 reps × 2' },
      { name: 'Eye-closure practice', dose: '10 reps × 2' },
      { name: 'Smile / lip pucker / cheek puff', dose: '10 reps × 2' },
      { name: 'Gentle facial massage', dose: '5 min' },
    ],
  },
  // ============================================================
  // POST-OPERATIVE & FRACTURE REHAB (APTA post-op rehab guidance)
  // Listed before regional MSK so post-op codes match first.
  // ============================================================
  {
    id: 'joint_replacement',
    label: 'Post joint replacement (TKA/THA)',
    src: 'APTA post-operative rehab guidelines',
    match: (d) => /^Z47\.1/.test(d.code) || re('aftercare following joint replacement').test(d.label),
    items: [
      { name: 'Ankle pumps (circulation / DVT prevention)', dose: '20 reps hourly' },
      { name: 'Quad sets', dose: '10 × 5s × 3' },
      { name: 'Glute sets', dose: '10 × 5s × 3' },
      { name: 'Heel slides / knee AROM (within protocol)', dose: '10–15 × 3' },
      { name: 'Straight-leg raise', dose: '10–15 × 3' },
      { name: 'Gait training with assistive device', dose: 'as prescribed' },
      { name: 'Standing hip abduction / extension', dose: '10–15 × 3' },
    ],
  },
  {
    id: 'ortho_aftercare',
    label: 'Orthopaedic post-operative aftercare',
    src: 'APTA post-operative rehab guidelines',
    match: (d) => /^Z47\.89/.test(d.code) || re('orthopedic aftercare|orthopaedic aftercare').test(d.label),
    items: [
      { name: 'Pain-free AROM within surgeon protocol', dose: '10–15 × 3' },
      { name: 'Isometrics around the operated joint', dose: '10 × 5s × 3' },
      { name: 'Edema & scar mobilization', dose: '5 min' },
      { name: 'Gait / ADL retraining', dose: 'task practice' },
      { name: 'Progressive loading per surgeon timeline', dose: 'graded' },
    ],
  },
  {
    id: 'acl',
    label: 'ACL reconstruction / knee ligament repair',
    src: 'APTA / ACL reconstruction rehab guidelines',
    match: (d) => /^S83\.5/.test(d.code) || re('cruciate ligament').test(d.label),
    items: [
      { name: 'Quad activation / quad sets', dose: '10 × 5s × 3' },
      { name: 'Heel slides (ROM restoration)', dose: '10–15 × 3' },
      { name: 'Straight-leg raise', dose: '10–15 × 3' },
      { name: 'Mini squats (pain-free range)', dose: '10–15 × 3' },
      { name: 'Single-leg balance / proprioception', dose: '30s × 3' },
      { name: 'Step-ups & progressive return-to-sport drills', dose: 'criteria-based' },
    ],
  },
  {
    id: 'll_fracture',
    label: 'Lower-limb fracture rehab',
    src: 'APTA post-operative & fracture rehab guidelines',
    match: (d) => /^S72/.test(d.code) || /^S82/.test(d.code) || re('fracture.*(femur|tibia|patella|fibula|hip)').test(d.label),
    items: [
      { name: 'Ankle pumps (circulation)', dose: '20 reps hourly' },
      { name: 'Quad & glute sets', dose: '10 × 5s × 3' },
      { name: 'Knee/hip AROM (within protocol)', dose: '10–15 × 3' },
      { name: 'Weight-bearing as prescribed', dose: 'per surgeon' },
      { name: 'Gait training with assistive device', dose: 'as prescribed' },
      { name: 'Progressive strengthening & balance', dose: 'graded' },
    ],
  },
  {
    id: 'ul_fracture',
    label: 'Upper-limb fracture rehab',
    src: 'APTA post-operative & fracture rehab guidelines',
    match: (d) => /^S42/.test(d.code) || /^S52/.test(d.code) || /^S62/.test(d.code) || re('fracture.*(humerus|radius|ulna|scaphoid|wrist|hand)').test(d.label),
    items: [
      { name: 'Pendulum / AROM as allowed', dose: '10 reps × 3' },
      { name: 'Active hand & finger ROM', dose: '10–15 × 3' },
      { name: 'Grip / putty squeeze', dose: '10–15 × 3' },
      { name: 'Scapular setting', dose: '10 × 5s × 3' },
      { name: 'Progressive ROM & gentle strengthening per protocol', dose: 'graded' },
      { name: 'Edema & scar management', dose: '5 min' },
    ],
  },
  // ============================================================
  // MUSCULOSKELETAL / ORTHOPAEDIC (APTA Academy of Orthopaedic PT CPGs)
  // ============================================================
  // ---- LUMBAR: radiculopathy / sciatica (more specific than generic LBP) ----
  {
    id: 'lumbar_radic',
    label: 'Lumbar radiculopathy / sciatica',
    src: 'APTA Low Back Pain CPG (2021) · neurodynamics',
    match: (d) => /^M54\.(16|3|4)/.test(d.code) || /^M51\.[23]6/.test(d.code) || re('sciatic|radiculopathy, lumbar|lumbago with sciatica').test(d.label),
    items: [
      { name: 'Sciatic nerve glide (slider)', dose: '10 reps × 3/day' },
      { name: 'Repeated lumbar extension (press-up)', dose: '10 reps × 4–5/day' },
      { name: 'Nerve flossing — seated slump', dose: '10 reps × 2' },
      { name: 'Abdominal bracing (TA activation)', dose: '10 × 10s holds' },
      { name: 'Bird-dog (quadruped alternating)', dose: '8–10/side × 2' },
      { name: 'Hamstring stretch (nerve-tension graded)', dose: '30s × 3' },
    ],
  },
  // ---- LUMBAR: mechanical / non-specific low back pain ----
  {
    id: 'lbp',
    label: 'Low back pain (mechanical)',
    src: 'APTA Low Back Pain CPG (2021)',
    match: (d) => /^M54\.(5|6|59|51)/.test(d.code) || /^M47\.816/.test(d.code) || /^M48\.06/.test(d.code) || /^M62\.830/.test(d.code) || re('low back|lumbago|lumbar|dorsalgia|muscle spasm of back').test(d.label),
    items: [
      { name: 'Prone press-up (extension in lying)', dose: '10 reps × 4–5/day' },
      { name: 'Cat–camel mobilization', dose: '10 reps × 2' },
      { name: 'Pelvic tilt', dose: '10 reps × 2' },
      { name: 'Abdominal bracing (TA activation)', dose: '10 × 10s holds' },
      { name: 'Bird-dog (quadruped alternating)', dose: '8–10/side × 2' },
      { name: 'Glute bridge', dose: '10–15 × 3' },
      { name: 'Side plank (progress hold)', dose: '15–30s × 3/side' },
      { name: 'Walking program (aerobic)', dose: '20–30 min daily' },
    ],
  },
  // ---- CERVICAL: radiculopathy ----
  {
    id: 'cervical_radic',
    label: 'Cervical radiculopathy',
    src: 'APTA Neck Pain CPG (2017) · upper-limb neurodynamics',
    match: (d) => /^M54\.12/.test(d.code) || /^M50\.2/.test(d.code) || /^M53\.1/.test(d.code) || re('radiculopathy, cervical|cervicobrachial|cervical disc').test(d.label),
    items: [
      { name: 'Median nerve glide (upper-limb)', dose: '10 reps × 3/day' },
      { name: 'Cervical retraction (chin tuck)', dose: '10 × 5s holds × 3' },
      { name: 'Deep neck flexor activation', dose: '10 × 10s holds' },
      { name: 'Scapular retraction (band rows)', dose: '12–15 × 3' },
      { name: 'Thoracic extension over chair/roll', dose: '10 reps × 2' },
    ],
  },
  // ---- CERVICAL: neck pain / cervicalgia ----
  {
    id: 'neck',
    label: 'Neck pain / cervicalgia',
    src: 'APTA Neck Pain CPG (2017)',
    match: (d) => /^M54\.2/.test(d.code) || /^M47\.812/.test(d.code) || /^M43\.6/.test(d.code) || /^M54\.81/.test(d.code) || re('cervicalgia|torticollis|occipital neuralgia|neck').test(d.label),
    items: [
      { name: 'Cervical retraction (chin tuck)', dose: '10 × 5s holds × 3' },
      { name: 'Deep neck flexor (craniocervical flexion)', dose: '10 × 10s holds' },
      { name: 'Cervical AROM — rotation & side-bend', dose: '10/direction × 2' },
      { name: 'Upper trapezius stretch', dose: '30s × 3/side' },
      { name: 'Levator scapulae stretch', dose: '30s × 3/side' },
      { name: 'Scapular retraction (band rows)', dose: '12–15 × 3' },
      { name: 'Thoracic extension mobility', dose: '10 reps × 2' },
    ],
  },
  // ---- SHOULDER: adhesive capsulitis (frozen shoulder) ----
  {
    id: 'frozen_shoulder',
    label: 'Adhesive capsulitis (frozen shoulder)',
    src: 'APTA Adhesive Capsulitis CPG · capsular stretching',
    match: (d) => /^M75\.0/.test(d.code) || re('adhesive capsulitis|frozen shoulder').test(d.label),
    items: [
      { name: 'Pendulum (Codman) swings', dose: '2–3 min × 3/day' },
      { name: 'Passive forward flexion (wand/cane)', dose: '10 × 10s × 3' },
      { name: 'Passive external rotation (wand at side)', dose: '10 × 10s × 3' },
      { name: 'Cross-body adduction stretch', dose: '30s × 3' },
      { name: 'Posterior capsule (sleeper) stretch', dose: '30s × 3' },
      { name: 'Wall/finger ladder climb', dose: '10 reps × 3' },
    ],
  },
  // ---- SHOULDER: rotator cuff / subacromial pain / impingement / shoulder pain ----
  {
    id: 'shoulder_rc',
    label: 'Rotator cuff / subacromial shoulder pain',
    src: 'APTA orthopaedic CPG · rotator-cuff & scapular loading',
    match: (d) => /^M75\./.test(d.code) || /^M25\.51/.test(d.code) || re('rotator cuff|impingement|subacromial|supraspinatus|shoulder').test(d.label),
    items: [
      { name: 'Scapular setting / retraction', dose: '10 × 5s holds × 3' },
      { name: 'External rotation with band (arm at side)', dose: '12–15 × 3' },
      { name: 'Internal rotation with band', dose: '12–15 × 3' },
      { name: 'Scaption below 90° (light dumbbell)', dose: '10–12 × 3' },
      { name: 'Wall slides / serratus punch', dose: '10–12 × 3' },
      { name: 'Prone row & "Y/T"', dose: '10–12 × 3' },
      { name: 'Pendulum (Codman) for pain relief', dose: '2 min × 2' },
    ],
  },
  // ---- KNEE: patellofemoral pain ----
  {
    id: 'pfp',
    label: 'Patellofemoral pain',
    src: 'APTA Patellofemoral Pain CPG (2019) · hip + knee',
    match: (d) => /^M22\.2/.test(d.code) || re('patellofemoral|patellar').test(d.label),
    items: [
      { name: 'Side-lying hip abduction', dose: '12–15 × 3' },
      { name: 'Clamshell (band)', dose: '15 × 3/side' },
      { name: 'Lateral band walks', dose: '10 steps × 3/way' },
      { name: 'Quad sets / terminal knee extension', dose: '10 × 5s × 3' },
      { name: 'Mini squats (pain-free range)', dose: '10–15 × 3' },
      { name: 'Step-ups (low step)', dose: '10/side × 3' },
      { name: 'Quad & ITB flexibility', dose: '30s × 3' },
    ],
  },
  // ---- KNEE: OA, meniscus, generic knee pain ----
  {
    id: 'knee_oa',
    label: 'Knee OA / general knee',
    src: 'APTA Knee Pain & Mobility CPG (2018)',
    match: (d) => /^M17\./.test(d.code) || /^M23\.3/.test(d.code) || /^M25\.56/.test(d.code) || /^M24\.56/.test(d.code) || /^M70\.[45]/.test(d.code) || re('osteoarthritis.*knee|meniscus|knee').test(d.label),
    items: [
      { name: 'Quad sets (isometric)', dose: '10 × 5s × 3' },
      { name: 'Straight-leg raise', dose: '10–15 × 3' },
      { name: 'Short-arc quad extension', dose: '10–15 × 3' },
      { name: 'Sit-to-stand', dose: '10 × 3' },
      { name: 'Mini squats (pain-free range)', dose: '10–15 × 3' },
      { name: 'Step-ups (low step)', dose: '10/side × 3' },
      { name: 'Hamstring & calf stretch', dose: '30s × 3' },
      { name: 'Stationary cycling', dose: '10–15 min' },
    ],
  },
  // ---- HIP: OA, trochanteric bursitis, hip pain ----
  {
    id: 'hip',
    label: 'Hip OA / lateral hip pain',
    src: 'APTA Hip OA CPG (2017) · hip abductor loading',
    match: (d) => /^M16\./.test(d.code) || /^M25\.55/.test(d.code) || /^M70\.[67]/.test(d.code) || re('osteoarthritis.*hip|trochanteric|hip').test(d.label),
    items: [
      { name: 'Side-lying hip abduction', dose: '12–15 × 3' },
      { name: 'Clamshell (band)', dose: '15 × 3/side' },
      { name: 'Glute bridge', dose: '10–15 × 3' },
      { name: 'Sit-to-stand', dose: '10 × 3' },
      { name: 'Standing hip extension (band)', dose: '12–15 × 3' },
      { name: 'Hip flexor stretch', dose: '30s × 3' },
      { name: 'Stationary cycling', dose: '10–15 min' },
    ],
  },
  // ---- ELBOW: lateral/medial epicondylalgia ----
  {
    id: 'epicondyle',
    label: 'Epicondylalgia (tennis/golfer elbow)',
    src: 'APTA clinical practice guidelines · tendon loading',
    match: (d) => /^M77\./.test(d.code) || re('epicondylitis|epicondylalgia|tennis elbow|golfer').test(d.label),
    items: [
      { name: 'Eccentric wrist extensor (Tyler twist)', dose: '15 × 3' },
      { name: 'Isometric wrist extension hold', dose: '5 × 30–45s' },
      { name: 'Wrist extensor stretch', dose: '30s × 3' },
      { name: 'Grip / putty squeeze', dose: '10–15 × 3' },
      { name: 'Forearm supination–pronation (light)', dose: '12–15 × 3' },
    ],
  },
  // ---- ANKLE/FOOT: plantar fasciitis / heel pain ----
  {
    id: 'plantar',
    label: 'Plantar fasciitis / heel pain',
    src: 'APTA Heel Pain–Plantar Fasciitis CPG',
    match: (d) => /^M72\.2/.test(d.code) || re('plantar fascii|heel pain|fasciitis').test(d.label),
    items: [
      { name: 'Plantar fascia-specific stretch', dose: '10 × 10s × 3/day' },
      { name: 'Gastrocnemius wall stretch', dose: '30s × 3' },
      { name: 'Soleus stretch (bent knee)', dose: '30s × 3' },
      { name: 'High-load calf raise (towel under toes)', dose: '8–12 × 3, slow' },
      { name: 'Intrinsic foot — toe yoga / towel scrunch', dose: '10–15 × 2' },
    ],
  },
  // ---- ANKLE/FOOT: Achilles tendinopathy ----
  {
    id: 'achilles',
    label: 'Achilles tendinopathy',
    src: 'APTA Achilles Tendinopathy CPG (2018)',
    match: (d) => /^M76\.6/.test(d.code) || re('achilles').test(d.label),
    items: [
      { name: 'Eccentric heel drop — knee straight', dose: '15 × 3, 2/day' },
      { name: 'Eccentric heel drop — knee bent (soleus)', dose: '15 × 3, 2/day' },
      { name: 'Double-leg calf raise', dose: '12–15 × 3' },
      { name: 'Gastroc & soleus stretch', dose: '30s × 3' },
    ],
  },
  // ---- ANKLE: sprain / instability ----
  {
    id: 'ankle_sprain',
    label: 'Ankle sprain / instability',
    src: 'APTA Ankle Stability CPG (2021) · proprioception',
    match: (d) => /^M25\.57/.test(d.code) || /^S93/.test(d.code) || re('ankle sprain|ankle instab|sprain.*ankle|ankle').test(d.label),
    items: [
      { name: 'Ankle alphabet (AROM)', dose: '2 sets each direction' },
      { name: 'Theraband 4-way (DF/PF/inv/ev)', dose: '12–15 × 3 each' },
      { name: 'Single-leg balance (eyes open→closed)', dose: '30s × 3' },
      { name: 'Heel raises', dose: '12–15 × 3' },
      { name: 'Calf stretch', dose: '30s × 3' },
    ],
  },
  // ---- WRIST/HAND: carpal tunnel ----
  {
    id: 'carpal',
    label: 'Carpal tunnel syndrome',
    src: 'APTA Carpal Tunnel Syndrome CPG (2019)',
    match: (d) => /^G56\.0/.test(d.code) || re('carpal tunnel').test(d.label),
    items: [
      { name: 'Median nerve glides', dose: '10 reps × 3/day' },
      { name: 'Tendon gliding (5 positions)', dose: '10 reps × 3/day' },
      { name: 'Wrist flexor stretch', dose: '30s × 3' },
      { name: 'Wrist extensor stretch', dose: '30s × 3' },
    ],
  },
  // ---- SPINE posture: kyphosis / scoliosis ----
  {
    id: 'posture',
    label: 'Postural / spinal alignment',
    src: 'APTA clinical practice guidelines · postural conditioning',
    match: (d) => /^M40\./.test(d.code) || /^M41\./.test(d.code) || re('kyphosis|scoliosis|postural').test(d.label),
    items: [
      { name: 'Thoracic extension over foam roll', dose: '10 reps × 2' },
      { name: 'Prone "Y/T/W" scapular', dose: '10–12 × 3' },
      { name: 'Chin tuck (cervical retraction)', dose: '10 × 5s × 3' },
      { name: 'Pectoralis doorway stretch', dose: '30s × 3' },
      { name: 'Core stabilization (dead-bug)', dose: '8–10/side × 3' },
    ],
  },
]

/**
 * Returns the matching protocol for a diagnosis, or null. dx = { code, label }.
 */
export const planForDx = (dx) => {
  if (!dx) return null
  const d = { code: dx.code || '', label: dx.label || '' }
  return REHAB_PROTOCOLS.find((p) => {
    try { return p.match(d) } catch { return false }
  }) || null
}
