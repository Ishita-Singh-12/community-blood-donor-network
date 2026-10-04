import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, matchDonors } from "../server/matching.js";
import { donors, hospitals } from "../server/seed.js";
const request = {
  bloodGroup: "O+",
  location: hospitals[0].location,
  radiusKm: 15,
};
test("Haversine: zero, symmetry, and known one-degree distance", () => {
  assert.equal(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Math.abs(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.195) <
      0.01,
  );
  assert.equal(
    distanceKm({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }),
    distanceKm({ lat: 3, lng: 4 }, { lat: 1, lng: 2 }),
  );
});
test("Only available exact-group donors in range, ordered nearest-first", () => {
  const matches = matchDonors(donors, request);
  assert.deepEqual(
    matches.map((d) => d.id),
    ["d1", "d2", "d3", "d4"],
  );
  assert.ok(
    matches.every((d, i) => !i || d.distanceKm >= matches[i - 1].distanceKm),
  );
  assert.ok(!matches.some((d) => ["d12", "d15", "d8"].includes(d.id)));
});
test("Radius and no-match boundaries", () => {
  assert.equal(matchDonors(donors, { ...request, radiusKm: 0 }).length, 0);
  assert.deepEqual(
    matchDonors(donors, { ...request, radiusKm: 0.5 }).map((d) => d.id),
    ["d1"],
  );
  assert.deepEqual(matchDonors([], { ...request }), []);
});
test("Matching does not mutate donor records", () => {
  const before = JSON.stringify(donors);
  matchDonors(donors, request);
  assert.equal(JSON.stringify(donors), before);
});
