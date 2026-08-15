/**
 * dsh-logistics-tracker — 宿主半侧。
 *
 * 1. 注册两个 AI 可调用工具：logistics_trace（查轨迹）/ logistics_detect（识别快递公司）。
 * 2. 注册 HTTP 路由 /logistics/trace、/logistics/detect，供浏览器面板读取。
 * 3. 密钥通过 credentials seam 解析（$DSH_HOME/.credentials.yaml 或环境变量），
 *    也可在 cordis.patch.yml 里直接写明文覆盖。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import { LogisticsService, formatTraceText } from './service.js';

export const name = 'dsh-logistics-tracker';
export const inject = ['tools'];

/** 从 config 明文 / credentials / 环境变量 三处解析一个密钥。 */
async function resolveKey(ctx, directVal, refName) {
  if (directVal !== undefined && String(directVal).trim() !== '') return String(directVal).trim();
  const credentials = ctx.get('credentials');
  if (credentials !== undefined && refName) {
    try {
      const hit = await credentials.resolve(refName);
      if (hit !== undefined && hit.value !== undefined && String(hit.value).trim() !== '') {
        return String(hit.value).trim();
      }
    } catch {
      /* 解析失败视为未配置 */
    }
  }
  if (refName) return String(process.env[refName] ?? '').trim();
  return '';
}

export function apply(ctx, config = {}) {
  let servicePromise = null;

  /** 懒解析密钥并构建服务（每次执行前确保密钥已就绪）。 */
  function getService() {
    if (servicePromise !== null) return servicePromise;
    servicePromise = (async () => {
      const [kdEid, kdKey, k1Customer, k1Key] = await Promise.all([
        resolveKey(ctx, config.kdniaoEbusinessId, config.kdniaoEbusinessIdRef),
        resolveKey(ctx, config.kdniaoApiKey, config.kdniaoApiKeyRef),
        resolveKey(ctx, config.kuaidi100Customer, config.kuaidi100CustomerRef),
        resolveKey(ctx, config.kuaidi100Key, config.kuaidi100KeyRef),
      ]);
      return new LogisticsService({
        provider: config.provider ?? 'auto',
        autoDetect: config.autoDetect ?? true,
        kdniaoEbusinessId: kdEid,
        kdniaoApiKey: kdKey,
        kuaidi100Customer: k1Customer,
        kuaidi100Key: k1Key,
      });
    })();
    return servicePromise;
  }

  // -------------------------------------------------------------------------
  // 工具 1：查询快递轨迹
  // -------------------------------------------------------------------------
  ctx.tools.register(
    defineTool({
      name: 'logistics_trace',
      description:
        '查询快递包裹的实时物流轨迹。适用于拼多多、淘宝、抖音等电商平台购买的商品快递，输入运单号即可跨平台查询。当用户想查快递、物流、包裹到哪了时使用。',
      parameters: {
        trackingNumber: {
          type: 'string',
          required: true,
          description: '快递运单号，例如 SF1234567890123',
        },
        companyCode: {
          type: 'string',
          description:
            '快递公司编码（可选）。快递鸟编码如 SF/YTO/ZTO/STO/YD；快递100编码如 shunfeng/yuantong/zhongtong。不填则自动识别。',
        },
        phoneTail: {
          type: 'string',
          description: '收/寄件人手机号后四位（部分快递如顺丰查询时必填）',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args, exec) {
        const service = await getService();
        if (!service.ready) {
          throw new Error(
            '物流插件尚未配置密钥：请在 $DSH_HOME/.credentials.yaml 配置 KDNIAO_EBUSINESS_ID / KDNIAO_APP_KEY 或 KUAIDI100_CUSTOMER / KUAIDI100_KEY',
          );
        }
        const result = await service.trace(
          {
            trackingNumber: args.trackingNumber,
            companyCode: args.companyCode,
            phoneTail: args.phoneTail,
          },
          exec.signal,
        );
        return formatTraceText(result);
      },
    }),
  );

  // -------------------------------------------------------------------------
  // 工具 2：识别快递公司
  // -------------------------------------------------------------------------
  ctx.tools.register(
    defineTool({
      name: 'logistics_detect',
      description:
        '识别一个快递运单号属于哪家快递公司（承运商）。当用户给了运单号但不确定是哪家快递时使用。',
      parameters: {
        trackingNumber: {
          type: 'string',
          required: true,
          description: '快递运单号',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args, exec) {
        const service = await getService();
        const result = await service.detect(args.trackingNumber, exec.signal);
        if (result.candidates.length === 0) {
          return `未能识别运单号 ${result.trackingNumber} 的承运商`;
        }
        const list = result.candidates
          .slice(0, 5)
          .map((c) => `- ${c.name || c.code}（${c.code}）`)
          .join('\n');
        return `运单号 ${result.trackingNumber} 可能的承运商：\n${list}`;
      },
    }),
  );

  // -------------------------------------------------------------------------
  // HTTP 路由：供浏览器面板读取（异步 handler 受支持）
  // -------------------------------------------------------------------------
  ctx.inject(['webServer'], (webCtx) => {
    const json = (res, status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    };

    const makeHandler = (kind) => async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
        return;
      }
      try {
        const u = new URL(req.url ?? '/', 'http://127.0.0.1');
        const num = (u.searchParams.get('num') ?? '').trim();
        const com = (u.searchParams.get('com') ?? '').trim();
        const phone = (u.searchParams.get('phone') ?? '').trim();
        if (num === '') {
          json(res, 400, { ok: false, error: '缺少运单号参数 num' });
          return;
        }
        const service = await getService();
        if (kind === 'detect') {
          const result = await service.detect(num);
          json(res, 200, { ok: true, ...result });
        } else {
          if (!service.ready) {
            json(res, 400, { ok: false, error: '尚未配置物流密钥（见 README）' });
            return;
          }
          const result = await service.trace({ trackingNumber: num, companyCode: com, phoneTail: phone });
          json(res, 200, { ok: true, ...result });
        }
      } catch (error) {
        json(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    };

    webCtx.effect(() => {
      webCtx.webServer.register({ kind: 'exact', path: '/logistics/trace', handler: makeHandler('trace') });
      webCtx.webServer.register({ kind: 'exact', path: '/logistics/detect', handler: makeHandler('detect') });
    }, 'dsh-logistics-tracker: routes');
  });
}
