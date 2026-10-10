const PRIMARY_URL = "https://massage-infos.github.io/go";
const BACKUP_URL = "https://google.com";

const NORMAL_INTERVAL = 1 * 60 * 1000;
const BACKUP_INTERVAL = 2 * 60 * 1000;
const TIMEOUT_MS = 10000;

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
      console.log("Primary HTTP error:", response.status);
      return false;
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      await response.body?.cancel();
      return true;
    }

    const html = await response.text();
    const match = html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    const title = match
      ? match[1]
          .replace(/<[^>]*>/g, "")
          .replace(/&amp;/gi, "&")
          .trim()
          .toLowerCase()
      : "";

    const notFound =
      title.includes("Site not found") ||
      title.includes("GitHub Pages") ||
      title.includes("404");

    console.log("Primary title:", title);

    return !notFound;
  } catch (error) {
    console.log("Primary check failed:", String(error));
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async scheduled(controller, env, ctx) {
    const now = Date.now();

    const status =
      await env.HEALTH.get("destination");

    const lastCheck = Number(
      await env.HEALTH.get("last_check") || 0
    );

    // In backup mode, check primary only every 2 hours.
    if (
      status === "backup" &&
      now - lastCheck < BACKUP_INTERVAL
    ) {
      console.log("Backup mode: check not due yet.");
      return;
    }

    // Normal mode checks on each 5-minute cron run.
    await env.HEALTH.put(
      "last_check",
      String(now)
    );

    const isWorking = await checkPrimary();

    const newStatus = isWorking ? "primary" : "backup";

    await env.HEALTH.put(
      "destination",
      newStatus
    );

    console.log("New destination status:", newStatus);
  },

  async fetch(request, env) {
    const status =
      await env.HEALTH.get("destination");

    // Before the first health check, use backup safely.
    const destination =
      status === "primary" ? PRIMARY_URL : BACKUP_URL;

    return Response.redirect(destination, 302);
  }
};
