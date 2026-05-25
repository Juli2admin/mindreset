'use client';

import { useEffect, useState } from 'react';
import DisclaimerModal from './DisclaimerModal';

const COOKIE_NAME = 'mr_disclaimer_acknowledged';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function setAckCookie() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=true; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

type Props = {
  initialShow: boolean;
  needsCookieBackfill: boolean;
};

export default function DisclaimerGate({ initialShow, needsCookieBackfill }: Props) {
  const [open, setOpen] = useState(initialShow);

  useEffect(() => {
    if (needsCookieBackfill) setAckCookie();
  }, [needsCookieBackfill]);

  const handleAcknowledge = async () => {
    setAckCookie();
    setOpen(false);
    try {
      await fetch('/api/disclaimer/acknowledge', { method: 'POST' });
    } catch (err) {
      console.error('[disclaimer] server stamp failed:', err);
    }
  };

  if (!open) return null;
  return <DisclaimerModal onAcknowledge={handleAcknowledge} />;
}
