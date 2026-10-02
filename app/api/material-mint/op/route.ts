import { opSbtRequest } from '@/src/lib/material-mint/server/op/service';
export async function POST(request: Request) { return opSbtRequest(request); }
