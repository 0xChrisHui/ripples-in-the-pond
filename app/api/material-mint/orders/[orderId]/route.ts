import { materialOrderGet } from '@/src/lib/material-mint/server/service';
export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return materialOrderGet(request, (await context.params).orderId);
}
