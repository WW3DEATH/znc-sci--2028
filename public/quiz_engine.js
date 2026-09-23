/**
 * Official Zahira National College A/L Science Portal
 * Synchronized Multi-Subject Wednesday Examination Engine
 * Supports: Physics, Combined Mathematics, Chemistry, and ICT
 * 
 * Cryptographically binds all students sitting any subject on Wednesday
 * to the exact same 100 questions using the weekly seed.
 */

const SUBJECTS_DATA = {
  physics: {
    id: "physics",
    name: "Physics",
    shortName: "Physics",
    icon: "bolt",
    emoji: "⚛️",
    color: "maroon",
    bgClass: "bg-maroon",
    textClass: "text-maroon",
    badgeClass: "bg-maroon/10 text-maroon border-maroon/30",
    description: "Sri Lankan G.C.E. A/L Physics: Mechanics, Waves, Thermal, Fields, Electricity, Electronics & Modern Physics.",
    units: (typeof PHYSICS_UNITS !== "undefined") ? PHYSICS_UNITS : [],
    getQuestions: (u) => (typeof ALL_PHYSICS_QUESTIONS !== "undefined" ? ALL_PHYSICS_QUESTIONS[u] : [])
  },
  combined_maths: {
    id: "combined_maths",
    name: "Combined Mathematics",
    shortName: "Combined Maths",
    icon: "calculate",
    emoji: "📐",
    color: "blue",
    bgClass: "bg-blue-600",
    textClass: "text-blue-700",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    description: "Sri Lankan G.C.E. A/L Combined Maths: Pure Maths (Algebra, Trig, Coordinate Geometry, Calculus) and Applied Maths (Statics, Dynamics, Probability).",
    units: (typeof COMBINED_MATHS_UNITS !== "undefined") ? COMBINED_MATHS_UNITS : [],
    getQuestions: (u) => (typeof ALL_COMBINED_MATHS_QUESTIONS !== "undefined" ? ALL_COMBINED_MATHS_QUESTIONS[u] : [])
  },
  chemistry: {
    id: "chemistry",
    name: "Chemistry",
    shortName: "Chemistry",
    icon: "science",
    emoji: "🧪",
    color: "emerald",
    bgClass: "bg-emerald-600",
    textClass: "text-emerald-700",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Sri Lankan G.C.E. A/L Chemistry: General, Physical, Inorganic s/p/d block, and Organic Chemistry reaction mechanisms.",
    units: (typeof CHEMISTRY_UNITS !== "undefined") ? CHEMISTRY_UNITS : [],
    getQuestions: (u) => (typeof ALL_CHEMISTRY_QUESTIONS !== "undefined" ? ALL_CHEMISTRY_QUESTIONS[u] : [])
  },
  ict: {
    id: "ict",
    name: "Information & Communication Technology",
    shortName: "ICT",
    icon: "terminal",
    emoji: "💻",
    color: "indigo",
    bgClass: "bg-indigo-600",
    textClass: "text-indigo-700",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Sri Lankan G.C.E. A/L ICT: Logic Gates, Operating Systems, Networking, SQL Databases, Python Programming, and Web Technologies.",
    units: (typeof ICT_UNITS !== "undefined") ? ICT_UNITS : [],
    getQuestions: (u) => (typeof ALL_ICT_QUESTIONS !== "undefined" ? ALL_ICT_QUESTIONS[u] : [])
  }
};

/**
 * Returns 100 synchronized questions for the Wednesday exam:
 * Signature:
 *   getSynchronizedWednesdayQuestions(subjectId, unitId, weeklySeed)
 * Backward-compatible signature:
 *   getSynchronizedWednesdayQuestions(unitId, weeklySeed) => defaults to 'physics'
 */
function getSynchronizedWednesdayQuestions(arg1, arg2, arg3) {
  let subjectId = "physics";
  let unitId = "all";
  let weeklySeed = 84920194;

  if (arg3 !== undefined) {
    subjectId = arg1 || "physics";
    unitId = arg2 !== undefined ? arg2 : "all";
    weeklySeed = Number(arg3) || 84920194;
  } else if (arg2 !== undefined) {
    if (SUBJECTS_DATA[arg1]) {
      subjectId = arg1;
      unitId = "all";
      weeklySeed = Number(arg2) || 84920194;
    } else {
      // (unitId, weeklySeed)
      subjectId = (window.STATE && window.STATE.selectedSubjectId) ? window.STATE.selectedSubjectId : "physics";
      unitId = arg1;
      weeklySeed = Number(arg2) || 84920194;
    }
  } else if (arg1 !== undefined) {
    unitId = arg1;
    weeklySeed = (window.STATE && window.STATE.wednesdayConfig && window.STATE.wednesdayConfig.seed)
      ? window.STATE.wednesdayConfig.seed
      : 84920194;
  }

  const subject = SUBJECTS_DATA[subjectId] || SUBJECTS_DATA.physics;
  let basePool = [];

  // Subject-specific salt for deterministic shuffling
  const subjectSalt = {
    physics: 10007,
    combined_maths: 29401,
    chemistry: 48197,
    ict: 67399
  }[subjectId] || 11113;

  if (unitId === "all" || unitId === "0" || unitId === 0) {
    // Balanced distribution across all 8 units of the chosen subject
    let unitDistribution = {
      1: 12, 2: 14, 3: 14, 4: 12,
      5: 14, 6: 12, 7: 12, 8: 10
    };

    if (subjectId === "physics") {
      unitDistribution = { 1: 8, 2: 24, 3: 16, 4: 12, 5: 12, 6: 14, 7: 8, 8: 6 };
    } else if (subjectId === "combined_maths") {
      unitDistribution = { 1: 12, 2: 14, 3: 14, 4: 12, 5: 16, 6: 12, 7: 12, 8: 8 };
    } else if (subjectId === "chemistry") {
      unitDistribution = { 1: 10, 2: 12, 3: 14, 4: 12, 5: 14, 6: 14, 7: 12, 8: 12 };
    } else if (subjectId === "ict") {
      unitDistribution = { 1: 10, 2: 14, 3: 14, 4: 14, 5: 14, 6: 16, 7: 10, 8: 8 };
    }

    for (let u = 1; u <= 8; u++) {
      const unitQs = subject.getQuestions(u) || [];
      const count = unitDistribution[u] || 12;
      const shuffledUnitQs = seededShuffle(unitQs, weeklySeed + subjectSalt + u * 17929);
      basePool.push(...shuffledUnitQs.slice(0, count));
    }
  } else {
    const numId = parseInt(unitId, 10) || 1;
    const rawQs = subject.getQuestions(numId) || [];
    basePool = [...rawQs];
  }

  // Shuffle the assembled 100 questions deterministically
  const unitModifier = (typeof unitId === "number" || !isNaN(parseInt(unitId, 10)))
    ? (parseInt(unitId, 10) * 7919)
    : 88843;
  const paperSeed = (weeklySeed + subjectSalt + unitModifier) >>> 0;
  const randomizedQuestions = seededShuffle(basePool, paperSeed);

  // Take exactly 100 questions
  const final100 = randomizedQuestions.slice(0, 100);

  const subCode = subjectId.toUpperCase().replace("_", "").substring(0, 4);

  return final100.map((q, idx) => {
    return {
      ...q,
      subjectId: subjectId,
      subjectName: subject.name,
      displayNumber: idx + 1,
      paperCode: `WED-${subCode}-${weeklySeed}`
    };
  });
}
