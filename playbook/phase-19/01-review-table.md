# P19 中英对照总表（待审）

> 生成自 `src/i18n/messages`，共 585 条。中文为现网原文（一字未改），英文为机器初稿，**尚未校对**。
> 审阅方式：直接在“你的修改”列写新措辞，或告诉我 key + 新译文；改完我会重跑 `npm run i18n:check`。
> `{xxx}` 为程序填入的内容，`{x, select/plural, ...}` 为按状态/数量选词，请保留花括号结构。

## localeSwitch（1 条）

| key | 中文 | 英文 |
|---|---|---|
| `localeSwitch.label` | 切换语言 | Switch language |

## account（3 条）

| key | 中文 | 英文 |
|---|---|---|
| `account.signIn` | 登录 | Sign in |
| `account.myMusic` | 我的音乐 | My music |
| `account.signOut` | 登出 | Sign out |

## login（7 条）

| key | 中文 | 英文 |
|---|---|---|
| `login.eyebrow` | Identity record · 身份页 | Identity record |
| `login.title` | 找回你的音乐档案 | Return to your music archive |
| `login.description` | 登录用于找回你的音乐档案，并继续保存属于你的声音。 | Sign in to return to your music archive and keep saving the sounds that are yours. |
| `login.close` | 关闭登录窗口 | Close sign-in window |
| `login.email` | 使用邮箱登录 | Sign in with email |
| `login.or` | 或 | or |
| `login.emailError` | 邮箱登录未完成，请重试。 | Email sign-in wasn't completed. Please try again. |

## semi（26 条）

| key | 中文 | 英文 |
|---|---|---|
| `semi.register.prompt` | 该手机号尚未注册 SEMI社区身份，请先注册后再登录。 | This phone number has no SEMI community identity yet. Please register first, then sign in. |
| `semi.register.link` | 前往注册 SEMI社区身份 | Register a SEMI community identity |
| `semi.register.linkLabel` | 前往注册 SEMI社区身份（新窗口打开） | Register a SEMI community identity (opens in a new window) |
| `semi.errors.invalidPhone` | 请输入有效的手机号 | Enter a valid phone number |
| `semi.errors.sendFailed` | 发送验证码失败，请稍后重试 | Couldn't send the code. Please try again later. |
| `semi.errors.network` | 网络错误，请稍后重试 | Network error. Please try again later. |
| `semi.errors.codeLength` | 请输入 6 位验证码 | Enter the 6-digit code |
| `semi.errors.codeInvalid` | 验证码无效或已过期 | The code is invalid or has expired |
| `semi.errors.loginFailed` | 登录失败，请稍后重试 | Sign-in failed. Please try again later. |
| `semi.errors.noToken` | 登录失败：未返回 token | Sign-in failed: no token was returned |
| `semi.phone.step` | 01 · SEMI社区身份 | 01 · SEMI community identity |
| `semi.phone.title` | 手机号登录 | Sign in with phone |
| `semi.phone.label` | 手机号 | Phone number |
| `semi.phone.placeholder` | 例如 13800000000 | e.g. 13800000000 |
| `semi.phone.sending` | 发送中… | Sending… |
| `semi.phone.send` | 发送验证码 | Send code |
| `semi.code.back` | ← 修改手机号 | ← Change number |
| `semi.code.step` | 02 · 验证身份 | 02 · Verify |
| `semi.code.title` | 输入验证码 | Enter the code |
| `semi.code.sentTo` | 已发送至 {phone} | Sent to {phone} |
| `semi.code.resendIn` | {seconds}s 后可重新发送 | Resend in {seconds}s |
| `semi.code.resend` | 重新发送验证码 | Resend code |
| `semi.code.signingIn` | 登录中… | Signing in… |
| `semi.code.submit` | 确认并登录 | Confirm and sign in |
| `semi.pin.group` | 六位验证码 | 6-digit code |
| `semi.pin.digit` | 验证码第 {index} 位 | Code digit {index} |

## walletLogin（7 条）

| key | 中文 | 英文 |
|---|---|---|
| `walletLogin.button` | 链上地址登录 | Sign in with wallet |
| `walletLogin.connecting` | 正在连接钱包… | Connecting wallet… |
| `walletLogin.signing` | 请在钱包中签名完成登录… | Approve the signature in your wallet to finish signing in… |
| `walletLogin.note` | 链上地址登录需要一次免费签名，不会发起交易。 | Wallet sign-in needs one free signature. No transaction is sent. |
| `walletLogin.errors.evmOnly` | 请选择 EVM 钱包。 | Please choose an EVM wallet. |
| `walletLogin.errors.connectFailed` | 钱包连接已取消或失败，请重试。 | The wallet connection was cancelled or failed. Please try again. |
| `walletLogin.errors.signFailed` | 钱包已连接，但登录签名未完成。 | The wallet is connected, but the sign-in signature wasn't completed. |

## common（5 条）

| key | 中文 | 英文 |
|---|---|---|
| `common.retry` | 重新读取 | Try again |
| `common.backToPond` | ← 返回水塘 | ← Back to the pond |
| `common.backToPondPlain` | 返回水塘 | Back to the pond |
| `common.loadingPage` | 页面加载中 | Loading page |
| `common.playbackProgress` | 播放进度 | Playback progress |

## nav（5 条）

| key | 中文 | 英文 |
|---|---|---|
| `nav.artist` | 艺术家 | Artist |
| `nav.tracks` | 曲目 | Tracks |
| `nav.main` | 主导航 | Main navigation |
| `nav.openMenu` | 打开主菜单 | Open main menu |
| `nav.closeMenu` | 关闭主菜单 | Close main menu |

## errorPage（2 条）

| key | 中文 | 英文 |
|---|---|---|
| `errorPage.title` | 刚才的水波没有完成 | That ripple didn't finish |
| `errorPage.description` | 页面遇到了临时问题。你可以重新读取；作品凭证和永久资源不会因此改变。 | The page ran into a temporary problem. You can try again; your work's credentials and permanent resources are not affected. |

## notFound（2 条）

| key | 中文 | 英文 |
|---|---|---|
| `notFound.title` | 这里没有这枚唱片 | There's no record here |
| `notFound.description` | 链接可能有误，或这件作品从未存在。数据库暂时不可用时，我们不会把它误报成 404。 | The link may be wrong, or this work never existed. When our database is temporarily unavailable, we won't misreport it as a 404. |

## routeError（9 条）

| key | 中文 | 英文 |
|---|---|---|
| `routeError.artist.eyebrow` | ARTIST / 叶禹含 | ARTIST / 叶禹含 |
| `routeError.artist.title` | 叶禹含的艺术家页面暂时无法读取 | The artist page can't be loaded right now |
| `routeError.artist.description` | 人物与项目介绍没有被占位内容替代。可以重新读取，或先回到水塘。 | We haven't replaced the artist and project introduction with placeholder content. Try again, or head back to the pond for now. |
| `routeError.me.eyebrow` | PERSONAL ARCHIVE · 私人档案 | PERSONAL ARCHIVE |
| `routeError.me.title` | 音乐档案暂时无法读取 | Your music archive can't be loaded right now |
| `routeError.me.description` | 你的唱片、录音和声音素材没有被改动。可以重新读取，或先回到水塘。 | Your records, recordings and sound materials haven't been changed. Try again, or head back to the pond for now. |
| `routeError.score.eyebrow` | PERMANENT RECORD · 永久唱片 | PERMANENT RECORD |
| `routeError.score.title` | 这枚唱片暂时无法读取 | This record can't be loaded right now |
| `routeError.score.description` | 我们不会用占位资料补齐未知信息。可以重新读取，或先回到水塘。 | We won't fill in unknown details with placeholders. Try again, or head back to the pond for now. |

## loading（4 条）

| key | 中文 | 英文 |
|---|---|---|
| `loading.artist` | 正在读取艺术家页面 | Loading the artist page |
| `loading.echoTitle` | 正在沿着涟漪找回作品。 | Following the ripples back to this work. |
| `loading.echoDescription` | 链上持有人与永久 metadata 会分别核验；任何一项失败都不会用数据库内容替代。 | The onchain owner and the permanent metadata are verified separately; if either fails, we won't substitute database content. |
| `loading.meArchive` | 正在读取音乐档案 | Loading your music archive |

## me（103 条）

| key | 中文 | 英文 |
|---|---|---|
| `me.sections.records` | 我的唱片 | My records |
| `me.sections.pending` | 待铸造 | Awaiting mint |
| `me.sections.favorites` | 收藏 | Collection |
| `me.identityPendingTitle` | 正在确认你的档案 | Confirming your archive |
| `me.identityPendingDescription` | 身份确认后，你的音乐会立即出现。 | Your music will appear as soon as your identity is confirmed. |
| `me.signInTitle` | 登录后找回你的音乐 | Sign in to find your music |
| `me.signInDescription` | 登录用于找回你的私人音乐档案。 | Sign in to return to your private music archive. |
| `me.updating` | 正在更新… | Updating… |
| `me.empty.records` | 铸造完成的唱片会留在这里。 | Records you've minted will stay here. |
| `me.empty.pending` | 新录音会在这里保留 24 小时。 | New recordings are kept here for 24 hours. |
| `me.empty.favorites` | 收藏的声音会留在这里。 | Sounds you collect will stay here. |
| `me.errors.records` | 唱片档案读取失败 | Couldn't load your records |
| `me.errors.pending` | 录音档案读取失败 | Couldn't load your recordings |
| `me.errors.favorites` | 素材档案读取失败 | Couldn't load your collection |
| `me.echoes.cache` | 正在显示上次链上确认，正后台核对当前持有人… | Showing the last onchain confirmation while checking the current owner in the background… |
| `me.echoes.truncated` | 链上持有超过 {count} 枚，仅显示前一部分 | More than {count} are held onchain; only the first part is shown |
| `me.echoes.originUnavailable` | 来源状态暂不可用；当前持有列表仍以链上为准 | Origin status is unavailable; the current holdings list still follows the chain |
| `me.archive.checkingDetail` | 正在核对缓存中的收藏记录，当前持有情况尚未确认。 | Checking cached collection records; current holdings aren't confirmed yet. |
| `me.archive.checkingDetailWithError` | {error}；正在核对缓存中的收藏记录，当前持有情况尚未确认。 | {error}; checking cached collection records; current holdings aren't confirmed yet. |
| `me.archive.statusError` | 暂无法核实 | Can't verify right now |
| `me.archive.statusChecking` | 持有人核对中 | Checking owner |
| `me.archive.statusWarning` | 档案有提示 | Archive notice |
| `me.archive.statusRefreshing` | 更新中 | Updating |
| `me.archive.countLoading` | {title}正在读取 | {title}: loading |
| `me.archive.count` | {title}{count}项 | {title}: {count, plural, one {# item} other {# items}} |
| `me.archive.detailsLabel` | {status}，查看说明 | {status}, see details |
| `me.archive.details` | {status} · 说明 | {status} · Details |
| `me.archive.emptyTitle` | {title}尚无记录 | Nothing in {title} yet |
| `me.archive.pagination` | {title}分页 | {title} pages |
| `me.archive.prev` | ← 上一页 | ← Previous |
| `me.archive.next` | 下一页 → | Next → |
| `me.scoreStatus.pending` | 等待制作 | Waiting to be made |
| `me.scoreStatus.uploading_events` | 保存演奏中 | Saving the performance |
| `me.scoreStatus.preparing_package` | 核验永久资源 | Verifying permanent resources |
| `me.scoreStatus.minting_onchain` | 写入链上 | Writing onchain |
| `me.scoreStatus.uploading_metadata` | 装配唱片 | Assembling the record |
| `me.scoreStatus.setting_uri` | 绑定永久播放器 | Binding the permanent player |
| `me.scoreStatus.finalizing_snapshot` | 生成验证快照 | Generating the verification snapshot |
| `me.scoreStatus.success` | 永久唱片 | Permanent record |
| `me.scoreStatus.failed` | 制作未完成 | Not completed |
| `me.scoreStatus.preparing_assets` | 永久保存中 | Saving permanently |
| `me.scoreStatus.ready_to_sign` | 等待钱包确认 | Awaiting wallet confirmation |
| `me.scoreStatus.submitted` | 交易已提交 | Transaction submitted |
| `me.scoreStatus.confirming` | 等待链上确认 | Awaiting onchain confirmation |
| `me.scoreStatus.expired` | 授权已过期 | Authorization expired |
| `me.scoreStatus.manual_review` | 正在核对链上结果 | Checking the onchain result |
| `me.score.safeRetry` | 制作已停止，可从详情核验 | Stopped; you can verify it from the details |
| `me.score.needsReview` | 需要核验后再处理 | Needs verification before going further |
| `me.score.open` | 打开唱片 | Open record |
| `me.score.viewDetails` | 查看详情 | View details |
| `me.score.viewProgress` | 查看进度 | View progress |
| `me.score.ethSelfPaid` | Ethereum · 自付 Gas | Ethereum · You pay gas |
| `me.score.orderSyncing` | 订单同步中 | Syncing order |
| `me.recording.expired` | 即将消失 | Disappearing soon |
| `me.recording.expiresIn` | {clock} 后消失 | Disappears in {clock} |
| `me.recording.reconnect` | 请先重新连接原钱包 | Reconnect your original wallet first |
| `me.recording.archiveFailed` | 作品档案建立失败 | Couldn't create the work's archive |
| `me.recording.uploadFailed` | 上传失败，仍保存在此设备 | Upload failed; still saved on this device |
| `me.recording.localOnly` | 仅保存在此设备 | Saved only on this device |
| `me.recording.syncing` | 正在同步 | Syncing |
| `me.recording.previewFailed` | 试听加载失败，可重试 | Preview failed to load; you can retry |
| `me.recording.loading` | 读取中… | Loading… |
| `me.recording.retryPlay` | 重试播放 | Retry playback |
| `me.recording.play` | 播放 | Play |
| `me.recording.stop` | 停止 | Stop |
| `me.recording.minting` | 正在铸造… | Minting… |
| `me.recording.submitted` | 已提交 | Submitted |
| `me.recording.mintLabel` | 将{title}铸造为唱片 | Mint {title} as a record |
| `me.recording.creatingOrder` | 正在建立铸造订单… | Creating mint order… |
| `me.recording.retryMint` | 重试铸造 | Retry mint |
| `me.recording.mint` | 铸造唱片 | Mint record |
| `me.recording.uploaded` | 已上传录音 | Uploaded recording |
| `me.recording.remote` | {track} · 第 {seq} 次录音 | {track} · Recording {seq} |
| `me.recording.local` | 本机录音 · {index} | Local recording · {index} |
| `me.material.processing` | 收藏处理中 | Collection in progress |
| `me.material.playLabel` | 播放{title} | Play {title} |
| `me.material.stopLabel` | 停止播放{title} | Stop playing {title} |
| `me.material.play` | 播放 | Play |
| `me.material.stop` | 停止 | Stop |
| `me.material.pending` | 处理中 | Processing |
| `me.history.title` | 铸造记录 | Mint history |
| `me.history.empty` | 唱片与原曲的铸造记录会出现在这里。 | Mint records for your records and tracks will appear here. |
| `me.history.kindEth` | 原曲 NFT | Track NFT |
| `me.history.kindOp` | 原曲 SBT | Track SBT |
| `me.history.kindHome` | 首页收藏 | Collected in the pond |
| `me.history.kindScore` | 唱片 | Record |
| `me.history.pending` | 处理中 | Processing |
| `me.history.done` | 已完成 | Done |
| `me.history.attention` | 需要处理 | Needs attention |
| `me.history.tx` | 交易 ↗ | Transaction ↗ |
| `me.echoStatus.owned` | 当前持有 | Currently held |
| `me.echoStatus.excluded_prelaunch` | 启用前作品 | Pre-launch work |
| `me.echoStatus.pending` | 等待制作 | Waiting to be made |
| `me.echoStatus.preparing_media` | 核验永久媒体 | Verifying permanent media |
| `me.echoStatus.uploading_metadata` | 写入永久档案 | Writing the permanent archive |
| `me.echoStatus.minting_onchain` | 链上铸造中 | Minting onchain |
| `me.echoStatus.confirming_onchain` | 等待链上确认 | Awaiting onchain confirmation |
| `me.echoStatus.safe_retry` | 安全重试中 | Retrying safely |
| `me.echoStatus.manual_review` | 等待人工核验 | Awaiting manual review |
| `me.echoStatus.success` | 已转出 | Transferred out |
| `me.echoRow.failed` | 已失败关闭，详情保留在运维记录 | Closed after failure; details are kept in the operations log |
| `me.echoRow.open` | 打开作品 | Open work |
| `me.echoRow.status` | 查看状态 | View status |

## player（12 条）

| key | 中文 | 英文 |
|---|---|---|
| `player.global` | 全局播放器 | Global player |
| `player.echoPlayer` | Pond Echo 播放器 | Pond Echo player |
| `player.collect` | 收藏 | Collect |
| `player.collected` | 已收藏 | Collected |
| `player.collectTitle` | 收藏《{title}》 | Collect “{title}” |
| `player.stop` | 停止 | Stop |
| `player.stopTitle` | 停止播放《{title}》 | Stop playing “{title}” |
| `player.playTitle` | 播放 {title} | Play {title} |
| `player.pauseTitle` | 暂停 {title} | Pause {title} |
| `player.echoAction` | {state, select, playing {暂停} paused {继续} ended {重新播放} error {重试} other {取消加载}} | {state, select, playing {Pause} paused {Resume} ended {Replay} error {Retry} other {Cancel loading}} |
| `player.track36Label` | {state, select, playing {暂停} paused {继续} loading {取消加载} other {播放}} 第 36 首 Pond Echo #1：{title} | {state, select, playing {Pause} paused {Resume} loading {Cancel loading} other {Play}} track 36, Pond Echo #1: {title} |
| `player.playbackFailed` | 播放失败，请重试 | Playback failed. Please try again. |

## home（3 条）

| key | 中文 | 英文 |
|---|---|---|
| `home.glRetry` | 加载失败，点击重试 | Failed to load. Tap to retry. |
| `home.trackMissing` | 原曲不存在 | This track doesn't exist |
| `home.backToTracks` | 返回曲目 | Back to tracks |

## jam（11 条）

| key | 中文 | 英文 |
|---|---|---|
| `jam.loading` | 加载中... | Loading… |
| `jam.keyboardOnly` | 合奏需要电脑键盘体验 | Playing together needs a computer keyboard |
| `jam.openOnComputer` | 请在电脑上打开本页 | Please open this page on a computer |
| `jam.soundsLoading` | 音效加载中... | Loading sounds… |
| `jam.hintP9` | 按 A–Z、3–8 或空格演奏 33 个声音动画 | Press A–Z, 3–8 or Space to play 33 sound animations |
| `jam.hint` | 按 A–Z、3–8 或空格演奏 | Press A–Z, 3–8 or Space to play |
| `jam.recording` | ● 录制中 | ● Recording |
| `jam.draftSaved` | 你的创作已记录 ↗ | Your creation has been saved ↗ |
| `jam.draftSavedHint` | 点击右上角「我的音乐」或「登录」查看 | Open “My music” or “Sign in” at the top right to see it |
| `jam.mintRecorded` | 你的收藏已记录 ↗ | Your collection has been recorded ↗ |
| `jam.mintRecordedHint` | 到「我的」查看 | See it in “My music” |

## tracks（31 条）

| key | 中文 | 英文 |
|---|---|---|
| `tracks.catalogNav` | 曲目目录 | Track list |
| `tracks.allTracksLink` | 全部曲目 → | All tracks → |
| `tracks.trackLabel` | 原曲 {title} | Track {title} |
| `tracks.trackWord` | 原曲 | Track |
| `tracks.notesPending` | 创作手记整理中，作者会在之后补充。 | The artist's notes are still being prepared and will be added later. |
| `tracks.readNotes` | 阅读创作手记 | Read the artist's notes |
| `tracks.collectThis` | 收藏这首原曲 | Collect this track |
| `tracks.adjacent` | 相邻曲目 | Adjacent tracks |
| `tracks.previous` | 上一首 | Previous |
| `tracks.next` | 下一首 | Next |
| `tracks.notesLabel` | 原曲 {title} 创作手记 | Artist's notes for track {title} |
| `tracks.backToList` | 返回目录 | Back to the list |
| `tracks.allTracks` | 全部曲目 | All tracks |
| `tracks.indexLabel` | {count} 首原曲目录 | List of {count} tracks |
| `tracks.chooseTrack` | 选择一首原曲 | Choose a track |
| `tracks.indexHeading` | 曲目 | Tracks |
| `tracks.closeIndex` | 关闭曲目目录 | Close track list |
| `tracks.switchTo` | 切换到原曲 {title} | Switch to track {title} |
| `tracks.listen.idle` | 开始聆听 | Start listening |
| `tracks.listen.preparing` | 取消准备 | Cancel |
| `tracks.listen.playing` | 停止聆听 | Stop listening |
| `tracks.listen.ended` | 再听一次 | Listen again |
| `tracks.listen.error` | 重新聆听 | Try listening again |
| `tracks.circleLabel` | {action}原曲 {title} | {action}: track {title} |
| `tracks.statusPreparing` | 音频正在准备 | Preparing audio |
| `tracks.statusPlaying` | 正在播放 | Playing |
| `tracks.statusEnded` | 聆听结束 | Finished |
| `tracks.seekLabel` | 原曲 {title} 播放进度 | Playback progress for track {title} |
| `tracks.audioFailed` | 音频暂时未能载入 | The audio couldn't be loaded |
| `tracks.audioFailedHint` | 请点击“重新聆听”再试一次。 | Tap “Try listening again” to retry. |
| `tracks.imprintLabel` | 由这首原曲的真实声音生成的水纹刻印 | A ripple imprint generated from this track's actual sound |

## provenance（26 条）

| key | 中文 | 英文 |
|---|---|---|
| `provenance.copyLabel` | 复制{label} | Copy {label} |
| `provenance.copied` | 已复制 | Copied |
| `provenance.copy` | 复制 | Copy |
| `provenance.verifyLabel` | 在浏览器中核对{label} | Verify {label} in a block explorer |
| `provenance.verify` | 核对 ↗ | Verify ↗ |
| `provenance.copyFailed` | 未能复制，请选中完整内容复制。 | Couldn't copy. Please select the full text and copy it. |
| `provenance.sbt` | 原曲 SBT | Track SBT |
| `provenance.nft` | 原曲 NFT | Track NFT |
| `provenance.label` | 永久来源与链上凭证 | Permanent sources and onchain credentials |
| `provenance.title` | 永久来源 | Permanent sources |
| `provenance.intro` | 音频永久保存在 Arweave，不依赖本站；收藏凭证来自链上合约，下列每一项都可在区块浏览器核对。 | The audio is stored permanently on Arweave and doesn't depend on this site. Collection credentials come from onchain contracts, and every item below can be verified in a block explorer. |
| `provenance.audioUri` | 音频永久地址 | Permanent audio address |
| `provenance.audioPending` | 来源尚待核验 | Source not yet verified |
| `provenance.audioSha` | 音频 SHA-256 | Audio SHA-256 |
| `provenance.canonical` | 已记录永久承诺的音频校验值。 | The audio checksum committed to permanently has been recorded. |
| `provenance.legacy` | 沿用已有永久音频来源；历史 metadata 未承诺音频 SHA-256。 | Uses the existing permanent audio source; the historical metadata doesn't commit to an audio SHA-256. |
| `provenance.undeployed` | 尚未部署 | Not deployed yet |
| `provenance.unverified` | 凭证待核验 | Credentials pending verification |
| `provenance.contract` | 铸造合约 | Mint contract |
| `provenance.standard` | 标准 / Token | Standard / Token |
| `provenance.archiveTx` | 项目留存交易 | Project archive transaction |
| `provenance.archiveWallet` | 项目留存钱包 | Project archive wallet |
| `provenance.archive` | 项目留存 | Project archive copy |
| `provenance.archiveConfirmed` | 已确认 | Confirmed |
| `provenance.archivePending` | 尚待接收钱包与链上证明 | Awaiting the receiving wallet and onchain proof |
| `provenance.openSingle` | 打开单曲 → | Open this track → |

## material（92 条）

| key | 中文 | 英文 |
|---|---|---|
| `material.panelTitle` | 收藏原曲 | Collect this track |
| `material.rulesSummary` | 铸造规则 | Minting rules |
| `material.ruleHome` | 同一首原曲可以在首页收藏，也可以在这里铸造，两者互不冲突，都会记录到「我的」。 | You can collect a track in the home pond or mint it here. The two don't conflict, and both are recorded under “My music”. |
| `material.ruleEth` | Ethereum 上每个钱包对同一首累计只能铸造一次，转出后不恢复；每首总量不设上限，铸造本身不收费。 | On Ethereum, each wallet can mint a given track only once in total, and transferring it out doesn't restore eligibility. There's no supply cap per track, and minting itself is free. |
| `material.ruleOp` | Optimism 为不可转让的 SBT，Gas 由平台支付；Ethereum 为可转让的 NFT，需用你的外部钱包支付 Gas。 | On Optimism it's a non-transferable SBT and the platform pays the gas. On Ethereum it's a transferable NFT, and you pay the gas from your own wallet. |
| `material.signInToCollect` | 登录后收藏 | Sign in to collect |
| `material.recipient` | 接收地址 | Receiving address |
| `material.tx` | 交易：{hash} | Transaction: {hash} |
| `material.op.label` | Optimism 原曲领取 | Claim on Optimism |
| `material.op.kind` | 不可转让 SBT · 平台承担 Gas | Non-transferable SBT · Gas paid by the platform |
| `material.op.unavailable` | Optimism 原曲暂未开放 | Not yet open on Optimism |
| `material.op.submitting` | 正在提交… | Submitting… |
| `material.op.alreadyCollected` | 已有收藏记录 | Already collected |
| `material.op.pending` | 等待链上确认 / 核对 | Awaiting onchain confirmation / review |
| `material.op.mint` | 铸造 Optimism 原曲 | Mint on Optimism |
| `material.op.reviewHint` | 请到“我的”查看已有记录，确认后再操作。 | Check your existing records in “My music” before trying again. |
| `material.op.successNote` | 历史收藏已确认；当前持有情况以链上余额为准。 | Your past collection is confirmed; current holdings follow the onchain balance. |
| `material.op.pendingNote` | 请求已受理，尚未确认铸造完成。请到“我的”查看已有记录。 | Your request was accepted, but the mint isn't confirmed yet. Check your records in “My music”. |
| `material.op.errors.statusUnavailable` | 收藏状态暂不可用，请稍后查询。 | Collection status isn't available right now. Please check again later. |
| `material.op.errors.notReady` | 登录状态还没有准备好，请稍后再点一次。 | Your sign-in isn't ready yet. Please tap again in a moment. |
| `material.op.errors.resultUnknown` | 请求结果暂不可用，请查询收藏状态后再操作。 | The result of your request isn't available. Check your collection status before trying again. |
| `material.op.errors.server` | 收藏请求未完成，请稍后再试。 | The collect request didn't complete. Please try again later. |
| `material.eth.label` | Ethereum 原曲铸造 | Mint on Ethereum |
| `material.eth.kind` | 可转让 NFT · 由你的钱包支付 Gas | Transferable NFT · Gas paid by your wallet |
| `material.eth.signInWithWallet` | 请使用已关联的链上地址登录 | Sign in with a linked onchain address |
| `material.eth.undeployed` | 合约尚未部署，当前未开放收藏。 | The contract isn't deployed yet, so collecting isn't open. |
| `material.eth.unavailable` | Ethereum 原曲暂未开放 | Not yet open on Ethereum |
| `material.eth.mint` | 铸造 Ethereum 原曲 | Mint on Ethereum |
| `material.eth.busyWallet` | 正在准备钱包… | Preparing wallet… |
| `material.eth.busyOrder` | 正在创建订单… | Creating order… |
| `material.eth.busySign` | 请在钱包中确认… | Confirm in your wallet… |
| `material.eth.walletNotReady` | 钱包还没有准备好，请确认钱包已连接后再点一次 | Your wallet isn't ready yet. Make sure it's connected, then tap again. |
| `material.eth.orderUnavailable` | 原曲订单暂不可用，请查询已有订单。 | Track orders aren't available right now. Please check your existing orders. |
| `material.order.backToMe` | 返回我的音乐 | Back to My music |
| `material.order.backLink` | ← 我的音乐 | ← My music |
| `material.order.statusTitle` | 原曲铸造状态 | Track mint status |
| `material.order.statusIntro` | 已有交易只查询或恢复，不重复发送。 | Existing transactions are only checked or recovered, never sent twice. |
| `material.order.checkingSignIn` | 正在确认登录状态… | Checking your sign-in… |
| `material.order.signInToView` | 登录后查看本人订单 | Sign in to see your orders |
| `material.order.loading` | 正在读取本人订单… | Loading your orders… |
| `material.order.summary` | {chain} · 原曲 Token #{tokenId} · 数量 1 · 铸造免费，仅需支付 Gas | {chain} · Track token #{tokenId} · Quantity 1 · Minting is free; you only pay gas |
| `material.order.progress` | 铸造进度 | Mint progress |
| `material.order.stepCreated` | 订单已创建 | Order created |
| `material.order.stepWallet` | 钱包确认 | Wallet confirmation |
| `material.order.stepChain` | 链上确认 | Onchain confirmation |
| `material.order.gas` | 预计 Gas 约 {fee} ETH · 钱包余额 {balance} ETH | Estimated gas about {fee} ETH · Wallet balance {balance} ETH |
| `material.order.gasLow` |  · 余额偏低，可能无法完成，请先充入少量 ETH |  · Balance is low and the mint may fail. Please add a little ETH first. |
| `material.order.waitingWallet` | 等待钱包确认… | Waiting for wallet confirmation… |
| `material.order.send` | 铸造并在钱包中确认 | Mint and confirm in wallet |
| `material.order.recoverSummary` | 已在钱包里确认，但这里没有更新？ | Confirmed in your wallet but not updated here? |
| `material.order.existingHash` | 已有交易哈希 | Existing transaction hash |
| `material.order.existingHashLabel` | 已有原曲交易哈希 | Existing track transaction hash |
| `material.order.recover` | 登记已有交易哈希 | Register existing transaction hash |
| `material.order.recoverNote` | 哈希只是查账线索，需链上核对后才会确认领取；此操作不会再次发送交易。 | The hash is only a lead for checking; the claim is confirmed after onchain verification. This won't send another transaction. |
| `material.order.connectRecipient` | 请连接此订单的接收钱包后继续。 | Connect this order's receiving wallet to continue. |
| `material.order.sendingNote` | 正在等待钱包响应。若已拒绝或关闭了钱包弹窗，稍后点“刷新状态”即可重新领取。 | Waiting for your wallet. If you rejected or closed the wallet pop-up, tap “Refresh status” in a moment to claim again. |
| `material.order.successNote` | 这是历史铸造记录；转出不恢复铸造资格，当前持有数量以链上余额为准。 | This is a past mint record. Transferring out doesn't restore eligibility, and current holdings follow the onchain balance. |
| `material.order.openTrack` | 打开原曲 → | Open track → |
| `material.order.viewTx` | 在区块浏览器查看交易 ↗ | View transaction in block explorer ↗ |
| `material.order.details` | 订单详情 | Order details |
| `material.order.recipientLine` | 接收地址：{address} | Receiving address: {address} |
| `material.order.contractLine` | 合约： | Contract:  |
| `material.order.processing` | 正在处理… | Processing… |
| `material.order.refresh` | 刷新状态 | Refresh status |
| `material.order.unavailable` | 原曲订单暂不可用 | Track order isn't available right now |
| `material.order.requestUnavailable` | 请求暂不可用，请查询已有订单 | The request isn't available right now. Please check your existing orders. |
| `material.order.listBack` | 返回私人档案 | Back to your archive |
| `material.order.listTitle` | 原曲领取订单 | Track claim orders |
| `material.order.listIntro` | 最近 50 条本人订单；原曲与 Score 订单分开保存。 | Your 50 most recent orders. Track and Score orders are kept separately. |
| `material.order.listLoading` | 正在读取… | Loading… |
| `material.order.listRefresh` | 刷新订单 | Refresh orders |
| `material.order.listEmpty` | 尚无 Ethereum 原曲领取订单。 | No Ethereum track claim orders yet. |
| `material.order.listItem` | {chain} · 原曲 Token #{tokenId} · {status} | {chain} · Track token #{tokenId} · {status} |
| `material.order.listFailed` | 订单读取失败 | Couldn't load orders |
| `material.status.prepared` | 待钱包确认 | Awaiting wallet confirmation |
| `material.status.authorized` | 待钱包确认 | Awaiting wallet confirmation |
| `material.status.sending` | 交易正在发送，请勿重复操作 | Sending the transaction. Please don't repeat the action. |
| `material.status.unknown` | 交易结果待核对，请勿再次发送 | Transaction result pending review. Please don't send again. |
| `material.status.submitted` | 已登记交易，等待链上确认 | Transaction registered, awaiting onchain confirmation |
| `material.status.confirming` | 等待足够的链上确认 | Waiting for enough onchain confirmations |
| `material.status.success` | 原曲铸造已确认 | Track mint confirmed |
| `material.status.reverted` | 交易未成功，可重新检查后发送 | The transaction failed. Check and send again. |
| `material.status.cancelled` | 订单已取消 | Order cancelled |
| `material.notice.technical` | 技术详情 | Technical details |
| `material.notice.fallback` | 铸造暂时没有完成 | The mint hasn't completed yet |
| `material.notice.rejectedTitle` | 你在钱包中取消了这次铸造 | You cancelled this mint in your wallet |
| `material.notice.rejectedHint` | 没有发送交易，也不会产生费用。准备好后可以再次点击“铸造 Ethereum 原曲”。 | No transaction was sent and there's no charge. When you're ready, tap “Mint on Ethereum” again. |
| `material.notice.fundsTitle` | 钱包 ETH 余额不足以支付 Gas | Not enough ETH in your wallet to pay for gas |
| `material.notice.fundsHint` | 铸造本身不收费，只需支付网络 Gas。向接收地址充入少量 ETH 后，再点击铸造即可。 | Minting itself is free; you only pay network gas. Add a little ETH to the receiving address, then tap mint again. |
| `material.notice.networkTitle` | 网络暂时不通 | The network is unavailable right now |
| `material.notice.networkHint` | 请检查网络后点“刷新状态”再试；订单已保留，不会重复发送。 | Check your connection, then tap “Refresh status” to try again. Your order is kept and won't be sent twice. |
| `material.notice.reviewHint` | 请以下方订单状态为准；若显示“待核对”，请勿重复发送。 | Go by the order status below; if it says “pending review”, don't send again. |

## selfMint（78 条）

| key | 中文 | 英文 |
|---|---|---|
| `selfMint.copy.busy.title` | 正在打开 MetaMask | Opening MetaMask |
| `selfMint.copy.busy.detail` | 请在钱包窗口中检查并确认这笔 {chain} 铸造交易。 | Check and confirm this {chain} mint transaction in your wallet window. |
| `selfMint.copy.asset.events.title` | 正在永久保存演奏事件 · 1/3 | Permanently saving the performance events · 1/3 |
| `selfMint.copy.asset.events.detail` | 后台正在固定你的演奏数据，页面会自动更新。 | Your performance data is being pinned in the background; this page updates automatically. |
| `selfMint.copy.asset.package.title` | 正在生成永久作品包 · 2/3 | Building the permanent work package · 2/3 |
| `selfMint.copy.asset.package.detail` | 演奏事件已保存，正在组合声音与播放器资源。 | The performance events are saved; now combining the sounds and player resources. |
| `selfMint.copy.asset.metadata.title` | 正在固定作品身份 · 3/3 | Pinning the work's identity · 3/3 |
| `selfMint.copy.asset.metadata.detail` | 最后一步完成后会立即打开钱包确认入口。 | When this last step finishes, wallet confirmation opens right away. |
| `selfMint.copy.asset.complete.title` | 永久素材准备完成 | Permanent materials are ready |
| `selfMint.copy.asset.complete.detail` | 正在切换到钱包确认。 | Switching to wallet confirmation. |
| `selfMint.copy.snapshotPending.title` | 链上铸造成功 | Minted onchain |
| `selfMint.copy.snapshotPending.detail` | 正在等待永久资源同步到可读取网关，完成后会自动开放作品。无需再次支付 Gas。 | Waiting for the permanent resources to sync to a readable gateway; the work opens automatically when done. You don't need to pay gas again. |
| `selfMint.copy.status.preparing_assets.title` | 正在准备并永久保存作品 | Preparing and permanently saving your work |
| `selfMint.copy.status.preparing_assets.detail` | 素材写入后不可删除；这里可以安全关闭，后台会继续。 | Once written, materials can't be deleted. You can safely close this; it continues in the background. |
| `selfMint.copy.status.ready_to_sign.title` | 确认铸造费用 | Confirm the mint cost |
| `selfMint.copy.status.ready_to_sign.detail` | 还没有扣除费用；确认美元 Gas 预估后，再打开钱包。 | Nothing has been charged yet. Confirm the USD gas estimate, then open your wallet. |
| `selfMint.copy.status.submitted.title` | 交易已提交 | Transaction submitted |
| `selfMint.copy.status.submitted.detail` | 不要重复发送。即使关闭页面，后台仍会继续核验。 | Don't send it again. Verification continues in the background even if you close this page. |
| `selfMint.copy.status.confirming.title` | 等待链上确认 | Awaiting onchain confirmation |
| `selfMint.copy.status.confirming.detail` | 合约已看到作品，达到确认数后会开放永久页面。 | The contract has seen your work; the permanent page opens once there are enough confirmations. |
| `selfMint.copy.status.success.title` | 铸造完成 | Mint complete |
| `selfMint.copy.status.success.detail` | 永久作品与链上身份已完成一致性核验。 | The permanent work and its onchain identity have been verified as consistent. |
| `selfMint.copy.status.expired.title` | 授权已过期 | Authorization expired |
| `selfMint.copy.status.expired.detail` | 永久素材仍然有效，可以生成新授权，不需要重新上传。 | The permanent materials are still valid; you can generate a new authorization without re-uploading. |
| `selfMint.copy.status.failed.title` | 交易已明确失败 | The transaction definitely failed |
| `selfMint.copy.status.failed.detail` | 只有完成链上清查后，系统才允许重新选择铸造方式。 | You can choose a mint method again only after an onchain check is complete. |
| `selfMint.copy.status.manual_review.title` | 铸造结果需要核对 | The mint result needs review |
| `selfMint.copy.status.manual_review.detail` | 系统已暂停重发，请保留当前交易并等待核对，避免重复支付 Gas。 | Resending is paused. Keep the current transaction and wait for review to avoid paying gas twice. |
| `selfMint.close` | 关闭铸造弹窗 | Close mint dialog |
| `selfMint.progress` | 铸造进度 | Mint progress |
| `selfMint.loading` | 正在读取铸造档案… | Loading the mint record… |
| `selfMint.eyebrow` | Reserved edition · 未铸造 Token #{tokenId} | Reserved edition · Unminted token #{tokenId} |
| `selfMint.walletMismatch` | 当前钱包与接收地址不同；你可以查看进度，但不能继续签名。 | This wallet differs from the receiving address; you can view progress but can't continue signing. |
| `selfMint.walletNotConnected` | 原钱包尚未连接；连接后可以继续签名，不需要重新创建订单。 | The original wallet isn't connected yet; connect it to continue signing without creating a new order. |
| `selfMint.walletRestoring` | 正在恢复原钱包连接，请稍候… | Restoring the original wallet connection, please wait… |
| `selfMint.insufficient` | 当前钱包余额不足以支付这笔 Gas。 | This wallet's balance isn't enough to pay this gas. |
| `selfMint.returnedHash` | 钱包已返回交易哈希： | Your wallet returned a transaction hash:  |
| `selfMint.openingWallet` | 正在打开钱包… | Opening wallet… |
| `selfMint.confirmMint` | 确认并铸造 · {usd} | Confirm and mint · {usd} |
| `selfMint.noBalance` | 钱包余额不足 | Insufficient balance |
| `selfMint.waitingGas` | 等待 Gas 预估 | Waiting for gas estimate |
| `selfMint.reestimate` | 重新估算 Gas | Re-estimate gas |
| `selfMint.checkingTx` | 正在核对交易… | Checking transaction… |
| `selfMint.recoverHash` | 用已有交易哈希恢复 | Recover with existing transaction hash |
| `selfMint.openWork` | 打开永久作品 → | Open permanent work → |
| `selfMint.release` | 完成清查并重新选择 | Finish the check and choose again |
| `selfMint.refresh` | 刷新状态 | Refresh status |
| `selfMint.lastChecked` | 上次读取 {time} | Last checked {time} |
| `selfMint.errors.readFailed` | 订单读取失败 | Couldn't load the order |
| `selfMint.errors.gasFailed` | Gas 预估失败 | Gas estimate failed |
| `selfMint.errors.sendFailed` | 钱包交易没有完成 | The wallet transaction didn't complete |
| `selfMint.errors.recoverFailed` | 交易登记失败 | Couldn't register the transaction |
| `selfMint.errors.releaseFailed` | 暂不能重新选择 | Can't choose again yet |
| `selfMint.facts.network` | 网络 | Network |
| `selfMint.facts.gas` | 预估 Gas | Estimated gas |
| `selfMint.facts.gasValue` | 约 {usd} | About {usd} |
| `selfMint.facts.testnet` |  · 测试网参考 |  · Testnet reference |
| `selfMint.facts.gasUnavailable` | 美元估算暂不可用 | USD estimate unavailable |
| `selfMint.facts.estimating` | 正在估算美元费用… | Estimating USD cost… |
| `selfMint.facts.preparingEstimate` | 正在准备美元费用估算… | Preparing USD cost estimate… |
| `selfMint.facts.recipient` | 接收钱包 | Receiving wallet |
| `selfMint.facts.tx` | 交易 | Transaction |
| `selfMint.network.unconfigured` | Ethereum 未配置 | Ethereum not configured |
| `selfMint.network.switchLabel` | {name}，切换网络 | {name}, switch network |
| `selfMint.network.label` | 铸造网络 | Mint network |
| `selfMint.network.choose` | 选择网络 | Choose network |
| `selfMint.network.unavailable` | 当前账号暂不可用 | Not available for this account |
| `selfMint.network.opDefault` | 默认 · 平台代付 Gas | Default · Platform pays gas |
| `selfMint.network.ethSelf` | 钱包自付 Gas | Wallet pays gas |
| `selfMint.network.testnet` | 测试网 · 钱包自付 Gas | Testnet · Wallet pays gas |
| `selfMint.network.ethMissing` | Ethereum 网络未配置 | Ethereum network not configured |
| `selfMint.reconnect.wrongWallet` | 请连接这笔订单原来的 EVM 钱包。 | Please connect the original EVM wallet for this order. |
| `selfMint.reconnect.connectFailed` | 钱包连接未完成，请重试。 | The wallet connection didn't complete. Please try again. |
| `selfMint.reconnect.connectFailedReason` | 钱包连接未完成（{reason}）。请确认小狐狸已解锁，并选择原钱包地址。 | The wallet connection didn't complete ({reason}). Make sure MetaMask is unlocked and choose the original wallet address. |
| `selfMint.reconnect.description` | 请连接订单原钱包 {address} | Connect the order's original wallet {address} |
| `selfMint.reconnect.connecting` | 正在连接钱包… | Connecting wallet… |
| `selfMint.reconnect.metamask` | 连接原 MetaMask 钱包 | Connect original MetaMask wallet |
| `selfMint.reconnect.reconnect` | 重新连接原钱包 | Reconnect original wallet |

## share（13 条）

| key | 中文 | 英文 |
|---|---|---|
| `share.author.x` | 这是我今天留在水塘里的声音。换你，会弹成什么样？<br>《{title}》 | This is the sound I left in the pond today. What would yours sound like?<br>“{title}” |
| `share.author.weibo` | 同一首底曲，每个人都能留下不同的声音。这是我的这一版。你也可以进去弹一段，我很想听听你的版本。<br>《{title}》 | Same base track, and everyone leaves a different sound. This is my version. Come in and play a little; I'd love to hear yours.<br>“{title}” |
| `share.listener.x` | 听到这一段，很想知道换你会弹成什么样。<br>《{title}》 | Heard this and wondered how you would play it.<br>“{title}” |
| `share.listener.weibo` | 发现一段有意思的即兴演奏。同一首底曲，换个人会留下怎样的声音？把它分享给你，也想听听你的版本。<br>《{title}》 | Found an interesting improvisation. Same base track: what sound would someone else leave? Sharing it with you, and I'd love to hear your version too.<br>“{title}” |
| `share.copyLink` | 复制链接 | Copy link |
| `share.unavailable` | 分享链接暂不可用 | Share link unavailable |
| `share.copied` | 已复制 | Copied |
| `share.copyFailed` | 复制失败 | Copy failed |
| `share.expand` | 展开分享方式 | Show share options |
| `share.share` | 分享 | Share |
| `share.toX` | 分享到 X | Share on X |
| `share.toWeibo` | 分享到微博 | Share on Weibo |
| `share.poster` | 下载海报 | Download poster |

## score（68 条）

| key | 中文 | 英文 |
|---|---|---|
| `score.backToArchive` | 返回档案 | Back to archive |
| `score.backToArchiveLink` | ← 返回档案 | ← Back to archive |
| `score.backToPondShort` | 回到水塘 | Back to the pond |
| `score.backToPondDefault` | 返回池塘 | Back to the pond |
| `score.leave` | 离开作品 | Leave this work |
| `score.shareWork` | 分享作品 | Share this work |
| `score.inProgressTitle` | Ripples · 制作中 | Ripples · In progress |
| `score.eventCount` |  · {count} 个事件 |  · {count, plural, one {# event} other {# events}} |
| `score.permanentEvents` | {title} · {count} 个永久事件 | {title} · {count, plural, one {# permanent event} other {# permanent events}} |
| `score.refreshStatus` | 刷新制作状态 | Refresh progress |
| `score.opening` | 正在打开永久唱片 | Opening the permanent record |
| `score.reading` | 正在读取 | Loading |
| `score.readingRecord` | 正在读取永久唱片 | Loading the permanent record |
| `score.readingRecordEllipsis` | 正在读取永久唱片… | Loading the permanent record… |
| `score.queue.pending` | 已进入作品制作队列 | Queued for production |
| `score.queue.uploading_events` | 正在保存演奏动作 | Saving the performance |
| `score.queue.preparing_package` | 正在核验永久资源 | Verifying permanent resources |
| `score.queue.minting_onchain` | 正在写入 OP Mainnet | Writing to OP Mainnet |
| `score.queue.uploading_metadata` | 正在装配永久作品 | Assembling the permanent work |
| `score.queue.setting_uri` | 正在绑定永久播放器 | Binding the permanent player |
| `score.queue.finalizing_snapshot` | 正在生成验证快照 | Generating the verification snapshot |
| `score.queue.success` | 永久作品已完成 | The permanent work is complete |
| `score.queue.failed` | 作品制作没有完成 | The work wasn't completed |
| `score.failure.snapshot_unavailable` | 已验证播放快照暂时不可用 | The verified playback snapshot is temporarily unavailable |
| `score.failure.metadata_unavailable` | 永久资料暂时无法读取 | The permanent data can't be read right now |
| `score.failure.queue_failed` | 这枚唱片制作未能完成 | This record couldn't be completed |
| `score.failure.other` | 作品资料暂时不可用 | The work's data is temporarily unavailable |
| `score.detail.processing` | 作品身份、分享链接和已经生成的凭证会留在这里；稍后刷新即可查看进度。 | The work's identity, share link and any credentials already generated will stay here; refresh later to see progress. |
| `score.detail.snapshotUnavailable` | 这不代表铸造失败；已知的作品身份仍可在下方核验。 | This doesn't mean the mint failed; the known identity of the work can still be verified below. |
| `score.detail.failed` | 已知链上身份与永久凭证仍保留在下方，可据此独立核验。 | The known onchain identity and permanent credentials remain below for independent verification. |
| `score.fallback.title` | 这枚唱片暂时无法读取 | This record can't be loaded right now |
| `score.fallback.body` | 我们没有用占位数据补齐未知信息。你可以重试，或先回到档案； 一旦链上与永久资料恢复，原链接会继续有效。 | We haven't filled in unknown details with placeholder data. You can try again or return to your archive; once the onchain and permanent data are back, the original link will keep working. |
| `score.playback.errorDetail` | {error}；身份与凭证仍可核验。 | {error}; the identity and credentials can still be verified. |
| `score.playback.errorDefault` | 永久播放资源暂不可用 | The permanent playback resources are unavailable |
| `score.playback.pausedAt` | 已暂停在 {time} | Paused at {time} |
| `score.playback.playedFull` | 已完整播放 {time} | Played in full · {time} |
| `score.playback.playingDetail` | 永久录音、日食与按键编舞保持同一时钟。 | The permanent recording, the eclipse and the key choreography share one clock. |
| `score.playback.queued` | 已记录播放请求，资源验证完成后会自动开始。 | Your play request is recorded; playback starts automatically once resources are verified. |
| `score.playback.preparing` | 正在优先准备底曲与开场音效，现在点击即可排队播放。 | Preparing the base track and opening sounds first; tap now to queue playback. |
| `score.playback.idle` | 永久音频只会在你主动点击后建立播放会话。 | Permanent audio only starts a playback session after you tap. |
| `score.playback.pause` | 暂停 | Pause |
| `score.playback.cancelWait` | 取消等待 | Cancel |
| `score.playback.playWhenReady` | 准备好后播放 | Play when ready |
| `score.archive.sources.contract` | 链上合约 | Onchain contract |
| `score.archive.sources.database` | 作品数据库 | Work database |
| `score.archive.sources.metadata` | 永久 metadata | Permanent metadata |
| `score.archive.fields.contract` | ScoreNFT 合约 | ScoreNFT contract |
| `score.archive.fields.creator` | 创作者 | Creator |
| `score.archive.fields.currentHolder` | 当前持有者 | Current holder |
| `score.archive.fields.mintTransaction` | 铸造交易 | Mint transaction |
| `score.archive.fields.setUriTransaction` | 定稿交易 | Finalization transaction |
| `score.archive.fields.tokenUri` | 链上 Token URI | Onchain token URI |
| `score.archive.fields.metadata` | 永久 Metadata | Permanent metadata |
| `score.archive.fields.events` | 永久事件 | Permanent events |
| `score.archive.fields.base` | 永久底曲 | Permanent base track |
| `score.archive.fields.sounds` | 永久音效表 | Permanent sound table |
| `score.archive.fields.decoder` | 永久播放器 | Permanent player |
| `score.archive.missing.creator` | 永久来源未提供创作者地址 | The permanent source doesn't provide a creator address |
| `score.archive.missing.currentHolder` | 暂时无法读取当前持有者 | Can't read the current holder right now |
| `score.archive.missing.mintTransaction` | 当前来源未记录铸造交易 | This source doesn't record a mint transaction |
| `score.archive.missing.setUriTransaction` | 当前来源未记录定稿交易 | This source doesn't record a finalization transaction |
| `score.archive.checkingHolder` | 正在核对当前持有者 | Checking the current holder |
| `score.archive.dateMissing` | 时间未记录 | Time not recorded |
| `score.archive.inProgress` | 制作中 | In progress |
| `score.archive.eyebrow` | Permanent record · 永久档案 | Permanent record |
| `score.archive.title` | 作品凭证 | Work credentials |
| `score.archive.intro` | 播放输入逐字来自这枚作品钉住的永久资源。短值用于阅读，复制会保留完整哈希； 创作者与当前持有者始终分开记录。 | Playback inputs come verbatim from the permanent resources pinned to this work. Short values are for reading; copying keeps the full hash. The creator and the current holder are always recorded separately. |
| `score.archive.openDecoder` | 在新标签打开永久播放器 | Open the permanent player in a new tab |

## record（13 条）

| key | 中文 | 英文 |
|---|---|---|
| `record.state.idle.action` | 开始播放 | Play |
| `record.state.idle.status` | 点击唱片，开始播放 | Tap the record to play |
| `record.state.loading.action` | 正在准备 | Preparing |
| `record.state.loading.status` | 正在准备永久录音… | Preparing the permanent recording… |
| `record.state.playing.action` | 停止 | Stop |
| `record.state.playing.status` | 正在播放 | Playing |
| `record.state.paused.action` | 继续播放 | Resume |
| `record.state.paused.status` | 播放已暂停 | Paused |
| `record.state.ended.action` | 再次播放 | Play again |
| `record.state.ended.status` | 播放已结束 | Finished |
| `record.state.error.action` | 重试 | Retry |
| `record.state.error.status` | 播放暂不可用 | Playback unavailable |
| `record.controls` | {title} 播放控制 | {title} playback controls |

## ledger（11 条）

| key | 中文 | 英文 |
|---|---|---|
| `ledger.title` | 永久凭证 | Permanent credentials |
| `ledger.count` | {count} 项记录 | {count, plural, one {# record} other {# records}} |
| `ledger.missing` | 未记录 · 原始来源未提供 | Not recorded · not provided by the original source |
| `ledger.source` | 来源：{source} | Source: {source} |
| `ledger.copied` | 已复制 | Copied |
| `ledger.copyFailed` | 复制失败 | Copy failed |
| `ledger.copyFull` | 复制完整值 | Copy full value |
| `ledger.external` | 查看外部记录 | View external record |
| `ledger.copiedFull` | 完整值已复制 | Full value copied |
| `ledger.copyFailedManual` | 复制失败，请手动选择完整值 | Copy failed; please select the full value manually |
| `ledger.valueLabel` | {label}：{value} | {label}: {value} |

## echo（35 条）

| key | 中文 | 英文 |
|---|---|---|
| `echo.kicker` | POND ECHOES · 池中回声 | POND ECHOES |
| `echo.origin` | 原始创作者 | Origin creator |
| `echo.owner` | 当前持有人 | Current owner |
| `echo.transferred` | 这枚作品已经转让；来源钱包仍永久保留，当前持有人来自链上 ownerOf。 | This work has been transferred. The origin wallet is kept permanently; the current owner comes from the onchain ownerOf. |
| `echo.cover` | Pond Echoes 系列永久封面 | Permanent cover of the Pond Echoes series |
| `echo.identityTitle` | 一枚作品，两个身份。 | One work, two identities. |
| `echo.identityBody` | Origin 记录声音从谁的钱包诞生；owner 记录它此刻在谁手中。转让会改变后者，不会改写前者、配方或 36 段声音。 | Origin records which wallet the sound was born from; owner records whose hands it's in right now. A transfer changes the latter, never the former, the recipe or the 36 sounds. |
| `echo.sourceScore` | 打开触发它的首枚 Score #{tokenId} → | Open Score #{tokenId}, the first one that triggered it → |
| `echo.gatewaysMatch` | {count} 个网关字节一致 | {count, plural, one {# gateway} other {# gateways}} byte-identical |
| `echo.permanentMetadata` | 永久 metadata | Permanent metadata |
| `echo.unavailableTitle` | 这圈回声暂时没有抵达。 | This echo hasn't arrived yet. |
| `echo.unavailableToken` | 链上作品存在，但当前无法从两个独立网关取得一致的永久档案。请稍后重试；配方与所有权不会因此改变。 | The work exists onchain, but we can't get a consistent permanent archive from two independent gateways right now. Please try again later; the recipe and ownership won't change. |
| `echo.unavailableOrigin` | 来源钱包已经固定，但链上或永久网关暂时没有返回可核验的完整作品。系统不会用临时数据替代。 | The origin wallet is fixed, but the chain or the permanent gateways haven't returned a complete, verifiable work yet. We won't substitute temporary data. |
| `echo.backToPond` | 返回池塘 | Back to the pond |
| `echo.viewArchive` | 查看我的档案 | View my archive |
| `echo.player.label` | Pond Echo 永久播放器 | Pond Echo permanent player |
| `echo.player.state.idle` | 等待永久音频 | Waiting for permanent audio |
| `echo.player.state.loading` | 正在准备永久音频 | Preparing permanent audio |
| `echo.player.state.ready` | 可以播放 | Ready to play |
| `echo.player.state.playing` | 正在播放 | Playing |
| `echo.player.state.paused` | 已暂停 | Paused |
| `echo.player.state.ended` | 播放完成 | Finished |
| `echo.player.state.error` | 播放暂不可用 | Playback unavailable |
| `echo.player.action` | {state, select, playing {暂停} paused {继续} ended {重新播放} error {重新载入} other {播放完整作品}} | {state, select, playing {Pause} paused {Resume} ended {Replay} error {Reload} other {Play the full work}} |
| `echo.player.start` | 从第一圈涟漪开始 | Starting from the first ripple |
| `echo.player.part` | 第 {index} / 36 段 | Part {index} / 36 |
| `echo.player.loaded` | 已取得 {loaded} / {total} 个唯一片段 | Loaded {loaded} / {total} unique clips |
| `echo.player.crossfade` | 60ms 等功率衔接 · 无自动播放 | 60 ms equal-power crossfade · No autoplay |
| `echo.player.errorDefault` | Pond Echo 播放器发生未知错误 | The Pond Echo player hit an unknown error |
| `echo.recipe.title` | 声音航图 | Sound chart |
| `echo.recipe.copied` | 已复制 | Copied |
| `echo.recipe.copy` | 复制配方 | Copy recipe |
| `echo.recipe.order` | 36 段声音播放顺序 | Playback order of the 36 sounds |
| `echo.recipe.playing` | 正在播放 | Playing |
| `echo.recipe.copiedFull` | 完整 36 位配方已复制 | Full 36-character recipe copied |

## titles（7 条）

| key | 中文 | 英文 |
|---|---|---|
| `titles.tracks` | 曲目 | Tracks |
| `titles.workUnavailable` | 作品暂不可用 | Work unavailable |
| `titles.workMissing` | 作品不存在 | Work not found |
| `titles.echoMissing` | Pond Echo 不存在 | Pond Echo not found |
| `titles.echoUnavailable` | Pond Echo 暂不可用 | Pond Echo unavailable |
| `titles.editionPending` | 制作中的唱片 | Record in progress |
| `titles.artistName` | 叶禹含 | Ye Yuhan |

## artist（1 条）

| key | 中文 | 英文 |
|---|---|---|
| `artist.folio` | ARTIST / 叶禹含 | ARTIST / YE YUHAN |

## og（10 条）

| key | 中文 | 英文 |
|---|---|---|
| `og.inProgressTitle` | Ripples · 制作中 | Ripples · In progress |
| `og.posterStatusReady` | PERMANENT SCORE · 已定稿 | PERMANENT SCORE · FINALIZED |
| `og.posterStatusProcessing` | 正在制作永久唱片 | Pressing the permanent record |
| `og.posterStatusFailed` | 永久凭证仍可核验 | Permanent credentials can still be verified |
| `og.eventsPending` | 事件数待核验 | Event count pending verification |
| `og.events` | {count} 个永久事件 | {count, plural, one {# permanent event} other {# permanent events}} |
| `og.track` | 永久音乐唱片 | Permanent music record |
| `og.work` | 永久作品 | Permanent work |
| `og.alt` | 永久唱片 | Permanent record |
| `og.altMultichain` | 多链永久唱片 | Multichain permanent record |

