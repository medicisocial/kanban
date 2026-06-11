/** True when Supabase owns workspace data (not localStorage). Safe in Node tests and Vite. */
export function isCloudSourceOfTruth() {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_SUPABASE === 'true') ||
    process.env.VITE_USE_SUPABASE === 'true'
  );
}
