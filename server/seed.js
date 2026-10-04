import { BLOOD_GROUPS } from "./matching.js";
export const hospitals = [
  {
    id: "h1",
    name: "Marina General Hospital",
    area: "Adyar, Chennai",
    location: { lat: 13.0067, lng: 80.2579 },
  },
  {
    id: "h2",
    name: "Northside Medical Centre",
    area: "T. Nagar, Chennai",
    location: { lat: 13.0418, lng: 80.2341 },
  },
];
export const donors = [
  ["d1", "Ananya Rao", "O+", "Adyar", 13.008, 80.26, true],
  ["d2", "Karthik Raman", "O+", "Besant Nagar", 12.998, 80.266, true],
  ["d3", "Meera Krishnan", "O+", "Thiruvanmiyur", 12.985, 80.259, true],
  ["d4", "Arjun Nair", "O+", "Mylapore", 13.033, 80.268, true],
  ["d5", "Priya Menon", "A+", "Adyar", 13.012, 80.254, true],
  ["d6", "Rahul Das", "B+", "Guindy", 13.008, 80.216, true],
  ["d7", "Diya Shah", "AB+", "T. Nagar", 13.04, 80.234, true],
  ["d8", "Nikhil Sen", "O-", "Adyar", 13.011, 80.258, true],
  ["d9", "Sara Ali", "A-", "Velachery", 12.98, 80.22, true],
  ["d10", "Vikram Rao", "B-", "Mylapore", 13.03, 80.267, true],
  ["d11", "Aisha Khan", "AB-", "Adyar", 13.018, 80.258, true],
  ["d12", "Rohan Iyer", "O+", "Guindy", 13.01, 80.215, false],
  ["d13", "Neha Kumar", "B+", "Besant Nagar", 12.999, 80.262, true],
  ["d14", "Dev Patel", "A+", "Mylapore", 13.028, 80.26, false],
  ["d15", "Tara Roy", "O+", "Tambaram", 12.9249, 80.1, true],
  ["d16", "Ishan Bose", "A+", "T. Nagar", 13.04, 80.232, true],
].map(([id, name, bloodGroup, area, lat, lng, available]) => ({
  id,
  name,
  bloodGroup,
  area,
  location: { lat, lng },
  available,
}));
export const inventory = BLOOD_GROUPS.map((bloodGroup, i) => ({
  bloodGroup,
  units: [18, 5, 14, 3, 8, 2, 6, 1][i],
}));
export function seededRequests() {
  const now = Date.now();
  return [
    {
      id: "REQ-2401",
      hospitalId: "h1",
      bloodGroup: "B+",
      units: 2,
      urgency: "Urgent",
      purpose: "Hospital requirement",
      status: "Open",
      radiusKm: 15,
      createdAt: new Date(now - 25 * 60000),
      acceptedDonors: [],
    },
    {
      id: "REQ-2402",
      hospitalId: "h2",
      bloodGroup: "A+",
      units: 1,
      urgency: "Standard",
      purpose: "Patient requirement",
      status: "Scheduled",
      radiusKm: 15,
      createdAt: new Date(now - 56 * 60000),
      acceptedDonors: ["d16"],
    },
    {
      id: "REQ-2403",
      hospitalId: "h1",
      bloodGroup: "AB-",
      units: 1,
      urgency: "Standard",
      purpose: "Hospital requirement",
      status: "Fulfilled",
      radiusKm: 15,
      createdAt: new Date(now - 120 * 60000),
      acceptedDonors: ["d11"],
    },
  ].map((r) => ({
    ...r,
    location: hospitals.find((h) => h.id === r.hospitalId).location,
  }));
}
