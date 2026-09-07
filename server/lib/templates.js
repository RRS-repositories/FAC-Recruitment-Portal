/**
 * The email template registry.
 *
 * The worker deliberately knows nothing about any particular email. It claims
 * a row, asks this registry to turn it into a subject and a body, and sends
 * whatever comes back. Adding an email is registering one more entry; the
 * queue, the retries and the scheduling never change.
 *
 * A template is three things:
 *
 *   load(row, db)  fetches what the email needs, LIVE, at the moment of
 *                  sending. This is the important one. Resolving merge fields
 *                  when the row was queued would mean a candidate who moved
 *                  their interview still receives a reminder for the old time.
 *
 *   render(data)   turns that into { subject, text, html? }. A pure function,
 *                  so it can be tested and previewed without a database.
 *
 *   sample         realistic stand-in data, used to show the manager what a
 *                  template looks like without needing a real candidate. Never
 *                  a real person's details.
 */

const registry = new Map();

export function registerTemplate(template) {
  if (!template?.key) throw new Error('a template needs a key');
  if (typeof template.render !== 'function') throw new Error(`${template.key} needs a render()`);
  registry.set(template.key, template);
  return template;
}

export const getTemplate = (key) => registry.get(key) ?? null;

export const templateKeys = () => [...registry.keys()].sort();

/**
 * Every template, with its sample rendered — what the manager's template
 * screen shows. Never touches the database, so it cannot leak a candidate.
 */
export function describeTemplates() {
  return templateKeys().map((key) => {
    const template = registry.get(key);
    let preview = null;
    let error = null;
    try {
      preview = template.render(template.sample ?? {});
    } catch (failure) {
      // A template that throws on its own sample is broken, and the manager
      // seeing that is far better than a candidate discovering it.
      error = failure.message;
    }
    return {
      key,
      title: template.title ?? key,
      description: template.description ?? '',
      when: template.when ?? '',
      audience: template.audience ?? 'candidate',
      mergeFields: template.mergeFields ?? [],
      preview,
      error,
    };
  });
}

/**
 * Renders one queued row into a sendable message.
 *
 * `load` is given the row and a database handle; whatever it returns is merged
 * over the row's stored `vars` — so anything that can be looked up wins over
 * anything that was frozen at queue time, which is the behaviour that keeps a
 * rescheduled interview from sending yesterday's time.
 */
export async function renderQueued(row, db) {
  const template = getTemplate(row.template);
  if (!template) throw new Error(`no such template: ${row.template}`);

  const loaded = template.load ? await template.load(row, db) : {};
  const data = { ...(row.vars ?? {}), ...loaded };

  const message = template.render(data);
  if (!message?.subject || !message?.text) {
    throw new Error(`${row.template} rendered without a subject or body`);
  }
  return message;
}

/** Only for tests, which register their own throwaway templates. */
export const __clearTemplates = () => registry.clear();
