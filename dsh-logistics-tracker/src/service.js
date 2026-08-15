import { KdniaoAdapter } from './providers/kdniao.js';
import { Kuaidi100Adapter } from './providers/kuaidi100.js';

/**
 * 物流服务：按配置实例化一个或多个通道，向上提供统一的 trace / detect。
 * 工具与面板共用这一层。
 */
export class LogisticsService {
  constructor(cfg = {}) {
    this.adapters = [];
    this.preferred = cfg.provider ?? 'auto';

    if (cfg.kdniaoEbusinessId && cfg.kdniaoApiKey) {
      this.adapters.push(new KdniaoAdapter({ eBusinessId: cfg.kdniaoEbusinessId, apiKey: cfg.kdniaoApiKey }));
    }
    if (cfg.kuaidi100Customer && cfg.kuaidi100Key) {
      this.adapters.push(new Kuaidi100Adapter({ customer: cfg.kuaidi100Customer, key: cfg.kuaidi100Key }));
    }
  }

  /** 是否已配置任一通道的密钥 */
  get ready() {
    return this.adapters.length > 0;
  }

  pick() {
    if (this.adapters.length === 0) return undefined;
    if (this.preferred === 'kdniao') {
      return this.adapters.find((a) => a.id === 'kdniao') ?? this.adapters[0];
    }
    if (this.preferred === 'kuaidi100') {
      return this.adapters.find((a) => a.id === 'kuaidi100') ?? this.adapters[0];
    }
    return this.adapters[0];
  }

  async trace(req, signal) {
    const adapter = this.pick();
    if (!adapter) {
      throw new Error(
        '物流插件尚未配置密钥：请在 $DSH_HOME/.credentials.yaml 里配置 KDNIAO_EBUSINESS_ID / KDNIAO_APP_KEY 或 KUAIDI100_CUSTOMER / KUAIDI100_KEY（见 README）',
      );
    }
    return adapter.trace(req, signal);
  }

  async detect(trackingNumber, signal) {
    const adapter = this.pick();
    if (adapter?.detect) {
      return adapter.detect(trackingNumber, signal);
    }
    // 兜底：快递100 免费单号识别，无需 key
    return new Kuaidi100Adapter({ customer: '', key: '' }).detect(trackingNumber, signal);
  }
}

/** 把结构化轨迹格式化成模型/人类可读的文本。 */
export function formatTraceText(r) {
  const lines = [];
  lines.push(`运单号：${r.trackingNumber}`);
  lines.push(`承运商：${r.companyName || r.companyCode || '未知'}`);
  lines.push(`当前状态：${r.stateText}`);
  if (r.currentLocation) lines.push(`当前位置：${r.currentLocation}`);
  lines.push('');
  lines.push('物流轨迹（时间正序）：');
  if (r.traces.length === 0) {
    lines.push('  （暂无轨迹节点）');
  } else {
    for (const t of r.traces) {
      const ts = t.time ? `[${t.time}] ` : '';
      lines.push(`  ${ts}${t.description}`);
    }
  }
  return lines.join('\n');
}
