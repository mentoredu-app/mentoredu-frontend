export interface TeacherProfileDetails {
  universities: string;
  specialty: string;
  courses: string;
  experience: string;
  summary: string;
}

type TeacherProfileKey = keyof TeacherProfileDetails;

const FIELD_DEFINITIONS: Array<{ key: TeacherProfileKey; label: string }> = [
  { key: 'universities', label: 'Universidades' },
  { key: 'specialty', label: 'Especialidad' },
  { key: 'courses', label: 'Cursos' },
  { key: 'experience', label: 'Experiencia' },
  { key: 'summary', label: 'Resumen profesional' },
];

export const TEACHER_PROFILE_MAX_LENGTH = 2000;

export function emptyTeacherProfileDetails(): TeacherProfileDetails {
  return {
    universities: '',
    specialty: '',
    courses: '',
    experience: '',
    summary: '',
  };
}

export function parseTeacherProfileDetails(value?: string | null): TeacherProfileDetails {
  const details = emptyTeacherProfileDetails();
  const raw = (value ?? '').trim();
  if (!raw) return details;

  const labelToKey = new Map(
    FIELD_DEFINITIONS.map(field => [field.label.toLowerCase(), field.key])
  );

  let currentKey: TeacherProfileKey | null = null;
  let foundStructuredField = false;
  const legacyLines: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'MentorEdu perfil docente') continue;

    const labelMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    const nextKey = labelMatch ? labelToKey.get(labelMatch[1].trim().toLowerCase()) ?? null : null;

    if (nextKey) {
      currentKey = nextKey;
      foundStructuredField = true;
      if (labelMatch?.[2]) {
        details[currentKey] = appendLine(details[currentKey], labelMatch[2].trim());
      }
      continue;
    }

    if (currentKey) {
      details[currentKey] = appendLine(details[currentKey], trimmed);
    } else {
      legacyLines.push(trimmed);
    }
  }

  if (!foundStructuredField) {
    details.summary = raw;
  } else if (legacyLines.length > 0) {
    details.summary = appendLine(details.summary, legacyLines.join('\n'));
  }

  return details;
}

export function toTeacherProfileDetails(value?: Partial<TeacherProfileDetails> & { bioProfessional?: string | null } | null): TeacherProfileDetails {
  const details = parseTeacherProfileDetails(value?.bioProfessional);
  if (!value) return details;

  return {
    universities: value.universities?.trim() || details.universities,
    specialty: value.specialty?.trim() || details.specialty,
    courses: value.courses?.trim() || details.courses,
    experience: value.experience?.trim() || details.experience,
    summary: value.summary?.trim() || details.summary,
  };
}

export function buildTeacherProfileBio(details: TeacherProfileDetails): string | undefined {
  const sections = FIELD_DEFINITIONS
    .map(field => ({
      label: field.label,
      value: details[field.key].trim(),
    }))
    .filter(section => section.value.length > 0);

  if (sections.length === 0) return undefined;

  return [
    'MentorEdu perfil docente',
    '',
    ...sections.map(section => `${section.label}:\n${section.value}`),
  ].join('\n\n');
}

export function hasTeacherProfileDetails(details: TeacherProfileDetails | null): boolean {
  if (!details) return false;
  return Object.values(details).some(value => value.trim().length > 0);
}

function appendLine(current: string, next: string): string {
  return current ? `${current}\n${next}` : next;
}
