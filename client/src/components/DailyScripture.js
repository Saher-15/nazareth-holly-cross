import { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { gold, goldLight, goldDark, crimson, cardBg, surfaceBg, goldGradientText } from '../theme';

const SCRIPTURES = [
  { ref: 'John 3:16',        text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.' },
  { ref: 'Psalm 23:1–3',     text: 'The Lord is my shepherd, I lack nothing. He makes me lie down in green pastures, he leads me beside quiet waters, he refreshes my soul.' },
  { ref: 'Matthew 5:9',      text: 'Blessed are the peacemakers, for they will be called children of God.' },
  { ref: 'Isaiah 40:31',     text: 'Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.' },
  { ref: 'Philippians 4:13', text: 'I can do all this through him who gives me strength.' },
  { ref: 'Romans 8:28',      text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
  { ref: 'Jeremiah 29:11',   text: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.' },
  { ref: 'Matthew 11:28',    text: 'Come to me, all you who are weary and burdened, and I will give you rest.' },
  { ref: 'Proverbs 3:5–6',   text: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
  { ref: 'Luke 1:37',        text: 'For no word from God will ever fail.' },
  { ref: 'Psalm 46:1',       text: 'God is our refuge and strength, an ever-present help in trouble.' },
  { ref: 'John 14:6',        text: 'Jesus answered, "I am the way and the truth and the life. No one comes to the Father except through me."' },
  { ref: '1 Corinthians 13:13', text: 'And now these three remain: faith, hope and love. But the greatest of these is love.' },
  { ref: 'Psalm 119:105',    text: 'Your word is a lamp for my feet, a light on my path.' },
  { ref: 'Matthew 6:33',     text: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.' },
  { ref: 'Galatians 5:22–23',text: 'But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness, gentleness and self-control.' },
  { ref: 'John 1:1',         text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
  { ref: 'Revelation 21:4',  text: 'He will wipe every tear from their eyes. There will be no more death or mourning or crying or pain, for the old order of things has passed away.' },
  { ref: 'Numbers 6:24–26',  text: 'The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you; the Lord turn his face toward you and give you peace.' },
  { ref: 'Psalm 27:1',       text: 'The Lord is my light and my salvation — whom shall I fear? The Lord is the stronghold of my life — of whom shall I be afraid?' },
  { ref: 'Isaiah 41:10',     text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.' },
  { ref: 'Ephesians 2:8–9',  text: 'For it is by grace you have been saved, through faith — and this is not from yourselves, it is the gift of God — not by works, so that no one can boast.' },
  { ref: 'Romans 5:8',       text: 'But God demonstrates his own love for us in this: While we were still sinners, Christ died for us.' },
  { ref: 'Matthew 28:19',    text: 'Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.' },
  { ref: 'John 8:12',        text: 'When Jesus spoke again to the people, he said, "I am the light of the world. Whoever follows me will never walk in darkness, but will have the light of life."' },
  { ref: 'Psalm 121:1–2',    text: 'I lift up my eyes to the mountains — where does my help come from? My help comes from the Lord, the Maker of heaven and earth.' },
  { ref: 'Colossians 3:17',  text: 'And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.' },
  { ref: '2 Timothy 3:16',   text: 'All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness.' },
  { ref: 'James 1:17',       text: 'Every good and perfect gift is from above, coming down from the Father of the heavenly lights, who does not change like shifting shadows.' },
  { ref: 'John 15:5',        text: '"I am the vine; you are the branches. If you remain in me and I in you, you will bear much fruit; apart from me you can do nothing."' },
];

const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

export default function DailyScripture() {
  const [index, setIndex] = useState(dayOfYear % SCRIPTURES.length);
  const [fadeKey, setFadeKey] = useState(0);

  const handleNext = () => {
    setIndex(i => (i + 1) % SCRIPTURES.length);
    setFadeKey(k => k + 1);
  };

  const verse = SCRIPTURES[index];

  return (
    <Box component="section" sx={{ py: { xs: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
      <Container maxWidth="md">

        {/* Label */}
        <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1, maxWidth: 60, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.45)})` }} />
            <Typography sx={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', letterSpacing: '0.4em', color: alpha(gold, 0.65), textTransform: 'uppercase' }}>
              Word of the Day
            </Typography>
            <Box sx={{ flex: 1, maxWidth: 60, height: '1px', background: `linear-gradient(90deg, ${alpha(gold, 0.45)}, transparent)` }} />
          </Box>
          <Typography variant="h2" sx={{
            fontFamily: '"Cinzel", serif', fontWeight: 700,
            fontSize: { xs: '1.5rem', md: '2rem' },
            ...goldGradientText,
          }}>
            Daily Scripture
          </Typography>
        </Box>

        {/* Card */}
        <Box
          key={fadeKey}
          sx={{
            position: 'relative',
            background: `linear-gradient(145deg, ${alpha(cardBg, 0.95)} 0%, ${alpha('#1a1000', 0.88)} 100%)`,
            border: `1px solid ${alpha(gold, 0.3)}`,
            borderRadius: '20px',
            p: { xs: 4, md: 6 },
            boxShadow: `0 0 80px ${alpha(gold, 0.07)}, inset 0 0 40px ${alpha(gold, 0.03)}`,
            animation: 'scriptureIn 0.55s cubic-bezier(0.4,0,0.2,1)',
            '@keyframes scriptureIn': {
              from: { opacity: 0, transform: 'translateY(12px)' },
              to:   { opacity: 1, transform: 'none' },
            },
            '&::before': {
              content: '""', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: '60%', height: '2px', borderRadius: '0 0 2px 2px',
              background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
              boxShadow: `0 0 12px ${alpha(gold, 0.4)}`,
            },
          }}
        >
          {/* Cross icon */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <i className="fas fa-cross" style={{ fontSize: '1.6rem', color: alpha(crimson, 0.8), filter: `drop-shadow(0 0 12px ${alpha(crimson, 0.5)})` }} />
          </Box>

          {/* Decorative quote */}
          <Typography aria-hidden sx={{
            position: 'absolute', top: 24, left: 28,
            fontFamily: '"Playfair Display", serif',
            fontSize: '7rem', lineHeight: 1,
            color: alpha(gold, 0.07), userSelect: 'none',
            pointerEvents: 'none', fontWeight: 900,
          }}>
            "
          </Typography>

          {/* Verse text */}
          <Typography sx={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
            fontSize: { xs: '1.05rem', md: '1.2rem' },
            color: alpha(goldLight, 0.88),
            lineHeight: 1.9,
            textAlign: 'center',
            position: 'relative', zIndex: 1,
            mb: 3,
          }}>
            {verse.text}
          </Typography>

          {/* Reference + refresh */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
            <Box sx={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(gold, 0.2)})` }} />
            <Typography sx={{
              fontFamily: '"Cinzel", serif',
              fontSize: '0.78rem',
              letterSpacing: '0.14em',
              color: gold,
              fontWeight: 600,
            }}>
              — {verse.ref}
            </Typography>
            <Tooltip title="Next verse" placement="top">
              <IconButton
                onClick={handleNext}
                size="small"
                sx={{
                  color: alpha(gold, 0.45),
                  width: 28, height: 28,
                  '&:hover': { color: gold, background: alpha(gold, 0.1) },
                }}
              >
                <AutorenewIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
