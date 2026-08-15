/**
 * 标准化状态 -> 中文描述
 */
export const STATE_TEXT = {
  pending: '暂无物流信息',
  collected: '已揽收',
  transit: '运输中',
  delivering: '派送中',
  delivered: '已签收',
  problem: '问题件 / 异常',
  returned: '已退回',
};

/** 快递鸟承运商编码 -> 中文名（即时查询接口不返回中文名时的兜底） */
export const KDNIAO_COMPANY = {
  SF: '顺丰速运',
  YTO: '圆通速递',
  ZTO: '中通快递',
  STO: '申通快递',
  YD: '韵达快递',
  YUNDA: '韵达快递',
  EMS: '中国邮政EMS',
  JD: '京东物流',
  HTKY: '百世快递',
  BEST: '百世快递',
  ZJS: '宅急送',
  DBL: '德邦快递',
  YZPY: '邮政包裹',
  YZGN: '邮政国内小包',
};

/** 快递100 承运商编码 -> 中文名 */
export const KUAIDI100_COMPANY = {
  shunfeng: '顺丰速运',
  yuantong: '圆通速递',
  zhongtong: '中通快递',
  shentong: '申通快递',
  yunda: '韵达快递',
  ems: '中国邮政EMS',
  youzhengguonei: '邮政包裹',
  jd: '京东物流',
  tiantian: '天天快递',
  zhaijisong: '宅急送',
  debangkuaidi: '德邦快递',
  huitongkuaidi: '百世快递',
  yuantongkuaiyun: '圆通快运',
  guotongkuaidi: '国通快递',
  shenghuiwuliu: '盛辉物流',
  yundaexpress: '韵达快递',
  dhl: 'DHL',
  sfexpress: '顺丰速运',
};
