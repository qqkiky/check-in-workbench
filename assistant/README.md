# 微信日程助手（免费套餐第一版，尚需部署和真机验收）

仅处理单次日程的标题、日期时间、时长、状态；工作台中的描述、私人笔记、记账不接入。
微信文本由腾讯通道处理，复杂日程可发送给 Cloudflare Workers AI。D1 中保存的是加密状态，
但服务运行时需要解密日程；这不是对云服务商不可见的端到端加密。

## 创建你自己的免费账号

访问 https://dash.cloudflare.com/sign-up 注册并验证邮箱。
使用 Workers Free、D1 Free、Workers AI 免费额度。无需购买域名。
不要升级付费套餐或绑定付款方式。额度耗尽会暂停，不能保证永久免费或无延迟。

## 部署前提

1. 本地 Node.js 22+，使用 Cloudflare Wrangler 官方工具登录你自己的账号。
2. 创建 D1 数据库 `checkin-schedules`，将 ID 填入 `wrangler.jsonc`。
3. 执行 `schema.sql` 建表。
4. 分别生成随机的 `ADMIN_TOKEN`、`DEVICE_TOKEN`（至少 32 字节）和 `STORAGE_KEY`（32 字节，Base64）。
   三者通过 `wrangler secret put` 存入 Workers Secrets，不能写入配置、日志或 GitHub。
5. 首次部署后，通过管理密钥请求 `/admin/weixin/start`，用自己微信扫码，再轮询 `/admin/weixin/poll`。
   登录凭据仅留在加密状态，API 不向手机返回微信令牌。
6. APK「更多 → 微信日程助手」只填服务地址和 **DEVICE_TOKEN**，不要填管理密钥。

```text
npx wrangler login
npx wrangler d1 create checkin-schedules
npx wrangler d1 execute checkin-schedules --remote --file=schema.sql
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put DEVICE_TOKEN
npx wrangler secret put STORAGE_KEY
npx wrangler deploy
```

命令在本目录运行；部署前核实账号仍为免费套餐。真实 token 不要发送到聊天或公共仓库。

## 行为和边界

- 每分钟检查微信消息，采用腾讯官方公开的 iLink 协议；未完成真实账号扫码测试前不算可用。
- 明确格式“明天下午3点写报告”“写报告完成了”“今天的安排”可走本地规则，免费 AI 每天最多 30 次请求。
- AI 不能直接访问数据库或执行命令；其输出必须通过日程字段校验。时间不明确或多项同名时会追问。
- 微信消息可能受会话有效期限制，失败仅记录状态，不假报送达。
- 日报默认 08:00，跟进默认 30 分钟，当天每项最多 8 次，22:00–08:00 不催办。
- 手机上前台/联网恢复时自动同步；APK 后台通过 WorkManager 约 15 分钟或更长间隔刷新专属日历。
  系统省电、断网、强制停止应用都会延迟。暂不提供秒级或必达承诺。
- APK 保存完整数据时使用 AndroidKeyStore + AES-GCM；日历和系统通知不是加密存储。
  日历事件标题会显示任务内容，可能出现在锁屏，需自行设置锁屏通知隐藏内容。
- 用户手动导出的 JSON 仍为明文备份，须自行妥善保存；令牌和助手配置不导出。
- 密钥丢失、卸载 APK 或清空应用可能无法恢复加密数据；先做手动备份。
- 之前启用 Supabase 上传的旧数据不会因本次收窄同步范围自动从服务器消失，需要另行检查。

## 验收清单

1. 先用虚构日程测试，不导入真实私人数据。
2. 微信创建两项任务，APK 和专属日历各出现一次。
3. 微信完成其中一项，APK 勾选；日历标题出现“✅ 已完成｜”，无后续提醒。
4. 同名任务时明确追问，不同时完成多个任务。
5. APK 修改/完成状态不会被旧云端数据覆盖；断网时本地工作可继续。
6. 检查云端请求中没有记账、私人笔记、任务描述、账号配置和其他聊天内容。
7. 手机锁屏和重启后，确认日历提醒、后台刷新及授权状态；小米需允许后台活动。

预览 APK 使用 `.preview` 包名与临时调试签名，仅供测试。正式发布须使用你自己保存的固定签名密钥，
不能拿预览包替代正式版本。此分支未合并上线前，原 PWA 继续使用原版本。
