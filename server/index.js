import express from "express";
import http from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { BLOOD_GROUPS } from "./matching.js";
import { hospitals, donors, inventory, seededRequests } from "./seed.js";

const donorSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    name: String,
    bloodGroup: String,
    area: String,
    location: { lat: Number, lng: Number },
    available: Boolean,
  },
  { versionKey: false },
);
const requestSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true },
    hospitalId: String,
    bloodGroup: String,
    units: Number,
    urgency: String,
    purpose: String,
    status: String,
    radiusKm: Number,
    location: { lat: Number, lng: Number },
    createdAt: Date,
    acceptedDonors: [String],
  },
  { versionKey: false },
);
const Donor = mongoose.model("Donor", donorSchema);
const Request = mongoose.model("Request", requestSchema);
const Inventory = mongoose.model(
  "Inventory",
  new mongoose.Schema(
    { bloodGroup: { type: String, unique: true }, units: Number },
    { versionKey: false },
  ),
);
let memory;
if (!process.env.MONGODB_URI)
  memory = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
await mongoose.connect(
  process.env.MONGODB_URI || memory.getUri("blood_donor_network"),
);
if ((await Donor.countDocuments()) === 0) {
  await Donor.insertMany(donors);
  await Inventory.insertMany(inventory);
  await Request.insertMany(seededRequests());
}
const app = express(),
  server = http.createServer(app),
  io = new Server(server);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
const clean = (list) => list.map(({ _id, ...r }) => r);
async function state() {
  return {
    donors: clean(await Donor.find().lean()),
    hospitals,
    inventory: clean(await Inventory.find().lean()),
    requests: clean(await Request.find().sort({ createdAt: -1 }).lean()),
    demo: true,
  };
}
async function broadcast() {
  io.emit("state:update", await state());
}
const route = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const requestInput = z
  .object({
    hospitalId: z.enum(["h1", "h2"]),
    bloodGroup: z.enum(BLOOD_GROUPS),
    units: z.number().int().min(1).max(10),
    urgency: z.enum(["Urgent", "Standard"]),
    purpose: z.enum(["Hospital requirement", "Patient requirement"]),
    radiusKm: z.number().min(1).max(50),
  })
  .strict();
app.get("/api/health", (_, res) =>
  res.json({
    ok: true,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    demo: true,
  }),
);
app.get(
  "/api/state",
  route(async (_, res) => res.json(await state())),
);
app.use(express.static(path.resolve("dist")));
app.get("*", (req, res) =>
  req.path.startsWith("/api")
    ? res.status(404).json({ error: "Endpoint not found" })
    : res.sendFile(path.resolve("dist/index.html")),
);
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError)
    return res.status(400).json({
      error: "Please check the submitted values.",
      details: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  console.error(err);
  res.status(err.status === 400 ? 400 : 500).json({
    error:
      err.status === 400
        ? "Invalid JSON"
        : "Something went wrong. Please try again.",
  });
});
server.listen(
  Number(process.env.PORT || 4173),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Blood Donor Network running at http://127.0.0.1:${process.env.PORT || 4173} (MongoDB connected; demo data)`,
    ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    io.close();
    server.close();
    await mongoose.disconnect();
    await memory?.stop();
    process.exit(0);
  });
