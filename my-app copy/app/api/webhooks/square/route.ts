import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SQUARE_WEBHOOK_SECRET = process.env.SQUARE_WEBHOOK_SECRET || '';

function verifySignature(body: string, signature: string, url: string): boolean {
  const hmac = createHmac('sha256', SQUARE_WEBHOOK_SECRET);
  const hash = hmac.update(url + body).digest('base64');
  return hash === signature;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-square-signature') || '';
  const url = request.url;
  
  if (!verifySignature(body, signature, url)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = JSON.parse(body);
  console.log('Square webhook:', event.type);
  
  // Handle webhook events here
  // See full implementation in system design doc
  
  return NextResponse.json({ success: true });
}
