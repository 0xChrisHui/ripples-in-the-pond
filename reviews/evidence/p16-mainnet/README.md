# P16 Ethereum Mainnet 部署证据

日期：2026-09-26（Asia/Shanghai）  
状态：合约、正式数据库和 Production 配置完成；正式前端已切至 Ethereum Mainnet，尚未发送第一枚主网 mint。

## 永久合集资料

- JSON：`collection.json`，256 bytes，SHA-256 `4b159888a11dbd9c93adb50515181b2905312c23fc1a18f47be7f3cf9516d857`。
- URI：`ar://T4FV4ZIXgmkc46Nr0tQeER2xEji2PvUla8bQZhiAEjA`。
- `ardrive.net` 与 `arweave.tokyo` 均返回 200、256 bytes、`application/json`、CORS `*`，内容哈希完全一致。
- 合集封面复用已永久上传的 `ar://Y2rwCWgRkHt9pQK1bsuz9T9AYE00mQtYIRwqntTrEJ8`；`arweave.net`、`ardrive.net`、`arweave.tokyo` 三网关均返回相同的 1,247,695 bytes PNG 与 SHA-256 `8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8`。

## 合约部署

- 合约：EthereumScoreNFT，ERC-721、ERC-7572、EIP-712，不可升级。
- 地址：[0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A](https://etherscan.io/address/0xdeC99da00290d15f0742b0abd26e4Cd5d121f02A)。
- 交易：[0x37b4cecbaabdb88b67c49a3df3b7937e3a25762efee1be1ff22e19d86cc0c753](https://etherscan.io/tx/0x37b4cecbaabdb88b67c49a3df3b7937e3a25762efee1be1ff22e19d86cc0c753)。
- 区块：`26060368`；receipt `success`；deployer nonce `0 → 1`。
- Gas：`3,361,901`，effective gas price `0.061618517 Gwei`，实际费用 `0.000207155353920817 ETH`。
- 部署者剩余余额：`0.000792844646079183 ETH`。
- Sourcify：match ID `52712394`，creation/runtime 均为 `exact_match`。

## 链上读回

- name / symbol：`Ripples in the Pond` / `RPIP`。
- admin：`0x305Ef22382A850f6FC5Fd1a15A76d75db3a42722`。
- authorizer：`0xAb14FeFDFBedC67176E1ea6D6461Ad9F07bDe73a`。
- pauser：`0x910380D1C8ad89f9ABf953460044d7b979883194`。
- admin delay：`172800` 秒；`paused=false`。
- deployer 不持有 admin；authorizer 与 pauser 角色均为 true。
- EIP-712：name `Ripples in the Pond`、version `1`、chainId `1`、verifying contract 与部署地址一致。
- ERC-721 与 ERC-7572 interface 均返回 true；`contractURI()` 与上方永久 URI 一致。

## 正式数据库与生产配置

- 正式 Supabase：`uupobbgnhpattyxhxvmc`。
- migration `053–058` 已按顺序执行并登记；部署前正式库没有 P16 表，执行后结构可读。
- 主网集合计数器：`(1, 0xdec99da00290d15f0742b0abd26e4cd5d121f02a) → next_token_id=1`。
- 链上与正式库当前均为 0 个 Ethereum Mainnet 自付订单/已兑付编号。
- Vercel Production 已配置 chainId、合约地址、RPC、部署区块、角色、永久 URI、authorizer secret 与 `2` 个确认数。
- `EXTERNAL_WALLET_LOGIN_MODE=live`、`ETH_SCORE_SELF_MINT_MODE=live`；正式前端开放外部钱包登录与 Ethereum Mainnet 自付铸造。

## 下一步

1. 使用内部钱包完成 Token `#1` 的低成本主网 mint。
2. 核对链上 mapping/event/owner/tokenURI、正式库订单与 claim、永久 metadata、`/score` 页面四方一致。
