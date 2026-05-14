import Link from 'next/link';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';

type Props = {
  omit?: 'terms' | 'privacy';
  theme?: 'day' | 'night';
};

export default function Footer({ omit, theme = 'day' }: Props) {
  const PALETTE = FULL_PALETTE[theme];
  return (
    <footer
      className="mt-24 pt-10 pb-4 text-center"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
    >
      <p
        className="text-[12px] tracking-wide"
        style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
      >
        {omit !== 'terms' && (
          <>
            <Link
              href="/terms"
              className="hover:underline underline-offset-2 transition-colors"
            >
              Terms
            </Link>
            <span className="mx-3" aria-hidden="true">·</span>
          </>
        )}
        {omit !== 'privacy' && (
          <>
            <Link
              href="/privacy"
              className="hover:underline underline-offset-2 transition-colors"
            >
              Privacy
            </Link>
            <span className="mx-3" aria-hidden="true">·</span>
          </>
        )}
        <a
          href="mailto:support@mindreset.ai"
          className="hover:underline underline-offset-2 transition-colors"
        >
          Contact
        </a>
      </p>
    </footer>
  );
}
