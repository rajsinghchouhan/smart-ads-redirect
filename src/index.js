const PRIMARY_URL = "https://abc.com";
const BACKUP_URL = "https://suraj.com";
const TIMEOUT_MS = 2500;

async function checkPrimary() {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(PRIMARY_URL, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }

    const type = response.headers.get("content-type") || "";

    if (!type.includes("text/html")) {
      await response.body?.cancel();
      return true;
    }

    const html = await response.text();
    const match = html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    const title = match
      ? match[1].replace(/<[^>]*>/g, "").toLowerCase()
      : "";

    const notFound =
      title.includes("not found") ||
      title.includes("page not found");

    return !notFound;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch() {
    const primaryIsWorking = await checkPrimary();

    const destination = primaryIsWorking
      ? PRIMARY_URL
      : BACKUP_URL;

    return Response.redirect(destination, 302);
  }
};
