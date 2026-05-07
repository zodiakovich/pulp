import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { pageMeta } from '@/lib/seo-metadata';
import { FaqAccordion } from './FaqAccordion';
import { FaqJsonLd } from './FaqJsonLd';

export const metadata = pageMeta({
  title: 'FAQ',
  description:
    'Answers about pulp: exports, ownership, DAWs, commercial use, plans, billing, security, and how generation works—with links to Privacy and Pricing.',
  path: '/faq',
});

const FAQ_ITEMS = [
  {
    question: 'What is pulp?',
    answer: 'pulp is an AI MIDI generator: you describe a track in words and get editable MIDI layers you can open in any DAW.',
  },
  {
    question: 'What formats can I export?',
    answer: 'You can export MIDI (.mid) and rendered audio as WAV where the app offers export or download.',
  },
  {
    question: 'Do I own the generated music?',
    answer: 'Yes. You own the MIDI and exports you create, subject to your plan terms for commercial use.',
  },
  {
    question: 'What DAWs are compatible?',
    answer: 'Any DAW that imports standard MIDI files or WAV—Ableton Live, FL Studio, Logic Pro, Reaper, Cubase, and others.',
  },
  {
    question: 'Can I use generated music commercially?',
    answer: (
      <>
        Yes on paid plans that include a commercial license. See{' '}
        <Link href="/pricing" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Pricing
        </Link>{' '}
        and{' '}
        <Link href="/legal/license" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          License
        </Link>{' '}
        for your tier.
      </>
    ),
  },
  {
    question: 'How does the AI work?',
    answer:
      'pulp combines prompt understanding with deterministic musical rules: we infer genre, tempo, and harmony, then generate separate MIDI layers (melody, chords, bass, drums) you can edit. It is not a black-box “finished song” engine—the output is meant as a starting point in your DAW.',
  },
  {
    question: "What's the difference between plans?",
    answer: (
      <>
        Plans differ mainly in monthly generation limits and commercial rights. Compare tiers on the{' '}
        <Link href="/pricing" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Pricing
        </Link>{' '}
        page.
      </>
    ),
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. Cancel paid subscriptions from your account; you keep access through the period you already paid for. There is no multi-year lock-in.',
  },
  {
    question: 'Is my data secure?',
    answer: (
      <>
        We rely on established providers (Clerk for auth, Supabase for data, Stripe for payments) and follow common security practices. For details on what
        we store and your rights, read the{' '}
        <Link href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    question: 'Do I need to pay to try pulp?',
    answer: 'No. The Free plan lets you generate MIDI tracks without a credit card. Paid plans add more generations per month and a commercial license.',
  },
  {
    question: 'How do I import the MIDI into Ableton Live?',
    answer: 'Export the .mid file from pulp, then drag it directly onto a MIDI track in Ableton. Each layer (melody, chords, bass, drums) is a separate file so you can drop them onto separate tracks. The same drag-and-drop method works in FL Studio, Logic Pro, and Reaper.',
  },
  {
    question: "What's the difference between MIDI Format 0 and Format 1?",
    answer: 'Format 0 merges all MIDI channels into a single track — useful for quick compatibility. Format 1 keeps each layer on its own track, which is better when you want to manipulate melody, chords, bass, and drums independently in your DAW. When in doubt, use Format 1.',
  },
  {
    question: 'What happens when I run out of generations?',
    answer: 'Your generation count resets at the start of each billing period. If you hit the limit, you can upgrade your plan from the Profile page or wait for the reset. You keep access to all MIDI you already generated.',
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <FaqJsonLd />
      <Navbar />
      <div className="mx-auto max-w-[720px] px-6 pb-24 pt-24 sm:px-8 sm:pt-28">
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'var(--accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            letterSpacing: '0.04em',
          }}
        >
          ← Back to pulp
        </Link>

        <p
          className="mt-10"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Help
        </p>
        <h1
          className="mt-3"
          style={{
            fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            color: 'var(--text)',
          }}
        >
          Frequently asked questions
        </h1>
        <p className="mt-4" style={{ fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif', fontSize: 16, lineHeight: 1.75, color: 'var(--muted)' }}>
          Short answers to common questions. For legal detail, see Privacy, Terms, and Cookies.
        </p>

        <div className="mt-12">
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </div>
    </div>
  );
}
