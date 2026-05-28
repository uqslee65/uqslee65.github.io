export interface ContactInfo {
  name: string;
  title: string;
  email: string;
  personalEmail: string;
  phone: string;
  linkedin: string;
  github: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  country: string;
  period: string;
  topics?: string[];
  advisors?: string[];
  thesis?: string;
  grade?: string;
  awards?: string[];
  achievements?: string[];
}

export interface HonoursGroup {
  group: string;
  items: string[];
}

export interface ExperienceEntry {
  role: string;
  organisation: string;
  period: string;
  details: string;
}

export interface ResearchProject {
  title: string;
  organisation: string;
  period: string;
  details: string;
  funded?: boolean;
  supervisors?: string;
  note?: string;
}

export interface VolunteeringEntry {
  role: string;
  organisation: string;
  period: string;
  details: string;
  category?: string;
  bullets?: string[];
}

export interface ThesisEntry {
  title: string;
  degree: string;
  institution: string;
  year: string;
}

export interface ResumeData {
  contact: ContactInfo;
  researchInterests: string[];
  education: EducationEntry[];
  honours: HonoursGroup[];
  financeExperience: ExperienceEntry[];
  researchProjects: ResearchProject[];
  serviceExtracurriculars: ExperienceEntry[];
  volunteering: VolunteeringEntry[];
  thesis: ThesisEntry;
  research: ExperienceEntry[];
  teaching: ExperienceEntry[];
  academicService: ExperienceEntry[];
  skills: string[];
}

export const RESUME: ResumeData = {
  contact: {
    name: "Joshua Lee",
    title: "Finance PhD Student",
    email: "uqslee65@uq.edu.au",
    personalEmail: "lszeray@gmail.com",
    phone: "+61 0493713215",
    linkedin: "https://www.linkedin.com/in/leeszeray/",
    github: "https://github.com/uqslee65",
  },

  researchInterests: [
    "Digital Finance",
    "Data Assets & Markets",
    "Empirical Asset Pricing",
    "Economic Agent Simulations",
    "Fintech",
  ],

  education: [
    {
      degree: "PhD Finance",
      institution: "University of Queensland",
      country: "Australia",
      period: "2026–2029",
      topics: ["Digital Finance", "Data Assets & Markets"],
      advisors: [
        "A/Prof. Min Zhu (UQ)",
        "A/Prof. Zigan Wang (Tsinghua)",
      ],
      awards: ["UQ Graduate School Scholarship (UQGSS)"],
    },
    {
      degree: "BCom (Honours) — 1st Class",
      institution: "University of Queensland",
      country: "Australia",
      period: "2023–2025",
      thesis:
        "Cyber Risk Premium: A Positive-Unlabelled (PU) Machine Learning Approach",
      awards: [
        "UQ International Merit Scholar",
        "Matthew McLennan & Richard Howes Outstanding Honours Collaboration Scholar",
        "Dean's Commendation Sem1 & Sem2 2025",
      ],
    },
    {
      degree: "BCom Information Systems",
      institution: "University of Queensland",
      country: "Australia",
      period: "2023–2024",
      grade: "6.5/7",
      awards: [
        "UQ Business School Valedictorian 2024",
        "Dean's Honour Roll (Top 10%)",
        "UQ Global Connect Scholarship",
        "UQ Summer Research Scholarship 2024",
        "Dean's Commendation Sem1 2024 & Sem2 2023",
        "Employability Award 2024",
      ],
    },
    {
      degree: "Officer Cadet School",
      institution: "SAFTI Military Institute",
      country: "Singapore",
      period: "2021",
      grade: "A (Top 20%)",
      achievements: [
        "Cisco CCNA Intro to Networks",
        "OCS Commandant Coin (Ex. Relentless)",
        "Platoon Best Recruit",
      ],
    },
    {
      degree: "Diploma Financial Informatics",
      institution: "Ngee Ann Polytechnic",
      country: "Singapore",
      period: "2017–2020",
      achievements: [
        "IBF Level 1 (Commercial Banking Tech & Ops)",
        "IMDA iPREP Programme",
        "Edusave Good Progress Award 2020",
        "Edusave Merit Bursary AY2020",
        "SUSS Analytics Visualisation 2019 Finalist",
        "Build On Singapore 2019 Finalist",
        "NP Student Excellence Award 2019",
      ],
    },
    {
      degree: "Chinese Language & Culture",
      institution: "Shanghai University",
      country: "China",
      period: "2018",
    },
  ],

  honours: [
    {
      group: "Academic",
      items: [
        "UQ Valedictorian (2024); Shortlisted Valedictorian (2025)",
        "Dean's Honour Roll & Commendations (2023–2025)",
        "Employability Award",
        "NP Student Excellence Award (2019)",
        "Finalist — AWS Smart Nation BuildOn",
        "Finalist — SUSS Data Visualisation Challenge",
        "IMDA iPREP",
      ],
    },
    {
      group: "Scholarships",
      items: [
        "Graduate School Scholarship (PhD)",
        "Matthew McLennan & Richard Howes Outstanding Honours Scholarship",
        "International Merit Scholarship",
        "Summer Research Scholarship",
        "Global Connect Scholarship",
        "Merit Bursary",
      ],
    },
    {
      group: "Military",
      items: [
        "Military CO Commendation (2022)",
        "Top 20% — Officer Cadet School, Grade A (2021)",
        "Best Ex. Relentless (2021)",
        "Basic Military Platoon Best (2021)",
      ],
    },
  ],

  financeExperience: [
    {
      role: "Corporate Banking Analyst",
      organisation: "China Construction Bank",
      period: "2025",
      details:
        "Credit due diligence on 4× corporate lending transactions. Sector research, macroeconomic assessment, and risk evaluation in support of lending decisions.",
    },
    {
      role: "Project Manager (Lieutenant)",
      organisation: "Singapore Armed Forces",
      period: "2020–2023",
      details:
        "Commissioned officer; led operational and administrative projects across 3 years of national service.",
    },
    {
      role: "Project Manager — Content Media OS",
      organisation: "National Day Parade 2022",
      period: "2022",
      details:
        "Managed content and media operating systems for Singapore's National Day Parade broadcast.",
    },
    {
      role: "Business Analyst",
      organisation: "iWOW Technologies",
      period: "2023",
      details:
        "Requirements analysis and process improvement for IoT-focused technology firm.",
    },
    {
      role: "Business Analyst (R&D)",
      organisation: "Crédit Agricole — Wealth Dynamix",
      period: "2019–2020",
      details:
        "R&D analytics in the wealth management technology division of Crédit Agricole.",
    },
    {
      role: "Analyst — Chatbot Developer",
      organisation: "A-Smart Holdings",
      period: "2019",
      details: "Developed and deployed customer-facing chatbot solutions.",
    },
  ],

  researchProjects: [
    {
      title: "ESG (Indigenous Outcomes) Modelling",
      organisation: "UQ Business School",
      period: "2025–2026",
      details: "Data governance and textual modelling in ASX100 firm Indigenous engagement",
      supervisors: "A/Prof. Jacquelyn Humphrey & A/Prof. Min Zhu",
    },
    {
      title: "Multisource Attention-Conditioned Sentiment on Volatility",
      organisation: "Australian Institute for Business and Economics (AIBE)",
      period: "2025–2026",
      details: "Sentiment attention pressure on post-earnings volatility",
      supervisors: "Prof. Flavio Menezes",
    },
    {
      title: "Cyber Risk Premium with PU Machine Learning",
      organisation: "UQ Business School",
      period: "2025–2026",
      details: "PU methods outperformed supervised benchmark; Fama-MacBeth regressions; H-L portfolio sorts",
      supervisors: "A/Prof. Min Zhu",
      note: "PhD Thesis",
    },
    {
      title: "Portfolio Holdings Disclosure & Index-Hugging",
      organisation: "UQ Business School",
      period: "2025–",
      details: "Portfolios shifted materially; derivative divestment; expect index-hugging",
      supervisors: "A/Prof. Min Zhu",
    },
    {
      title: "Open Banking & Mortgage Rate Dispersion/Refinancing",
      organisation: "UQ Business School",
      period: "2024–2025",
      details: "Loan aggregation products moved usage off-API; increased refinancing",
      supervisors: "A/Prof. Min Zhu",
    },
    {
      title: "Crisis As An Enabler for Rapid Growth of Businesses",
      organisation: "UQ Business School",
      period: "2024",
      details: "doc2vec ML models on cumulative abnormal returns",
      supervisors: "Dr. Karolina Mikolajewska-Zajac",
    },
  ],

  serviceExtracurriculars: [],

  volunteering: [
    {
      role: "President (2025) / Events, Panelist & Presenter (2024)",
      organisation: "UQ Commerce Student Committee",
      period: "2024–2025",
      details: "Committee President for 2025.",
      bullets: [
        "Committee President for 2025",
        "SSP: 100th Anniversary (2025, S2)",
        "SSP: Feedback Mechanisms (2025, S1)",
        "KPMG BIS Major Networking Event",
        "UQBS Commerce T&L Meeting (2025, S1)",
        "UQBS T&L Strategic Directions (2025, S1)",
        "B/MCom Majors Night Panelist (2025, S1)",
        "2025 BCom Orientation Student Presenter",
        "BEL EQUIS Re-accreditation Review 2024",
      ],
    },
    {
      role: "Barista / Coffee Master",
      organisation: "Starbucks Australia",
      period: "2023–2024",
      details:
        "Coffee Master, Barista Trainer & Shift Supervisor (Trainee). Hosted coffee seminars for senior leadership.",
    },
    {
      role: "Barista / Coffee Master",
      organisation: "Starbucks Singapore",
      period: "2020",
      details:
        "Starbucks Coffee Master (Black Apron); completed program in 3 months. Delivered coffee education; increased positive reviews.",
    },
    {
      role: "Volunteer Leader",
      organisation: "People's Association",
      period: "2017–2020",
      details:
        "Lifelong Learning @ Radin Mas: monthly initiative educating elderly on digital literacy, contactless payments, online security.",
    },
    {
      role: "Overall Student Leader",
      organisation: "Purple Parade, Central Singapore CDC",
      period: "2018",
      details:
        "Coordinated 200-person contingent of student volunteers & PwDs for awareness game booth.",
    },
    {
      role: "Logistics & Manpower",
      organisation: "World Vision (NP Initiative)",
      period: "2018",
      details:
        "The Survival Fund: fundraising pop-up booths for disaster-struck countries.",
    },
    {
      role: "Volunteer",
      organisation: "National Youth Council Singapore",
      period: "2017–present",
      details:
        "THK Paddy Project: rice packing & distribution. Thye Hua Kwan IRIR Harmony Nite 2017.",
    },
    {
      role: "Student Coordinator",
      organisation: "Food from the Heart",
      period: "",
      details: "Student volunteer coordination for food distribution.",
    },
    {
      role: "Customer Service / Admin",
      organisation: "Immigration & Checkpoints Authority (ICA)",
      period: "2016–2017",
      details: "Customer service and administrative support.",
    },
  ],

  thesis: {
    title: "Cyber Risk Premium: A Positive-Unlabelled (PU) Machine Learning Approach",
    degree: "BCom (Honours) — 1st Class",
    institution: "University of Queensland",
    year: "2025",
  },

  research: [
    {
      role: "Research Assistant",
      organisation: "UQ Business School",
      period: "2024–present",
      details: "Econometric research in asset pricing and digital finance. Contributes to faculty-led empirical projects across data collection, modelling, and manuscript preparation.",
    },
  ],

  teaching: [
    {
      role: "Teaching Assistant — Portfolio Management",
      organisation: "University of Queensland",
      period: "2025–present",
      details: "Postgraduate. 200+ students across all courses.",
    },
    {
      role: "Teaching Assistant — Corporate Finance",
      organisation: "University of Queensland",
      period: "2025–present",
      details: "Undergraduate.",
    },
    {
      role: "Teaching Assistant — Basic Finance",
      organisation: "University of Queensland",
      period: "2025–present",
      details: "Undergraduate.",
    },
  ],

  academicService: [
    {
      role: "Panel Member — BCom (Hons) Academic Program Review",
      organisation: "University of Queensland",
      period: "2026",
      details: "Student representative on academic program review panel.",
    },
    {
      role: "Organising Secretariat",
      organisation: "FIRN Asset Management Conference",
      period: "2025",
      details: "Informal organising secretariat for the Financial Integrity Research Network conference.",
    },
    {
      role: "Team Lead — Student-Staff Partnerships",
      organisation: "University of Queensland",
      period: "2025",
      details: "Led cross-functional student-staff collaboration projects.",
    },
  ],

  skills: [
    "Python",
    "R",
    "Machine Learning",
    "Econometrics",
    "NLP",
    "LLM Agents",
    "LaTeX",
  ],
};
