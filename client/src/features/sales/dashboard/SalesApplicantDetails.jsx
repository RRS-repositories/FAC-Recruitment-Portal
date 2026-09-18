import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { adminVoiceNote } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';
import { ExtendedApplicantDetails } from '@/features/role-details/ExtendedApplicantDetails';
import { SectionTitle } from '@/features/role-details/DetailParts';
import { SALES_FIELDS, voiceNoteFilename } from './salesDetail';

/**
 * The sales applicant's part of the expanded dashboard row.
 *
 * The shared extended-details panel (features/role-details/) draws the
 * details, written answers and assessment; the one thing only sales has -- the
 * voice note -- lives here and is handed to it as its first section.
 */

// Two glyphs the shared icon set does not have, drawn on the same 24px grid
// and stroke so they sit with it. Kept here rather than added to Icon.jsx.
const Glyph = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width={15}
    height={15}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);
const PlayGlyph = () => (
  <Glyph>
    <path d="M7 4.5v15l12-7.5z" />
  </Glyph>
);
const DownloadGlyph = () => (
  <Glyph>
    <path d="M12 4v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </Glyph>
);

const SOURCE_LABEL = { recorded: 'recorded in the form', uploaded: 'uploaded file' };

/**
 * The voice note: fetched once, on the first Play or Download, because it
 * needs the auth header and so cannot be a plain <audio src>. The object URL
 * lives as long as this component and is revoked when it goes.
 */
function VoiceNote({ applicant, voice }) {
  const [url, setUrl] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Gone under retention between the detail loading and the click: the server
  // says 410, and the row then says so in the same words it would have.
  const [gone, setGone] = useState(false);
  const urlRef = useRef(null);
  const blobRef = useRef(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const load = async () => {
    if (blobRef.current) return blobRef.current;
    const blob = await adminVoiceNote(applicant.id);
    blobRef.current = blob;
    urlRef.current = URL.createObjectURL(blob);
    setUrl(urlRef.current);
    return blob;
  };

  const run = async (what, then) => {
    setBusy(what);
    setError('');
    try {
      await load();
      then();
    } catch (failure) {
      if (failure.status === 410) setGone(true);
      else setError(failure.message);
    } finally {
      setBusy('');
    }
  };

  const play = () => run('play', () => setShowPlayer(true));

  const download = () =>
    run('download', () => {
      const link = document.createElement('a');
      link.href = urlRef.current;
      link.download = voiceNoteFilename(applicant.fullName, voice);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });

  const deletedAt = voice?.deletedAt ?? null;

  const meta = [
    voice?.durationSec != null ? formatDuration(voice.durationSec) : null,
    voice?.source ? SOURCE_LABEL[voice.source] : null,
  ].filter(Boolean);

  return (
    <div>
      <SectionTitle>
        Voice note
        {meta.length > 0 ? (
          <span className="font-medium normal-case tracking-normal"> · {meta.join(' · ')}</span>
        ) : null}
      </SectionTitle>

      {deletedAt || gone ? (
        // Said plainly, as the CV is. A missing button would look like a fault.
        <p className="text-[0.84rem] text-muted">
          Voice note deleted{deletedAt ? ` ${formatDateTime(deletedAt)}` : ''} — retention policy
        </p>
      ) : !voice?.present ? (
        <p className="text-[0.84rem] text-muted">No voice note</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!showPlayer ? (
              <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={play}>
                <PlayGlyph />
                {busy === 'play' ? 'Loading…' : 'Play voice note'}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" disabled={Boolean(busy)} onClick={download}>
              <DownloadGlyph />
              {busy === 'download' ? 'Preparing…' : 'Download voice note'}
            </Button>
            {error ? (
              <span role="alert" className="text-[0.84rem] font-medium text-danger">
                {error}
              </span>
            ) : null}
          </div>
          {showPlayer && url ? (
            <audio
              controls
              autoPlay
              preload="metadata"
              src={url}
              aria-label={`Voice note from ${applicant.fullName}`}
              className="mt-3 w-full max-w-md"
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export function SalesApplicantDetails({ applicant, detail, writtenQuestions, assessment }) {
  return (
    <ExtendedApplicantDetails
      detail={detail}
      writtenQuestions={writtenQuestions}
      assessment={assessment}
      fields={SALES_FIELDS}
      renderVoice={(shown) => <VoiceNote applicant={applicant} voice={shown.voice ?? null} />}
    />
  );
}

export default SalesApplicantDetails;
