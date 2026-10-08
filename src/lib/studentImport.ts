/**
 * Turning a spreadsheet of students into rows this app can store.
 *
 * Client-safe (no database, no zlib) so the admin screen and the API agree on
 * the columns, the validation and the wording of every problem.
 *
 * Matching is by email: a student who already exists is updated, a new email is
 * created. Blank cells never wipe what's already on record — leave a column out
 * and it stays as it is.
 */

export type StudentImportRow = {
  name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  location: string | null;
  notes: string | null;
};

export type RowOutcome = {
  /** 1-based row number in the sheet, so the admin can find it. */
  line: number;
  data: StudentImportRow | null;
  /** Why this row can't be imported. */
  error: string | null;
  /** Set once we know whether this email already exists. */
  action?: "create" | "update" | "skip";
};

/**
 * Column headings we accept, in several spellings — admins export from all
 * sorts of places. Compared lower-case with spaces and punctuation stripped.
 */
const FIELD_ALIASES: Record<keyof StudentImportRow, string[]> = {
  name: ["name", "fullname", "studentname", "student", "firstname", "namn"],
  email: ["email", "emailaddress", "emailid", "mail", "epost"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber", "telefon"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday", "fodelsedatum"],
  gender: ["gender", "sex", "kon"],
  city: ["city", "town", "stad", "ort"],
  country: ["country", "land"],
  location: ["location", "studio", "homestudio", "studiolocation", "branch"],
  notes: ["notes", "note", "comment", "comments", "remark", "remarks"],
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const REQUIRED_HEADINGS = ["Name", "Email"];

/** The headings the template is written with, in order. */
export const TEMPLATE_COLUMNS: { key: keyof StudentImportRow; label: string; hint: string }[] = [
  { key: "name", label: "Name", hint: "Required — the student's full name" },
  { key: "email", label: "Email", hint: "Required — used to match existing students" },
  { key: "phone", label: "Phone", hint: "e.g. +46 70 123 45 67" },
  { key: "dob", label: "Date of Birth", hint: "YYYY-MM-DD, or a real date cell" },
  { key: "gender", label: "Gender", hint: "Female / Male / Non-binary / Prefer not to say" },
  { key: "city", label: "City", hint: "" },
  { key: "country", label: "Country", hint: "" },
  { key: "location", label: "Location", hint: "Home studio, e.g. Stockholm" },
  { key: "notes", label: "Notes", hint: "Anything the studio should know" },
];

/** Maps the sheet's heading row onto our fields. Unknown columns are ignored. */
export function mapHeadings(headings: string[]) {
  const index = {} as Record<keyof StudentImportRow, number>;
  for (const key of Object.keys(FIELD_ALIASES) as (keyof StudentImportRow)[]) index[key] = -1;

  headings.forEach((heading, i) => {
    const h = normalise(heading);
    if (!h) return;
    for (const [key, aliases] of Object.entries(FIELD_ALIASES) as [keyof StudentImportRow, string[]][]) {
      if (index[key] === -1 && aliases.includes(h)) index[key] = i;
    }
  });
  return index;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "15/03/1998", "1998-03-15", "15 Mar 1998" → "1998-03-15", else null. */
export function toIsoDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy (day first — the European convention this studio uses)
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(v)) return parsed.toISOString().slice(0, 10);
  return null;
}

const clean = (v: string | undefined) => (v ?? "").trim();
const orNull = (v: string | undefined) => clean(v) || null;

/**
 * Validates one sheet row. `line` is the row number shown to the admin.
 * Returns an error string instead of throwing, so one bad row doesn't stop the
 * rest of the file.
 */
export function parseRow(cells: string[], index: Record<keyof StudentImportRow, number>, line: number): RowOutcome {
  const at = (key: keyof StudentImportRow) => (index[key] >= 0 ? cells[index[key]] : undefined);

  const name = clean(at("name"));
  const email = clean(at("email")).toLowerCase();

  if (!name && !email) return { line, data: null, error: "Empty row" };
  if (!name) return { line, data: null, error: "Name is missing" };
  if (!email) return { line, data: null, error: "Email is missing" };
  if (!EMAIL_RE.test(email)) return { line, data: null, error: `"${email}" isn't a valid email address` };

  const dobRaw = clean(at("dob"));
  const dob = dobRaw ? toIsoDate(dobRaw) : null;
  if (dobRaw && !dob) {
    return { line, data: null, error: `Date of birth "${dobRaw}" isn't a date we recognise — use YYYY-MM-DD` };
  }
  if (dob && dob > new Date().toISOString().slice(0, 10)) {
    return { line, data: null, error: `Date of birth ${dob} is in the future` };
  }

  return {
    line,
    data: {
      name,
      email,
      phone: orNull(at("phone")),
      dob,
      gender: orNull(at("gender")),
      city: orNull(at("city")),
      country: orNull(at("country")),
      location: orNull(at("location")),
      notes: orNull(at("notes")),
    },
    error: null,
  };
}

/**
 * Reads a whole sheet: finds the heading row, then validates every row under
 * it. Duplicate emails inside the file are flagged rather than imported twice.
 */
export function parseStudentSheet(grid: string[][]): { rows: RowOutcome[]; headingLine: number } {
  // The heading row is the first one that names both required columns — so a
  // title line above the table doesn't break the import.
  let headingLine = -1;
  let index: Record<keyof StudentImportRow, number> | null = null;
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const candidate = mapHeadings(grid[i]);
    if (candidate.name >= 0 && candidate.email >= 0) {
      headingLine = i;
      index = candidate;
      break;
    }
  }
  if (!index) {
    throw new Error(
      'Couldn\'t find the heading row. The sheet needs a row with "Name" and "Email" columns — download the template to see the format.'
    );
  }

  const rows: RowOutcome[] = [];
  const seen = new Map<string, number>();
  for (let i = headingLine + 1; i < grid.length; i++) {
    const row = parseRow(grid[i], index, i + 1);
    if (row.error === "Empty row") continue;
    if (row.data) {
      const first = seen.get(row.data.email);
      if (first) {
        rows.push({ line: row.line, data: null, error: `${row.data.email} is already on row ${first} of this file` });
        continue;
      }
      seen.set(row.data.email, row.line);
    }
    rows.push(row);
  }
  return { rows, headingLine: headingLine + 1 };
}
