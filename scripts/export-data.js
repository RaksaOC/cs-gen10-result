/**
 * Export Gen10 SE + DS annual results to data/*.json for the static site.
 * Run from Telegram Desktop folder (or any cwd with the PDFs + pdf-parse):
 *   node "D:\Development\Projects\gen10-results\scripts\export-data.js"
 */
const fs = require("fs");
const path = require("path");

function loadPdfParse() {
  const candidates = [
    process.env.PDF_PARSE_ROOT,
    path.join("C:\\Users\\pheng\\Downloads\\Telegram Desktop\\node_modules\\pdf-parse"),
    "pdf-parse",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch (_) {
      /* try next */
    }
  }
  throw new Error(
    "Cannot find pdf-parse. Install it or set PDF_PARSE_ROOT / NODE_PATH."
  );
}

const { PDFParse } = loadPdfParse();

const PDF_DIR =
  process.env.PDF_DIR || "C:\\Users\\pheng\\Downloads\\Telegram Desktop";
const OUT_DIR = path.join(__dirname, "..", "data");

/** Prefer `{prefix}_2.pdf`, else newest PDF whose name starts with prefix. */
function resolveLatestPdf(prefix, explicitEnv) {
  if (explicitEnv && fs.existsSync(path.join(PDF_DIR, explicitEnv))) {
    return explicitEnv;
  }
  const preferred = `${prefix}_2.pdf`;
  if (fs.existsSync(path.join(PDF_DIR, preferred))) {
    return preferred;
  }
  const files = fs
    .readdirSync(PDF_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf") && f.startsWith(prefix))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(PDF_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name));
  if (!files.length) {
    throw new Error(`No PDF found in ${PDF_DIR} matching ${prefix}*`);
  }
  return files[0].name;
}

function pdfMeta(fileName) {
  const full = path.join(PDF_DIR, fileName);
  const st = fs.statSync(full);
  return {
    file: fileName,
    sizeBytes: st.size,
    modifiedAt: st.mtime.toISOString(),
  };
}

const SE_SUBJECTS = [
  "Capstone Project I",
  "Fundamental of Game Development",
  "Introduction to Cybersecurity",
  "Fundamental of Mobile Development",
  "Project Management",
  "Capstone Project II",
  "Advanced Mobile Development",
  "Cloud Computing",
  "Fundamentals of Data Science",
  "Soft Skill (Career Readiness)",
  "Internship I",
];

const DS_SUBJECTS = [
  "Capstone Project I",
  "Statistical Data Analysis",
  "Introduction to Cybersecurity",
  "Data Engineering",
  "Data Visualization",
  "Project Management",
  "Capstone Project II",
  "Cloud Computing",
  "Fundamentals of Data Science",
  "Soft Skill (Career Readiness)",
  "Internship I",
];

const SE_LISTS = [
  ["G1-Gen10-SE students.pdf", "G1"],
  ["G2-Gen10-SE students.pdf", "G2"],
  ["G3-Gen10-SE students.pdf", "G3"],
  ["G4-Gen10-SE students.pdf", "G4"],
];

const DS_LISTS = [
  ["G1-Gen10-DS students.pdf", "G1"],
  ["G2-Gen10-DS students.pdf", "G2"],
];

async function pdfText(file) {
  const parser = new PDFParse({
    data: fs.readFileSync(path.join(PDF_DIR, file)),
  });
  return (await parser.getText()).text;
}

function cleanName(name) {
  return name.replace(/\s+/g, " ").trim();
}

function parseStudentList(text, group) {
  const students = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^(\d+)\s+(IDTB\d+)\s+(.+?)\s+([A-Za-z][A-Za-z .'-]+?)\s+([MF])\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+)/
    );
    if (m) {
      students.set(m[2], {
        id: m[2],
        name: cleanName(m[4]),
        gender: m[5],
        dob: m[6],
        contact: m[7],
        group,
      });
      continue;
    }
    const m2 = line.match(
      /(IDTB\d+)\s+(?:.+?\s+)?([A-Z][A-Za-z .'-]{2,}?)\s+([MF])\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+)/
    );
    if (!m2) continue;
    students.set(m2[1], {
      id: m2[1],
      name: cleanName(m2[2]),
      gender: m2[3],
      dob: m2[4],
      contact: m2[5],
      group,
    });
  }
  return students;
}

function classifyStatus(remark) {
  const r = (remark || "").toUpperCase();
  if (r.includes("DROPPED")) return "dropped";
  if (r.includes("SUSPEND")) return "suspend";
  if (r.includes("CHANGE TO DB")) return "change-db";
  if (r.includes("REPEAT YEAR")) return "repeat-year";
  if (r.includes("FAILED")) return "failed";
  if (r.includes("REPEAT 2")) return "repeat-2";
  if (r.includes("REPEAT 1") || r.includes("REPEAT")) return "repeat-1";
  if (r.includes("PASSED")) return "passed";
  return "other";
}

function parseResults(text, subjects) {
  const byId = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\u00a0/g, " ").trim();
    if (!/IDTB\d+/.test(line)) continue;
    const idMatch = line.match(/IDTB\d+/);
    if (!idMatch) continue;
    const id = idMatch[0];
    const after = line.slice(line.indexOf(id) + id.length);
    const pairRe = /(\d+(?:\.\d+)?)\s*(B\+|C\+|A|B|C|D|F)(?!\+)/g;
    const pairs = [];
    let m;
    while ((m = pairRe.exec(after)) !== null) {
      pairs.push({
        score: Number(m[1]).toFixed(2),
        grade: m[2],
        end: pairRe.lastIndex,
      });
    }
    if (pairs.length < 11) continue;
    const subjectPairs = pairs.slice(0, 11);
    const remainder = after.slice(subjectPairs[10].end).trim();
    const tail = remainder.match(
      /^(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(B\+|C\+|A|B|C|D|F)\s*(.*)$/
    );
    if (!tail) continue;
    byId.set(id, {
      id,
      subjects: subjects.map((name, i) => ({
        name,
        score: subjectPairs[i].score,
        grade: subjectPairs[i].grade,
      })),
      overall: Number(tail[1]).toFixed(2),
      rank: Number(tail[2]),
      gpa: Number(tail[3]).toFixed(2),
      grade: tail[4],
      remark: (tail[5] || "").replace(/\s+/g, " ").trim(),
    });
  }
  return byId;
}

function merge(track, lists, resultFile, subjects) {
  return (async () => {
    const roster = new Map();
    for (const [file, group] of lists) {
      const text = await pdfText(file);
      for (const [id, s] of parseStudentList(text, group)) roster.set(id, s);
    }
    const results = parseResults(await pdfText(resultFile), subjects);
    const students = [...results.values()]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => {
        const st = roster.get(r.id);
        return {
          id: r.id,
          track,
          name: st?.name || "Unknown",
          group: st?.group || "—",
          gender: st?.gender || "",
          overall: r.overall,
          rank: r.rank,
          gpa: r.gpa,
          grade: r.grade,
          remark: r.remark,
          status: classifyStatus(r.remark),
          fails: r.subjects.filter((s) => s.grade === "F").length,
          subjects: r.subjects,
        };
      });
    return { track, subjects, students, rosterSize: roster.size };
  })();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sePdf = resolveLatestPdf(
    "Gen10_Year3_SE_Annual_Result",
    process.env.SE_RESULT_PDF
  );
  const dsPdf = resolveLatestPdf(
    "Gen10_Year3_DS_Annual_Result",
    process.env.DS_RESULT_PDF
  );
  const seMeta = pdfMeta(sePdf);
  const dsMeta = pdfMeta(dsPdf);
  console.log("SE result PDF:", seMeta);
  console.log("DS result PDF:", dsMeta);

  const se = await merge("SE", SE_LISTS, sePdf, SE_SUBJECTS);
  const ds = await merge("DS", DS_LISTS, dsPdf, DS_SUBJECTS);

  const payload = {
    meta: {
      title: "Gen10 Year 3 Results",
      year: "2025–2026",
      faculty: "Faculty of Digital Engineering",
      department: "Department of Computer Science",
      generatedAt: new Date().toISOString(),
      sourcePdfs: { SE: seMeta, DS: dsMeta },
    },
    tracks: {
      SE: { label: "Software Engineering", subjects: se.subjects },
      DS: { label: "Data Science", subjects: ds.subjects },
    },
    students: [...se.students, ...ds.students],
  };

  fs.writeFileSync(
    path.join(OUT_DIR, "results.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "se.json"),
    JSON.stringify(se, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(OUT_DIR, "ds.json"),
    JSON.stringify(ds, null, 2),
    "utf8"
  );

  console.log(
    `Wrote ${payload.students.length} students (SE ${se.students.length}, DS ${ds.students.length}) → data/`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
