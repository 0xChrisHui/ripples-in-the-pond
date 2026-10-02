import { materialRequest } from '@/src/lib/material-mint/server/service';
export async function POST(request: Request) { return materialRequest(request, 'prepare'); }
