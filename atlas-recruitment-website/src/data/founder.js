import images from './images';

export const founderHero = {
  eyebrow: 'Meet the founder',
  title: 'Built by someone who runs his own offshore teams every day.',
  lead:
    "Brad Forbes didn't start Atlas as a recruitment business. He started it because he'd already done the hard part for himself.",
  portrait: {
    image: images.img15,
    alt: 'Brad Forbes, founder of Atlas Recruitment',
    caption: 'Brad Forbes · Manchester · Founder',
  },
};

export const founderStory = {
  eyebrow: 'The story',
  title: 'From one Manchester office to teams on three continents.',
  paragraphs: [
    'Behind Atlas sits a group of Manchester companies — Rowan Rose Solicitors, Fast Action Claims and Beacon Legal Group — handling regulated consumer claims at serious volume. Running that operation, Brad hit the wall every scaling owner hits: UK recruitment was slow and expensive, employment law kept getting harder, and every new hire meant another desk, another pension, another risk.',
    'So he went and solved it himself. Over several years he built out managed teams in India, South Africa, Dubai and the Philippines — customer service agents, case handlers, paralegals, accountants, developers — and worked out, by trial and error, how to recruit, employ, equip and manage people properly overseas so that they perform like the best of a UK team.',
  ],
  emphasis: {
    strong: 'Atlas is that playbook, offered to other businesses.',
    rest:
      " Every process we use for a client is one Brad's own companies run on today. The same offices, the same local managers, the same standards.",
  },
  quote: {
    text:
      "I'm not selling you a theory. I'm selling you the exact set-up that runs my own businesses — and I'll show you the teams to prove it.",
    attribution: '— Brad Forbes, Founder',
  },
  stats: [
    { value: '8', label: 'Group companies staffed' },
    { value: '5', label: 'Overseas offices' },
    { value: '3', label: 'Continents' },
    { value: '20+', label: 'Industries covered' },
  ],
};
