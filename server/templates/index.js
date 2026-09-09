import { registerTemplate } from '../lib/templates.js';
import { buildIcs } from '../lib/ics.js';
import { loadContext, publicBaseUrl, SIGN_OFF, joinLine, whenLine } from './context.js';
import { shell, p, greeting, callout, button, bodyBoth, esc } from './layout.js';

/**
 * Every email the portal sends.
 *
 * The four decision emails are the client's own words, copied from the
 * prototype (`ROLES.india.email`, `ROLES.sa.email`) rather than rewritten —
 * they have been read and approved, and improving someone's rejection letter
 * uninvited is not a favour. The other seven are drafted here and need
 * sign-off before they reach a real candidate.
 *
 * Each template is:
 *
 *   load()    live data, fetched when the email sends
 *   render()  a pure function of that data — testable, previewable
 *   sample    invented stand-in data for the manager's template screen. Never
 *             a real person: this is rendered on a page a browser can reach.
 */

const bookingUrl = (token) => `${publicBaseUrl()}/book/${token}`;

/**
 * The note beside the booking button.
 *
 * The supplied template says the interview takes place on Google Meet. It
 * does not: nothing creates a Meet link, and the calendar work we scoped is
 * Microsoft, because the firm runs on Microsoft 365. Naming a platform we do
 * not use would be discovered by the candidate on the day, so this says what
 * actually happens. The calendar file IS real -- the confirmation attaches an
 * .ics -- so that half of the sentence is kept.
 */
const MEETING_NOTE_TEXT =
  'The interview takes place on video. You will get a calendar file as soon as you book, the '
  + 'joining link before the day, and a reminder before it starts.';
const MEETING_NOTE_HTML =
  'The interview takes place on a <strong>video call</strong>. You&rsquo;ll get a calendar file '
  + 'as soon as you book, the joining link before the day, and a reminder before it starts.';

/** Every template shares the same live lookup; only the wording differs. */
const load = loadContext;

const SAMPLE = {
  firstName: 'Priya',
  fullName: 'Priya Example',
  email: 'priya@example.com',
  roleTitle: 'Paralegal Internship',
  roleCountry: 'India',
  interviewerName: 'Priyanshu Srivastava',
  interviewerFirstName: 'Priyanshu',
  interviewerEmail: 'interviewer@example.com',
  interviewerTimezone: 'Asia/Kolkata',
  interviewerDay: 'Tue 8 Sept',
  interviewerTime: '18:30',
  localDay: 'Tue 8 Sept',
  localTime: '18:30',
  ukTime: '14:00',
  timezone: 'Asia/Kolkata',
  startsAt: '2026-09-08T13:00:00.000Z',
  endsAt: '2026-09-08T13:30:00.000Z',
  meetLink: null,
  token: 'EXAMPLE-TOKEN-NOT-A-REAL-ONE',
};

// ── On submitting ───────────────────────────────────────────────────────────

registerTemplate({
  key: 'recruit.ack',
  title: 'Application received',
  when: 'Immediately after someone submits an application.',
  description:
    'Confirms we have it and sets the 48-hour expectation, so nobody is left wondering whether it arrived. Repeats the AI-use warning from the form, which is the last chance to say it before their answers are marked.',
  mergeFields: ['firstName', 'roleTitle'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: 'Fast Action Claims — we have your application',
    ...bodyBoth({
      heading: 'We have your application',
      preview: 'Thanks - we review every application ourselves, within 48 hours.',
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `Thank you for applying for the ${data.roleTitle} at Fast Action Claims. Your application and CV have reached us safely.`,
      '',
      "We review every application ourselves rather than filtering them automatically, so please give us up to 48 hours. You'll hear from us either way — we don't leave people wondering.",
      '',
      'One reminder, because it matters: we use AI detection on every application. If your answers appear to have been written by ChatGPT or any other AI tool, your application will be discredited and will not be considered. We are looking for your own words, not polished ones.',
    
      ],
    }),
  }),
});

// ── Decisions — the client's own copy, unchanged ────────────────────────────

const acceptEmail = ({ key, title, country, heading, opening, decision, timesNote, closing }) =>
  registerTemplate({
    key,
    title,
    audience: 'candidate',
    when: 'When a manager accepts an applicant. Carries their booking link.',
    description: `Wording and layout supplied by the client, in the ${country} template. Unchanged.`,
    mergeFields: ['firstName', 'token'],
    sample: SAMPLE,
    load,
    render: (data) => {
      const link = bookingUrl(data.token);
      return {
        subject: `Fast Action Claims — ${heading}`,
        text: [
          `Dear ${data.firstName},`,
          '',
          opening,
          '',
          `${decision} The next step is a ${key === 'recruit.india.accept' ? 'short video interview' : 'video interview'} with ${data.interviewerName}, our Admin Manager, to discuss the role, your experience and ${key === 'recruit.india.accept' ? 'what to expect if you join our team' : 'the terms of the position'}.`,
          '',
          `Please choose a date and time that suits you using the link below — you'll only see slots that are still available${timesNote}:`,
          '',
          `▶ Book your interview: ${link}`,
          '',
          MEETING_NOTE_TEXT,
          '',
          closing,
          '',
          SIGN_OFF,
        ].join('\n'),
        html: shell({
          heading,
          preview: `Book your interview with ${data.interviewerName}, our Admin Manager.`,
          body: [
            greeting(data.firstName),
            p(esc(opening)),
            p(
              `${esc(decision)} The next step is a ${key === 'recruit.india.accept' ? 'short video interview' : 'video interview'} with ${esc(data.interviewerName)}, our Admin Manager, to discuss the role, your experience and ${key === 'recruit.india.accept' ? 'what to expect if you join our team' : 'the terms of the position'}.`,
            ),
            p(
              `Please choose a date and time that suits you using the button below &mdash; you'll only see slots that are still available${esc(timesNote)}.`,
            ),
            callout(MEETING_NOTE_HTML),
            button(link, 'Book your interview'),
          ].join('\n'),
        }),
      };
    },
  });

acceptEmail({
  key: 'recruit.india.accept',
  title: 'Shortlisted — India',
  country: 'India',
  heading: "You've been shortlisted",
  opening:
    'Thank you for applying for the Paralegal Internship at Fast Action Claims via Internshala.',
  decision: "We're delighted to let you know that your application has been successful.",
  timesNote: ', shown in your local time (IST)',
  closing: 'Congratulations, and we look forward to speaking with you soon.',
});

acceptEmail({
  key: 'recruit.sa.accept',
  title: 'Shortlisted — South Africa',
  country: 'South Africa',
  heading: 'Interview invitation',
  opening: 'Thank you for applying for the full-time Paralegal position at Fast Action Claims.',
  decision: "We're pleased to let you know that your application has been shortlisted.",
  timesNote: ', shown in your local time (SAST)',
  closing: 'We look forward to speaking with you.',
});

const declineEmail = ({ key, title, country, opening, body, closing }) =>
  registerTemplate({
    key,
    title,
    when: 'When a manager declines an applicant.',
    description: `Wording and layout supplied by the client, in the ${country} template. Unchanged.`,
    mergeFields: ['firstName'],
    sample: SAMPLE,
    load,
    render: (data) => ({
      subject: 'Fast Action Claims — Application update',
      text: [`Dear ${data.firstName},`, '', opening, '', body, '', closing, '', SIGN_OFF].join('\n'),
      html: shell({
        heading: 'Application update',
        preview: 'An update on your application to Fast Action Claims.',
        body: [greeting(data.firstName), p(esc(opening)), p(esc(body)), p(esc(closing))].join('\n'),
      }),
    }),
  });

declineEmail({
  key: 'recruit.india.decline',
  title: 'Not successful — India',
  country: 'India',
  opening:
    'Thank you for taking the time to apply for the Paralegal Internship at Fast Action Claims via Internshala.',
  body: "After careful consideration, we've decided not to progress your application on this occasion. This doesn't reflect on your abilities — we received a very high volume of applications and the selection was competitive.",
  closing: 'We appreciate your interest in our firm and wish you every success in your career.',
});

declineEmail({
  key: 'recruit.sa.decline',
  title: 'Not successful — South Africa',
  country: 'South Africa',
  opening:
    'Thank you for taking the time to apply for the full-time Paralegal position at Fast Action Claims.',
  body: "After careful consideration, we've decided not to take your application further on this occasion. We had a strong field of applicants and the decision was a close one.",
  closing: 'We appreciate your interest in the firm and wish you every success in your career.',
});

// ── Booking ─────────────────────────────────────────────────────────────────

registerTemplate({
  key: 'recruit.booking.confirmed',
  title: 'Interview booked',
  when: 'When a candidate chooses their slot.',
  description:
    'Confirms the time in both zones and attaches a calendar file they can add to their own diary. Once stage 7 creates the Google event, this also carries the Meet link — no change needed here.',
  mergeFields: ['firstName', 'localDay', 'localTime', 'ukTime', 'interviewerName', 'meetLink'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: `Your interview is booked — ${data.localDay} at ${data.localTime}`,
    ...bodyBoth({
      heading: 'Your interview is booked',
      preview: `${data.localDay} at ${data.localTime} - a calendar file is attached.`,
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `Your interview with ${data.interviewerName} is booked for ${whenLine(data)}.`,
      '',
      'It lasts about 30 minutes and takes place on video.',
      joinLine(data),
      '',
      'A calendar file is attached so you can add it to your own diary.',
      '',
      'Need to change it? Use the same booking link we sent you — you can move it up to two hours beforehand.',
    
      ],
    }),
    attachments: data.startsAt
      ? [
          {
            filename: 'interview.ics',
            content: buildIcs({
              uid: `interview-${data.startsAt}@fastactionclaims.co.uk`,
              startsAt: data.startsAt,
              endsAt: data.endsAt,
              summary: `Interview — ${data.roleTitle} — Fast Action Claims`,
              description: `Interview with ${data.interviewerName}. ${joinLine(data)}`,
              location: data.meetLink ?? 'Video call — link to follow',
              organiserEmail: process.env.MAIL_FROM || 'recruitment@fastactionclaims.co.uk',
              attendeeEmail: data.email,
            }),
            contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
          },
        ]
      : [],
  }),
});

registerTemplate({
  key: 'recruit.rescheduled',
  title: 'Interview moved',
  when: 'When a candidate moves their interview to a different time.',
  description: 'Confirms the new time, so the old one cannot linger in their diary as the one they remember.',
  mergeFields: ['firstName', 'localDay', 'localTime', 'ukTime'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: `Your interview has moved — ${data.localDay} at ${data.localTime}`,
    ...bodyBoth({
      heading: 'Your interview has moved',
      preview: `Your new time is ${data.localDay} at ${data.localTime}.`,
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `Your interview is now ${whenLine(data)}.`,
      '',
      'Please delete the earlier time from your diary if you added it.',
      joinLine(data),
    
      ],
    }),
  }),
});

/**
 * The only email in here addressed to us rather than to a candidate.
 *
 * It exists because a booking the interviewer never hears about is a booking
 * that does not happen. Times are given in their own zone first — that is the
 * day they are actually standing in — with the candidate's local time beside
 * it, so neither party is the one doing the arithmetic.
 */
registerTemplate({
  key: 'recruit.interviewer.booked',
  title: 'New interview in your diary',
  when: 'To the interviewer, when a candidate books or moves a slot.',
  description:
    'Sent to the interviewer rather than the candidate, so a booking cannot happen without them knowing. Carries the candidate’s name, role and address, the time in the interviewer’s own zone and the candidate’s, and a calendar file. Sent to the address on the Settings screen; if none is set, nothing is queued and the booking still succeeds.',
  mergeFields: ['interviewerFirstName', 'fullName', 'roleTitle', 'interviewerDay', 'interviewerTime', 'localTime', 'ukTime'],
  sample: { ...SAMPLE, moved: false },
  load,
  render: (data) => ({
    subject: data.moved
      ? `Interview moved — ${data.fullName} — ${data.interviewerDay} at ${data.interviewerTime}`
      : `New interview — ${data.fullName} — ${data.interviewerDay} at ${data.interviewerTime}`,
    ...bodyBoth({
      heading: 'New interview in your diary',
      preview: `${data.fullName} - ${data.interviewerDay} at ${data.interviewerTime}.`,
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.interviewerFirstName || 'there'},`,
      '',
      data.moved
        ? `${data.fullName} has moved their interview.`
        : `${data.fullName} has booked an interview with you.`,
      '',
      `When:      ${data.interviewerDay} at ${data.interviewerTime} (your time)`,
      `           ${data.ukTime} UK time — ${data.localTime} for the candidate`,
      `Candidate: ${data.fullName} <${data.email}>`,
      `Role:      ${data.roleTitle}`,
      '',
      data.moved ? 'Please remove the earlier time from your diary.' : 'A calendar file is attached.',
      joinLine(data),
    
      ],
    }),
    attachments: data.startsAt
      ? [
          {
            filename: 'interview.ics',
            content: buildIcs({
              uid: `interviewer-${data.startsAt}@fastactionclaims.co.uk`,
              startsAt: data.startsAt,
              endsAt: data.endsAt,
              summary: `Interview — ${data.fullName} — ${data.roleTitle}`,
              description: `Candidate: ${data.fullName} <${data.email}>. ${joinLine(data)}`,
              location: data.meetLink ?? 'Video call — link to follow',
              organiserEmail: process.env.MAIL_FROM || 'recruitment@fastactionclaims.co.uk',
              attendeeEmail: data.interviewerEmail ?? undefined,
            }),
            contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
          },
        ]
      : [],
  }),
});

// ── The joining link, sent by hand ──────────────────────────────────────────

/**
 * Sent when somebody pastes the video link into the dashboard.
 *
 * Until the calendar integration creates meetings itself, this is how a
 * candidate gets a link at all. The link is SAVED on the interview as well as
 * emailed, which is the part that matters: every later email resolves its
 * merge fields at send time, so both reminders start carrying it too without
 * anybody sending a second thing.
 */
registerTemplate({
  key: 'recruit.meet.link',
  title: 'Your joining link',
  when: 'When a manager sends the video link from the dashboard.',
  description:
    'The link to join the interview, sent on its own. Saving it also means the 24-hour and 10-minute reminders carry it from then on, so this is normally sent once and never repeated.',
  mergeFields: ['firstName', 'localDay', 'localTime', 'ukTime', 'meetLink'],
  sample: { ...SAMPLE, meetLink: 'https://teams.microsoft.com/l/meetup-join/EXAMPLE' },
  load,
  render: (data) => ({
    subject: `Your interview link — ${data.localDay} at ${data.localTime}`,
    ...bodyBoth({
      heading: 'Your joining link',
      preview: 'The link to join your interview.',
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `Here is the link for your interview with ${data.interviewerName}, ${whenLine(data)}.`,
      '',
      `Join here: ${data.meetLink}`,
      '',
      'It is worth opening the link a few minutes early the first time, in case your browser asks permission for the camera and microphone.',
      '',
      'If the link does not work on the day, reply to this email straight away.',
    
      ],
    }),
  }),
});

registerTemplate({
  key: 'recruit.cancelled',
  title: 'Interview cancelled',
  when: 'When a candidate cancels their interview.',
  description:
    'Acknowledges the cancellation and says how to come back, so someone who cancelled by accident is not stuck.',
  mergeFields: ['firstName'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: 'Your interview has been cancelled',
    ...bodyBoth({
      heading: 'Your interview has been cancelled',
      preview: 'Nothing further is needed from you.',
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      'We have cancelled your interview as requested. Nothing further is needed from you.',
      '',
      'If that was a mistake, or you would like to rebook, just reply to this email and we will send you a new link.',
    
      ],
    }),
  }),
});

// ── Reminders ───────────────────────────────────────────────────────────────

registerTemplate({
  key: 'recruit.reminder.24h',
  title: 'Reminder — 24 hours before',
  when: 'Twenty-four hours before the interview starts.',
  description: 'Far enough ahead that someone who has a clash can still move it.',
  mergeFields: ['firstName', 'localDay', 'localTime', 'ukTime'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: `Your interview is tomorrow — ${data.localTime}`,
    ...bodyBoth({
      heading: 'Your interview is tomorrow',
      preview: `Tomorrow at ${data.localTime} - move it now if you cannot make it.`,
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `A reminder that your interview with ${data.interviewerName} is ${whenLine(data)} — tomorrow.`,
      '',
      joinLine(data),
      '',
      'It helps to find a quiet spot with a steady connection, and to have a few questions ready.',
      '',
      'If you can no longer make it, please use your booking link to move it rather than leaving it — you can change it up to two hours beforehand.',
    
      ],
    }),
  }),
});

registerTemplate({
  key: 'recruit.reminder.10m',
  title: 'Reminder — 10 minutes before',
  when: 'Ten minutes before the interview starts.',
  description: 'The nudge that turns a booking into an attendance. Deliberately short — it is read on a phone.',
  mergeFields: ['firstName', 'localTime', 'meetLink'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: 'Your interview starts in 10 minutes',
    ...bodyBoth({
      heading: 'Your interview starts in 10 minutes',
      preview: `Starting at ${data.localTime}.`,
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `Your interview with ${data.interviewerName} starts at ${data.localTime} — in about ten minutes.`,
      '',
      joinLine(data),
    
      ],
    }),
  }),
});

// ── Afterwards ──────────────────────────────────────────────────────────────

registerTemplate({
  key: 'recruit.noshow',
  title: 'We missed you',
  when: 'When a manager records that a candidate did not attend.',
  description:
    'Offers one rebook. Worded on the assumption something went wrong rather than that they could not be bothered — because usually something did.',
  mergeFields: ['firstName', 'token'],
  sample: SAMPLE,
  load,
  render: (data) => ({
    subject: 'We missed you — would you like to rebook?',
    ...bodyBoth({
      heading: 'We missed you',
      preview: 'Rebook whenever suits - your link is inside.',
      signOff: SIGN_OFF,
      lines: [
      `Hi ${data.firstName},`,
      '',
      `We were expecting you for your interview with ${data.interviewerName} and were not able to speak to you.`,
      '',
      'These things happen — a connection drops, a calendar goes wrong, a day gets away from you. If you would still like to be considered, you can pick a new time here:',
      '',
      `▶ Book a new time: ${bookingUrl(data.token)}`,
      '',
      'If we do not hear from you we will assume you would rather not go ahead, and we will close your application.',
    
      ],
    }),
  }),
});

/** Imported for its side effects; exported so a caller can assert it loaded. */
export const TEMPLATE_COUNT = 11;
