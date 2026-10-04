import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
async function api(path, method = "GET", body) {
  const r = await fetch(`${base}/api${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const input = {
  hospitalId: "h1",
  bloodGroup: "O+",
  units: 2,
  urgency: "Urgent",
  purpose: "Hospital requirement",
  radiusKm: 15,
};
function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      5000,
    );
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}
async function donorSocket(id) {
  const socket = io(base, { transports: ["websocket"], forceNew: true });
  await once(socket, "connect");
  await new Promise((resolve) => socket.emit("donor:join", id, resolve));
  return socket;
}
test("MongoDB health and populated state", async () => {
  const health = await api("/health");
  assert.equal(health.data.database, "connected");
  const state = await api("/state");
  assert.equal(state.data.donors.length, 16);
  assert.equal(state.data.inventory.length, 8);
  assert.equal(state.data.hospitals.length, 2);
});
test("Request validation rejects bad groups, counts, hospital, extra fields and invalid JSON", async () => {
  for (const change of [
    { bloodGroup: "bad" },
    { units: 0 },
    { units: 1.5 },
    { hospitalId: "unknown" },
    { radiusKm: 100 },
    { patientName: "private data" },
  ])
    assert.equal(
      (await api("/requests", "POST", { ...input, ...change })).status,
      400,
    );
  const r = await fetch(base + "/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad",
  });
  assert.equal(r.status, 400);
});
test("Socket.IO targets matching donors only and publishes nearest-first matches", async () => {
  const yes = await donorSocket("d1"),
    no = await donorSocket("d5");
  try {
    let wrong = false;
    no.on("donor:alert", () => (wrong = true));
    const event = once(yes, "donor:alert"),
      updated = once(yes, "state:update");
    const created = await api("/requests", "POST", input);
    assert.equal(created.status, 201);
    assert.deepEqual(
      created.data.matches.map((d) => d.id),
      ["d1", "d2", "d3", "d4"],
    );
    const alert = await event;
    assert.equal(alert.rank, 1);
    assert.equal(alert.request.id, created.data.request.id);
    assert.ok((await updated).requests.some((r) => r.id === alert.request.id));
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(wrong, false);
    const saved = await api(`/requests/${alert.request.id}/matches`);
    assert.deepEqual(
      saved.data.map((d) => d.id),
      ["d1", "d2", "d3", "d4"],
    );
  } finally {
    yes.close();
    no.close();
  }
});
test("Acceptance rejects mismatches, duplicate responses, overbooking, and closed requests", async () => {
  const created = await api("/requests", "POST", { ...input, units: 1 });
  const id = created.data.request.id;
  assert.equal(
    (await api(`/requests/${id}/accept`, "POST", { donorId: "d5" })).status,
    409,
  );
  assert.equal(
    (await api(`/requests/${id}/accept`, "POST", { donorId: "d12" })).status,
    409,
  );
  assert.equal(
    (await api(`/requests/${id}/accept`, "POST", { donorId: "d15" })).status,
    409,
  );
  const results = await Promise.all(
    ["d1", "d2"].map((donorId) =>
      api(`/requests/${id}/accept`, "POST", { donorId }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const saved = (await api("/state")).data.requests.find((r) => r.id === id);
  assert.equal(saved.acceptedDonors.length, 1);
  assert.equal(saved.status, "Scheduled");
  assert.equal(
    (
      await api(`/requests/${id}/accept`, "POST", {
        donorId: saved.acceptedDonors[0],
      })
    ).status,
    409,
  );
  assert.equal(
    (await api(`/requests/${id}/status`, "PATCH", { status: "Fulfilled" }))
      .status,
    200,
  );
  assert.equal(
    (await api(`/requests/${id}/accept`, "POST", { donorId: "d3" })).status,
    409,
  );
  assert.equal(
    (await api(`/requests/${id}/status`, "PATCH", { status: "Cancelled" }))
      .status,
    409,
  );
});
test("Availability and inventory updates persist and broadcast to another connected client", async () => {
  const socket = await donorSocket("d1");
  try {
    let next = once(socket, "state:update");
    assert.equal(
      (await api("/donors/d1", "PATCH", { available: false })).status,
      200,
    );
    assert.equal(
      (await next).donors.find((d) => d.id === "d1").available,
      false,
    );
    assert.equal(
      (await api("/donors/d1", "PATCH", { available: true })).status,
      200,
    );
    next = once(socket, "state:update");
    assert.equal(
      (await api("/inventory/O%2B", "PATCH", { units: 9 })).status,
      200,
    );
    assert.equal(
      (await next).inventory.find((i) => i.bloodGroup === "O+").units,
      9,
    );
    assert.equal(
      (await api("/inventory/O%2B", "PATCH", { units: -1 })).status,
      400,
    );
    await api("/inventory/O%2B", "PATCH", { units: 6 });
    assert.equal(
      (await api("/donors/nope", "PATCH", { available: true })).status,
      404,
    );
  } finally {
    socket.close();
  }
});

test("Hosted API CORS permits only the configured frontend origin", async () => {
  const allowed = await fetch(base + "/api/health", {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:5173",
  );
  const other = await fetch(base + "/api/health", {
    headers: { Origin: "https://unrelated.invalid" },
  });
  assert.notEqual(
    other.headers.get("access-control-allow-origin"),
    "https://unrelated.invalid",
  );
  const preflight = await fetch(base + "/api/requests", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.status, 204);
  assert.ok(
    preflight.headers.get("access-control-allow-methods").includes("POST"),
  );
});
