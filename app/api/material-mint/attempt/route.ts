import { materialRequest } from '@/src/lib/material-mint/server/service';
export async function POST(request: Request) { return materialRequest(request, 'attempt'); }
export async function PATCH(request: Request) { return materialRequest(request, 'attempt'); }
