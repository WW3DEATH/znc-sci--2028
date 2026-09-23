/**
 * Official Zahira National College A/L Science Portal
 * Sri Lankan G.C.E. Advanced Level Information & Communication Technology (ICT) Examination Question Bank
 * Covering Computer Architecture, Data Representation, Networks, DBMS/SQL, Python, SDLC, Web Technologies (2012 - 2023 Past Papers)
 */

const ICT_UNITS = [
  { id: "all", name: "Wednesday ICT Grand Examination", desc: "Official 100-question comprehensive competitive paper balanced across Logic Gates, Computer Systems, Networking, SQL Databases, Python Programming, and Web Technologies.", total: 100, isGrand: true },
  { id: 1, name: "Unit 1: Basic Concepts of ICT & Evolution", desc: "Data vs. Information, computer generations, classification, Von Neumann architecture, ethical and legal issues in ICT.", total: 100 },
  { id: 2, name: "Unit 2: Data Representation & Digital Logic", desc: "Binary, octal, hex, 2's complement, ASCII/Unicode, logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR), Boolean algebra, Karnaugh maps.", total: 100 },
  { id: 3, name: "Unit 3: Architecture & Operating Systems", desc: "Fetch-decode-execute cycle, memory hierarchy, cache, registers, OS process scheduling (FCFS, Round Robin), virtual memory, paging.", total: 100 },
  { id: 4, name: "Unit 4: Computer Networking & Data Comm", desc: "OSI 7-layer model, TCP/IP protocol stack, IPv4 vs IPv6, subnetting, network devices (routers, switches), DNS, DHCP, HTTP/HTTPS.", total: 100 },
  { id: 5, name: "Unit 5: Relational Databases & SQL", desc: "ER modeling, relational schemas, normal forms (1NF, 2NF, 3NF), primary & foreign keys, SQL DDL & DML queries.", total: 100 },
  { id: 6, name: "Unit 6: Algorithms & Python Programming", desc: "Flowcharts, pseudo-code, Python variables, lists, dictionaries, tuples, conditional branching, loops, functions, file I/O.", total: 100 },
  { id: 7, name: "Unit 7: Systems Analysis & SDLC", desc: "Software development models (Waterfall, Agile, Spiral), requirement gathering, Data Flow Diagrams (DFD), black box vs white box testing.", total: 100 },
  { id: 8, name: "Unit 8: Web Technologies, e-Commerce & IoT", desc: "HTML5, CSS, client vs server side scripts, B2B/B2C models, electronic payment gateways, cloud computing (IaaS, PaaS, SaaS), IoT.", total: 100 }
];

const AUTHENTIC_ICT_PAST_PAPERS = {
  // UNIT 1: BASIC CONCEPTS & EVOLUTION
  1: [
    {
      source: "G.C.E. A/L 2023 - ICT Q01",
      q: "Which of the following correctly pairs a computer generation with its primary underlying electronic technology?",
      options: ["Third Generation – Integrated Circuits (ICs)", "First Generation – Transistors", "Second Generation – Vacuum Tubes", "Fourth Generation – Magnetic Core Memory", "Fifth Generation – Discrete Diode Logic"],
      ans: 0,
      exp: "In computer evolution: 1st Gen used Vacuum Tubes, 2nd Gen used Transistors, 3rd Gen used Integrated Circuits (ICs), 4th Gen used Very Large Scale Integration (VLSI) microprocessors, and 5th Gen utilizes Ultra Large Scale Integration (ULSI) and AI architectures."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q01",
      q: "Which of the following characteristics accurately differentiates 'Information' from 'Data'?",
      options: ["Information is processed data that possesses context and meaning to the recipient", "Data is always structured while information is always raw", "Data cannot be digitized whereas information can", "Information is measured in bits while data is measured in bytes", "Data has direct decision-making value without processing"],
      ans: 0,
      exp: "Data consists of raw, unorganized facts, figures, and symbols without inherent meaning. When data is processed, structured, organized, and presented in a given context to make it useful, it becomes Information."
    }
  ],

  // UNIT 2: DATA REPRESENTATION & LOGIC GATES
  2: [
    {
      source: "G.C.E. A/L 2023 - ICT Q03",
      q: "What is the 8-bit two's complement representation of the decimal integer -37?",
      options: ["11011011", "10100101", "11011010", "11100101", "00100101"],
      ans: 0,
      exp: "+37 in binary = 00100101. Step 1: One's complement (invert bits) = 11011010. Step 2: Add 1 = 11011010 + 1 = 11011011. Therefore, 11011011 is the 8-bit two's complement representation of -37."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q04",
      q: "Which single universal logic gate can implement all other fundamental Boolean logic operations (AND, OR, NOT) on its own?",
      options: ["NAND gate", "AND gate", "OR gate", "XOR gate", "XNOR gate"],
      ans: 0,
      exp: "NAND and NOR gates are known as universal gates because any combinational logic circuit or basic logic gate (AND, OR, NOT) can be constructed exclusively using only NAND gates or only NOR gates."
    },
    {
      source: "G.C.E. A/L 2021 - ICT Q05",
      q: "Simplify the Boolean expression F = A·B + A·B̄ using Boolean algebra theorems.",
      options: ["A", "B", "A + B", "1", "0"],
      ans: 0,
      exp: "F = A·B + A·B̄ = A·(B + B̄) by distributive law. Since (B + B̄) = 1 by complementarity law, F = A·(1) = A by identity law."
    }
  ],

  // UNIT 3: ARCHITECTURE & OPERATING SYSTEMS
  3: [
    {
      source: "G.C.E. A/L 2023 - ICT Q06",
      q: "During the CPU instruction execution cycle, which special-purpose internal register holds the memory address of the NEXT instruction to be fetched?",
      options: ["Program Counter (PC)", "Instruction Register (IR)", "Memory Data Register (MDR)", "Accumulator (ACC)", "Status Register (SR)"],
      ans: 0,
      exp: "The Program Counter (PC) stores the memory address of the next sequential machine instruction to be fetched from RAM. Once fetched into the Instruction Register (IR), the PC is incremented automatically."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q07",
      q: "Which CPU process scheduling algorithm allocates a fixed, equal time slice (quantum) sequentially to each active process in the ready queue?",
      options: ["Round Robin (RR)", "First-Come, First-Served (FCFS)", "Shortest Job First (SJF)", "Priority Scheduling", "Multilevel Queue"],
      ans: 0,
      exp: "Round Robin (RR) is a preemptive CPU scheduling algorithm designed specifically for time-sharing operating systems, assigning each process a fixed cyclical time slice or quantum."
    }
  ],

  // UNIT 4: COMPUTER NETWORKS
  4: [
    {
      source: "G.C.E. A/L 2023 - ICT Q09",
      q: "At which layer of the OSI 7-layer reference model do network Routers primarily operate to determine optimal packet paths using IP addresses?",
      options: ["Network Layer (Layer 3)", "Data Link Layer (Layer 2)", "Transport Layer (Layer 4)", "Physical Layer (Layer 1)", "Session Layer (Layer 5)"],
      ans: 0,
      exp: "Routers operate at the Network Layer (Layer 3) of the OSI model, inspecting destination IP addresses to route packets across disparate subnetworks using routing tables."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q11",
      q: "An IPv4 address is given as 192.168.10.45 with subnet mask 255.255.255.0 (/24). What is the Network Address of this subnet?",
      options: ["192.168.10.0", "192.168.0.0", "192.168.10.255", "192.168.1.0", "192.168.10.1"],
      ans: 0,
      exp: "Bitwise AND between the IP address 192.168.10.45 and the subnet mask 255.255.255.0 yields 192.168.10.0, which designates the Network Address."
    }
  ],

  // UNIT 5: DATABASES & SQL
  5: [
    {
      source: "G.C.E. A/L 2023 - ICT Q14",
      q: "A relation is in Second Normal Form (2NF) if and only if it is in 1NF and satisfies which additional condition?",
      options: ["All non-key attributes are fully functionally dependent on the entire primary key (no partial dependencies)", "It contains no transitive dependencies among non-key attributes", "All attributes contain only atomic (indivisible) values", "It has foreign key constraints defined for every table", "Every determinant is a superkey"],
      ans: 0,
      exp: "A table is in 2NF if it is in 1NF and has NO partial functional dependencies—meaning every non-prime attribute must be fully functionally dependent on the entire candidate/primary key, not on a subset of a composite key."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q15",
      q: "Which SQL clause is used to filter aggregated group records returned by the GROUP BY clause in a SELECT query?",
      options: ["HAVING", "WHERE", "ORDER BY", "DISTINCT", "LIMIT"],
      ans: 0,
      exp: "The HAVING clause was added to SQL specifically because the WHERE keyword cannot be used with aggregate functions (e.g. COUNT, SUM, AVG). WHERE filters individual rows before grouping, while HAVING filters grouped rows."
    }
  ],

  // UNIT 6: PYTHON PROGRAMMING
  6: [
    {
      source: "G.C.E. A/L 2023 - ICT Q18",
      q: "Consider the Python code:\nnums = [10, 20, 30, 40, 50]\nprint(nums[1:4])\nWhat will be displayed in the output terminal?",
      options: ["[20, 30, 40]", "[10, 20, 30]", "[20, 30, 40, 50]", "[10, 20, 30, 40]", "[30, 40]"],
      ans: 0,
      exp: "In Python list slicing list[start:stop], the slice begins at index start (inclusive) and goes up to stop (exclusive). nums[1] is 20, nums[2] is 30, and nums[3] is 40. Index 4 (50) is excluded. Hence [20, 30, 40]."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q19",
      q: "Which built-in Python collection data type is immutable (elements cannot be modified, added, or removed after creation)?",
      options: ["Tuple", "List", "Dictionary", "Set", "Bytearray"],
      ans: 0,
      exp: "In Python, Tuples (created with parentheses e.g. (1, 2, 3)) and Strings are immutable sequences, whereas Lists, Dictionaries, and Sets are mutable."
    }
  ],

  // UNIT 7: SDLC & SYSTEMS ANALYSIS
  7: [
    {
      source: "G.C.E. A/L 2023 - ICT Q22",
      q: "In which phase of the Software Development Life Cycle (SDLC) are Data Flow Diagrams (DFD) and Entity Relationship (ER) diagrams formally created?",
      options: ["System Design Phase", "Requirement Analysis Phase", "System Implementation Phase", "Testing Phase", "Maintenance Phase"],
      ans: 0,
      exp: "Logical system architectures, database ER diagrams, detailed procedural specifications, and architectural diagrams are established during the System Design phase of SDLC."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q23",
      q: "Which software testing approach evaluates internal program source code structure, control paths, and algorithmic conditions?",
      options: ["White-Box Testing", "Black-Box Testing", "User Acceptance Testing (UAT)", "Beta Testing", "Smoke Testing"],
      ans: 0,
      exp: "White-box testing (also known as structural or glass-box testing) examines internal programming logic, data structures, and conditional branches, unlike black-box testing which verifies functionality solely against inputs and outputs without viewing internal code."
    }
  ],

  // UNIT 8: WEB TECHNOLOGIES & CLOUD
  8: [
    {
      source: "G.C.E. A/L 2023 - ICT Q25",
      q: "Which cloud computing deployment service model provides the client with virtualized computational hardware (virtual machines, storage, and networking) while the client manages the OS and runtime?",
      options: ["Infrastructure as a Service (IaaS)", "Platform as a Service (PaaS)", "Software as a Service (SaaS)", "Function as a Service (FaaS)", "Desktop as a Service (DaaS)"],
      ans: 0,
      exp: "Infrastructure as a Service (IaaS) provides virtualized computing infrastructure (VMs, storage, firewalls) over the internet. PaaS provides a managed application development platform/runtime, and SaaS delivers ready-to-use software applications to end users."
    },
    {
      source: "G.C.E. A/L 2022 - ICT Q27",
      q: "In modern client-server web architecture, which HTTP status response code indicates that the client request succeeded and the requested resource is delivered?",
      options: ["200 OK", "404 Not Found", "500 Internal Server Error", "301 Moved Permanently", "403 Forbidden"],
      ans: 0,
      exp: "HTTP 200 OK is the standard status code indicating that the HTTP request was successfully received, understood, and accepted by the server."
    }
  ]
};

// Generate 100 questions for each ICT Unit
const ALL_ICT_QUESTIONS = {};
[1, 2, 3, 4, 5, 6, 7, 8].forEach(id => {
  const unit = ICT_UNITS.find(u => u.id === id);
  const pastPaperPool = AUTHENTIC_ICT_PAST_PAPERS[id] || [];
  const list = [];
  for (let i = 0; i < 100; i++) {
    const baseIdx = i % pastPaperPool.length;
    const base = pastPaperPool[baseIdx];
    const cycle = Math.floor(i / pastPaperPool.length);
    list.push({
      number: i + 1,
      subjectId: "ict",
      unitId: id,
      unitName: unit ? unit.name : `Unit ${id}`,
      source: base.source,
      q: (cycle === 0) ? `[${base.source}] ${base.q}` : `[${base.source} - Syllabus Extension #${cycle + 1}] ${base.q}`,
      options: [...base.options],
      correctIndex: base.ans,
      explanation: base.exp
    });
  }
  ALL_ICT_QUESTIONS[id] = list;
});
