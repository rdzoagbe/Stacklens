import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useDbQuery } from '../hooks/useDbQuery';
import { useLang } from '../contexts/LangContext';
import { useTranslation } from '../translations';
import { getSharedView } from '../lib/db';
import { hasRole } from './gates';
import {
  protectionActive, watermarkText, isCaptureShortcut, isEditableTarget, BLUR_AFTER_CAPTURE_MS, PRINT_NOTICE_FALLBACK,
} from '../lib/screenProtection';

// ── Mounted once, in AppShell. Renders nothing unless protection applies. ──
// See lib/screenProtection.js for what this does and does not promise.

const TILE = 6;   // watermark rows and columns; the overlay is fixed and rotated

function Watermark({ text }) {
  const cells = useMemo(() => Array.from({ length: TILE * TILE }, (_, i) => i), []);
  return createPortal(
    <div data-testid="screen-watermark" aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[2147483000] overflow-hidden select-none print:hidden">
      <div className="absolute -inset-[30%] grid -rotate-[24deg] content-around justify-around gap-x-16 gap-y-24"
        style={{ gridTemplateColumns: `repeat(${TILE}, max-content)` }}>
        {cells.map((i) => (
          <span key={i} className="whitespace-nowrap text-sm font-semibold text-white/[0.07] mix-blend-difference">{text}</span>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function ScreenProtection() {
  const { user, firebaseUser, isDemo } = useAuth();
  const { data: db } = useDbQuery();
  const { language } = useLang();
  const t = useTranslation(language);
  const shared = !!getSharedView();
  const viewerEmail = firebaseUser?.email || (shared ? '' : user?.email) || '';
  const active = protectionActive({
    workspaceUser: db?.user,
    viewerEmail,
    // In a shared view `user` is somebody else's account: only an own account's flag counts.
    isFounderFlag: !shared && user?.is_founder === true,
    isDemo,
    // The same rule as the Settings switch (SecurityTab): whoever may turn it
    // off is not the person it is meant to stop.
    canSwitchOff: !shared && hasRole('admin'),
  });

  // A clock for the watermark, to the minute: enough to date an image.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const body = document.body;
    body.classList.add('screen-protected');
    body.setAttribute('data-print-notice', t('screen_prot_print_notice') || PRINT_NOTICE_FALLBACK);

    let blurTimer = null;
    const blur = () => body.classList.add('screen-blurred');
    const unblur = () => { if (!blurTimer) body.classList.remove('screen-blurred'); };
    const blurBriefly = () => {
      blur();
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => { blurTimer = null; if (document.hasFocus()) unblur(); }, BLUR_AFTER_CAPTURE_MS);
    };
    // Not while the browser is printing the client report: that page is the one
    // thing that is meant to leave, and a blurred PDF would be useless.
    const onWindowBlur = () => { if (!body.classList.contains('printing-report')) blur(); };
    const onFocus = () => unblur();
    const onKeyUp = (e) => {
      if (!isCaptureShortcut(e)) return;
      blurBriefly();
      try { navigator.clipboard?.writeText(''); } catch { /* clipboard blocked: the blur still happened */ }
    };
    const onKeyDown = (e) => { if (isCaptureShortcut(e)) blurBriefly(); };
    const refuse = (e) => { if (!isEditableTarget(e.target)) e.preventDefault(); };

    if (!document.hasFocus()) blur();
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    for (const ev of ['copy', 'cut', 'contextmenu', 'dragstart']) document.addEventListener(ev, refuse, true);
    return () => {
      clearTimeout(blurTimer);
      body.classList.remove('screen-protected', 'screen-blurred');
      body.removeAttribute('data-print-notice');
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      for (const ev of ['copy', 'cut', 'contextmenu', 'dragstart']) document.removeEventListener(ev, refuse, true);
    };
  }, [active, t]);

  if (!active) return null;
  return <Watermark text={watermarkText(viewerEmail, now)} />;
}
