import type { NormalizedRecord } from '../types/index.js';
import { buildRecord } from '../crawlers/base.js';

/**
 * DEMO DATA — one internally consistent synthetic identity plus two
 * deliberately similar decoys, so the correlation engine has something real
 * to discriminate between.
 *
 * These records are fed through the SAME services as Public Source Mode.
 * They are always labelled `DEMO_DATA`; nothing here is ever presented as
 * having come from a live website.
 *
 * Subject:   Rahul Kumar  (aliases: Rahul K.)
 * Handles:   rahul_dev, rahultech, rahul-dev
 * Org:       Example Technologies
 * Project:   Fraud Detection System
 * Event:     Prometheus Hackathon
 * Paper:     AI Fraud Detection
 */
export function buildMockRecords(): NormalizedRecord[] {
  const records: NormalizedRecord[] = [];

  // ---------------------------------------------------------------- SUBJECT
  records.push(
    buildRecord({
      source: 'GitHub',
      sourceType: 'public_profile',
      url: 'https://github.com/rahul-dev',
      title: 'GitHub profile — rahul-dev',
      person: 'Rahul Kumar',
      usernames: ['rahul-dev', 'rahul_dev'],
      organizations: ['Example Technologies'],
      projects: ['fraud-detection-system', 'graph-anomaly-toolkit', 'stream-rules-engine'],
      locations: ['Hyderabad, India'],
      dates: ['2019-06-14T00:00:00Z'],
      links: ['https://rahulkumar.example.com', 'https://github.com/rahul-dev'],
      avatarUrl: null,
      bio: 'Software Engineer at Example Technologies. Fraud detection, graph ML, applied AI security.',
      rawEvidence: [
        { label: 'Display name', excerpt: 'Rahul Kumar' },
        { label: 'Handle', excerpt: 'rahul-dev' },
        {
          label: 'Public bio',
          excerpt:
            'Software Engineer at Example Technologies. Fraud detection, graph ML, applied AI security.',
        },
        { label: 'Organization reference', excerpt: '@ExampleTechnologies' },
        { label: 'Pinned repositories', excerpt: 'fraud-detection-system, graph-anomaly-toolkit' },
        { label: 'Stated location', excerpt: 'Hyderabad, India' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  records.push(
    buildRecord({
      source: 'GitHub',
      sourceType: 'public_repository',
      url: 'https://github.com/rahul-dev/fraud-detection-system',
      title: 'Repository — fraud-detection-system',
      person: 'Rahul Kumar',
      usernames: ['rahul-dev'],
      projects: ['Fraud Detection System'],
      organizations: ['Example Technologies'],
      dates: ['2023-02-11T00:00:00Z'],
      links: ['https://github.com/rahul-dev/fraud-detection-system'],
      rawEvidence: [
        {
          label: 'Repository description',
          excerpt:
            'Real-time transaction fraud detection with graph features and streaming rules. Built at Example Technologies.',
        },
        { label: 'Primary language', excerpt: 'Python' },
        { label: 'README reference', excerpt: 'Presented at the Prometheus Hackathon.' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  records.push(
    buildRecord({
      source: 'Example Technologies',
      sourceType: 'official_organization',
      url: 'https://www.example.com/team',
      title: 'Example Technologies — Team page',
      person: 'Rahul Kumar',
      usernames: [],
      organizations: ['Example Technologies'],
      roles: ['Software Engineer'],
      projects: ['Fraud Detection System'],
      locations: ['Hyderabad, India'],
      dates: ['2024-01-08'],
      links: ['https://github.com/rahul-dev', 'https://rahulkumar.example.com'],
      bio: 'Rahul works on fraud detection and applied machine learning in the Risk Platform group.',
      rawEvidence: [
        {
          label: 'Team page entry — Rahul Kumar',
          excerpt:
            'Rahul Kumar · Software Engineer, Risk Platform · Hyderabad · Joined January 2024 · Fraud Detection System',
        },
        { label: 'Role', excerpt: 'Software Engineer, Risk Platform' },
        { label: 'Stated start date', excerpt: 'January 2024' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  records.push(
    buildRecord({
      source: 'Prometheus Hackathon',
      sourceType: 'event_listing',
      url: 'https://prometheus.example.org/participants',
      title: 'Prometheus Hackathon — Participant listing',
      person: 'Rahul Kumar',
      usernames: ['rahul_dev'],
      organizations: ['Example Technologies'],
      roles: ['Participant'],
      projects: ['Fraud Detection System'],
      events: ['Prometheus Hackathon'],
      // NOTE: deliberately conflicts with the company page location.
      locations: ['Bengaluru, India'],
      dates: ['2025-03-22'],
      links: ['https://prometheus.example.org/participants'],
      rawEvidence: [
        {
          label: 'Participant listing — Rahul Kumar',
          excerpt:
            'Team Sentinel · Rahul Kumar (rahul_dev) · Example Technologies · Project: Fraud Detection System · Bengaluru · 22 March 2025',
        },
        { label: 'Role', excerpt: 'Participant' },
        { label: 'Team', excerpt: 'Team Sentinel' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'Medium-High',
    }),
  );

  records.push(
    buildRecord({
      source: 'AI Security Summit',
      sourceType: 'event_listing',
      url: 'https://aisecuritysummit.example.org/speakers',
      title: 'AI Security Summit — Speaker listing',
      person: 'Rahul K.',
      usernames: ['rahultech'],
      organizations: ['Example Technologies'],
      roles: ['Speaker'],
      projects: ['Fraud Detection System'],
      events: ['AI Security Summit'],
      dates: ['2026-02-17'],
      links: ['https://aisecuritysummit.example.org/speakers', 'https://github.com/rahul-dev'],
      rawEvidence: [
        {
          label: 'Speaker listing — Rahul K.',
          excerpt:
            'Rahul K. · Example Technologies · "Graph signals for real-time fraud detection" · 17 February 2026',
        },
        { label: 'Linked profile', excerpt: 'github.com/rahul-dev' },
        { label: 'Alternate handle', excerpt: 'rahultech' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'Medium-High',
    }),
  );

  records.push(
    buildRecord({
      source: 'arXiv',
      sourceType: 'publication',
      url: 'https://arxiv.org/abs/2601.00000',
      title: 'Publication — AI Fraud Detection: Graph Signals for Real-Time Risk Scoring',
      person: 'Rahul Kumar',
      organizations: ['Example Technologies'],
      publications: ['AI Fraud Detection: Graph Signals for Real-Time Risk Scoring'],
      projects: ['Fraud Detection System'],
      dates: ['2026-04-03'],
      links: ['https://arxiv.org/abs/2601.00000'],
      rawEvidence: [
        {
          label: 'Publication title',
          excerpt: 'AI Fraud Detection: Graph Signals for Real-Time Risk Scoring',
        },
        { label: 'Author list', excerpt: 'Rahul Kumar, A. Mehta' },
        { label: 'Stated affiliation', excerpt: 'Example Technologies' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  records.push(
    buildRecord({
      source: 'rahulkumar.example.com',
      sourceType: 'personal_website',
      url: 'https://rahulkumar.example.com',
      title: 'Rahul Kumar — personal site',
      person: 'Rahul Kumar',
      usernames: ['rahul_dev', 'rahultech'],
      organizations: ['Example Technologies'],
      roles: ['Software Engineer'],
      projects: ['Fraud Detection System', 'Graph Anomaly Toolkit'],
      events: ['Prometheus Hackathon', 'AI Security Summit'],
      locations: ['Hyderabad, India'],
      // NOTE: deliberately conflicts with the company page start date.
      dates: ['2023-11-02'],
      links: [
        'https://github.com/rahul-dev',
        'https://prometheus.example.org/participants',
        'https://arxiv.org/abs/2601.00000',
      ],
      bio: 'Engineer working on fraud detection and AI security. Previously CS at a public university.',
      rawEvidence: [
        { label: 'About section', excerpt: 'Engineer working on fraud detection and AI security.' },
        {
          label: 'Cross-profile links',
          excerpt: 'github.com/rahul-dev · prometheus.example.org · arxiv.org/abs/2601.00000',
        },
        { label: 'Stated employment', excerpt: 'Example Technologies since 2023' },
        { label: 'Handles listed', excerpt: 'rahul_dev, rahultech' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'Medium',
    }),
  );

  records.push(
    buildRecord({
      source: 'Example Technologies',
      sourceType: 'official_organization',
      url: 'https://www.example.com/projects/fraud-detection',
      title: 'Example Technologies — Fraud Detection System',
      person: 'Rahul Kumar',
      organizations: ['Example Technologies'],
      roles: ['Software Engineer'],
      projects: ['Fraud Detection System'],
      dates: ['2024-09-01'],
      links: ['https://www.example.com/projects/fraud-detection'],
      rawEvidence: [
        {
          label: 'Project page contributors',
          excerpt: 'Contributors: Rahul Kumar (Risk Platform), A. Mehta, S. Nair',
        },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  records.push(
    buildRecord({
      source: 'Public university directory',
      sourceType: 'official_organization',
      url: 'https://www.example.com/alumni/2022',
      title: 'Alumni listing — 2022',
      person: 'Rahul Kumar',
      organizations: ['Public University (Computer Science)'],
      roles: ['Student'],
      dates: ['2022-05-30'],
      links: ['https://www.example.com/alumni/2022'],
      rawEvidence: [
        { label: 'Alumni entry', excerpt: 'Rahul Kumar — B.Tech Computer Science, class of 2022' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'Medium-High',
    }),
  );

  // ------------------------------------------------------------- DECOY #1
  // Same name, different organization and field. Should score mid-range.
  records.push(
    buildRecord({
      source: 'GitHub',
      sourceType: 'public_profile',
      url: 'https://github.com/rahulkumar-ui',
      title: 'GitHub profile — rahulkumar-ui',
      person: 'Rahul Kumar',
      usernames: ['rahulkumar-ui'],
      organizations: ['Northwind Design Studio'],
      projects: ['design-tokens', 'react-motion-kit'],
      locations: ['Pune, India'],
      links: ['https://github.com/rahulkumar-ui'],
      bio: 'Frontend engineer. Design systems, motion, accessibility.',
      rawEvidence: [
        { label: 'Display name', excerpt: 'Rahul Kumar' },
        { label: 'Handle', excerpt: 'rahulkumar-ui' },
        { label: 'Public bio', excerpt: 'Frontend engineer. Design systems, motion, accessibility.' },
        { label: 'Organization reference', excerpt: '@NorthwindDesign' },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  records.push(
    buildRecord({
      source: 'Northwind Design Studio',
      sourceType: 'official_organization',
      url: 'https://www.example.com/northwind/people',
      title: 'Northwind Design Studio — People',
      person: 'Rahul Kumar',
      organizations: ['Northwind Design Studio'],
      roles: ['Frontend Engineer'],
      locations: ['Pune, India'],
      dates: ['2021-07-01'],
      links: ['https://www.example.com/northwind/people'],
      rawEvidence: [
        {
          label: 'People page entry — Rahul Kumar',
          excerpt: 'Rahul Kumar · Frontend Engineer · Pune · Joined July 2021',
        },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'High',
    }),
  );

  // ------------------------------------------------------------- DECOY #2
  // Name-only overlap, nothing else lines up. Should score low.
  records.push(
    buildRecord({
      source: 'Regional conference listing',
      sourceType: 'event_listing',
      url: 'https://prometheus.example.org/archive/2019',
      title: 'Regional Conference 2019 — Attendee listing',
      person: 'R. Kumar',
      organizations: ['Meridian Logistics'],
      roles: ['Attendee'],
      events: ['Regional Logistics Conference'],
      locations: ['Chennai, India'],
      dates: ['2019-11-09'],
      links: ['https://prometheus.example.org/archive/2019'],
      rawEvidence: [
        {
          label: 'Attendee listing — R. Kumar',
          excerpt: 'R. Kumar · Meridian Logistics · Chennai · Regional Logistics Conference 2019',
        },
      ],
      provenance: 'DEMO_DATA',
      reliability: 'Low-Medium',
    }),
  );

  return records;
}

/** The context the demo fixture is designed to be searched with. */
export const DEMO_CONTEXT = {
  fullName: 'Rahul Kumar',
  username: 'rahul_dev',
  organization: 'Example Technologies',
  event: 'Prometheus Hackathon',
  location: 'Hyderabad',
  notes: 'AI, cybersecurity, fraud detection',
};
