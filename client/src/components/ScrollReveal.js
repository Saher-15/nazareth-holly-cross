import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';

export default function ScrollReveal({ children, delay = 0, direction = 'up', duration = 650 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hiddenTransform =
    direction === 'up'    ? 'translateY(36px)' :
    direction === 'left'  ? 'translateX(-36px)' :
    direction === 'right' ? 'translateX(36px)'  : 'translateY(36px)';

  return (
    <Box
      ref={ref}
      sx={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'none' : hiddenTransform,
        transition: `opacity ${duration}ms cubic-bezier(0.4,0,0.2,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Box>
  );
}
