# 咨询栏目 · 每日信源清单（三板块分类）

> 用途：支撑 App 底部「咨询」栏目每日 08:00 自动推送。内容聚焦**宠物与医药（兽药）行业**。
> 抓取原则：仅对下方官方/公开页面做匿名只读 GET，不登录、不提交表单、不下载附件；条目附**原始链接**保证可追溯。
> 已排除不可用源（见末节），勿重新加回或用搜索引擎结果冒充官方源。

---

## 板块一 · 行业动态（宠物及医药行业新闻、新产品、公司融资/并购、市场趋势）

| # | 信源 | 站点 / 路径 | 覆盖 | 备注 |
|---|---|---|---|---|
| 1 | 中国兽药信息网 · 行业动态（地方） | `http://www.ivdc.org.cn/xwdt/dfxw/` | 地方兽药行业动态、质量监测、市场整治 | 仅 http，UTF-8 |
| 2 | 中国兽药信息网 · 综合要闻 | `http://www.ivdc.org.cn/xwdt/zhdt/` | 全国兽药行业综合新闻 | 仅 http |
| 3 | 中国兽药协会 · 通知通告 | `http://www.cvda.org.cn:8090/a/guanyuxiehui/tongzhitonggao/` | 协会动态、会议、行业活动 | GB18030 编码 |
| 4 | 国际动保龙头（Yahoo Finance RSS） | `ZTS`(硕腾) `ELAN`(礼蓝) `IDXX`(爱德士) `MRK`(默沙东) | 全球动保企业并购/融资/业务布局/新品动态 | 英文，中文化后呈现；本环境唯一稳定可达的企业级新闻源 |
| 5 | 派读大数据 | `https://www.petdata.cn/` | 宠物行业市场报告（食品/电商为主） | 非监管，作市场趋势参考 |

## 板块二 · 药品信息（新药注册与审批、新适应症、产品详情）

| # | 信源 | 站点 / 路径 | 覆盖 | 备注 |
|---|---|---|---|---|
| 1 | 中国兽药信息网 · 农业农村部公告（兽药注册审批） | `http://www.ivdc.org.cn/xxgk/zcfg/nyncbgg/` | 新兽药注册、进口/变更注册审批公告 | 主力，含批准文号级明细 |
| 2 | 中国兽药信息网 · 公示 | `http://www.ivdc.org.cn/xxgk/ggtz/gg/` | 注册公示、拟批准公示 | 审批前置信号 |
| 3 | 中国兽药信息网 · 通知 | `http://www.ivdc.org.cn/xxgk/ggtz/tz/` | 变更注册、补充申请通知 | — |
| 4 | 国家兽药基础数据库 | `http://vdts.ivdc.org.cn:8099/cx/` | 批准文号全量查询（产品详情核验） | 需构造查询，作详情溯源 |
| 5 | FDA CVM · 动物药品 | `https://www.fda.gov/animal-veterinary/products` | 美国新动物药批准、专论、宠物食品 | 英文 |

## 板块三 · 监管动态（国内外监管机构政策/法规更新）

| # | 信源 | 站点 / 路径 | 覆盖 | 备注 |
|---|---|---|---|---|
| 1 | 中国兽药信息网 · 法规规章 | `http://www.ivdc.org.cn/xxgk/zcfg/flfg/` | 兽药法规、规章、技术规范 | 国内监管主干 |
| 2 | 中国兽药信息网 · 农业农村部公告 | `http://www.ivdc.org.cn/xxgk/zcfg/nyncbgg/` | 兽药监管政策公告 | 与板块二共享源，按内容归类 |
| 3 | 中国兽药协会 · 团体标准 | `http://www.cvda.org.cn:8090/a/tuantibiaozhun/` | 兽药团体标准发布 | GB18030 |
| 4 | **FDA CVM · CVM Updates** | `https://www.fda.gov/animal-veterinary/news-events/cvm-updates` | 美国 CVM 政策/指南/收费/战略更新 | 已验证可达，结构清晰 |
| 5 | **FDA CVM · 召回与安全警示** | `https://www.fda.gov/animal-veterinary/safety-health/recalls-withdrawals` | 兽药/宠物食品召回、安全警示 | 监管风险信号 |
| 6 | **FDA · 兽药指南文件** | `https://www.fda.gov/regulatory-information/search-fda-guidance-documents` | CVM GFI 指南发布 | 监管合规依据 |
| 7 | **EMA · 兽医药品** | `https://www.ema.europa.eu/en/veterinary-medicines` | 欧盟兽药全生命周期监管 | 欧洲主入口 |
| 8 | **EMA · 新闻** | `https://www.ema.europa.eu/en/news` | 欧盟药品（含兽医）监管新闻、科学指南 | 最新监管动态 |

---

## 抓取与生成说明

- **国内中文源**：复用 `pet-pharma-intel` skill 的 `fetch_intel.py`（Python 标准库 urllib，已实测通过），按板块选择 `--sources` 与时间窗（`--days 30 --pet-only --detail`）。
- **国际源（FDA/EMA）**：由 `scripts/gen_consult.py` 用 urllib 直连上述 URL 解析标题/日期/链接（FDA CVM Updates 结构已确认可用；EMA 取 news 列表）。
- **企业动态（行业动态板块）**：`fetch_intel.py` 的 `fetch_intl_company_news()` 抓 Yahoo Finance RSS（ZTS/ELAN/IDXX/MRK），经 MyMemory 中文化后并入「行业动态」。
- **输出**：编译为 `public/consult-data.json`（三板块数组，每条含 `title/summary/url/source/date`），App 的「咨询」Tab 直接读取并渲染，每条带可点击原始链接。

## 已排除（不可用，勿重新加回）

| 源 | 失败原因 |
|---|---|
| 农业农村部主站 `moa.gov.cn` | HTTP 502，长期不可达 |
| 中国兽医网 `cadc.net.cn` | 连接超时 |
| 宠业家 `petfair.net` | SSL 握手失败 |
| 中国畜牧兽医报 `farmer.com.cn` | HTTP 403 |
| Elanco `elanco.com/en_us/news` | 404 路径变更 |
| 谷歌/必应/百度新闻 RSS、东方财富/新浪/同花顺个股新闻 | 本环境被拦截或 404/500/WAF |

> 国内企业「融资/合同公开」类动态因上述接口不可达，目前只能来自官方兽医监管源中反查的企业名命中；如需补全须改用本地后端抓 cninfo，不在本栏目自动范围。
