/**
 * Copies a chosen file into memory, straight away.
 *
 * A File from an <input> is a handle to something on the device, read only
 * when the upload happens. Phones revoke that handle — the picker's temporary
 * copy is cleaned up, or the app is backgrounded for a moment — and the
 * upload then fails minutes later at Submit with no reply at all. Reading the
 * bytes at selection time takes the device out of it.
 *
 * Throws if the file cannot be read now; callers ask the candidate to choose
 * it again.
 */
export async function readIntoMemory(file) {
  const bytes = await file.arrayBuffer();
  return new File([bytes], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

export default readIntoMemory;
