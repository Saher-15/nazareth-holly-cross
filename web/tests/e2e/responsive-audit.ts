// The layout audit behind the responsive specs of the public site (web/tests/e2e/responsive.spec.ts) and of the
// admin dashboard (admin/tests/e2e/responsive.spec.ts imports this file, so both apply the same rules).
// It must stay free of imports: `auditLayout` is sent into the page with page.evaluate and runs there.
// The rules and how to read a failure: docs/RESPONSIVE.md.

export type LayoutIssue = { kind: string; detail: string };

export type AuditOptions = {
  /** Smallest pressable size in CSS px (WCAG 2.2 SC 2.5.8 asks 24). */
  tapMin: number;
  /** CSS selector of the site header (checked for overlapping controls). */
  header: string;
  /** Elements to leave out entirely (decorative layers that bleed on purpose). */
  ignore: string[];
};

export type AuditResult = { issues: LayoutIssue[]; smallTouch: string[] };

/**
 * Runs in the browser. Returns every layout problem of the current page at the current viewport:
 * sideways scroll, elements that leave the viewport, text clipped by an overflow-hidden box, overlapping header
 * controls, stretched images, tables wider than the screen without their own scroll box, tap targets under
 * `tapMin`, and fixed or sticky bars that cover too much of the screen.
 * `smallTouch` lists targets between `tapMin` and 44 px (advice for touch screens, not a failure).
 */
export function auditLayout(opts: AuditOptions): AuditResult {
  const issues: LayoutIssue[] = [];
  const smallTouch: string[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const EPS = 1;

  const name = (el: Element) => {
    const h = el as HTMLElement;
    const id = h.id ? `#${h.id}` : '';
    const cls = typeof h.className === 'string' && h.className.trim() ? `.${h.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const text = (h.getAttribute('aria-label') || h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };
  const ignored = (el: Element) => opts.ignore.some((sel) => el.closest(sel));
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    return true;
  };
  // Screen-reader-only text: a 1px box with clipping.
  const srOnly = (el: Element) => {
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      if ((cs.clip && cs.clip !== 'auto') || cs.clipPath.includes('inset(50%')) return true;
      if (r.width <= 1 && r.height <= 1 && cs.overflow !== 'visible') return true;
    }
    return false;
  };
  const inertOrHidden = (el: Element) => !!el.closest('[inert], [aria-hidden="true"], dialog:not([open])');
  const scrollsX = (cs: CSSStyleDeclaration) => cs.overflowX === 'auto' || cs.overflowX === 'scroll';
  const clipsX = (cs: CSSStyleDeclaration) => cs.overflowX !== 'visible';
  const clipsY = (cs: CSSStyleDeclaration) => cs.overflowY !== 'visible';

  // 1. no sideways scroll of the page itself
  const root = document.scrollingElement ?? document.documentElement;
  if (root.scrollWidth > vw + EPS) issues.push({ kind: 'page-scroll-x', detail: `scrollWidth ${root.scrollWidth} > ${vw}` });

  const all = [...document.body.querySelectorAll('*')].filter((el) => !ignored(el));

  // 2. nothing visible pokes out of the viewport (in either direction: RTL content lost off the left edge too),
  //    unless an ancestor clips or scrolls it (a carousel, a table box). <html> and <body> do not count as such an
  //    ancestor: content they hide is lost.
  const reported = new Set<Element>();
  for (const el of all) {
    if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
    if (!visible(el) || srOnly(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + EPS && r.left >= -EPS) continue;
    let contained = false;
    let reportedAncestor = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (reported.has(p)) {
        reportedAncestor = true;
        break;
      }
      const cs = getComputedStyle(p);
      if (clipsX(cs) && !p.classList.contains('ui-page')) {
        contained = true;
        break;
      }
    }
    if (contained || reportedAncestor) continue;
    reported.add(el);
    issues.push({ kind: 'out-of-viewport', detail: `${name(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}` });
  }

  // 3. text clipped by an overflow-hidden box (ellipsis and line clamps are deliberate and allowed)
  for (const el of all) {
    const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim());
    if (!own || !visible(el) || srOnly(el) || inertOrHidden(el)) continue;
    const cs = getComputedStyle(el);
    const lineClamp = cs.getPropertyValue('-webkit-line-clamp');
    const deliberate = cs.textOverflow === 'ellipsis' || (lineClamp && lineClamp !== 'none');
    if (deliberate) continue;
    const h = el as HTMLElement;
    if (clipsX(cs) && !scrollsX(cs) && h.scrollWidth > h.clientWidth + 2) {
      issues.push({ kind: 'text-clipped', detail: `${name(el)} scrollWidth ${h.scrollWidth} > ${h.clientWidth}` });
      continue;
    }
    if (clipsY(cs) && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll' && h.scrollHeight > h.clientHeight + 2 && h.clientHeight > 0) {
      issues.push({ kind: 'text-clipped', detail: `${name(el)} scrollHeight ${h.scrollHeight} > ${h.clientHeight}` });
      continue;
    }
    // ...or by the nearest ancestor that hides overflow
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'visible' && pcs.overflowY === 'visible') continue;
      if (scrollsX(pcs) || pcs.overflowY === 'auto' || pcs.overflowY === 'scroll') break;
      if (p.classList.contains('ui-page')) break;
      const clamp = pcs.getPropertyValue('-webkit-line-clamp');
      if (pcs.textOverflow === 'ellipsis' || (clamp && clamp !== 'none')) break;
      const pr = p.getBoundingClientRect();
      const outX = clipsX(pcs) && (r.left < pr.left - 2 || r.right > pr.right + 2);
      const outY = clipsY(pcs) && (r.top < pr.top - 2 || r.bottom > pr.bottom + 2);
      if (outX || outY) issues.push({ kind: 'text-clipped', detail: `${name(el)} is cut by ${name(p).slice(0, 60)}` });
      break;
    }
  }

  // 4. images and videos keep their proportions (object-fit cover/contain crop or letterbox instead)
  for (const el of all) {
    if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.objectFit !== 'fill') continue;
    const nw = el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
    const nh = el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
    if (!nw || !nh) continue;
    const r = el.getBoundingClientRect();
    const box = r.width / r.height;
    const nat = nw / nh;
    if (Math.abs(box - nat) / nat > 0.03) {
      issues.push({ kind: 'image-distorted', detail: `${name(el)} ${el.getAttribute('src')?.slice(0, 60) ?? ''} drawn ${Math.round(r.width)}x${Math.round(r.height)}, file ${nw}x${nh}` });
    }
  }

  // 5. a table wider than the screen scrolls inside its own box
  for (const table of document.querySelectorAll('table')) {
    if (!visible(table) || ignored(table)) continue;
    if (table.getBoundingClientRect().width <= vw + EPS) continue;
    let box = false;
    for (let p = table.parentElement; p && p !== document.body; p = p.parentElement) {
      if (scrollsX(getComputedStyle(p))) {
        box = true;
        break;
      }
    }
    if (!box) issues.push({ kind: 'table-overflow', detail: `${name(table).slice(0, 60)} is wider than the screen with no scroll box` });
  }

  // 6. tap targets: at least tapMin x tapMin, or far enough from the others (WCAG 2.5.8 spacing exception), or an
  //    inline link inside a sentence (the inline exception)
  const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])';
  const targets = [...document.querySelectorAll<HTMLElement>(sel)]
    .filter((el) => !ignored(el) && visible(el) && !srOnly(el) && !inertOrHidden(el))
    .map((el) => {
      // A visually hidden radio or checkbox is operated through its label: measure the label.
      let box = el;
      if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
        const cs = getComputedStyle(el);
        if (cs.opacity === '0' || el.getBoundingClientRect().width < 4) box = (el.closest('label') as HTMLElement) ?? el;
      }
      return { el, r: box.getBoundingClientRect() };
    })
    .filter((t) => t.r.bottom > 0 || t.r.top < document.documentElement.scrollHeight);
  const inlineInText = (el: HTMLElement) => {
    if (el.tagName !== 'A') return false;
    if (getComputedStyle(el).display !== 'inline') return false;
    const parent = el.parentElement;
    if (!parent) return false;
    const text = (parent.textContent ?? '').replace(/\s+/g, ' ').trim();
    const own = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return text.length > own.length + 3;
  };
  const distance = (x: number, y: number, r: DOMRect) => {
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    return Math.hypot(dx, dy);
  };
  for (const t of targets) {
    const { el, r } = t;
    const small = r.width < opts.tapMin - 0.5 || r.height < opts.tapMin - 0.5;
    if (!small) {
      if (r.width < 43.5 || r.height < 43.5) smallTouch.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      continue;
    }
    if (inlineInText(el)) continue;
    // Spacing exception: a circle of tapMin diameter on the target's centre touches no other target.
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const crowded = targets.some((o) => {
      if (o.el === el || o.el.contains(el) || el.contains(o.el)) return false;
      const oSmall = o.r.width < opts.tapMin - 0.5 || o.r.height < opts.tapMin - 0.5;
      if (oSmall) {
        const ox = o.r.left + o.r.width / 2;
        const oy = o.r.top + o.r.height / 2;
        return Math.hypot(ox - cx, oy - cy) < opts.tapMin;
      }
      return distance(cx, cy, o.r) < opts.tapMin / 2;
    });
    if (crowded) issues.push({ kind: 'tap-target', detail: `${name(el)} ${Math.round(r.width)}x${Math.round(r.height)} is under ${opts.tapMin}px and crowded` });
  }

  // 7. the header: every control inside the viewport and none overlapping another
  const header = document.querySelector(opts.header);
  if (header && visible(header)) {
    const controls = [...header.querySelectorAll<HTMLElement>('a[href], button, select, input')]
      .filter((el) => visible(el) && !srOnly(el) && !el.closest('[class*="nav"][class*="open"], dialog, [role="dialog"]'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // The bar only: drawer content below it is checked as a drawer.
        return r.top < header.getBoundingClientRect().bottom - 1;
      });
    for (let i = 0; i < controls.length; i++) {
      const a = controls[i].getBoundingClientRect();
      if (a.left < -EPS || a.right > vw + EPS) issues.push({ kind: 'header', detail: `${name(controls[i])} leaves the screen` });
      for (let j = i + 1; j < controls.length; j++) {
        if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
        const b = controls[j].getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) issues.push({ kind: 'header', detail: `${name(controls[i])} overlaps ${name(controls[j])}` });
      }
    }
  }

  // 8. fixed and sticky layers leave most of the screen to the content
  let covered = 0;
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (!visible(el) || srOnly(el) || el.matches('.skip-link')) continue;
    // a full-screen layer is a dialog or a backdrop, checked elsewhere
    if (el.closest('dialog, [role="dialog"], [aria-modal="true"]')) continue;
    const r = el.getBoundingClientRect();
    const onScreen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (onScreen <= 0) continue;
    if (cs.position === 'sticky' && el.parentElement && el.parentElement.getBoundingClientRect().height <= r.height + 1) continue;
    // a narrow layer is a side column or a floating button: it only covers content when it lies over <main>
    if (r.width < vw * 0.6) {
      const main = document.querySelector('main')?.getBoundingClientRect();
      const overMain = !main || Math.min(r.right, main.right) - Math.max(r.left, main.left) > 1;
      if (cs.position === 'fixed' && overMain && onScreen > vh * 0.3) issues.push({ kind: 'fixed-cover', detail: `${name(el)} covers ${Math.round(onScreen)}px of ${vh}` });
      continue;
    }
    if (cs.position === 'fixed' || r.top <= 1) covered += onScreen;
  }
  if (covered > vh * 0.35) issues.push({ kind: 'fixed-cover', detail: `fixed and sticky bars cover ${Math.round(covered)}px of a ${vh}px screen` });

  return { issues, smallTouch };
}
