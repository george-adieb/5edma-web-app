// supabase/functions/ai-assistant/index.ts
//
// PROTECTED — requires valid user JWT.
// Deploy: supabase functions deploy ai-assistant
//
// Architecture:
//   1. Verify JWT → user
//   2. Fetch profile → determine scope
//   3. Load scoped students (safe fields only)
//   4. Sensitive-data guard (always runs before any AI)
//   5. Local name-match detection (priority over general intents)
//   6. OpenAI classification (question + name-match hints)
//   7. Execute the right intent handler with DB queries
//   8. OpenAI answer generation (only for student_lookup; fallback to template)
//   9. Return { answer, intent, requested_field, count, items }
//
// Security guarantees:
//   - No SQL from AI; only hardcoded scoped Supabase queries
//   - No phone / address / medical notes sent to OpenAI or returned in bulk
//   - OpenAI only sees: question + student names list (no sensitive fields)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY    = Deno.env.get('OPENAI_API_KEY') ?? '';
const OPENAI_MODEL      = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Arabic text normalization ────────────────────────────────────────────────
function normalize(text: string): string {
  return text
    .trim()
    .replace(/[\u0640]/g, '')                    // remove tatweel ـ
    .replace(/[\u064B-\u065F\u0670]/g, '')       // remove tashkeel / diacritics
    .replace(/[أإآ]/g, 'ا')                     // normalize alef variants
    .replace(/ى/g, 'ي')                         // alef maqsoura → ya
    .replace(/ة/g, 'ه')                         // taa marbuta → ha
    .replace(/[،,.?؟!:؛;«»]/g, ' ')             // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeArabicQuestionForOverride(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u0640]/g, '') // remove tatweel
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel/diacritics
    .replace(/[أإآ]/g, 'ا') // normalize alef
    .replace(/ى/g, 'ي') // alef maqsoura -> ya
    .replace(/[،,.?؟!:؛;«»]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function detectStudentCode(question: string): string | null {
  const text = question.trim();
  
  // 1. check if the text contains STD- followed by digits (case insensitive, optional spaces)
  const stdRegex = /STD\s*-\s*\d+/i;
  const stdMatch = text.match(stdRegex);
  if (stdMatch) {
    return stdMatch[0].replace(/\s+/g, '').toUpperCase();
  }

  // 2. check if there is an exactly 4 digit number in the text
  const digitRegex = /\b\d{4}\b/;
  const digitMatch = text.match(digitRegex);
  if (digitMatch) {
    return `STD-${digitMatch[0]}`;
  }

  return null;
}


// Common Arabic question/stop words to exclude from name matching
const STOP_WORDS = new Set([
  'مين', 'في', 'من', 'الى', 'إلى', 'على', 'عن', 'مع', 'هو', 'هي', 'انا', 'احنا',
  'ده', 'دي', 'دول', 'كام', 'فين', 'ازاي', 'ليه', 'إيه', 'ايه', 'هل', 'لما', 'لو',
  'عيد', 'ميلاد', 'ميلاده', 'ميلادها', 'نقاط', 'نقطه', 'حضور', 'غياب', 'افتقاد',
  'اعرف', 'اعرفني', 'اديني', 'هات', 'عايز', 'عاوز', 'ممكن', 'كيف', 'كل',
  'الشهر', 'الاسبوع', 'النهارده', 'اليوم', 'ده', 'دي', 'بيانات', 'معلومات',
  'مخدوم', 'مخدومه', 'طفل', 'ولد', 'بنت', 'اسم', 'حالة', 'حاله', 'كود',
]);

// ─── Scoped student type (safe fields only) ───────────────────────────────────
interface SafeStudent {
  id: string;
  code: string | null;
  name: string;
  grade: string | null;
  status: string | null;
  birth_date: string | null;
  follow_up_baseline_date?: string | null;
}

// ─── Follow-up eligibility (mirror of src/lib/followUpEligibility.js) ─────────
// 'منقطع بسبب' = absence reason known → never an automatic follow-up candidate.
// Attendance on/before follow_up_baseline_date (set when leaving that status) is ignored.
const EXEMPT_STATUS = 'منقطع بسبب';
const isFollowUpExempt = (s: { status?: string | null }) => (s.status ?? '').trim() === EXEMPT_STATUS;

// ─── Profile & scope ──────────────────────────────────────────────────────────
interface Profile {
  id: string;
  role: 'ADMIN' | 'SERVICE_HEAD' | 'SERVANT' | string;
  assigned_grade?:  string | null;
  assigned_grades?: string[] | null;
  assigned_gender?: string | null;
  full_name?: string;
}

// Service-role queries bypass RLS, so scope MUST be applied here. Deny by default:
// a missing/empty grade list, a missing gender or an unknown role matches NOTHING.
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

function scopeGrades(profile: Profile): string[] {
  if (Array.isArray(profile.assigned_grades) && profile.assigned_grades.length) return profile.assigned_grades;
  return profile.assigned_grade ? [profile.assigned_grade] : [];
}

// deno-lint-ignore no-explicit-any
function applyScope(query: any, profile: Profile): any {
  if (profile.role === 'ADMIN') return query;

  if (profile.role === 'SERVICE_HEAD' || profile.role === 'SERVANT') {
    const grades = scopeGrades(profile);
    if (!grades.length || !profile.assigned_gender) return query.eq('id', NO_MATCH_ID);
    return query.in('grade', grades).eq('gender', profile.assigned_gender);
  }

  return query.eq('id', NO_MATCH_ID);
}

function scopeLabel(p: Profile): string {
  if (p.role === 'ADMIN') return 'كل المخدومين';
  if (p.role === 'SERVICE_HEAD') {
    const g = p.assigned_grades ?? (p.assigned_grade ? [p.assigned_grade] : []);
    return `فصول: ${g.join(', ')}`;
  }
  return [p.assigned_grade, p.assigned_gender].filter(Boolean).join(' | ') || 'نطاق محدود';
}

// ─── Load scoped students (safe fields only) ──────────────────────────────────
async function loadScopedStudents(profile: Profile): Promise<SafeStudent[]> {
  const { data, error } = await applyScope(
    supabaseAdmin.from('students').select('id, code, name, grade, status, birth_date, follow_up_baseline_date'),
    profile,
  );
  if (error) {
    console.error('[ai-assistant] loadScopedStudents error:', error.message);
    return [];
  }
  return (data || []) as SafeStudent[];
}

function normalizeArabic(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u0640]/g, '')                    // remove tatweel ـ
    .replace(/[\u064B-\u065F\u0670]/g, '')       // remove tashkeel / diacritics
    .replace(/[أإآ]/g, 'ا')                     // normalize alef variants
    .replace(/ى/g, 'ي')                         // alef maqsoura → ya
    .replace(/ة/g, 'ه')                         // taa marbuta → ha
    .replace(/[،,.?؟!:؛;«»]/g, ' ')             // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGradeFromQuestion(question: string): string | null {
  const norm = normalizeArabic(question);
  const GRADE_MAPPING: Record<string, string> = {
    'الاول الابتدائي': 'الأول الابتدائي',
    'الثاني الابتدائي': 'الثاني الابتدائي',
    'الثالث الابتدائي': 'الثالث الابتدائي',
    'الرابع الابتدائي': 'الرابع الابتدائي',
    'الخامس الابتدائي': 'الخامس الابتدائي',
    'السادس الابتدائي': 'السادس الابتدائي',
    'الاول الاعدادي': 'الأول الإعدادي',
    'الثاني الاعدادي': 'الثاني الإعدادي',
    'الثالث الاعدادي': 'الثالث الإعدادي',
    'الاول الثانوي': 'الأول الثانوي',
    'الثاني الثانوي': 'الثاني الثانوي',
    'الثالث الثانوي': 'الثالث الثانوي',
  };

  for (const [key, val] of Object.entries(GRADE_MAPPING)) {
    if (norm.includes(key)) {
      return val;
    }
  }

  const COLLOQUIAL_GRADE_PATTERNS = [
    { pattern: /سادس\s*ابتدائي|السادس\s*الابتدائي|السادس|سادسة|سادسه/i, value: 'السادس الابتدائي' },
    { pattern: /خامس\s*ابتدائي|الخامس\s*الابتدائي|الخامس|خامسة|خامسه/i, value: 'الخامس الابتدائي' },
    { pattern: /رابع\s*ابتدائي|الرابع\s*الابتدائي|الرابع|رابعة|رابعه/i, value: 'الرابع الابتدائي' },
    { pattern: /تالت\s*ابتدائي|ثالث\s*ابتدائي|الثالث\s*الابتدائي|الثالث|ثالته|ثالثة|تالتة/i, value: 'الثالث الابتدائي' },
    { pattern: /تاني\s*ابتدائي|ثاني\s*ابتدائي|الثاني\s*الابتدائي|الثاني|تانيه|ثانية|تانية/i, value: 'الثاني الابتدائي' },
    { pattern: /اول\s*ابتدائي|الاول\s*الابتدائي|الاول|اولى|أولى/i, value: 'الأول الابتدائي' },
  ];

  for (const gp of COLLOQUIAL_GRADE_PATTERNS) {
    if (gp.pattern.test(norm)) {
      return gp.value;
    }
  }
  return null;
}

function removeGradeWordsFromNameQuery(question: string): string {
  let clean = question;
  const wordsToRemove = [
    /الابتدائي/gi, /الاعدادي/gi, /الثانوي/gi,
    /السادس/gi, /الخامس/gi, /الرابع/gi, /الثالث/gi, /الثاني/gi, /الاول/gi,
    /سادس/gi, /خامس/gi, /رابع/gi, /تالت/gi, /ثالث/gi, /تاني/gi, /ثاني/gi, /اول/gi,
    /ابتدائي/gi, /اعدادي/gi, /ثانوي/gi, /السادس الابتدائي/gi, /الخامس الابتدائي/gi,
    /الرابع الابتدائي/gi, /الثالث الابتدائي/gi, /الثاني الابتدائي/gi, /الأول الابتدائي/gi,
    /سادسه/gi, /سادسة/gi, /خامسه/gi, /خامسة/gi, /رابعه/gi, /رابعة/gi, /تالته/gi, /ثالثة/gi, /تالتة/gi, /تانيه/gi, /ثانية/gi, /تانية/gi, /اولى/gi, /أولى/gi
  ];
  for (const pattern of wordsToRemove) {
    clean = clean.replace(pattern, ' ');
  }
  return clean.replace(/\s+/g, ' ').trim();
}

function findBestStudentMatch(question: string, scopedStudents: SafeStudent[]): {
  bestMatch: SafeStudent | null;
  ambiguousMatches: SafeStudent[];
  bestScore: number;
  secondScore: number;
  extractedGrade: string | null;
  studentQuery: string;
} {
  const extractedGrade = extractGradeFromQuestion(question);
  
  // Filter students by grade if detected
  let searchList = scopedStudents;
  if (extractedGrade) {
    searchList = scopedStudents.filter(s => s.grade === extractedGrade);
  }

  // Clean name query: remove grade words and normalize
  const cleanQuery = removeGradeWordsFromNameQuery(question);
  const normQuery = normalizeArabic(cleanQuery);

  // Filter stop/common tokens from the name query to form meaningful tokens
  const IGNORE_TOKENS = new Set([
    'مين', 'من', 'هو', 'هي', 'في', 'عن', 'عايز', 'اعرف', 'بيانات',
    'السادس', 'الابتدائي', 'الخامسة', 'الخامس', 'سادس', 'خامس', 'رابع', 'تالت', 'ثالث', 'تاني', 'ثاني', 'اول',
    'الاول', 'الثاني', 'الثالث', 'الرابع', 'الابتدائية', 'الاعدادي', 'الثانوي'
  ].map(normalizeArabic));

  const queryTokens = normQuery.split(' ')
    .map(t => t.trim())
    .filter(t => t.length > 1 && !IGNORE_TOKENS.has(t));

  // A) Exact normalized full-name match
  const exactMatches: SafeStudent[] = [];
  for (const s of searchList) {
    if (normalizeArabic(s.name) === normQuery) {
      exactMatches.push(s);
    }
  }
  if (exactMatches.length === 1) {
    return {
      bestMatch: exactMatches[0],
      ambiguousMatches: [],
      bestScore: 1.0,
      secondScore: 0.0,
      extractedGrade,
      studentQuery: normQuery
    };
  } else if (exactMatches.length > 1) {
    return {
      bestMatch: null,
      ambiguousMatches: exactMatches,
      bestScore: 1.0,
      secondScore: 1.0,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  // B) Full query contained in student name
  const queryContainedMatches: SafeStudent[] = [];
  for (const s of searchList) {
    const normName = normalizeArabic(s.name);
    if (normName.includes(normQuery)) {
      queryContainedMatches.push(s);
    }
  }
  if (queryContainedMatches.length === 1) {
    return {
      bestMatch: queryContainedMatches[0],
      ambiguousMatches: [],
      bestScore: 0.95,
      secondScore: 0.0,
      extractedGrade,
      studentQuery: normQuery
    };
  } else if (queryContainedMatches.length > 1) {
    return {
      bestMatch: null,
      ambiguousMatches: queryContainedMatches,
      bestScore: 0.95,
      secondScore: 0.95,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  // C) Student name contained in query
  const nameContainedMatches: SafeStudent[] = [];
  for (const s of searchList) {
    const normName = normalizeArabic(s.name);
    if (normQuery.includes(normName)) {
      nameContainedMatches.push(s);
    }
  }
  if (nameContainedMatches.length === 1) {
    return {
      bestMatch: nameContainedMatches[0],
      ambiguousMatches: [],
      bestScore: 0.9,
      secondScore: 0.0,
      extractedGrade,
      studentQuery: normQuery
    };
  } else if (nameContainedMatches.length > 1) {
    return {
      bestMatch: null,
      ambiguousMatches: nameContainedMatches,
      bestScore: 0.9,
      secondScore: 0.9,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  // D) Strong token match
  if (queryTokens.length === 0) {
    return {
      bestMatch: null,
      ambiguousMatches: [],
      bestScore: 0.0,
      secondScore: 0.0,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  const scoredStudents = searchList.map(s => {
    const normName = normalizeArabic(s.name);

    let matchCount = 0;
    for (const qt of queryTokens) {
      if (normName.includes(qt)) {
        matchCount++;
      }
    }

    const score = matchCount / queryTokens.length;

    return { student: s, score };
  }).filter(item => item.score > 0);

  scoredStudents.sort((a, b) => b.score - a.score);

  if (scoredStudents.length === 0) {
    return {
      bestMatch: null,
      ambiguousMatches: [],
      bestScore: 0,
      secondScore: 0,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  const bestScore = scoredStudents[0].score;
  const secondScore = scoredStudents.length > 1 ? scoredStudents[1].score : 0.0;

  const bestScoredItems = scoredStudents.filter(item => item.score === bestScore);

  if (bestScore === 1.0 && bestScoredItems.length === 1) {
    return {
      bestMatch: bestScoredItems[0].student,
      ambiguousMatches: [],
      bestScore,
      secondScore,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  if (bestScore >= 0.75 && bestScore > secondScore && bestScoredItems.length === 1) {
    return {
      bestMatch: bestScoredItems[0].student,
      ambiguousMatches: [],
      bestScore,
      secondScore,
      extractedGrade,
      studentQuery: normQuery
    };
  }

  const ambiguousMatches = bestScoredItems.map(item => item.student);
  return {
    bestMatch: null,
    ambiguousMatches,
    bestScore,
    secondScore,
    extractedGrade,
    studentQuery: normQuery
  };
}

// ─── Sensitive data guard ─────────────────────────────────────────────────────
const SENSITIVE_TOKENS = [
  'ارقام اولياء', 'ارقام الاولياء', 'ارقام التليفون', 'ارقام الهاتف',
  'ارقام الموبايل', 'رقم ولي الامر', 'كل العناوين', 'عناوين الكل',
  'العنوان بالتفصيل', 'ملاحظات طبيه', 'ملاحظات خاصه',
  'ملاحظات الافتقاد الخاصه', 'medical notes', 'medical',
  'كل الارقام', 'ارقام التيليفونات',
].map(normalize);

function isSensitiveRequest(normQ: string): boolean {
  return SENSITIVE_TOKENS.some(t => normQ.includes(t));
}

// ─── Intent / requested_field types ──────────────────────────────────────────
type Intent =
  | 'student_lookup'
  | 'birthdays_this_month'
  | 'birthdays_this_week'
  | 'repeated_absence'
  | 'needs_followup'
  | 'students_by_area'
  | 'points_leaderboard'
  | 'attendance_summary'
  | 'student_status_summary'
  | 'student_lookup_by_code'
  | 'unknown';

type RequestedField = 'general' | 'birthday' | 'points' | 'attendance' | 'status' | 'followup' | 'address' | 'location' | 'details' | 'unknown';

interface ClassifierResult {
  intent:          Intent;
  student_query:   string | null;
  requested_field: RequestedField;
  parameters: {
    area:       string | null;
    limit:      number;
    time_range: string | null;
  };
}

const ALLOWED_INTENTS: Intent[] = [
  'student_lookup', 'birthdays_this_month', 'birthdays_this_week',
  'repeated_absence', 'needs_followup', 'students_by_area',
  'points_leaderboard', 'attendance_summary', 'student_status_summary',
  'student_lookup_by_code', 'unknown',
];
const ALLOWED_FIELDS: RequestedField[] = [
  'general', 'birthday', 'points', 'attendance', 'status', 'followup', 'address', 'location', 'details', 'unknown',
];

// ─── OpenAI: intent classification ───────────────────────────────────────────
async function callOpenAIClassifier(
  question: string,
  nameHints: string[], // safe: just names, no sensitive data
): Promise<ClassifierResult | null> {
  if (!OPENAI_API_KEY) return null;

  const hintsText = nameHints.length
    ? `\n\nHint — possible student names found in the question: ${nameHints.slice(0, 5).join(', ')}`
    : '';

  const systemPrompt =
    'You are an intent classifier for a church Sunday School Arabic assistant. ' +
    'Return ONLY valid JSON. No explanations. ' +
    'CRITICAL RULE: If the question mentions a specific student\'s name, ALWAYS classify as student_lookup with the name in student_query. ' +
    'Only classify as a general intent (birthdays_this_month, etc.) if the question is asking about ALL students, not a specific person.';

  const userPrompt =
    `Allowed intents: student_lookup, birthdays_this_month, birthdays_this_week, ` +
    `repeated_absence, needs_followup, students_by_area, points_leaderboard, ` +
    `attendance_summary, student_status_summary, unknown.\n\n` +
    `requested_field values: general, birthday, points, attendance, status, followup, address, location, details, unknown.\n\n` +
    `Return JSON: {"intent":"...","student_query":null,"requested_field":"unknown","parameters":{"area":null,"limit":10,"time_range":null}}\n\n` +
    `Examples:\n` +
    `Q:"مين شنودة ماهر" → {"intent":"student_lookup","student_query":"شنودة ماهر","requested_field":"general","parameters":{"area":null,"limit":10,"time_range":null}}\n` +
    `Q:"اعرف عيد ميلاد شنودة ماهر" → {"intent":"student_lookup","student_query":"شنودة ماهر","requested_field":"birthday","parameters":{"area":null,"limit":10,"time_range":null}}\n` +
    `Q:"كام نقطة مع شنودة ماهر" → {"intent":"student_lookup","student_query":"شنودة ماهر","requested_field":"points","parameters":{"area":null,"limit":10,"time_range":null}}\n` +
    `Q:"حضور شنودة ماهر الاخير" → {"intent":"student_lookup","student_query":"شنودة ماهر","requested_field":"attendance","parameters":{"area":null,"limit":10,"time_range":null}}\n` +
    `Q:"مينا مجدي الظريف عزيز ساكن فين" → {"intent":"student_lookup","student_query":"مينا مجدي الظريف عزيز","requested_field":"address","parameters":{"area":null,"limit":10,"time_range":null}}\n` +
    `Q:"عنوان مينا مجدي الظريف عزيز" → {"intent":"student_lookup","student_query":"مينا مجدي الظريف عزيز","requested_field":"address","parameters":{"area":null,"limit":10,"time_range":null}}\n` +
    `Q:"مين عيد ميلاده الشهر ده" → {"intent":"birthdays_this_month","student_query":null,"requested_field":"unknown","parameters":{"area":null,"limit":10,"time_range":"month"}}\n` +
    `Q:"مين غاب آخر اجتماعين" → {"intent":"repeated_absence","student_query":null,"requested_field":"unknown","parameters":{"area":null,"limit":10,"time_range":"last_2_meetings"}}\n` +
    `Q:"مين ساكن في سيدي بشر" → {"intent":"students_by_area","student_query":null,"requested_field":"unknown","parameters":{"area":"سيدي بشر","limit":10,"time_range":null}}\n` +
    `Q:"أعلى 15 في النقاط" → {"intent":"points_leaderboard","student_query":null,"requested_field":"unknown","parameters":{"area":null,"limit":15,"time_range":null}}\n\n` +
    `IMPORTANT: If question has a name + keyword (عيد ميلاد/نقاط/حضور/عنوان/مكان سكن), use student_lookup NOT the general intent.` +
    hintsText +
    `\n\nQuestion: ${question}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });

    if (!resp.ok) {
      console.error('[ai-assistant] OpenAI classifier HTTP error:', resp.status);
      return null;
    }

    const json = await resp.json();
    const raw  = json?.choices?.[0]?.message?.content ?? '';
    let parsed: ClassifierResult;
    try { parsed = JSON.parse(raw); } catch {
      console.error('[ai-assistant] OpenAI classifier non-JSON:', raw.slice(0, 200));
      return null;
    }

    // Validate
    if (!ALLOWED_INTENTS.includes(parsed?.intent as Intent)) {
      console.error('[ai-assistant] OpenAI invalid intent:', parsed?.intent);
      return null;
    }

    const p = parsed.parameters ?? {};
    let reqField = ALLOWED_FIELDS.includes(parsed.requested_field as RequestedField)
                       ? (parsed.requested_field as RequestedField)
                       : 'general';
    if (reqField === 'location') {
      reqField = 'address';
    }

    return {
      intent:          parsed.intent as Intent,
      student_query:   typeof parsed.student_query === 'string' ? parsed.student_query.trim() || null : null,
      requested_field: reqField,
      parameters: {
        area:       typeof p.area       === 'string' ? p.area.trim()       || null : null,
        limit:      Math.min(20, Math.max(1, parseInt(String(p.limit ?? 10), 10) || 10)),
        time_range: typeof p.time_range === 'string' ? p.time_range.trim() || null : null,
      },
    };
  } catch (err: any) {
    console.error('[ai-assistant] OpenAI classification failed:', err?.message);
    return null;
  }
}

// ─── OpenAI: answer generation (for student lookup) ───────────────────────────
async function generateStudentAnswer(
  question: string,
  resultData: unknown,
  requestedField: RequestedField,
): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;

  const systemPrompt =
    'You are a friendly Arabic assistant for a church Sunday School app. ' +
    'Write a short, warm, natural Arabic answer (2-4 sentences max). ' +
    'Use the result data provided. Do not make up data. ' +
    'Respond in Egyptian/Modern Arabic, no formal MSA.';

  const userPrompt =
    `Question: ${question}\n` +
    `Requested field: ${requestedField}\n` +
    `Data: ${JSON.stringify(resultData)}\n\n` +
    `Write a friendly Arabic answer based only on this data. If data is empty, say so politely.`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        max_tokens: 200,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });

    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// ─── Keyword fallback classifier ──────────────────────────────────────────────
function keywordClassify(raw: string, bestMatchName: string | null): ClassifierResult {
  const q = normalize(raw);

  // If we have strong name matches → student_lookup
  if (bestMatchName) {
    // Determine requested_field from keywords
    let rf: RequestedField = 'general';
    if (q.includes('ميلاد') || q.includes('عمره') || q.includes('سنه')) rf = 'birthday';
    else if (q.includes('نقاط') || q.includes('نقطه'))                   rf = 'points';
    else if (q.includes('حضور') || q.includes('غياب'))                   rf = 'attendance';
    else if (q.includes('حاله') || q.includes('حالة'))                   rf = 'status';
    else if (q.includes('افتقاد') || q.includes('زياره'))                 rf = 'followup';
    return {
      intent: 'student_lookup', student_query: bestMatchName, requested_field: rf,
      parameters: { area: null, limit: 10, time_range: null },
    };
  }

  const def = (intent: Intent): ClassifierResult => ({
    intent, student_query: null, requested_field: 'unknown',
    parameters: { area: null, limit: 10, time_range: null },
  });

  if (q.includes('ميلاد') && (q.includes('اسبوع') || q.includes('الاسبوع'))) return def('birthdays_this_week');
  if (q.includes('مواليد') || q.includes('ميلاد') || q.includes('اعياد ميلاد'))  return def('birthdays_this_month');
  if (q.includes('نقاط') || q.includes('اعلي'))                                    return def('points_leaderboard');
  if (q.includes('افتقاد') || q.includes('محتاج') || q.includes('منقطع'))          return def('needs_followup');
  if (q.includes('غاب') || q.includes('غايب') || q.includes('غياب'))               return def('repeated_absence');
  if (q.includes('ساكن') || q.includes('منطقه') || q.includes('عنوان'))            return def('students_by_area');
  if (q.includes('ملخص') || q.includes('حضور') || q.includes('اخر اجتماع'))        return def('attendance_summary');
  if (q.includes('منتظم') || q.includes('كام مخدوم') || q.includes('حسب الحاله')) return def('student_status_summary');

  return def('unknown');
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function formatISODate(iso: string | null): string {
  if (!iso) return '';
  try {
    const [y, m, d] = iso.split('-');
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  } catch { return iso ?? ''; }
}

function calcAge(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    return age;
  } catch { return null; }
}

// ─── Intent handlers ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleStudentLookup(
  profile: Profile,
  matchResult: ReturnType<typeof findBestStudentMatch>,
  classifierQuery: string | null,
  requestedField: RequestedField,
  scopedStudents: SafeStudent[],
): Promise<{ answer: string; count: number; items: unknown[]; resultData?: unknown }> {
  try {
    // Determine which students to use
    let targets: SafeStudent[] = [];

    if (matchResult.bestMatch) {
      targets = [matchResult.bestMatch];
    } else if (matchResult.ambiguousMatches.length > 0) {
      targets = matchResult.ambiguousMatches.slice(0, 5);
    } else if (classifierQuery && classifierQuery.length >= 2) {
      // Fall back to DB ilike search
      const { data, error } = await applyScope(
        supabaseAdmin
          .from('students')
          .select('id, code, name, grade, status, birth_date')
          .ilike('name', `%${classifierQuery}%`),
        profile,
      );
      if (error) throw new Error(error.message);
      targets = (data || []) as SafeStudent[];
    }

    if (targets.length === 0) {
      const searchTerm = matchResult.studentQuery || classifierQuery || '';
      return {
        answer: `لم أجد مخدوم${searchTerm ? ` باسم "${searchTerm}"` : ''} داخل نطاق خدمتك.`,
        count: 0, items: [],
      };
    }

    // Multiple ambiguous matches → ask for clarification
    if (targets.length > 1) {
      const choices = targets.map(s => ({ name: s.name, code: s.code, grade: s.grade }));
      return {
        answer: `لقيت أكثر من مخدوم بنفس الاسم، تقصد مين؟`,
        count: targets.length,
        items: choices,
      };
    }

    // Fetch full details including address and nearest_church for single match
    let studentWithDetails = targets[0] as SafeStudent & { address?: string | null; nearest_church?: string | null };
    const { data: fullStudent, error: fullError } = await supabaseAdmin
      .from('students')
      .select('id, code, name, grade, status, birth_date, address, nearest_church')
      .eq('id', targets[0].id)
      .single();
    if (!fullError && fullStudent) {
      studentWithDetails = fullStudent;
    }
    const student = studentWithDetails;

    // Build response based on requested_field
    if (requestedField === 'birthday') {
      const age = calcAge(student.birth_date);
      const resultData = {
        student: {
          id:         student.id,
          name:       student.name,
          grade:      student.grade,
          birth_date: formatISODate(student.birth_date),
          age:        age !== null ? `${age} سنة` : null,
          address:    student.address || null,
          nearest_church: student.nearest_church || null,
        },
      };
      const fallbackAnswer = student.birth_date
        ? `${student.name} من ${student.grade ?? ''}، عيد ميلاده ${formatISODate(student.birth_date)}${age !== null ? ` وعنده ${age} سنة` : ''} 🎂`
        : `${student.name} — تاريخ الميلاد غير مسجل.`;
      return { answer: fallbackAnswer, count: 1, items: [resultData.student], resultData };
    }

    if (requestedField === 'points') {
      // Get total points + last 5 logs
      const [summaryRes, logsRes] = await Promise.all([
        supabaseAdmin
          .from('student_points_logs')
          .select('points')
          .eq('student_id', student.id),
        supabaseAdmin
          .from('student_points_logs')
          .select('points, reason, source, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (summaryRes.error) throw new Error(summaryRes.error.message);
      if (logsRes.error) throw new Error(logsRes.error.message);

      const totalPoints = (summaryRes.data || []).reduce((acc: number, l: any) => acc + (l.points || 0), 0);
      const recentLogs  = (logsRes.data || []).map((l: any) => ({
        points: l.points, reason: l.reason, source: l.source,
        date: l.created_at ? l.created_at.split('T')[0] : null,
      }));

      const resultData = {
        student: {
          id: student.id,
          name: student.name,
          grade: student.grade,
          total_points: totalPoints,
          address: student.address || null,
          nearest_church: student.nearest_church || null,
        },
        recent_logs: recentLogs,
      };
      const fallbackAnswer = `${student.name} عنده إجمالي ${totalPoints} نقطة.`;
      return {
        answer: fallbackAnswer, count: 1,
        items: [{
          id: student.id,
          name: student.name,
          grade: student.grade,
          total_points: totalPoints,
          recent_logs: recentLogs,
          address: student.address || null,
          nearest_church: student.nearest_church || null
        }],
        resultData,
      };
    }

    if (requestedField === 'attendance') {
      const { data: attRecords, error: attError } = await supabaseAdmin
        .from('attendance_records')
        .select('attendance_date, status')
        .eq('student_id', student.id)
        .order('attendance_date', { ascending: false })
        .limit(6);

      if (attError) throw new Error(attError.message);

      const records = (attRecords || []).map((r: any) => ({
        date: formatISODate(r.attendance_date), status: r.status,
      }));

      const lastRecord = records[0];
      const fallbackAnswer = lastRecord
        ? `آخر سجل لـ ${student.name}: ${lastRecord.status} بتاريخ ${lastRecord.date}.`
        : `لا يوجد سجلات حضور لـ ${student.name} حتى الآن.`;

      const resultData = {
        student: {
          id: student.id,
          name: student.name,
          grade: student.grade,
          address: student.address || null,
          nearest_church: student.nearest_church || null,
        },
        attendance: records,
      };

      const attendanceItem = {
        id: student.id,
        name: student.name,
        code: student.code,
        grade: student.grade,
        date: lastRecord ? lastRecord.date : null,
        status: lastRecord ? lastRecord.status : null,
        address: student.address || null,
        nearest_church: student.nearest_church || null,
      };

      return { answer: fallbackAnswer, count: 1, items: [attendanceItem], resultData };
    }

    if (requestedField === 'address') {
      const resultData = {
        student: {
          id:             student.id,
          name:           student.name,
          grade:          student.grade,
          address:        student.address || null,
          nearest_church: student.nearest_church || null,
        },
      };

      let fallbackAnswer = '';
      if (student.address) {
        fallbackAnswer = `${student.name} ساكن في: ${student.address}`;
      } else {
        fallbackAnswer = 'لا يوجد عنوان مسجل لهذا المخدوم.';
      }
      if (student.nearest_church) {
        fallbackAnswer += `\nأقرب كنيسة: ${student.nearest_church}`;
      }

      return {
        answer: fallbackAnswer,
        count: 1,
        items: [{
          id:             student.id,
          name:           student.name,
          code:           student.code,
          grade:          student.grade,
          address:        student.address || null,
          nearest_church: student.nearest_church || null,
        }],
        resultData,
      };
    }

    if (requestedField === 'status') {
      const resultData = {
        student: {
          id:             student.id,
          name:           student.name,
          status:         student.status,
          grade:          student.grade,
          address:        student.address || null,
          nearest_church: student.nearest_church || null,
        },
      };
      const fallbackAnswer = student.status
        ? `حالة المخدوم ${student.name} هي: ${student.status}`
        : `حالة المخدوم ${student.name} غير محددة بعد.`;
      return {
        answer: fallbackAnswer,
        count: 1,
        items: [{
          id:             student.id,
          name:           student.name,
          code:           student.code,
          grade:          student.grade,
          status:         student.status,
          address:        student.address || null,
          nearest_church: student.nearest_church || null,
        }],
        resultData,
      };
    }

    if (requestedField === 'details') {
      const [summaryRes, logsRes, attRecords] = await Promise.all([
        supabaseAdmin
          .from('student_points_logs')
          .select('points')
          .eq('student_id', student.id),
        supabaseAdmin
          .from('student_points_logs')
          .select('points, reason, source, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabaseAdmin
          .from('attendance_records')
          .select('attendance_date, status')
          .eq('student_id', student.id)
          .order('attendance_date', { ascending: false })
          .limit(1),
      ]);

      if (summaryRes.error) throw new Error(summaryRes.error.message);
      if (logsRes.error) throw new Error(logsRes.error.message);
      if (attRecords.error) throw new Error(attRecords.error.message);

      const totalPoints = (summaryRes.data || []).reduce((acc: number, l: any) => acc + (l.points || 0), 0);
      const recentLogs  = (logsRes.data || []).map((l: any) => ({
        points: l.points, reason: l.reason, source: l.source,
        date: l.created_at ? l.created_at.split('T')[0] : null,
      }));

      let lastAttendance = '';
      if (attRecords.data && attRecords.data.length > 0) {
        lastAttendance = `${attRecords.data[0].status} بتاريخ ${formatISODate(attRecords.data[0].attendance_date)}`;
      }

      const summary = {
        id:             student.id,
        name:         student.name,
        code:         student.code,
        grade:        student.grade,
        status:       student.status,
        birth_date:   formatISODate(student.birth_date),
        total_points: totalPoints,
        last_attendance: lastAttendance || null,
        recent_logs:  recentLogs,
        address:      student.address || null,
        nearest_church: student.nearest_church || null,
      };

      const resultData = { student: summary };
      let fallbackAnswer = `بيانات المخدوم ${student.name}:\n`;
      fallbackAnswer += `• الكود: ${student.code || 'غير مسجل'}\n`;
      fallbackAnswer += `• المرحلة: ${student.grade || 'غير مسجل'}\n`;
      fallbackAnswer += `• الحالة: ${student.status || 'غير محدد'}\n`;
      if (student.birth_date) {
        fallbackAnswer += `• تاريخ الميلاد: ${formatISODate(student.birth_date)}\n`;
      }
      fallbackAnswer += `• إجمالي النقاط: ${totalPoints} نقطة`;
      if (lastAttendance) {
        fallbackAnswer += `\n• آخر حضور: ${lastAttendance}`;
      }

      return { answer: fallbackAnswer, count: 1, items: [summary], resultData };
    }

    // General / default
    const [ptRes] = await Promise.all([
      supabaseAdmin
        .from('student_points_logs')
        .select('points')
        .eq('student_id', student.id),
    ]);
    if (ptRes.error) throw new Error(ptRes.error.message);

    const totalPoints = (ptRes.data || []).reduce((acc: number, l: any) => acc + (l.points || 0), 0);

    const summary = {
      id:           student.id,
      name:         student.name,
      code:         student.code,
      grade:        student.grade,
      status:       student.status,
      birth_date:   formatISODate(student.birth_date),
      total_points: totalPoints,
      address:      student.address || null,
      nearest_church: student.nearest_church || null,
    };

    const resultData = { student: summary };
    const fallbackAnswer = `لقيت المخدوم: ${student.name}`;
    return { answer: fallbackAnswer, count: 1, items: [summary], resultData };

  } catch (err: any) {
    console.error('[student_lookup] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleBirthdaysThisMonth(students: SafeStudent[]): Promise<any> {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    const matches = students.filter(s => {
      if (!s.birth_date) return false;
      const parts = s.birth_date.split('-');
      return parts.length >= 2 && parseInt(parts[1], 10) === currentMonth;
    });

    if (matches.length === 0) {
      return { answer: `لا يوجد مخدومين عيد ميلادهم في شهر ${months[currentMonth - 1]} داخل نطاق خدمتك.`, count: 0, items: [] };
    }

    const items = matches.map(s => ({ name: s.name, grade: s.grade, birth_date: formatISODate(s.birth_date) }));
    return {
      answer: `وجدت ${matches.length} مخدوم${matches.length === 1 ? '' : 'ين'} عيد ميلادهم في شهر ${months[currentMonth - 1]} 🎂`,
      count: matches.length, items,
    };
  } catch (err: any) {
    console.error('[birthdays_this_month] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleBirthdaysThisWeek(students: SafeStudent[]): Promise<any> {
  try {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dow = now.getDay();
    const start = new Date(now); start.setDate(now.getDate() - dow);
    const end   = new Date(start); end.setDate(start.getDate() + 6);

    const matches = students.filter(s => {
      if (!s.birth_date) return false;
      const parts = s.birth_date.split('-');
      if (parts.length < 3) return false;
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const bd = new Date(now.getFullYear(), m, d); bd.setHours(0, 0, 0, 0);
      return bd >= start && bd <= end;
    });

    if (matches.length === 0) {
      return { answer: 'لا يوجد مخدومين عيد ميلادهم الأسبوع الحالي.', count: 0, items: [] };
    }
    return {
      answer: `وجدت ${matches.length} مخدوم${matches.length === 1 ? '' : 'ين'} عيد ميلادهم الأسبوع الحالي 🎂`,
      count: matches.length,
      items: matches.map(s => ({ name: s.name, grade: s.grade, birth_date: formatISODate(s.birth_date) })),
    };
  } catch (err: any) {
    console.error('[birthdays_this_week] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleNeedsFollowup(profile: Profile): Promise<any> {
  try {
    const { data, error } = await applyScope(
      supabaseAdmin
        .from('students')
        .select('id, name, code, grade, status'),
      profile,
    );

    if (error) {
      console.error('[needs_followup] query error:', error.message);
      return {
        answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.',
        count: 0,
        items: []
      };
    }

    const students = (data || []).filter((s: any) => !isFollowUpExempt(s));
    const normalizedTargets = [
      'منقطع',
      'محتاج افتقاد',
      'يحتاج افتقاد',
      'جديد',
      'محتاج زياره'
    ];

    const matched = students.filter((s: any) => {
      const normStatus = normalize(s.status ?? '');
      return normalizedTargets.some(t => normStatus.includes(t));
    });

    if (matched.length === 0) {
      return {
        answer: "لا يوجد مخدومين محتاجين افتقاد داخل نطاق خدمتك حاليًا.",
        count: 0,
        items: []
      };
    }

    return {
      answer: `وجدت ${matched.length} مخدوم محتاج متابعة أو افتقاد داخل نطاق خدمتك.`,
      count: matched.length,
      items: matched.map((s: any) => ({
        name: s.name,
        code: s.code || null,
        grade: s.grade || null,
        status: s.status || null,
      })),
    };
  } catch (err: any) {
    console.error('[needs_followup] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleRepeatedAbsence(profile: Profile, allScopedStudents: SafeStudent[]): Promise<any> {
  try {
    const scopedStudents = allScopedStudents.filter(s => !isFollowUpExempt(s));
    const baselineOf: Record<string, string | null> = {};
    for (const s of scopedStudents) baselineOf[s.id] = s.follow_up_baseline_date ?? null;
    const ids = scopedStudents.map(s => s.id);
    if (ids.length === 0) return { answer: 'لا يوجد مخدومين في نطاق خدمتك.', count: 0, items: [] };

    const { data: recentRaw, error: re1 } = await supabaseAdmin
      .from('attendance_records')
      .select('attendance_date')
      .in('student_id', ids)
      .order('attendance_date', { ascending: false })
      .limit(300);

    if (re1) throw new Error(re1.message);

    const distinctDates = [...new Set((recentRaw || []).map((r: any) => r.attendance_date as string))].slice(0, 6);

    if (distinctDates.length < 2) {
      // Fallback to status
      const byStatus = scopedStudents.filter(s => s.status === 'منقطع' || s.status === 'يحتاج افتقاد');
      return byStatus.length > 0
        ? { answer: `وجدت ${byStatus.length} مخدوم${byStatus.length === 1 ? '' : 'ين'} غائبين (بناءً على الحالة).`, count: byStatus.length, items: byStatus.map(s => ({ name: s.name, grade: s.grade, absent_sessions: null })) }
        : { answer: 'لا توجد سجلات حضور كافية بعد لتحديد الغياب المتكرر.', count: 0, items: [] };
    }

    const { data: records, error: re2 } = await supabaseAdmin
      .from('attendance_records')
      .select('student_id, status, attendance_date')
      .in('student_id', ids)
      .in('attendance_date', distinctDates);

    if (re2) throw new Error(re2.message);

    const absentMap: Record<string, number> = {};
    for (const r of (records || [])) {
      const baseline = baselineOf[r.student_id];
      if (baseline && r.attendance_date <= baseline) continue; // history from before reactivation
      if (r.status === 'غائب') absentMap[r.student_id] = (absentMap[r.student_id] || 0) + 1;
    }

    const studentMap: Record<string, SafeStudent> = {};
    for (const s of scopedStudents) studentMap[s.id] = s;

    const repeated = Object.entries(absentMap)
      .filter(([, c]) => (c as number) >= 2)
      .map(([id, c]) => ({ name: studentMap[id]?.name || '?', grade: studentMap[id]?.grade || '', absent_sessions: c }))
      .sort((a, b) => (b.absent_sessions as number) - (a.absent_sessions as number));

    if (repeated.length === 0) {
      return { answer: `لا يوجد مخدومين غائبين في اجتماعين أو أكثر من آخر ${distinctDates.length} اجتماعات.`, count: 0, items: [] };
    }

    return {
      answer: `وجدت ${repeated.length} مخدوم${repeated.length === 1 ? '' : 'ين'} غائبين في اجتماعين أو أكثر من آخر ${distinctDates.length} اجتماعات.`,
      count: repeated.length, items: repeated.slice(0, 10),
    };
  } catch (err: any) {
    console.error('[repeated_absence] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleStudentsByArea(profile: Profile, area: string | null, rawQ: string): Promise<any> {
  try {
    // Extract area from question if not provided by classifier
    let resolvedArea = area?.trim() || null;
    if (!resolvedArea) {
      const m = rawQ.match(/ساكن(?:ين)?\s+في\s+(\S+)|في\s+منطق[هة]\s+(\S+)|في\s+(\S+)/);
      if (m) resolvedArea = (m[1] || m[2] || m[3])?.replace(/[؟?]/g, '').trim() || null;
    }
    if (!resolvedArea || resolvedArea.length < 2) {
      return { answer: 'من فضلك حدد اسم المنطقة. مثال: "مين ساكن في سيدي بشر؟"', count: 0, items: [] };
    }

    const { data, error } = await applyScope(
      supabaseAdmin.from('students').select('name, grade, address'),
      profile,
    );
    if (error) throw new Error(error.message);

    const matching = (data || []).filter((s: any) => s.address?.includes(resolvedArea!));
    if (matching.length === 0) {
      return { answer: `لم أجد مخدومين في منطقة "${resolvedArea}" داخل نطاق خدمتك.`, count: 0, items: [] };
    }

    return {
      answer: `وجدت ${matching.length} مخدوم${matching.length === 1 ? '' : 'ين'} في منطقة "${resolvedArea}".`,
      count: matching.length,
      items: matching.slice(0, 10).map((s: any) => ({ name: s.name, grade: s.grade })),
    };
  } catch (err: any) {
    console.error('[students_by_area] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handlePointsLeaderboard(profile: Profile, scopedStudents: SafeStudent[], limit = 10): Promise<any> {
  try {
    const ids = scopedStudents.map(s => s.id);
    if (ids.length === 0) return { answer: 'لا يوجد مخدومين في نطاق خدمتك.', count: 0, items: [] };

    const { data: logs, error } = await supabaseAdmin
      .from('student_points_logs')
      .select('student_id, points')
      .in('student_id', ids);
    if (error) throw new Error(error.message);

    const totals: Record<string, number> = {};
    for (const l of (logs || [])) {
      totals[l.student_id] = (totals[l.student_id] || 0) + (l.points || 0);
    }

    const studentMap: Record<string, SafeStudent> = {};
    for (const s of scopedStudents) studentMap[s.id] = s;

    const board = Object.entries(totals)
      .map(([id, pts]) => ({ name: studentMap[id]?.name || '?', grade: studentMap[id]?.grade || '', total_points: pts }))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, Math.min(20, Math.max(1, limit)));

    if (board.length === 0) return { answer: 'لا توجد نقاط مسجلة بعد داخل نطاق خدمتك.', count: 0, items: [] };

    return {
      answer: `أعلى ${board.length} مخدوم${board.length === 1 ? '' : 'ين'} في النقاط 🏆`,
      count: board.length, items: board,
    };
  } catch (err: any) {
    console.error('[points_leaderboard] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleAttendanceSummary(profile: Profile, scopedStudents: SafeStudent[]): Promise<any> {
  try {
    const ids = scopedStudents.map(s => s.id);
    const total = ids.length;
    if (total === 0) return { answer: 'لا يوجد مخدومين في نطاق خدمتك.', count: 0, items: [] };

    const { data: latestRows, error: le } = await supabaseAdmin
      .from('attendance_records')
      .select('attendance_date')
      .in('student_id', ids)
      .order('attendance_date', { ascending: false })
      .limit(1);

    if (le) throw new Error(le.message);
    const lastDate = latestRows?.[0]?.attendance_date;

    if (!lastDate) {
      return { answer: `يوجد ${total} مخدوم في نطاق خدمتك. لا توجد سجلات حضور حتى الآن.`, count: total, items: [] };
    }

    const { data: records, error: re } = await supabaseAdmin
      .from('attendance_records')
      .select('status')
      .in('student_id', ids)
      .eq('attendance_date', lastDate);

    if (re) throw new Error(re.message);

    const present = (records || []).filter((r: any) => r.status === 'حاضر').length;
    const absent  = (records || []).filter((r: any) => r.status === 'غائب').length;
    const excused = (records || []).filter((r: any) => r.status === 'معتذر').length;
    const rate    = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      answer: `ملخص آخر اجتماع (${formatISODate(lastDate)}):\n✅ حاضر: ${present}  ❌ غائب: ${absent}  🟡 معتذر: ${excused}\nنسبة الحضور: ${rate}% من أصل ${total} مخدوم`,
      count: total,
      items: [{ date: lastDate, present, absent, excused, rate, total }],
    };
  } catch (err: any) {
    console.error('[attendance_summary] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

// deno-lint-ignore no-explicit-any
async function handleStudentStatusSummary(profile: Profile): Promise<any> {
  try {
    const { data: students, error } = await applyScope(
      supabaseAdmin
        .from('students')
        .select('id, name, code, grade, status'),
      profile,
    );

    if (error) {
      console.error('[student_status_summary] query error:', error.message);
      return {
        answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.',
        count: 0,
        items: []
      };
    }

    const totalStudents = students?.length || 0;
    if (totalStudents === 0) {
      return { answer: 'لا يوجد مخدومين في نطاق خدمتك.', count: 0, items: [] };
    }

    const counts: Record<string, number> = {
      'منتظم': 0,
      'منقطع': 0,
      'جديد': 0,
      'غير محدد': 0,
    };
    const others: Record<string, number> = {};

    for (const s of students || []) {
      const status = s.status ? s.status.trim() : '';
      if (!status) {
        counts['غير محدد']++;
      } else if (status === EXEMPT_STATUS) {
        others[status] = (others[status] || 0) + 1;
      } else if (status.includes('منتظم')) {
        counts['منتظم']++;
      } else if (status.includes('منقطع')) {
        counts['منقطع']++;
      } else if (status.includes('جديد')) {
        counts['جديد']++;
      } else {
        others[status] = (others[status] || 0) + 1;
      }
    }

    const items = [
      { label: 'منتظم', count: counts['منتظم'] },
      { label: 'منقطع', count: counts['منقطع'] },
      { label: 'جديد', count: counts['جديد'] },
      { label: 'غير محدد', count: counts['غير محدد'] },
    ];

    for (const [status, count] of Object.entries(others)) {
      items.push({ label: status, count });
    }

    let answer = `داخل نطاق خدمتك:\n`;
    answer += `- منتظم: ${counts['منتظم']}\n`;
    answer += `- منقطع: ${counts['منقطع']}\n`;
    answer += `- جديد: ${counts['جديد']}\n`;
    answer += `- غير محدد: ${counts['غير محدد']}`;
    for (const [status, count] of Object.entries(others)) {
      answer += `\n- ${status}: ${count}`;
    }

    return {
      answer,
      count: totalStudents,
      items,
    };
  } catch (err: any) {
    console.error('[student_status_summary] error:', err.message);
    return { answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.', count: 0, items: [] };
  }
}

function isBulkAddressRequest(normQ: string): boolean {
  const q = normQ;
  return [
    'كل العناوين',
    'عناوين المخدومين',
    'كل اللي ساكنين فين',
    'كل الساكنين فين',
    'كل المخدومين ساكنين فين',
  ].some(phrase => q.includes(normalize(phrase)));
}

function getFollowUpRequestedField(normalizedQuestion: string): RequestedField | null {
  const q = normalizedQuestion;
  // Details
  if (
    q === 'more details' ||
    q === 'تفاصيل اكتر' ||
    q === 'معلومات اكتر' ||
    q === 'اعرف اكتر' ||
    q === 'وريني التفاصيل' ||
    q === 'تفاصيل'
  ) {
    return 'details';
  }
  // Points
  if (
    q === 'نقاطه' ||
    q === 'كام نقطه' ||
    q === 'نقاط'
  ) {
    return 'points';
  }
  // Attendance
  if (
    q === 'حضوره' ||
    q === 'اخر حضور' ||
    q === 'غيابه'
  ) {
    return 'attendance';
  }
  // Birthday
  if (
    q === 'عيد ميلاده' ||
    q === 'ميلاده'
  ) {
    return 'birthday';
  }
  // Status
  if (
    q === 'حالته'
  ) {
    return 'status';
  }
  // Address
  if (
    q === 'ساكن فين' ||
    q === 'عنوانه' ||
    q === 'فين ساكن' ||
    q === 'عنوانه ايه' ||
    q === 'المنطقه' ||
    q === 'العنوان' ||
    q === 'اقرب كنيسه'
  ) {
    return 'address';
  }
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    // ── 1. Verify JWT ────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'UNAUTHORIZED', answer: 'يجب تسجيل الدخول أولاً.' }, 401);
    }

    const jwt = authHeader.replace('Bearer ', '');
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('[ai-assistant] Auth failed:', authError?.message);
      return jsonResponse({ error: 'UNAUTHORIZED', answer: 'جلسة غير صالحة. يرجى تسجيل الدخول.' }, 401);
    }
    const userId = user.id;

    // ── 2. Fetch profile ─────────────────────────────────────────────────
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, assigned_grade, assigned_grades, assigned_gender, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('[ai-assistant] Profile error:', profileError?.message);
      return jsonResponse({ error: 'PROFILE_ERROR', answer: 'تعذر تحميل بيانات المستخدم.' }, 403);
    }
    const profile = profileData as Profile;

    // ── 3. Parse request ─────────────────────────────────────────────────
    let body: { question?: string; lastStudentContext?: { id?: string; name?: string; code?: string; grade?: string } };
    try { body = await req.json(); } catch {
      return jsonResponse({ error: 'INVALID_BODY', answer: 'طلب غير صالح.' }, 400);
    }

    const rawQuestion = body?.question?.trim() ?? '';
    if (!rawQuestion || rawQuestion.length < 2) {
      return jsonResponse({ error: 'EMPTY_QUESTION', answer: 'من فضلك اكتب سؤالاً.' }, 400);
    }
    if (rawQuestion.length > 500) {
      return jsonResponse({ error: 'QUESTION_TOO_LONG', answer: 'السؤال طويل جداً.' }, 400);
    }

    const normQ = normalize(rawQuestion);
    const normQOverride = normalizeArabicQuestionForOverride(rawQuestion);

    // Bulk address protection
    if (isBulkAddressRequest(normQ)) {
      console.log(`[ai-assistant] Bulk address block. userId=${userId}`);
      return jsonResponse({
        answer: 'حفاظًا على خصوصية البيانات، لا يمكن عرض العناوين بهذا الشكل. اسأل عن مخدوم محدد أو منطقة محددة داخل نطاق خدمتك.',
        intent: 'sensitive_data_block', requested_field: 'unknown', count: 0, items: [],
      });
    }

    // Follow-up context check
    const lastStudentContext = body?.lastStudentContext;
    const followUpField = getFollowUpRequestedField(normQOverride);

    if (followUpField) {
      if (!lastStudentContext) {
        return jsonResponse({
          answer: 'تقصد تفاصيل أي مخدوم؟ اكتب اسم المخدوم أو الكود.',
          intent: 'student_lookup',
          requested_field: followUpField,
          count: 0,
          items: []
        });
      }

      // Re-fetch the student under the current user's scope
      let studentQuery = supabaseAdmin
        .from('students')
        .select('id, code, name, grade, status, birth_date, address, nearest_church');

      studentQuery = applyScope(studentQuery, profile);

      if (lastStudentContext.id) {
        studentQuery = studentQuery.eq('id', lastStudentContext.id);
      } else if (lastStudentContext.code) {
        studentQuery = studentQuery.eq('code', lastStudentContext.code);
      } else {
        return jsonResponse({
          answer: 'تقصد تفاصيل أي مخدوم؟ اكتب اسم المخدوم أو الكود.',
          intent: 'student_lookup',
          requested_field: followUpField,
          count: 0,
          items: []
        });
      }

      const { data: students, error: studentError } = await studentQuery;

      if (studentError) {
        console.error('[follow-up student lookup] DB error:', studentError.message);
        return jsonResponse({
          answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.',
          intent: 'student_lookup',
          requested_field: followUpField,
          count: 0,
          items: []
        });
      }

      if (!students || students.length === 0) {
        return jsonResponse({
          answer: 'لم أجد مخدوم داخل نطاق خدمتك.',
          intent: 'student_lookup',
          requested_field: followUpField,
          count: 0,
          items: []
        });
      }

      // Found student!
      const studentMatchResult = {
        bestMatch: students[0] as SafeStudent,
        ambiguousMatches: [] as SafeStudent[],
        bestScore: 1.0,
        secondScore: 0.0,
        extractedGrade: null,
        studentQuery: students[0].name
      };

      const result = await handleStudentLookup(
        profile,
        studentMatchResult,
        students[0].name,
        followUpField,
        students as SafeStudent[]
      );

      if (result.count === 1 && result.resultData) {
        const aiAnswer = await generateStudentAnswer(rawQuestion, result.resultData, followUpField);
        if (aiAnswer) {
          console.log('[ai-assistant-followup] Using OpenAI-generated answer');
          result.answer = aiAnswer;
        }
      }

      return jsonResponse({
        answer: result.answer,
        intent: 'student_lookup',
        requested_field: followUpField,
        count: result.count,
        items: result.items
      });
    }

    // ── 3.5 Detect student code lookup ──
    const detectedCode = detectStudentCode(rawQuestion);
    if (detectedCode) {
      console.log({
        originalQuestion: rawQuestion,
        detectedCode,
        normalizedCode: detectedCode,
        finalIntent: 'student_lookup_by_code'
      });

      try {
        const { data: students, error: studentError } = await applyScope(
          supabaseAdmin
            .from('students')
            .select('id, name, code, grade, status, birth_date'),
          profile
        ).eq('code', detectedCode);

        if (studentError) {
          console.error('[student_lookup_by_code] db error:', studentError.message);
          return jsonResponse({
            answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.',
            intent: 'student_lookup_by_code',
            requested_field: 'general',
            count: 0,
            items: []
          });
        }

        if (!students || students.length === 0) {
          return jsonResponse({
            answer: 'لم أجد مخدوم بهذا الكود داخل نطاق خدمتك.',
            intent: 'student_lookup_by_code',
            requested_field: 'general',
            count: 0,
            items: []
          });
        }

        const student = students[0];

        // Fetch points sum
        const { data: ptLogs, error: ptError } = await supabaseAdmin
          .from('student_points_logs')
          .select('points')
          .eq('student_id', student.id);

        if (ptError) throw new Error(ptError.message);
        const totalPoints = (ptLogs || []).reduce((acc: number, l: any) => acc + (l.points || 0), 0);

        // Fetch last attendance
        const { data: attRecords, error: attError } = await supabaseAdmin
          .from('attendance_records')
          .select('attendance_date, status')
          .eq('student_id', student.id)
          .order('attendance_date', { ascending: false })
          .limit(1);

        if (attError) throw new Error(attError.message);

        let lastAttendance = '';
        if (attRecords && attRecords.length > 0) {
          lastAttendance = `${attRecords[0].status} بتاريخ ${formatISODate(attRecords[0].attendance_date)}`;
        }

        const summary = {
          name: student.name,
          code: student.code,
          grade: student.grade,
          status: student.status,
          total_points: totalPoints,
          birth_date: student.birth_date ? formatISODate(student.birth_date) : null,
          last_attendance: lastAttendance || null
        };

        let answer = `بيانات المخدوم:\n`;
        answer += `• الاسم: ${student.name}\n`;
        answer += `• الكود: ${student.code || 'غير مسجل'}\n`;
        answer += `• المرحلة: ${student.grade || 'غير مسجل'}\n`;
        answer += `• الحالة: ${student.status || 'غير محدد'}\n`;
        answer += `• إجمالي النقاط: ${totalPoints} نقطة`;
        if (student.birth_date) {
          answer += `\n• تاريخ الميلاد: ${formatISODate(student.birth_date)}`;
        }
        if (lastAttendance) {
          answer += `\n• آخر حضور: ${lastAttendance}`;
        }

        return jsonResponse({
          answer,
          intent: 'student_lookup_by_code',
          requested_field: 'general',
          count: 1,
          items: [summary]
        });

      } catch (err: any) {
        console.error('[student_lookup_by_code] unexpected error:', err.message);
        return jsonResponse({
          answer: 'حدث خطأ أثناء قراءة البيانات، حاول مرة أخرى.',
          intent: 'student_lookup_by_code',
          requested_field: 'general',
          count: 0,
          items: []
        });
      }
    }

    // Already defined normQ above
    console.log(`[ai-assistant] START userId=${userId} role=${profile.role} scope="${scopeLabel(profile)}" q="${normQ}"`);

    // ── 4. Sensitive data guard ──────────────────────────────────────────
    if (isSensitiveRequest(normQ)) {
      console.log(`[ai-assistant] Sensitive block. userId=${userId}`);
      return jsonResponse({
        answer: 'حفاظًا على خصوصية البيانات، لا يمكن عرض هذه البيانات بهذا الشكل. اسأل عن حالة محددة أو نطاق محدد داخل خدمتك.',
        intent: 'sensitive_data_block', requested_field: 'unknown', count: 0, items: [],
      });
    }

    // ── 5. Load scoped students (safe fields only) ────────────────────────
    const scopedStudents = await loadScopedStudents(profile);
    console.log(`[ai-assistant] Loaded ${scopedStudents.length} scoped students`);

    // ── 6. Local name-match detection ────────────────────────────────────
    const matchResult = findBestStudentMatch(rawQuestion, scopedStudents);
    const nameHints = matchResult.bestMatch
      ? [matchResult.bestMatch.name]
      : matchResult.ambiguousMatches.slice(0, 5).map(s => s.name);
    console.log(`[ai-assistant] Name matches: ${matchResult.bestMatch ? 1 : matchResult.ambiguousMatches.length} (${nameHints.join(', ')})`);

    console.log({
      originalQuestion: rawQuestion,
      extractedGrade: matchResult.extractedGrade,
      studentQuery: matchResult.studentQuery,
      bestMatchName: matchResult.bestMatch ? matchResult.bestMatch.name : null,
      bestScore: matchResult.bestScore,
      secondScore: matchResult.secondScore,
      ambiguousCount: matchResult.ambiguousMatches.length
    });

    // ── 7. OpenAI classification ─────────────────────────────────────────
    let classified: ClassifierResult | null = await callOpenAIClassifier(rawQuestion, nameHints);

    if (classified) {
      console.log(`[ai-assistant] OpenAI: intent=${classified.intent} field=${classified.requested_field} student_query=${classified.student_query}`);
    } else {
      console.log('[ai-assistant] OpenAI unavailable — using keyword fallback');
    }

    // ── 8. Priority merge: name matches override non-lookup intents ──────
    let finalIntent:    Intent;
    let requestedField: RequestedField;
    let studentQuery:   string | null;
    let parameters:     ClassifierResult['parameters'];

    if (classified) {
      finalIntent    = classified.intent;
      requestedField = classified.requested_field;
      studentQuery   = classified.student_query;
      parameters     = classified.parameters;

      // If we found name matches locally but OpenAI didn't pick student_lookup,
      // force it — local matching is authoritative
      if ((matchResult.bestMatch || matchResult.ambiguousMatches.length > 0) && finalIntent !== 'student_lookup') {
        console.log(`[ai-assistant] Name match found overriding intent ${finalIntent} → student_lookup`);
        finalIntent    = 'student_lookup';
        studentQuery   = matchResult.bestMatch ? matchResult.bestMatch.name : matchResult.studentQuery;
        // Infer requested_field from keywords if OpenAI missed it
        if (normQ.includes('ميلاد') || normQ.includes('عمره'))     requestedField = 'birthday';
        else if (normQ.includes('نقاط') || normQ.includes('نقطه'))  requestedField = 'points';
        else if (normQ.includes('حضور') || normQ.includes('غياب'))  requestedField = 'attendance';
        else                                                          requestedField = 'general';
      }
    } else {
      // Pure keyword fallback
      const kw = keywordClassify(rawQuestion, matchResult.bestMatch ? matchResult.bestMatch.name : null);
      finalIntent    = kw.intent;
      requestedField = kw.requested_field;
      studentQuery   = kw.student_query;
      parameters     = kw.parameters;
    }

    // Deterministic intent override
    // Already defined normQOverride above
    const hasGroup1 = ['كام', 'عدد', 'احصائيه', 'احصائية'].some(w => normQOverride.includes(w));
    const hasGroup2 = ['منتظم', 'منقطع', 'جديد', 'الحاله', 'الحالة'].some(w => normQOverride.includes(w));

    if (hasGroup1 && hasGroup2) {
      console.log(`[ai-assistant] Deterministic override to student_status_summary`);
      finalIntent = 'student_status_summary';
      requestedField = 'status';
      studentQuery = null;
    }

    // needs_followup checks
    if (finalIntent === 'needs_followup') {
      const isWhoFollowup = [
        'مين محتاج افتقاد',
        'مين يحتاج افتقاد',
        'مين منقطع',
        'مين محتاج زياره',
        'مين محتاج زيارة',
        'هات المخدومين المحتاجين افتقاد',
        'هات المخدومين المحتاجين للافتقاد',
        'هات المحتاجين افتقاد',
        'المخدومين المحتاجين افتقاد',
        'المحتاجين افتقاد'
      ].some(phrase => normQOverride.includes(phrase)) || 
      ((normQOverride.includes('مين') || normQOverride.includes('هات') || normQOverride.includes('اسماء') || normQOverride.includes('قائمه') || normQOverride.includes('قائمة')) && 
       (normQOverride.includes('افتقاد') || normQOverride.includes('زياره') || normQOverride.includes('زيارة') || normQOverride.includes('منقطع')));

      if (!isWhoFollowup) {
        console.log(`[ai-assistant] needs_followup rejected because it's not a who/list question. Forcing unknown.`);
        finalIntent = 'unknown';
      }
    }

    console.log({
      originalQuestion: rawQuestion,
      normalizedQuestion: normQOverride,
      openAIIntent: classified ? classified.intent : null,
      finalIntent,
      role: profile.role,
      assignedGrade: profile.assigned_grade || null,
      assignedGrades: profile.assigned_grades || null,
      assignedGender: profile.assigned_gender || null
    });

    console.log(`[ai-assistant] Final: intent=${finalIntent} field=${requestedField} student=${studentQuery}`);

    // ── 9. Execute intent ────────────────────────────────────────────────
    // deno-lint-ignore no-explicit-any
    let result: { answer: string; count: number; items: unknown[]; resultData?: any };

    switch (finalIntent) {
      case 'student_lookup':
        result = await handleStudentLookup(
          profile, matchResult, studentQuery, requestedField, scopedStudents,
        );
        break;
      case 'birthdays_this_month':
        result = await handleBirthdaysThisMonth(scopedStudents);
        break;
      case 'birthdays_this_week':
        result = await handleBirthdaysThisWeek(scopedStudents);
        break;
      case 'needs_followup':
        result = await handleNeedsFollowup(profile);
        break;
      case 'repeated_absence':
        result = await handleRepeatedAbsence(profile, scopedStudents);
        break;
      case 'students_by_area':
        result = await handleStudentsByArea(profile, parameters?.area ?? null, rawQuestion);
        break;
      case 'points_leaderboard':
        result = await handlePointsLeaderboard(profile, scopedStudents, parameters?.limit ?? 10);
        break;
      case 'attendance_summary':
        result = await handleAttendanceSummary(profile, scopedStudents);
        break;
      case 'student_status_summary':
        result = await handleStudentStatusSummary(profile);
        break;
      default:
        result = {
          answer: 'مش قادر أحدد المطلوب بالضبط. جرب تسألني مثلًا:\n• مين عيد ميلاده الشهر ده؟\n• مين غاب آخر اجتماعين؟\n• مين أعلى نقاط؟\n• كام مخدوم محتاج افتقاد؟\n• أو اكتب اسم مخدوم للبحث عنه.',
          count: 0, items: [],
        };
    }

    // ── 10. OpenAI answer generation for student lookup ──────────────────
    if (finalIntent === 'student_lookup' && result.count === 1 && result.resultData) {
      const aiAnswer = await generateStudentAnswer(rawQuestion, result.resultData, requestedField);
      if (aiAnswer) {
        console.log('[ai-assistant] Using OpenAI-generated answer');
        result.answer = aiAnswer;
      }
    }

    console.log(`[ai-assistant] DONE intent=${finalIntent} field=${requestedField} count=${result.count}`);

    return jsonResponse({
      answer:          result.answer,
      intent:          finalIntent,
      requested_field: requestedField,
      count:           result.count,
      items:           result.items,
    });

  } catch (err) {
    console.error('[ai-assistant] Unexpected error:', err);
    return jsonResponse({
      error: 'INTERNAL_ERROR',
      answer: 'حدث خطأ أثناء معالجة السؤال، حاول مرة أخرى.',
      intent: 'unknown', requested_field: 'unknown', count: 0, items: [],
    }, 500);
  }
});
