import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/create(.*)']);

function papayaHost(host: string | null): boolean {
  const h = (host ?? '').split(':')[0]?.toLowerCase() ?? '';
  return h === 'bypapaya.com' || h === 'www.bypapaya.com';
}

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get('host');
  if (papayaHost(host)) {
    const url = req.nextUrl.clone();
    const path = url.pathname;

    if (path === '/favicon.ico') {
      url.pathname = '/papaya-favicon.svg';
      return NextResponse.rewrite(url);
    }

    if (path === '/' || path === '') {
      url.pathname = '/papaya-site';
      return NextResponse.rewrite(url);
    }

    if (
      path.startsWith('/papaya-site')
      || path.startsWith('/_next')
      || path.startsWith('/api')
      || /\.[a-zA-Z0-9]+$/.test(path)
    ) {
      // allow papaya page, Next internals, APIs, static files
    } else {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

