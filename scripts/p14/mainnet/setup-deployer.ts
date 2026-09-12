import '../../_env';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const output = join(homedir(), '.config', 'ripples-in-the-pond', 'p14-mainnet-deployer.json');
type State = { chainId: 10; privateKey: `0x${string}` };

function validate(state: State): State {
  if (process.env.NEXT_PUBLIC_CHAIN_ID !== '10') throw new Error('只允许 OP Mainnet');
  if (state.chainId !== 10 || !/^0x[0-9a-f]{64}$/i.test(state.privateKey)) {
    throw new Error('P14 主网 deployer 文件无效');
  }
  const address = privateKeyToAccount(state.privateKey).address;
  const admin = getAddress(process.env.ADMIN_ADDRESS ?? '');
  const minter = getAddress(process.env.MINTER_ADDRESS ?? '');
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!operatorKey || !/^0x[0-9a-fA-F]{64}$/.test(operatorKey)) {
    throw new Error('OPERATOR_PRIVATE_KEY 未配置或格式无效');
  }
  const operator = privateKeyToAccount(operatorKey as `0x${string}`).address;
  if (minter.toLowerCase() !== operator.toLowerCase()) {
    throw new Error('MINTER_ADDRESS 必须等于 operator 私钥派生地址');
  }
  if (admin.toLowerCase() === minter.toLowerCase()) throw new Error('admin 与 minter 不得相同');
  if ([admin, minter, operator].some((role) => role.toLowerCase() === address.toLowerCase())) {
    throw new Error('临时 deployer 与长期角色冲突');
  }
  return state;
}

const state = validate(existsSync(output)
  ? JSON.parse(readFileSync(output, 'utf8')) as State
  : { chainId: 10, privateKey: generatePrivateKey() });
if (!existsSync(output)) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: 'utf8', mode: 0o600, flag: 'wx',
  });
}
console.log(JSON.stringify({ chainId: state.chainId,
  address: privateKeyToAccount(state.privateKey).address, path: output }, null, 2));
