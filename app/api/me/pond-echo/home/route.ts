import { handleHomeEchoRequest } from '@/src/data/echo/home-echo';

export async function GET(request: Request) {
  return handleHomeEchoRequest(request);
}
