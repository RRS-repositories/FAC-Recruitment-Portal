import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { StepHeader } from '../StepHeader';
import { StepNav } from '../StepNav';
import { cn } from '@/lib/cn';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['.pdf', '.doc', '.docx'];

const prettySize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Step 4 — CV upload and submit.
 *
 * Drag-and-drop with a real file input behind it: dropping is a convenience,
 * and the input is what keeps the control reachable by keyboard and by anyone
 * who cannot drag. Spec §12 notes dragging must never be the only way.
 *
 * Validation happens on selection, not on submit, so a wrong file type is
 * caught while the person is still looking at the picker.
 */
export function CvStep({ role, file, onFile, onBack, onSubmit, submitting, submitError }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const accept = (candidate) => {
    if (!candidate) return;
    const ext = `.${candidate.name.split('.').pop()?.toLowerCase()}`;

    if (!ACCEPTED.includes(ext)) {
      setError(`That file type isn't supported. Please upload a ${ACCEPTED.join(', ')} file.`);
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError(`That file is ${prettySize(candidate.size)}. Please keep it under 5 MB.`);
      return;
    }

    setError('');
    onFile(candidate);
  };

  return (
    <>
      <StepHeader
        eyebrow="Almost done"
        title="Upload your CV"
        sub="One last thing, then your application is with us."
        role={role}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'rounded-panel border-2 border-dashed p-8 text-center transition-colors duration-200',
          dragging ? 'border-violet bg-lav-soft' : 'border-line bg-white',
          error && 'border-danger',
        )}
      >
        {file ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-control bg-lav text-violet-deep">
              <Icon name="file" size={20} />
            </span>
            <span className="text-left">
              <b className="block text-[0.92rem] text-ink">{file.name}</b>
              <small className="text-[0.8rem] text-muted">{prettySize(file.size)}</small>
            </span>
            <button
              type="button"
              onClick={() => {
                onFile(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="rounded-control px-3 py-2 text-[0.83rem] font-semibold text-violet-deep hover:bg-lav-soft"
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-lav text-violet-deep"
            >
              <Icon name="upload" size={22} />
            </span>
            <p className="text-[0.95rem] font-semibold text-ink">
              Drag your CV here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-violet-deep underline underline-offset-2"
              >
                browse for a file
              </button>
            </p>
            <p className="mt-1.5 text-[0.82rem] text-muted">PDF or Word document, up to 5 MB</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="sr-only"
          aria-label="Upload your CV"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.85rem] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {submitError ? (
        <p role="alert" className="mt-4 rounded-control bg-red-50 px-4 py-3 text-[0.88rem] font-medium text-danger">
          {submitError}
        </p>
      ) : null}

      <StepNav
        onBack={onBack}
        onNext={onSubmit}
        nextLabel="Submit application"
        busy={submitting}
        disabled={!file}
        hint="Please attach your CV to finish your application."
      />
    </>
  );
}

export default CvStep;
