import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware-Passwort-Gate (siehe CLAUDE.md): schuetzt die Demo-Deployment
// gegen fremde Besucher/Crawler, die das taegliche Groq-Free-Tier-Kontingent
// verbrauchen koennten, bevor der Reviewer die App testet. Kein Vercel-Add-on
// noetig. In Next.js 16 heisst die Datei "proxy.ts" (frueher "middleware.ts").
export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const suppliedPassword = decoded.slice(separatorIndex + 1);
    if (suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentifizierung erforderlich.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NotebookLM-Klon"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
