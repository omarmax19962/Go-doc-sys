// functionalOutcomes.js
// Case-specific FUNCTIONAL outcome frameworks for the patient progress report.
// Pain is only one input — recovery is really about restoring function. For the
// most common orthopaedic surgeries we surface the validated outcome measures
// (PROMs) and the rehabilitation milestones clinicians actually track, drawn
// from APTA Clinical Practice Guidelines (published in JOSPT) and the core
// orthopaedic / sports-PT literature indexed on PubMed.
//
// Each template:
//   region      — body area (for the icon/labelling)
//   match       — keywords matched against the diagnosis text
//   name        — {en, ar} human label of the case
//   hero        — {en, ar} the functional headline this case is really about
//   proms       — validated measures we track  [{abbr, en, ar}]
//   milestones  — the recovery roadmap, in order [{en, ar}]
//   rts         — {en, ar} return-to-activity / discharge readiness criteria
//   source      — citation for the guideline / evidence
//
// `outcomesForDx(dx)` picks the best template from a diagnosis (label/code),
// falling back to a generic functional framework. `roadmapProgress()` maps the
// patient's phase / session count onto the milestone list so the report can show
// "where you are now" without over-claiming verified attainment.

const T = (en, ar) => ({ en, ar })

export const FUNCTIONAL_TEMPLATES = [
  {
    key: 'acl', region: 'knee',
    match: ['acl', 'anterior cruciate', 'cruciate ligament', 'الرباط الصليبي'],
    name: T('ACL reconstruction', 'إعادة بناء الرباط الصليبي الأمامي'),
    hero: T('Restoring knee stability, strength symmetry and return to sport',
            'استعادة ثبات الركبة وتماثل قوة العضلات والرجوع للرياضة'),
    proms: [
      { abbr: 'IKDC', en: 'Overall knee function score', ar: 'مقياس وظيفة الركبة الكلي' },
      { abbr: 'KOOS', en: 'Knee pain, daily activity & sport sub-scores', ar: 'ألم الركبة والأنشطة اليومية والرياضة' },
      { abbr: 'Hop LSI', en: 'Single-leg hop symmetry vs. the other leg (target ≥90%)', ar: 'تماثل الوثب على رجل واحدة مقارنة بالأخرى (الهدف ≥90%)' },
      { abbr: 'Quad LSI', en: 'Thigh-muscle strength symmetry (target ≥90%)', ar: 'تماثل قوة عضلة الفخذ (الهدف ≥90%)' },
    ],
    milestones: [
      T('Full knee extension & swelling controlled', 'فرد الركبة كامل والتورم تحت السيطرة'),
      T('Knee flexion ≥120° and normal walking', 'ثني الركبة ≥120° والمشي طبيعي'),
      T('Quadriceps strength ≥80% of the other leg', 'قوة عضلة الفخذ ≥80% من الرجل الأخرى'),
      T('Single-leg hop symmetry ≥90%', 'تماثل الوثب على رجل واحدة ≥90%'),
      T('Return to running', 'الرجوع للجري'),
      T('Return to cutting / pivoting sport', 'الرجوع للرياضة التي بها لف وتغيير اتجاه'),
    ],
    rts: T('Cleared for sport when strength and hop symmetry are ≥90% and movement is confident and pain-free.',
           'يُسمح بالرياضة عندما يصل تماثل القوة والوثب ≥90% مع حركة واثقة وخالية من الألم.'),
    source: 'APTA/JOSPT Knee Stability & Movement Coordination CPG (Logerstedt 2017); MOON / return-to-sport criteria.',
  },
  {
    key: 'tka', region: 'knee',
    match: ['knee replacement', 'tkr', 'tka', 'arthroplasty knee', 'total knee', 'مفصل الركبة الصناعي', 'تغيير مفصل الركبة'],
    name: T('Total knee replacement', 'تغيير مفصل الركبة الكامل'),
    hero: T('Walking comfortably, climbing stairs and regaining independent daily function',
            'المشي بسهولة وصعود السلالم واستعادة الاستقلالية في الحياة اليومية'),
    proms: [
      { abbr: 'KOOS-JR', en: 'Knee function for daily life', ar: 'وظيفة الركبة في الحياة اليومية' },
      { abbr: 'Oxford Knee', en: 'Pain & function questionnaire', ar: 'استبيان الألم والوظيفة' },
      { abbr: 'TUG', en: 'Timed get-up-and-walk (mobility & fall risk)', ar: 'زمن القيام والمشي (الحركة وخطر السقوط)' },
      { abbr: '30s chair-stand', en: 'Leg strength & endurance', ar: 'قوة وتحمّل الرجل' },
    ],
    milestones: [
      T('Safe transfers and walking with an aid', 'الانتقال الآمن والمشي بمساعدة'),
      T('Knee bends to ~90–110° and straightens fully', 'ثني الركبة ~90–110° وفردها كامل'),
      T('Walking without a stick / walker', 'المشي بدون عصا أو مشّاية'),
      T('Climbing stairs step-over-step', 'صعود السلالم درجة بدرجة'),
      T('Independent in daily activities', 'الاستقلال في الأنشطة اليومية'),
      T('Return to low-impact activity (walking, cycling, swimming)', 'الرجوع للنشاط منخفض الحِمل (المشي، الدراجة، السباحة)'),
    ],
    rts: T('Discharge when you walk independently, manage stairs, and daily tasks are pain-free.',
           'يتم الإنهاء عند المشي باستقلالية والتعامل مع السلالم وخلو الأنشطة اليومية من الألم.'),
    source: 'APTA/JOSPT Knee OA CPG; AAOS TKA rehabilitation guidance.',
  },
  {
    key: 'meniscus', region: 'knee',
    match: ['meniscus', 'meniscectomy', 'meniscal', 'الغضروف الهلالي'],
    name: T('Meniscus surgery', 'جراحة الغضروف الهلالي'),
    hero: T('Restoring pain-free knee motion, strength and return to activity',
            'استعادة حركة الركبة بدون ألم والقوة والرجوع للنشاط'),
    proms: [
      { abbr: 'IKDC', en: 'Overall knee function', ar: 'وظيفة الركبة الكلية' },
      { abbr: 'KOOS', en: 'Pain, daily activity & sport', ar: 'الألم والأنشطة والرياضة' },
    ],
    milestones: [
      T('Swelling controlled, full extension', 'التورم تحت السيطرة وفرد كامل'),
      T('Full knee flexion and normal gait', 'ثني الركبة كامل ومشي طبيعي'),
      T('Quadriceps strength restored', 'استعادة قوة عضلة الفخذ'),
      T('Return to running / jumping', 'الرجوع للجري والقفز'),
      T('Return to sport', 'الرجوع للرياضة'),
    ],
    rts: T('Return to sport when strength is symmetric and hopping/landing is confident and pain-free.',
           'الرجوع للرياضة عند تماثل القوة وثقة الوثب والهبوط بدون ألم.'),
    source: 'JOSPT knee rehabilitation literature; KOOS/IKDC validated PROMs.',
  },
  {
    key: 'tha', region: 'hip',
    match: ['hip replacement', 'tha', 'total hip', 'hip arthroplasty', 'مفصل الورك الصناعي', 'تغيير مفصل الورك'],
    name: T('Total hip replacement', 'تغيير مفصل الورك الكامل'),
    hero: T('Walking with a level, confident gait and full independence in daily life',
            'المشي بثبات وثقة والاستقلال الكامل في الحياة اليومية'),
    proms: [
      { abbr: 'HOOS-JR', en: 'Hip function for daily life', ar: 'وظيفة الورك في الحياة اليومية' },
      { abbr: 'Oxford Hip', en: 'Pain & function questionnaire', ar: 'استبيان الألم والوظيفة' },
      { abbr: 'TUG', en: 'Timed get-up-and-walk', ar: 'زمن القيام والمشي' },
      { abbr: '6MWT', en: 'Six-minute walk (endurance)', ar: 'مشي ست دقائق (التحمل)' },
    ],
    milestones: [
      T('Safe transfers, respecting hip precautions', 'الانتقال الآمن مع مراعاة احتياطات الورك'),
      T('Walking with an aid, even weight-bearing', 'المشي بمساعدة مع توزيع وزن متساوٍ'),
      T('Walking unaided with level gait', 'المشي بدون مساعدة ومشية متّزنة'),
      T('Stairs and getting in/out of a car', 'السلالم والدخول/الخروج من السيارة'),
      T('Independent daily activities', 'الاستقلال في الأنشطة اليومية'),
      T('Return to walking distances / low-impact exercise', 'الرجوع لمسافات المشي والتمارين منخفضة الحِمل'),
    ],
    rts: T('Discharge when gait is symmetric, stairs are easy, and daily life needs no assistance.',
           'الإنهاء عند تماثل المشية وسهولة السلالم وعدم الحاجة لمساعدة في الحياة اليومية.'),
    source: 'APTA/JOSPT Hip OA CPG; HOOS-JR validated PROM.',
  },
  {
    key: 'hip_scope', region: 'hip',
    match: ['hip arthroscopy', 'fai', 'femoroacetabular', 'labral hip', 'منظار الورك'],
    name: T('Hip arthroscopy (FAI / labrum)', 'منظار الورك (الاحتكاك/الشفة)'),
    hero: T('Restoring hip mobility, deep-hip strength and return to sport',
            'استعادة حركة الورك وقوة عضلاته العميقة والرجوع للرياضة'),
    proms: [
      { abbr: 'iHOT-33', en: 'Hip function for active people', ar: 'وظيفة الورك للأشخاص النشطين' },
      { abbr: 'HOS', en: 'Daily activity & sport sub-scales', ar: 'الأنشطة اليومية والرياضة' },
    ],
    milestones: [
      T('Protected weight-bearing, pain settled', 'تحميل محمي مع هدوء الألم'),
      T('Full hip range of motion', 'مدى حركة الورك كامل'),
      T('Hip and core strength restored', 'استعادة قوة الورك والجذع'),
      T('Running and agility', 'الجري والرشاقة'),
      T('Return to sport', 'الرجوع للرياضة'),
    ],
    rts: T('Return to sport with full motion, symmetric strength and confident agility.',
           'الرجوع للرياضة بمدى حركة كامل وقوة متماثلة ورشاقة واثقة.'),
    source: 'iHOT-33 / HOS validated PROMs; hip arthroscopy rehab literature.',
  },
  {
    key: 'ankle_lig', region: 'ankle',
    match: ['ankle ligament', 'atfl', 'lateral ligament', 'ankle sprain', 'ankle stabil', 'أربطة الكاحل', 'التواء الكاحل'],
    name: T('Ankle ligament surgery / instability', 'جراحة أربطة الكاحل / عدم الثبات'),
    hero: T('Restoring balance, single-leg control and confident return to activity',
            'استعادة التوازن والتحكم على رجل واحدة والرجوع الواثق للنشاط'),
    proms: [
      { abbr: 'FAAM', en: 'Foot & ankle ability in daily life and sport', ar: 'قدرة القدم والكاحل في الحياة والرياضة' },
      { abbr: 'CAIT', en: 'Ankle stability / giving-way', ar: 'ثبات الكاحل / الانثناء المفاجئ' },
      { abbr: 'Y-Balance', en: 'Dynamic balance & reach symmetry', ar: 'التوازن الحركي وتماثل المدى' },
    ],
    milestones: [
      T('Swelling controlled, full weight-bearing', 'التورم تحت السيطرة وتحميل كامل'),
      T('Full ankle range of motion', 'مدى حركة الكاحل كامل'),
      T('Single-leg balance restored', 'استعادة التوازن على رجل واحدة'),
      T('Hopping and agility without giving-way', 'الوثب والرشاقة بدون انثناء'),
      T('Return to sport', 'الرجوع للرياضة'),
    ],
    rts: T('Return to sport with symmetric balance, confident hopping and no sense of giving-way.',
           'الرجوع للرياضة بتوازن متماثل ووثب واثق وبدون إحساس بعدم الثبات.'),
    source: 'APTA/JOSPT Ankle Stability & Movement Coordination CPG (Martin 2021); FAAM/CAIT PROMs.',
  },
  {
    key: 'achilles', region: 'ankle',
    match: ['achilles', 'tendo-achilles', 'tendoachilles', 'وتر أكيلس', 'وتر العرقوب'],
    name: T('Achilles tendon repair', 'إصلاح وتر أكيلس'),
    hero: T('Rebuilding calf strength, single-leg heel-rise and return to running',
            'إعادة بناء قوة السمانة والوقوف على المشط والرجوع للجري'),
    proms: [
      { abbr: 'ATRS', en: 'Achilles recovery & symptoms score', ar: 'مقياس تعافي وأعراض أكيلس' },
      { abbr: 'Heel-rise LSI', en: 'Single-leg heel-rise count/height vs. other leg', ar: 'الوقوف على المشط مقارنة بالرجل الأخرى' },
    ],
    milestones: [
      T('Protected weight-bearing in boot, wound healed', 'تحميل محمي بالحذاء الطبي والتئام الجرح'),
      T('Full ankle motion, normal walking out of boot', 'مدى حركة كامل ومشي طبيعي بدون الحذاء'),
      T('Double-leg then single-leg heel raises', 'الوقوف على المشط بالرجلين ثم رجل واحدة'),
      T('Calf strength ≥80% of the other leg', 'قوة السمانة ≥80% من الرجل الأخرى'),
      T('Return to running and jumping', 'الرجوع للجري والقفز'),
    ],
    rts: T('Return to sport when single-leg heel-rise and calf strength are near-symmetric.',
           'الرجوع للرياضة عند اقتراب الوقوف على المشط وقوة السمانة من التماثل.'),
    source: 'ATRS validated PROM; Achilles rupture rehabilitation literature (JOSPT).',
  },
  {
    key: 'ankle_orif', region: 'ankle',
    match: ['ankle fracture', 'ankle orif', 'malleol', 'كسر الكاحل'],
    name: T('Ankle fracture fixation (ORIF)', 'تثبيت كسر الكاحل'),
    hero: T('Restoring weight-bearing, ankle motion and a normal walking pattern',
            'استعادة التحميل وحركة الكاحل ونمط المشي الطبيعي'),
    proms: [
      { abbr: 'FAAM', en: 'Foot & ankle daily function', ar: 'وظيفة القدم والكاحل اليومية' },
      { abbr: 'AOFAS', en: 'Ankle/hindfoot function', ar: 'وظيفة الكاحل ومؤخرة القدم' },
    ],
    milestones: [
      T('Progress to full weight-bearing', 'التقدّم للتحميل الكامل'),
      T('Full ankle range of motion', 'مدى حركة الكاحل كامل'),
      T('Normal walking without a limp', 'مشي طبيعي بدون عرج'),
      T('Single-leg balance and stairs', 'التوازن على رجل واحدة والسلالم'),
      T('Return to running / sport', 'الرجوع للجري والرياضة'),
    ],
    rts: T('Discharge with a normal gait, full motion and confident single-leg control.',
           'الإنهاء بمشية طبيعية ومدى حركة كامل وتحكم واثق على رجل واحدة.'),
    source: 'FAAM / AOFAS measures; ankle fracture rehab literature.',
  },
  {
    key: 'wrist', region: 'wrist',
    match: ['distal radius', 'wrist fracture', 'wrist orif', 'colles', 'كسر الرسغ', 'كسر الكعبرة'],
    name: T('Wrist fracture fixation', 'تثبيت كسر الرسغ'),
    hero: T('Restoring wrist motion, grip strength and use of the hand in daily tasks',
            'استعادة حركة الرسغ وقوة القبضة واستخدام اليد في المهام اليومية'),
    proms: [
      { abbr: 'PRWE', en: 'Wrist pain & function', ar: 'ألم ووظيفة الرسغ' },
      { abbr: 'QuickDASH', en: 'Arm, shoulder & hand function', ar: 'وظيفة الذراع والكتف واليد' },
      { abbr: 'Grip', en: 'Grip strength vs. the other hand', ar: 'قوة القبضة مقارنة باليد الأخرى' },
    ],
    milestones: [
      T('Swelling controlled, finger motion full', 'التورم تحت السيطرة وحركة الأصابع كاملة'),
      T('Wrist range of motion restored', 'استعادة مدى حركة الرسغ'),
      T('Grip strength rebuilding', 'إعادة بناء قوة القبضة'),
      T('Light daily tasks (writing, dressing)', 'المهام اليومية الخفيفة (الكتابة، اللبس)'),
      T('Return to heavier lifting / work', 'الرجوع للحمل الأثقل والعمل'),
    ],
    rts: T('Discharge when motion and grip are near-symmetric and daily hand use is pain-free.',
           'الإنهاء عند اقتراب الحركة والقبضة من التماثل وخلو استخدام اليد من الألم.'),
    source: 'PRWE / QuickDASH validated PROMs; distal radius rehab literature.',
  },
  {
    key: 'scaphoid', region: 'wrist',
    match: ['scaphoid', 'العظم الزورقي'],
    name: T('Scaphoid fixation', 'تثبيت العظم الزورقي'),
    hero: T('Restoring wrist motion and grip while protecting bone healing',
            'استعادة حركة الرسغ والقبضة مع حماية التئام العظم'),
    proms: [
      { abbr: 'PRWE', en: 'Wrist pain & function', ar: 'ألم ووظيفة الرسغ' },
      { abbr: 'Grip', en: 'Grip strength symmetry', ar: 'تماثل قوة القبضة' },
    ],
    milestones: [
      T('Protected motion, finger mobility', 'حركة محمية ومرونة الأصابع'),
      T('Wrist range of motion restored', 'استعادة مدى حركة الرسغ'),
      T('Grip strength rebuilding', 'إعادة بناء قوة القبضة'),
      T('Return to daily and work tasks', 'الرجوع للمهام اليومية والعمل'),
    ],
    rts: T('Progress loading once healing is confirmed; discharge at near-symmetric grip and motion.',
           'زيادة التحميل بعد تأكّد الالتئام؛ الإنهاء عند تماثل القبضة والحركة تقريبًا.'),
    source: 'PRWE PROM; scaphoid rehabilitation literature.',
  },
  {
    key: 'rcr', region: 'shoulder',
    match: ['rotator cuff', 'supraspinatus repair', 'الكفة المدورة', 'الكفة المدوّرة'],
    name: T('Rotator cuff repair', 'إصلاح الكفة المدورة'),
    hero: T('Regaining pain-free overhead reach and shoulder strength for daily use',
            'استعادة رفع الذراع لأعلى بدون ألم وقوة الكتف للاستخدام اليومي'),
    proms: [
      { abbr: 'ASES', en: 'Shoulder pain & daily function', ar: 'ألم الكتف والوظيفة اليومية' },
      { abbr: 'Constant', en: 'Shoulder strength & motion score', ar: 'مقياس قوة وحركة الكتف' },
      { abbr: 'SPADI', en: 'Shoulder pain & disability', ar: 'ألم وإعاقة الكتف' },
    ],
    milestones: [
      T('Sling protection, passive motion only', 'حماية بالحمّالة وحركة سلبية فقط'),
      T('Full passive range of motion', 'مدى حركة سلبي كامل'),
      T('Active overhead reach restored', 'استعادة رفع الذراع لأعلى بنشاط'),
      T('Rotator-cuff strength rebuilding', 'إعادة بناء قوة الكفة المدورة'),
      T('Return to lifting / overhead activity', 'الرجوع للحمل والأنشطة فوق الرأس'),
    ],
    rts: T('Discharge with full motion, symmetric strength and pain-free overhead use.',
           'الإنهاء بمدى حركة كامل وقوة متماثلة واستخدام فوق الرأس بدون ألم.'),
    source: 'APTA/JOSPT shoulder guidance; ASES / Constant / SPADI PROMs.',
  },
  {
    key: 'shoulder_inst', region: 'shoulder',
    match: ['bankart', 'shoulder instability', 'labrum shoulder', 'labral shoulder', 'slap', 'خلع الكتف', 'عدم ثبات الكتف'],
    name: T('Shoulder stabilization (instability / labrum)', 'تثبيت الكتف (عدم الثبات/الشفة)'),
    hero: T('Restoring a stable, confident shoulder and return to sport',
            'استعادة كتف ثابت وواثق والرجوع للرياضة'),
    proms: [
      { abbr: 'WOSI', en: 'Shoulder instability quality of life', ar: 'جودة الحياة مع عدم ثبات الكتف' },
      { abbr: 'ASES', en: 'Shoulder pain & function', ar: 'ألم ووظيفة الكتف' },
    ],
    milestones: [
      T('Protected motion within safe range', 'حركة محمية ضمن المدى الآمن'),
      T('Full range of motion', 'مدى حركة كامل'),
      T('Rotator-cuff & scapular strength', 'قوة الكفة المدورة ولوح الكتف'),
      T('Sport-specific drills, no apprehension', 'تمارين خاصة بالرياضة بدون خوف من الخلع'),
      T('Return to sport / contact', 'الرجوع للرياضة والاحتكاك'),
    ],
    rts: T('Return to sport with full strength, control and no apprehension.',
           'الرجوع للرياضة بقوة وتحكم كاملين وبدون خوف من عدم الثبات.'),
    source: 'WOSI / ASES validated PROMs; shoulder instability rehab literature.',
  },
  {
    key: 'elbow', region: 'elbow',
    match: ['ucl elbow', 'tommy john', 'elbow fracture', 'olecranon', 'elbow ligament', 'الكوع', 'كسر الكوع'],
    name: T('Elbow surgery (ligament / fracture)', 'جراحة الكوع (رباط/كسر)'),
    hero: T('Restoring full elbow motion and arm strength for daily and sport use',
            'استعادة مدى حركة الكوع كاملًا وقوة الذراع للاستخدام اليومي والرياضي'),
    proms: [
      { abbr: 'MEPS', en: 'Elbow function & motion score', ar: 'مقياس وظيفة وحركة الكوع' },
      { abbr: 'QuickDASH', en: 'Arm & hand function', ar: 'وظيفة الذراع واليد' },
    ],
    milestones: [
      T('Protected motion, swelling settled', 'حركة محمية وهدوء التورم'),
      T('Full bend & straighten / rotation', 'الثني والفرد والدوران كاملًا'),
      T('Arm strength rebuilding', 'إعادة بناء قوة الذراع'),
      T('Daily tasks without limitation', 'المهام اليومية بدون قيود'),
      T('Return to throwing / sport', 'الرجوع للرمي والرياضة'),
    ],
    rts: T('Return to sport when motion is full and strength is symmetric and pain-free.',
           'الرجوع للرياضة عند اكتمال الحركة وتماثل القوة بدون ألم.'),
    source: 'MEPS / QuickDASH measures; elbow rehabilitation literature.',
  },
  {
    key: 'clavicle', region: 'clavicle',
    match: ['clavicle', 'collar bone', 'collarbone', 'acromioclavicular', 'الترقوة', 'عظمة الترقوة'],
    name: T('Clavicle fixation (ORIF)', 'تثبيت كسر الترقوة'),
    hero: T('Regaining full shoulder reach and arm strength as the bone heals',
            'استعادة مدى حركة الكتف كاملًا وقوة الذراع مع التئام العظم'),
    proms: [
      { abbr: 'QuickDASH', en: 'Arm, shoulder & hand function', ar: 'وظيفة الذراع والكتف واليد' },
      { abbr: 'Constant', en: 'Shoulder strength & motion', ar: 'قوة وحركة الكتف' },
    ],
    milestones: [
      T('Sling comfort, gentle pendulum motion', 'راحة الحمّالة وحركة بندولية لطيفة'),
      T('Shoulder elevation to shoulder height', 'رفع الكتف حتى مستوى الكتف'),
      T('Full overhead range of motion', 'مدى حركة كامل فوق الرأس'),
      T('Shoulder & scapular strength restored', 'استعادة قوة الكتف ولوح الكتف'),
      T('Return to lifting / sport', 'الرجوع للحمل والرياضة'),
    ],
    rts: T('Discharge with full motion and symmetric strength once healing is confirmed.',
           'الإنهاء بمدى حركة كامل وقوة متماثلة بعد تأكّد الالتئام.'),
    source: 'QuickDASH / Constant PROMs; clavicle fracture rehab literature.',
  },
  {
    key: 'spine', region: 'spine',
    match: ['discectomy', 'lumbar', 'spine surgery', 'laminectomy', 'fusion', 'الغضروف القطني', 'الفقرات'],
    name: T('Spine surgery (disc / lumbar)', 'جراحة العمود الفقري (غضروف/قطني)'),
    hero: T('Restoring pain-free movement, core control and return to daily activity',
            'استعادة الحركة بدون ألم والتحكم في عضلات الجذع والرجوع للنشاط اليومي'),
    proms: [
      { abbr: 'ODI', en: 'Back-related disability in daily life', ar: 'الإعاقة المرتبطة بالظهر في الحياة اليومية' },
      { abbr: 'Roland-Morris', en: 'Back-pain function questionnaire', ar: 'استبيان وظيفة آلام الظهر' },
    ],
    milestones: [
      T('Comfortable walking, safe posture', 'مشي مريح ووضعية آمنة'),
      T('Core activation & gentle mobility', 'تفعيل عضلات الجذع وحركة لطيفة'),
      T('Tolerance for sitting & daily tasks', 'تحمّل الجلوس والمهام اليومية'),
      T('Progressive strengthening', 'تقوية تدريجية'),
      T('Return to work / activity', 'الرجوع للعمل والنشاط'),
    ],
    rts: T('Discharge when daily activity and sitting tolerance are restored without nerve symptoms.',
           'الإنهاء عند استعادة النشاط اليومي وتحمّل الجلوس بدون أعراض عصبية.'),
    source: 'ODI / Roland-Morris PROMs; post-operative lumbar rehab literature.',
  },
]

// Generic functional framework when the case doesn't match a template.
const DEFAULT_TEMPLATE = {
  key: 'general', region: 'general',
  name: T('Rehabilitation', 'إعادة التأهيل'),
  hero: T('Restoring movement, strength and the activities that matter to you',
          'استعادة الحركة والقوة والأنشطة المهمة بالنسبة لك'),
  proms: [
    { abbr: 'Function', en: 'Your ability in daily activities', ar: 'قدرتك في الأنشطة اليومية' },
    { abbr: 'ROM', en: 'Range of motion', ar: 'مدى الحركة' },
    { abbr: 'Strength', en: 'Muscle strength', ar: 'قوة العضلات' },
  ],
  milestones: [
    T('Pain and swelling under control', 'الألم والتورم تحت السيطرة'),
    T('Range of motion restored', 'استعادة مدى الحركة'),
    T('Strength rebuilding', 'إعادة بناء القوة'),
    T('Return to daily activities', 'الرجوع للأنشطة اليومية'),
    T('Return to full activity / sport', 'الرجوع للنشاط الكامل والرياضة'),
  ],
  rts: T('Discharge when your goal activities are comfortable and confident.',
         'الإنهاء عندما تصبح أنشطتك المستهدفة مريحة وواثقة.'),
  source: 'Patient-centred functional goals (ICF framework).',
}

const norm = (s) => String(s || '').toLowerCase()

// Pick the best functional template for a diagnosis.
export function outcomesForDx(dx) {
  const text = norm(typeof dx === 'string' ? dx : (dx?.label || '')) + ' ' + norm(dx?.code)
  for (const tpl of FUNCTIONAL_TEMPLATES) {
    if (tpl.match.some((kw) => text.includes(kw))) return tpl
  }
  return DEFAULT_TEMPLATE
}

// Map the patient's phase / progress onto the milestone roadmap.
// Returns { reachedCount, currentIndex, pct } — honest "where you are now"
// without claiming clinically-verified attainment of each milestone.
export function roadmapProgress({ template, protocol, sessions = 0 }) {
  const n = template.milestones.length
  let stage = null
  const phaseText = norm(protocol?.phase)
  const m = phaseText.match(/phase\s*([1-5])/)
  if (m) stage = (Number(m[1]) - 0.5) / 4          // phase 1..4 → fraction
  if (stage == null) {                              // else infer from session count
    if (sessions <= 2) stage = 0.12
    else if (sessions <= 6) stage = 0.38
    else if (sessions <= 10) stage = 0.6
    else if (sessions <= 16) stage = 0.8
    else stage = 0.95
  }
  stage = Math.max(0, Math.min(1, stage))
  const currentIndex = Math.min(n - 1, Math.floor(stage * n))
  return { reachedCount: currentIndex, currentIndex, pct: Math.round(stage * 100) }
}
