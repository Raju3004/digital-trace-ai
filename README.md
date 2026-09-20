# Public Profile & Digital Footprint Intelligence

An AI-assisted public digital identity intelligence platform, built as a working
hackathon prototype — not a mockup. Every screen is driven by a real backend
pipeline.

```
AUTHORIZED IMAGE + LIMITED CONTEXT
        ↓
INPUT & CLUE EXTRACTION
        ↓
PUBLIC SOURCE DISCOVERY & CRAWLING      ← allowlist + robots.txt enforced
        ↓
CANDIDATE GENERATION
        ↓
IDENTITY CORRELATION / ENTITY RESOLUTION ← the core problem
        ↓
INFORMATION CORRELATION
        ↓
EVIDENCE VERIFICATION
        ↓
ITERATIVE DISCOVERY
        ↓
RELATIONSHIP GRAPH + TIMELINE
        ↓
INTELLIGENCE REPORT
```

---

## Running it

Requires Node 18+. **No API key is needed.**

```bash
npm run install:all     # installs server/ and client/
npm run dev             # starts API on :4000 and web client on :5173
```

Open **http://localhost:5173**. The app starts in **Public Source Mode**.

Or run the two halves separately:

```bash
npm run dev:server      # http://localhost:4000/api/health
npm run dev:client      # http://localhost:5173
```

### Check your network first

```bash
npm run doctor              # probes every source with a default handle
npm run doctor yourhandle   # probes with a handle of your choice
```

This prints which sources your machine can actually reach and how each one
answers robots.txt. Run it before you present.

Sources fail for reasons that have nothing to do with this code — college
Wi-Fi, a corporate proxy, a VPN, or the site's own bot protection. If the
doctor shows most sources blocked, you are on a restricted network: switch
networks (a phone hotspot usually works) or present in Demo Data Mode, which
needs no internet at all.

---

## Demoing a real person (Public Source Mode)

1. Run `npm run doctor <handle>` first and confirm several sources are green.
2. **New Investigation** → enter a real name and handle (your own is the safest
   subject, and you can consent to it on the spot).
3. **Start Analysis.** The log streams each stage as it happens: handles tested,
   profiles confirmed, sources that refused access and why.
4. **Identity → Candidates → Correlation** — several real accounts, ranked, with
   the signals that separate them.

If the person has a thin footprint, the system will say so rather than invent
one. That is the correct outcome, and worth saying out loud to the judges.

---

## The 2-minute jury demo (Demo Data Mode — works offline)

Use this when the venue Wi-Fi is unreliable. It analyzes the built-in subject.

1. Open the **Dashboard**, switch to **Demo Data Mode** in the top bar.
2. Click **New Investigation**.
3. Click **Fill demo context** (top right), then drop in any image as the
   authorized photograph.
4. Click **Start Analysis** — the processing screen runs the real pipeline and
   streams the backend's own timestamped log.
5. **Identity** — one correlated profile at 93%, with the iterative discovery chain.
6. **Candidates** — four candidates at 93% / 58% / 49% / 46%. The system never
   takes the first result. Open **Details** on any of them for the full signal
   breakdown.
7. **Correlation** — 11 independent signals, what each contributed, and why the
   number is a *prototype correlation score* rather than a probability.
8. **Digital Footprint** → **Evidence** → **Conflicts** — source, excerpt,
   provenance, status; then two unresolved contradictions that the system
   deliberately refuses to hide.
9. **Relationship Graph** — click any node to isolate its connections.
10. **Timeline** → **Reports** → **Export Report** (print-friendly).

**Then show the honest-failure case:** in **Public Source Mode**, start an
investigation for a person who does not exist, and watch it retrieve nothing,
report every refused source with its reason, and conclude
*"Insufficient evidence to establish a reliable identity match."*

That refusal is the most defensible thing in the demo — most entries in this
category will happily invent an answer.

---

## Two modes — read this before demoing

| | Public Source Mode (default) | Demo Data Mode |
|---|---|---|
| What it analyzes | **The name / handle you type** | A fixed built-in subject |
| Data | Live retrieval from allowlisted public pages | Local synthetic fixture |
| Network | Required | None — works fully offline |
| Labelled | `PUBLIC SOURCE` | `DEMO DATA` |

> **Demo Data Mode ignores the context you type.** It always analyzes the
> built-in synthetic subject (Rahul Kumar), because scoring your text against
> an unrelated fixture would produce a meaningless number. The intake form
> warns you, the pipeline log says so, and the case is labelled *"Rahul Kumar
> (built-in demo subject)"*. **To analyze a real person, use Public Source Mode.**

Both run through **exactly the same services**. Demo Data Mode replaces only
the discovery step; correlation, evidence, conflicts, graph, timeline and report
logic are identical, so nothing on screen is faked downstream.

**Mock data is never presented as having come from a real website.** Every
record, finding, graph node and timeline entry carries a provenance tag.

---

## Safety and data rules

Enforced in code, before any request leaves the process:

- **Domain allowlist** (`server/src/config/allowlist.ts`) — anything not listed
  is refused outright. Add organizer-approved domains there.
- **robots.txt** — parsed per host and honoured. If robots.txt *cannot be read*,
  the host is refused rather than assumed permissive.
- **Denied paths** — `/login`, `/auth`, `/admin`, `/settings`, `/account` and
  similar are never requested on any domain.
- **Rate limiting** — per-host delay, bounded concurrency, request timeout,
  single retry, max pages per investigation, max crawl depth, duplicate-URL
  detection, descriptive User-Agent.

Not implemented, by design: private account access, credential collection,
password attacks, CAPTCHA or authentication bypass, leaked databases,
anti-bot evasion, rate-limit evasion.

**No face recognition.** The uploaded photograph is reduced to an average hash
in the browser and is labelled a *prototype image signal* everywhere it appears.
It contributes **zero weight** to the correlation score, and the UI says so.

---

## How discovery actually works

The system does not use reverse image search — it cannot afford to, and it
would not be permitted to. It inverts the problem instead:

> Don't ask *"which faces on the internet match this photo?"*
> Find candidate profiles **by handle and context**, then correlate them on
> many independent attributes.

Public Source Mode runs six stages, each feeding the next:

1. **Username enumeration** (`crawlers/usernameCrawler.ts`) — the primary
   engine. Tests every candidate handle against ~26 registered public profile
   sites (`config/sites.ts`). Handles come from what you typed plus
   permutations generated from the name.
2. **GitHub enrichment** — public REST for repositories, languages, links.
3. **Search leads** (`crawlers/searchCrawler.ts`) — DuckDuckGo's no-JS
   endpoint turns the context into candidate URLs. Results are **leads, not
   findings**: nothing becomes a record until the page itself is retrieved.
4. **Lead retrieval** — personal sites and pages linked from confirmed profiles.
5. **Organization and event pages** from the allowlist.
6. **Publication indexes** (arXiv).

### Two things that stop false positives

**Soft-404 detection.** Many sites answer `HTTP 200` with a "not found" body.
A profile counts as found only with *positive* confirmation — the page names
the handle, or publishes structured person metadata — never merely the absence
of a not-found string.

**Anti-bot interstitials.** Some sites answer `200` with a challenge page for
every request. Without detection, *every handle looks like a hit*. Challenge
pages are identified by title and by bot-protection signatures on small
responses, then reported as *"served an anti-bot challenge page… no bypass
attempted"*. They never become records. **PyPI does this from most networks —
it is the clearest example to show a judge.**

### robots.txt follows RFC 9309

- `2xx` → parse and obey the rules
- `4xx` → *unavailable*, access permitted (the standard's own wording)
- `5xx` or network failure → *unreachable*, treated as full disallow

The `4xx` case matters: a great many hosts answer 403/404 for `/robots.txt`.
Refusing those would silently disable most of the discovery engine.
`Crawl-delay` is honoured per host where declared.

---

## How the correlation engine actually works

Entity resolution runs in two stages (`server/src/services/correlationService.ts`).

**1. Clustering.** Records are merged into one candidate only when a
non-name signal ties them together:

- a shared public handle, or
- a reciprocal link between the two pages, or
- strong name agreement **plus** a shared organization / project / event / publication.

Name agreement alone never merges two records. That is what lets the demo
separate three different people who are all called "Rahul Kumar".

**2. Scoring.** Each cluster is compared against the supplied clues across
11 signals — name, username, organization, role, location, project, event,
publication, website, cross-profile links, image signal — using Jaro-Winkler,
a token-set ratio that handles `Rahul Kumar` vs `Rahul K.`, and a handle
similarity that handles `rahul_dev` vs `rahultech`.

Three properties worth pointing at during judging:

- **A handle you supplied outranks a handle we guessed.** Matching a generated
  permutation only proves the guess was plausible, so those matches are
  discounted to 60% and labelled *"generated guess — discounted"*.
- **Unavailable signals are excluded, not scored zero.** Weights are
  renormalized over what was actually evaluated, so a missing source neither
  helps nor punishes a candidate.
- **Thin evidence is penalized.** A candidate supported by fewer than five
  signals is scaled down, so one strong match cannot carry an identification.
- **Conflicts score as conflicts.** Contradictory attributes are kept and drag
  the score down instead of being quietly dropped.

---

## Project structure

```
digital-identity-intelligence/
├── client/                      React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── layout/          Sidebar, shell, mode toggle, toasts
│       │   ├── ui/              Design system primitives
│       │   └── investigation/   Route guard
│       ├── pages/               13 routes — dashboard → report
│       ├── services/api.ts      Typed API layer
│       ├── context/             Mode, active case, toasts
│       └── types/               Shared domain model
│
└── server/                      Node + Express + TypeScript
    └── src/
        ├── doctor.ts            `npm run doctor` — network reachability report
        ├── config/
        │   ├── allowlist.ts     Domain allowlist + crawler limits
        │   └── sites.ts         ~26 public profile sites (add yours here)
        ├── crawlers/
        │   ├── httpClient.ts    Allowlist, robots, rate limit, retry, dedupe
        │   ├── robots.ts        RFC 9309 robots.txt parser
        │   ├── usernameCrawler.ts  Handle enumeration + soft-404 / challenge detection
        │   ├── searchCrawler.ts    DuckDuckGo lead generation
        │   ├── githubCrawler.ts
        │   ├── companyCrawler.ts
        │   ├── eventCrawler.ts
        │   ├── publicationCrawler.ts
        │   └── websiteCrawler.ts
        ├── parsers/             profile · event · project · organization
        ├── services/
        │   ├── clueService.ts         extractClues()
        │   ├── discoveryService.ts    discoverPublicSources()
        │   ├── correlationService.ts  clusterRecords() · correlateCandidates()
        │   ├── evidenceService.ts     verifyEvidence() · detectConflicts()
        │   ├── graphService.ts        buildKnowledgeGraph()
        │   ├── timelineService.ts     buildTimeline()
        │   ├── reportService.ts       buildDiscoveryChain() · generateReport()
        │   └── investigationService.ts  orchestration + in-memory store
        ├── data/mockRecords.ts  The synthetic demo identity
        ├── routes/
        └── types/               Normalized data model
```

Every crawler returns the same `NormalizedRecord` shape, so a real data source
can be added without touching anything downstream.

---

## API

```
GET  /api/health
GET  /api/dashboard/stats
GET  /api/sources/status

POST /api/investigations                      multipart: photo + context + mode
POST /api/investigations/:id/analyze
GET  /api/investigations
GET  /api/investigations/:id
GET  /api/investigations/:id/candidates
GET  /api/investigations/:id/evidence
GET  /api/investigations/:id/graph
GET  /api/investigations/:id/timeline
GET  /api/investigations/:id/footprint
GET  /api/investigations/:id/discovery-chain
GET  /api/investigations/:id/report
```

---

## "I don't know" behaviour

The system is built to decline rather than guess. It will report:

- Insufficient evidence to establish a reliable identity match
- No reliable candidate found
- Conflicting information
- Source unavailable for automated retrieval
- Low confidence
- Analysis incomplete

A failed source is surfaced as an `Unavailable` finding with the exact reason —
never hidden, and never substituted with demo content.

---

## Known limitations (state these before the judges find them)

- Correlation weights are hand-set and **have not been calibrated** against
  ground truth. The score is a prototype heuristic.
- The in-memory store resets when the server restarts.
- The image signal is a hash only; no visual matching is performed.
- Public Source Mode depends on what the allowlisted hosts actually permit at
  runtime — which is why it is built to fail loudly and legibly.
