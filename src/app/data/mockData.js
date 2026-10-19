export const foundingMembers = [
  {
    id: "1",
    name: "Dr. John Kamau",
    role: "Co-Founder & First Chairman",
    bio:
      "Visionary leader who initiated the KAH Alumni concept, bringing together like-minded medical professionals for collective financial growth.",
    joinDate: "2018-03-15"
  },
  {
    id: "2",
    name: "Dr. Mary Wanjiku",
    role: "Co-Founder & Pioneer Secretary",
    bio:
      "Instrumental in establishing the organizational structure and documentation systems that guide KAH Alumni today.",
    joinDate: "2018-03-15"
  },
  {
    id: "3",
    name: "Dr. Peter Omondi",
    role: "Founding Treasurer",
    bio:
      "Financial architect who designed the contribution and lending framework that has enabled member prosperity.",
    joinDate: "2018-03-15"
  },
  {
    id: "4",
    name: "Dr. Grace Muthoni",
    role: "Founding Member",
    bio:
      "Dedicated member whose commitment to the group's values has inspired many to join the KAH Alumni family.",
    joinDate: "2018-03-15"
  },
  {
    id: "5",
    name: "Dr. David Kipchoge",
    role: "Founding Member",
    bio:
      "Strong advocate for member welfare and transparent governance within the organization.",
    joinDate: "2018-03-15"
  },
  {
    id: "6",
    name: "Dr. Sarah Akinyi",
    role: "Founding Member",
    bio:
      "Passionate about community building and has been key in growing the KAH Alumni membership base.",
    joinDate: "2018-03-15"
  }
]

export const members = [
  {
    id: "1",
    name: "Dr. John Kamau",
    email: "john.kamau@email.com",
    phone: "+254 712 345 678",
    joinDate: "2018-03-15",
    status: "compliant",
    totalContributions: 432000,
    outstandingLoan: 0,
    membershipNumber: "KAH-001"
  },
  {
    id: "2",
    name: "Dr. Mary Wanjiku",
    email: "mary.w@email.com",
    phone: "+254 723 456 789",
    joinDate: "2018-03-15",
    status: "compliant",
    totalContributions: 432000,
    outstandingLoan: 50000,
    membershipNumber: "KAH-002"
  },
  {
    id: "3",
    name: "Dr. Peter Omondi",
    email: "peter.o@email.com",
    phone: "+254 734 567 890",
    joinDate: "2018-06-20",
    status: "pending",
    totalContributions: 414000,
    outstandingLoan: 0,
    membershipNumber: "KAH-003"
  },
  {
    id: "4",
    name: "Dr. Grace Muthoni",
    email: "grace.m@email.com",
    phone: "+254 745 678 901",
    joinDate: "2018-09-10",
    status: "compliant",
    totalContributions: 396000,
    outstandingLoan: 100000,
    membershipNumber: "KAH-004"
  },
  {
    id: "5",
    name: "Dr. David Kipchoge",
    email: "david.k@email.com",
    phone: "+254 756 789 012",
    joinDate: "2019-01-05",
    status: "overdue",
    totalContributions: 360000,
    outstandingLoan: 75000,
    membershipNumber: "KAH-005"
  },
  {
    id: "6",
    name: "Dr. Sarah Akinyi",
    email: "sarah.a@email.com",
    phone: "+254 767 890 123",
    joinDate: "2019-04-18",
    status: "compliant",
    totalContributions: 342000,
    outstandingLoan: 0,
    membershipNumber: "KAH-006"
  },
  {
    id: "7",
    name: "Dr. James Mutua",
    email: "james.m@email.com",
    phone: "+254 778 901 234",
    joinDate: "2019-07-22",
    status: "compliant",
    totalContributions: 324000,
    outstandingLoan: 150000,
    membershipNumber: "KAH-007"
  },
  {
    id: "8",
    name: "Dr. Alice Njeri",
    email: "alice.n@email.com",
    phone: "+254 789 012 345",
    joinDate: "2020-02-14",
    status: "pending",
    totalContributions: 288000,
    outstandingLoan: 0,
    membershipNumber: "KAH-008"
  }
]

export const contributions = [
  {
    id: "1",
    memberId: "1",
    memberName: "Dr. John Kamau",
    amount: 6000,
    date: "2024-01-05",
    month: "January 2024",
    status: "paid",
    paymentMethod: "M-Pesa"
  },
  {
    id: "2",
    memberId: "2",
    memberName: "Dr. Mary Wanjiku",
    amount: 6000,
    date: "2024-01-03",
    month: "January 2024",
    status: "paid",
    paymentMethod: "Bank Transfer"
  },
  {
    id: "3",
    memberId: "3",
    memberName: "Dr. Peter Omondi",
    amount: 6000,
    date: "2024-01-08",
    month: "January 2024",
    status: "paid",
    paymentMethod: "M-Pesa"
  },
  {
    id: "4",
    memberId: "4",
    memberName: "Dr. Grace Muthoni",
    amount: 6000,
    date: "2024-01-02",
    month: "January 2024",
    status: "paid",
    paymentMethod: "M-Pesa"
  },
  {
    id: "5",
    memberId: "5",
    memberName: "Dr. David Kipchoge",
    amount: 6000,
    date: "",
    month: "January 2024",
    status: "overdue",
    paymentMethod: ""
  },
  {
    id: "6",
    memberId: "6",
    memberName: "Dr. Sarah Akinyi",
    amount: 6000,
    date: "2024-01-04",
    month: "January 2024",
    status: "paid",
    paymentMethod: "Bank Transfer"
  },
  {
    id: "7",
    memberId: "7",
    memberName: "Dr. James Mutua",
    amount: 6000,
    date: "2024-01-06",
    month: "January 2024",
    status: "paid",
    paymentMethod: "M-Pesa"
  },
  {
    id: "8",
    memberId: "8",
    memberName: "Dr. Alice Njeri",
    amount: 6000,
    date: "",
    month: "January 2024",
    status: "pending",
    paymentMethod: ""
  }
]

export const loans = [
  {
    id: "1",
    memberId: "2",
    memberName: "Dr. Mary Wanjiku",
    amount: 100000,
    interestRate: 10,
    disbursementDate: "2023-10-15",
    dueDate: "2024-10-15",
    status: "active",
    balance: 50000,
    monthlyPayment: 9167
  },
  {
    id: "2",
    memberId: "4",
    memberName: "Dr. Grace Muthoni",
    amount: 200000,
    interestRate: 10,
    disbursementDate: "2023-08-20",
    dueDate: "2024-08-20",
    status: "active",
    balance: 100000,
    monthlyPayment: 18333
  },
  {
    id: "3",
    memberId: "5",
    memberName: "Dr. David Kipchoge",
    amount: 150000,
    interestRate: 10,
    disbursementDate: "2023-06-10",
    dueDate: "2024-06-10",
    status: "overdue",
    balance: 75000,
    monthlyPayment: 13750
  },
  {
    id: "4",
    memberId: "7",
    memberName: "Dr. James Mutua",
    amount: 250000,
    interestRate: 10,
    disbursementDate: "2023-11-01",
    dueDate: "2024-11-01",
    status: "active",
    balance: 150000,
    monthlyPayment: 22917
  },
  {
    id: "5",
    memberId: "1",
    memberName: "Dr. John Kamau",
    amount: 180000,
    interestRate: 10,
    disbursementDate: "2022-05-15",
    dueDate: "2023-05-15",
    status: "paid",
    balance: 0,
    monthlyPayment: 16500
  }
]

export const leaders = [
  {
    id: "1",
    name: "Dr. John Kamau",
    position: "Chairman",
    term: "2024 - 2026",
    graduationYear: "2010",
    joinDate: "2018-03-15",
    specialization: "General Surgery",
    currentRole: "Consultant Surgeon, Kenyatta National Hospital"
  },
  {
    id: "2",
    name: "Dr. Mary Wanjiku",
    position: "Vice Chairman",
    term: "2024 - 2026",
    graduationYear: "2011",
    joinDate: "2018-03-15",
    specialization: "Pediatrics",
    currentRole: "Pediatric Specialist, Nairobi Hospital"
  },
  {
    id: "3",
    name: "Dr. Grace Muthoni",
    position: "Secretary",
    term: "2024 - 2026",
    graduationYear: "2012",
    joinDate: "2018-09-10",
    specialization: "Internal Medicine",
    currentRole: "Internist, Aga Khan University Hospital"
  },
  {
    id: "4",
    name: "Dr. Peter Omondi",
    position: "Treasurer",
    term: "2024 - 2026",
    graduationYear: "2009",
    joinDate: "2018-06-20",
    specialization: "Anesthesiology",
    currentRole: "Chief Anesthesiologist, MP Shah Hospital"
  }
]

export const testimonials = [
  {
    id: "1",
    name: "Dr. Sarah Akinyi",
    graduationYear: "2013",
    joinDate: "2019-04-18",
    specialization: "Obstetrics & Gynecology",
    quote:
      "Joining KAH Alumni was one of the best decisions I made. The financial support through loans helped me establish my private practice, and the network of fellow medical professionals has been invaluable for my career growth."
  },
  {
    id: "2",
    name: "Dr. James Mutua",
    graduationYear: "2014",
    joinDate: "2019-07-22",
    specialization: "Emergency Medicine",
    quote:
      "The structured savings plan and access to affordable loans have given me financial stability. More importantly, the sense of community among KASMS alumni keeps our medical school bonds strong."
  },
  {
    id: "3",
    name: "Dr. Alice Njeri",
    graduationYear: "2015",
    joinDate: "2020-02-14",
    specialization: "Dermatology",
    quote:
      "As a newer member, I appreciate how welcoming and supportive the KAH Alumni community is. The mentorship from senior members has been incredible for my professional development."
  }
]

export const upcomingEvents = [
  {
    id: "1",
    title: "Annual General Meeting - June Edition",
    date: "2024-06-15",
    time: "09:00 AM - 04:00 PM",
    location: "Sarova Stanley Hotel, Nairobi",
    type: "hybrid",
    description:
      "Bi-annual general meeting to review financial performance, approve new members, and discuss investment opportunities."
  },
  {
    id: "2",
    title: "Annual General Meeting - December Edition",
    date: "2024-12-14",
    time: "09:00 AM - 04:00 PM",
    location: "Radisson Blu, Upper Hill",
    type: "hybrid",
    description:
      "Year-end meeting featuring annual reports, dividend announcements, and leadership elections."
  },
  {
    id: "3",
    title: "Medical Professionals Networking Dinner",
    date: "2024-08-24",
    time: "06:00 PM - 10:00 PM",
    location: "Villa Rosa Kempinski, Nairobi",
    type: "physical",
    description:
      "An exclusive networking event for members to connect, share experiences, and explore collaboration opportunities."
  }
]

export const membershipCategories = [
  {
    id: "1",
    title: "Full Members",
    description:
      "Alumni of Kendu Adventist School of Medical Sciences who have completed the probation period and been approved by two-thirds vote.",
    privileges: [
      "Full voting rights in all meetings",
      "Eligible to hold office positions",
      "Access to full loan amounts",
      "Dividend distribution rights",
      "Voice in investment decisions"
    ],
    color: "primary"
  },
  {
    id: "2",
    title: "Associate Members",
    description:
      "Spouses and adult children of full members. Limited to not more than 20% of total membership.",
    privileges: [
      "Attend meetings as observers",
      "Access to limited loan facilities",
      "Participate in social events",
      "No voting rights",
      "Cannot hold office"
    ],
    color: "secondary"
  },
  {
    id: "3",
    title: "Probationary Members",
    description:
      "New applicants undergoing a mandatory six-month evaluation period before full membership approval.",
    privileges: [
      "Attend meetings as observers",
      "Begin contribution payments",
      "Access mentorship programs",
      "Cannot vote or apply for loans",
      "Subject to membership review"
    ],
    color: "muted"
  }
]

export const monthlyStats = [
  { month: "Jan", contributions: 48000, loans: 100000 },
  { month: "Feb", contributions: 48000, loans: 50000 },
  { month: "Mar", contributions: 42000, loans: 150000 },
  { month: "Apr", contributions: 48000, loans: 0 },
  { month: "May", contributions: 48000, loans: 200000 },
  { month: "Jun", contributions: 48000, loans: 75000 },
  { month: "Jul", contributions: 42000, loans: 0 },
  { month: "Aug", contributions: 48000, loans: 100000 },
  { month: "Sep", contributions: 48000, loans: 50000 },
  { month: "Oct", contributions: 48000, loans: 250000 },
  { month: "Nov", contributions: 42000, loans: 0 },
  { month: "Dec", contributions: 48000, loans: 100000 }
]

export const complianceStats = {
  compliant: 5,
  pending: 2,
  overdue: 1
}

export const summaryStats = {
  totalMembers: 100,
  shareCapital: 100000,
  annualMeetings: 2,
  yearsActive: 6,
  totalContributions: 2988000,
  activeLoans: 4,
  loanBalance: 375000,
  monthlyTarget: 48000,
  collectionRate: 87.5
}
