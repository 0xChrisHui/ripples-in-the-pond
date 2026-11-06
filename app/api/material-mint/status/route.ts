import { materialStatusBatch } from '@/src/lib/material-mint/server/status-batch';

/** 本人全部原曲铸造状态（OP 收藏记录 + 以太坊订单）：登录与进入 /lens 时各调用一次。 */
export async function GET(request: Request) { return materialStatusBatch(request); }
