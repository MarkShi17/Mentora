import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware for CORS handling
 *
 * This middleware automatically adds CORS headers to all API responses,
 * preventing CORS errors when frontend (localhost:3001) calls backend (localhost:3000).
 *
 * Applied to all /api/* routes.
 */
export function middleware(request: NextRequest) {
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    });
  }

  // For all other requests, add CORS headers to the response
  const response = NextResponse.next();

  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  return response;
}

// Apply middleware only to API routes
export const config = {
  matcher: '/api/:path*',
};
