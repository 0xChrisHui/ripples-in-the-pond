import { materialOrdersGet } from '@/src/lib/material-mint/server/service';
export async function GET(request: Request) { return materialOrdersGet(request); }
