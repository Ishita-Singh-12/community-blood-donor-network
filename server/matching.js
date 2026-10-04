export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export function distanceKm(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
// Exact-group coordination only. Clinical eligibility is determined by the hospital.
export function matchDonors(donors, request) {
  return donors
    .filter((d) => d.available && d.bloodGroup === request.bloodGroup)
    .map((d) => ({
      ...d,
      distanceKm: Number(distanceKm(d.location, request.location).toFixed(2)),
    }))
    .filter((d) => d.distanceKm <= request.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
}
