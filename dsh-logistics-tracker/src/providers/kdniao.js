import { createHash } from 'node:crypto';
import { STATE_TEXT, KDNIAO_COMPANY } from './constants.js';

const ENDPOINT = 'https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx';

/** 快递鸟状态码 -> 标准化状态（0 无轨迹 / 1 揽收 / 2 途中 / 3 签收 / 4 问题件 / 5 退回） */
const STATE_MAP = {
  '0': 'pending',
  '1': 'collected',
  '2': 'transit',
  '3': 'delivered',
  '4': 'problem',
  '5': 'returned',
};

/**
 * 快递鸟签名：DataSign = URLEncode( Base64( MD5(RequestData + AppKey) ) )
 * MD5 输出是 16 字节二进制，再做 Base64，最后 URL 编码。
 */
function buildSign(requestData, apiKey) {
  const md5Bytes = createHash('md5').update(requestData + apiKey, 'utf8').digest();
  return encodeURIComponent(md5Bytes.toString('base64'));
}

export class KdniaoAdapter {
  constructor(cfg) {
    this.id = 'kdniao';
    this.eBusinessId = cfg.eBusinessId;
    this.apiKey = cfg.apiKey;
  }

  async post(requestType, requestData, signal) {
    const payload = JSON.stringify(requestData);
    const body = new URLSearchParams({
      RequestType: requestType,
      EBusinessID: this.eBusinessId,
      RequestData: payload,
      DataSign: buildSign(payload, this.apiKey),
      DataType: '2', // 返回 JSON
    });

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: body.toString(),
      signal,
    });

    if (!res.ok) {
      throw new Error(`快递鸟接口请求失败：HTTP ${res.status}`);
    }
    return res.json();
  }

  async detect(trackingNumber, signal) {
    const resp = await this.post('2002', { LogisticCode: trackingNumber }, signal);
    const shippers = Array.isArray(resp?.Shippers) ? resp.Shippers : [];
    return {
      trackingNumber,
      candidates: shippers.map((s) => ({
        code: s.ShipperCode ?? '',
        name: s.ShipperName ?? '',
      })),
    };
  }

  async trace(req, signal) {
    let shipperCode = (req.companyCode ?? '').trim();

    if (!shipperCode) {
      const detected = await this.detect(req.trackingNumber, signal);
      shipperCode = detected.candidates[0]?.code ?? '';
      if (!shipperCode) {
        throw new Error(`无法识别运单号 ${req.trackingNumber} 的承运商，请手动指定快递公司编码`);
      }
    }

    const resp = await this.post(
      '1002',
      {
        OrderCode: '',
        ShipperCode: shipperCode,
        LogisticCode: req.trackingNumber,
      },
      signal,
    );

    if (!resp || resp.Success === false) {
      throw new Error(`快递鸟查询失败：${resp?.Reason || '未知错误'}`);
    }

    const state = STATE_MAP[String(resp.State)] ?? 'transit';
    const traces = (Array.isArray(resp.Traces) ? resp.Traces : []).map((t) => ({
      time: t.AcceptTime ?? '',
      description: t.AcceptStation ?? '',
      status: t.Remark ?? undefined,
    }));

    return {
      provider: 'kdniao',
      trackingNumber: req.trackingNumber,
      companyCode: resp.ShipperCode ?? shipperCode,
      companyName: resp.ShipperName || KDNIAO_COMPANY[resp.ShipperCode] || '',
      state,
      stateText: STATE_TEXT[state],
      currentLocation: resp.Location ?? undefined,
      delivered: state === 'delivered',
      traces,
    };
  }
}
