/** Keep account SDK code out of the initial public-page JavaScript. */
export async function loadBrowserClient() {
  const {createClient} = await import('./client');
  return createClient();
}
