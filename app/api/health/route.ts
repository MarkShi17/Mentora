import { NextResponse } from 'next/server';
import { HealthResponse } from '@/types/api';

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: Date.now(),
    version: '0.1.0',
  };

  return NextResponse.json(response);
}
