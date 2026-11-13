# 香港节点运维

**代码准备不等于启用加速。** 当前 `EDGE_PROXY_SECRET`、`MEDIA_BLOB_ORIGIN` 均可留空；播放器仍使用原 Blob 地址。购买香港机器、AWS、DNS、证书、生产环境变量及切换流量均留白天。故障/带宽演练须在线路验收后执行。

本目录不含真实密钥。生成目录必须在仓库外；服务器只放 TLS、受限 DNS-01 IAM 和 edge 密钥，不放应用、数据库或钱包密钥。以下命令是操作手册，尚未执行。

## 1. 前置条件

- 从 Vercel 域名页记录独立回源主机名及推荐 IPv4，不能拿 `pond-ripple.xyz` 或 `edge-cn` 回源。公开 DNS 当前值不能替代此页的推荐目标。
- 导出全量 DNS（排除 NS/SOA 后复制），核实无通配符依赖；CAA 允许证书机构。迁移 NS 前将 Route 53 普通 A 指向原 Vercel，先验证全球访问与邮件 SPF/DKIM/DMARC。过渡 48 小时内保留两边记录、同步变更。不新增 AAAA。
- 香港 Debian 12、2 核 2G、IPv4、按流量付费，初始 50Mbps。白天与 20–23 点分别验实际 HTTPS 下载速度和大陆多地线路，失败就换线路。基础镜像只保存加固后的系统与 nginx，不带任何密钥/证书/缓存；新机器重新生成 SSH 主机密钥。
- 新建 deploy 用户、仅 SSH 密钥登录、关闭 root/密码登录、防火墙只开放 22/80/443、自动安全更新与时间同步；设预算和余额告警。

```bash
sudo apt-get update
sudo apt-get install nginx python3 curl openssl ca-certificates util-linux logrotate mailutils unattended-upgrades
nginx -V 2>&1 | grep -- --with-http_slice_module
```

## 2. 先发布兼容代码，再准备节点

应用部署第一步只设置服务端 `MEDIA_BLOB_ORIGIN=https://实际Blob主机名`（无 `/media`）。生产镜像地址不改，edge 密钥不设。部署后对 `/media/<已核验txid>` 检查完整 GET、Range、缓存头与完整 SHA-256；`/api/ping` 应为 `x-pond-ip-source: direct`。将此部署记为回滚基线：之后不能回到没有 `/media` 改写的老部署。

应用只接受公开 `*.public.blob.vercel-storage.com` 的 HTTPS origin，拒绝本站和 edge-cn 的尾点/大小写变体。中间件额外匹配精确43位 `/media`，仅保留媒体必要头后转发；Cookie、Authorization、edge密钥及其他客户端凭据不能到达外部Blob。香港 `/media` 也清除 Cookie/Authorization，API鉴权头保持原样。

把本目录复制到服务器 `/opt/pond-edge`。32 字节随机密钥从文件交付，不贴聊天、不写命令参数：

```bash
sudo install -d -m 700 /etc/pond-edge
sudo sh -c 'umask 077; openssl rand -hex 32 > /etc/pond-edge/edge-secret.hex'
sudo python3 /opt/pond-edge/render.py --upstream "$VERCEL_ORIGIN" \
  --output /etc/nginx/pond-edge --secret-file /etc/pond-edge/edge-secret.hex
sudo chmod 750 /etc/nginx/pond-edge
```

`VERCEL_ORIGIN` 是人工核验的独立主机名。生成器拒绝指向本站、路径和配置注入。密钥写入独立 `edge-secret.conf`（600）；非 API 明确清除客户端伪造的两个 edge 头。不要运行 `nginx -T` 把密钥打印进日志或聊天。

## 3. DNS-01 证书与续期

先在 AWS 建 hosted zone，再将 `aws/iam-dns-acme.json` 的 `__ZONE_ID__` 替换为真实区域 ID。该用户只能改 `_acme-challenge.pond-ripple.xyz` 的 TXT。DNS 运维用户用独立策略；其健康检查生命周期权限为全账号范围，切勿与续证用户混用。AWS 主账号开 MFA，不生成主账号密钥。

按 [acme.sh 官方说明](https://github.com/acmesh-official/acme.sh/wiki/How-to-use-Amazon-Route53-API)安装 acme.sh。AWS 两项凭据保存在服务器 root 独有的 `/etc/pond-edge/acme.env`，权限 600；不要输入到聊天。安装前核验官方脚本来源，不把不明网络内容直接管道执行。

```bash
sudo install -d -m 700 /etc/ssl/pond-edge
sudo -i
set -a
. /etc/pond-edge/acme.env
set +a
~/.acme.sh/acme.sh --issue --dns dns_aws -d pond-ripple.xyz --server letsencrypt --keylength ec-256
~/.acme.sh/acme.sh --install-cert -d pond-ripple.xyz --ecc \
  --key-file /etc/ssl/pond-edge/key.pem --fullchain-file /etc/ssl/pond-edge/fullchain.pem \
  --reloadcmd 'nginx -t -c /etc/nginx/pond-edge/nginx.conf && systemctl reload pond-edge'
```

首次启动前 reload 可能失败，先确认固定路径证书存在再启服务。用 Let's Encrypt staging 单独测试域名/独立 acme home 演练签发、续期和 reload，不能用测试证书覆盖正式路径。续期依靠 acme 自带 cron；上线前手动确认 cron、reload 回执和正式证书到期日。Route 53 HTTPS 健康检查不验证证书，不能替代到期监控。HTTP-01 会从海外命中 Vercel，禁止使用。

## 4. 启服务与检查

先停用 Debian 默认 nginx 服务，确认其没有承载其他站点；若承载其他站点，不执行停用，先由运维合并监听配置。

```bash
sudo systemctl disable --now nginx
sudo install /opt/pond-edge/conf/pond-edge.service /etc/systemd/system/pond-edge.service
sudo install /opt/pond-edge/conf/upstream.service /etc/systemd/system/pond-edge-upstream.service
sudo install /opt/pond-edge/conf/upstream.timer /etc/systemd/system/pond-edge-upstream.timer
sudo install /opt/pond-edge/conf/logrotate.conf /etc/logrotate.d/pond-edge
sudo chmod +x /opt/pond-edge/*.sh
sudo systemctl daemon-reload
sudo systemctl enable --now pond-edge
```

Vercel Production 设置同一 `EDGE_PROXY_SECRET` 并重新部署后，配置 `/etc/default/pond-edge` 的 `POND_ALERT_EMAIL`，验一封实际告警，再开启 `pond-edge-upstream.timer`。每分钟本机 nginx 经独立 Vercel 目标请求 `/api/ping`；连续三次失败创建 `/var/lib/pond-edge/upstream.failed`，本地健康端点返回 503，恢复即移除。每分钟检查磁盘/inode ≥80%、证书不足14天，同类告警六小时去重；外部大陆监控仍必须单独配置。

```bash
sudo systemctl enable --now pond-edge-upstream.timer
bash /opt/pond-edge/edge-check.sh "$HK_IP" "$HASHED_STATIC_PATH" "$VERIFIED_TXID" "$MEDIA_SHA256" "$REPO_PATH"
bash /opt/pond-edge/edge-warm.sh "$HK_IP" "$REPO_PATH" "$BLOB_INVENTORY_JSON"
```

清单须来自本次 Blob 盘点，H4 历史清单不是当前完整库存。`edge-check` 只读、不写健康标记；冷缓存场景要先在未承载流量的新节点或批准的清缓存窗口跑，不能把已热请求冒充冷缓存。另手动 `touch` 健康标记检查503、移除检查200。从大陆真实浏览器验首页、原曲、Score/Echo 的完整 GET 和拖动进度、短信登录；Privy/钱包/封面/旧永久JSON/Semi注册仍直连第三方。

## 5. DNS 与镜像切换（顺序固定）

`aws/*.json` 是有明确替换参数的模板，不是可直接提交的生产请求。填好 Zone ID、香港 IP、Vercel 推荐 A、每节点健康检查 ID 和唯一 CallerReference 后检查 JSON 不再含 `__…__`。用 `aws route53 create-health-check --cli-input-json file://health-check.json` 创建检查，从节点日志确认 IP/FQDN/SNI 均打到本机且健康。

先通过 `aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID"` 保存完整快照。如果根域已有简单 A，把它的**原始完整记录**用 DELETE 与模板里的地理位置 UPSERT 合入同一 ChangeBatch，避免简单与地理记录并存校验失败。所有其他 TXT/MX/CAA 不动。再执行：

```bash
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file://dns-records.json
```

默认记录始终指向 Vercel、不挂检查；中国别名评估 `edge-cn` 目标健康；每台香港机器有独立加权记录和独立检查。全部香港节点不健康时中国回退默认。NS 回滚是小时级；地理记录变更通常分钟级，以大陆实测为准。海外 DoH 的大陆用户可能仍直连 Vercel。

先观察大陆流量1小时、IP限流key是否分散、Vercel是否质询香港IP和用量变化，再观察24小时。确认通过后才把生产 `NEXT_PUBLIC_MEDIA_MIRROR_BASE_URL` 改成完整的 `https://pond-ripple.xyz/media` 并重新部署；Preview 继续 Blob。保留 `/media` 改写，逐对象404回退与 Range 应在真实线路再验。

## 6. 轮换、清缓存与回滚

密钥轮换：Vercel 设置新值、PREVIOUS放旧值并部署 → 服务器替换密钥文件、重跑 render、`nginx -t` 后 reload → 删除 Vercel PREVIOUS 再部署。泄露时直接撤销泄露值，接受短时IP限流误伤。

清缓存只针对本配置的固定目录，先停本节点、核实绝对路径、重新建空目录再启动；禁止对计算出的未核实路径递归删除：

```bash
sudo systemctl stop pond-edge
sudo find /var/cache/pond-edge/objects -mindepth 1 -delete
sudo systemctl start pond-edge
```

- 香港/线路异常：删除“中国”地理记录，保留默认 Vercel。DNS 缓存通常几分钟，不能保证即时。
- 音频异常：生产镜像变量改回原 Blob 并重新部署；只回到本期 `/media` 基线或更新部署，保留改写。已打开页面仍须能取旧地址。
- 错误缓存：按上面流程清空缓存；之后有回源压力。
- NS迁移异常：注册商换回 Vercel NS，等待小时级委派缓存；两边DNS原记录均须保留。

预算报警先查日志异常IP/路径，必要时封禁、调低带宽或DNS回滚；预算不会自动停机。Vercel 是共同依赖，Vercel额度/服务故障无法靠DNS回退救活。

## 7. 扩缩容与演练（线路验收后）

带宽估算：同时首次访问人数 × 每人MB × 8 ÷ 目标秒数 ×1.5。不要把本机代理路径测速算作大陆线路结果。

方案A：宣发前在所属云控制台把**按流量付费的同一实例**带宽上限从50调到100–200Mbps → 运行预热与检查 → 峰值后调回50。云厂商/实例尚未选定，本手册不填猜测的跨云CLI；可用其控制台的实际“调整公网带宽”操作，记录实例ID、计费方式、调整前后值与账单。没有受限子账号授权就由用户亲自执行。

方案B：从无密钥基础镜像按量创建HK2 → 重新生成SSH主机密钥 → 独立签证书、装edge密钥 → 预热/检查 → `edge-cn` 添加HK2加权记录与它自己的健康检查。缩容时先删除HK2的记录与检查 → 等10分钟 → 释放实例；保留HK1。

故障演练：低峰停HK1的pond-edge，记录大陆DNS回退耗时，恢复后记录回切；再放上游失败标记演练“节点活着但无法回源”。带宽演练按方案A升档再降档，记录实际生效与费用。两种演练均可能影响大陆访问，香港购买与线路验证未完成时不能执行。

缓存只覆盖哈希静态、精确No.N.mp3和43位txid；`/sounds` 的33个本地音效无hash/版本参数，本期维持不缓存。HTML、RSC、API、`/_next/image`、`/tracks/pond`、`/tracks/archive` 全不缓存。静态/media丢弃参数，原曲只接收合法64位hash的v；416/5xx不缓存、404一分钟、Set-Cookie不缓存，切勿放宽。

## 本地复核

`npm run p25:test` 检查IP、改写、媒体头清洗和自检/运维脚本边界；`npm run p25:nginx` 使用独立临时目录、回环端口及真实nginx验证缓存与Range。Windows测试实例单进程，生产模板保持多进程；可用 `POND_NGINX_BIN`、`POND_PYTHON`、`POND_CA_BUNDLE` 指定本机工具。

生产构建后运行 `npm run p25:media`，会仅在该工作区的构建产物临时把媒体目标改成本地可观测源，用真实Next中间件与外部改写验证凭据canary清除、Range/If-Range保留，结束恢复原产物。该演练不证明香港真实线路、Vercel CDN或TLS回源已经验收。
