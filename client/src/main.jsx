import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  Droplet,
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  HeartHandshake,
  Plus,
  ArrowUpRight,
  MapPin,
  Bell,
  Check,
  ChevronRight,
  Search,
  Radio,
  Activity,
  X,
  ShieldCheck,
  Clock,
  Building2,
} from "lucide-react";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./style.css";
import {Account,Workflow} from "./Account.jsx";
const apiOrigin = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const socket = io(apiOrigin || undefined,{autoConnect:false,withCredentials:true});
async function api(path, method = "GET", body) {
  const res = await fetch(`${apiOrigin}/api${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "The backend is not responding. Check its deployment URL and try again.",
    );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function distance(a, b) {
  const r = (n) => (n * Math.PI) / 180,
    h =
      Math.sin(r(b.lat - a.lat) / 2) ** 2 +
      Math.cos(r(a.lat)) *
        Math.cos(r(b.lat)) *
        Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
function App() {
  const [user,setUser]=useState(undefined),[isDemo,setIsDemo]=useState(false);
  const [data, setData] = useState(null),
    [page, setPage] = useState("Overview"),
    [connected, setConnected] = useState(socket.connected),
    [modal, setModal] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [group, setGroup] = useState("All groups"),
    [donorId, setDonorId] = useState("d1"),
    [alerts, setAlerts] = useState([]),
    [focusRequest, setFocusRequest] = useState(null),
    [lastUpdated, setLastUpdated] = useState(new Date());
  useEffect(()=>{api("/auth/me").then(r=>{setUser(r.user);setIsDemo(r.demo);}).catch(e=>setError(e.message));},[]);
  useEffect(() => {
    if(!user)return;socket.connect();setPage(user.role==="donor"?"Donor portal":"Overview");if(user.donorId)setDonorId(user.donorId);
    setConnected(socket.connected);
    api("/state")
      .then(setData)
      .catch((e) => setError(e.message));
    const update = (d) => {
      setData(d);
      setLastUpdated(new Date());
    };
    const connect = () => {
      setConnected(true);
      api("/state")
        .then(update)
        .catch((e) => setError(e.message));
    };
    const disconnect = () => setConnected(false);
    const alert = (a) => setAlerts((prev) => [a, ...prev]);
    const activity = (a) => setToast(a.message);
    socket.on("state:update", update);
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("donor:alert", alert);
    socket.on("activity", activity);
    return () => {
      socket.off("state:update", update);
      socket.off("connect", connect);
      socket.off("disconnect", disconnect);
      socket.off("donor:alert", alert);
      socket.off("activity", activity);socket.disconnect();
    };
  }, [user]);
  useEffect(() => {
    const join = () => socket.emit("donor:join", donorId);
    join();
    socket.on("connect", join);
    setAlerts([]);
    return () => socket.off("connect", join);
  }, [donorId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!modal && !focusRequest) return;
    const previous = document.activeElement;
    const dialog = document.querySelector("[role=dialog]");
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
      );
    focusable()[0]?.focus();
    const handle = (e) => {
      if (e.key === "Escape") {
        setModal(false);
        setFocusRequest(null);
      }
      if (e.key === "Tab") {
        const all = focusable(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modal, focusRequest]);
  const action = async (path, method, body) => {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if(user===null)return <Account api={api} demo={isDemo} onSignedIn={setUser}/>;
  if (!data)
    return (
      <div className="loading">
        <Droplet size={42} />
        <h1>LifeLink</h1>
        <p>{error || "Connecting to your community..."}</p>
        {error && (
          <button
            className="primary"
            onClick={() => {
              setError("");
              api("/state")
                .then(setData)
                .catch((e) => setError(e.message));
            }}
          >
            Try again
          </button>
        )}
      </div>
    );
  const available = data.donors.filter((d) => d.available),
    open = data.requests.filter((r) =>
      ["Open", "Scheduled"].includes(r.status),
    ),
    stock = data.inventory.reduce((n, i) => n + i.units, 0),
    donor = data.donors.find((d) => d.id === donorId)||{id:"",name:"Coordinator",bloodGroup:"",area:"",available:false,location:{lat:0,lng:0}};
  const filtered = data.donors.filter(
    (d) =>
      (group === "All groups" || d.bloodGroup === group) &&
      `${d.name} ${d.area}`.toLowerCase().includes(search.toLowerCase()),
  );
  const nav = (user.role==="donor"?[["Donor portal",HeartHandshake],["Appointments",Clock]]:user.role==="admin"?[["Overview",LayoutDashboard],["Institution approvals",Building2]]:[
    ["Overview", LayoutDashboard],
    ["Donor directory", Users],
    ["Blood requests", ClipboardList],
    ["Blood inventory", Package],
    ["Appointments",Clock],
  ]);
  const hospital = (id) => data.hospitals.find((h) => h.id === id);
  const badge = (status) => (
    <span className={`badge ${status.toLowerCase()}`}>
      {status === "Open" && <i />}
      {status}
    </span>
  );
  function RequestsTable({ all = false }) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Request / hospital</th>
              <th>Blood group</th>
              <th>Needed</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Response</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(all ? data.requests : data.requests.slice(0, 4)).map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{hospital(r.hospitalId).name}</strong>
                  <small>
                    {r.id} · {r.purpose}
                  </small>
                </td>
                <td>
                  <span className="blood-tag">{r.bloodGroup}</span>
                </td>
                <td>
                  {r.units} {r.units === 1 ? "unit" : "units"}
                </td>
                <td>
                  <span
                    className={`priority ${r.urgency === "Urgent" ? "red" : ""}`}
                  >
                    {r.urgency === "Urgent" && <span>●</span>} {r.urgency}
                  </span>
                </td>
                <td>{badge(r.status)}</td>
                <td>
                  <strong>
                    {r.acceptedDonors.length}/{r.units}
                  </strong>
                  <small>donors confirmed</small>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${r.id}`}
                    onClick={() => setFocusRequest(r)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  function Inventory({ editable = false }) {
    return (
      <div className="blood-grid">
        {data.inventory.map((i) => (
          <div
            className={`blood-card ${i.units <= 3 ? "low" : ""}`}
            key={i.hospitalId+"-"+i.bloodGroup}
          >
            <div className="blood-top">
              <span>{i.bloodGroup}</span>
              <Droplet size={18} />
            </div>
            <div>
              <b>{i.units}</b>
              <small> units</small>
            </div>
            <div className="stock-meter">
              <i style={{ width: `${Math.min(100, (i.units / 20) * 100)}%` }} />
            </div>
            <small className={i.units <= 3 ? "red" : ""}>
              {i.units <= 3 ? "Low stock" : "Available"}
            </small>
            <small>{hospital(i.hospitalId)?.name} · Updated {new Date(i.updatedAt).toLocaleString()}</small>
            {editable && user.role==="hospital" && (
              <label className="inventory-edit">
                Set units
                <input
                  aria-label={`${i.bloodGroup} inventory units`}
                  type="number"
                  min="0"
                  max="200"
                  defaultValue={i.units}
                  key={`${i.bloodGroup}-${i.units}`}
                  onBlur={(e) => {
                    if (Number(e.target.value) !== i.units)
                      action(
                        `/inventory/${encodeURIComponent(i.bloodGroup)}`,
                        "PATCH",
                        { units: Number(e.target.value) },
                      );
                  }}
                />
              </label>
            )}
          </div>
        ))}
      </div>
    );
  }
  function Donors() {
    return (
      <>
        <div className="filters">
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Search donors"
              placeholder="Search name or neighbourhood"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter blood group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            {["All groups", ...groups].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="donor-grid">
          {filtered.map((d) => (
            <article className="donor-card" key={d.id}>
              <div className="avatar">
                {d.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")}
              </div>
              <span className="blood-tag">{d.bloodGroup}</span>
              <h3>{d.name}</h3>
              <p>
                <MapPin size={14} />
                {d.area}, Chennai
              </p>
              <button
                className={`availability ${d.available ? "is-available" : ""}`}
                disabled={busy}
                onClick={() =>
                  action(`/donors/${d.id}`, "PATCH", {
                    available: !d.available,
                  })
                }
              >
                <i />
                {d.available ? "Available to donate" : "Not available"}
                <span>Switch</span>
              </button>
            </article>
          ))}
        </div>
        {!filtered.length && (
          <p className="empty">No donors match your search.</p>
        )}
      </>
    );
  }
  const nearby = available
    .map((d) => ({
      ...d,
      distance: distance(d.location, data.hospitals[0].location),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span className="logo">
            <Droplet fill="currentColor" size={25} />
          </span>
          <span>
            LifeLink<small>COMMUNITY BLOOD NETWORK</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <Building2 size={21} />
          </span>
          <div>
            <b>Hospital workspace</b>
            <small>Chennai community</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              aria-label={name}
              key={name}
              className={page === name ? "selected" : ""}
              onClick={() => {
                setPage(name);
                setError("");
              }}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Blood requests" && <b>{open.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="purpose">
            <HeartHandshake size={26} />
            <b>
              A small act.
              <br />A second chance.
            </b>
            <p>Connect the right donor to the right place, when it matters.</p>
          </div>
          <div className="profile">
            <button className="secondary" onClick={async()=>{await api("/auth/logout","POST");setData(null);setUser(null);socket.disconnect();}}>Sign out</button>
            <div>
              <b>{user.name}</b>
              <small>{user.role} account</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace <ChevronRight size={13} />
            </span>
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <span className={`live ${!connected ? "offline" : ""}`}>
              <i />
              {connected ? "Live connection" : "Reconnecting"}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="View donor alerts"
              onClick={() => setPage("Donor portal")}
            >
              <Bell size={19} />
              {alerts.length > 0 && <span>{alerts.length}</span>}
            </button>
            <button className="secondary" onClick={async()=>{await api("/auth/logout","POST");setData(null);setUser(null);socket.disconnect();}}>Sign out</button>
          </div>
        </header>
        <div className="content">
          <div className="demo-banner">
            <ShieldCheck size={15} />
            <span>
              Interactive demo · Fictional people and hospitals. Not for medical
              or emergency use.
            </span>
          </div>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "Donor portal"
                  ? "YOUR DONOR WORKSPACE"
                  : "HOSPITAL COORDINATION"}
              </span>
              <h1>{page === "Overview" ? "Every connection counts." : page}</h1>
              <p>
                {page === "Overview"
                  ? "A clear view of your community. A faster way to find help."
                  : page === "Donor portal"
                    ? "Stay available. Respond to nearby requests. Make a difference."
                    : "Manage your community blood network in real time."}
              </p>
            </div>
            <button className="primary" onClick={() => setModal(true)}>
              <Plus size={18} />
              Create blood request
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === "Overview" && (
            <>
              <div className="stat-grid">
                {[
                  [
                    Users,
                    "Available donors",
                    available.length,
                    `${data.donors.length} registered in the community`,
                  ],
                  [
                    Droplet,
                    "Blood in inventory",
                    stock,
                    "Units across 8 blood groups",
                  ],
                  [
                    ClipboardList,
                    "Active requests",
                    open.length,
                    `${open.filter((r) => r.urgency === "Urgent").length} urgent request needs attention`,
                  ],
                  [
                    Check,
                    "Fulfilled requests",
                    data.requests.filter((r) => r.status === "Fulfilled")
                      .length,
                    "Confirmed by hospital coordinators",
                  ],
                ].map(([Icon, label, value, note], i) => (
                  <section className="stat" key={label}>
                    <div className="stat-label">
                      {label}
                      <span className={`stat-icon c${i}`}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <b>{value}</b>
                    <small>{note}</small>
                  </section>
                ))}
              </div>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Blood group inventory</h2>
                    <p>Community stock overview. Low groups need attention.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("Blood inventory")}
                  >
                    Manage inventory
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                {Inventory({})}
              </section>
              <div className="split">
                <section className="panel network-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Your nearby community</h2>
                      <p>Available donors around Marina General</p>
                    </div>
                    <span className="subtle-tag">
                      <MapPin size={13} /> Chennai
                    </span>
                  </div>
                  <div className="network-map">
                    <svg
                      viewBox="0 0 600 235"
                      role="img"
                      aria-label="Illustrative local donor network, not a navigation map"
                    >
                      <defs>
                        <pattern
                          id="grid"
                          width="38"
                          height="38"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 38 0 L 0 0 0 38"
                            fill="none"
                            stroke="#e7ece8"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect width="600" height="235" fill="url(#grid)" />
                      <path
                        d="M520 0 Q460 110 535 235 L600 235 L600 0"
                        fill="#d9eced"
                      />
                      <path
                        d="M0 155 Q170 120 290 162 T520 90 M180 0 Q240 120 205 235 M0 70 L490 190"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="11"
                      />
                      <circle
                        cx="290"
                        cy="112"
                        r="82"
                        fill="#bb353a"
                        opacity=".035"
                        stroke="#bb353a"
                        strokeDasharray="5 6"
                      />
                      <circle
                        cx="290"
                        cy="112"
                        r="48"
                        fill="#bb353a"
                        opacity=".05"
                      />
                      {available.slice(0, 11).map((d, i) => {
                        const x = Math.max(
                            28,
                            Math.min(
                              460,
                              290 + ((d.location?.lng||0) - 80.2579) * 2400,
                            ),
                          ),
                          y = Math.max(
                            20,
                            Math.min(
                              215,
                              112 - ((d.location?.lat||0) - 13.0067) * 2500,
                            ),
                          );
                        return (
                          <g key={d.id}>
                            <circle cx={x} cy={y} r="8" fill="#fff" />
                            <circle cx={x} cy={y} r="5" fill="#609c85" />
                          </g>
                        );
                      })}
                      <rect
                        x="277"
                        y="99"
                        width="26"
                        height="26"
                        rx="8"
                        fill="#bb353a"
                      />
                      <path
                        d="M290 105 V119 M283 112 H297"
                        stroke="white"
                        strokeWidth="3"
                      />
                      <text x="317" y="104" fontSize="12" fill="#404942">
                        Marina General
                      </text>
                      <text x="38" y="37" fontSize="11" fill="#85918b">
                        GUINDY
                      </text>
                      <text x="365" y="199" fontSize="11" fill="#85918b">
                        BESANT NAGAR
                      </text>
                      <text
                        x="500"
                        y="160"
                        fontSize="11"
                        fill="#819c9e"
                        transform="rotate(-85 500 160)"
                      >
                        BAY OF BENGAL
                      </text>
                    </svg>
                    <div className="map-legend">
                      <span>
                        <i />
                        Available donor
                      </span>
                      <span>
                        <i className="hospital-dot" />
                        Hospital
                      </span>
                      <small>Illustrative location plot</small>
                    </div>
                  </div>
                </section>
                <section className="panel nearest-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Closest available donors</h2>
                      <p>Sorted by straight-line distance</p>
                    </div>
                    <Users size={20} />
                  </div>
                  {nearby.map((d) => (
                    <div className="nearby-row" key={d.id}>
                      <div className="avatar">
                        {d.name
                          .split(" ")
                          .map((s) => s[0])
                          .join("")}
                      </div>
                      <div>
                        <b>{d.name}</b>
                        <small>
                          {d.area} · {d.distance.toFixed(1)} km away
                        </small>
                      </div>
                      <span className="blood-tag">{d.bloodGroup}</span>
                    </div>
                  ))}
                  <button
                    className="text-button bottom-link"
                    onClick={() => setPage("Donor directory")}
                  >
                    View donor directory <ChevronRight size={16} />
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Recent blood requests</h2>
                    <p>Track needs, donor responses and request status.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setPage("Blood requests")}
                  >
                    View all requests
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                {RequestsTable({})}
              </section>
            </>
          )}
          {page === "Appointments" && <Workflow data={data} action={action} busy={busy}/>}
          {page === "Blood inventory" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Community inventory</h2>
                  <p>
                    Edit a unit count, then leave the field to save. Updates
                    appear in every connected dashboard.
                  </p>
                </div>
                <span className="subtle-tag">{stock} units total</span>
              </div>
              {Inventory({ editable: true })}
              <div className="note">
                <ShieldCheck size={17} />
                Stock is coordinator-entered. A donor response does not add a
                blood unit; collection and testing must happen first.
              </div>
            </section>
          )}
          {page === "Donor directory" && Donors()}
          {page === "Blood requests" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>All requests</h2>
                  <p>
                    {open.length} active · {data.requests.length} total
                  </p>
                </div>
              </div>
              {RequestsTable({ all: true })}
            </section>
          )}
          {page === "Donor portal" && (
            <>
              <div className="donor-profile panel">
                <div className="avatar large">
                  {donor.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")}
                </div>
                <div>
                  <span className="eyebrow">DEMO DONOR</span>
                  <h2>
                    {donor.name}{" "}
                    <span className="blood-tag">{donor.bloodGroup}</span>
                  </h2>
                  <p>
                    <MapPin size={14} />
                    {donor.area}, Chennai
                  </p>
                </div>
                <div className="donor-controls">

                  <button
                    className={`availability ${donor.available ? "is-available" : ""}`}
                    disabled={busy}
                    onClick={() =>
                      action(`/donors/${donorId}`, "PATCH", {
                        available: !donor.available,
                      })
                    }
                  >
                    <i />
                    {donor.available ? "Available to donate" : "Not available"}
                  </button>
                </div>
              </div>
              <div className="portal-intro">
                <div>
                  <h2>Nearby requests for you</h2>
                  <p>
                    Exact blood group · within the hospital's search radius ·
                    nearest donors notified first
                  </p>
                </div>
                <span className="live">
                  <Radio size={15} />
                  Socket.IO alerts
                </span>
              </div>
              {alerts
                .filter((a) =>
                  data.requests.some(
                    (r) =>
                      r.id === a.request.id &&
                      ["Open", "Scheduled"].includes(r.status),
                  ),
                )
                .map((a) => (
                  <div
                    key={a.request.id}
                    className="alert-banner"
                    role="status"
                  >
                    <Bell size={21} />
                    <div>
                      <b>New donor connection</b>
                      <p>
                        {a.request.bloodGroup} needed at {a.hospital.name} ·{" "}
                        {a.distanceKm.toFixed(2)} km away · proximity rank #
                        {a.rank}
                      </p>
                    </div>
                    <span>Live notification</span>
                  </div>
                ))}
              <div className="request-cards">
                {open
                  .filter(
                    (r) =>
                      donor.available &&
                      r.bloodGroup === donor.bloodGroup &&
                      distance(donor.location, r.location) <= r.radiusKm,
                  )
                  .map((r) => (
                    <article className="request-card" key={r.id}>
                      <div className="request-card-top">
                        <span
                          className={`badge ${r.urgency === "Urgent" ? "urgent" : "scheduled"}`}
                        >
                          {r.urgency} request
                        </span>
                        <small>{r.id}</small>
                      </div>
                      <div className="request-card-title">
                        <span className="big-blood">{r.bloodGroup}</span>
                        <div>
                          <h3>{hospital(r.hospitalId).name}</h3>
                          <p>
                            <MapPin size={14} />
                            {hospital(r.hospitalId).area}
                          </p>
                        </div>
                      </div>
                      <div className="request-facts">
                        <div>
                          <b>
                            {distance(donor.location, r.location).toFixed(2)} km
                          </b>
                          <small>from your location</small>
                        </div>
                        <div>
                          <b>
                            {r.units} {r.units === 1 ? "unit" : "units"}
                          </b>
                          <small>requested</small>
                        </div>
                        <div>
                          <b>
                            {r.acceptedDonors.length}/{r.units}
                          </b>
                          <small>donors confirmed</small>
                        </div>
                      </div>
                      <p className="medical-note">
                        Responding shares your intent to help, not medical
                        eligibility. The hospital confirms suitability and next
                        steps.
                      </p>
                      <button
                        className="primary wide"
                        disabled={
                          busy ||
                          r.acceptedDonors.includes(donorId) ||
                          r.acceptedDonors.length >= r.units
                        }
                        onClick={() =>
                          action(`/requests/${r.id}/accept`, "POST", {
                            donorId,
                          })
                        }
                      >
                        {r.acceptedDonors.includes(donorId) ? (
                          <>
                            <Check size={17} />
                            Response confirmed
                          </>
                        ) : r.acceptedDonors.length >= r.units ? (
                          "All places reserved"
                        ) : (
                          <>
                            <HeartHandshake size={18} />I can help
                          </>
                        )}
                      </button>
                    </article>
                  ))}
              </div>
              {!open.some(
                (r) =>
                  donor.available &&
                  r.bloodGroup === donor.bloodGroup &&
                  distance(donor.location, r.location) <= r.radiusKm,
              ) && (
                <div className="panel empty">
                  <HeartHandshake size={35} />
                  <h3>No matching requests right now</h3>
                  <p>
                    {donor.available
                      ? "You will receive a live alert when a matching nearby request is created."
                      : "Switch your availability on to receive matching requests."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setModal(true)}
                  >
                    Create a demo request
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          <footer>
            <span>
              <Droplet size={13} /> LifeLink · Built for community, designed for
              care.
            </span>
            <span>
              <Activity size={13} /> Last sync{" "}
              {lastUpdated.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-title"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close request form"
              onClick={() => setModal(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <Droplet size={26} />
            </span>
            <h2 id="request-title">Create a blood request</h2>
            <p>Reach available, exact-group donors closest to your hospital.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const result = await api("/requests", "POST", {
                    hospitalId: f.get("hospitalId"),
                    bloodGroup: f.get("bloodGroup"),
                    units: Number(f.get("units")),
                    urgency: f.get("urgency"),
                    purpose: f.get("purpose"),
                    radiusKm: Number(f.get("radiusKm")),
                  });
                  setModal(false);
                  setToast(
                    `${result.matches.length} nearby donors notified, ordered nearest first.`,
                  );
                } catch (err) {
                  setError(err.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Hospital
                <select name="hospitalId" defaultValue={user.hospitalId}>
                  {data.hospitals.filter(h=>h.id===user.hospitalId).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Blood group
                  <select name="bloodGroup" defaultValue="O+">
                    {groups.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Units needed
                  <input
                    name="units"
                    type="number"
                    min="1"
                    max="10"
                    defaultValue="2"
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Priority
                  <select name="urgency">
                    <option>Urgent</option>
                    <option>Standard</option>
                  </select>
                </label>
                <label>
                  Search radius (km)
                  <input
                    name="radiusKm"
                    type="number"
                    min="1"
                    max="50"
                    defaultValue="15"
                    required
                  />
                </label>
              </div>
              <label>
                Request for
                <select name="purpose">
                  <option>Hospital requirement</option>
                  <option>Patient requirement</option>
                </select>
              </label>
              <div className="note">
                <Radio size={17} />
                Matching donors receive a live in-app notification.
              </div>
              {error && (
                <p className="red" role="alert">
                  {error}
                </p>
              )}
              <button className="primary wide" disabled={busy}>
                {busy ? "Sending..." : "Create & notify donors"}
                <ArrowUpRight size={17} />
              </button>
            </form>
          </section>
        </div>
      )}
      {focusRequest &&
        (() => {
          const r = data.requests.find((x) => x.id === focusRequest.id);
          const matches = available
            .filter((d) => d.bloodGroup === r.bloodGroup)
            .map((d) => ({ ...d, distance: distance(d.location||{lat:0,lng:0}, r.location) }))
            .filter((d) => d.distance <= r.radiusKm)
            .sort((a, b) => a.distance - b.distance);
          return (
            <div className="modal-backdrop">
              <section
                className="modal request-detail"
                role="dialog"
                aria-modal="true"
                aria-label="Request details"
              >
                <button
                  className="modal-close icon-button"
                  aria-label="Close request details"
                  onClick={() => setFocusRequest(null)}
                >
                  <X size={20} />
                </button>
                <span className="eyebrow">{r.id}</span>
                <h2>
                  {r.bloodGroup} · {hospital(r.hospitalId).name}
                </h2>
                <p>
                  {r.units} units requested · {r.radiusKm} km search radius
                </p>
                {badge(r.status)}
                <h3 className="detail-subtitle">
                  Matching donors, nearest first
                </h3>
                {matches.map((d, i) => (
                  <div className="nearby-row" key={d.id}>
                    <span className="rank">{i + 1}</span>
                    <div>
                      <b>{d.name}</b>
                      <small>
                        {d.area} · {d.distance.toFixed(2)} km away
                      </small>
                    </div>
                    {r.acceptedDonors.includes(d.id) && (
                      <span className="badge fulfilled">Confirmed</span>
                    )}
                  </div>
                ))}
                {!matches.length && (
                  <p>No available exact-group donors in range.</p>
                )}
                {["Open", "Scheduled"].includes(r.status) && (
                  <div className="form-row detail-actions">
                    <p>Confirm collection in Appointments to fulfill this request.</p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        action(`/requests/${r.id}/status`, "PATCH", {
                          status: "Cancelled",
                        })
                      }
                    >
                      Cancel request
                    </button>
                  </div>
                )}
                <p className="medical-note">
                  Fulfillment is a coordinator decision after verified
                  collection. It does not automatically change inventory.
                </p>
              </section>
            </div>
          );
        })()}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
