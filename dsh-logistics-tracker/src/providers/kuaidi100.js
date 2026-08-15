import { createHash } from 'node:crypto';
import { STATE_TEXT, KUAIDI100_COMPANY } from './constants.js';

const TRACE_ENDPOINT = 'https://poll.kuaidi100.com/poll/query.do';
// 免费的单号识别接口，无需 key
const AUTO_ENDPOINT = 'https://www.kuaidi100.com/autonumber/autoComNum';

/**
 * 快递100 状态码 -> 标准化状态：
 * 0 在途 / 1 揽收 / 2 疑难 / 3 签收 / 4 退签 / 5 派件 / 6 退回 / 7 转投 /
 * 8 清关 / 10 待清关 / 11 已清关 / 12 派件中 / 13 拒收 / 14 已退回
 */
const STATE_MAP = {
  '0': 'transit',
  '1': 'collected',
  '2': 'problem',
  '3': 'delivered',
  '4': 'returned',
  '5': 'delivering',
  '6': 'returned',
  '7': 'transit',
  '8': 'transit',
  '10': 'transit',
  '11': 'transit',
  '12': 'delivering',
  '13': 'problem',
  '14': 'returned',
};

export class Kuaidi100Adapter {
  constructor(cfg) {
    this.id = 'kuaidi100';
    this.customer = cfg.customer;
    this.key = cfg.key;
  }

  /** 快递100 签名：sign = MD5(param + key + customer).toUpperCase() */
  sign(param) {
    return createHash('md5')
      .update(param + this.key + this.customer, 'utf8')
      .digest('hex')
      .toUpperCase();
  }

  async detect(trackingNumber, signal) {
    const url = `${AUTO_ENDPOINT}?text=${encodeURIComponent(trackingNumber)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`快递100 单号识别失败：HTTP ${res.status}`);
    }
    const resp = await res.json();
    const auto = Array.isArray(resp?.auto) ? resp.auto : [];
    return {
      trackingNumber,
      candidates: auto.map((a) => ({
        code: a.comCode ?? '',
        name: KUAIDI100_COMPANY[a.comCode ?? ''] ?? a.comCode ?? '',
      })),
    };
  }

  async trace(req, signal) {
    let com = (req.companyCode ?? '').trim();

    if (!com) {
      const detected = await this.detect(req.trackingNumber, signal);
      com = detected.candidates[0]?.code ?? '';
      if (!com) {
        throw new Error(`无法识别运单号 ${req.trackingNumber} 的承运商，请手动指定快递公司编码`);
      }
    }

    const param = JSON.stringify({
      com,
      num: req.trackingNumber,
      phone: req.phoneTail ?? '',
      resultv2: '1',
    });

    const body = new URLSearchParams({
      customer: this.customer,
      sign: this.sign(param),
      param,
    });

    const res = await fetch(TRACE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal,
    });

    if (!res.ok) {
      throw new Error(`快递100接口请求失败：HTTP ${res.status}`);
    }

    const resp = await res.json();
    if (!resp || resp.status !== '200' || resp.message !== 'ok') {
      throw new Error(`快递100查询失败：${resp?.message || resp?.status || '未知错误'}`);
    }

    const state = STATE_MAP[String(resp.state)] ?? 'transit';
    const data = Array.isArray(resp.data) ? resp.data : [];
    const traces = data.map((t) => ({
      time: t.time ?? t.ftime ?? '',
      description: t.context ?? '',
      status: t.status ?? undefined,
    }));

    return {
      provider: 'kuaidi100',
      trackingNumber: req.trackingNumber,
      companyCode: resp.com ?? com,
      companyName: KUAIDI100_COMPANY[resp.com] ?? resp.com ?? '',
      state,
      stateText: STATE_TEXT[state],
      delivered: state === 'delivered',
      traces,
    };
  }
}
