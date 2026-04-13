import { siteUrl } from '@/lib/seo';

const QA: { question: string; answer: string }[] = [
  {
    question: 'What is pulp?',
    answer:
      'pulp is an AI MIDI generator: you describe a track in words and get editable MIDI layers you can open in any DAW.',
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
    answer: 'Yes on paid plans that include a commercial license; check the Pricing and License pages for your plan.',
  },
  {
    question: 'How does the AI work?',
    answer:
      'pulp uses a mix of rules and models: prompts are interpreted to pick style, tempo, and harmony, then patterns are generated as MIDI—not as a finished master—so you can edit notes and sounds in your DAW.',
  },
  {
    question: "What's the difference between plans?",
    answer: 'Plans differ mainly in monthly generation limits and commercial rights. See the Pricing page for current tiers.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. You can cancel paid subscriptions from your account; there is no long-term lock-in beyond the period you already paid for.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'We use reputable providers (Clerk, Supabase, Stripe) and standard security practices. Read the Privacy Policy for what we collect and how to request deletion.',
  },
];

export function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QA.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
    url: `${siteUrl}/faq`,
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
