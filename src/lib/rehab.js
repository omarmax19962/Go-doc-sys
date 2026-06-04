/**
 * rehab.js — diagnosis → evidence-based exercise protocols.
 *
 * Maps an ICD-10 diagnosis to a recommended starter set of therapeutic
 * exercises so the doctor sees condition-appropriate options the moment a
 * diagnosis is chosen, instead of picking from a flat list.
 *
 * Protocols are grouped by region/condition and reflect current
 * musculoskeletal physiotherapy clinical practice guidelines (JOSPT/APTA
 * CPGs and contemporary PT texts). Each item carries a sensible starting
 * dosage; the treating clinician adjusts to the individual patient.
 *
 * Matching is first-match: list the more specific conditions before the
 * generic regional ones. `match(dx)` receives { code, label }.
 */

const re = (s) => new RegExp(s, 'i')

export const MSK_PROTOCOLS = [
  // ---- LUMBAR: radiculopathy / sciatica (more specific than generic LBP) ----
  {
    id: 'lumbar_radic',
    label: 'Lumbar radiculopathy / sciatica',
    src: 'JOSPT Low Back Pain CPG · neurodynamics',
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
    src: 'JOSPT/APTA Low Back Pain CPG (2021)',
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
    src: 'JOSPT Neck Pain CPG · upper-limb neurodynamics',
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
    src: 'JOSPT Neck Pain CPG (2017)',
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
    src: 'JOSPT Shoulder CPG · capsular stretching',
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
    src: 'JOSPT Shoulder CPG · rotator-cuff & scapular loading',
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
    src: 'JOSPT Patellofemoral Pain CPG (2019) · hip + knee',
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
    src: 'OARSI / GLA:D knee programme',
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
    src: 'OA CPG · hip abductor loading',
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
    src: 'Tendinopathy loading · eccentric/isometric',
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
    src: 'JOSPT Heel Pain CPG',
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
    src: 'Alfredson eccentric loading protocol',
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
    src: 'JOSPT Ankle Stability CPG · proprioception',
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
    src: 'Median nerve & tendon gliding',
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
    src: 'Postural strengthening & mobility',
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
  return MSK_PROTOCOLS.find((p) => {
    try { return p.match(d) } catch { return false }
  }) || null
}
