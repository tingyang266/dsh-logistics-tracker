/**
 * dsh-logistics-tracker — 浏览器半侧（懒加载 CJS 客户端 bundle）。
 *
 * 在 `sidebar.footer.action` 槽位注册一个查询入口（参考 dsh-client-ui-cordis 的
 * CordisPanel 模式）：侧边栏底部显示「查物流」按钮，点击展开面板，
 * 输入运单号 → 调用宿主 /logistics/trace 路由 → 展示状态与轨迹。
 * 密钥只存在于宿主侧，浏览器不接触任何密钥。
 *
 * 注意：与官方文档不同，客户端加载器实际是 window.__ModuleLoader__（双下划线），
 * 且客户端插件以 { apply, inject } 形式导出（Cordis 风格），通过 ctx.slots 注入组件。
 */
window.__ModuleLoader__.load({
  id: 'dsh-logistics-tracker',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    let react = require('react');

    //#region styles
    const CSS_ID = 'dsh-logistics-tracker/styles.css';
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + CSS_ID + '"]') === null) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-logistics-tracker';
      tag.dataset.pluginCss = CSS_ID;
      tag.textContent = [
        /* 侧边栏入口按钮（footer.action 槽位内） */
        '.dshlg_trigger{display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#b6b6b6);cursor:pointer;font-size:12px;line-height:20px;text-align:left}',
        '.dshlg_trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,#e6e6e6)}',
        '.dshlg_trigger[data-active="true"]{background:var(--dsw-alias-interactive-bg-active,rgba(37,99,235,.18));color:var(--dsw-alias-label-primary,#e6e6e6)}',
        '.dshlg_trigger[data-wide="false"]{justify-content:center;padding:0}',
        '.dshlg_triggerLabel{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        /* 展开面板：侧边栏内联（跟随 footArea 宽度），不遮挡对话区 */
        '.dshlg_panel{display:flex;flex-direction:column;gap:6px;margin-top:4px;padding:8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin,rgba(128,128,128,.2));background:var(--dsw-alias-interactive-bg-hover,transparent)}',
        '.dshlg_panel[data-wide="false"]{position:fixed;left:48px;bottom:72px;width:280px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.4)}',
        '.dshlg_input{flex:1;min-width:0;height:26px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-separator-primary,#333);background:var(--dsw-alias-interactive-bg-hover,transparent);color:var(--dsw-alias-label-primary,#e6e6e6);outline:none}',
        '.dshlg_row{display:flex;gap:6px;align-items:center}',
        '.dshlg_btn{height:26px;padding:0 10px;border:0;border-radius:6px;background:var(--dsw-alias-interactive-primary,#2563eb);color:#fff;cursor:pointer;font-size:12px;white-space:nowrap}',
        '.dshlg_btn:disabled{opacity:.6;cursor:default}',
        '.dshlg_result{margin-top:2px;color:var(--dsw-alias-label-secondary,#b6b6b6);font-size:12px;line-height:18px}',
        '.dshlg_state{font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}',
        '.dshlg_err{color:var(--dsw-alias-state-error-primary,#f06)}',
        '.dshlg_trace{margin:4px 0 0;padding-left:16px}',
        '.dshlg_trace li{margin-bottom:3px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
        '.dshlg_trace time{color:var(--dsw-alias-label-tertiary,#7a7a7a);margin-right:6px}',
      ].join('\n');
      document.head.appendChild(tag);
    }
    //#endregion

    const LogisticsDock = react.memo(function LogisticsDock({ wide }) {
      const [open, setOpen] = react.useState(false);
      const [num, setNum] = react.useState('');
      const [com, setCom] = react.useState('');
      const [phone, setPhone] = react.useState('');
      const [loading, setLoading] = react.useState(false);
      const [result, setResult] = react.useState(null);
      const [error, setError] = react.useState('');

      async function query() {
        const n = num.trim();
        if (n === '' || loading) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
          const params = new URLSearchParams({ num: n });
          if (com.trim() !== '') params.set('com', com.trim());
          if (phone.trim() !== '') params.set('phone', phone.trim());
          const res = await fetch('/logistics/trace?' + params.toString(), {
            cache: 'no-store',
            headers: { accept: 'application/json' },
          });
          const data = await res.json();
          if (data.ok) setResult(data);
          else setError(data.error || '查询失败');
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      }

      const onKey = (e) => {
        if (e.key === 'Enter') query();
      };

      return react.createElement('div', { className: 'dshlg_root' },
        /* 入口按钮（始终显示；折叠时只显示图标） */
        react.createElement('button', {
          type: 'button',
          className: 'dshlg_trigger',
          'data-wide': String(wide),
          'data-active': open || undefined,
          'aria-label': '查物流',
          'aria-expanded': open,
          onClick: () => setOpen((v) => !v),
        },
          react.createElement('span', { 'aria-hidden': true }, '📦'),
          wide ? react.createElement('span', { className: 'dshlg_triggerLabel' }, '查物流') : null,
        ),
        /* 展开面板 */
        open ? react.createElement('div', { className: 'dshlg_panel', 'data-wide': String(wide) },
          react.createElement('div', { className: 'dshlg_row' },
            react.createElement('input', {
              className: 'dshlg_input',
              placeholder: '快递运单号（如 SF1234567890123）',
              value: num,
              onChange: (e) => setNum(e.target.value),
              onKeyDown: onKey,
            }),
            react.createElement('button', { className: 'dshlg_btn', onClick: query, disabled: loading }, loading ? '…' : '查询'),
          ),
          react.createElement('div', { className: 'dshlg_row' },
            react.createElement('input', {
              className: 'dshlg_input',
              style: { flex: 1 },
              placeholder: '公司编码(可选)',
              value: com,
              onChange: (e) => setCom(e.target.value),
              onKeyDown: onKey,
            }),
            react.createElement('input', {
              className: 'dshlg_input',
              style: { flex: 1 },
              placeholder: '手机后4位(可选)',
              value: phone,
              onChange: (e) => setPhone(e.target.value),
              onKeyDown: onKey,
            }),
          ),
          error !== '' ? react.createElement('div', { className: 'dshlg_result dshlg_err' }, error) : null,
          result !== null ? react.createElement('div', { className: 'dshlg_result' },
            react.createElement('div', { className: 'dshlg_state' },
              (result.companyName || result.companyCode) + ' · ' + result.stateText +
              (result.currentLocation ? ' · ' + result.currentLocation : '')),
            react.createElement('ol', { className: 'dshlg_trace' },
              (result.traces || []).map((t, i) =>
                react.createElement('li', { key: i },
                  t.time ? react.createElement('time', null, t.time) : null,
                  t.description),
              )),
          ) : null,
        ) : null,
      );
    });

    const inject = ['slots'];

    function apply(ctx) {
      ctx.slots.inject('sidebar.footer.action', () => {
        const dispose = ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'dsh-logistics-tracker',
          order: 1,
        }, LogisticsDock);
        return () => {
          dispose();
        };
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
