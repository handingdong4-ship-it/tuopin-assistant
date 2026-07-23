// ==UserScript==
// @name         大淘客拓品助手
// @namespace    https://www.dataoke.com/
// @version      5.8.0
// @downloadURL  https://raw.githubusercontent.com/handingdong4-ship-it/tuopin-assistant/main/tuopin-assistant.user.js
// @updateURL    https://raw.githubusercontent.com/handingdong4-ship-it/tuopin-assistant/main/tuopin-assistant.user.js
// @description  在大淘客选品库页面，商品卡片左上角显示复选框，勾选即选中，配合浮动工具栏获取商品详情及优惠文案，支持一键发布到SMZDM
// @author       handongxue
// @match        *://*dataoke.com/xp/*
// @match        *://*dataoke.com/*
// @include      *dataoke.com*
// @match        *://youhui.bgm.smzdm.com/add_guonei*
// @match        *://youhui.bgm.smzdm.com/edit_youhui*
// @match        *://biaodan.bgm.smzdm.com/*
// @match        *://www.smzdm.com/p/*
// @match        *://task-bgm.smzdm.com/*
// @match        *://search.jd.com/*
// @match        *://list.jd.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @connect      detail.tmall.com
// @connect      chaoshi.detail.tmall.com
// @connect      item.taobao.com
// @connect      uland.taobao.com
// @connect      s.click.taobao.com
// @connect      www.smzdm.com
// @connect      go.smzdm.com
// @connect      biaodan.bgm.smzdm.com
// @connect      mindpad-bgm.smzdm.com
// @connect      commission-bgm.agentdevops.zdm.net
// @connect      bi-superset-bgm.smzdm.com
// @connect      youhui.bgm.smzdm.com
// @connect      sso-bgm.smzdm.com
// @connect      10.45.148.12
// @connect      gw-openapi-bgm.smzdm.com
// @connect      openai-cv-bgm.smzdm.com
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ===== 版本更新检查：拉服务端 version.json 比对版本，发现新版在「拓品助手」面板标题旁显示更新徽标 =====
  var __tuopinUpdateInfo = null;     // { newVer, curVer, dlUrl }
  var __tuopinUpdateDismissed = false;
  // 只在「拓品助手」主面板标题旁注入更新徽标（不在条形工具栏上注入）
  function __tuopinApplyUpdateBadge() {
    if (!__tuopinUpdateInfo || __tuopinUpdateDismissed) return;
    var info = __tuopinUpdateInfo;
    var co = document.getElementById('tuopin-co-panel');
    if (!co) return;
    var titleSpan = null;
    var spans = co.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      if (spans[i].getAttribute('data-tuopin-badged') === '1') continue;
      if ((spans[i].textContent || '').indexOf('拓品助手') === 0) { titleSpan = spans[i]; break; }
    }
    if (!titleSpan) return;
    titleSpan.setAttribute('data-tuopin-badged', '1');
    var badge = document.createElement('a');
    badge.className = 'tuopin-update-badge';
    badge.href = info.dlUrl;
    badge.target = '_blank';
    badge.title = '当前 v' + info.curVer + '，点击下载新版 v' + info.newVer;
    badge.style.cssText = 'display:inline-flex;align-items:center;margin-left:6px;padding:1px 7px;border-radius:9px;background:linear-gradient(90deg,#ff7a00,#ff4757);color:#fff;font-size:10px;font-weight:600;text-decoration:none;line-height:1.6;white-space:nowrap;box-shadow:0 1px 4px rgba(255,71,87,0.45);';
    badge.textContent = '🔔 v' + info.newVer + ' ↗';
    var close = document.createElement('span');
    close.className = 'tuopin-update-badge-x';
    close.title = '今日不再提示';
    close.style.cssText = 'display:inline-flex;align-items:center;margin-left:4px;cursor:pointer;font-size:12px;color:#bbb;line-height:1.6;';
    close.textContent = '✕';
    close.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      __tuopinUpdateDismissed = true;
      try { GM_setValue('tuopin_update_dismiss', info.newVer + '|' + new Date().toDateString()); } catch (err) {}
      document.querySelectorAll('.tuopin-update-badge, .tuopin-update-badge-x').forEach(function (el) { el.remove(); });
      document.querySelectorAll('[data-tuopin-badged]').forEach(function (el) { el.removeAttribute('data-tuopin-badged'); });
    };
    titleSpan.parentNode.insertBefore(badge, titleSpan.nextSibling);
    titleSpan.parentNode.insertBefore(close, badge.nextSibling);
  }
  window.__tuopinApplyUpdateBadge = __tuopinApplyUpdateBadge;

  (function checkUpdate() {
    var VERSION_URL = 'https://commission-bgm.agentdevops.zdm.net/tuopin-version';
    var DL_URL = 'https://raw.githubusercontent.com/handingdong4-ship-it/tuopin-assistant/main/tuopin-assistant.user.js';
    var curVer = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '';
    if (!curVer) return;

    function cmpVer(a, b) {
      var pa = String(a).split('.').map(function(n) { return parseInt(n, 10) || 0; });
      var pb = String(b).split('.').map(function(n) { return parseInt(n, 10) || 0; });
      var len = Math.max(pa.length, pb.length);
      for (var i = 0; i < len; i++) {
        var x = pa[i] || 0, y = pb[i] || 0;
        if (x > y) return 1;
        if (x < y) return -1;
      }
      return 0;
    }

    function onNewVer(newVer) {
      var dismiss = '';
      try { dismiss = GM_getValue('tuopin_update_dismiss', ''); } catch (e) {}
      if (dismiss === newVer + '|' + new Date().toDateString()) return;
      __tuopinUpdateInfo = { newVer: newVer, curVer: curVer, dlUrl: DL_URL };
      // 面板可能尚未构建：立即试一次，之后每 2s 补一次（共 6 次），覆盖面板晚构建的情况
      __tuopinApplyUpdateBadge();
      var tries = 0;
      var iv = setInterval(function () {
        __tuopinApplyUpdateBadge();
        if (++tries >= 6) clearInterval(iv);
      }, 2000);
    }

    function doCheck() {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url: VERSION_URL + '?_t=' + Date.now(),
          timeout: 8000,
          onload: function(resp) {
            try {
              var data = JSON.parse(resp.responseText || '{}');
              var remoteVer = data.version || '';
              if (!remoteVer || cmpVer(remoteVer, curVer) <= 0) return;
              onNewVer(remoteVer);
            } catch (e) {}
          },
          onerror: function() {},
          ontimeout: function() {}
        });
      } catch (e) {}
    }

    // 延迟 3s 检查，避开页面初始化高峰
    setTimeout(doCheck, 3000);
  })();

  // ===== 公共：右上角堆叠容器（汇总面板在上，各页面进度面板在下）=====
  function getRightStack() {
    var s = document.getElementById('tuopin-rt-stack');
    if (!s) {
      s = document.createElement('div');
      s.id = 'tuopin-rt-stack';
      s.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;max-height:calc(100vh - 20px);overflow-y:auto;overflow-x:hidden;padding:2px 4px 8px 2px;';
      document.body.appendChild(s);
    }
    return s;
  }

  // ===== 流程归属锁：保证队列只在「发起流程的那个标签页」里跑，用户切到别的页面/标签不会重跑 =====
  // runId 通过 URL 参数 ?tuopin_run= 跨子域/跨重载传递，sessionStorage 在同子域内缓存。
  // runId 内嵌单调递增序号 seq：新发起的流程序号更大，可抢占旧流程；旧流程标签页下次 reload 时让位。
  // 锁存在 GM（跨标签共享）+ 心跳续期；带 runId 的标签认领，被动标签（无 runId）一律退出。
  var TUOPIN_FLOW_LOCK_KEY = 'tuopin_flow_lock';
  var TUOPIN_FLOW_SEQ_KEY = 'tuopin_flow_seq';
  var TUOPIN_FLOW_TTL = 120000;  // 锁 120s 过期（单步填表/提交足够宽松，过期才有被动标签接管风险）
  var TUOPIN_FLOW_HB = 8000;     // 心跳 8s 续期
  var __tuopinHbTimer = null;
  var CO_RELAY_URL = 'http://10.45.40.130:8099';
  function tuopinGetRunId() {
    try {
      var sp = new URL(location.href).searchParams.get('tuopin_run');
      if (sp) { try { sessionStorage.setItem('tuopin_run', sp); } catch (e) {} return sp; }
    } catch (e) {}
    try { return sessionStorage.getItem('tuopin_run') || ''; } catch (e) { return ''; }
  }
  // biaodan 等子域内 SPA 跳转后 URL 不带 runId、又可能因协议变化 sessionStorage 隔离，
  // 兜底：当前 GM 锁若仍新鲜，则认其 runId 为本页所属流程（仅用于导航续传，不用于身份判定）。
  function tuopinGetRunIdWithFallback() {
    var r = tuopinGetRunId();
    if (r) return r;
    var lock = tuopinReadLock();
    if (lock.ts && (Date.now() - lock.ts) < TUOPIN_FLOW_TTL && lock.runId) return lock.runId;
    return '';
  }
  // 解析 runId 里的序号（runId 形如 s<seq>r<rand>）；解析失败返回 -1
  function tuopinSeqOf(runId) { var m = /^s(\d+)r/.exec(runId || ''); return m ? parseInt(m[1], 10) : -1; }
  function tuopinNewRunId() {
    var seq = (parseInt(GM_getValue(TUOPIN_FLOW_SEQ_KEY, '0'), 10) || 0) + 1;
    GM_setValue(TUOPIN_FLOW_SEQ_KEY, String(seq));
    var id = 's' + seq + 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
    try { sessionStorage.setItem('tuopin_run', id); } catch (e) {}
    return id;
  }
  function tuopinReadLock() { try { return JSON.parse(GM_getValue(TUOPIN_FLOW_LOCK_KEY, '{}')) || {}; } catch (e) { return {}; } }
  function tuopinWriteLock(runId) { GM_setValue(TUOPIN_FLOW_LOCK_KEY, JSON.stringify({ runId: runId, seq: tuopinSeqOf(runId), ts: Date.now() })); }
  function tuopinStartHb() {
    if (__tuopinHbTimer) clearInterval(__tuopinHbTimer);
    __tuopinHbTimer = setInterval(function () {
      try { var r = sessionStorage.getItem('tuopin_run'); if (r) tuopinWriteLock(r); } catch (e) {}
    }, TUOPIN_FLOW_HB);
  }
  // 判定本标签页是否应执行队列，并在应执行时接管锁。核心原则：
  //   锁只用来标记「有没有别的标签页正在活跃跑」；没有活跃流程时谁都能跑。
  //   身份用 sessionStorage（每标签独立）+ URL 参数，不用 GM 锁做身份（避免所有标签都自认流程页）。
  function tuopinAcquireFlow() {
    var myRun = tuopinGetRunId();            // 仅 URL 参数 / 本标签 sessionStorage
    var lock = tuopinReadLock();
    var fresh = lock.ts && (Date.now() - lock.ts) < TUOPIN_FLOW_TTL;
    if (myRun) {
      // 我是流程标签页：只有「更新序号的别的流程」在活跃跑时才让位
      if (fresh && lock.seq >= 0 && lock.seq > tuopinSeqOf(myRun) && lock.runId !== myRun) return false;
      tuopinWriteLock(myRun); tuopinStartHb(); return true;
    }
    // 我没有 runId（可能是流程页 reload 丢了 session，也可能是被动标签）：
    if (fresh && lock.runId) return false;   // 别的标签页正在活跃跑 → 我退出，避免重复
    // 没有活跃流程 → 接管：沿用锁里旧 runId 或新建，写入本标签 session，成为流程页
    var adopt = (lock.runId) ? lock.runId : tuopinNewRunId();
    try { sessionStorage.setItem('tuopin_run', adopt); } catch (e) {}
    tuopinWriteLock(adopt); tuopinStartHb(); return true;
  }
  // 流程内导航：把 runId 带进目标 URL，并把协议对齐当前页，避免 http↔https 重定向丢参数
  function tuopinGo(url) {
    var runId = tuopinGetRunIdWithFallback();
    if (runId) {
      try {
        var u = new URL(url, location.href);
        if (/^https?:$/.test(u.protocol) && u.protocol !== location.protocol) u.protocol = location.protocol;
        u.searchParams.set('tuopin_run', runId);
        url = u.toString();
      } catch (e) {}
    }
    try { window.onbeforeunload = null; } catch (e) {}
    location.href = url;
  }

  // ===== 公共：右上角汇总面板（所有 SMZDM 页面共用，表单全部完成前一直固定展示）=====
  function buildSummaryPanel() {
    var SMZDM_HOSTS = ['youhui.bgm.smzdm.com', 'biaodan.bgm.smzdm.com'];
    if (SMZDM_HOSTS.indexOf(location.hostname) === -1) return;

    var results = [];
    try { results = JSON.parse(GM_getValue('tuopin_publish_results', '[]')); } catch (e) {}
    // 没有任何发布记录，不渲染
    if (!results.length) return;
    // 用户主动关闭过面板，本次任务内不再重新显示
    if (GM_getValue('tuopin_summary_closed', '') === '1') return;

    var isBiaodan = location.hostname === 'biaodan.bgm.smzdm.com';

    var panel = document.getElementById('tuopin-summary-panel');
    var collapsed = false;
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tuopin-summary-panel';
      panel.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);' +
        'padding:12px 14px;width:300px;font-family:-apple-system,sans-serif;font-size:12px;';
      var stack = getRightStack();
      stack.insertBefore(panel, stack.firstChild); // 始终放在最上方
    }

    function render() {
      var res = [];
      try { res = JSON.parse(GM_getValue('tuopin_publish_results', '[]')); } catch (e) {}
      var done = [];
      try { done = JSON.parse(GM_getValue('tuopin_subsidy_done', '[]')); } catch (e) {}

      // 每条记录的文章id = articleId（自建）或 prevArticleId（补贴已有文章）
      var rows = res.map(function(r) {
        var prevId = r.prevArticleId || (r.prevUrl && r.prevUrl.match(/\/p\/(\d+)/) ? r.prevUrl.match(/\/p\/(\d+)/)[1] : '');
        // skip_3day + prevArticleId = 补贴了上一篇，视为已发布；skip_3day 无prevId = 完全停止
        var isSkipped = (r.status === 'skip_3day' && !prevId) || r.status === 'skip_published';
        var isPublished = r.status === 'success' || (r.status === 'skip_3day' && !!prevId);
        return {
          articleId: r.articleId || (isPublished ? prevId : ''),
          prevArticleId: prevId,
          prevUrl: r.prevUrl || (prevId ? 'https://www.smzdm.com/p/' + prevId + '/' : ''),
          title: r.title || '未知商品',
          isNew: r.status === 'success',
          isPublished: isPublished,
          isSkipped: isSkipped,
          failed: r.status === 'error',
          subsidyDone: done.indexOf(String(r.articleId || prevId || '')) >= 0,
          r: r
        };
      });

      var arrowChar = collapsed ? '▶' : '▼';
      var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (collapsed ? '0' : '8px') + ';">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<button id="tuopin-summary-panel-toggle" style="border:none;background:none;cursor:pointer;color:#666;font-size:11px;line-height:1;padding:0;flex-shrink:0;">' + arrowChar + '</button>' +
        '<span style="font-weight:600;font-size:13px;color:#333;">文章汇总</span>' +
        '</div>' +
        '<button id="tuopin-summary-panel-close" style="border:none;background:none;cursor:pointer;color:#999;font-size:16px;line-height:1;padding:0;">×</button>' +
        '</div>';
      var bodyDisplay = collapsed ? 'none' : 'block';
      h += '<div id="tuopin-summary-body" style="display:' + bodyDisplay + ';">';

      if (!rows.length) {
        h += '<div style="color:#999;font-size:11px;">暂无发布记录</div>';
      } else {
        rows.forEach(function(row, i) {
          var statusText, statusColor, showFormBtn, linkUrl, linkId;
          if (row.isSkipped) {
            linkUrl = row.prevUrl || (row.prevArticleId ? 'https://www.smzdm.com/p/' + row.prevArticleId + '/' : '');
            linkId = row.prevArticleId;
            statusText = '已跳过';
            statusColor = '#999';
            showFormBtn = false;
          } else if (row.failed) {
            linkUrl = '';
            linkId = '';
            statusText = '失败';
            statusColor = '#ff4d4f';
            showFormBtn = false;
          } else if (isBiaodan) {
            linkUrl = row.articleId ? 'https://www.smzdm.com/p/' + row.articleId + '/' : '';
            linkId = row.articleId;
            statusText = row.subsidyDone ? '已补贴' : '未补贴';
            statusColor = row.subsidyDone ? '#52c41a' : '#faad14';
            showFormBtn = !row.subsidyDone && !!row.articleId;
          } else {
            linkUrl = row.articleId ? 'https://www.smzdm.com/p/' + row.articleId + '/' : '';
            linkId = row.articleId;
            statusText = row.isPublished ? '已发布' : '未发布';
            statusColor = row.isPublished ? '#52c41a' : '#ff4d4f';
            showFormBtn = !!row.articleId && parseFloat(row.r.subsidy || '0') > 0;
          }
          var titleHtml = linkUrl
            ? '<a href="' + linkUrl + '" target="_blank" style="color:#1890ff;text-decoration:none;">' + row.title.slice(0, 24) + '</a>'
            : '<span style="color:#666;">' + row.title.slice(0, 24) + '</span>';
          h += '<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;">';
          h += '<div style="color:#333;margin-bottom:3px;line-height:1.4;">商品' + (i + 1) + '：' + titleHtml + '</div>';
          if (row.isSkipped && row.r.reason) {
            h += '<div style="color:#aaa;font-size:10px;margin-bottom:2px;">' + row.r.reason + (linkId ? '（文章' + linkId + '）' : '') + '</div>';
          }
          h += '<div style="display:flex;align-items:center;gap:8px;">';
          h += '<span style="color:' + statusColor + ';font-weight:600;font-size:11px;">' + statusText + '</span>';
          if (showFormBtn) {
            var rr = row.r;
            h += '<button class="tuopin-panel-form-btn" data-article-id="' + row.articleId + '" ' +
              'data-title="' + (rr.title || '').replace(/"/g, '') + '" ' +
              'data-subsidy="' + (rr.subsidy || '') + '" ' +
              'data-deal-price="' + (rr.dealPrice || '') + '" ' +
              'data-price="' + (rr.price || '') + '" ' +
              'data-product-link="' + (rr.productLink || '') + '" ' +
              'data-commission-rate="' + (rr.commissionRate || '') + '" ' +
              'data-goods-sign="' + (rr.goodsSign || '') + '" ' +
              'data-mall="' + (rr.mall || '') + '" ' +
              'data-b-duan="' + (rr.bDuan || '') + '" ' +
              'data-gid="' + (rr.gid || '') + '" ' +
              'data-promo-copy="' + (rr.promoCopy || '').replace(/"/g, '') + '" ' +
              'style="flex-shrink:0;padding:3px 10px;font-size:11px;background:#ff7a00;color:#fff;border:none;border-radius:4px;cursor:pointer;white-space:nowrap;">建表单</button>';
          }
          h += '</div></div>';
        });
      }
      h += '</div>'; // close tuopin-summary-body
      panel.innerHTML = h;
      panel.style.maxHeight = collapsed ? '' : '55vh';
      panel.style.overflowY = collapsed ? '' : 'auto';
      var closeBtn = document.getElementById('tuopin-summary-panel-close');
      if (closeBtn) closeBtn.onclick = function() { GM_setValue('tuopin_summary_closed', '1'); panel.remove(); };
      var toggleBtn = document.getElementById('tuopin-summary-panel-toggle');
      if (toggleBtn) toggleBtn.onclick = function() {
        collapsed = !collapsed;
        render();
      };
      panel.querySelectorAll('.tuopin-panel-form-btn').forEach(function(btn) {
        btn.onclick = function() {
          var articleId = btn.dataset.articleId;
          var sq = [];
          try { sq = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
          var existsIdx = -1;
          for (var i = 0; i < sq.length; i++) {
            if (String(sq[i].articleId) === String(articleId)) { existsIdx = i; break; }
          }
          if (existsIdx < 0) {
            sq.push({
              articleId: articleId,
              title: btn.dataset.title,
              productLink: btn.dataset.productLink,
              price: btn.dataset.price,
              dealPrice: btn.dataset.dealPrice,
              subsidy: btn.dataset.subsidy,
              commissionRate: btn.dataset.commissionRate,
              goodsSign: btn.dataset.goodsSign,
              mall: btn.dataset.mall,
              bDuan: btn.dataset.bDuan,
              gid: btn.dataset.gid,
              promoCopy: btn.dataset.promoCopy
            });
            existsIdx = sq.length - 1;
            GM_setValue('tuopin_subsidy_queue', JSON.stringify(sq));
          }
          // 无论是否已在队列，都把 index 指向该商品，确保从正确位置开始
          GM_setValue('tuopin_subsidy_index', existsIdx);
          GM_setValue('tuopin_subsidy_saved_formid', '');
          tuopinNewRunId();
          tuopinGo('http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3');
        };
      });
    }

    render();
    // 暴露 render 供外部刷新状态
    window.__tuopinRenderSummary = render;
  }

  // 页面加载完成后渲染汇总面板
  if (document.readyState === 'complete') {
    buildSummaryPanel();
  } else {
    window.addEventListener('load', buildSummaryPanel);
  }

  // ===== SMZDM 自动发布逻辑 =====
  if (location.hostname === 'youhui.bgm.smzdm.com' && location.pathname.includes('add_guonei')) {
    var queueStr = GM_getValue('tuopin_publish_queue', '[]');
    var queue = [];
    try { queue = JSON.parse(queueStr); } catch (e) { queue = []; }
    var idx = GM_getValue('tuopin_publish_index', 0);
    if (!queue.length || idx >= queue.length) return;
    // 归属锁：只有发起流程的标签页（带 tuopin_run）才跑队列，被动标签页直接退出
    if (!tuopinAcquireFlow()) { console.log('[拓品] 非流程标签页，跳过发布队列'); return; }

    function smzdmLog(msg) {
      var box = document.getElementById('tuopin-smzdm-log');
      if (box) {
        box.innerHTML += '<div>' + msg + '</div>';
        box.scrollTop = box.scrollHeight;
      }
      console.log('[拓品发布] ' + msg);
    }

    function createStatusPanel() {
      if (document.getElementById('tuopin-smzdm-panel')) return;
      var panel = document.createElement('div');
      panel.id = 'tuopin-smzdm-panel';
      panel.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:16px;width:320px;font-family:-apple-system,sans-serif;font-size:13px;';
      panel.innerHTML = '<div style="font-weight:600;font-size:15px;margin-bottom:8px;color:#333;">拓品自动发布</div>' +
        '<div id="tuopin-smzdm-progress" style="color:#1890ff;margin-bottom:6px;">准备中...</div>' +
        '<div id="tuopin-smzdm-log" style="max-height:200px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:8px;font-size:11px;line-height:1.6;color:#666;"></div>' +
        '<div style="margin-top:8px;display:flex;gap:6px;">' +
        '<button id="tuopin-smzdm-stop" style="padding:4px 12px;border:1px solid #ff4d4f;border-radius:4px;background:#fff;color:#ff4d4f;cursor:pointer;font-size:12px;">停止</button>' +
        '</div>';
      getRightStack().appendChild(panel);
      document.getElementById('tuopin-smzdm-stop').onclick = function () {
        GM_setValue('tuopin_publish_queue', '[]');
        smzdmLog('已停止');
        document.getElementById('tuopin-smzdm-progress').textContent = '已停止';
      };
    }

    function setProgress(text) {
      var el = document.getElementById('tuopin-smzdm-progress');
      if (el) el.textContent = text;
    }

    function sleep(ms) {
      return new Promise(function (r) { setTimeout(r, ms); });
    }

    function setInputValue(el, value) {
      if (!el) return;
      var ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      ns.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function waitForElement(selector, timeout) {
      timeout = timeout || 10000;
      return new Promise(function (resolve) {
        var el = document.querySelector(selector);
        if (el && el.offsetParent !== null) { resolve(el); return; }
        var timer = setTimeout(function () { obs.disconnect(); resolve(null); }, timeout);
        var obs = new MutationObserver(function () {
          var el = document.querySelector(selector);
          if (el && el.offsetParent !== null) { clearTimeout(timer); obs.disconnect(); resolve(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      });
    }

    function pollField(name, ms, step) {
      ms = ms || 5000; step = step || 300;
      return new Promise(function (resolve) {
        var end = Date.now() + ms;
        function check() {
          var el = document.querySelector('[name="' + name + '"]');
          var v = el ? el.value : '';
          if (v) { resolve(v); return; }
          if (Date.now() < end) setTimeout(check, step);
          else resolve('');
        }
        check();
      });
    }

    function dismissPopup() {
      var b3s = document.querySelectorAll('.boxy-btn3');
      for (var i = 0; i < b3s.length; i++) {
        if (b3s[i].offsetParent !== null) {
          var v = b3s[i].getAttribute('value') || '';
          if (v.indexOf('忽略') >= 0) { b3s[i].click(); return '忽略'; }
        }
      }
      for (var i = 0; i < b3s.length; i++) {
        if (b3s[i].offsetParent !== null) { b3s[i].click(); return 'btn3'; }
      }
      var sels = ['.boxy-btn1', '.boxy-btn2', '.layui-layer-btn0'];
      for (var s = 0; s < sels.length; s++) {
        var b = document.querySelector(sels[s]);
        if (b && b.offsetParent !== null) { b.click(); return sels[s]; }
      }
      // Element UI el-dialog 弹窗（如"提示信息 - 点击同步会将此条消息再次更新..."）
      var elDialogs = document.querySelectorAll('.el-dialog__wrapper, .el-message-box__wrapper');
      for (var d = 0; d < elDialogs.length; d++) {
        if (elDialogs[d].style.display === 'none' || elDialogs[d].style.visibility === 'hidden') continue;
        var confirmBtn = elDialogs[d].querySelector('.el-button--primary, .el-message-box__btns .el-button--primary');
        if (confirmBtn && confirmBtn.offsetParent !== null) { confirmBtn.click(); return 'el-confirm'; }
        // 兜底：找文字为"确定"的按钮
        var allBtns = elDialogs[d].querySelectorAll('button');
        for (var bi = 0; bi < allBtns.length; bi++) {
          if ((allBtns[bi].textContent || '').trim() === '确定' && allBtns[bi].offsetParent !== null) {
            allBtns[bi].click(); return 'el-ok';
          }
        }
      }
      var inputs = document.querySelectorAll('input[value="确定"], input[value="确认"], button');
      for (var i = 0; i < inputs.length; i++) {
        var t = inputs[i].value || inputs[i].textContent.trim();
        if (inputs[i].offsetParent !== null && (t === '确定' || t === '确认')) { inputs[i].click(); return 'confirm'; }
      }
      return null;
    }

    async function dismissAllPopups(maxRounds, waitMs) {
      maxRounds = maxRounds || 6; waitMs = waitMs || 400;
      var dismissed = [];
      for (var i = 0; i < maxRounds; i++) {
        await sleep(waitMs);
        var r = dismissPopup();
        if (r) { dismissed.push(r); await sleep(300); }
        else break;
      }
      return dismissed;
    }

    function fetchPrevArticleInfo(url) {
      return new Promise(function(resolve) {
        if (!url) { resolve(null); return; }
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          timeout: 10000,
          onload: function(resp) {
            var html = resp.responseText || '';
            var result = { price: 0, author: '', tags: [] };
            // 价格: <span class="price-large"><span class="num">5.9</span>
            var priceMatch = html.match(/class="price-large"[\s\S]*?class="num"[^>]*>([\d.]+)/);
            if (priceMatch) result.price = parseFloat(priceMatch[1]);
            // 爆料人: onclick 中 button_name:'xxx' 或 a 标签文本
            var authorMatch = html.match(/class="author-info[\s\S]{0,800}?button_name['":\s]+['"]([^'"]+)['"]/);
            if (authorMatch) {
              result.author = authorMatch[1].trim();
            } else {
              var authorMatch2 = html.match(/class="author-info[\s\S]{0,800}?<a[^>]*>\s*([^<\s][^<]*)/);
              if (authorMatch2) result.author = authorMatch2[1].trim();
            }
            // 标签: .tags-hovers 中 "标签：xxx" 的内容
            var tagRe = /class="tags-hovers"[^>]*>[\s\S]*?标签：([^<]+)/g;
            var tm;
            while ((tm = tagRe.exec(html)) !== null) {
              result.tags.push(tm[1].trim());
            }
            // 值法标签: <a class="label red">手慢无</a> / <span class="label">白菜党</span> 等
            var labelRe = /class="label[^"]*"[^>]*>([^<]+)/g;
            var lm;
            while ((lm = labelRe.exec(html)) !== null) {
              var labelText = lm[1].trim();
              if (labelText && result.tags.indexOf(labelText) === -1) {
                result.tags.push(labelText);
              }
            }
            // 过期/售罄检测（匹配 SMZDM 常见状态标记）
            result.isExpired = /已过期|已失效|已结束|商品下架|price-state-expired|status-expired|链接失效/.test(html);
            result.isSoldOut = /已售罄|price-state-soldout|status-soldout/.test(html);
            resolve(result);
          },
          onerror: function() { resolve(null); },
          ontimeout: function() { resolve(null); }
        });
      });
    }

    async function checkPrevArticle(prevUrl, currentDealPrice) {
      var info = await fetchPrevArticleInfo(prevUrl);
      if (!info) return { action: 'continue', reason: '无法获取上一篇信息，默认继续' };

      // 1. 已过期/已失效/已售罄 → 直接自建
      if (info.isExpired) {
        return { action: 'continue', reason: '上一篇已过期/已失效，直接自建' };
      }
      if (info.isSoldOut) {
        return { action: 'continue', reason: '上一篇已售罄，直接自建' };
      }

      // 2. 小小值发布 → 直接自建（不管价格）
      if (info.author && info.author.indexOf('小小值') !== -1) {
        return { action: 'continue', reason: '上一篇为小小值发布，直接自建' };
      }

      // 3. 特殊标签 → 跳过
      var skipTags = ['绝对值', '手慢无', '白菜党', '抄作业'];
      for (var i = 0; i < info.tags.length; i++) {
        for (var j = 0; j < skipTags.length; j++) {
          if (info.tags[i].indexOf(skipTags[j]) !== -1) {
            return { action: 'skip', reason: '上一篇有标签"' + skipTags[j] + '"' };
          }
        }
      }

      // 4. 价格比较
      if (info.price > 0 && currentDealPrice > 0) {
        if (info.price < currentDealPrice) {
          return { action: 'skip', reason: '上一篇到手价' + info.price + '元<当前' + currentDealPrice + '元' };
        } else if (info.price === currentDealPrice) {
          // 价格相等：跳过自建，记录3日精选文章id，补贴表单用该文章链接
          return { action: 'skip', reason: '上一篇到手价' + info.price + '元=当前' + currentDealPrice + '元，用3日精选文章创建补贴', equalPrice: true };
        }
      }

      return { action: 'continue', reason: '上一篇价格更高(' + info.price + '元)且无特殊标签' };
    }

    async function runPhase1(item) {
      if (!item.productLink) {
        smzdmLog('错误：商品没有链接，无法发布');
        return 'error';
      }
      smzdmLog('Phase 1: 填入链接 ' + item.productLink.slice(0, 50) + '...');
      setProgress('Phase 1: 获取商品数据...');

      // 等待页面表单就绪（直达链接 input 出现）
      var linkInput = null;
      for (var wait = 0; wait < 20; wait++) {
        linkInput = document.querySelector('#article_direct_link') || document.querySelector('[name="article_direct_link"]');
        if (linkInput) break;
        await sleep(500);
      }
      if (!linkInput) {
        var labels = document.querySelectorAll('label, td, th, span');
        for (var i = 0; i < labels.length; i++) {
          if (labels[i].textContent.trim().indexOf('直达链接') >= 0) {
            var sib = labels[i].nextElementSibling;
            while (sib) {
              if (sib.tagName === 'INPUT' && sib.type !== 'hidden') { linkInput = sib; break; }
              var inner = sib.querySelector('input[type="text"]');
              if (inner) { linkInput = inner; break; }
              sib = sib.nextElementSibling;
            }
            break;
          }
        }
      }
      if (!linkInput) { smzdmLog('错误：找不到直达链接输入框'); return 'error'; }

      // 填入链接并验证
      linkInput.focus();
      await sleep(100);
      setInputValue(linkInput, item.productLink);
      await sleep(200);
      // 验证值是否写入成功，不成功则用备用方法
      if (linkInput.value !== item.productLink) {
        smzdmLog('备用方式填入链接...');
        linkInput.value = item.productLink;
        linkInput.dispatchEvent(new Event('input', { bubbles: true }));
        linkInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(200);
      }
      if (!linkInput.value) { smzdmLog('错误：链接填入失败'); return 'error'; }
      smzdmLog('链接已填入: ' + linkInput.value.slice(0, 50));

      // 点击获取按钮

      var btns = document.querySelectorAll('button, input[type="button"]');
      for (var i = 0; i < btns.length; i++) {
        var txt = btns[i].textContent.trim() || btns[i].value;
        if (txt === '获取' && btns[i].offsetParent !== null) { btns[i].click(); break; }
      }
      smzdmLog('已点击获取，等待响应...');

      await sleep(800);

      // 等待弹窗出现（百科弹窗或3天弹窗都可能）
      var waitedForPopup = false;
      for (var pw = 0; pw < 12; pw++) {
        // 检查百科弹窗
        var wbCheck = document.querySelector('.window-body');
        if (wbCheck && wbCheck.offsetParent !== null) { waitedForPopup = true; break; }
        // 检查3天弹窗
        if (document.body.innerText.indexOf('3天内') >= 0) { waitedForPopup = true; break; }
        // 检查标题已经填入（无弹窗直接成功）
        var titleCheck = document.querySelector('[name="article_title"]');
        if (titleCheck && titleCheck.value) { waitedForPopup = true; break; }
        await sleep(400);
      }

      // 检测3天弹窗（必须在百科弹窗处理之前）
      var threeDayFound = false;
      var allEls = document.querySelectorAll('.boxy-wrapper, .boxy-inner, [class*="boxy"], [class*="layer"], [class*="modal"], [class*="dialog"]');
      for (var i = 0; i < allEls.length; i++) {
        if (allEls[i].offsetParent !== null && allEls[i].innerText.indexOf('3天内') >= 0) { threeDayFound = true; break; }
      }
      if (!threeDayFound && document.body.innerText.indexOf('3天内') >= 0) threeDayFound = true;

      if (threeDayFound) {
        smzdmLog('检测到"3天内已发布"，查看上一篇进行判断...');
        // 提取"查看上一篇精选文章"链接
        var prevLink = '';
        var popupLinks = document.querySelectorAll('.boxy-inner a, .modal-body a');
        for (var i = 0; i < popupLinks.length; i++) {
          if (popupLinks[i].textContent.indexOf('查看上一篇') >= 0) {
            prevLink = popupLinks[i].href || '';
            break;
          }
        }

      // 折后单价用于比价：优先从文案取"折xx元/件"，其次取"到手价"÷件数
      // 优先从用户编辑后的文案提取，确保比价用最新价格
      var qty0 = parseInt(item.manualQty || item.qty || '1') || 1;
      var copy0 = item.promoCopy || '';
      var copyZheMatch0 = copy0.match(/(?:^|[，,])(?:折|低至)([\d.]+)元\/件/);
      var copyDealMatch0 = copy0.match(/(?<![金币])到手价([\d.]+)元/);
      var currentDealPrice;
      if (copyZheMatch0) {
        currentDealPrice = parseFloat(copyZheMatch0[1]);
      } else if (copyDealMatch0) {
        var dealTotal0 = parseFloat(copyDealMatch0[1]);
        currentDealPrice = qty0 > 1 ? Math.round(dealTotal0 / qty0 * 100) / 100 : dealTotal0;
      } else {
        var dealTotal0 = parseFloat(item.dealPrice || '0') || 0;
        currentDealPrice = qty0 > 1 ? Math.round(dealTotal0 / qty0 * 100) / 100 : dealTotal0;
      }
      var decision = { action: 'continue', reason: '未找到上一篇链接' };
      if (prevLink) {
        decision = await checkPrevArticle(prevLink, currentDealPrice);
        smzdmLog('上一篇判断: ' + decision.reason);
      } else {
        smzdmLog('未找到上一篇链接，默认继续');
      }

      var subsidyExistingMode = GM_getValue('tuopin_subsidy_existing', 'no');
      // 仅"价格相等(情况6)"且开关=是时，跳过自建并补贴已有文章。
      // 价格相等(情况6)且开关=否时 → 走自建。
      // 特殊标签(情况4)、上一篇价格更低(情况5) → 完全停止：不自建、不补贴。
      var skipForSubsidy = subsidyExistingMode === 'yes' && decision.equalPrice === true && prevLink;

      function clickCancel() {
        var btns = document.querySelectorAll('.boxy-btn2, input[value="取消"], button');
        for (var i = 0; i < btns.length; i++) {
          var t = (btns[i].textContent || '').trim() || btns[i].value || '';
          if (btns[i].offsetParent !== null && t === '取消') { btns[i].click(); return; }
        }
      }

      if (skipForSubsidy) {
        // 情况6(价格相等)且开关=是：点取消，跳过自建，补贴已有文章
        clickCancel();
        var prevIdMatch = prevLink.match(/\/p\/(\d+)/);
        var prevArticleId = prevIdMatch ? prevIdMatch[1] : '';
        return { status: 'skip_3day', reason: decision.reason, prevUrl: prevLink, equalPrice: true, prevArticleId: prevArticleId };
      } else if (decision.action === 'skip' && !decision.equalPrice) {
        // 情况4(特殊标签)/情况5(价格更低)：完全停止，点取消，不自建也不补贴
        clickCancel();
        return { status: 'skip_3day', reason: decision.reason, prevUrl: prevLink };
      } else {
        // 情况6(价格相等)且开关=否，或情况7(价格更高/小小值/过期售罄)：点确认继续自建
        // action=continue（过期/售罄/小小值/价格更高）或模式=否：点确认继续自建
        var confirmBtns = document.querySelectorAll('.boxy-btn1, input[value="确认"]');
        for (var i = 0; i < confirmBtns.length; i++) {
          if (confirmBtns[i].offsetParent !== null) { confirmBtns[i].click(); break; }
        }
        smzdmLog('点击确认，继续自建');
        // 等待后端重新获取商品数据 + 百科弹窗出现
        for (var rw = 0; rw < 12; rw++) {
          var wb = document.querySelector('.window-body');
          if (wb && wb.offsetParent !== null) break;
          var titleEl = document.querySelector('[name="article_title"]');
          if (titleEl && titleEl.value) break;
          await sleep(400);
        }
      }
      }

      // 百科弹窗处理（"复用历史精选内容与关联百科"）—— 必须在 dismissAllPopups 之前
      // 按钮ID是 #fetch_by_link，页面可能有多个 .window-body（隐藏+显示），需找可见的
      var baikePanelVisible = false;
      var allBaikePanels = document.querySelectorAll('.window-body');
      for (var bp = 0; bp < allBaikePanels.length; bp++) {
        if (allBaikePanels[bp].offsetParent !== null || allBaikePanels[bp].offsetWidth > 0) {
          baikePanelVisible = true; break;
        }
      }
      // 也通过弹窗标题文字检测
      if (!baikePanelVisible && document.body.innerText.indexOf('复用历史精选内容与关联百科') >= 0) {
        baikePanelVisible = true;
      }

      if (baikePanelVisible) {
        smzdmLog('检测到百科弹窗，点击"仅通过链接获取"...');
        // 等待弹窗内容完全渲染
        await new Promise(function(resolve) { setTimeout(resolve, 800); });

        var clicked = false;
        // 方式1: 通过ID查找
        var fetchByLinkBtn = document.getElementById('fetch_by_link');
        if (fetchByLinkBtn) {
          fetchByLinkBtn.click();
          clicked = true;
          smzdmLog('已点击#fetch_by_link');
        }
        // 方式2: 查找所有可点击元素（包括span/div/label等）中包含"仅通过链接获取"文字的
        if (!clicked) {
          var allEls = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], span, div, label, p');
          for (var i = 0; i < allEls.length; i++) {
            var elText = (allEls[i].textContent || allEls[i].value || '').trim();
            if (elText === '仅通过链接获取' || elText.indexOf('仅通过链接获取') >= 0) {
              allEls[i].click();
              clicked = true;
              smzdmLog('已点击文本匹配元素: ' + allEls[i].tagName + ' - ' + elText.slice(0, 20));
              break;
            }
          }
        }
        // 方式3: XPath精确查找
        if (!clicked) {
          var xpResult = document.evaluate("//a[contains(text(),'仅通过链接获取')] | //button[contains(text(),'仅通过链接获取')] | //span[contains(text(),'仅通过链接获取')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (xpResult.singleNodeValue) {
            xpResult.singleNodeValue.click();
            clicked = true;
            smzdmLog('已通过XPath点击');
          }
        }
        if (!clicked) {
          smzdmLog('未找到"仅通过链接获取"按钮！');
        }
      }

      // 等待百科弹窗完全关闭（轮询 .window-body 消失）
      smzdmLog('等待百科弹窗关闭...');
      for (var bw = 0; bw < 30; bw++) {
        await new Promise(function(resolve) { setTimeout(resolve, 500); });
        var wbStill = document.querySelector('.window-body');
        if (!wbStill || wbStill.offsetParent === null) break;
      }
      // 再等一下让后台回填完成
      await new Promise(function(resolve) { setTimeout(resolve, 1000); });
      dismissPopup();
      smzdmLog('百科弹窗已关闭，开始注入字段...');

      // 标题
      if (item.title) {
        var titleEl = document.querySelector('[name="article_title"]');
        if (titleEl) setInputValue(titleEl, item.title);
      }

      // 价格优先从文案解析（用户编辑后的文案是最终准确价格）
      {
        var copy1 = item.promoCopy || '';
        var copyDealMatch = copy1.match(/(?<![金币])到手价([\d.]+)元/);
        // 折后单价：有补贴优先取"补贴后折x元/件"，否则取"折/低至x元/件"（到手折后单价）
        var copySubsidyZheMatch = copy1.match(/补贴后折([\d.]+)元\/件/);
        var copyDealZheMatch = copy1.match(/(?:^|[，,])(?:折|低至)([\d.]+)元\/件/);
        var copyTjbTotalMatch = copy1.match(/淘金币到手价([\d.]+)元/);
        var copyTjbZheMatch = copy1.match(/淘金币到手价[\d.]+元[，,]?(?:折|低至|补贴后折)([\d.]+)元\/件/); // 淘金币后单价
        // 到手价（补贴前总价）：文案 > item.dealPrice > item.price
        var rawPriceForForm = copyDealMatch ? parseFloat(copyDealMatch[1]) : (parseFloat(item.dealPrice || item.price || '0') || 0);
        var qtyNum1 = parseInt(item.manualQty || item.qty || (item.divisor && parseInt(item.divisor) > 1 ? item.divisor : '') || '1') || 1;
        var subsidyAmtForm = parseFloat(item.subsidy || '0') || 0;
        if (rawPriceForForm > 0) {
          // 件数
          if (qtyNum1 > 1) {
            var youhuiNumEl = document.querySelector('[name="article_youhui_num"]');
            if (youhuiNumEl) setInputValue(youhuiNumEl, String(qtyNum1));
          }
          // 折后单价：有补贴用"补贴后折x元/件"，无补贴用到手"折x元/件"
          var unitPrice1;
          if (subsidyAmtForm > 0 && copySubsidyZheMatch) {
            unitPrice1 = parseFloat(copySubsidyZheMatch[1]).toFixed(2);
          } else if (copyDealZheMatch) {
            unitPrice1 = parseFloat(copyDealZheMatch[1]).toFixed(2);
          } else if (subsidyAmtForm > 0) {
            var afterSub1 = Math.max(0, Math.round((rawPriceForForm - subsidyAmtForm) * 100) / 100);
            unitPrice1 = qtyNum1 > 1 ? (Math.round(afterSub1 / qtyNum1 * 100) / 100).toFixed(2) : afterSub1.toFixed(2);
          } else {
            unitPrice1 = qtyNum1 > 1 ? (Math.round(rawPriceForForm / qtyNum1 * 100) / 100).toFixed(2) : rawPriceForForm.toFixed(2);
          }
          var priceEl = document.querySelector('[name="article_digital_price"]');
          if (priceEl) setInputValue(priceEl, unitPrice1);
          // 订单价 = 到手价（补贴前总价）：必须在 digital_price 之后填，防止 SMZDM 页面 JS 重算覆盖
          var pagePriceEl = document.querySelector('[name="article_page_price"]');
          if (pagePriceEl) setInputValue(pagePriceEl, rawPriceForForm.toFixed(2));
          // 淘金币到手价：取文案里"淘金币到手价"后的折后单价
          var finalPriceEl = document.querySelector('[name="article_final_price"]');
          if (finalPriceEl) {
            var finalUnit1;
            if (copyTjbZheMatch) {
              // 文案有"淘金币到手价xx元，折xx元/件"：直接用折后单价
              finalUnit1 = parseFloat(copyTjbZheMatch[1]).toFixed(2);
            } else if (copyTjbTotalMatch) {
              // 文案只有"淘金币到手价xx元"（总价）：除以件数
              var tjbTotal1 = parseFloat(copyTjbTotalMatch[1]);
              finalUnit1 = qtyNum1 > 1 ? (Math.round(tjbTotal1 / qtyNum1 * 100) / 100).toFixed(2) : tjbTotal1.toFixed(2);
            }
            if (finalUnit1) setInputValue(finalPriceEl, finalUnit1);
          }
        }
      }

      // (新)价格优惠描述：有补贴时填 "淘金币到手价xx元，返xx值得买积分后"
      if (item.subsidy && parseFloat(item.subsidy) > 0) {
        var subsidyPoints = Math.round(parseFloat(item.subsidy) * 10);
        var priceDescText = '';
        // 从文案里提取淘金币到手价，没有则不加淘金币部分
        var copyForDesc = item.promoCopy || '';
        var tjbTotalMatchDesc = copyForDesc.match(/淘金币到手价([\d.]+)元/);
        if (tjbTotalMatchDesc) {
          priceDescText = '淘金币到手价' + tjbTotalMatchDesc[1] + '元，';
        }
        priceDescText += '返' + subsidyPoints + '值得买积分后';
        var priceDescEl = document.querySelector('[name="article_subtitle_new"]');
        if (priceDescEl) {
          setInputValue(priceDescEl, priceDescText);
          smzdmLog('价格优惠描述: ' + priceDescText);
        }
      }

      // 优惠力度 → UEditor（完整文案，补贴句加红色）
      var copyText = item.promoCopy || item.youhuiText;
      if (copyText) {
        try {
          if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant0) {
            var subsidyMatchUE = copyText.match(/(返\d+值得买积分[，,]?补贴后低至[\d.]+元[^，,。\s]*)/);
            var uContent;
            if (subsidyMatchUE) {
              var sidx = copyText.indexOf(subsidyMatchUE[1]);
              uContent = '<p>' + copyText.slice(0, sidx) +
                '<strong style="color:red">' + subsidyMatchUE[1] + '</strong>' +
                copyText.slice(sidx + subsidyMatchUE[1].length) + '</p>';
            } else {
              uContent = '<p>' + copyText + '</p>';
            }
            UE.instants.ueditorInstant0.setContent(uContent);
            UE.instants.ueditorInstant0.sync();
          }
        } catch (e) { smzdmLog('UEditor写入失败: ' + e.message); }
      }

      // 值友原文清空
      try {
        if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant4) {
          UE.instants.ueditorInstant4.setContent('');
          UE.instants.ueditorInstant4.sync();
        }
      } catch (e) {}

      // 爆料人
      var referralSelect = document.querySelector('#referrals_select');
      if (referralSelect) {
        var accountName = GM_getValue('tuopin_selected_account', '');
        if (accountName) {
          for (var i = 0; i < referralSelect.options.length; i++) {
            if (referralSelect.options[i].text.indexOf(accountName) >= 0) {
              referralSelect.selectedIndex = i;
              referralSelect.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
      }

      // 焦点图
      var productImgUrl = '';
      var imgEls = document.querySelectorAll('*');
      for (var i = 0; i < imgEls.length; i++) {
        if (imgEls[i].childNodes.length === 1 && imgEls[i].textContent.trim() === '图片地址') {
          var imgInputs = imgEls[i].parentElement ? imgEls[i].parentElement.querySelectorAll('input[type="text"]') : [];
          for (var j = 0; j < imgInputs.length; j++) {
            if (imgInputs[j].value && imgInputs[j].value.indexOf('http') === 0) { productImgUrl = imgInputs[j].value; break; }
          }
          break;
        }
      }
      if (productImgUrl) {
        var focusInput = document.querySelector('[name="article_pic_url"]');
        if (focusInput) {
          setInputValue(focusInput, productImgUrl);
          var container = focusInput.closest('tr') || (focusInput.parentElement ? focusInput.parentElement.parentElement : null);
          if (container) {
            var fBtns = container.querySelectorAll('button, input[type="button"]');
            for (var i = 0; i < fBtns.length; i++) {
              if ((fBtns[i].textContent.trim() === '获取' || fBtns[i].value === '获取') && fBtns[i].offsetParent !== null) { fBtns[i].click(); break; }
            }
          }
        }
      }

      // 优惠券
      if (item.coupon_amount && parseFloat(item.coupon_amount) > 0) {
        var couponName = item.coupon_condition ? '满' + item.coupon_condition + '减' + item.coupon_amount : item.coupon_amount + '元券';
        var couponTitleEl = document.querySelector('input[name="coupon_title"]');
        if (couponTitleEl) setInputValue(couponTitleEl, couponName);
        await sleep(200);
        var addCouponBtn = document.querySelector('button.coupon_add');
        if (addCouponBtn && addCouponBtn.offsetParent) addCouponBtn.click();
      }

      // 标签：读面板多选标签（tuopin_selected_tags）逐个添加
      var _selTags1 = [];
      try { _selTags1 = JSON.parse(GM_getValue('tuopin_selected_tags', '[]')); } catch(e) {}
      var tagInput = document.querySelector('#tag_name');
      if (tagInput && _selTags1.length) {
        var addTagBtn = document.querySelector('#add_new_tag');
        for (var t1 = 0; t1 < _selTags1.length; t1++) {
          setInputValue(tagInput, _selTags1[t1]);
          await sleep(100);
          if (addTagBtn) { addTagBtn.click(); await sleep(300); }
        }
      }

      // 品类自建
      var checkboxes = document.querySelectorAll('input[type="checkbox"]');
      for (var i = 0; i < checkboxes.length; i++) {
        var text = (checkboxes[i].parentElement ? checkboxes[i].parentElement.textContent.trim() : '');
        var labelEl2 = document.querySelector('label[for="' + checkboxes[i].id + '"]');
        if (labelEl2) text += labelEl2.textContent.trim();
        if (text.indexOf('品类自建') >= 0 && !checkboxes[i].checked) { checkboxes[i].click(); break; }
      }

      // 精选
      var jxCb = document.getElementById('article_type_jingxuan');
      if (jxCb && !jxCb.checked) jxCb.click();
      await sleep(400);
      dismissPopup();

      // 立即同步
      var syncRadio = document.getElementById('article_sync_home_1');
      if (syncRadio && !syncRadio.checked) syncRadio.click();

      // 商配选否
      var spNo = document.getElementById('is_shangpei_0');
      if (spNo && !spNo.checked) spNo.click();

      smzdmLog('字段注入完成');
      return 'phase1_done';
    }

    async function runPhase2(item) {
      setProgress('Phase 2: 填充字段...');
      smzdmLog('Phase 2: 填充标题、价格、文案...');

      // 先清理可能残留的弹窗（百科弹窗关闭后可能弹出确认框）
      await sleep(300);
      dismissPopup();
      await sleep(200);
      dismissPopup();

      // 标题
      if (item.title) {
        var titleEl = document.querySelector('[name="article_title"]');
        if (titleEl) setInputValue(titleEl, item.title);
      }

      // 折后单价 = 纯到手价 ÷ 件数（补贴前），从 item.price(已是折后单价) 或 dealPrice/qty 反推
      var dpPrice = parseFloat((item.price || '0').replace('元', '')) || 0;
      if (dpPrice <= 0 && item.dealPrice) {
        var dpTotal = parseFloat(item.dealPrice) || 0;
        var dpQty = parseInt(item.qty) || 1;
        if (dpQty > 1) dpPrice = Math.round(dpTotal / dpQty * 100) / 100;
        else dpPrice = dpTotal;
      }
      if (dpPrice > 0) {
        var priceEl = document.querySelector('[name="article_digital_price"]');
        if (priceEl) setInputValue(priceEl, dpPrice.toFixed(2));
      }

      // (新)价格优惠描述：有补贴时填 "淘金币到手价xx元，返xx值得买积分后"（有淘金币时加前缀）
      if (item.subsidy && parseFloat(item.subsidy) > 0) {
        var subsidyPoints = Math.round(parseFloat(item.subsidy) * 10);
        var priceDescText = '';
        // 从文案里提取淘金币到手价，没有则不加淘金币部分
        var copy2 = item.promoCopy || '';
        var tjbTotalMatch2 = copy2.match(/淘金币到手价([\d.]+)元/);
        if (tjbTotalMatch2) {
          priceDescText = '淘金币到手价' + tjbTotalMatch2[1] + '元，';
        }
        priceDescText += '返' + subsidyPoints + '值得买积分后';
        var priceDescEl = document.querySelector('[name="article_subtitle_new"]');
        if (priceDescEl) setInputValue(priceDescEl, priceDescText);
      }

      // 优惠力度 → UEditor（完整文案，补贴句加红色）
      var copyText = item.promoCopy || item.youhuiText;
      if (copyText) {
        try {
          if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant0) {
            var subsidyMatchUE = copyText.match(/(返\d+值得买积分[，,]?补贴后低至[\d.]+元[^，,。\s]*)/);
            var uContent;
            if (subsidyMatchUE) {
              var sidx = copyText.indexOf(subsidyMatchUE[1]);
              uContent = '<p>' + copyText.slice(0, sidx) +
                '<strong style="color:red">' + subsidyMatchUE[1] + '</strong>' +
                copyText.slice(sidx + subsidyMatchUE[1].length) + '</p>';
            } else {
              uContent = '<p>' + copyText + '</p>';
            }
            UE.instants.ueditorInstant0.setContent(uContent);
            UE.instants.ueditorInstant0.sync();
          }
        } catch (e) { smzdmLog('UEditor写入失败: ' + e.message); }
      }

      // 值友原文清空
      try {
        if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant4) {
          UE.instants.ueditorInstant4.setContent('');
          UE.instants.ueditorInstant4.sync();
        }
      } catch (e) {}

      // 焦点图
      var productImgUrl = '';
      var allEls = document.querySelectorAll('*');
      for (var i = 0; i < allEls.length; i++) {
        if (allEls[i].childNodes.length === 1 && allEls[i].textContent.trim() === '图片地址') {
          var inputs = allEls[i].parentElement ? allEls[i].parentElement.querySelectorAll('input[type="text"]') : [];
          for (var j = 0; j < inputs.length; j++) {
            if (inputs[j].value && inputs[j].value.indexOf('http') === 0) { productImgUrl = inputs[j].value; break; }
          }
          break;
        }
      }
      if (productImgUrl) {
        var focusInput = document.querySelector('[name="article_pic_url"]');
        if (focusInput) {
          setInputValue(focusInput, productImgUrl);
          var container = focusInput.closest('tr') || (focusInput.parentElement ? focusInput.parentElement.parentElement : null);
          if (container) {
            var fBtns = container.querySelectorAll('button, input[type="button"]');
            for (var i = 0; i < fBtns.length; i++) {
              if ((fBtns[i].textContent.trim() === '获取' || fBtns[i].value === '获取') && fBtns[i].offsetParent !== null) { fBtns[i].click(); break; }
            }
          }
        }
      }

      // 优惠券
      if (item.coupon_amount && parseFloat(item.coupon_amount) > 0) {
        var couponName = item.coupon_condition ? '满' + item.coupon_condition + '减' + item.coupon_amount : item.coupon_amount + '元券';
        var couponTitleEl = document.querySelector('input[name="coupon_title"]');
        if (couponTitleEl) setInputValue(couponTitleEl, couponName);
        await sleep(200);
        var addCouponBtn = document.querySelector('button.coupon_add');
        if (addCouponBtn && addCouponBtn.offsetParent) addCouponBtn.click();
      }

      // 标签：读面板多选标签（tuopin_selected_tags）逐个添加
      var _selTags2 = [];
      try { _selTags2 = JSON.parse(GM_getValue('tuopin_selected_tags', '[]')); } catch(e) {}
      var tagInput = document.querySelector('#tag_name');
      if (tagInput && _selTags2.length) {
        var addTagBtn = document.querySelector('#add_new_tag');
        for (var t2 = 0; t2 < _selTags2.length; t2++) {
          setInputValue(tagInput, _selTags2[t2]);
          await sleep(100);
          if (addTagBtn) { addTagBtn.click(); await sleep(300); }
        }
      }

      // 品类自建
      var checkboxes = document.querySelectorAll('input[type="checkbox"]');
      for (var i = 0; i < checkboxes.length; i++) {
        var text = (checkboxes[i].parentElement ? checkboxes[i].parentElement.textContent.trim() : '');
        var labelEl = document.querySelector('label[for="' + checkboxes[i].id + '"]');
        if (labelEl) text += labelEl.textContent.trim();
        if (text.indexOf('品类自建') >= 0 && !checkboxes[i].checked) { checkboxes[i].click(); break; }
      }

      // 精选
      var jxCb = document.getElementById('article_type_jingxuan');
      if (jxCb && !jxCb.checked) jxCb.click();
      await sleep(400);
      dismissPopup();

      // 立即同步
      var syncRadio = document.getElementById('article_sync_home_1');
      if (syncRadio && !syncRadio.checked) syncRadio.click();

      // 商配选否
      var spNo = document.getElementById('is_shangpei_0');
      if (spNo && !spNo.checked) spNo.click();

      smzdmLog('Phase 2 完成');
      return 'phase2_done';
    }

    async function runPhase3() {
      setProgress('Phase 3: 发布中...');
      smzdmLog('Phase 3: 同步并发布...');

      // 同步 UEditor
      try {
        if (typeof UE !== 'undefined' && UE.instants) {
          for (var k in UE.instants) { try { UE.instants[k].sync(); } catch (e) {} }
        }
      } catch (e) {}

      var published = false;
      for (var attempt = 0; attempt < 3 && !published; attempt++) {
        var publishBtns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (var i = 0; i < publishBtns.length; i++) {
          var t = publishBtns[i].textContent.trim() || publishBtns[i].value;
          if (t === '直接发布' && publishBtns[i].offsetParent !== null) { publishBtns[i].click(); break; }
        }
        var popups = await dismissAllPopups(4, 500);
        if (popups.length) smzdmLog('发布弹窗(第' + (attempt + 1) + '轮): ' + popups.join(', '));

        for (var p = 0; p < 10; p++) {
          if (document.body.innerText.indexOf('发布成功') >= 0) { published = true; break; }
          await sleep(400);
        }
      }

      if (!published && document.body.innerText.indexOf('发布成功') >= 0) published = true;

      if (published) {
        // 从URL中提取文章ID
        var articleId = '';
        var urlIdMatch = location.href.match(/edit_youhui\/(\d+)/);
        if (urlIdMatch) articleId = urlIdMatch[1];
        if (!articleId) {
          var urlIdMatch2 = location.href.match(/[?&]id=(\d+)/);
          if (urlIdMatch2) articleId = urlIdMatch2[1];
        }
        if (!articleId) {
          var hiddenId = document.querySelector('input[name="article_id"], #article_id');
          if (hiddenId && hiddenId.value) articleId = hiddenId.value;
        }
        smzdmLog('发布成功! 文章ID: ' + (articleId || '未获取'));
        return { status: 'success', articleId: articleId };
      } else {
        smzdmLog('未检测到发布成功标志');
        return { status: 'uncertain', articleId: '' };
      }
    }

    // 商品唯一标识：优先 gid，其次从链接里提取商品 id，最后用链接本身
    function getItemKey(item) {
      if (item.gid && String(item.gid).length >= 6) return 'g' + item.gid;
      var link = item.productLink || item.orderLink || '';
      var m = link.match(/[?&]id=(\d+)/) || link.match(/\/item[\/.](\d+)/);
      if (m) return 'i' + m[1];
      return link ? 'l' + link.slice(0, 120) : '';
    }

    // 已自建过的商品历史（保留2天，2天内重复直接跳过自建）
    var PUBLISHED_TTL = 2 * 24 * 60 * 60 * 1000; // 2天
    function loadPublishedHistory() {
      var hist = [];
      try { hist = JSON.parse(GM_getValue('tuopin_published_history', '[]')); } catch (e) { hist = []; }
      // 清理超过2天的记录
      var now = Date.now();
      var kept = hist.filter(function(h) { return h.time && (now - h.time) < PUBLISHED_TTL; });
      if (kept.length !== hist.length) GM_setValue('tuopin_published_history', JSON.stringify(kept));
      return kept;
    }
    function findPublishedHistory(key) {
      if (!key) return null;
      var now = Date.now();
      var hist = loadPublishedHistory();
      for (var i = 0; i < hist.length; i++) {
        // 仅认 2 天内的记录
        if (hist[i].key === key && hist[i].time && (now - hist[i].time) < PUBLISHED_TTL) return hist[i];
      }
      return null;
    }
    function addPublishedHistory(key, articleId, title) {
      if (!key) return;
      var hist = loadPublishedHistory();
      // 去重：已存在则更新 articleId 和时间
      for (var i = 0; i < hist.length; i++) {
        if (hist[i].key === key) {
          hist[i].articleId = articleId; hist[i].title = title; hist[i].time = Date.now();
          return GM_setValue('tuopin_published_history', JSON.stringify(hist));
        }
      }
      hist.push({ key: key, articleId: articleId, title: title, time: Date.now() });
      GM_setValue('tuopin_published_history', JSON.stringify(hist));
    }

    async function processQueue() {
      createStatusPanel();
      var currentIdx = GM_getValue('tuopin_publish_index', 0);
      var total = queue.length;
      var results = [];
      try { results = JSON.parse(GM_getValue('tuopin_publish_results', '[]')); } catch (e) { results = []; }

      var item = queue[currentIdx];
      setProgress('正在处理 ' + (currentIdx + 1) + '/' + total + ': ' + (item.title || '').slice(0, 20));
      smzdmLog('========== 第 ' + (currentIdx + 1) + '/' + total + ' 个 ==========');
      smzdmLog('商品: ' + (item.title || '未知'));

      // 已自建过的商品 → 跳过，不重复发布（用历史里的文章id写入结果，汇总仍可建表单）
      var itemKey = getItemKey(item);
      var histHit = findPublishedHistory(itemKey);
      if (histHit) {
        smzdmLog('该商品已自建过（文章' + (histHit.articleId || '?') + '），跳过');
        results.push({
          title: item.title || histHit.title || '', status: 'skip_published',
          reason: '已自建过', articleId: histHit.articleId || '',
          subsidy: item.subsidy || '', dealPrice: item.dealPrice || '', price: item.price || '',
          productLink: item.productLink || '', commissionRate: item.commissionRate || item.commission_rate || '',
          goodsSign: item.goodsSign || '', mall: item.mall || '', bDuan: item.bDuan || '',
          gid: item.gid || '', promoCopy: item.promoCopy || ''
        });
        GM_setValue('tuopin_publish_results', JSON.stringify(results));
        currentIdx++;
        GM_setValue('tuopin_publish_index', currentIdx);
        if (currentIdx < total) {
          await sleep(500);
          window.onbeforeunload = null;
          tuopinGo('http://youhui.bgm.smzdm.com/add_guonei');
          return;
        }
        // 是最后一个 → 落到末尾汇总逻辑
        showResultsSummary(results, total);
        GM_setValue('tuopin_publish_queue', '[]');
        GM_setValue('tuopin_publish_index', 0);
        GM_setValue('tuopin_subsidy_done', '[]');
        return;
      }

      await sleep(500);
      var p1 = await runPhase1(item);

      if (p1 === 'skip_3day' || (p1 && p1.status === 'skip_3day')) {
        var skipReason = (p1 && p1.reason) ? p1.reason : '3天内已发布过';
        var prevUrl = (p1 && p1.prevUrl) ? p1.prevUrl : '';
        smzdmLog('跳过: ' + skipReason);
        // 价格相等时，用3日精选文章id创建补贴表单（用该文章链接）
        var equalPrice = (p1 && p1.equalPrice) ? true : false;
        var prevArticleId = (p1 && p1.prevArticleId) ? p1.prevArticleId : '';
        results.push({ title: item.title || '', status: 'skip_3day', reason: skipReason, prevUrl: prevUrl, equalPrice: equalPrice, prevArticleId: prevArticleId });
        GM_setValue('tuopin_publish_results', JSON.stringify(results));
        // 价格相等且有补贴：先加入编辑队列（去修改3日精选文章），再加入补贴队列
        if (equalPrice && prevArticleId && item.subsidy && parseFloat(item.subsidy) > 0) {
          // 编辑队列：跳到3日精选文章编辑页，更新到手价/优惠力度/价格优惠/标签
          var editQueue = [];
          try { editQueue = JSON.parse(GM_getValue('tuopin_edit_queue', '[]')); } catch (e) { editQueue = []; }
          editQueue.push({
            articleId: prevArticleId,
            title: item.title || '',
            price: item.price || '',
            dealPrice: item.dealPrice || item.price || '',
            subsidy: item.subsidy,
            promoCopy: item.promoCopy || '',
            manualTjb: item.manualTjb || '',
            taoJinBi: item.taoJinBi || ''
          });
          GM_setValue('tuopin_edit_queue', JSON.stringify(editQueue));
          // 补贴队列
          var subsidyQueue = [];
          try { subsidyQueue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) { subsidyQueue = []; }
          if (!subsidyQueue.some(function(s) { return String(s.articleId) === String(prevArticleId); })) {
          subsidyQueue.push({
            articleId: prevArticleId,
            title: item.title || '',
            productLink: item.productLink || '',
            price: item.price || '',
            dealPrice: item.dealPrice || item.price || '',
            subsidy: item.subsidy,
            commissionRate: item.commissionRate || item.commission_rate || '',
            goodsSign: item.goodsSign || '',
            mall: item.mall || '',
            bDuan: item.bDuan || '',
            gid: item.gid || '',
            promoCopy: item.promoCopy || '',
            fromPrevArticle: true
          });
          GM_setValue('tuopin_subsidy_queue', JSON.stringify(subsidyQueue));
          } // end dedup check
          smzdmLog('价格相等，已加入编辑队列+补贴队列（3日精选文章' + prevArticleId + '）');
        }
        currentIdx++;
        GM_setValue('tuopin_publish_index', currentIdx);
        if (currentIdx < total) {
          await sleep(500);
          window.onbeforeunload = null;
          tuopinGo('http://youhui.bgm.smzdm.com/add_guonei');
          return;
        }
      } else if (p1 === 'error') {
        smzdmLog('Phase 1 失败，跳过');
        results.push({ title: item.title || '', status: 'error', reason: 'Phase 1 获取商品数据失败' });
        GM_setValue('tuopin_publish_results', JSON.stringify(results));
        currentIdx++;
        GM_setValue('tuopin_publish_index', currentIdx);
        if (currentIdx < total) {
          await sleep(500);
          window.onbeforeunload = null;
          tuopinGo('http://youhui.bgm.smzdm.com/add_guonei');
          return;
        }
      } else {
        // Phase 1 已完成字段注入，直接发布
        await sleep(300);
        var p3 = await runPhase3();

        if (p3.status === 'success') {
          results.push({ title: item.title || '', status: 'success', reason: '', articleId: p3.articleId || '',
            subsidy: item.subsidy || '', dealPrice: item.dealPrice || '', price: item.price || '',
            productLink: item.productLink || '', commissionRate: item.commissionRate || '',
            goodsSign: item.goodsSign || '', mall: item.mall || '', bDuan: item.bDuan || '',
            gid: item.gid || '', promoCopy: item.promoCopy || '' });
          // 记入已自建历史，下次遇到同款直接跳过
          addPublishedHistory(itemKey, p3.articleId || '', item.title || '');
          // 如果有补贴，加入补贴队列
          smzdmLog('补贴检查: subsidy=' + (item.subsidy || '空') + ' articleId=' + p3.articleId);
          if (item.subsidy && parseFloat(item.subsidy) > 0 && p3.articleId) {
            var subsidyQueue = [];
            try { subsidyQueue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) { subsidyQueue = []; }
            if (!subsidyQueue.some(function(s) { return String(s.articleId) === String(p3.articleId); })) {
            subsidyQueue.push({
              articleId: p3.articleId,
              title: item.title || '',
              productLink: item.productLink || '',
              price: item.price || '',
              dealPrice: item.dealPrice || item.price || '',
              subsidy: item.subsidy,
              commissionRate: item.commissionRate || item.commission_rate || '',
              goodsSign: item.goodsSign || '',
              mall: item.mall || '',
              bDuan: item.bDuan || '',
              gid: item.gid || '',
              promoCopy: item.promoCopy || ''
            });
            GM_setValue('tuopin_subsidy_queue', JSON.stringify(subsidyQueue));
            } // end dedup check
            smzdmLog('已加入补贴队列: 文章' + p3.articleId);
          }
        } else {
          results.push({ title: item.title || '', status: p3.status, reason: '发布未确认成功' });
        }
        GM_setValue('tuopin_publish_results', JSON.stringify(results));
        smzdmLog('结果: ' + p3.status);
        currentIdx++;
        GM_setValue('tuopin_publish_index', currentIdx);

        if (currentIdx < total) {
          smzdmLog('处理下一个...');
          await sleep(1500);
          window.onbeforeunload = null;
          tuopinGo('http://youhui.bgm.smzdm.com/add_guonei');
          return;
        }
      }

      // 全部处理完 → 显示汇总
      showResultsSummary(results, total);
      GM_setValue('tuopin_publish_queue', '[]');
      GM_setValue('tuopin_publish_index', 0);
      // 注意：不清空 tuopin_publish_results —— 汇总面板要在补贴表单页持续展示，
      // 直到补贴表单全部创建完成后再统一清理。
      GM_setValue('tuopin_subsidy_done', '[]');
      // 如果有编辑队列（3日同价文章），只保留 articleId 最大（最近）的一篇
      var pendingEdit = [];
      try { pendingEdit = JSON.parse(GM_getValue('tuopin_edit_queue', '[]')); } catch (e) {}
      if (pendingEdit.length > 1) {
        pendingEdit.sort(function(a, b) { return parseInt(b.articleId) - parseInt(a.articleId); });
        pendingEdit = [pendingEdit[0]];
        GM_setValue('tuopin_edit_queue', JSON.stringify(pendingEdit));
      }
      // 补贴队列同样只保留最近一篇（fromPrevArticle 的）
      var pendingSubsidy = [];
      try { pendingSubsidy = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
      var prevSubsidies = pendingSubsidy.filter(function(s) { return s.fromPrevArticle; });
      var normalSubsidies = pendingSubsidy.filter(function(s) { return !s.fromPrevArticle; });
      if (prevSubsidies.length > 1) {
        prevSubsidies.sort(function(a, b) { return parseInt(b.articleId) - parseInt(a.articleId); });
        prevSubsidies = [prevSubsidies[0]];
      }
      pendingSubsidy = normalSubsidies.concat(prevSubsidies);
      GM_setValue('tuopin_subsidy_queue', JSON.stringify(pendingSubsidy));

      if (pendingEdit.length > 0) {
        GM_setValue('tuopin_edit_index', 0);
        smzdmLog('有编辑任务，3秒后跳转到最近文章 ' + pendingEdit[0].articleId + '...');
        await sleep(3000);
        window.onbeforeunload = null;
        tuopinGo('http://youhui.bgm.smzdm.com/edit_youhui/' + pendingEdit[0].articleId);
        return;
      }
      // 如果有补贴队列，跳转到补贴表单页面
      if (pendingSubsidy.length > 0) {
        smzdmLog('有 ' + pendingSubsidy.length + ' 个补贴待创建，3秒后跳转...');
        await sleep(3000);
        window.onbeforeunload = null;
        tuopinGo('http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3');
      }
    }

    function showResultsSummary(results, total) {
      var successCount = 0;
      var failList = [];
      results.forEach(function (r) {
        if (r.status === 'success') successCount++;
        else failList.push(r);
      });

      setProgress('完成! 成功 ' + successCount + '/' + total);
      smzdmLog('========== 发布汇总 ==========');
      smzdmLog('成功: ' + successCount + ' 个');
      if (failList.length > 0) {
        smzdmLog('未成功: ' + failList.length + ' 个');
        failList.forEach(function (r) {
          smzdmLog('  - ' + r.title.slice(0, 25) + ' [' + r.status + '] ' + r.reason);
        });
      }

      // 刷新右上角固定汇总面板（替代旧的遮罩弹窗）
      buildSummaryPanel();
      if (window.__tuopinRenderSummary) window.__tuopinRenderSummary();
    }

    window.addEventListener('load', function () {
      setTimeout(function () { processQueue(); }, 2000);
    });

    return;
  }
  // ===== END SMZDM add_guonei 逻辑 =====

  // ===== 模式2：直接打开文章编辑页 → 去补贴面板 =====
  function setupDirectSubsidyPanel() {
    if (document.getElementById('tuopin-direct-panel')) return;
    // 从 URL 提取文章ID
    var idMatch = location.pathname.match(/edit_youhui\/(\d+)/);
    var articleId = idMatch ? idMatch[1] : '';
    var dsBaseCopy = ''; // 原始优惠力度（去补贴话术），用于重新生成新文案
    var dsBaseUnit = ''; // 原始折后单价，用于补贴后回退
    var dsBaseDeal = ''; // 原始订单价（补贴前），佣金计算用，不随补贴变化
    var dsProductId = ''; // 从直达链接提取的商品ID
    var dsDirectLink = ''; // 文章直达链接
    var dsCommissionRate = ''; // 查询到的佣金比例

    function dsLog(msg) {
      console.log('[拓品去补贴] ' + msg);
      var box = document.getElementById('tuopin-direct-log');
      if (box) { box.innerHTML += '<div>' + msg + '</div>'; box.scrollTop = box.scrollHeight; }
    }
    function dsSet(el, val) {
      var s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (s && s.set) s.set.call(el, val); else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function dsSleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

    function buildPanel() {
      var collapsed = GM_getValue('tuopin_direct_collapsed', '') === '1';
      var arrow = collapsed ? '▶' : '▼';
      var panel = document.createElement('div');
      panel.id = 'tuopin-direct-panel';
      panel.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:12px;width:240px;font-family:-apple-system,sans-serif;font-size:13px;';
      var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (collapsed ? '0' : '6px') + ';">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
        '<button id="ds-toggle" style="border:none;background:none;cursor:pointer;color:#666;font-size:11px;line-height:1;padding:0;">' + arrow + '</button>' +
        '<span style="font-weight:600;font-size:13px;color:#ff7a00;">去补贴</span></div>' +
        '<span style="font-size:10px;color:#bbb;">折叠需手动展开</span></div>';
      var bodyDisplay = collapsed ? 'none' : 'block';
      h += '<div id="ds-body" style="display:' + bodyDisplay + ';">';
      h += '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">品牌</label>' +
        '<input id="ds-brand" type="text" placeholder="可选，填后自动拼入表单名称" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">商品名</label>' +
        '<input id="ds-title" type="text" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;margin-bottom:4px;">' +
        '<div style="display:flex;align-items:center;gap:4px;min-width:0;"><label style="color:#666;font-size:11px;white-space:nowrap;">到手价</label><input id="ds-deal" type="text" style="flex:1;min-width:0;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '<div style="display:flex;align-items:center;gap:4px;min-width:0;"><label style="color:#666;font-size:11px;white-space:nowrap;">折单价</label><input id="ds-unit" type="text" style="flex:1;min-width:0;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '<div style="display:flex;align-items:center;gap:4px;min-width:0;"><label style="color:#666;font-size:11px;white-space:nowrap;">补贴</label><input id="ds-subsidy" type="text" placeholder="0" style="flex:1;min-width:0;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '<div style="display:flex;align-items:center;gap:4px;min-width:0;"><label style="color:#666;font-size:11px;white-space:nowrap;">件数</label><input id="ds-qty" type="text" value="1" style="flex:1;min-width:0;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '</div>' +
        '<div style="margin-bottom:4px;font-size:11px;line-height:1.6;">' +
        '<span>佣比：<span id="ds-commission-rate" style="color:#52c41a;font-weight:600;">-</span></span>' +
        '<span style="margin-left:12px;">订单佣金：<span id="ds-commission-calc" style="color:#52c41a;font-weight:600;">-</span></span>' +
        '</div>' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">原文案</label>' +
        '<textarea id="ds-copy-orig" rows="2" readonly style="width:100%;padding:5px 6px;border:1px solid #eee;border-radius:4px;font-size:11px;line-height:1.4;resize:vertical;box-sizing:border-box;background:#f9f9f9;color:#999;"></textarea></div>' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">新文案</label>' +
        '<textarea id="ds-copy" rows="2" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;line-height:1.5;resize:vertical;box-sizing:border-box;"></textarea></div>' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">标签（可多选）</label>' +
        '<div id="ds-tag-trigger" style="border:1px solid #ddd;border-radius:4px;padding:4px 6px;cursor:pointer;font-size:12px;min-height:22px;display:flex;justify-content:space-between;align-items:center;background:#fff;">' +
          '<span id="ds-tag-summary" style="color:#bbb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">请选择标签</span>' +
          '<span style="color:#999;font-size:10px;">▾</span>' +
        '</div>' +
        '<div id="ds-tag-dropdown" style="display:none;border:1px solid #ddd;border-radius:4px;padding:4px;margin-top:2px;max-height:120px;overflow-y:auto;font-size:11px;line-height:1.6;background:#fff;"></div>' +
        '<div style="display:flex;gap:4px;margin-top:4px;">' +
          '<input id="ds-tag-input" type="text" placeholder="添加标签，如今日必买" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="ds-tag-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div></div>' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">表单邮箱</label>' +
        '<select id="ds-email-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;box-sizing:border-box;"><option value="">请选择邮箱</option></select>' +
        '<div style="display:flex;gap:4px;">' +
          '<input id="ds-email-input" type="text" placeholder="添加邮箱" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="ds-email-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div></div>' +
        '<div style="margin-bottom:6px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:2px;">渠道Code</label>' +
        '<input id="ds-code" type="text" placeholder="请填写code" style="width:100%;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>' +
        '<button id="ds-save-only" style="width:100%;padding:7px;background:#fff;color:#666;border:1px solid #bbb;border-radius:4px;font-size:13px;cursor:pointer;margin-bottom:4px;">保存（不建表单）</button>' +
        '<button id="ds-go" style="width:100%;padding:8px;background:#ff7a00;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">去补贴</button>' +
        '<div id="tuopin-direct-log" style="margin-top:4px;max-height:120px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:5px 6px;font-size:11px;line-height:1.5;color:#666;display:none;"></div>';
      h += '</div>';
      panel.innerHTML = h;
      getRightStack().appendChild(panel);
      var toggleBtn = document.getElementById('ds-toggle');
      if (toggleBtn) toggleBtn.onclick = function() {
        var now = GM_getValue('tuopin_direct_collapsed', '') === '1';
        GM_setValue('tuopin_direct_collapsed', now ? '' : '1');
        var body = document.getElementById('ds-body');
        if (body) body.style.display = now ? 'block' : 'none';
        toggleBtn.textContent = now ? '▼' : '▶';
      };
    }

    // 标签管理（多选，与主面板共用 tuopin_tag_list / tuopin_selected_tags）
    function dsLoadTags() { try { return JSON.parse(GM_getValue('tuopin_tag_list', '[]')); } catch(e) { return []; } }
    function dsSaveTags(list) { GM_setValue('tuopin_tag_list', JSON.stringify(list)); }
    function dsLoadSelectedTags() { try { return JSON.parse(GM_getValue('tuopin_selected_tags', '[]')); } catch(e) { return []; } }
    function dsSaveSelectedTags(list) { GM_setValue('tuopin_selected_tags', JSON.stringify(list)); }
    function dsRefreshTagSelect() {
      var box = document.getElementById('ds-tag-dropdown');
      var summary = document.getElementById('ds-tag-summary');
      if (!box) return;
      var tags = dsLoadTags();
      var selected = dsLoadSelectedTags();
      box.innerHTML = '';
      if (!tags.length) { box.innerHTML = '<span style="color:#bbb;">暂无标签，请在下方添加</span>'; }
      else {
        tags.forEach(function(tg) {
          var lbl = document.createElement('label');
          lbl.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;padding:2px 0;';
          var cb = document.createElement('input');
          cb.type = 'checkbox'; cb.value = tg;
          cb.checked = selected.indexOf(tg) >= 0;
          cb.onchange = function() {
            var cur = dsLoadSelectedTags();
            if (this.checked) { if (cur.indexOf(tg) < 0) cur.push(tg); }
            else { cur = cur.filter(function(x) { return x !== tg; }); }
            dsSaveSelectedTags(cur);
            dsUpdateTagSummary();
          };
          lbl.appendChild(cb);
          var span = document.createElement('span'); span.textContent = tg;
          span.style.cssText = 'flex:1;';
          lbl.appendChild(span);
          var del = document.createElement('span');
          del.textContent = '×';
          del.style.cssText = 'cursor:pointer;color:#ff4d4f;font-size:13px;line-height:1;padding:0 4px;';
          del.title = '删除标签';
          del.onclick = function(e) {
            e.preventDefault(); e.stopPropagation();
            if (!confirm('删除标签「' + tg + '」？')) return;
            var list = dsLoadTags().filter(function(x) { return x !== tg; });
            dsSaveTags(list);
            var sel = dsLoadSelectedTags().filter(function(x) { return x !== tg; });
            dsSaveSelectedTags(sel);
            dsRefreshTagSelect();
          };
          lbl.appendChild(del);
          box.appendChild(lbl);
        });
      }
      dsUpdateTagSummary();
    }
    function dsUpdateTagSummary() {
      var summary = document.getElementById('ds-tag-summary');
      if (!summary) return;
      var selected = dsLoadSelectedTags();
      summary.textContent = selected.length ? selected.join('、') : '请选择标签';
      summary.style.color = selected.length ? '#333' : '#bbb';
    }
    function dsWireTag() {
      // 触发框点击展开/收起
      var trigger = document.getElementById('ds-tag-trigger');
      var dropdown = document.getElementById('ds-tag-dropdown');
      if (trigger && dropdown) {
        trigger.onclick = function(e) {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        // 点外面收起
        document.addEventListener('click', function(e) {
          if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        });
      }
      var addBtn = document.getElementById('ds-tag-add');
      if (addBtn) addBtn.onclick = function() {
        var input = document.getElementById('ds-tag-input');
        var tag = (input.value || '').trim();
        if (!tag) { alert('请输入标签'); return; }
        var list = dsLoadTags();
        if (list.indexOf(tag) < 0) { list.push(tag); dsSaveTags(list); }
        // 新加的默认选中
        var sel = dsLoadSelectedTags();
        if (sel.indexOf(tag) < 0) { sel.push(tag); dsSaveSelectedTags(sel); }
        dsRefreshTagSelect();
        input.value = '';
      };
    }

    // 邮箱管理（与主面板共用 tuopin_email_list / tuopin_selected_email）
    function dsLoadEmails() { try { return JSON.parse(GM_getValue('tuopin_email_list', '[]')); } catch(e) { return []; } }
    function dsSaveEmails(list) { GM_setValue('tuopin_email_list', JSON.stringify(list)); }
    function dsRefreshEmailSelect() {
      var sel = document.getElementById('ds-email-select');
      if (!sel) return;
      var emails = dsLoadEmails();
      var current = GM_getValue('tuopin_selected_email', '');
      sel.innerHTML = '<option value="">请选择邮箱</option>';
      emails.forEach(function(em) {
        var opt = document.createElement('option');
        opt.value = em; opt.textContent = em;
        if (em === current) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    function dsWireEmail() {
      var sel = document.getElementById('ds-email-select');
      if (sel) sel.onchange = function() { GM_setValue('tuopin_selected_email', this.value); };
      var addBtn = document.getElementById('ds-email-add');
      if (addBtn) addBtn.onclick = function() {
        var input = document.getElementById('ds-email-input');
        var email = (input.value || '').trim();
        if (!email || email.indexOf('@') < 0) { alert('请输入有效邮箱'); return; }
        var list = dsLoadEmails();
        if (list.indexOf(email) < 0) { list.push(email); dsSaveEmails(list); }
        GM_setValue('tuopin_selected_email', email);
        dsRefreshEmailSelect();
        input.value = '';
      };
    }

    // 计算 佣金 = 补贴前订单价 × 佣比（不随补贴变化）
    function updateCalcCommission() {
      var box = document.getElementById('ds-commission-calc');
      if (!box) return;
      var deal = parseFloat(dsBaseDeal || '0') || 0;
      if (deal > 0 && dsCommissionRate) {
        var ratio = parseFloat(dsCommissionRate) / 100;
        var calc = Math.round(deal * ratio * 100) / 100;
        box.textContent = calc.toFixed(2) + '元';
        box.style.color = '#52c41a';
      } else {
        box.textContent = '-';
        box.style.color = '#999';
      }
    }

    // 通过 Kong 网关中转查询 DCC 佣金。
    // 走公网域名 commission-bgm.agentdevops.zdm.net（HTTPS），公司网络下均可访问。
    // relay 侧做公司网段校验，仅公司内网可查。
    function queryCommission(productUrl, commBox) {
      if (!productUrl) return;
      var rateBox = document.getElementById('ds-commission-rate');
      if (rateBox) { rateBox.textContent = '查询中...'; rateBox.style.color = '#999'; }
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url: 'https://commission-bgm.agentdevops.zdm.net/commission/?url=' + encodeURIComponent(productUrl),
          timeout: 15000,
          onload: function(resp) {
            try {
              var data = JSON.parse(resp.responseText || '{}');
              if (!data.ok) {
                if (rateBox) { rateBox.textContent = '-'; rateBox.style.color = '#999'; }
                updateCalcCommission(); return;
              }
              var ratioNum = parseFloat(data.ratioPC);
              var ratioPct = isNaN(ratioNum) ? '' : (ratioNum * 100).toFixed(2);
              dsCommissionRate = ratioPct || '';
              if (rateBox) { rateBox.textContent = ratioPct ? (ratioPct + '%') : '-'; rateBox.style.color = ratioPct ? '#52c41a' : '#999'; }
              updateCalcCommission();
            } catch (e) {
              if (rateBox) { rateBox.textContent = '解析失败'; rateBox.style.color = '#ff4d4f'; }
            }
          },
          onerror: function() { if (rateBox) { rateBox.textContent = '查询失败'; rateBox.style.color = '#ff4d4f'; } },
          ontimeout: function() { if (rateBox) { rateBox.textContent = '查询超时'; rateBox.style.color = '#ff4d4f'; } }
        });
      } catch (e) { if (rateBox) { rateBox.textContent = '查询异常'; rateBox.style.color = '#ff4d4f'; } }
    }

    async function readExisting() {
      var t = document.getElementById('ds-title');
      var d = document.getElementById('ds-deal');
      var u = document.getElementById('ds-unit');
      var q = document.getElementById('ds-qty');
      // 等待价格字段加载并填充值（最多 10s）
      var titleEl, dealEl, unitEl, qtyEl;
      for (var w = 0; w < 20; w++) {
        titleEl = document.querySelector('[name="article_title"]');
        dealEl = document.querySelector('[name="article_final_price"]'); // 订单价
        unitEl = document.querySelector('[name="article_digital_price"]'); // 折后单价
        qtyEl = document.querySelector('[name="article_youhui_num"]');
        if (dealEl && dealEl.value && unitEl && unitEl.value) break;
        await dsSleep(500);
      }
      if (t && titleEl) t.value = titleEl.value || '';
      var brandInput = document.getElementById('ds-brand');
      if (brandInput) {
        var brandEl = document.querySelector('#article_brand, [name="article_brand"]');
        if (brandEl) {
          var rawBrand = (brandEl.value || '').trim();
          var slashIdx = rawBrand.indexOf('/');
          brandInput.value = slashIdx >= 0 ? rawBrand.slice(slashIdx + 1).trim() : rawBrand;
        }
      }
      // 到手价 = 订单价(article_final_price)；折单价 = 折后单价(article_digital_price)
      if (d && dealEl) { d.value = dealEl.value || ''; dsBaseDeal = d.value; }
      if (u && unitEl) { u.value = unitEl.value || ''; dsBaseUnit = u.value; }
      if (q && qtyEl) q.value = (qtyEl.value || '1');
      else if (q) q.value = '1';

      // 从直达链接提取商品ID（仅记录用），并查询佣金（等直达链接加载完）
      var linkEl = null;
      var commBox = document.getElementById('ds-commission');
      for (var wl = 0; wl < 20; wl++) {
        linkEl = document.querySelector('#article_direct_link, [name="article_direct_link"]');
        if (linkEl && linkEl.value) break;
        await dsSleep(500);
      }
      if (linkEl && linkEl.value) {
        dsDirectLink = linkEl.value;
        var lv = linkEl.value;
        var pm = lv.match(/item\.jd\.com\/(\d+)/) || lv.match(/[?&]id=(\d+)/) || lv.match(/\/(\d{6,})\.html/) || lv.match(/\/(\d{6,})(?:[\/?]|$)/);
        dsProductId = pm ? pm[1] : '';
        queryCommission(dsDirectLink, commBox);
      } else {
        if (commBox) commBox.textContent = '无直达链接';
      }

      // 等 UEditor 加载完成（最多 10s）
      var c0 = '', c4 = '';
      for (var w = 0; w < 20; w++) {
        try {
          if (typeof UE !== 'undefined' && UE.instants) {
            c0 = (UE.instants.ueditorInstant0 && UE.instants.ueditorInstant0.getContentTxt()) || '';
            c4 = (UE.instants.ueditorInstant4 && UE.instants.ueditorInstant4.getContentTxt()) || '';
            if (c0 || c4) break;
          }
        } catch (e) {}
        await dsSleep(500);
      }
      // 原文案（只读）：优惠力度 + 值友原文
      var origBox = document.getElementById('ds-copy-orig');
      if (origBox) {
        var orig = '';
        if (c0 && c4) orig = c0.trim() + '\n' + c4.trim();
        else orig = (c0 || c4 || '').trim();
        origBox.value = orig;
      }
      // 新文案（可编辑）：默认填优惠力度部分，供编辑
      var c = document.getElementById('ds-copy');
      if (c) c.value = c0.trim();
      dsBaseCopy = c0.trim().replace(/[，,]?返\d+值得买积分.*$/, '').replace(/[，,\s]+$/, '').trim(); // 去掉已有补贴话术和尾部逗号，作为基准
      dsLog('已读取文章现有内容' + (articleId ? '（文章' + articleId + '）' : '') + ((c0 || c4) ? '' : '（文案为空）'));
    }

    // 根据到手价/件数/补贴 重新生成新文案（基准 + 补贴话术），并联动折后单价
    function regenCopy() {
      var deal = parseFloat(document.getElementById('ds-deal').value || '0') || 0;
      var qty = parseInt(document.getElementById('ds-qty').value || '1') || 1;
      var subsidy = parseFloat(document.getElementById('ds-subsidy').value || '0') || 0;
      var c = document.getElementById('ds-copy');
      var u = document.getElementById('ds-unit');
      var base = dsBaseCopy;
      if (subsidy > 0 && deal > 0) {
        var points = Math.round(subsidy * 10);
        var afterSub = Math.max(0, Math.round((deal - subsidy) * 100) / 100);
        var subSentence;
        if (qty > 1) {
          var afterSubUnit = Math.round(afterSub / qty * 100) / 100;
          subSentence = '返' + points + '值得买积分，补贴后低至' + afterSub.toFixed(2) + '元，补贴后折' + afterSubUnit.toFixed(2) + '元/件';
        } else {
          afterSubUnit = afterSub;
          subSentence = '返' + points + '值得买积分，补贴后低至' + afterSub.toFixed(2) + '元';
        }
        if (c) c.value = base ? (base + '，' + subSentence) : subSentence;
        // 折后单价联动为补贴后折单价
        if (u) u.value = afterSubUnit.toFixed(2);
      } else {
        if (c) c.value = base;
        // 回退为原始折后单价
        if (u) u.value = dsBaseUnit;
      }
      // 联动计算佣金
      updateCalcCommission();
    }

    async function injectAndSave(saveOnly) {
      // 去补贴按钮：补贴金额必填；保存按钮：可不填
      var subsidyEl = document.getElementById('ds-subsidy');
      var subsidyVal = subsidyEl ? (subsidyEl.value || '').trim() : '';
      var subsidyNum = parseFloat(subsidyVal || '0') || 0;
      if (!saveOnly && subsidyNum <= 0) {
        if (subsidyEl) {
          subsidyEl.style.borderColor = '#ff4d4f';
          subsidyEl.focus();
          var _restore = function() { subsidyEl.style.borderColor = ''; subsidyEl.removeEventListener('input', _restore); };
          subsidyEl.addEventListener('input', _restore);
        }
        dsLog('请填写补贴金额（去补贴必填）');
        return;
      }
      var goBtn = document.getElementById(saveOnly ? 'ds-save-only' : 'ds-go');
      if (goBtn) { goBtn.disabled = true; goBtn.textContent = '处理中...'; }
      var logBox = document.getElementById('tuopin-direct-log');
      if (logBox) logBox.style.display = 'block';
      dsLog('开始注入...');

      var title = (document.getElementById('ds-title').value || '').trim();
      var brand = (document.getElementById('ds-brand') ? document.getElementById('ds-brand').value || '' : '').trim();
      var deal = (document.getElementById('ds-deal').value || '').trim();
      var unit = (document.getElementById('ds-unit').value || '').trim();
      var subsidy = parseFloat(document.getElementById('ds-subsidy').value || '0') || 0;
      var qty = parseInt(document.getElementById('ds-qty').value || '1') || 1;
      var copy = (document.getElementById('ds-copy').value || '').trim();

      // 1. 注入字段
      var titleEl = document.querySelector('[name="article_title"]');
      if (titleEl && title) dsSet(titleEl, title);
      var unitEl = document.querySelector('[name="article_digital_price"]'); // 折后单价
      if (unitEl && unit) dsSet(unitEl, unit);
      var dealEl = document.querySelector('[name="article_final_price"]'); // 订单价（到手价），须在折后单价之后填，防止页面 JS 重算
      if (dealEl && deal) dsSet(dealEl, deal);
      var qtyEl = document.querySelector('[name="article_youhui_num"]');
      if (qtyEl && qty > 1) dsSet(qtyEl, String(qty));
      dsLog('✓ 字段已注入');

      // 2. 价格优惠描述：覆盖为补贴话术（返xx值得买积分后）
      if (subsidy > 0) {
        var subsidyPoints = Math.round(subsidy * 10);
        var descText = '返' + subsidyPoints + '值得买积分后';
        var descEl = document.querySelector('[name="article_subtitle_new"]');
        if (descEl) { dsSet(descEl, descText); dsLog('✓ 价格优惠: ' + descText); }
      }

      // 3. UEditor 文案（补贴句加红色）
      if (copy) {
        try {
          if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant0) {
            var subsidyMatch = copy.match(/(返\d+值得买积分[，,]?补贴后低至[\d.]+元[^，,。\s]*)/);
            var uContent;
            if (subsidyMatch) {
              var sidx = copy.indexOf(subsidyMatch[1]);
              uContent = '<p>' + copy.slice(0, sidx) +
                '<strong style="color:red">' + subsidyMatch[1] + '</strong>' +
                copy.slice(sidx + subsidyMatch[1].length) + '</p>';
            } else {
              uContent = '<p>' + copy + '</p>';
            }
            UE.instants.ueditorInstant0.setContent(uContent);
            UE.instants.ueditorInstant0.sync();
            dsLog('✓ 文案已写入');
          }
        } catch (e) { dsLog('UEditor写入失败: ' + e.message); }
      }

      // 4. 标签（多选，逐个添加）
      var selectedTags = dsLoadSelectedTags();
      for (var ti = 0; ti < selectedTags.length; ti++) {
        var tagVal = selectedTags[ti];
        var tagInputEl = document.querySelector('#tag_name');
        if (tagInputEl) {
          dsSet(tagInputEl, tagVal);
          await dsSleep(100);
          var addTagBtnEl = document.querySelector('#add_new_tag');
          if (addTagBtnEl) { addTagBtnEl.click(); await dsSleep(500); dsLog('✓ 标签: ' + tagVal); }
        }
      }

      // 5. 勾选精选 + 立即同步
      var jxCb = document.getElementById('article_type_jingxuan');
      if (jxCb && !jxCb.checked) jxCb.click();
      var syncRadio = document.getElementById('article_sync_home_1');
      if (syncRadio && !syncRadio.checked) syncRadio.click();

      // 5.1 立即更新（触发发布时间同步），处理弹窗后继续（复制自 3日精选编辑流程）
      await dsSleep(300);
      var dsUpdateBtn = null;
      var dsAllBtnsU = document.querySelectorAll('button');
      for (var dui = 0; dui < dsAllBtnsU.length; dui++) {
        if ((dsAllBtnsU[dui].textContent || '').trim() === '立即更新' && dsAllBtnsU[dui].offsetParent !== null) {
          dsUpdateBtn = dsAllBtnsU[dui]; break;
        }
      }
      if (dsUpdateBtn) {
        dsUpdateBtn.click();
        dsLog('✓ 已点击立即更新');
        await dsSleep(1500);
        // 处理弹窗（时间同步确认 / 私券链接），按 value 匹配"确定"或"确认"
        var dsPopU = document.querySelectorAll('.boxy-btn1, .boxy-btn2, .boxy-btn3');
        for (var dpu = 0; dpu < dsPopU.length; dpu++) {
          if (dsPopU[dpu].offsetParent !== null) {
            var dpuv = (dsPopU[dpu].value || dsPopU[dpu].textContent || '').trim();
            if (dpuv === '确定' || dpuv === '确认') { dsPopU[dpu].click(); break; }
          }
        }
        await dsSleep(1500);
        // 再次关闭可能出现的"同步成功"通知弹窗（否则遮罩会阻挡后续操作）
        var dsPopU2 = document.querySelectorAll('.boxy-btn1, .boxy-btn2, .boxy-btn3');
        for (var dpu2 = 0; dpu2 < dsPopU2.length; dpu2++) {
          if (dsPopU2[dpu2].offsetParent !== null) { dsPopU2[dpu2].click(); break; }
        }
        var dsBlackout = document.querySelector('.boxy-modal-blackout');
        if (dsBlackout && dsBlackout.offsetParent !== null) dsBlackout.click();
        await dsSleep(1000);
      } else {
        dsLog('⚠ 未找到"立即更新"按钮，跳过');
      }

      // 6. 同步 UEditor 并保存（循环处理弹窗）
      await dsSleep(300);
      try {
        if (typeof UE !== 'undefined' && UE.instants) {
          for (var k in UE.instants) { try { UE.instants[k].sync(); } catch (e) {} }
        }
      } catch (e) {}

      var saved = false;
      for (var attempt = 0; attempt < 5 && !saved; attempt++) {
        if (document.body.innerText.indexOf('保存成功') >= 0) { saved = true; break; }
        var saveBtns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (var si = 0; si < saveBtns.length; si++) {
          var st = (saveBtns[si].textContent || '').trim() || saveBtns[si].value || '';
          if (st === '保存修改' && saveBtns[si].offsetParent !== null) { saveBtns[si].click(); break; }
        }
        await dsSleep(1200);
        // 处理弹窗：优先"忽略提醒"(.boxy-btn3)，其次"确定"
        var b3s = document.querySelectorAll('.boxy-btn3');
        var clickedB3 = false;
        for (var b3i = 0; b3i < b3s.length; b3i++) {
          if (b3s[b3i].offsetParent !== null) {
            var b3v = b3s[b3i].getAttribute('value') || '';
            if (b3v.indexOf('忽略') >= 0) { b3s[b3i].click(); clickedB3 = true; break; }
          }
        }
        if (!clickedB3) {
          for (var b3j = 0; b3j < b3s.length; b3j++) {
            if (b3s[b3j].offsetParent !== null) { b3s[b3j].click(); clickedB3 = true; break; }
          }
        }
        if (!clickedB3) {
          var b1 = document.querySelector('.boxy-btn1');
          if (b1 && b1.offsetParent !== null) b1.click();
        }
        await dsSleep(1500);
      }
      dsLog(saved ? '✓ 保存成功' : '⚠ 未检测到保存成功');

      // saveOnly 模式：只执行文章编辑保存，不建表单
      if (saveOnly) {
        dsLog('✓ 已保存（未建表单）');
        if (goBtn) { goBtn.disabled = false; goBtn.textContent = '保存（不建表单）'; }
        return;
      }

      // 6. 加入补贴队列并跳转
      if (articleId) {
        // 读取文章商家，建表单时商城对应（京东→600233，否则→600008）
        var mallEl = document.querySelector('#article_mall, [name="article_mall"]');
        var mallVal = mallEl ? (mallEl.value || '').trim() : '';
        var dsCodeVal = (document.getElementById('ds-code') ? document.getElementById('ds-code').value.trim() : '') || GM_getValue('tuopin_subsidy_code', '');
        var sq = [];
        try { sq = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
        if (!sq.some(function(s) { return String(s.articleId) === String(articleId); })) {
          sq.push({
            articleId: articleId,
            title: title,
            brand: brand,
            productLink: dsDirectLink || '',
            price: unit,
            dealPrice: deal,
            subsidy: String(subsidy),
            commissionRate: dsCommissionRate || '',
            goodsSign: '',
            mall: mallVal,
            bDuan: '',
            gid: dsProductId || '',
            promoCopy: copy,
            code: dsCodeVal,
            fromPrevArticle: true
          });
          GM_setValue('tuopin_subsidy_queue', JSON.stringify(sq));
        } else {
          // 已在队列，更新商家
          for (var mi = 0; mi < sq.length; mi++) {
            if (String(sq[mi].articleId) === String(articleId)) { sq[mi].mall = mallVal; break; }
          }
          GM_setValue('tuopin_subsidy_queue', JSON.stringify(sq));
        }
        // 把 index 指向这篇
        for (var qi = 0; qi < sq.length; qi++) {
          if (String(sq[qi].articleId) === String(articleId)) {
            GM_setValue('tuopin_subsidy_index', qi);
            break;
          }
        }
        GM_setValue('tuopin_subsidy_saved_formid', '');
        dsLog('✓ 已加入补贴队列，2秒后跳转建表单...');
        await dsSleep(2000);
        window.onbeforeunload = null;
        tuopinGo('http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3');
      } else {
        dsLog('✗ 未获取到文章ID，无法跳转建表单');
        if (goBtn) { goBtn.disabled = false; goBtn.textContent = '去补贴'; }
      }
    }

    function init() {
      buildPanel();
      dsRefreshEmailSelect();
      dsWireEmail();
      dsRefreshTagSelect();
      dsWireTag();
      readExisting();
      // 到手价/件数/补贴 变化时重新生成新文案
      ['ds-deal', 'ds-qty', 'ds-subsidy'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('input', regenCopy);
      });
      var goBtn = document.getElementById('ds-go');
      if (goBtn) goBtn.onclick = function() { injectAndSave(false); };
      var saveOnlyBtn = document.getElementById('ds-save-only');
      if (saveOnlyBtn) saveOnlyBtn.onclick = function() { injectAndSave(true); };
      // 渠道 code 初始化（与社群 code 独立，用 tuopin_subsidy_code）
      var dsCodeEl = document.getElementById('ds-code');
      if (dsCodeEl) {
        dsCodeEl.value = GM_getValue('tuopin_subsidy_code', '');
        dsCodeEl.onblur = function() { GM_setValue('tuopin_subsidy_code', this.value.trim()); };
      }
    }

    if (document.readyState === 'complete') {
      setTimeout(init, 1500);
    } else {
      window.addEventListener('load', function() { setTimeout(init, 1500); });
    }
  }

  // ===== SMZDM edit_youhui 编辑页逻辑（3日同价文章更新）=====
  if (location.hostname === 'youhui.bgm.smzdm.com' && location.pathname.indexOf('edit_youhui') >= 0) {

    // ── 好价批量工具：批量 skill 执行（精选/回捞/发现/加标签 叠加）──
    // 入口：tuopin_batch_tasks 中有任务且当前文章 id 匹配某 task.ids[task.idx]
    var _bsTasksRaw = GM_getValue('tuopin_batch_tasks', '');
    var _bsTasks = null;
    try { _bsTasks = _bsTasksRaw ? JSON.parse(_bsTasksRaw) : null; } catch(e) { _bsTasks = null; }
    var _bsIdMatch = location.pathname.match(/edit_youhui\/(\d+)/);
    var _bsCurId = _bsIdMatch ? _bsIdMatch[1] : '';
    // 找到归属当前页面的 task
    var _bsMyTask = null, _bsMyTid = null;
    if (_bsTasks && _bsCurId) {
      Object.keys(_bsTasks).forEach(function(tid) {
        var t = _bsTasks[tid];
        if (t && !t._stopped && t.ids && t.idx != null && t.ids[t.idx] === _bsCurId
          && (Date.now() - (t.startedAt || 0) < 1800000)) {
          _bsMyTask = t; _bsMyTid = tid;
        }
      });
    }
    var _bsActive = !!_bsMyTask;
    if (_bsActive) {
      (function batchSkillRunner() {
        var TARGET_TAGS = ['yszb', 'phbdj', '困难好价', '复杂好价'];
        var BATCH_TAG = '今日必买';
        function bLog(msg) { console.log('[批量skill] ' + msg); }
        function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

        // 关闭 boxy 弹窗（优先"忽略提醒"，其次"确定/确认"）
        function closeDialogs() {
          var b3s = document.querySelectorAll('.boxy-btn3');
          for (var i = 0; i < b3s.length; i++) {
            if (b3s[i].offsetParent !== null) {
              var v = b3s[i].getAttribute('value') || b3s[i].textContent || '';
              if (v.indexOf('忽略') >= 0) { b3s[i].click(); return; }
            }
          }
          for (var j = 0; j < b3s.length; j++) { if (b3s[j].offsetParent !== null) { b3s[j].click(); return; } }
          var all = document.querySelectorAll('.boxy-btn1, .boxy-btn2');
          for (var k = 0; k < all.length; k++) {
            if (all[k].offsetParent !== null) {
              var vv = (all[k].value || all[k].textContent || '').trim();
              if (vv === '确定' || vv === '确认') { all[k].click(); return; }
            }
          }
          var b1 = document.querySelector('.boxy-btn1');
          if (b1 && b1.offsetParent !== null) b1.click();
        }

        // 轮询等待精选/发现异步校验弹窗消失（最多 deadline ms）
        async function waitDialogClose(checkboxId, deadline) {
          var end = Date.now() + deadline;
          while (Date.now() < end) {
            await sleep(150);
            var anyVisible = false;
            var visibles = document.querySelectorAll('.boxy-btn3, .boxy-btn1');
            for (var i = 0; i < visibles.length; i++) { if (visibles[i].offsetParent) { anyVisible = true; break; } }
            var cbChecked = (document.getElementById(checkboxId) || {}).checked;
            if (!anyVisible && cbChecked) break;
          }
          closeDialogs();
          await sleep(150);
        }

        // API 保存（do_normal_save，不点按钮避免页面跳转打断流程）
        function apiSave() {
          return new Promise(function(resolve) {
            var formData = (window.toolBox && toolBox.getFormData) ? toolBox.getFormData() : '';
            fetch('/youhui_action/do_normal_save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
              body: formData
            }).then(function(r){ return r.json(); }).then(function(j) {
              resolve({ error_code: j.error_code, msg: j.msg || '' });
            }).catch(function(e){ resolve({ error_code: -1, msg: 'fetch异常:' + e.message }); });
          });
        }

        // 立即更新 API（回捞用，保存后调用，避免"请勿重复提交"）
        function apiSyncTime(articleId) {
          return new Promise(function(resolve) {
            fetch('/youhui_action/ajax_sync_time_again?article_id=' + articleId, {
              headers: { 'X-Requested-With': 'XMLHttpRequest' }
            }).then(function(r){ return r.json(); }).then(function(j) {
              resolve({ error_code: j.error_code, msg: j.error_msg || '' });
            }).catch(function(e){ resolve({ error_code: -1, msg: 'fetch异常:' + e.message }); });
          });
        }

        // 加标签（API：搜索→写入 #acticle_binded_tag→bindedTagInit）
        // 加标签：fetch 搜索标签名，返回 {ok, tagId, tag, msg}，不直接写 DOM（避免并发竞态）
        function addTagApi(tag) {
          return new Promise(function(resolve) {
            fetch('/youhui_action/ajax_add_tag', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
              body: 'name=' + encodeURIComponent(tag)
            }).then(function(r){ return r.json(); }).then(function(j) {
              if (j && Array.isArray(j) && j.length > 0) {
                resolve({ ok: true, tagId: j[0].id, tag: tag });
              } else {
                resolve({ ok: false, tag: tag, msg: '未找到「' + tag + '」' });
              }
            }).catch(function(e){ resolve({ ok: false, tag: tag, msg: '异常-' + e.message }); });
          });
        }

        // 处理一篇文章（对齐去补贴保存逻辑：等按钮出现→DOM操作→点按钮→处理弹窗→检测成功）
        async function processOne(id, skills, tags, syncSkipTime) {
          var log = [];

          // 等"保存修改"按钮出现即认为页面就绪（对齐去补贴方式，不等 toolBox）
          var readyWait = 0;
          while (readyWait < 15000) {
            var _saveBtn = document.querySelector('button, input[type="button"], input[type="submit"]');
            var _found = false;
            var _allBtns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
            for (var _bi = 0; _bi < _allBtns.length; _bi++) {
              var _bt = (_allBtns[_bi].textContent || '').trim() || _allBtns[_bi].value || '';
              if (_bt === '保存修改' && _allBtns[_bi].offsetParent !== null) { _found = true; break; }
            }
            if (_found) break;
            await sleep(200); readyWait += 200;
          }

          // 加标签请求提前 fire（与 DOM 操作并行，多个标签并行 fire）
          var _addTagPromises = [];
          if (skills.indexOf('加标签') >= 0 && tags && tags.length) {
            for (var _ti = 0; _ti < tags.length; _ti++) {
              _addTagPromises.push(addTagApi(tags[_ti]));
            }
          }

          // 跳过检查
          var ot = document.querySelector('#set_over_time');
          if (ot && ot.checked) return { id: id, status: 'skipped', detail: '已过期(人工)' };
          var so = document.querySelector('#set_sold_out');
          if (so && so.checked) return { id: id, status: 'skipped', detail: '已售罄(人工)' };
          var mr = document.getElementById('machine_report');
          if (mr) {
            var mrt = mr.innerText || mr.textContent || '';
            if (mrt.indexOf('已过期') >= 0 || mrt.indexOf('过期') >= 0) return { id: id, status: 'skipped', detail: '已过期(机器)' };
            if (mrt.indexOf('已售罄') >= 0 || mrt.indexOf('售罄') >= 0) return { id: id, status: 'skipped', detail: '已售罄(机器)' };
          }
          var statusEls = document.querySelectorAll('.article-status, .status-tag, [class*="expire"], [class*="sold"]');
          for (var sei = 0; sei < statusEls.length; sei++) {
            var set = (statusEls[sei].innerText || statusEls[sei].textContent || '').trim();
            if (set.indexOf('过期') >= 0 || set.indexOf('结束') >= 0) return { id: id, status: 'skipped', detail: '已过期(状态标签):' + set.slice(0, 20) };
            if (set.indexOf('售罄') >= 0) return { id: id, status: 'skipped', detail: '已售罄(状态标签):' + set.slice(0, 20) };
          }

          // 同步首页时间跳过：若设置了阈值，且页面 article_sync_home_time > 阈值，则跳过
          if (syncSkipTime) {
            var syncTimeEl = document.getElementById('article_sync_home_time');
            var syncTimeVal = syncTimeEl ? (syncTimeEl.value || '').trim() : '';
            if (syncTimeVal) {
              var pageTs = new Date(syncTimeVal.replace(' ', 'T')).getTime();
              var skipTs = new Date(syncSkipTime).getTime();
              if (!isNaN(pageTs) && !isNaN(skipTs) && pageTs > skipTs) {
                return { id: id, status: 'skipped', detail: '同步首页时间(' + syncTimeVal + ')晚于阈值，跳过' };
              }
            }
          }

          // 删降权标签
          if (skills.indexOf('精选') >= 0 || skills.indexOf('回捞') >= 0 || skills.indexOf('发现') >= 0) {
            var deleted = [];
            var tagBox = document.getElementById('tag_list_box');
            if (tagBox) {
              var tagBtns = tagBox.querySelectorAll('img.remove-tag[data-tag-name]');
              for (var ti = 0; ti < tagBtns.length; ti++) {
                var tn = tagBtns[ti].getAttribute('data-tag-name') || '';
                if (TARGET_TAGS.some(function(t){ return tn.indexOf(t) >= 0; })) { tagBtns[ti].click(); deleted.push(tn); }
              }
            }
            log.push('删标签:[' + (deleted.join(',') || '无') + ']');
          }

          // 4级品类
          if (skills.indexOf('精选') >= 0 || skills.indexOf('发现') >= 0 || skills.indexOf('回捞') >= 0) {
            var cateArea = null;
            var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            var twNode;
            while ((twNode = tw.nextNode())) {
              if (twNode.textContent.trim() === '商品分类') { cateArea = twNode.parentElement && twNode.parentElement.parentElement; break; }
            }
            if (!cateArea) {
              log.push('无分类区域');
            } else {
              var cateSels = cateArea.querySelectorAll('select');
              if (cateSels.length < 4) {
                log.push('仅' + cateSels.length + '级');
              } else {
                var s4 = cateSels[3];
                var cur4 = s4.options[s4.selectedIndex];
                if (cur4 && cur4.value && cur4.text !== '请选择') {
                  log.push('4级已选:' + cur4.text);
                } else {
                  var opts4 = Array.prototype.filter.call(s4.options, function(o){ return o.value && o.text !== '请选择'; });
                  if (!opts4.length) {
                    log.push('4级无选项');
                  } else {
                    var title4 = (document.querySelector('input[name="article_title"]') || {}).value || '';
                    var m4 = opts4.find(function(o){ return title4.indexOf(o.text.trim()) >= 0; });
                    if (!m4) {
                      for (var oi = 0; oi < opts4.length; oi++) {
                        var ot4 = opts4[oi].text.trim();
                        for (var ki = 0; ki < ot4.length - 1; ki++) {
                          if (title4.indexOf(ot4.substring(ki, ki + 2)) >= 0) { m4 = opts4[oi]; break; }
                        }
                        if (m4) break;
                      }
                    }
                    if (!m4) m4 = opts4.find(function(o){ return o.text.trim().indexOf('其他') === 0; }) || opts4[0];
                    s4.value = m4.value;
                    s4.dispatchEvent(new Event('change', { bubbles: true }));
                    log.push('4级选择:' + m4.text);
                  }
                }
              }
            }
          }

          // 发现/精选互斥：精选时取消发现，发现时取消精选
          if (skills.indexOf('发现') >= 0) {
            var fxCb = document.getElementById('article_type_faxian');
            if (fxCb) { fxCb.checked = true; log.push('发现:已注入'); }
            else { log.push('发现:未找到'); }
            var jxCbOff = document.getElementById('article_type_jingxuan');
            if (jxCbOff) jxCbOff.checked = false;
          }
          if (skills.indexOf('精选') >= 0) {
            var jxCb = document.getElementById('article_type_jingxuan');
            if (jxCb) { jxCb.checked = true; log.push('精选:已注入'); }
            else { log.push('精选:未找到'); }
            var fxCbOff = document.getElementById('article_type_faxian');
            if (fxCbOff) fxCbOff.checked = false;
          }

          // 立即同步：注入 checked
          if (skills.indexOf('精选') >= 0 || skills.indexOf('回捞') >= 0) {
            var syncR = document.getElementById('article_sync_home_1');
            if (syncR) { syncR.checked = true; log.push('立即同步:已注入'); }
            else {
              var syncLabels = document.querySelectorAll('label');
              var syncDone = false;
              for (var si = 0; si < syncLabels.length; si++) {
                if (syncLabels[si].textContent.trim() === '立即同步') {
                  var syncInp = syncLabels[si].querySelector('input[type="radio"]');
                  if (syncInp) { syncInp.checked = true; log.push('立即同步:已注入(label)'); syncDone = true; break; }
                }
              }
              if (!syncDone) log.push('立即同步:未找到');
            }
          }

          // 等加标签结果（并发 fetch，串行写 DOM 避免竞态）
          if (_addTagPromises.length) {
            var tagResults = await Promise.all(_addTagPromises);
            var okTags = [], failTags = [];
            for (var tri = 0; tri < tagResults.length; tri++) {
              var tr = tagResults[tri];
              if (tr.ok) {
                var tagObj = document.getElementById('acticle_binded_tag');
                if (tagObj) {
                  var tagIds = tagObj.value ? tagObj.value.split(',') : [];
                  if (tagIds.indexOf(String(tr.tagId)) < 0) { tagIds.push(String(tr.tagId)); tagObj.value = tagIds.join(','); }
                }
                okTags.push(tr.tag + '(' + tr.tagId + ')');
              } else { failTags.push(tr.tag + ':' + (tr.msg || '')); }
            }
            if (window.toolBox && typeof toolBox.bindedTagInit === 'function') toolBox.bindedTagInit();
            if (okTags.length) log.push('加标签:成功[' + okTags.join(',') + ']');
            if (failTags.length) log.push('加标签:失败[' + failTags.join(',') + ']');
          }

          // 同步 UEditor
          try {
            if (typeof UE !== 'undefined' && UE.instants) {
              for (var k in UE.instants) { try { UE.instants[k].sync(); } catch(e) {} }
            }
          } catch(e) {}

          // 保存：点"保存修改"按钮 → 处理弹窗 → 检测"保存成功"（对齐去补贴逻辑，循环最多5次）
          var saved = false;
          for (var attempt = 0; attempt < 5 && !saved; attempt++) {
            if (document.body.innerText.indexOf('保存成功') >= 0) { saved = true; break; }
            var saveBtns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
            for (var sbi = 0; sbi < saveBtns.length; sbi++) {
              var sbt = (saveBtns[sbi].textContent || '').trim() || saveBtns[sbi].value || '';
              if (sbt === '保存修改' && saveBtns[sbi].offsetParent !== null) { saveBtns[sbi].click(); break; }
            }
            await sleep(1200);
            // 处理弹窗：优先"忽略提醒"，其次 boxy-btn1
            var b3s = document.querySelectorAll('.boxy-btn3');
            var clickedB3 = false;
            for (var b3i = 0; b3i < b3s.length; b3i++) {
              if (b3s[b3i].offsetParent !== null) {
                var b3v = b3s[b3i].getAttribute('value') || '';
                if (b3v.indexOf('忽略') >= 0) { b3s[b3i].click(); clickedB3 = true; break; }
              }
            }
            if (!clickedB3) {
              for (var b3j = 0; b3j < b3s.length; b3j++) {
                if (b3s[b3j].offsetParent !== null) { b3s[b3j].click(); clickedB3 = true; break; }
              }
            }
            if (!clickedB3) { var b1 = document.querySelector('.boxy-btn1'); if (b1 && b1.offsetParent !== null) b1.click(); }
            await sleep(1500);
          }
          log.push(saved ? '保存:成功' : '保存:未检测到成功');

          // 回捞：保存成功后立即更新
          if (skills.indexOf('回捞') >= 0 && saved) {
            var syncRes = await apiSyncTime(id);
            log.push('立即更新:' + (syncRes.error_code === 0 ? '成功' : (syncRes.msg || 'code=' + syncRes.error_code)));
          }

          return { id: id, status: saved ? 'success' : 'save_failed', detail: log.join(' | ') };
        }

        // 主循环：读任务→处理当前篇→推进→跳下一篇
        async function run() {
          var tasksRaw = GM_getValue('tuopin_batch_tasks', '');
          if (!tasksRaw) { bLog('无批量任务'); return; }
          var tasks;
          try { tasks = JSON.parse(tasksRaw); } catch(e) { bLog('任务解析失败'); return; }
          // 找归属当前页面的 task
          var task = null, tid = null;
          Object.keys(tasks).forEach(function(k) {
            var t = tasks[k];
            if (t && !t._stopped && t.ids && t.idx != null && t.ids[t.idx] === _bsCurId
              && (Date.now() - (t.startedAt || 0) < 1800000)) { task = t; tid = k; }
          });
          if (!task) { bLog('未找到匹配当前页面的任务'); return; }
          bLog('[' + tid + '] 处理 ' + (task.idx + 1) + '/' + task.ids.length + ' id=' + _bsCurId + ' skills=[' + task.skills.join(',') + ']');
          var r;
          try { r = await processOne(_bsCurId, task.skills, task.tags || [], task.syncSkipTime || ''); }
          catch(e) { r = { id: _bsCurId, status: 'error', detail: e.message }; }
          bLog(JSON.stringify(r));
          task.results.push(r);
          task.idx = (task.idx || 0) + 1;
          // 重新读取，防并发覆盖，刷新 startedAt
          var latestRaw = GM_getValue('tuopin_batch_tasks', '');
          var latestTasks = latestRaw ? JSON.parse(latestRaw) : {};
          if (latestTasks[tid]) {
            latestTasks[tid].idx = task.idx;
            latestTasks[tid].results = task.results;
            latestTasks[tid].startedAt = Date.now();
          }
          // 检查是否被暂停或终止
          if (latestTasks[tid] && (latestTasks[tid]._stopped || latestTasks[tid]._terminated)) {
            GM_setValue('tuopin_batch_tasks', JSON.stringify(latestTasks));
            if (latestTasks[tid]._terminated) {
              bLog('[' + tid + '] 任务已被终止，关闭页面');
              try { window.close(); } catch(e) {}
            } else {
              bLog('[' + tid + '] 执行已暂停');
            }
            return;
          }
          GM_setValue('tuopin_batch_tasks', JSON.stringify(latestTasks));
          if (task.idx < task.ids.length) {
            var nextId = task.ids[task.idx];
            await sleep(50);
            window.onbeforeunload = null;
            location.href = 'http://youhui.bgm.smzdm.com/edit_youhui/' + nextId;
          } else {
            // 该任务完成，从 tasks 中移除
            delete latestTasks[tid];
            GM_setValue('tuopin_batch_tasks', JSON.stringify(latestTasks));
            bLog('[' + tid + '] 全部完成: ' + task.results.length + ' 篇');
            try { window.close(); } catch(e) {}
          }
        }

        // DOM 就绪后尽快跑（processOne 内部会等 toolBox，启动延迟 100ms 即可）
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(run, 100);
        } else {
          window.addEventListener('DOMContentLoaded', function(){ setTimeout(run, 100); });
        }
        // 后台轮询：检测任务被手动结束（_terminated），立即关闭 tab
        var _bsTerminatePoller = setInterval(function() {
          try {
            var tasks2 = JSON.parse(GM_getValue('tuopin_batch_tasks', '{}')) || {};
            var t2 = _bsMyTid ? tasks2[_bsMyTid] : null;
            if (t2 && t2._terminated) {
              clearInterval(_bsTerminatePoller);
              bLog('[' + _bsMyTid + '] 检测到任务终止信号，关闭页面');
              try { window.close(); } catch(e) {}
            } else if (!t2 && _bsMyTid) {
              // 任务已被删除（完成或终止后 3s 清除），关闭 tab
              clearInterval(_bsTerminatePoller);
            }
          } catch(e) {}
        }, 2000);
      })();
      // 批量 skill 执行块结束，不再走下方 confirm/3日同价逻辑
    }

    // ── 内容优化：确认填入焦点图 + 加标签 + 保存 ──
    if (location.search.indexOf('tuopin_co_confirm=1') >= 0) {
      var coConfirmUrl = GM_getValue('tuopin_co_confirm_url', '');
      GM_setValue('tuopin_co_confirm_url', '');
      GM_setValue('tuopin_co_confirm_aid', '');
      if (coConfirmUrl) {
        (function coDoConfirm() {
          function coLog2(msg) { console.log('[内容优化确认] ' + msg); }

          // jQuery/普通 HTML 表单直接赋值即可，不需要 nativeSet hack
          function setV(el, val) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            // 兼容 jQuery 事件
            if (window.jQuery) { window.jQuery(el).trigger('input').trigger('change'); }
          }

          // 找焦点图输入框：先用 name，再用"焦点图"label 文字定位同行 input
          function findFocusInput() {
            var el = document.querySelector('[name="article_pic_url"]');
            if (el) return el;
            var allEls = document.querySelectorAll('td, th, label, span');
            for (var i = 0; i < allEls.length; i++) {
              if (allEls[i].textContent.trim() === '焦点图') {
                var row = allEls[i].closest('tr') || allEls[i].parentElement;
                if (row) {
                  var inp = row.querySelector('input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"])');
                  if (inp) return inp;
                }
              }
            }
            return null;
          }

          // 找焦点图行的"获取"按钮（往上最多找3层容器）
          function findGetBtn(focusInput) {
            var container = focusInput.parentElement;
            for (var up = 0; up < 5; up++) {
              if (!container) break;
              var btns = container.querySelectorAll('button, input[type="button"], input[type="submit"]');
              for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').trim() || btns[i].value || '';
                if (t === '获取') return btns[i];
              }
              if (container.tagName === 'TR' || container.tagName === 'FORM') break;
              container = container.parentElement;
            }
            return null;
          }

          // 等页面完全加载后再额外等 800ms（jQuery 初始化、动态渲染）
          function waitReady(cb) {
            if (document.readyState === 'complete') { setTimeout(cb, 800); }
            else { window.addEventListener('load', function () { setTimeout(cb, 800); }, { once: true }); }
          }

          waitReady(function () {
            // 1. 找上传输入框（与"上传"按钮同行，在"图片地址"行上方）→ 填URL → 点"上传" → 点"设为焦点图"
            function findUploadInputAndBtn() {
              var btns = document.querySelectorAll('button, input[type="button"]');
              for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || btns[i].value || '').trim();
                if (t === '上传') {
                  var row = btns[i].closest('tr') || btns[i].parentElement;
                  if (row) {
                    var inp = row.querySelector('input[type="text"]');
                    if (inp) return { input: inp, uploadBtn: btns[i] };
                  }
                }
              }
              return null;
            }
            function findSetFocusBtn() {
              var btns = document.querySelectorAll('button, input[type="button"]');
              for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || btns[i].value || '').trim();
                if (t === '设为焦点图') return btns[i];
              }
              return null;
            }

            var uploadPair = findUploadInputAndBtn();
            if (uploadPair) {
              setV(uploadPair.input, coConfirmUrl);
              coLog2('✓ 已填入上传框 URL: ' + coConfirmUrl.slice(0, 60));
              setTimeout(function () {
                uploadPair.uploadBtn.click();
                coLog2('✓ 已点击上传');
                // 等上传处理完（约1s）再点"设为焦点图"
                setTimeout(function () {
                  var focusBtn = findSetFocusBtn();
                  if (focusBtn) { focusBtn.click(); coLog2('✓ 已点击设为焦点图'); }
                  else { coLog2('⚠ 未找到设为焦点图按钮'); }
                }, 1200);
              }, 400);
            } else {
              // fallback：直接填焦点图字段+获取
              var focusInput = findFocusInput();
              if (focusInput) {
                setV(focusInput, coConfirmUrl);
                coLog2('✓ fallback: 已填入焦点图 URL');
                setTimeout(function () {
                  var getBtn = findGetBtn(focusInput);
                  if (getBtn) { getBtn.click(); coLog2('✓ 已点击获取'); }
                }, 300);
              } else {
                coLog2('⚠ 未找到上传框和焦点图框，跳过');
              }
            }

            // 2. 加标签"内容优化"（等获取处理完再加）
            setTimeout(function () {
              var tagInput = document.querySelector('#tag_name');
              var addTagBtn = document.querySelector('#add_new_tag');
              if (tagInput && addTagBtn) {
                setV(tagInput, '内容优化');
                setTimeout(function () { addTagBtn.click(); coLog2('✓ 标签已添加'); }, 300);
              } else {
                coLog2('⚠ 未找到标签输入框，跳过');
              }

              // 3. 循环点"保存修改"直到出现"保存成功"
              setTimeout(function () {
                var tries = 0;
                var itv = setInterval(function () {
                  if ((document.body.innerText || '').indexOf('保存成功') >= 0) {
                    clearInterval(itv); coLog2('✓ 保存成功'); return;
                  }
                  if (tries++ > 15) { clearInterval(itv); coLog2('⚠ 保存超时'); return; }
                  // 精准弹窗处理（不用 dismissPopup 避免误点正常页面按钮）
                  var dpResult = null;
                  var b3s = document.querySelectorAll('.boxy-btn3');
                  for (var b3i = 0; b3i < b3s.length; b3i++) {
                    if (b3s[b3i].offsetParent !== null) {
                      if ((b3s[b3i].getAttribute('value') || '').indexOf('忽略') >= 0) { b3s[b3i].click(); dpResult = '忽略'; break; }
                    }
                  }
                  if (!dpResult) { for (var b3j = 0; b3j < b3s.length; b3j++) { if (b3s[b3j].offsetParent !== null) { b3s[b3j].click(); dpResult = 'btn3'; break; } } }
                  if (!dpResult) { var b1 = document.querySelector('.boxy-btn1'); if (b1 && b1.offsetParent !== null) { b1.click(); dpResult = 'btn1'; } }
                  if (!dpResult) { var layer0 = document.querySelector('.layui-layer-btn0'); if (layer0 && layer0.offsetParent !== null) { layer0.click(); dpResult = 'layui'; } }
                  if (!dpResult) { var jc = document.querySelector('a.J_GlobalConfirm'); if (jc && jc.offsetParent !== null) { jc.click(); dpResult = 'J_GlobalConfirm'; } }
                  if (!dpResult) { var blk = document.querySelector('.boxy-modal-blackout'); if (blk && blk.offsetParent !== null) { blk.click(); dpResult = 'blackout'; } }
                  if (!dpResult) {
                    var elDlgs = document.querySelectorAll('.el-dialog__wrapper, .el-message-box__wrapper');
                    for (var ed = 0; ed < elDlgs.length; ed++) {
                      if (elDlgs[ed].style.display === 'none' || elDlgs[ed].style.visibility === 'hidden') continue;
                      var prim = elDlgs[ed].querySelector('.el-button--primary');
                      if (prim && prim.offsetParent !== null) { prim.click(); dpResult = 'el-confirm'; break; }
                    }
                  }
                  if (dpResult) { coLog2('✓ 处理弹窗: ' + dpResult); return; }
                  // 没有弹窗，点"保存修改"
                  var btns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
                  for (var k = 0; k < btns.length; k++) {
                    var t = (btns[k].textContent || '').trim() || btns[k].value || '';
                    if (t === '保存修改' && btns[k].offsetParent !== null) {
                      btns[k].click(); coLog2('→ 点击保存修改 (第' + tries + '次)'); break;
                    }
                  }
                }, 1500);
              }, 1000);
            }, 1200);
          });
        })();
        return;
      }
    }
    // ── END 内容优化确认 ──

    // ── 代码植入：自动追加固定 HTML 到优惠力度字段末尾 ──
    if (location.search.indexOf('tuopin_inject=1') >= 0) {
      (function coDoInject() {
        var m = location.pathname.match(/edit_youhui\/(\d+)/);
        var injectId = m ? m[1] : null;
        if (!injectId) { console.log('[代码植入] 无法识别文章ID'); return; }

        var INJECT_HTML = GM_getValue('tuopin_inject_code', '');
        if (!INJECT_HTML) {
          INJECT_HTML = '<p style="text-align: center;">'
            + '<span style="color: rgb(187, 2, 0);"><strong>站内🔍<span style="color: rgb(0, 128, 0);">「美食618」</span><br/>【每日抽奖】</strong></span>'
            + '</p>'
            + '<p style="text-align: center;">'
            + '<span style="color: rgb(187, 2, 0);"><strong>&nbsp; &nbsp; <a id="link_1779260639299" href="https://m.smzdm.com/topic/x0x0fc/mie30m" target="_blank" quota_pre="" quota="" type="" title="优惠券">点击下方</a>👇转盘参与抽奖活动<br/></strong></span>'
            + '</p>'
            + '<p>'
            + '<a id="link_1779260642514" href="https://m.smzdm.com/topic/x0x0fc/mie30m" target="_blank" quota_pre="" quota="" type="" title="优惠券"><img src="http://y.zdmimg.com/202605/20/6a0d5c1e0ec936840.gif" _size="4012071" alt="" title="" data-title=""/></a>'
            + '</p>';
        }
        GM_setValue('tuopin_inject_code', '');
        var INJECT_MARK = 'mie30m';

        function waitReady(cb) {
          if (document.readyState === 'complete') { setTimeout(cb, 1500); }
          else { window.addEventListener('load', function() { setTimeout(cb, 1500); }, { once: true }); }
        }

        waitReady(function() {
          // 动态查找"优惠力度"对应的 UEditor 实例编号
          var ueInstName = (function() {
            var allNodes = document.querySelectorAll('*');
            for (var i = 0; i < allNodes.length; i++) {
              var el = allNodes[i];
              for (var j = 0; j < el.childNodes.length; j++) {
                if (el.childNodes[j].nodeType === 3 && el.childNodes[j].textContent.trim() === '优惠力度') {
                  var parent = el;
                  for (var k = 0; k < 8; k++) {
                    parent = parent.parentElement;
                    if (!parent) break;
                    var iframe = parent.querySelector('iframe[id^="ueditor_"]');
                    if (iframe) { return 'ueditorInstant' + iframe.id.replace('ueditor_', ''); }
                  }
                }
              }
            }
            return 'ueditorInstant0';
          })();

          var deadline = Date.now() + 5000;
          function tryInject() {
            var ueReady = false;
            try { ueReady = typeof UE !== 'undefined' && UE.instants[ueInstName] && UE.instants[ueInstName].isReady === 1; } catch(e) {}
            if (!ueReady) {
              if (Date.now() < deadline) { setTimeout(tryInject, 100); return; }
              console.log('[代码植入] UEditor 未就绪'); document.title = '[失败] 代码植入 ' + injectId; return;
            }
            var editor = UE.instants[ueInstName];
            var cur = editor.getContent();
            if (cur.indexOf(INJECT_MARK) !== -1) {
              console.log('[代码植入] 已植入，跳过');
              document.title = '[跳过] 已植入 ' + injectId; return;
            }
            editor.setContent((cur && cur.trim()) ? cur + INJECT_HTML : INJECT_HTML);
            console.log('[代码植入] ✓ 已追加，准备保存...');
            var saveAttempts = 0;
            function trySave() {
              if ((document.body.innerText || '').indexOf('保存成功') >= 0) {
                console.log('[代码植入] ✓ 保存成功');
                document.title = '[完成] 代码植入 ' + injectId; return;
              }
              if (saveAttempts >= 12) { document.title = '[未确认] 代码植入 ' + injectId; return; }
              saveAttempts++;
              // 先处理弹窗：只处理真正的弹窗（boxy/layui/el-dialog），不用 dismissPopup 避免误点正常页面按钮
              var dpResult = null;
              // boxy-btn3 优先忽略
              var b3s = document.querySelectorAll('.boxy-btn3');
              for (var b3i = 0; b3i < b3s.length; b3i++) {
                if (b3s[b3i].offsetParent !== null) {
                  if ((b3s[b3i].getAttribute('value') || '').indexOf('忽略') >= 0) { b3s[b3i].click(); dpResult = '忽略'; break; }
                }
              }
              if (!dpResult) {
                for (var b3j = 0; b3j < b3s.length; b3j++) {
                  if (b3s[b3j].offsetParent !== null) { b3s[b3j].click(); dpResult = 'btn3'; break; }
                }
              }
              if (!dpResult) {
                var b1 = document.querySelector('.boxy-btn1');
                if (b1 && b1.offsetParent !== null) { b1.click(); dpResult = 'btn1'; }
              }
              if (!dpResult) {
                var layer0 = document.querySelector('.layui-layer-btn0');
                if (layer0 && layer0.offsetParent !== null) { layer0.click(); dpResult = 'layui'; }
              }
              if (!dpResult) {
                var jc = document.querySelector('a.J_GlobalConfirm');
                if (jc && jc.offsetParent !== null) { jc.click(); dpResult = 'J_GlobalConfirm'; }
              }
              if (!dpResult) {
                var blk = document.querySelector('.boxy-modal-blackout');
                if (blk && blk.offsetParent !== null) { blk.click(); dpResult = 'blackout'; }
              }
              if (!dpResult) {
                // el-dialog / el-message-box
                var elDlgs = document.querySelectorAll('.el-dialog__wrapper, .el-message-box__wrapper');
                for (var ed = 0; ed < elDlgs.length; ed++) {
                  if (elDlgs[ed].style.display === 'none' || elDlgs[ed].style.visibility === 'hidden') continue;
                  var prim = elDlgs[ed].querySelector('.el-button--primary');
                  if (prim && prim.offsetParent !== null) { prim.click(); dpResult = 'el-confirm'; break; }
                }
              }
              if (dpResult) { setTimeout(trySave, 1200); return; }
              // 无弹窗，点"保存修改"
              var btns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
              for (var bi = 0; bi < btns.length; bi++) {
                var bt = (btns[bi].textContent || '').trim() || btns[bi].value || '';
                if (bt === '保存修改' && btns[bi].offsetParent !== null) { btns[bi].click(); break; }
              }
              setTimeout(trySave, 1800);
            }
            setTimeout(trySave, 500);
          }
          tryInject();
        });
      })();
      return;
    }
    // ── END 代码植入 ──

    var editQueue = [];
    try { editQueue = JSON.parse(GM_getValue('tuopin_edit_queue', '[]')); } catch (e) {}
    if (!editQueue.length) { setupDirectSubsidyPanel(); return; }

    var editIdx = parseInt(GM_getValue('tuopin_edit_index', '0')) || 0;
    if (editIdx >= editQueue.length) {
      GM_setValue('tuopin_edit_queue', '[]');
      GM_setValue('tuopin_edit_index', 0);
      return;
    }
    // 归属锁：只有发起流程的标签页（带 tuopin_run）才跑编辑队列
    if (!tuopinAcquireFlow()) { console.log('[拓品] 非流程标签页，跳过编辑队列'); return; }

    function editLog(msg) {
      console.log('[拓品编辑] ' + msg);
      var box = document.getElementById('tuopin-edit-log');
      if (box) { box.innerHTML += '<div>' + msg + '</div>'; box.scrollTop = box.scrollHeight; }
    }

    function createEditPanel() {
      if (document.getElementById('tuopin-edit-panel')) return;
      var panel = document.createElement('div');
      panel.id = 'tuopin-edit-panel';
      panel.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:16px;width:300px;font-family:-apple-system,sans-serif;font-size:13px;';
      panel.innerHTML =
        '<div style="font-weight:600;font-size:15px;color:#1890ff;margin-bottom:8px;">拓品助手 - 更新3日精选文章</div>' +
        '<div id="tuopin-edit-progress" style="color:#333;margin-bottom:6px;">准备中...</div>' +
        '<div id="tuopin-edit-log" style="max-height:180px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:8px;font-size:11px;line-height:1.6;color:#666;"></div>';
      getRightStack().appendChild(panel);
    }

    function setInputValueEdit(el, val) {
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (nativeInputValueSetter && nativeInputValueSetter.set) {
        nativeInputValueSetter.set.call(el, val);
      } else { el.value = val; }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function sleepEdit(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

    async function processEditQueue() {
      createEditPanel();
      var item = editQueue[editIdx];
      var progressEl = document.getElementById('tuopin-edit-progress');
      if (progressEl) progressEl.textContent = '更新 ' + (editIdx + 1) + '/' + editQueue.length + ': ' + (item.title || '').slice(0, 20);
      editLog('文章ID: ' + item.articleId);

      // 等待页面表单加载完成
      await sleepEdit(2000);
      var titleEl = document.querySelector('[name="article_title"]');
      for (var w = 0; w < 20 && !titleEl; w++) {
        await sleepEdit(500);
        titleEl = document.querySelector('[name="article_title"]');
      }
      if (!titleEl) { editLog('错误：页面未加载完成'); return; }
      editLog('页面加载完成，开始填写...');

      // 1. 到手价（订单价）= dealPrice，折后单价 = price
      var copy1 = item.promoCopy || '';
      var copyDealMatch = copy1.match(/(?<![金币])到手价([\d.]+)元/);
      var rawDeal = copyDealMatch ? parseFloat(copyDealMatch[1]) : (parseFloat(item.dealPrice || item.price || '0') || 0);

      // 从文案提取折后单价：有补贴优先"补贴后折x元/件"，无补贴用到手"折/低至x元/件"
      var copySubsidyZhe = copy1.match(/补贴后折([\d.]+)元\/件/);
      var copyDealZhe = copy1.match(/(?:^|[，,])(?:折|低至)([\d.]+)元\/件/);
      var subsidyAmt = parseFloat(item.subsidy) || 0;
      var unitPriceVal;
      if (subsidyAmt > 0 && copySubsidyZhe) {
        unitPriceVal = parseFloat(copySubsidyZhe[1]).toFixed(2);
      } else if (copyDealZhe) {
        unitPriceVal = parseFloat(copyDealZhe[1]).toFixed(2);
      } else {
        var baseAfterSub = subsidyAmt > 0 ? Math.max(0, rawDeal - subsidyAmt) : rawDeal;
        unitPriceVal = baseAfterSub.toFixed(2);
      }

      var priceEl = document.querySelector('[name="article_digital_price"]');
      if (priceEl) { setInputValueEdit(priceEl, unitPriceVal); editLog('✓ 折后单价: ' + unitPriceVal); }

      // 订单价（article_page_price）不修改

      // 2. 价格优惠描述（淘金币到手价xx元，返xx值得买积分后）
      var subsidyPoints = Math.round(subsidyAmt * 10);
      var priceDescText = '';
      var tjbAmt = parseFloat(item.manualTjb || item.taoJinBi || '0') || 0;
      // 优先从文案取淘金币到手价
      var copyTjbMatch = copy1.match(/淘金币到手价([\d.]+)元/);
      if (copyTjbMatch) {
        priceDescText = '淘金币到手价' + copyTjbMatch[1] + '元，';
      } else if (tjbAmt > 0) {
        var afterSub = Math.max(0, Math.round((rawDeal - subsidyAmt) * 100) / 100);
        var tjbFinal = Math.max(0, Math.round((afterSub - tjbAmt) * 100) / 100);
        priceDescText = '淘金币到手价' + tjbFinal.toFixed(2) + '元，';
      }
      priceDescText += '返' + subsidyPoints + '值得买积分后';
      var priceDescEl = document.querySelector('[name="article_subtitle_new"]');
      if (priceDescEl) { setInputValueEdit(priceDescEl, priceDescText); editLog('✓ 价格优惠: ' + priceDescText); }

      // 3. 优惠力度 UEditor（只填补贴文字）
      if (copy1) {
        try {
          if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant0) {
            var subsidyMatch = copy1.match(/(返\d+值得买积分[，,]?补贴后低至[\d.]+元)/);
            if (!subsidyMatch) subsidyMatch = copy1.match(/(返\d+值得买积分.*)/);
            var subsidyOnlyText = subsidyMatch ? subsidyMatch[1] : '';
            if (subsidyOnlyText) {
              UE.instants.ueditorInstant0.setContent('<p><strong style="color:red">' + subsidyOnlyText + '</strong></p>');
              UE.instants.ueditorInstant0.sync();
              editLog('✓ 优惠力度: ' + subsidyOnlyText);
            }
          }
        } catch (e) { editLog('UEditor写入失败: ' + e.message); }
      }

      // 4. 标签：加"今日必买"
      await sleepEdit(200);
      var tagInput = document.querySelector('#tag_name');
      if (tagInput) {
        setInputValueEdit(tagInput, '今日必买');
        await sleepEdit(100);
        var addTagBtn = document.querySelector('#add_new_tag');
        if (addTagBtn) { addTagBtn.click(); editLog('✓ 标签: 今日必买'); }
      }

      // 5. 精选
      await sleepEdit(200);
      var jxCb = document.getElementById('article_type_jingxuan');
      if (jxCb && !jxCb.checked) { jxCb.click(); await sleepEdit(300); editLog('✓ 勾选精选'); }

      // 6. 立即同步
      var syncRadio = document.getElementById('article_sync_home_1');
      if (syncRadio && !syncRadio.checked) syncRadio.click();

      // 7. 立即更新（触发时间同步），处理弹窗后继续
      var updateBtn = null;
      var allBtnsU = document.querySelectorAll('button');
      for (var ui = 0; ui < allBtnsU.length; ui++) {
        if ((allBtnsU[ui].textContent || '').trim() === '立即更新' && allBtnsU[ui].offsetParent !== null) {
          updateBtn = allBtnsU[ui]; break;
        }
      }
      if (updateBtn) {
        updateBtn.click();
        editLog('✓ 已点击立即更新');
        await sleepEdit(1500);
        // 处理弹窗（时间同步确认弹窗 / 私券链接弹窗），按 value 匹配"确定"或"确认"
        var popBtnsU = document.querySelectorAll('.boxy-btn1, .boxy-btn2, .boxy-btn3');
        for (var pu = 0; pu < popBtnsU.length; pu++) {
          if (popBtnsU[pu].offsetParent !== null) {
            var puv = (popBtnsU[pu].value || popBtnsU[pu].textContent || '').trim();
            if (puv === '确定' || puv === '确认') { popBtnsU[pu].click(); break; }
          }
        }
        await sleepEdit(1500);
        // 再次关闭可能出现的"同步成功"通知弹窗（否则遮罩会阻挡后续操作）
        var popBtnsU2 = document.querySelectorAll('.boxy-btn1, .boxy-btn2, .boxy-btn3');
        for (var pu2 = 0; pu2 < popBtnsU2.length; pu2++) {
          if (popBtnsU2[pu2].offsetParent !== null) { popBtnsU2[pu2].click(); break; }
        }
        var blackout = document.querySelector('.boxy-modal-blackout');
        if (blackout && blackout.offsetParent !== null) blackout.click();
        await sleepEdit(1000);
      }

      // 8. 保存（循环直到"保存成功"，优先处理"忽略提醒"弹窗）
      await sleepEdit(300);
      try {
        if (typeof UE !== 'undefined' && UE.instants) {
          for (var k in UE.instants) { try { UE.instants[k].sync(); } catch (e) {} }
        }
      } catch (e) {}

      var saved = false;
      for (var attempt = 0; attempt < 5 && !saved; attempt++) {
        if (document.body.innerText.indexOf('保存成功') >= 0) { saved = true; break; }
        var saveBtns = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
        for (var si = 0; si < saveBtns.length; si++) {
          var st = (saveBtns[si].textContent || '').trim() || saveBtns[si].value || '';
          if (st === '保存修改' && saveBtns[si].offsetParent !== null) { saveBtns[si].click(); break; }
        }
        await sleepEdit(1200);
        // 处理弹窗：优先"忽略提醒"(.boxy-btn3)，其次"确定"(.boxy-btn1)
        var b3s = document.querySelectorAll('.boxy-btn3');
        var clickedB3 = false;
        for (var b3i = 0; b3i < b3s.length; b3i++) {
          if (b3s[b3i].offsetParent !== null) {
            var b3v = b3s[b3i].getAttribute('value') || '';
            if (b3v.indexOf('忽略') >= 0) { b3s[b3i].click(); clickedB3 = true; break; }
          }
        }
        if (!clickedB3) {
          for (var b3j = 0; b3j < b3s.length; b3j++) {
            if (b3s[b3j].offsetParent !== null) { b3s[b3j].click(); clickedB3 = true; break; }
          }
        }
        if (!clickedB3) {
          var b1 = document.querySelector('.boxy-btn1');
          if (b1 && b1.offsetParent !== null) b1.click();
        }
        await sleepEdit(1500);
      }
      editLog(saved ? '✓ 保存成功' : '⚠ 未检测到保存成功，继续下一步');

      // 8. 处理下一个或跳补贴
      editIdx++;
      GM_setValue('tuopin_edit_index', editIdx);
      if (editIdx < editQueue.length) {
        editLog('还剩 ' + (editQueue.length - editIdx) + ' 篇，2秒后跳转...');
        await sleepEdit(2000);
        window.onbeforeunload = null;
        tuopinGo('http://youhui.bgm.smzdm.com/edit_youhui/' + editQueue[editIdx].articleId);
      } else {
        GM_setValue('tuopin_edit_queue', '[]');
        GM_setValue('tuopin_edit_index', 0);
        editLog('全部编辑完成，检查补贴队列...');
        var pendingSubsidy2 = [];
        try { pendingSubsidy2 = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
        if (pendingSubsidy2.length > 0) {
          editLog('有 ' + pendingSubsidy2.length + ' 个补贴待创建，2秒后跳转...');
          await sleepEdit(2000);
          window.onbeforeunload = null;
          tuopinGo('http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3');
        } else {
          if (progressEl) progressEl.textContent = '全部完成！';
        }
      }
    }

    if (document.readyState === 'complete') {
      processEditQueue();
    } else {
      window.addEventListener('load', function() { setTimeout(processEditQueue, 1500); });
    }
    return;
  }
  // ===== END edit_youhui 逻辑 =====
  // ===== 补贴表单自动化逻辑 =====
  if (location.hostname === 'biaodan.bgm.smzdm.com') {
    // 拦截原生 alert/confirm（如"字段添加成功！页面即将刷新..."），自动确认并记录消息
    var _lastAlertMsg = '';
    var _noop = function(msg) { _lastAlertMsg = String(msg || ''); return true; };
    try { unsafeWindow.alert = _noop; unsafeWindow.confirm = _noop; } catch(e) {}
    window.alert = _noop; window.confirm = _noop;

    var subsidyQueue = [];
    try { subsidyQueue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) { subsidyQueue = []; }
    if (!subsidyQueue.length) return;

    var subsidyIdx = parseInt(GM_getValue('tuopin_subsidy_index', '0')) || 0;
    if (subsidyIdx >= subsidyQueue.length) {
      GM_setValue('tuopin_subsidy_queue', '[]');
      GM_setValue('tuopin_subsidy_index', 0);
      return;
    }
    // 归属锁：只有发起流程的标签页（带 tuopin_run）才跑补贴队列
    if (!tuopinAcquireFlow()) { console.log('[拓品] 非流程标签页，跳过补贴队列'); return; }

    function subsidyLog(msg) {
      console.log('[拓品补贴] ' + msg);
      var box = document.getElementById('tuopin-subsidy-log');
      if (box) { box.innerHTML += '<div>' + msg + '</div>'; box.scrollTop = box.scrollHeight; }
    }

    function createSubsidyPanel() {
      if (document.getElementById('tuopin-subsidy-panel')) return;
      var panel = document.createElement('div');
      panel.id = 'tuopin-subsidy-panel';
      panel.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:16px;width:340px;font-family:-apple-system,sans-serif;font-size:13px;max-height:50vh;overflow-y:auto;';
      panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<div style="font-weight:600;font-size:15px;color:#e74c3c;">补贴表单自动创建</div>' +
        '<div><button id="tuopin-subsidy-mon" style="padding:4px 8px;border:1px solid #1890ff;border-radius:4px;background:#fff;color:#1890ff;cursor:pointer;font-size:12px;margin-right:6px;">导出监控</button>' +
        '<button id="tuopin-subsidy-stop" style="padding:4px 12px;border:1px solid #ff4d4f;border-radius:4px;background:#fff;color:#ff4d4f;cursor:pointer;font-size:12px;">停止</button></div>' +
        '</div>' +
        '<div id="tuopin-subsidy-progress" style="color:#1890ff;margin-bottom:6px;">准备中...</div>' +
        '<div id="tuopin-subsidy-log" style="max-height:200px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:8px;font-size:11px;line-height:1.6;color:#666;"></div>';
      getRightStack().appendChild(panel);
      document.getElementById('tuopin-subsidy-stop').onclick = function() {
        GM_setValue('tuopin_subsidy_queue', '[]');
        GM_setValue('tuopin_subsidy_index', 0);
        subsidyLog('已停止');
        var progressEl = document.getElementById('tuopin-subsidy-progress');
        if (progressEl) progressEl.textContent = '已停止';
      };
      document.getElementById('tuopin-subsidy-mon').onclick = function() {
        var raw = GM_getValue('tuopin_mon_log', '[]');
        console.log('===== TUOPIN 监控日志 =====\n' + raw);
        try { navigator.clipboard.writeText(raw); } catch(e) {}
        try {
          var logs = JSON.parse(raw);
          var box = document.getElementById('tuopin-subsidy-log');
          if (box) {
            box.innerHTML = '<div style="color:#1890ff;font-weight:600;">监控日志(' + logs.length + '条,已复制到剪贴板):</div>';
            logs.forEach(function(l) {
              box.innerHTML += '<div style="border-bottom:1px solid #eee;padding:2px 0;">[' + l.ts + '] ' + l.aid + ' <b>' + l.tag + '</b> ' + JSON.stringify(l.data) + '</div>';
            });
          }
        } catch(e) {}
      };
    }

    function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

    function calcDates() {
      var now = new Date();
      var pad = function(n) { return String(n).padStart(2, '0'); };
      var fmt = function(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
          pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      };
      var startTime = fmt(now);
      var auditEnd = new Date(now.getTime());
      auditEnd.setDate(auditEnd.getDate() + 3);
      auditEnd.setHours(23, 59, 59, 0);
      var auditEndTime = fmt(auditEnd);
      var reviewTime = new Date(auditEnd.getTime());
      reviewTime.setDate(reviewTime.getDate() + 14);
      var reviewTimeStr = fmt(reviewTime);
      var rewardTime = new Date(auditEnd.getTime());
      rewardTime.setMonth(rewardTime.getMonth() + 1);
      var rewardTimeStr = fmt(rewardTime);
      return { startTime: startTime, auditEndTime: auditEndTime, reviewTimeStr: reviewTimeStr, rewardTimeStr: rewardTimeStr };
    }

    function findFieldByLabel(labelText) {
      var candidates = document.querySelectorAll('label, .el-form-item__label, td, th, .form-label');
      for (var i = 0; i < candidates.length; i++) {
        var txt = (candidates[i].textContent || '').trim();
        if (txt.indexOf(labelText) >= 0) {
          var parent = candidates[i].closest('.el-form-item, tr, .form-group, .form-item');
          if (parent) {
            var input = parent.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select');
            if (input) return input;
          }
          var next = candidates[i].nextElementSibling;
          if (next) {
            var inp = next.querySelector('input:not([type="hidden"]), textarea, select');
            if (inp) return inp;
          }
        }
      }
      return null;
    }

    function setInputValue(el, val) {
      if (!el || val === undefined || val === null) return false;
      val = String(val);
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      if (!nativeSetter) nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, val);
      } else {
        el.value = val;
      }
      el.dispatchEvent(new Event('focus', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }

    // 填充带时间的 datetimepicker 字段（dateFormat 'yy-mm-dd' + timeFormat 'HH:mm:ss'）。
    // 直接 setInputValue 触发 blur 时，插件的 _setDateFromField 可能丢掉时间部分，
    // 故优先用 jQuery timepicker addon 的 setDate API，并兜底校验时间仍在。
    function setDateTimeField(el, val) {
      if (!el || val === undefined || val === null) return false;
      val = String(val);
      var usedApi = false;
      try {
        if (window.$ && window.$(el).datetimepicker) {
          window.$(el).datetimepicker('setDate', val);
          usedApi = true;
        }
      } catch (e) { /* 回退到原生赋值 */ }
      // 无论是否用 API，都兜底：若值丢了时间部分，直接补写并触发 change
      if ((el.value || '').indexOf(':') < 0) {
        var ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (ns && ns.set) ns.set.call(el, val); else el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }

    function clickRadioByText(text) {
      var labels = document.querySelectorAll('.el-radio__label, .el-radio, label, span');
      for (var i = 0; i < labels.length; i++) {
        var t = (labels[i].textContent || '').trim();
        if (t === text || t.indexOf(text) === 0) {
          var radio = labels[i].closest('.el-radio, .el-radio-button, label');
          if (radio) { radio.click(); return true; }
          labels[i].click();
          return true;
        }
      }
      return false;
    }

    function clickButtonByText(text) {
      var btns = document.querySelectorAll('button, a, .el-button, span.el-link');
      for (var i = 0; i < btns.length; i++) {
        if ((btns[i].textContent || '').trim().indexOf(text) >= 0) {
          btns[i].click();
          return true;
        }
      }
      return false;
    }

    async function fillSubsidyForm(item) {
      subsidyLog('开始填写表单...');

      // ===== 重入令牌：防止同一/不同商品的 fillSubsidyForm 并发执行 =====
      // 转链会导致表单重渲染，SPA 可能二次触发 processSubsidyQueue → fillSubsidyForm 并发跑，
      // 旧运行的滞后异步(如 20s 活动规则轮询)会覆盖新运行已填好的内容(把 taLen 清成 0)。
      // 领取全局递增令牌，每个关键异步步骤后校验自己仍是最新令牌，否则立即中止。
      var _uwTok = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
      _uwTok.__tpFillToken = (_uwTok.__tpFillToken || 0) + 1;
      var myToken = _uwTok.__tpFillToken;
      function tokenValid() { return _uwTok.__tpFillToken === myToken; }

      // ===== 监控埋点：跨页持久化到 GM，跑完后可一次性导出分析 =====
      function subsidyMon(tag, data) {
        try {
          var logs = JSON.parse(GM_getValue('tuopin_mon_log', '[]'));
          var t = new Date();
          var ts = t.getHours() + ':' + ('0'+t.getMinutes()).slice(-2) + ':' + ('0'+t.getSeconds()).slice(-2) + '.' + ('00'+t.getMilliseconds()).slice(-3);
          logs.push({ ts: ts, aid: item.articleId, tag: tag, data: data });
          if (logs.length > 400) logs = logs.slice(-400);
          GM_setValue('tuopin_mon_log', JSON.stringify(logs));
          console.log('[MON ' + ts + '] ' + item.articleId + ' | ' + tag + ' | ' + JSON.stringify(data));
        } catch(e) {}
      }
      // 抓取商城 + 活动规则的当前真实状态(原生上下文)
      function snapState() {
        var _uwS = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        try {
          return (new _uwS.Function([
            'var selTxt = document.querySelector(".multiselect-trigger .selected-text");',
            'var checkedMalls = Array.from(document.querySelectorAll(".multiselect-option input[name=\\"mall_ids[]\\"]")).filter(function(c){return c.checked;}).map(function(c){return c.value;});',
            'var ta = document.getElementById("activity_rules");',
            'var taLen = ta ? (ta.value||"").length : -1;',
            'var ueLen = -1;',
            'try { var ue = window.UE && window.UE.getEditor("activity_rules"); ueLen = ue && ue.hasContents() ? ue.getContent().length : 0; } catch(e){}',
            'return { mallSel: selTxt ? selTxt.textContent.trim().slice(0,12) : "NO-EL", mallChecked: checkedMalls.join(","), taLen: taLen, ueLen: ueLen };'
          ].join('\n')))();
        } catch(e) { return { err: e.message }; }
      }

      // ===== 终极方案：注入 <script> 标签到页面，代码 100% 在页面原生上下文运行 =====
      // 必须用 unsafeWindow.document 创建/挂载 script，否则沙箱 document 注入的脚本上下文错乱，
      // 导致组件事件监听器收不到(表现为 checked=true 但 selected-text 不更新)。
      // asyncFnBody 内需在完成时调用 __done(result)。返回 Promise<string>。
      var _udocRun = (typeof unsafeWindow !== 'undefined' && unsafeWindow.document) ? unsafeWindow.document : document;
      var _runSeq = 0;
      function runInPage(asyncFnBody, timeoutMs) {
        return new Promise(function(resolve) {
          _runSeq++;
          var id = 'tp_run_' + _runSeq;
          var holder = _udocRun.createElement('div');
          holder.id = id;
          holder.style.display = 'none';
          (_udocRun.body || _udocRun.documentElement).appendChild(holder);
          var code = '(async function(){' +
            'var __h = document.getElementById("' + id + '");' +
            'function __done(r){ if(!__h) return; __h.setAttribute("data-result", (typeof r === "string") ? r : JSON.stringify(r)); __h.setAttribute("data-ready","1"); }' +
            'try {\n' + asyncFnBody.split('__RUNID__').join('"' + id + '"') + '\n} catch(e){ __done("ERR:"+(e&&e.message||e)); }' +
            '})();';
          var s = _udocRun.createElement('script');
          s.textContent = code;
          (_udocRun.body || _udocRun.documentElement).appendChild(s);
          s.remove();
          var waited = 0;
          var lim = timeoutMs || 30000;
          var iv = setInterval(function() {
            waited += 100;
            var h = _udocRun.getElementById(id);
            if (h && h.getAttribute('data-ready') === '1') {
              clearInterval(iv);
              var r = h.getAttribute('data-result');
              h.remove();
              resolve(r);
            } else if (waited >= lim) {
              clearInterval(iv);
              if (h) h.remove();
              resolve('RUN_TIMEOUT');
            }
          }, 100);
        });
      }
      // 新一轮自动清空监控日志：距上次埋点 >2 分钟视为新任务
      try {
        var _lastMon = parseInt(GM_getValue('tuopin_mon_last', '0')) || 0;
        if (Date.now() - _lastMon > 120000) GM_setValue('tuopin_mon_log', '[]');
        GM_setValue('tuopin_mon_last', String(Date.now()));
      } catch(e) {}
      subsidyMon('ENTER', { type: item.type, title: (item.title||'').slice(0,20), mall: item.mall, cleanLink: (item.cleanLink||'').slice(0,40) });

      // 在页面原生上下文执行函数，彻底绕开 Tampermonkey XRay 沙箱
      // XRay 会包装沙箱里获取的 DOM 元素，导致 .click()/.value 被拦截静默失败
      var _uw = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
      function _pageExec(fnBody, args) {
        var fn = new _uw.Function('args', 'var a=args||{};\n' + fnBody);
        return fn(args || {});
      }
      function _pageExecAsync(fnBody, args) {
        var fn = new _uw.Function('args', 'var a=args||{};\n' + fnBody);
        return Promise.resolve(fn(args || {}));
      }

      // 等待表单名称输入框出现（轮询最多 15s），比固定 sleep 更可靠
      // SPA 路由跳转后 Vue 组件挂载时间不固定，第2个品开始容易挂载慢
      var nameField = null;
      for (var fw = 0; fw < 30; fw++) {
        nameField = document.querySelector('input[placeholder*="用于表单后台展示"]');
        if (nameField && nameField.offsetParent !== null) break;
        await sleep(500);
      }
      if (!nameField) {
        subsidyMon('FAIL_NAMEFIELD', {});
        subsidyLog('✗ 表单名称输入框 15s 内未出现，停止');
        return;
      }

      var dates = calcDates();
      var now = new Date();
      var datePrefix = (now.getMonth() + 1) + '.' + now.getDate();
      var brand = (item.brand || '').trim();
      var isShequn = (item.type === 'shequn');

      // ── 表单名称格式 ──
      // 社群：社群-当天日期-商品名称；非社群（大淘客/去补贴）：当天日期-品牌+商品名
      var formName;
      if (isShequn) {
        formName = '社群-' + datePrefix + '-' + (item.title || '').slice(0, 20);
      } else {
        formName = datePrefix + '-' + (brand || '') + (item.title || '').slice(0, 20);
      }

      // 0. 适用终端 — 最先执行。applyTerminalScope4 触发页面联动(现金锁定/商城过滤/UEditor初始化)，
      // 页面渲染完成后再填字段，活动规则步骤时 UEditor iframe 已就绪。
      subsidyMon('S2_ZL_START', { type: item.type });
      var termVal = isShequn ? '1' : '2';
      var termResult = await runInPage([
        'var val = ' + JSON.stringify(termVal) + ';',
        'var r = document.querySelector("input[name=\'terminal_scope\'][value=\'" + val + "\']");',
        'if (!r) { __done("no-radio"); return; }',
        'r.checked = true;',
        'r.dispatchEvent(new Event("change", { bubbles: true }));',
        'try { if (typeof applyTerminalScope4 === "function") applyTerminalScope4(val); } catch(e){ __done("ERR:"+(e&&e.message||e)); return; }',
        'setTimeout(function(){',
        '  var checked = document.querySelector("input[name=\'terminal_scope\']:checked");',
        '  __done("ok val=" + (checked ? checked.value : "none"));',
        '}, 400);'
      ].join('\n'), 6000);
      subsidyMon('S2_ZL_DONE', { termVal: termVal, result: termResult });
      subsidyLog('✓ 终端范围 (' + termResult + ')');
      await sleep(600);

      // 1. 表单名称
      setInputValue(nameField, formName); subsidyLog('✓ 表单名称');
      subsidyMon('S1_NAME', {});

      // 1.2 表单标题（前台展示）
      var titleField = document.querySelector('input[placeholder*="前台展示给用户"]') || document.querySelector('input[placeholder*="非必填"]');
      if (titleField && titleField !== nameField) { setInputValue(titleField, formName); subsidyLog('✓ 表单标题'); }

      // 1.5 商品标题
      var goodsTitleField = document.querySelector('input[placeholder*="用于好价详情页活动规则展示"]');
      if (goodsTitleField) {
        var goodsTitle = (brand ? brand : '') + (item.title || '');
        setInputValue(goodsTitleField, goodsTitle);
        subsidyLog('✓ 商品标题');
      }
      subsidyMon('S1_TITLE_DONE', { hasTitle: !!titleField, hasGoodsTitle: !!goodsTitleField });

      // 3. 活动链接 — 原生上下文执行
      _pageExec([
        'var f = document.querySelector("input[placeholder*=\'用于发站内信时的活动链接\']");',
        'if (f) {',
        '  var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");',
        '  if (setter && setter.set) setter.set.call(f, a.link); else f.value = a.link;',
        '  f.dispatchEvent(new Event("input", { bubbles: true }));',
        '  f.dispatchEvent(new Event("change", { bubbles: true }));',
        '}'
      ].join('\n'), { link: 'https://www.smzdm.com/p/' + item.articleId + '/' });

      // 3.5 商品链接 — 社群填面板商品链接后点"转链"(#btn-single-transfer4)
      // 该区块在 span.terminal-scope-wx-only 里，选了"仅微信小程序"才显示(第2步已选)。
      // 转链按钮是 jQuery 绑定的 <button id="btn-single-transfer4">，必须在页面上下文点击才触发
      // doSingleTransfer4()，成功后自动回填商品编码(skuid)。故用 runInPage 注入。
      if (isShequn && item.cleanLink) {
        var transferResult = await runInPage([
          'var link = ' + JSON.stringify(item.cleanLink) + ';',
          'var f = document.getElementById("single-product-url4") || document.querySelector("input[name=\'single_product_url\']");',
          'if (!f) { __done("no-input"); return; }',
          'var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");',
          'if (setter && setter.set) setter.set.call(f, link); else f.value = link;',
          'f.dispatchEvent(new Event("input", { bubbles: true }));',
          'f.dispatchEvent(new Event("change", { bubbles: true }));',
          '// 精确点转链按钮',
          'var btn = document.getElementById("btn-single-transfer4");',
          'if (!btn) { var bs=document.querySelectorAll("#single-link-panel4 button, .input-group-btn button"); for (var i=0;i<bs.length;i++){ if((bs[i].textContent||"").trim()==="转链"){ btn=bs[i]; break; } } }',
          'if (!btn) { __done("no-btn"); return; }',
          'btn.click();',
          '// 轮询等转链回填(最多 9s)：商品编码(skuid) + 主图(focus_pic_url)。主图是必填，否则下一步校验不过。',
          'var waited=0; var iv=setInterval(function(){',
          '  waited+=400;',
          '  var sku=document.querySelector("textarea[name=\'skuid\']");',
          '  var skuVal = sku ? (sku.value||"").trim() : "";',
          '  var fp=document.getElementById("focus_pic_url");',
          '  var fpVal = fp ? (fp.value||"").trim() : "";',
          '  var failEl=document.getElementById("focus-pic-fetch-fail");',
          '  var failShown = failEl && failEl.offsetParent!==null;',
          '  if (skuVal.length>0 && fpVal.length>0) { clearInterval(iv); __done("ok skuid="+skuVal+" img=1"); return; }',
          '  if (failShown) { clearInterval(iv); __done("img-fetch-fail skuid="+skuVal); return; }',
          '  if (waited>=9000) { clearInterval(iv); __done("timeout skuid="+(skuVal?1:0)+" img="+(fpVal?1:0)); }',
          '}, 400);'
        ].join('\n'), 11000);
        subsidyMon('S3_TRANSFER_DONE', { result: transferResult });
        subsidyLog('✓ 商品链接 + 转链 (' + transferResult + ')');
        if (transferResult.indexOf('img-fetch-fail') >= 0) subsidyLog('⚠ 主图获取失败，需手动上传商品主图');
        if (transferResult.indexOf('img=0') >= 0) subsidyLog('⚠ 主图未回填，下一步可能被拦，请检查');
      }

      // 4. ROI
      subsidyMon('S3_ROI_START', {});
      var roiField = document.querySelector('input[placeholder*="支持小数点后两位"]')
        || document.querySelector('input[placeholder*="有效的数字"]')
        || document.querySelector('input[type="number"][placeholder]');
      if (!roiField) {
        var roiLabels = document.querySelectorAll('div, td, span, label');
        for (var ri = 0; ri < roiLabels.length; ri++) {
          var rlText = (roiLabels[ri].textContent || '').trim();
          if (rlText.indexOf('ROI') >= 0 && rlText.length < 20) {
            var rParent = roiLabels[ri].parentElement;
            if (rParent) { roiField = rParent.querySelector('input'); if (roiField) break; }
          }
        }
      }
      if (roiField) setInputValue(roiField, '1');
      subsidyMon('S4_ROI_DONE', { found: !!roiField });

      // 5. 补贴来源 — 兴趣+美食部
      // 社群：合成 click 不触发 jQuery change handler，必须 runInPage 直接设 checked + dispatch change
      // 非社群：clickRadioByText + checkbox .click()
      if (isShequn) {
        var srcResult = await runInPage([
          'var r = document.querySelector("input[name=\'subsidy_source\'][value=\'2\']");',
          'if (r) { r.checked = true; r.dispatchEvent(new Event("change", {bubbles:true})); }',
          'var d = document.querySelector("input[name=\'subsidy_source_department[]\'][value=\'3\']");',
          'if (d) { d.checked = true; d.dispatchEvent(new Event("change", {bubbles:true})); }',
          'setTimeout(function(){',
          '  var sc = document.querySelector("input[name=\'subsidy_source\']:checked");',
          '  var dc = Array.from(document.querySelectorAll("input[name=\'subsidy_source_department[]\']")).filter(function(x){return x.checked;}).length;',
          '  __done("source="+(sc?sc.value:"none")+" dept="+dc);',
          '}, 300);'
        ].join('\n'), 5000);
        subsidyLog('✓ 补贴来源+美食部 (' + srcResult + ')');
      } else {
        clickRadioByText('兴趣');
        await sleep(400);
        var checkboxes = document.querySelectorAll('input[type="checkbox"]');
        var meishiChecked = false;
        for (var ci = 0; ci < checkboxes.length; ci++) {
          var cbLabel = checkboxes[ci].parentElement;
          if (cbLabel && (cbLabel.textContent || '').indexOf('美食部') >= 0) {
            if (!checkboxes[ci].checked) checkboxes[ci].click();
            meishiChecked = true; break;
          }
          var cbNext = checkboxes[ci].nextSibling;
          if (cbNext && (cbNext.textContent || '').indexOf('美食部') >= 0) {
            if (!checkboxes[ci].checked) checkboxes[ci].click();
            meishiChecked = true; break;
          }
        }
        if (!meishiChecked) {
          var allLabels = document.querySelectorAll('label, span');
          for (var li = 0; li < allLabels.length; li++) {
            if ((allLabels[li].textContent || '').trim() === '美食部') { allLabels[li].click(); meishiChecked = true; break; }
          }
        }
        subsidyLog(meishiChecked ? '✓ 美食部' : '✗ 美食部');
      }

      // 6-7. 审核时间 + 活动时间
      // 社群用 name 属性精准定位，非社群用 placeholder 顺序
      subsidyMon('S5_SOURCE_DONE', {});
      if (isShequn) {
        var sqSetT = function(sel, val) { var el = document.querySelector(sel); if (el) setDateTimeField(el, val); };
        sqSetT('input[name="subsidy_check_starttime"]', dates.startTime);
        sqSetT('input[name="subsidy_check_endtime"]', dates.auditEndTime);
        sqSetT('input[name="subsidy_starttime[0]"]', dates.startTime);
        sqSetT('input[name="subsidy_endtime[0]"]', dates.auditEndTime);
      } else {
        var timeInputsStart = document.querySelectorAll('input[placeholder="开始时间"]');
        var timeInputsEnd = document.querySelectorAll('input[placeholder="结束时间"]');
        if (timeInputsStart.length >= 1) setInputValue(timeInputsStart[0], dates.startTime);
        if (timeInputsEnd.length >= 1) setInputValue(timeInputsEnd[0], dates.auditEndTime);
        if (timeInputsStart.length >= 2) setInputValue(timeInputsStart[1], dates.startTime);
        if (timeInputsEnd.length >= 2) setInputValue(timeInputsEnd[1], dates.auditEndTime);
      }

      // 8. 名额
      var quotaField = document.querySelector('input[placeholder="填写表单名额数"]');
      if (quotaField) setInputValue(quotaField, '50');
      subsidyMon('S8_QUOTA_DONE', { quota: !!quotaField });

      // 9. 商城 - 点开下拉后用 label.click() 触发组件原生事件
      // 商城编码表: 600233=京东 600008=淘系 600360=小米有品 600364=拼多多 600205=唯品会 600640=美团外卖 600704=美团到店
      var mallStr = (item.mall || '').trim();
      var mallVal = '600008'; // 默认淘系
      if (mallStr.indexOf('京东') >= 0) mallVal = '600233';
      else if (mallStr.indexOf('小米') >= 0 || mallStr.indexOf('有品') >= 0) mallVal = '600360';
      else if (mallStr.indexOf('拼多多') >= 0) mallVal = '600364';
      else if (mallStr.indexOf('唯品会') >= 0) mallVal = '600205';
      else if (mallStr.indexOf('美团外卖') >= 0) mallVal = '600640';
      else if (mallStr.indexOf('美团') >= 0) mallVal = '600704';
      // 淘宝/天猫/淘系 均映射到 600008
      var mallLabelMap = {'600233':'京东','600008':'淘系','600360':'小米有品','600364':'拼多多','600205':'唯品会','600640':'美团外卖','600704':'美团到店'};
      var mallLabel = mallLabelMap[mallVal] || '淘系';
      var _udoc = (typeof unsafeWindow !== 'undefined' && unsafeWindow.document) ? unsafeWindow.document : document;
      // 等待 multiselect 出现（SPA 渲染可能延迟）
      var mallTrigger = null;
      for (var mw = 0; mw < 10; mw++) {
        mallTrigger = _udoc.querySelector('.multiselect-trigger');
        if (mallTrigger && mallTrigger.offsetParent !== null) break;
        await sleep(500);
      }
      subsidyMon('S9_MALL_START', { mallVal: mallVal, mallLabel: mallLabel, triggerFound: !!mallTrigger, preSnap: snapState() });
      if (mallTrigger) {
        // 【终极方案】直接调用页面自己的商城设置函数 syncMallSelectionDom4(vals)，完全绕开点击/change 事件竞态。
        // 根因(已扒源码确认)：组件靠 $(document).on('change') 更新，真实点击是"先 toggle checked 再触发 change"；
        // 而脚本 label.click() 若 checkbox 已是 checked 会 toggle 成 false → change 里 nowOn=false → 清空选择。
        // syncMallSelectionDom4([val]) 幂等地设置隐藏 select 的 option.selected + checkbox.checked，
        // 再配合 updateMultiselectDisplay() 更新显示文字，一步到位，无竞态。
        var mallResult = await runInPage([
          'var mallVal = ' + JSON.stringify(mallVal) + ';',
          'var mallLabel = ' + JSON.stringify(mallLabel) + ';',
          'try {',
          '  if (typeof syncMallSelectionDom4 === "function") {',
          '    syncMallSelectionDom4([mallVal]);',
          '    if (typeof updateMultiselectDisplay === "function") updateMultiselectDisplay();',
          '    if (typeof check_mall_price_limit === "function") { try { check_mall_price_limit(); } catch(e){} }',
          '    if (typeof toggleCommissionMonitor === "function") { try { toggleCommissionMonitor(); } catch(e){} }',
          '  } else {',
          '    // 兜底：页面函数不存在时，直接设隐藏 select + checkbox',
          '    var $hidden = $("select[name=\\"mall_ids[]\\"]");',
          '    $hidden.find("option").prop("selected", false);',
          '    $hidden.find("option[value=\\"" + mallVal + "\\"]").prop("selected", true);',
          '    $("#multiselect-dropdown-container input[name=\\"mall_ids[]\\"]").prop("checked", false);',
          '    $("#multiselect-dropdown-container input[name=\\"mall_ids[]\\"][value=\\"" + mallVal + "\\"]").prop("checked", true);',
          '    var st = document.querySelector(".multiselect-trigger .selected-text"); if (st) st.textContent = mallLabel;',
          '  }',
          '} catch(e) { __done("ERR:" + (e && e.message || e)); return; }',
          'setTimeout(function() {',
          '  var hv = $("select[name=\\"mall_ids[]\\"]").val();',
          '  var hvStr = hv ? (Array.isArray(hv) ? hv.join(",") : String(hv)) : "";',
          '  var st = document.querySelector(".multiselect-trigger .selected-text");',
          '  var selTxt = st ? st.textContent.trim() : "";',
          '  var ok = hvStr.indexOf(mallVal) >= 0;',
          '  __done((ok ? "ok" : "fail") + " hiddenVal=" + hvStr + " sel=" + selTxt.slice(0,10));',
          '}, 300);'
        ].join('\n'), 8000);
        subsidyMon('MALL_RESULT', { mallVal: mallVal, mallLabel: mallLabel, result: mallResult });
        subsidyLog((mallResult.indexOf('ok') >= 0) ? ('✓ 商城: ' + mallLabel + ' (' + mallResult + ')') : ('⚠ 商城: ' + mallResult));
        await sleep(300);
        subsidyMon('AFTER_MALL_SNAP', snapState());
      }
      if (!tokenValid()) { subsidyMon('ABORT_STALE', { at: 'after_mall' }); return; }

      // 10. 商品编码 - shequn 从 cleanLink 提取，其他从 productLink 提取
      subsidyMon('S10_FIELDS_START', {});
      var skuId = '';
      // 社群从面板商品链接(cleanLink)提取商品id，其他从 productLink 提取
      var linkForSku = (isShequn ? (item.cleanLink || '') : (item.productLink || '')) || item.productLink || item.cleanLink || '';
      if (linkForSku) {
        var jdMatch = linkForSku.match(/item\.jd\.com\/(\d+)/);
        var tbMatch = linkForSku.match(/[?&]id=(\d+)/);
        if (jdMatch) skuId = jdMatch[1];
        else if (tbMatch) skuId = tbMatch[1];
      }
      if (!skuId && item.gid && /^\d{6,}$/.test(item.gid)) skuId = item.gid;
      if (skuId) {
        var skuField = document.querySelector('textarea[name="skuid"]');
        if (!skuField) {
          var skuInputs = document.querySelectorAll('textarea');
          for (var si = 0; si < skuInputs.length; si++) {
            if ((skuInputs[si].placeholder || '').indexOf('英文逗号分隔') >= 0) { skuField = skuInputs[si]; break; }
          }
        }
        if (skuField) {
          var taSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
          if (taSetter && taSetter.set) taSetter.set.call(skuField, skuId);
          else skuField.value = skuId;
          skuField.dispatchEvent(new Event('input', { bubbles: true }));
          skuField.dispatchEvent(new Event('change', { bubbles: true }));
          subsidyLog('✓ 商品编码: ' + skuId);
        }
      }

      // 11. 佣比
      if (item.commissionRate) {
        var commField = document.querySelector('input[placeholder*="最低期望佣比"]');
        if (commField) {
          var crVal = String(item.commissionRate).replace('%', '').trim() + '%';
          setInputValue(commField, crVal);
        }
      }

      // 12. 预算渠道code — 优先面板传入的 item.code；无则按类型读对应 GM 存储（社群与去补贴独立）
      var budgetField = document.querySelector('input[placeholder*="预算渠道Code"]');
      if (budgetField) {
        var codeVal = (item.code || '').trim()
          || (isShequn ? GM_getValue('tuopin_shequn_code', '') : GM_getValue('tuopin_subsidy_code', ''));
        if (codeVal) setInputValue(budgetField, codeVal);
      }

      // 13. 最低支付金额
      var minPayField = document.querySelector('input[placeholder*="满300-100"]') || document.querySelector('input[placeholder*="输入300"]');
      if (!minPayField) {
        var allFormEls = document.querySelectorAll('div, label, span, td');
        for (var mfi = 0; mfi < allFormEls.length; mfi++) {
          var mfText = (allFormEls[mfi].textContent || '').trim();
          if (mfText === '最小支付金额' || mfText === '最低支付金额') {
            var mfParent = allFormEls[mfi].parentElement;
            if (mfParent) {
              var mfInput = mfParent.querySelector('input');
              if (!mfInput && mfParent.parentElement) mfInput = mfParent.parentElement.querySelector('input');
              if (mfInput) { minPayField = mfInput; break; }
            }
          }
        }
      }
      if (minPayField) {
        var minPay;
        if (isShequn) {
          // 社群：最小支付金额 = 面板最终到手价（dealPrice 已是补贴后到手价）
          minPay = Math.floor(parseFloat(item.dealPrice || item.price) || 0);
        } else {
          var dp = parseFloat(item.dealPrice || item.price) || 0;
          var sub = parseFloat(item.subsidy) || 0;
          minPay = Math.floor(dp - sub);
        }
        if (minPay < 0) minPay = 0;
        setInputValue(minPayField, String(minPay));
        subsidyLog('✓ 最小支付: ' + minPay);
      }

      // 14. 补贴金额 - 社群直接填元，其他×10转积分
      var subsidyField = document.querySelector('input[placeholder*="成本单位"]');
      if (subsidyField) {
        var subsidyCost = isShequn
          ? (parseFloat(item.subsidy) || 0)                 // 社群：直接填元（面板补贴金额原值）
          : Math.round((parseFloat(item.subsidy) || 0) * 10); // 其他：×10 转积分
        setInputValue(subsidyField, String(subsidyCost));
        subsidyLog('✓ 补贴: ' + subsidyCost);
      }

      // 15. 复审时间
      var reviewField = isShequn
        ? (document.querySelector('input[name="scheduled_subsidy_manual_check_time"]') || document.querySelector('input[placeholder="复审时间"]'))
        : document.querySelector('input[placeholder="复审时间"]');
      if (reviewField) setDateTimeField(reviewField, dates.reviewTimeStr);

      // 16. 返补贴时间
      // 社群用 name 精准定位，非社群按文字遍历查找
      var rewardField = null;
      if (isShequn) {
        rewardField = document.querySelector('input[name="activity_subsidy_time"]');
      } else {
        var allEls = document.querySelectorAll('div, td, span, label, p');
        for (var di = 0; di < allEls.length; di++) {
          var el = allEls[di];
          if (el.querySelector('input, textarea, select, iframe')) continue;
          var elText = (el.textContent || '').trim();
          if (elText.indexOf('返补贴时间') >= 0 && elText.length < 40) {
            var sibInput = el.nextElementSibling;
            if (sibInput && sibInput.tagName === 'INPUT') { rewardField = sibInput; break; }
            var parentEl = el.parentElement;
            if (parentEl) {
              var inputs = parentEl.querySelectorAll(':scope > input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
              if (inputs.length === 0) inputs = parentEl.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
              for (var ii = 0; ii < inputs.length; ii++) {
                var iPlaceholder = inputs[ii].placeholder || '';
                if (iPlaceholder.indexOf('用于') >= 0 || iPlaceholder.indexOf('表单') >= 0 || iPlaceholder.indexOf('复审') >= 0) continue;
                if (inputs[ii] !== nameField && inputs[ii] !== reviewField && inputs[ii] !== goodsTitleField && inputs[ii] !== roiField) { rewardField = inputs[ii]; break; }
              }
              if (rewardField) break;
            }
          }
        }
      }
      if (rewardField) { setDateTimeField(rewardField, dates.rewardTimeStr); subsidyLog('✓ 返补贴时间'); }

      // 17. 邮箱
      var savedEmail = GM_getValue('tuopin_selected_email', '');
      if (savedEmail) {
        var emailField = document.querySelector('input[placeholder*="英文逗号隔开"]');
        if (emailField) { setInputValue(emailField, savedEmail); subsidyLog('✓ 邮箱: ' + savedEmail); }
      }
      await sleep(200);

      // 字段填写完成。活动规则移到最后(下一步之前)执行，确保补贴金额/最低支付等字段已就绪，
      // generateActivityRules() 才能生成完整内容(之前失败是点太早、字段不全)。
      subsidyMon('S17_FIELDS_DONE_BEFORE_ACTRULE', snapState());
      if (!tokenValid()) { subsidyMon('ABORT_STALE', { at: 'before_actrule' }); return; }

      await sleep(300);

      // 19-20. 下单要求(插入模板) + 订单审核自动生成 —— 仅 APP+PC+Wap(app-only)才有。
      // 社群"仅微信小程序"模式下这两个区块是 terminal-scope-app-only 且隐藏，
      // 若仍去点隐藏的"插入模板"会弹出残留 UEditor 弹窗，干扰随后活动规则的 setContent（表现为活动规则框空白）。
      // 故社群模式整体跳过。
      if (!isShequn) {
        // 19. 下单要求 - 插入模板
        var tmplClicked = false;
        var tmplByTitle = document.querySelectorAll('[title="插入模板"]');
        if (tmplByTitle.length > 0) { tmplByTitle[0].click(); tmplClicked = true; }
        if (!tmplClicked) {
          var allSpans = document.querySelectorAll('span, div, a');
          for (var ts = 0; ts < allSpans.length; ts++) {
            if ((allSpans[ts].textContent || '').trim() === '插入模板') { allSpans[ts].click(); tmplClicked = true; break; }
          }
        }
        if (tmplClicked) {
          await sleep(800);
          var mallPlatform = (item.mall || '').indexOf('京东') >= 0 ? 'jd' : 'taobao';
          var dialogIframe = document.querySelector('.edui-dialog.edui-for-subsidy iframe, .edui-dialog-content iframe');
          if (dialogIframe) {
            try {
              var iframeDoc = dialogIframe.contentDocument || dialogIframe.contentWindow.document;
              var platformItems = iframeDoc.querySelectorAll('.platform-item');
              for (var pi = 0; pi < platformItems.length; pi++) {
                if (platformItems[pi].dataset.platform === mallPlatform) { platformItems[pi].click(); subsidyLog('✓ 模板: ' + mallPlatform); break; }
              }
            } catch (e) {}
          }
        }

        await sleep(300);

        // 20. 订单审核自动生成（第二个"自动生成"按钮）
        subsidyMon('S19_TMPL_DONE', snapState());
        var autoGenBtns2 = document.querySelectorAll('button');
        var genCount2 = 0;
        for (var gi2 = 0; gi2 < autoGenBtns2.length; gi2++) {
          if ((autoGenBtns2[gi2].textContent || '').trim() === '自动生成') {
            genCount2++;
            if (genCount2 === 2) { autoGenBtns2[gi2].click(); subsidyLog('✓ 订单审核'); break; }
          }
        }
        await sleep(500);
      } else {
        subsidyLog('社群模式：跳过插入模板/订单审核(app-only区块)');
      }

      // 18(延后). 活动规则 - runInPage 注入。内部总时长控制在16s内(外层25s)，
      // 实时把诊断写到 holder 的 data-diag，即使 RUN_TIMEOUT 也能读到卡在哪。
      // 优先直接遍历 UE.instants 找 activity_rules 对应实例(不只 getEditor)。
      // 社群场景：a完成→立即提交b时，form页加载完成到此处仅1-2s，UEditor尚未初始化。
      // 多等2s给UE初始化，确保tryBtn能找到按钮+正确渲染富文本（避免写成HTML源码）。
      if (isShequn) { await sleep(2000); }
      if (!tokenValid()) { subsidyMon('ABORT_STALE', { at: 'before_actrule2' }); return; }
      var actRuleResult = await runInPage([
        'var __myTok = ' + myToken + ';',
        'var __h2 = document.getElementById(__RUNID__);',
        'var _diagArr = [];',
        'function diag(s){ _diagArr.push(s); if(__h2) __h2.setAttribute("data-diag", _diagArr.join(" | ")); }',
        'function tokBad(){ return window.__tpFillToken && window.__tpFillToken !== __myTok; }',
        'function getUE(){',
        '  try {',
        '    if (window.UE && window.UE.getEditor) { var e = window.UE.getEditor("activity_rules"); if (e) return e; }',
        '    if (window.UE && window.UE.instants) { for (var k in window.UE.instants){ var ins=window.UE.instants[k]; if(ins && ins.key==="activity_rules") return ins; } }',
        '  } catch(e){}',
        '  return null;',
        '}',
        // 找 activity_rules 对应的 UEditor iframe body（编辑区真实内容，不依赖 window.UE）。
        // 策略：① id=ueditor_0 的 IFRAME；② 扫全部 iframe 找 body[contenteditable]/designMode=on（最可靠，与DOM结构无关）；③ 从 textarea 向上爬到 .edui-editor 容器再找 iframe；④ 向上暴力爬10层。
        'function getEditorIframeDoc(){',
        '  try {',
        '    var f = document.getElementById("ueditor_0");',
        '    if (f && f.tagName === "IFRAME" && f.contentDocument && f.contentDocument.body) return f.contentDocument;',
        '    var allIframes = document.querySelectorAll("iframe");',
        '    for (var ii=0; ii<allIframes.length; ii++){',
        '      try { var doc=allIframes[ii].contentDocument; if(!doc||!doc.body)continue;',
        '        if(doc.body.getAttribute("contenteditable")!==null||doc.designMode==="on") return doc;',
        '      } catch(e){}',
        '    }',
        '    var ta = document.getElementById("activity_rules");',
        '    var box = ta ? ta.closest(".edui-editor, .edui-default") : null;',
        '    if (box) { var ifr=box.querySelector("iframe"); if(ifr&&ifr.contentDocument&&ifr.contentDocument.body) return ifr.contentDocument; }',
        '    var node = ta ? ta.parentElement : null;',
        '    for (var lvl=0; lvl<10 && node; lvl++){',
        '      var ifr2=node.querySelector("iframe"); if(ifr2&&ifr2.contentDocument&&ifr2.contentDocument.body) return ifr2.contentDocument;',
        '      node=node.parentElement;',
        '    }',
        '  } catch(e){}',
        '  return null;',
        '}',
        // 判断是否已有内容：优先看 UEditor iframe body（真实内容），再看 textarea，再看 window.UE。
        'function hasContent(){',
        '  try { var d=getEditorIframeDoc(); if(d && d.body && (d.body.innerText||"").trim().length>0) return true; } catch(e){}',
        '  try{var ue=getUE();return ue&&ue.hasContents?ue.hasContents():false;}catch(e){return false;}',
        '}',
        // 写入活动规则：① UE setContent；② 直接写 iframe body（不写 textarea，避免显示HTML源码）
        'function trySetContent(){',
        '  if (typeof generateActivityRules !== "function") return false;',
        '  var rules = generateActivityRules();',
        '  if (!rules) return false;',
        '  var done = false;',
        '  try { var ue = getUE(); if (ue && typeof ue.setContent === "function") { ue.setContent(rules); done = true; } } catch(e){}',
        '  try {',
        '    var d = getEditorIframeDoc();',
        '    if (d && d.body) { d.body.innerHTML = rules; done = true; }',
        '  } catch(e){}',
        '  return done;',
        '}',
        'var tries=0;',
        'function tryDirect(){',
        '  if (tokBad()) { __done("aborted-stale"); return; }',
        '  tries++;',
        '  try {',
        '    var ue = getUE();',
        '    var _ifd = getEditorIframeDoc();',
        '    if (tries === 1) {',
        '      var _ifAll = document.querySelectorAll("iframe");',
        '      var _ifInfo = Array.prototype.slice.call(_ifAll).map(function(f,i){',
        '        try { var doc=f.contentDocument; return i+":id="+f.id+",ce="+(doc&&doc.body?doc.body.getAttribute("contenteditable"):"X")+",dm="+(doc?doc.designMode:"X"); } catch(e){ return i+":err"; }',
        '      });',
        '      diag("iframes["+_ifAll.length+"]="+_ifInfo.join(";"));',
        '    }',
        '    diag("t"+tries+" ue="+(ue?1:0)+" rdy="+(ue&&ue.isReady?1:0)+" ifr="+(_ifd?1:0)+" gen="+(typeof generateActivityRules));',
        '    var setOk = trySetContent();',
        '    diag("t"+tries+" setOk="+setOk);',
        '    if (setOk) {',
        '      return setTimeout(function(){',
        '        if (hasContent()) { __done("ok direct tries=" + tries); return; }',
        '        diag("t"+tries+" setButEmpty");',
        '        if (tries < 5) { setTimeout(tryDirect, 500); } else { __done("fail setButEmpty"); }',
        '      }, 400);',
        '    }',
        '  } catch(e) { diag("err:"+e.message); }',
        '  if (tries < 5) { setTimeout(tryDirect, 500); } else { __done("fail no-iframe tries="+tries); }',
        '}',
        // 社群/非社群统一走 tryDirect()。
        // UE.getEditor 强制初始化，ready 回调后 iframe 已就绪，tryDirect 第一次即成功。
        'function waitForIframeAndRun(){',
        '  if (tokBad()) { __done("aborted-stale"); return; }',
        '  var ifd = getEditorIframeDoc();',
        '  if (ifd) { diag("iframe ready, start direct"); tryDirect(); return; }',
        '  diag("no iframe, force init UE via getEditor");',
        '  try {',
        '    if (window.UE && window.UE.getEditor) {',
        '      var ue = window.UE.getEditor("activity_rules");',
        '      if (ue) {',
        '        ue.ready(function(){',
        '          diag("UE ready callback");',
        '          tryDirect();',
        '        });',
        '        return;',
        '      }',
        '    }',
        '  } catch(e){ diag("UE.getEditor err:"+e.message); }',
        '  diag("UE not available, tryDirect anyway");',
        '  tryDirect();',
        '}',
        'waitForIframeAndRun();'
      ].join('\n'), 15000);
      subsidyMon('ACTRULE_RESULT', { result: actRuleResult });
      subsidyLog(actRuleResult.indexOf('ok') >= 0 ? '✓ 活动规则已填充 (' + actRuleResult + ')' : '⚠ 活动规则: ' + actRuleResult);
      subsidyMon('AFTER_ACTRULE_SNAP', snapState());

      await sleep(500);
      subsidyMon('S20_ORDERAUDIT_DONE', snapState());
      // 提交前最终令牌校验：若已有更新的运行接管，本(旧)运行绝不能点下一步提交，否则提交半成品表单
      if (!tokenValid()) { subsidyMon('ABORT_STALE', { at: 'before_next' }); return; }

      // 21. 点击"下一步"按钮，处理"确认下一步"弹窗，等待跳转到字段配置页
      var nextBtn = null;
      var allBtns = document.querySelectorAll('button');
      for (var nb = 0; nb < allBtns.length; nb++) {
        if ((allBtns[nb].textContent || '').trim() === '下一步' && allBtns[nb].offsetParent !== null) { nextBtn = allBtns[nb]; break; }
      }
      if (nextBtn) {
        // 提交前抓一次真实状态：分辨"从没设置成功" vs "设置成功但提交前被清"
        subsidyMon('BEFORE_NEXT_SNAP', snapState());
        var doNextClick = async function() {
          nextBtn.click();
          subsidyLog('✓ 已点击下一步');
          // 等待"确认下一步"弹窗按钮出现（最多 5s），或直接跳转
          for (var cw = 0; cw < 10; cw++) {
            await sleep(500);
            var confirmBtn = document.querySelector('.btn-confirm-next');
            if (confirmBtn && confirmBtn.offsetParent !== null) {
              confirmBtn.click();
              subsidyLog('✓ 已点击确认下一步');
              return true;
            }
            if (location.pathname.indexOf('form_name') < 0) return true; // 直接跳转了
          }
          return false;
        };
        await doNextClick();
        // 等待离开 form_name 页，最多 10s
        var jumped = false;
        for (var wn = 0; wn < 20; wn++) {
          await sleep(500);
          if (location.pathname.indexOf('form_name') < 0) { jumped = true; break; }
        }
        if (!jumped) {
          subsidyLog('未跳转，重试点击下一步...');
          await doNextClick();
          for (var wn2 = 0; wn2 < 10; wn2++) {
            await sleep(500);
            if (location.pathname.indexOf('form_name') < 0) { jumped = true; break; }
          }
        }
        if (!jumped) {
          subsidyLog('✗ 点击下一步后仍未跳转，请手动点击下一步');
        } else {
          // SPA 路由跳转成功，直接继续执行第二页
          subsidyLog('下一步跳转成功，继续执行字段配置页...');
          await sleep(1000);
          await processSubsidyQueue();
        }
      } else { subsidyLog('✗ 未找到下一步按钮'); }
    }

    async function fillSubsidyFormPage2() {
      subsidyLog('第二页：配置字段...');
      await sleep(1000);

      // 先检查页面上是否已有订单截图字段（避免重复添加）
      var existingRows = document.querySelectorAll('select');
      var alreadyHasOrderPic = false;
      for (var er = 0; er < existingRows.length; er++) {
        var sel = existingRows[er];
        // 跳过底部新增区域（没有删除按钮的那行）：检查同行是否有删除按钮
        var row = sel.closest('tr, [class*="row"], [class*="item"], li');
        if (!row) continue;
        var hasDelete = row.querySelector('button, a, span') &&
          Array.from(row.querySelectorAll('button, a, span')).some(function(b){ return (b.textContent||'').trim().indexOf('删除') >= 0; });
        if (!hasDelete) continue;
        if (sel.value === 'order_pic' || (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text.indexOf('订单截图') >= 0)) {
          alreadyHasOrderPic = true;
          subsidyLog('已存在订单截图字段，跳过新增');
          break;
        }
      }

      if (!alreadyHasOrderPic) {
        // 1. 找底部新增区域的字段类型 select，选"订单截图"
        var allSelects = document.querySelectorAll('select');
        var fieldTypeSelect = null;
        for (var fs = allSelects.length - 1; fs >= 0; fs--) {
          var hasOrderPic = Array.from(allSelects[fs].options).some(function(o){ return o.value === 'order_pic' || o.value === 'radio'; });
          if (hasOrderPic) { fieldTypeSelect = allSelects[fs]; break; }
        }
        if (fieldTypeSelect) {
          var opts = fieldTypeSelect.options;
          var found = false;
          for (var fo = 0; fo < opts.length; fo++) {
            if (opts[fo].value === 'order_pic' || opts[fo].text.indexOf('订单截图') >= 0) {
              fieldTypeSelect.value = opts[fo].value;
              fieldTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
              found = true;
              subsidyLog('✓ 字段类型: ' + opts[fo].text);
              break;
            }
          }
          if (!found) subsidyLog('✗ 未找到订单截图选项');
        } else { subsidyLog('✗ 未找到字段类型select'); }

        await sleep(300);

        // 2. 点击"新增字段"按钮
        var btns2 = document.querySelectorAll('button, a, input[type="button"], span');
        for (var ab = 0; ab < btns2.length; ab++) {
          var btnText = (btns2[ab].textContent || btns2[ab].value || '').trim();
          if (btnText.indexOf('新增字段') >= 0) {
            btns2[ab].click();
            subsidyLog('✓ 已点击新增字段');
            break;
          }
        }

        // 3. 等待页面刷新（alert 已被 unsafeWindow 覆盖自动消失）
        await sleep(1500);
      }

      // 4. 勾选已添加行（有删除按钮的行）里最后一个未勾的"是否必填" checkbox
      var allRows = document.querySelectorAll('tr, [class*="row"], [class*="field-item"]');
      var targetCb = null;
      for (var ri = allRows.length - 1; ri >= 0; ri--) {
        var row = allRows[ri];
        var hasDelete = Array.from(row.querySelectorAll('button, a, span')).some(function(b){ return (b.textContent||'').trim().indexOf('删除') >= 0; });
        if (!hasDelete) continue;
        var cb = row.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) { targetCb = cb; break; }
      }
      if (targetCb) {
        targetCb.click();
        subsidyLog('✓ 已勾选必填');
      } else {
        // 兜底：找最后一个未勾 checkbox（排除 tuopin-checkbox 自身）
        var allCbs = document.querySelectorAll('input[type="checkbox"]:not(.tuopin-checkbox)');
        for (var rc = allCbs.length - 1; rc >= 0; rc--) {
          if (!allCbs[rc].checked) { allCbs[rc].click(); subsidyLog('✓ 已勾选必填(兜底)'); break; }
        }
      }

      await sleep(300);

      // 点击"保存更新"按钮（本页保存后会刷新本页、无跳转无成功提示）
      var saveBtn = null;
      var btns3 = document.querySelectorAll('button, input[type="submit"], a');
      for (var sb = 0; sb < btns3.length; sb++) {
        var sbText = (btns3[sb].textContent || btns3[sb].value || '').trim();
        if (sbText.indexOf('保存更新') >= 0) { saveBtn = btns3[sb]; break; }
      }
      if (!saveBtn) {
        subsidyLog('✗ 未找到保存更新按钮');
        return;
      }

      // 关键：点保存前先推进索引 + 记录当前表单ID。
      // 因为点保存会刷新本页，click 之后的代码（含跳转）会随页面销毁而丢失，
      // 所以必须在 click 之前把进度落盘。
      var fIdMatch = location.href.match(/form_id[=\/](\d+)/) || location.href.match(/\/(\d{3,})(?:[\/?#]|$)/);
      var fId = fIdMatch ? fIdMatch[1] : '';
      GM_setValue('tuopin_subsidy_saved_formid', fId);
      GM_setValue('tuopin_subsidy_index', subsidyIdx + 1);
      // 保存表单链接，供面板展示
      if (fId) {
        var curItemForUrl = subsidyQueue[subsidyIdx];
        var formUrl = 'http://biaodan.bgm.smzdm.com/biaodan/form_name/' + fId;
        if (curItemForUrl && curItemForUrl.articleId) {
          var formUrlMap = {};
          try { formUrlMap = JSON.parse(GM_getValue('tuopin_subsidy_form_urls', '{}')); } catch(e) {}
          formUrlMap[String(curItemForUrl.articleId)] = formUrl;
          GM_setValue('tuopin_subsidy_form_urls', JSON.stringify(formUrlMap));
        }
        // 社群补贴：记录当天本地创建的表单（链接+商品名），跨天自动清空
        if (curItemForUrl && curItemForUrl.type === 'shequn') {
          try {
            var todayKey = (function(){ var d = new Date(); var p = function(n){return n<10?'0'+n:''+n;}; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); })();
            var todayRec = {};
            try { todayRec = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
            if (todayRec.date !== todayKey) todayRec = { date: todayKey, list: [] };
            var lst = todayRec.list || [];
            var exists = false;
            for (var ri = 0; ri < lst.length; ri++) { if (lst[ri].url === formUrl) { exists = true; break; } }
            if (!exists) {
              lst.push({
                url: formUrl,
                name: (curItemForUrl.title || '').slice(0, 40),
                time: (function(){ var d = new Date(); var p = function(n){return n<10?'0'+n:''+n;}; return p(d.getHours())+':'+p(d.getMinutes()); })(),
                articleId: String(curItemForUrl.articleId || ''),
                formId: String(fId || '')
              });
              todayRec.list = lst;
              GM_setValue('tuopin_shequn_today_forms', JSON.stringify(todayRec));
            }
          } catch(e) {}
        }
      }
      // 记录该文章已补贴（供汇总面板状态显示）
      try {
        var doneArr = JSON.parse(GM_getValue('tuopin_subsidy_done', '[]'));
        var curItem = subsidyQueue[subsidyIdx];
        if (curItem && curItem.articleId && doneArr.indexOf(String(curItem.articleId)) < 0) {
          doneArr.push(String(curItem.articleId));
          GM_setValue('tuopin_subsidy_done', JSON.stringify(doneArr));
        }
      } catch (e) {}
      subsidyLog('✓ 表单 ' + (subsidyIdx + 1) + '/' + subsidyQueue.length + ' 点击保存更新（保存一次即推进下一个）');
      saveBtn.click();
      // 给保存请求一点时间；若本页未刷新，再主动跳列表页
      await sleep(2000);
      tuopinGo('/biaodan/subsidies_list_ver3');
    }

    var __subsidyRunning = false;
    async function processSubsidyQueue() {
      if (__subsidyRunning) return;
      __subsidyRunning = true;
      try { await _processSubsidyQueueInner(); } finally { __subsidyRunning = false; }
    }

    // item2: 通过 .copy-wx-shortlink-btn[data-biaodan-key] + ajax_wx_miniprogram_short_link 接口
    // 为当天社群记录补充小程序短链（沿用 5.5.7 机制）。列表页加载时异步补一次。
    if (location.pathname.indexOf('subsidies_list') >= 0) {
      (function patchWxLinks() {
        var rec = {};
        try { rec = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
        var lst = rec.list || [];
        var missing = lst.filter(function(it) {
          if (it.wxLink) return false;
          var fid = it.formId || (it.url && it.url.match(/\/(\d+)\/?$/) ? it.url.match(/\/(\d+)\/?$/)[1] : '');
          return !!fid;
        });
        if (!missing.length) return;
        missing.forEach(function(entry) {
          var fid = entry.formId || (entry.url && entry.url.match(/\/(\d+)\/?$/) ? entry.url.match(/\/(\d+)\/?$/)[1] : '');
          var row = document.querySelector('input[type="checkbox"][value="' + fid + '"]');
          if (!row) return;
          var tr = row.closest('tr');
          if (!tr) return;
          var btn = tr.querySelector('.copy-wx-shortlink-btn[data-biaodan-key]');
          if (!btn) return;
          var key = btn.getAttribute('data-biaodan-key');
          GM_xmlhttpRequest({
            method: 'POST',
            url: 'http://biaodan.bgm.smzdm.com/biaodan/ajax_wx_miniprogram_short_link',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            data: 'biaodan_key=' + key,
            onload: function(r) {
              try {
                var resp = JSON.parse(r.responseText);
                if (resp && resp.error_code === 0 && resp.data && resp.data.link) {
                  var rec2 = {};
                  try { rec2 = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
                  var lst2 = rec2.list || [];
                  for (var k = 0; k < lst2.length; k++) {
                    var kfid = lst2[k].formId || (lst2[k].url && lst2[k].url.match(/\/(\d+)\/?$/) ? lst2[k].url.match(/\/(\d+)\/?$/)[1] : '');
                    if (kfid === fid) { lst2[k].wxLink = resp.data.link; if (!lst2[k].formId) lst2[k].formId = fid; break; }
                  }
                  rec2.list = lst2;
                  GM_setValue('tuopin_shequn_today_forms', JSON.stringify(rec2));
                }
              } catch(e) {}
            }
          });
        });
      })();
    }
    async function _processSubsidyQueueInner() {
      var currentQueue = [];
      try { currentQueue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
      if (!currentQueue || currentQueue.length === 0) return;

      // 每次都用最新索引，防止跨页跳转时 subsidyIdx 闭包值过期
      var idx = parseInt(GM_getValue('tuopin_subsidy_index', '0')) || 0;
      // 全部完成：清空队列并提示（保留 publish_results，让汇总面板继续展示"已补贴"状态）
      if (idx >= currentQueue.length) {
        GM_setValue('tuopin_subsidy_queue', '[]');
        GM_setValue('tuopin_subsidy_index', 0);
        GM_setValue('tuopin_subsidy_saved_formid', '');
        subsidyLog('✓ 全部 ' + currentQueue.length + ' 个补贴表单处理完成！');
        buildSummaryPanel();
        if (window.__tuopinRenderSummary) window.__tuopinRenderSummary();
        createSubsidyPanel();
        var progressEl2 = document.getElementById('tuopin-subsidy-progress');
        if (progressEl2) progressEl2.textContent = '全部完成！共 ' + currentQueue.length + ' 个';
        return;
      }
      // 同步到模块级变量，供 fillSubsidyFormPage2 等使用
      subsidyIdx = idx;

      buildSummaryPanel();
      if (window.__tuopinRenderSummary) window.__tuopinRenderSummary();
      createSubsidyPanel();
      var item = currentQueue[subsidyIdx];
      var progressEl = document.getElementById('tuopin-subsidy-progress');
      if (progressEl) progressEl.textContent = '处理 ' + (subsidyIdx + 1) + '/' + currentQueue.length + ': ' + (item.title || '').slice(0, 20);
      subsidyLog('文章ID: ' + item.articleId + ' 补贴: ' + item.subsidy + '元');

      // 在列表页 → 点击新建按钮，开始本品的完整流程
      if (location.pathname.indexOf('subsidies_list') >= 0) {
        // 若社群记录缺小程序链接，逐条补充（沿用 5.5.7：copy-wx-shortlink-btn + ajax 接口）
        try {
          var todayRec2 = {};
          try { todayRec2 = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
          var lst2 = todayRec2.list || [];
          var needSave2 = false;
          for (var wi = 0; wi < lst2.length; wi++) {
            var entry = lst2[wi];
            if (entry.wxLink) continue;
            var entryFid = entry.formId || (entry.url && entry.url.match(/\/(\d+)\/?$/) ? entry.url.match(/\/(\d+)\/?$/)[1] : '');
            if (!entryFid) continue;
            var bkBtn2 = null;
            var bkRow2 = document.querySelector('input[type="checkbox"][value="' + entryFid + '"]');
            if (bkRow2) {
              var bkTr2 = bkRow2.closest('tr');
              if (bkTr2) bkBtn2 = bkTr2.querySelector('.copy-wx-shortlink-btn[data-biaodan-key]');
            }
            if (!bkBtn2) continue;
            var bkKey2 = bkBtn2.getAttribute('data-biaodan-key');
            try {
              var wxResp2 = await new Promise(function(resolve) {
                GM_xmlhttpRequest({
                  method: 'POST',
                  url: 'http://biaodan.bgm.smzdm.com/biaodan/ajax_wx_miniprogram_short_link',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  data: 'biaodan_key=' + bkKey2,
                  onload: function(r) { try { resolve(JSON.parse(r.responseText)); } catch(e) { resolve(null); } },
                  onerror: function() { resolve(null); }
                });
              });
              if (wxResp2 && wxResp2.error_code === 0 && wxResp2.data && wxResp2.data.link) {
                lst2[wi].wxLink = wxResp2.data.link;
                if (!lst2[wi].formId) lst2[wi].formId = entryFid;
                needSave2 = true;
              }
            } catch(e) {}
          }
          if (needSave2) {
            todayRec2.list = lst2;
            GM_setValue('tuopin_shequn_today_forms', JSON.stringify(todayRec2));
          }
        } catch(e) {}
        subsidyLog('在列表页，查找新建按钮...');
        await sleep(2000);
        // 找到文本含"新建机审补贴购表单"的最内层可点击元素（a / button / .el-button）
        var allEls = document.querySelectorAll('a, button, .el-button, span, div');
        var target = null;
        for (var i = 0; i < allEls.length; i++) {
          var el = allEls[i];
          var txt = (el.textContent || '').trim();
          if (txt.indexOf('新建机审补贴购表单') < 0) continue;
          // 选最内层：该元素内部不再含有同样文字的子元素
          var hasInner = false;
          var inner = el.querySelectorAll('a, button, .el-button, span, div');
          for (var j = 0; j < inner.length; j++) {
            if ((inner[j].textContent || '').indexOf('新建机审补贴购表单') >= 0) { hasInner = true; break; }
          }
          if (!hasInner) { target = el; break; }
        }
        // 优先取可点击祖先（a/button/.el-button）
        var clickTarget = target;
        if (target && !/^(A|BUTTON)$/.test(target.tagName) && !target.classList.contains('el-button')) {
          var anc = target.closest('a, button, .el-button');
          if (anc) clickTarget = anc;
        }
        if (clickTarget) {
          // 若是 <a> 且有 href，记下来兜底直接导航
          var aEl = clickTarget.tagName === 'A' ? clickTarget : (clickTarget.closest ? clickTarget.closest('a') : null);
          var href = aEl ? aEl.getAttribute('href') : '';
          // 站点新建按钮是 <a target="_blank">，点击会新开标签页导致流程断裂（新标签无 runId 被拦）。
          // 强制在当前标签页跳转：优先用 href 直接 tuopinGo（带 runId），否则去掉 target 再 click。
          if (href && href !== '#' && href.indexOf('javascript') !== 0) {
            subsidyLog('✓ 找到新建按钮，当前页打开表单（避免新开标签）');
            if (href.indexOf('http') === 0) tuopinGo(href);
            else tuopinGo(href.indexOf('/') === 0 ? href : '/biaodan/' + href);
            return;
          }
          try { if (aEl) aEl.target = '_self'; if (clickTarget.target) clickTarget.target = '_self'; } catch (e) {}
          clickTarget.click();
          subsidyLog('✓ 已点击"新建机审补贴购表单"，等待跳转...');
          // 等待是否离开列表页；没跳转则用 href 兜底导航
          var navigated = false;
          for (var w = 0; w < 12; w++) {
            await sleep(500);
            if (location.pathname.indexOf('subsidies_list') < 0) { navigated = true; break; }
          }
          if (!navigated && href) {
            subsidyLog('点击未跳转，使用链接直接打开表单页');
            if (href.indexOf('http') === 0) tuopinGo(href);
            else tuopinGo(href.indexOf('/') === 0 ? href : '/biaodan/' + href);
          } else if (!navigated) {
            subsidyLog('✗ 点击后未跳转且无链接，请手动点击新建按钮');
          } else {
            // SPA 路由跳转成功（不触发 load 事件），直接继续执行
            subsidyLog('SPA 跳转成功，继续执行...');
            await sleep(1000);
            await processSubsidyQueue();
          }
        } else {
          subsidyLog('✗ 未找到"新建机审补贴购表单"按钮');
          subsidyLog('请手动点击新建按钮，脚本将在表单页自动填写');
        }
        return;
      }

      // 在表单第一页 → 填写表单（标题、价格、文案等）
      if (location.pathname.indexOf('form_name') >= 0 || location.search.indexOf('type=4') >= 0) {
        await fillSubsidyForm(item);
        return;
      }

      // 在表单第二页（字段配置页）→ 执行第二页逻辑（含保存更新 + 推进下一个品）
      var isPage2 = location.pathname.indexOf('form_field') >= 0 || location.pathname.indexOf('form_type') >= 0 || location.search.indexOf('step=2') >= 0;
      if (isPage2) {
        // 若本表单已点过保存（保存导致本页刷新又回到 page2），不再重复保存，直接跳列表页建下一个
        var curFidMatch = location.href.match(/form_id[=\/](\d+)/) || location.href.match(/\/(\d{3,})(?:[\/?#]|$)/);
        var curFid = curFidMatch ? curFidMatch[1] : '';
        var savedFid = GM_getValue('tuopin_subsidy_saved_formid', '');
        if (curFid && curFid === savedFid) {
          subsidyLog('表单 ' + curFid + ' 已保存，跳列表页继续下一个');
          GM_setValue('tuopin_subsidy_saved_formid', '');
          await sleep(800);
          tuopinGo('/biaodan/subsidies_list_ver3');
          return;
        }
        await fillSubsidyFormPage2();
        return;
      }

      subsidyLog('当前页面非列表/表单页，等待跳转...');
      await sleep(2000);
      tuopinGo('/biaodan/subsidies_list_ver3');
    }

    if (document.readyState === 'complete') {
      processSubsidyQueue();
    } else {
      window.addEventListener('load', processSubsidyQueue);
    }
    return;
  }
  // ===== END 补贴表单逻辑 =====


  // ===== 内容优化（www.smzdm.com/p/* 文章页）：场景词 → mind-pad 生成 4 条场景提示词 → 图生图 → 图生视频 =====
  if (location.hostname === 'www.smzdm.com' && location.pathname.indexOf('/p/') === 0) {
    (function setupContentOptimize() {
      if (document.getElementById('tuopin-co-panel')) return;

      var CO_KEY = 'tuopin_aigc_key';            // gw-openapi Bearer key
      var coImgMeta = [];
      var MINDPAD = 'https://mindpad-bgm.smzdm.com';
      var GW = 'https://gw-openapi-bgm.smzdm.com';
      var SUPERSET = 'https://bi-superset-bgm.smzdm.com';
      var SUPERSET_DB = 406; // 默认值，运行时从 relay 按登录名覆盖
      var IMG_MODELS = [
        'img_1_2_20250922_v3',   // 即梦图片编辑 5.0
        'img_7_2_20260114_v1'    // GPT Image 1.5
      ];
      var IMG_MODEL_NAMES = ['即梦5.0', 'GPT1.5'];
      var IMG_RES = '512px';
      // 6张图各自的拍摄角度，确保多角度出图
      // 6个分镜头，idx 0-5 一一对应，剪辑时按顺序拼接即成完整视频
      var IMG_ANGLES = [
        '【镜头1·开场建立】电影级广角远景，商品静置于精心布置的场景中，环境光柔和，景深悠长，镜头缓慢推进，氛围感强烈，留白充裕，电影开场质感',
        '【镜头2·动态入场】中景，人手或道具自然优雅地伸入画面与商品互动，浅景深背景虚化，暖光侧逆光勾勒轮廓，镜头跟随动作微微移动，生活感与故事感并存',
        '【镜头3·产品特写】正面平视极致特写，商品充满画面，专业摄影级布光，冷暖对比光营造立体感，品牌与质感一览无余，电商硬广质感',
        '【镜头4·质感微距】电影微距镜头，聚焦商品最震撼的局部细节（纹理/截面/光泽/材质），背景完全虚化成奶油光斑，细节冲击力强，慢速推进感',
        '【镜头5·俯拍平铺】正上方垂直俯视，商品与道具精心平铺，构图饱满对称，色彩和谐，镜头缓缓旋转下压，俯拍电影感构图',
        '【镜头6·氛围收尾】斜侧45度低角度仰拍，商品有强烈空间纵深感，侧后方轮廓光勾勒边缘，烟雾或光晕氛围感，镜头缓慢拉远，电影收尾质感'
      ];
      var VID_MODELS = [
        { id: 'i2v_2_2_20260402_v3', name: 'Seedance2.0Fast', time: 5, res: '480p',  imgField: 'image_urls' },
        { id: 'i2v_6_2_20260325_v2', name: 'Keling',           time: 6, res: '1080p', imgField: 'image_urls' }
      ];
      var SRC_TAG = '_source=7b85549f29393c995e53907313141784';
      var CO_ARTICLE_ID = (function () { var m = location.pathname.match(/\/p\/(\d+)/); return m ? m[1] : '0'; })();
      var CO_SESSION_KEY = 'tuopin_co_session_' + CO_ARTICLE_ID;   // 3h 内刷新免责恢复
      var CO_HIST_KEY = 'tuopin_co_history';

      // 参考图预取：页面加载时立即发 JSON API 请求，打开面板时直接用缓存
      // 两步串行：① ajax_get_article_detail 取焦点图+商品链接 → ② ajax_get_product_info 取商品图列表
      var coRefImgCache = null;
      var coRefImgCacheCallbacks = [];
      (function() {
        if (!CO_ARTICLE_ID || CO_ARTICLE_ID === '0') return;
        var _hdr = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' };
        function _done(imgs) {
          coRefImgCache = imgs;
          coRefImgCacheCallbacks.forEach(function(cb) { cb(imgs); });
          coRefImgCacheCallbacks = [];
        }
        function addRefImg(seen, imgs, u) {
          if (!u) return;
          u = u.trim().replace(/^http:/, 'https:');
          if (u && !seen[u]) { seen[u] = 1; imgs.push(u); }
        }
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'http://youhui.bgm.smzdm.com/youhui_action/ajax_get_article_detail',
          headers: _hdr,
          data: 'article_id=' + CO_ARTICLE_ID + '&channel_id=1',
          timeout: 10000,
          onload: function(r1) {
            var seen = {}, imgs = [], productUrl = '';
            try {
              var detail = JSON.parse(r1.responseText);
              if (detail.article_pic_url) addRefImg(seen, imgs, detail.article_pic_url);
              productUrl = detail.article_clean_link || detail.article_direct_link || '';
            } catch(e) {}
            if (!productUrl) { _done(imgs); return; }
            // 第二步：取商品图片列表（图片地址那个位置）
            GM_xmlhttpRequest({
              method: 'POST',
              url: 'http://youhui.bgm.smzdm.com/youhui_action/ajax_get_product_info',
              headers: _hdr,
              data: 'product_link=' + encodeURIComponent(productUrl) + '&article_id=' + CO_ARTICLE_ID + '&with_cache=1',
              timeout: 10000,
              onload: function(r2) {
                try {
                  var pi = JSON.parse(r2.responseText);
                  var list = (pi.data && pi.data.img_list) || [];
                  list.forEach(function(item) {
                    // 优先用已转存的 zdmimg，没有则用原图 URL
                    addRefImg(seen, imgs, item.pic_url || item.line_url);
                  });
                } catch(e) {}
                _done(imgs);
              },
              onerror: function() { _done(imgs); },
              ontimeout: function() { _done(imgs); }
            });
          },
          onerror: function() { _done([]); },
          ontimeout: function() { _done([]); }
        });
      })();

      function coLog(msg) {
        var box = document.getElementById('tuopin-co-log');
        if (box) { box.innerHTML += '<div>' + msg + '</div>'; box.scrollTop = box.scrollHeight; }
        console.log('[内容优化] ' + msg);
      }
      function coSetStatus(t) { var el = document.getElementById('tuopin-co-status'); if (el) el.textContent = t; }
      function coEsc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

      // 会话持久化（3h 内刷新/切换不丢结果）
      function coLoadSession() {
        try { return JSON.parse(GM_getValue(CO_SESSION_KEY, '{}')) || {}; } catch (e) { return {}; }
      }
      function coSaveSession(scene, prompts, images, videos, pendingTasks, pendingImgs) {
        GM_setValue(CO_SESSION_KEY, JSON.stringify({
          ts: Date.now(), scene: scene, prompts: prompts, images: images, videos: videos,
          pendingTasks: pendingTasks || [], pendingImgs: pendingImgs || []
        }));
      }
      // 历史归档（3 日内，压缩：图片一行、视频一行）
      function coSaveHistory(scene, prompts, images, videos) {
        try {
          var hist = JSON.parse(GM_getValue(CO_HIST_KEY, '[]'));
          var today = new Date().toISOString().slice(0, 10);
          // 同文章同天的记录覆盖，不追加
          hist = hist.filter(function(h) {
            return !(h.aid === CO_ARTICLE_ID && (h.date || '').slice(0, 10) === today);
          });
          hist.unshift({
            aid: CO_ARTICLE_ID, url: location.href,
            date: new Date().toISOString().slice(0, 16).replace('T', ' '),
            scene: scene, prompts: prompts, images: images, videos: videos
          });
          var cutoff = Date.now() - 3 * 864e5;
          hist = hist.filter(function (h) { return h.date && new Date(h.date.replace(' ', 'T')).getTime() > cutoff; });
          if (hist.length > 15) hist = hist.slice(0, 15);
          GM_setValue(CO_HIST_KEY, JSON.stringify(hist));
        } catch (e) {}
      }
      // 恢复按钮：绑定复制事件
      function coBindCopy(scope) {
        scope.querySelectorAll('.co-copy').forEach(function (b) {
          b.onclick = function () {
            var u = b.getAttribute('data-url');
            GM_setValue('tuopin_co_last_url', u);
            try { navigator.clipboard && navigator.clipboard.writeText(u); } catch (e) {}
            b.textContent = '已复制'; setTimeout(function () { b.textContent = '复制'; }, 1500);
          };
        });
      }
      function coUpdateConfirmBtn() {
        var panel2 = document.getElementById('tuopin-co-panel');
        if (!panel2) return;
        var imgChecked = panel2.querySelectorAll('#tuopin-co-images .co-select-cb:checked');
        var singleArea = document.getElementById('tuopin-co-single-img-area');
        if (singleArea) singleArea.style.display = (imgChecked.length === 1) ? '' : 'none';
        var multiArea = document.getElementById('tuopin-co-multi-img-area');
        if (multiArea) multiArea.style.display = (imgChecked.length > 1) ? '' : 'none';
      }
      // 用卡片 HTML 填充容器（图片/视频统一 2 列卡，左上角复选框）
      function coFillCards(box, urls, tag) {
        box.innerHTML = '';
        urls.forEach(function (url, idx) {
          var isVideo = /video|mp4|\.mov/i.test(url);
          var card = document.createElement('div');
          card.style.cssText = 'position:relative;border:1px solid #eee;border-radius:6px;padding:4px;font-size:10px;';
          card.setAttribute('data-co-url', url);
          if (isVideo) {
            card.innerHTML = coVidCardHtml(url, '已保存');
          } else {
            var cbId = 'co-cb-i' + idx;
            card.innerHTML = '<label for="' + cbId + '" style="position:absolute;top:6px;left:6px;z-index:2;cursor:pointer;">'
              + '<input type="checkbox" id="' + cbId + '" class="co-select-cb" data-url="' + url + '" style="width:14px;height:14px;accent-color:#ff7a00;cursor:pointer;"></label>'
              + '<img src="' + url + '" style="width:100%;border-radius:4px;display:block;margin-bottom:4px;">';
          }
          box.appendChild(card);
        });
        coBindCopy(box);
        coUpdateConfirmBtn();
      }
      // 生成视频卡 HTML（带 .co-vid-cb 复选框）
      function coVidCardHtml(vurl, label) {
        var cbId = 'co-vcb-' + Math.random().toString(36).slice(2, 9);
        return '<label for="' + cbId + '" style="position:absolute;top:6px;left:6px;z-index:2;cursor:pointer;">'
          + '<input type="checkbox" id="' + cbId + '" class="co-vid-cb" data-url="' + vurl + '" style="width:14px;height:14px;accent-color:#722ed1;cursor:pointer;"></label>'
          + '<video src="' + vurl + '" controls class="omni-processed" style="width:100%;border-radius:4px;margin-bottom:3px;display:block;"></video>'
          + '<div style="color:#bbb;font-size:9px;text-align:center;margin-bottom:2px;">' + coEsc(label) + '</div>'
          + '<div class="co-vid-actions" style="display:none;">'
          + '<button class="co-vid-focus" data-url="' + vurl + '" style="width:100%;padding:3px;background:#1890ff;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:9px;">设置为焦点图</button>'
          + '</div>';
      }
      // 渲染历史区（只展示当前文章的历史）
      function coRenderHistory() {
        var box = document.getElementById('tuopin-co-history');
        if (!box) return;
        var hist = [];
        try {
          var all = JSON.parse(GM_getValue(CO_HIST_KEY, '[]'));
          // 清理过期
          var cutoff = Date.now() - 3 * 864e5;
          all = all.filter(function (h) { return h.date && new Date(h.date.replace(' ', 'T')).getTime() > cutoff; });
          // 去重：同 aid + 同日期只保留最新一条（已按 unshift 顺序排，第一条最新）
          var seen = {};
          all = all.filter(function(h) {
            var key = (h.aid || '') + '_' + (h.date || '').slice(0, 10);
            if (seen[key]) return false;
            seen[key] = true; return true;
          });
          if (all.length > 15) all = all.slice(0, 15);
          GM_setValue(CO_HIST_KEY, JSON.stringify(all));
          // 只保留当前文章
          hist = all.filter(function (h) { return String(h.aid) === String(CO_ARTICLE_ID); });
        } catch (e) { hist = []; }
        if (!hist.length) { box.innerHTML = '<div style="color:#ccc;font-size:10px;">暂无历史记录</div>'; return; }
        var h = '<div style="color:#999;font-size:10px;margin-bottom:4px;">历史记录 (3日内)</div>';
        hist.forEach(function (entry, ei) {
          var eid = 'co-hist-' + ei;
          h += '<div style="border:1px solid #eee;border-radius:6px;padding:6px;margin-bottom:4px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:11px;color:#333;" onclick="var x=document.getElementById(\'' + eid + '-body\');var arr=this.querySelector(\'.co-arrow\');'
            + 'if(x.style.display===\'none\'){x.style.display=\'block\';arr.textContent=\'▲\';}else{x.style.display=\'none\';arr.textContent=\'▼\';}">'
            + '<span><b style="color:#ff7a00;">' + coEsc(entry.date) + '</b> ' + coEsc((entry.scene || '').slice(0, 15)) + '</span>'
            + '<span class="co-arrow" style="color:#999;font-size:10px;">▼</span></div>'
            + '<div id="' + eid + '-body" style="display:none;margin-top:4px;">';
          // 提示词
          if (entry.prompts && entry.prompts.length) {
            h += '<div style="font-size:10px;color:#666;margin-bottom:4px;">';
            entry.prompts.forEach(function (p, pi) { h += (pi + 1) + '. ' + coEsc(p.slice(0, 60)) + '<br>'; });
            h += '</div>';
          }
          // 图片行
          if (entry.images && entry.images.length) {
            h += '<div style="color:#999;font-size:9px;">图片</div>'
              + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:4px;">';
            entry.images.forEach(function (u) {
              h += '<a href="' + u + '" target="_blank"><img src="' + u + '" loading="lazy" style="width:100%;border-radius:4px;display:block;"></a>';
            });
            h += '</div>';
          }
          // 视频行
          if (entry.videos && entry.videos.length) {
            h += '<div style="color:#999;font-size:9px;">视频</div>'
              + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">';
            entry.videos.forEach(function (u) {
              h += '<video src="' + u + '" controls preload="none" style="width:100%;border-radius:4px;display:block;"></video>';
            });
            h += '</div>';
          }
          h += '</div></div>';
        });
        box.innerHTML = h;
      }

      // 提取文章头图：优先 og:image，否则取首张大图
      function coGetArticleImage() {
        var og = document.querySelector('meta[property="og:image"]') || document.querySelector('meta[name="og:image"]');
        if (og && og.content) return og.content;
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
          var w = imgs[i].naturalWidth || imgs[i].width || 0;
          if (w >= 300 && /smzdm|alicdn|zdmimg/.test(imgs[i].src)) return imgs[i].src;
        }
        for (var j = 0; j < imgs.length; j++) {
          if ((imgs[j].naturalWidth || imgs[j].width || 0) >= 300) return imgs[j].src;
        }
        return '';
      }
      // 取文章标题（用于生成提示词时锁定商品）
      function coGetArticleTitle() {
        var og = document.querySelector('meta[property="og:title"]');
        if (og && og.content) return og.content.trim();
        var h1 = document.querySelector('h1');
        if (h1 && h1.textContent) return h1.textContent.trim();
        var t = (document.title || '').trim();
        // 去掉站点后缀
        return t.replace(/\s*[—\-|]\s*什么值得买.*$/, '').trim();
      }

      // ===== 任务时段共享端点（commission-relay /taskslots，多同事防撞车）=====
      var RELAY = 'https://commission-bgm.agentdevops.zdm.net';
      var coSlotsCache = { date: '', slots: [], claimed: [] };
      // 用本地缓存的今日槽位数据预填，relay 回来后再覆盖（让 tab 打开即有数）
      try {
        var _slotsLocal = JSON.parse(GM_getValue('tuopin_slots_cache', '{}'));
        var _slotsToday = (function(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); })();
        if (_slotsLocal.date === _slotsToday && Array.isArray(_slotsLocal.slots)) {
          coSlotsCache = { date: _slotsLocal.date, slots: _slotsLocal.slots, claimed: _slotsLocal.claimed || [] };
        }
      } catch(e) {}
      var coImgModelIdx = 0; // 图生图选中模型索引（0=即梦5.0, 1=GPT），面板按钮切换
      function coTodayStr() {
        var d = new Date(); var p = function(n){return n<10?'0'+n:''+n;};
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      }
      function coNowStr() {
        var d = new Date(); var p = function(n){return n<10?'0'+n:''+n;};
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
      }
      // 解析 "YYYY-MM-DD HH:MM" 或 "YYYY-MM-DD HH:MM:SS" 为 Date
      function coParseTimeStr(s) {
        if (!s) return null;
        var m = (s+'').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (!m) return null;
        return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], 0, 0);
      }
      function coSlotsGet(cb) {
        var date = coTodayStr();
        GM_xmlhttpRequest({
          method: 'GET', url: RELAY + '/taskslots?date=' + encodeURIComponent(date), timeout: 4000,
          onload: function (r) { try { var j = JSON.parse(r.responseText); if (j.ok) { coSlotsCache = { date: date, slots: j.slots || [], claimed: j.claimed || [] }; } cb(j); } catch (e) { cb({ ok: false, error: e.message }); } },
          onerror: function () { cb({ ok: false, error: 'relay unreachable' }); },
          ontimeout: function () { cb({ ok: false, error: 'timeout' }); }
        });
      }
      function coSlotsSet(slots, cb) {
        GM_xmlhttpRequest({
          method: 'POST', url: RELAY + '/taskslots',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ date: coTodayStr(), slots: slots }), timeout: 8000,
          onload: function (r) { try { cb(JSON.parse(r.responseText)); } catch (e) { cb({ ok: false, error: e.message }); } },
          onerror: function () { cb({ ok: false, error: 'relay unreachable' }); },
          ontimeout: function () { cb({ ok: false, error: 'timeout' }); }
        });
      }
      function coSlotsClaim(startTime, who, info, cb) {
        GM_xmlhttpRequest({
          method: 'POST', url: RELAY + '/taskslots/claim',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(Object.assign({ date: coTodayStr(), startTime: startTime, who: who }, info || {})), timeout: 8000,
          onload: function (r) { try { cb(JSON.parse(r.responseText)); } catch (e) { cb({ ok: false, error: e.message }); } },
          onerror: function () { cb({ ok: false, error: 'relay unreachable' }); },
          ontimeout: function () { cb({ ok: false, error: 'timeout' }); }
        });
      }
      function coSlotsRelease(startTime, who, cb) {
        GM_xmlhttpRequest({
          method: 'POST', url: RELAY + '/taskslots/release',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ date: coTodayStr(), startTime: startTime, who: who }), timeout: 8000,
          onload: function (r) { try { cb(JSON.parse(r.responseText)); } catch (e) { cb({ ok: false, error: e.message }); } },
          onerror: function () { cb({ ok: false, error: 'relay unreachable' }); },
          ontimeout: function () { cb({ ok: false, error: 'timeout' }); }
        });
      }

      // SSE 解析：优先从 event:raw result 事件拿完整文本，降级用 text_delta 累积
      function coExtractContent(fullText) {
        // 1. 优先：找 event:raw + eventType:result 里的完整 result 字段
        var rawRe = /event:\s*raw[\s\S]*?"eventType"\s*:\s*"result"[\s\S]*?"result"\s*:\s*"((?:[^"\\]|\\.)*)"/;
        var rawM = rawRe.exec(fullText);
        if (rawM) {
          try { return JSON.parse('"' + rawM[1] + '"'); } catch(e) {}
        }
        // 2. 降级：累积所有 text_delta content 增量
        var acc = '';
        var re = /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        var m;
        while ((m = re.exec(fullText)) !== null) {
          try { acc += JSON.parse('"' + m[1] + '"'); } catch(e) { acc += m[1]; }
        }
        if (!acc) {
          var lines = fullText.split('\n');
          for (var i = 0; i < lines.length; i++) {
            if (/^[1-4][.、)]\s+/.test(lines[i].trim())) acc += lines[i].trim() + '\n';
          }
        }
        return acc;
      }
      function coIsDone(fullText) { return /event:\s*done/.test(fullText) || /\[DONE\]/.test(fullText); }

      // mindpad 对话生成提示词，首次新建专用会话并缓存，后续复用，失效再重建
      function coLlmChat(closeupWord, sceneWord, articleTitle, productImg, onDone, onError) {
        var CHATID_KEY = 'tuopin_co_chatid';
        var imgPart = productImg ? '商品图片URL：' + productImg + '\n' : '';

        // 根据填写情况组合任务描述
        var taskDesc;
        if (closeupWord && sceneWord) {
          taskDesc = '用户给定的特写词是：【' + closeupWord + '】，场景词是：【' + sceneWord + '】。'
            + '请在【' + sceneWord + '】的环境/场景背景下，以【' + closeupWord + '】为核心视觉风格，';
        } else if (closeupWord) {
          taskDesc = '用户给定的特写词是：【' + closeupWord + '】。'
            + '请聚焦商品本身的特写细节，以【' + closeupWord + '】为视觉风格，';
        } else {
          taskDesc = '用户给定的场景词是：【' + sceneWord + '】。'
            + '请根据该场景词，';
        }

        var message = '【独立请求】请忽略之前所有对话内容，这是一个全新的生成任务。\n'
          + imgPart
          + '你是一位专业商业影片导演，擅长用真实摄影语言让静态商品产生动感与空间感。\n'
          + (articleTitle ? '本次商品：【' + articleTitle + '】。\n' : '')
          + taskDesc
          + '生成 2 条适合图生视频的电影级运镜提示词，每条对应一段 6 秒商品展示短视频。\n\n'
          + '【生成规则】请依次分析并融合以下维度，输出一条完整连贯的提示词：\n'
          + '① 景别：根据商品大小和展示重点选择——极特写(放大商品最震撼的局部细节) 或 电影级广角(展示商品与环境的宏观关系)，或两者结合作为运镜起止点\n'
          + '② 拍摄角度：根据商品形态选择——包装类正面平视/斜侧俯拍；食材类低角仰拍突出食欲感；散件/铺陈类正上方垂直俯拍\n'
          + '③ 构图运动：基于商品构图特点设计运镜——产品居中则做缓慢推进或旋转环绕；多元素平铺则做从上到下扫描或旋转俯拍；局部特写则做从模糊到对焦的拉近\n'
          + '④ 运镜类型：推镜(dolly in)/拉镜(pull back)/环绕(orbit)/升降(crane)/旋转俯拍(top-down spin)/从虚到实对焦推进，根据场景选一种\n'
          + '⑤ 光影与色调：根据商品品类自动匹配——零食/糕点用暖金逆光+柔和焦外光斑；生鲜/饮品用冷白清透光；家居/电器用中性侧光勾勒轮廓；美妆用柔光+高饱和色彩定调\n\n'
          + '【强制要求】\n'
          + '• 商品始终是画面主角，出现在前景或中心\n'
          + '• 严禁改变商品外观、形状、包装、颜色、文字，商品必须与参考图完全一致\n'
          + '• 只描述镜头运动和光影氛围，不描述商品本身发生任何形态变化\n'
          + '• 不要增加热气、烟雾、蒸汽、火焰等特效，只做镜头的推进/环绕/升降等运镜\n'
          + '• 提示词必须全部用中文，禁止出现任何英文单词或拼音\n'
          + '• 每条 40-70 字，画面感、动态感、空间感强烈\n'
          + '• 单一连贯场景，严禁拼图/多格/分镜\n'
          + '• 不写品牌名，用品类通用词代替\n'
          + '• 参考示例风格：低角度镜头缓慢环绕推进，逆光勾勒出每一颗坚果仁的油润轮廓，后方虚化的茶壶与窗边绿植构成纵深层次，金色光尘在空气中浮动，食欲感饱满\n\n'
          + '输出格式（严格遵守，无多余内容）：\n1. <中文提示词1>\n2. <中文提示词2>';

        function createAndRun(doneCb, errCb) {
          GM_xmlhttpRequest({
            method: 'GET', url: MINDPAD + '/session/new?source=plugin&sourceRef=chrome_extension', timeout: 15000,
            onload: function(r) {
              var d; try { d = JSON.parse(r.responseText); } catch(e) { return errCb('解析失败'); }
              var data = (d && d.data) || d || {};
              var newId = data.chatId || data.sessionId || data.id || data.chat_id;
              if (!newId) return errCb('未获取 chatId');
              GM_setValue(CHATID_KEY, newId);
              coLog('✓ 新建专用会话 ' + newId);
              runChat(newId, doneCb, function() { errCb('会话异常，请重试'); });
            },
            onerror: function() { errCb('新建会话失败'); },
            ontimeout: function() { errCb('新建会话超时'); }
          });
        }

        var chatId = GM_getValue(CHATID_KEY, '');

        function runChat(id, doneCb, failCb) {
          var acc = '', finished = false;
          GM_setValue(CHATID_KEY, id);
          function finish() { if (finished) return; finished = true; doneCb(acc); }
          // POST /session/chat 直接返回 SSE 流，用 onprogress 逐块读取
          GM_xmlhttpRequest({
            method: 'POST',
            url: MINDPAD + '/session/chat?source=plugin&sourceRef=chrome_extension',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            data: JSON.stringify({ chatId: id, message: message, modelName: 'glm-5v-turbo', source: 'plugin', sourceRef: 'chrome_extension' }),
            timeout: 120000,
            onprogress: function(resp) {
              var full = resp.responseText || '';
              acc = coExtractContent(full);
              if (coIsDone(full)) finish();
            },
            onload: function(resp) {
              acc = coExtractContent(resp.responseText || '');
              if (!acc) { failCb('空响应'); return; }
              finish();
            },
            onerror: function() { failCb('SSE 连接失败'); },
            ontimeout: function() { finish(); }
          });
        }

        function reconnectChat(id, doneCb, failCb) {
          // 断线重连：GET subscribe 挂到正在运行的会话
          var acc = '', finished = false;
          function finish() { if (finished) return; finished = true; doneCb(acc); }
          GM_xmlhttpRequest({
            method: 'GET',
            url: MINDPAD + '/session/chat/subscribe?chatId=' + encodeURIComponent(id) + '&source=plugin&sourceRef=chrome_extension',
            headers: { 'Accept': 'text/event-stream' },
            timeout: 120000,
            onprogress: function(resp) {
              var full = resp.responseText || '';
              acc = coExtractContent(full);
              if (coIsDone(full)) finish();
            },
            onload: function(resp) {
              acc = coExtractContent(resp.responseText || '');
              finish();
            },
            onerror: function() { failCb('重连失败'); },
            ontimeout: function() { finish(); }
          });
        }

        // 每次都强制新建插件专用会话（不复用缓存，避免污染/误用用户当前会话）
        coLog('→ 新建插件专用会话 (source=plugin)...');
        createAndRun(onDone, onError);
      }

      // 图生图：提示词 + 商品图 → 图片 URL
      function coGetStyleSuffix(title) {
        var t = title || '';
        // 烧烤/熟食/卤味/烤肉
        if (/烤|卤|熏|炸|酱|腊|烧|扒|煎|焖|炖/.test(t)) {
          return '，商业美食摄影，暗调暖光背景，专业侧逆光布光，烟雾蒸汽感，油脂光泽，高清细节，实拍质感，8K';
        }
        // 生鲜肉类
        if (/牛|羊|猪|鸡|鸭|鹅|排骨|肋排|五花|里脊|肉/.test(t)) {
          return '，电商生鲜摄影，浅色干净背景，精准冷白光，肉质纹理清晰，截面粉嫩饱满，高清实拍，8K';
        }
        // 海鲜水产
        if (/鱼|虾|蟹|贝|蛤|蚌|海鲜|水产|鲜/.test(t)) {
          return '，电商生鲜摄影，冰面或浅蓝背景，清透补光，海鲜光泽感，鲜活质感，高清实拍，8K';
        }
        // 水果
        if (/苹果|梨|桃|李|杏|葡萄|橙|柠|芒|荔枝|龙眼|樱桃|草莓|蓝莓|西瓜|哈密|榴莲|猕猴桃|黄桃|水果/.test(t)) {
          return '，电商水果摄影，白色简洁背景，均匀柔光，色彩高饱和真实，截面汁水感，产品细节清晰，高清实拍，8K';
        }
        // 糕点甜品
        if (/蛋糕|饼|糕|酥|糖|巧克力|饼干|点心|甜品|布丁|慕斯/.test(t)) {
          return '，电商甜品摄影，浅色或木质背景，柔和自然光，层次质感细腻，糖霜奶油细节清晰，高清实拍，8K';
        }
        // 丸子/速食/火锅
        if (/丸|火锅|速食|方便|汤|锅|粉|面/.test(t)) {
          return '，电商美食摄影，深色餐桌背景，侧光暖调，热气腾腾，汤汁浓郁光泽，高清实拍，8K';
        }
        // 酒水
        if (/酒|白酒|红酒|啤酒|黄酒|葡萄酒|威士忌|洋酒|米酒|果酒/.test(t)) {
          return '，电商酒水摄影，深色大理石或木质背景，精致侧逆光，瓶身高光通透，酒液色泽饱满，奢华质感，高清实拍，8K';
        }
        // 饮料/果汁
        if (/饮料|果汁|汽水|可乐|茶饮|咖啡|奶茶|牛奶|豆浆|椰汁|功能饮|矿泉水|苏打水/.test(t)) {
          return '，电商饮品摄影，简洁白色或渐变背景，清透冰爽氛围，瓶身水珠冷凝感，液体色彩鲜亮通透，高清实拍，8K';
        }
        // 茶叶
        if (/茶|绿茶|红茶|乌龙|普洱|白茶|黑茶|花茶|茉莉|龙井|铁观音|大红袍/.test(t)) {
          return '，电商茶叶摄影，原木或麻布纹理背景，柔和自然光，茶叶形态清晰，茶汤色泽通透，中式禅意氛围，高清实拍，8K';
        }
        // 保健品/滋补
        if (/保健|滋补|营养|维生|胶囊|片剂|冲剂|燕窝|花胶|枸杞|红枣|阿胶|蜂蜜|人参|西洋参|灵芝/.test(t)) {
          return '，电商保健品摄影，浅色简洁背景，精致产品摆盘，原料食材点缀，光线柔和均匀，高端品质感，高清实拍，8K';
        }
        // 粮油调味
        if (/米|面|油|醋|酱油|盐|糖|淀粉|粮|杂粮|豆|花生|芝麻|调味|香料|辣椒|花椒/.test(t)) {
          return '，电商粮油摄影，白色或木质背景，柔和自然光，产品形态饱满真实，食材质感细腻，色彩还原准确，高清实拍，8K';
        }
        // 休闲食品/零食
        if (/零食|薯片|饼干|糖果|坚果|核桃|腰果|开心果|瓜子|花生|膨化|爆米花|肉脯|肉干|辣条|海苔/.test(t)) {
          return '，电商休闲食品摄影，活泼明亮背景，俯拍或斜45度，零食堆叠散落摆盘，色彩鲜艳诱人，产品细节清晰，高清实拍，8K';
        }
        // 通用食品兜底
        return '，电商商业摄影风格，背景干净简洁，精准专业布光，色彩饱和真实，产品细节清晰锐利，截面质感逼真，食欲感强，高清实拍质感，8K';
      }

      function coCreateImg(prompt, productImgs, idx, onOk, onErr) {
        var apiKey = GM_getValue(CO_KEY, '');
        if (!apiKey) { onErr('未配置 API Key'); return; }
        var imgUrls = [];
        var srcs = Array.isArray(productImgs) ? productImgs : (productImgs ? [productImgs] : []);
        srcs.forEach(function(u) { if (u) imgUrls.push(u + (u.indexOf('?') >= 0 ? '&' : '?') + SRC_TAG); });
        var title = coGetArticleTitle ? coGetArticleTitle() : '';
        var stylePrompt = prompt + coGetStyleSuffix(title);
        var modelIdx = coImgModelIdx % IMG_MODELS.length;
        // 两个模型都通过 prompt 强制 1:1，防止跟随参考图比例
        stylePrompt = '正方形画面，1:1比例构图，' + stylePrompt;
        var payload = {
          _api_key: apiKey,
          model: IMG_MODELS[modelIdx], prompt: stylePrompt,
          upload_img_config: { channel: 12, type: 'youhui', oper: 'aigc', public_host: 0 },
          image_urls: imgUrls
        };
        if (modelIdx === 0) {
          payload.resolution = IMG_RES;
          payload.aspect_ratio = '1:1';
        } else {
          payload.resolution = '1k'; // GPT 用 '1k'，同扩展保持一致
        }
        // 提交到 relay，relay 后台调 gw-openapi，不受浏览器刷新影响
        GM_xmlhttpRequest({
          method: 'POST', url: RELAY + '/pictures/submit',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(payload), timeout: 15000,
          onload: function(r) {
            try {
              var j = JSON.parse(r.responseText);
              if (!j.ok) return onErr(j.error || '提交失败');
              var taskId = j.task_id;
              // 轮询 relay 结果
              var n = 0;
              var itv = setInterval(function() {
                if (++n > 50) { clearInterval(itv); onErr('图片生成超时'); return; }
                GM_xmlhttpRequest({
                  method: 'GET', url: RELAY + '/pictures/result?task_id=' + taskId, timeout: 8000,
                  onload: function(r2) {
                    try {
                      var j2 = JSON.parse(r2.responseText);
                      if (!j2.ok) { clearInterval(itv); onErr(j2.error || '查询失败'); return; }
                      if (j2.status === 'done') {
                        clearInterval(itv);
                        // 把长链 hash_数字.ext 转成短链 hash.ext
                        var imgUrl = (j2.url || '').replace(/_\d+(\.[^.?]+)$/, '$1');
                        onOk(imgUrl);
                      }
                      else if (j2.status === 'error') { clearInterval(itv); onErr(j2.error || '生成失败'); }
                      // pending: 继续等
                    } catch(e) {}
                  },
                  onerror: function() {}, ontimeout: function() {}
                });
              }, 4000);
            } catch(e) { onErr('解析失败: ' + e.message); }
          },
          onerror: function() { onErr('relay 请求失败'); },
          ontimeout: function() { onErr('relay 超时'); }
        });
      }

      // 图生视频：多图 + 提示词 → 直接提交到 relay（image_urls 支持多图数组）
      function coSubmitVideo(prompt, imageUrls, modelIdx, onOk, onErr) {
        var apiKey = GM_getValue(CO_KEY, '');
        if (!apiKey) { onErr('未配置 API Key'); return; }
        var vm = VID_MODELS[modelIdx % VID_MODELS.length];
        var urls = imageUrls.map(function(u) { return u + (u.indexOf('?') >= 0 ? '&' : '?') + SRC_TAG; });
        var endpoint = RELAY + '/video/submit';
        coLog('▶ coSubmitVideo model=' + vm.id + ' imageUrls=' + urls.length + ' url[0]=' + (urls[0]||'').slice(0,60));
        GM_xmlhttpRequest({
          method: 'POST', url: endpoint,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ _api_key: apiKey, model: vm.id, prompt: prompt, video_time: vm.time, aspect_ratio: '1:1', resolution: vm.res, image_urls: urls }),
          timeout: 35000,
          onload: function (r) {
            try {
              var j = JSON.parse(r.responseText);
              if (!j.ok) return onErr(j.error || '提交失败');
              var tid = j.task_id;
              if (!tid) return onErr('无 task_id');
              onOk(tid, vm.id);
            } catch (e) { onErr('解析失败: ' + e.message); }
          },
          onerror: function () { onErr('relay 请求失败'); },
          ontimeout: function () { onErr('relay 超时'); }
        });
      }
      // 轮询视频状态：relay local task_id → video_url
      function coPollVideo(taskId, modelId, onDone, onErr) {
        var n = 0;
        var itv = setInterval(function () {
          if (++n > 150) { clearInterval(itv); onErr('轮询超时(10min)'); return; }
          GM_xmlhttpRequest({
            method: 'GET', url: RELAY + '/video/result?task_id=' + taskId, timeout: 8000,
            onload: function (r) {
              try {
                var j = JSON.parse(r.responseText);
                if (!j.ok) { clearInterval(itv); onErr(j.error || '查询失败'); return; }
                if (j.status === 'done') { clearInterval(itv); onDone(j.url); }
                else if (j.status === 'error') { clearInterval(itv); onErr(j.error || '视频生成失败'); }
                // pending: 继续等
              } catch (e) {}
            },
            onerror: function () {}, ontimeout: function () {}
          });
        }, 4000);
      }

      // 在当前页用隐藏 iframe 完成焦点图替换 + 加标签 + 保存
      function coDoConfirmInPage(imgUrl, articleId, onDone) {
        var editUrl = 'http://youhui.bgm.smzdm.com/edit_youhui/' + articleId;
        var iframe = (function() {
          var fr = document.createElement('iframe');
          fr.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;visibility:hidden;';
          fr.src = editUrl;
          document.body.appendChild(fr);
          return fr;
        })();
        function removeIframe() { try { if (document.body.contains(iframe)) document.body.removeChild(iframe); } catch(e) {} }
        var timeout = setTimeout(function () { removeIframe(); onDone(false, 'iframe 超时'); }, 60000);
        function doWork() {
          try {
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            function setV(el, val) {
              var nativeSet = Object.getOwnPropertyDescriptor(iframe.contentWindow.HTMLInputElement.prototype, 'value').set;
              nativeSet.call(el, val);
              el.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
              el.dispatchEvent(new iframe.contentWindow.Event('change', { bubbles: true }));
            }
            // 1. 填上传框 → 点上传 → 点"设为焦点图"
            function findUploadPair(d) {
              var btns = d.querySelectorAll('button, input[type="button"]');
              for (var bi = 0; bi < btns.length; bi++) {
                var bt = (btns[bi].textContent || btns[bi].value || '').trim();
                if (bt === '上传') {
                  var row = btns[bi].closest('tr') || btns[bi].parentElement;
                  if (row) { var inp = row.querySelector('input[type="text"]'); if (inp) return { input: inp, uploadBtn: btns[bi] }; }
                }
              }
              return null;
            }
            function findSetFocusBtn(d) {
              var btns = d.querySelectorAll('button, input[type="button"]');
              for (var bi = 0; bi < btns.length; bi++) {
                if ((btns[bi].textContent || btns[bi].value || '').trim() === '设为焦点图') return btns[bi];
              }
              return null;
            }
            var uploadPair = findUploadPair(doc);
            if (uploadPair) {
              setV(uploadPair.input, imgUrl);
              setTimeout(function () {
                try { uploadPair.uploadBtn.click(); } catch(e) {}
                setTimeout(function () {
                  try { var fb = findSetFocusBtn(doc); if (fb) fb.click(); } catch(e) {}
                }, 1200);
              }, 400);
            } else {
              // fallback: 直接填焦点图字段
              var focusInput = doc.querySelector('[name="article_pic_url"]');
              if (focusInput) {
                setV(focusInput, imgUrl);
                var container = focusInput.closest('tr') || (focusInput.parentElement && focusInput.parentElement.parentElement);
                if (container) {
                  var fBtns = container.querySelectorAll('button, input[type="button"]');
                  for (var i = 0; i < fBtns.length; i++) {
                    if ((fBtns[i].textContent.trim() === '获取' || fBtns[i].value === '获取') && fBtns[i].offsetParent !== null) {
                      fBtns[i].click(); break;
                    }
                  }
                }
              }
            }
            // 2. 加标签 "内容优化"
            setTimeout(function () {
              try {
                var tagInput = doc.querySelector('#tag_name');
                var addTagBtn = doc.querySelector('#add_new_tag');
                if (tagInput && addTagBtn) {
                  setV(tagInput, '内容优化');
                  setTimeout(function () { addTagBtn.click(); }, 300);
                }
              } catch(e) {}
              // 3. 循环点保存直到"保存成功"；若多次无反应则刷新重试一次
              setTimeout(function () {
                var tries = 0, reloaded = false;
                var itv = setInterval(function () {
                  try {
                    if (!doc || !doc.body) return; // iframe 刷新中，等待
                    var bodyText = doc.body.innerText || '';
                    if (bodyText.indexOf('保存成功') >= 0) {
                      clearInterval(itv); clearTimeout(timeout);
                      removeIframe();
                      onDone(true, '保存成功');
                      return;
                    }
                    if (tries++ > 12) {
                      if (!reloaded) {
                        reloaded = true;
                        clearInterval(itv); clearTimeout(timeout);
                        removeIframe();
                        coDoConfirmInPage(imgUrl, articleId, onDone);
                        return;
                      }
                      clearInterval(itv); clearTimeout(timeout);
                      removeIframe();
                      onDone(false, '保存超时');
                      return;
                    }
                    // 处理弹窗：优先"忽略提醒"，其次"确定/确认"，再处理 el-dialog / J_GlobalConfirm / blackout
                    var popBtns = doc.querySelectorAll('.boxy-btn3');
                    var popFound = false;
                    for (var j = 0; j < popBtns.length; j++) {
                      if (popBtns[j].offsetParent !== null) {
                        var b3v = popBtns[j].getAttribute('value') || '';
                        if (b3v.indexOf('忽略') >= 0) { popBtns[j].click(); popFound = true; break; }
                      }
                    }
                    if (!popFound) {
                      for (var jb = 0; jb < popBtns.length; jb++) {
                        if (popBtns[jb].offsetParent !== null) { popBtns[jb].click(); popFound = true; break; }
                      }
                    }
                    if (!popFound) {
                      var sel1 = doc.querySelector('.boxy-btn1');
                      if (sel1 && sel1.offsetParent !== null) { sel1.click(); popFound = true; }
                    }
                    if (!popFound) {
                      var layer0 = doc.querySelector('.layui-layer-btn0');
                      if (layer0 && layer0.offsetParent !== null) { layer0.click(); popFound = true; }
                    }
                    if (!popFound) {
                      var jc = doc.querySelector('a.J_GlobalConfirm');
                      if (jc && jc.offsetParent !== null) { jc.click(); popFound = true; }
                    }
                    if (!popFound) {
                      var blk = doc.querySelector('.boxy-modal-blackout');
                      if (blk && blk.offsetParent !== null) { blk.click(); popFound = true; }
                    }
                    if (!popFound) {
                      // Element UI dialog fallback
                      var elDlgs = doc.querySelectorAll('.el-dialog__wrapper, .el-message-box__wrapper');
                      for (var ed = 0; ed < elDlgs.length; ed++) {
                        if (elDlgs[ed].offsetParent !== null) {
                          var prim = elDlgs[ed].querySelector('.el-button--primary');
                          if (prim && prim.offsetParent !== null) { prim.click(); popFound = true; break; }
                        }
                      }
                    }
                    if (!popFound) {
                      // 通用兜底：确定/确认/忽略
                      var allBtns = doc.querySelectorAll('input[type="button"], input[type="submit"], button');
                      for (var j2 = 0; j2 < allBtns.length; j2++) {
                        var pv2 = (allBtns[j2].value || allBtns[j2].textContent || '').trim();
                        if ((pv2 === '确定' || pv2 === '确认' || pv2.indexOf('忽略') >= 0) && allBtns[j2].offsetParent !== null) {
                          allBtns[j2].click(); popFound = true; break;
                        }
                      }
                    }
                    if (popFound) return;
                    // 点保存修改
                    var btns = doc.querySelectorAll('button, input[type="button"], input[type="submit"]');
                    for (var k = 0; k < btns.length; k++) {
                      var t = (btns[k].textContent || '').trim() || btns[k].value || '';
                      if (t === '保存修改' && btns[k].offsetParent !== null) { btns[k].click(); break; }
                    }
                  } catch(e) {}
                }, 1500);
              }, 800);
            }, 600);
          } catch(e) {
            clearTimeout(timeout);
            removeIframe();
            onDone(false, e.message);
          }
        }
          iframe.onload = doWork;
      }

      // 解析模型输出的 4 条提示词：只取以 1/2/3/4 编号开头的行，过滤注意事项等非提示词内容
      function coParsePrompts(text) {
        var out = [];
        var lines = (text || '').split('\n');
        for (var i = 0; i < lines.length; i++) {
          var raw = lines[i].trim();
          if (!/^[1-2][.、)]\s+/.test(raw)) continue;
          var ln = raw.replace(/^[1-2][.、)]\s+/, '').trim();
          if (ln && ln.length > 10 && /[一-龥]/.test(ln)) out.push(ln + '不改变商品形态');
        }
        return out.slice(-2);
      }

      // 面板
      function build() {
        var coCollapsed = GM_getValue('tuopin_co_collapsed', '') === '1';
        var coArrow = coCollapsed ? '▶' : '▼';
        var panel = document.createElement('div');
        panel.id = 'tuopin-co-panel';
        panel.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:10px;width:270px;font-family:-apple-system,sans-serif;font-size:13px;';
        var coIsAdmin = false; // 由 SSO 异步确认是否为 handongxue
        // 两级 tab：大 tab → 小 tab 组
        var BIG_TABS = {
          subsidy: { label: '补贴优化', subtabs: ['shequn', 'optimize', 'sales'] },
          ops:     { label: '批量化运营', subtabs: ['task', 'inject', 'batch'] }
        };
        // 小 tab → 大 tab 反向映射（兼容旧 tuopin_active_tab 值）
        var SUB_TO_BIG = { shequn: 'subsidy', optimize: 'subsidy', sales: 'subsidy', task: 'ops', inject: 'ops', batch: 'ops' };
        var coActiveTab = GM_getValue('tuopin_active_tab', 'optimize');
        if (!SUB_TO_BIG[coActiveTab]) coActiveTab = 'optimize';   // 未知值兜底
        // 大 tab 由当前小 tab 所属组反推（sales 已从 ops 迁到 subsidy，旧存储自动迁移）
        var coActiveBigTab = SUB_TO_BIG[coActiveTab];
        if (!BIG_TABS[coActiveBigTab]) coActiveBigTab = 'subsidy';
        // 若记忆的小 tab 不属于当前大 tab，回退到该大 tab 第一个小 tab
        if (BIG_TABS[coActiveBigTab].subtabs.indexOf(coActiveTab) < 0) {
          coActiveTab = BIG_TABS[coActiveBigTab].subtabs[0];
        }
        // datetime 工具：本地时间字符串转 datetime-local 值
        function coLocalDt(d) {
          var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
          return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        }
        var startDt = new Date(); startDt.setMinutes(startDt.getMinutes() + 1);
        var endDt = new Date(startDt); endDt.setMinutes(endDt.getMinutes() + 59);
        var tabBtnStyle = 'flex:1;padding:5px 0;border:none;background:none;cursor:pointer;font-size:12px;font-weight:600;';
        function tabStyle(key) { return tabBtnStyle + (coActiveTab===key ? 'color:#ff7a00;border-bottom:2px solid #ff7a00;margin-bottom:-2px;' : 'color:#999;'); }
        var bigTabBtnStyle = 'flex:1;padding:6px 0;border:none;background:none;cursor:pointer;font-size:13px;font-weight:700;';
        function bigTabStyle(key) { return bigTabBtnStyle + (coActiveBigTab===key ? 'color:#fff;background:#ff7a00;border-radius:4px;' : 'color:#999;background:#f5f5f5;border-radius:4px;'); }
        var h = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:' + (coCollapsed ? '0' : '4px') + ';">'
          + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<button id="tuopin-co-toggle" style="border:none;background:none;cursor:pointer;color:#666;font-size:11px;line-height:1;padding:0;">' + coArrow + '</button>'
          + '<span style="font-weight:600;color:#ff7a00;">拓品助手</span></div>'
          + '<span style="font-size:10px;color:#bbb;">折叠需手动展开</span></div>'
          + '<div id="tuopin-co-body" style="display:' + (coCollapsed ? 'none' : 'block') + ';">'
          // 大 tab 行
          + '<div style="display:flex;gap:4px;margin-bottom:6px;">'
          + '<button id="co-bigtab-subsidy" style="' + bigTabStyle('subsidy') + '">补贴优化</button>'
          + '<button id="co-bigtab-ops" style="' + bigTabStyle('ops') + '">批量化运营</button>'
          + '</div>'
          // 小 tab 行（按组显隐：非当前大 tab 组的按钮 display:none）
          + '<div style="display:flex;margin-bottom:8px;border-bottom:2px solid #f0f0f0;">'
          + '<button id="co-tab-btn-shequn" style="' + tabStyle('shequn') + (coActiveBigTab==='subsidy' ? '' : 'display:none;') + '">社群补贴</button>'
          + '<button id="co-tab-btn-optimize" style="' + tabStyle('optimize') + (coActiveBigTab==='subsidy' ? '' : 'display:none;') + '">内容优化</button>'
          + '<button id="co-tab-btn-sales" style="' + tabStyle('sales') + (coActiveBigTab==='subsidy' ? '' : 'display:none;') + '">销售数据</button>'
          + '<button id="co-tab-btn-task" style="' + tabStyle('task') + 'display:none;">任务</button>'
          + '<button id="co-tab-btn-inject" style="' + tabStyle('inject') + (coActiveBigTab==='ops' ? '' : 'display:none;') + '">代码植入</button>'
          + '<button id="co-tab-btn-batch" style="' + tabStyle('batch') + (coActiveBigTab==='ops' ? '' : 'display:none;') + '">好价批量</button>'
          + '</div>'
          + '<div id="co-tab-optimize" style="display:' + (coActiveTab==='optimize' ? 'block' : 'none') + ';">'
          + '<div style="display:flex;justify-content:flex-end;margin-bottom:4px;">'
          + '<span id="tuopin-co-cog" style="cursor:pointer;color:#999;font-size:12px;">⚙ Key</span></div>'
          + '<div id="tuopin-co-settings" style="display:none;margin-bottom:8px;padding:8px;background:#f9f9f9;border-radius:6px;">'
          + '<input id="tuopin-co-key" type="password" placeholder="gw-openapi Bearer Key" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;margin-bottom:4px;">'
          + '<button id="tuopin-co-savekey" style="width:100%;padding:5px;background:#1890ff;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;">保存 Key</button></div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">'
          + '<div><label style="color:#666;font-size:11px;">特写词</label>'
          + '<input id="tuopin-co-closeup" type="text" placeholder="如：美味有食欲" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<div><label style="color:#666;font-size:11px;">场景词</label>'
          + '<input id="tuopin-co-scene" type="text" placeholder="如：露营、聚会" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '</div>'
          + '<button id="tuopin-co-go" style="width:100%;padding:8px;background:#ff7a00;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px;">优化头图</button>'
          + '<div style="color:#999;font-size:10px;margin-bottom:4px;">参考图 <span style="color:#bbb;">（勾选后作为图生图参考）</span></div>'
          + '<div id="tuopin-co-refimg-area" style="border:1px dashed #ddd;border-radius:6px;padding:6px;margin-bottom:8px;background:#fafafa;">'
          + '<div id="tuopin-co-refimg-grid" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px;"></div>'
          + '<div style="display:flex;gap:4px;margin-top:4px;">'
          + '<label style="flex:1;padding:3px 6px;background:#fff;border:1px solid #ddd;border-radius:4px;font-size:11px;color:#666;cursor:pointer;text-align:center;">本地上传<input id="tuopin-co-refimg-file" type="file" accept="image/*" multiple style="display:none;"></label>'
          + '<input id="tuopin-co-refimg-url" type="text" placeholder="粘贴图片URL后回车" style="flex:2;padding:3px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">'
          + '</div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
          + '<div style="color:#999;font-size:10px;">图生图</div>'
          + '<div style="display:flex;gap:4px;">'
          + '<button id="co-img-model-0" data-midx="0" style="padding:2px 8px;border-radius:10px;border:1px solid #ff7a00;background:#ff7a00;color:#fff;font-size:10px;cursor:pointer;">即梦5.0</button>'
          + '<button id="co-img-model-1" data-midx="1" style="padding:2px 8px;border-radius:10px;border:1px solid #ddd;background:#fff;color:#999;font-size:10px;cursor:pointer;">GPT</button>'
          + '</div></div>'
          + '<div id="tuopin-co-images" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:4px;"></div>'
          + '<div id="tuopin-co-single-img-area" style="display:none;margin-bottom:4px;"><div style="display:flex;gap:6px;">'
          + '<button id="tuopin-co-use-focus-btn" style="flex:1;padding:6px;background:#52c41a;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">用于焦点图</button>'
          + '<button id="tuopin-co-use-video-btn" style="flex:1;padding:6px;background:#722ed1;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">用于视频生成</button>'
          + '</div></div>'
          + '<div id="tuopin-co-multi-img-area" style="display:none;margin-bottom:4px;"><div style="display:flex;gap:6px;">'
          + '<button id="tuopin-co-use-keyframe-btn" style="flex:1;padding:6px;background:#ff7a00;color:#fff;border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">用于视频关键帧</button>'
          + '</div></div>'
          + '<div id="tuopin-co-prompts" style="margin-bottom:8px;"></div>'
          + '<div style="color:#999;font-size:10px;margin-bottom:4px;">图生视频</div>'
          + '<div id="tuopin-co-videos" style="margin-bottom:8px;"></div>'
          + '<div style="display:none;"><button id="tuopin-co-confirm-vid-btn">▶</button></div>'
          + '<div id="tuopin-co-status" style="color:#1890ff;font-size:11px;margin-top:6px;"></div>'
          + '<div id="tuopin-co-log" style="max-height:90px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:6px;font-size:11px;line-height:1.5;color:#666;"></div>'
          + '<div id="tuopin-co-history" style="margin-top:8px;border-top:1px solid #eee;padding-top:6px;"></div>'
          + '</div>'
          // ── 销售数据 tab ──
          + '<div id="co-tab-sales" style="display:' + (coActiveTab==='sales' ? 'block' : 'none') + ';">'
          + '<div id="co-sales-content" style="font-size:11px;color:#666;">'
          + '<div style="text-align:center;color:#bbb;padding:20px 0;">加载中...</div>'
          + '</div>'
          + '<div id="co-sales-admin-panel" style="display:none;margin-top:10px;border-top:1px solid #f0f0f0;padding-top:8px;">'
          + '<div style="font-weight:600;color:#ff7a00;font-size:11px;margin-bottom:6px;">Superset DB ID 管理</div>'
          + '<div id="co-sales-dbids-display" style="background:#f5f5f5;border:1px solid #eee;border-radius:4px;padding:4px 6px;font-size:10px;color:#555;min-height:22px;margin-bottom:6px;line-height:1.8;"></div>'
          + '<div style="display:flex;gap:4px;margin-bottom:4px;">'
          + '<input id="co-sales-dbids-name" type="text" placeholder="用户名" style="flex:1;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">'
          + '<input id="co-sales-dbids-id" type="text" placeholder="database_id" style="width:80px;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">'
          + '<button id="co-sales-dbids-add" style="padding:3px 8px;background:#52c41a;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap;">添加</button>'
          + '</div>'
          + '<div style="display:flex;gap:4px;">'
          + '<select id="co-sales-dbids-del-sel" style="flex:1;padding:3px 5px;border:1px solid #ddd;border-radius:4px;font-size:11px;"></select>'
          + '<button id="co-sales-dbids-del" style="padding:3px 8px;background:#ff4d4f;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;white-space:nowrap;">删除</button>'
          + '</div>'
          + '<div id="co-sales-dbids-log" style="font-size:10px;color:#52c41a;margin-top:4px;"></div>'
          + '</div>'
          + '</div>'
          // ── 好价批量工具 tab（独立 tab）──
          + '<div id="co-tab-batch" style="display:' + (coActiveTab==='batch' ? 'block' : 'none') + ';padding:2px 0;">'
          + '<div style="font-weight:700;color:#ff7a00;font-size:13px;margin-bottom:10px;letter-spacing:.3px;">好价批量工具</div>'
          // 筛选条件卡片
          + '<div style="background:#f8f9fa;border-radius:6px;padding:8px 8px 8px;margin-bottom:8px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">'
          + '<span style="font-size:10px;font-weight:600;color:#888;letter-spacing:.2px;">筛选条件</span>'
          + '<button id="co-batch-manage-toggle" style="font-size:9px;color:#1890ff;border:none;background:none;cursor:pointer;padding:0;line-height:1;">管理选项 ▾</button>'
          + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:5px;">'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">一级品类</label>'
          + '<select id="co-batch-cate1" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;background:#fff;"></select></div>'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">二级品类</label>'
          + '<select id="co-batch-cate2" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;background:#fff;"></select></div>'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">商城</label>'
          + '<select id="co-batch-mall" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;background:#fff;"></select></div>'
          + '</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;">'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">频道</label>'
          + '<select id="co-batch-channel" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;background:#fff;"></select></div>'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">GMV≥</label>'
          + '<input id="co-batch-gmv" type="number" placeholder="5000" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;"></div>'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">CPS≥</label>'
          + '<input id="co-batch-cps" type="number" placeholder="200" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;"></div>'
          + '<div><label style="color:#888;font-size:9px;display:block;margin-bottom:2px;">佣比≥</label>'
          + '<input id="co-batch-rate" type="number" step="0.01" placeholder="0.08" style="width:100%;padding:4px 3px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;"></div>'
          + '</div>'
          // 管理选项折叠区（默认隐藏）
          + '<div id="co-batch-manage-area" style="display:none;border-top:1px solid #e8e8e8;margin-top:7px;padding-top:7px;">'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;">'
          + '<div><div style="font-size:9px;color:#aaa;margin-bottom:2px;">一级品类</div>'
          + '<div style="display:flex;gap:2px;"><input id="co-batch-cate1-input" type="text" placeholder="新增" style="flex:1;min-width:0;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:10px;box-sizing:border-box;"><button id="co-batch-cate1-add" style="padding:2px 6px;font-size:10px;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;flex-shrink:0;">+</button></div></div>'
          + '<div><div style="font-size:9px;color:#aaa;margin-bottom:2px;">二级品类</div>'
          + '<div style="display:flex;gap:2px;"><input id="co-batch-cate2-input" type="text" placeholder="新增" style="flex:1;min-width:0;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:10px;box-sizing:border-box;"><button id="co-batch-cate2-add" style="padding:2px 6px;font-size:10px;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;flex-shrink:0;">+</button></div></div>'
          + '<div><div style="font-size:9px;color:#aaa;margin-bottom:2px;">商城</div>'
          + '<div style="display:flex;gap:2px;"><input id="co-batch-mall-input" type="text" placeholder="新增" style="flex:1;min-width:0;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:10px;box-sizing:border-box;"><button id="co-batch-mall-add" style="padding:2px 6px;font-size:10px;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;flex-shrink:0;">+</button></div></div>'
          + '<div><div style="font-size:9px;color:#aaa;margin-bottom:2px;">频道</div>'
          + '<div style="display:flex;gap:2px;"><input id="co-batch-channel-input" type="text" placeholder="新增" style="flex:1;min-width:0;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:10px;box-sizing:border-box;"><button id="co-batch-channel-add" style="padding:2px 6px;font-size:10px;border:none;border-radius:3px;background:#1890ff;color:#fff;cursor:pointer;flex-shrink:0;">+</button></div></div>'
          + '</div>'
          + '</div>'
          + '</div>'
          + '<div id="co-batch-log" style="font-size:10px;color:#ff4d4f;margin-bottom:4px;min-height:14px;"></div>'
          // 查询结果区域（多任务时显示 tab，每个任务一个列表页）
          + '<div id="co-batch-results-wrap" style="display:none;margin-bottom:8px;">'
          + '<div id="co-batch-results-tabs" style="display:flex;gap:0;border-bottom:1px solid #e0e0e0;margin-bottom:0;overflow-x:auto;"></div>'
          + '<div id="co-batch-results-panels" style="max-height:120px;overflow-y:auto;font-size:10px;border:1px solid #eee;border-top:none;border-radius:0 0 4px 4px;background:#fafafa;padding:4px;"></div>'
          + '</div>'
          // 批量操作卡片
          + '<div style="background:#fff7f0;border:1px solid #ffe0b2;border-radius:6px;padding:8px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">'
          + '<div style="font-size:10px;font-weight:600;color:#ff7a00;">批量操作 <span id="co-batch-loginname" style="font-weight:400;color:#aaa;font-size:9px;"></span></div>'
          + '<button id="co-batch-perm-btn" style="display:none;font-size:9px;padding:1px 6px;border:1px solid #d0d0d0;border-radius:3px;background:#fff;color:#555;cursor:pointer;">权限管理</button>'
          + '</div>'
          + '<div id="co-batch-perm-panel" style="display:none;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;padding:6px;margin-bottom:8px;font-size:10px;">'
          + '<div style="color:#666;margin-bottom:4px;">设置用户可见的批量操作（管理员始终全权限）</div>'
          + '<div style="display:flex;gap:4px;margin-bottom:4px;">'
          + '<input id="co-perm-user" type="text" placeholder="用户名（SSO登录名）" style="flex:1;padding:3px 5px;border:1px solid #ddd;border-radius:3px;font-size:10px;">'
          + '</div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">'
          + '<label style="display:flex;align-items:center;gap:2px;"><input type="checkbox" class="co-perm-skill" value="精选"> 精选提优</label>'
          + '<label style="display:flex;align-items:center;gap:2px;"><input type="checkbox" class="co-perm-skill" value="回捞"> 回捞</label>'
          + '<label style="display:flex;align-items:center;gap:2px;"><input type="checkbox" class="co-perm-skill" value="发现"> 发现</label>'
          + '<label style="display:flex;align-items:center;gap:2px;"><input type="checkbox" class="co-perm-skill" value="加标签"> 加标签</label>'
          + '</div>'
          + '<div style="display:flex;gap:4px;align-items:center;">'
          + '<button id="co-perm-save" style="padding:2px 10px;background:#ff7a00;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;">保存</button>'
          + '<button id="co-perm-del" style="padding:2px 10px;background:#fff;color:#ff4d4f;border:1px solid #ff4d4f;border-radius:3px;cursor:pointer;font-size:10px;">删除</button>'
          + '<span id="co-perm-status" style="color:#aaa;font-size:9px;"></span>'
          + '</div>'
          + '<div id="co-perm-list" style="margin-top:6px;border-top:1px solid #f0f0f0;padding-top:4px;"></div>'
          + '</div>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">'
          + '<label style="font-size:11px;color:#555;display:flex;align-items:center;gap:3px;cursor:pointer;"><input type="checkbox" class="co-batch-skill" value="精选" style="accent-color:#ff7a00;"> 精选提优</label>'
          + '<label style="font-size:11px;color:#555;display:flex;align-items:center;gap:3px;cursor:pointer;"><input type="checkbox" class="co-batch-skill" value="回捞" style="accent-color:#ff7a00;"> 回捞</label>'
          + '<label style="font-size:11px;color:#555;display:flex;align-items:center;gap:3px;cursor:pointer;"><input type="checkbox" class="co-batch-skill" value="发现" style="accent-color:#ff7a00;"> 发现</label>'
          + '<label style="font-size:11px;color:#555;display:flex;align-items:center;gap:3px;cursor:pointer;"><input type="checkbox" class="co-batch-skill" value="加标签" style="accent-color:#ff7a00;"> 加标签</label>'
          + '</div>'
          + '<div id="co-batch-sync-skip-wrap" style="display:none;margin-bottom:8px;">'
          + '<div style="font-size:10px;color:#666;margin-bottom:3px;">同步首页时间晚于以下时间则跳过（选填）</div>'
          + '<input id="co-batch-sync-skip-time" type="datetime-local" style="width:100%;padding:3px 4px;border:1px solid #e0e0e0;border-radius:4px;font-size:10px;box-sizing:border-box;">'
          + '</div>'
          + '<div id="co-batch-tag-wrap" style="display:none;margin-bottom:8px;">'
          + '<input id="co-batch-tag-input" type="text" placeholder="标签名，多个用逗号分隔，如：今日必买,白菜党" style="width:100%;padding:5px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;">'
          + '</div>'
          + '<button id="co-batch-run" style="width:100%;padding:7px;background:#ff7a00;color:#fff;border:none;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;">执行选中操作</button>'
          + '<div id="co-batch-run-log" style="font-size:10px;color:#52c41a;margin-top:4px;min-height:14px;"></div>'
          + '<div id="co-batch-activetasks" style="margin-top:4px;"></div>'
          + '<div id="co-batch-history" style="margin-top:6px;"></div>'
          + '</div>'
          + '</div>'
          // ── 社群补贴 tab ──
          + '<div id="co-tab-shequn" style="display:' + (coActiveTab==='shequn' ? 'block' : 'none') + ';">'
          + '<div style="margin-bottom:6px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">商品名称</label>'
          + '<input id="tuopin-shequn-goodsname" type="text" placeholder="自动填充，可编辑" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<div style="margin-bottom:6px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">商品干净链接</label>'
          + '<input id="tuopin-shequn-cleanlink" type="text" placeholder="自动填充，可编辑" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<div style="display:flex;gap:6px;margin-bottom:6px;">'
          + '<div style="flex:1;min-width:0;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">补贴金额（元）</label>'
          + '<input id="tuopin-shequn-amount" type="number" min="0" step="0.1" placeholder="如：3" style="width:100%;padding:5px 4px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<div style="flex:1;min-width:0;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">到手总价（元）</label>'
          + '<input id="tuopin-shequn-totalprice" type="number" min="0" step="0.01" placeholder="总价" style="width:100%;padding:5px 4px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<div style="flex:1;min-width:0;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">到手单价（元）</label>'
          + '<input id="tuopin-shequn-unitprice" type="number" min="0" step="0.01" placeholder="单价" style="width:100%;padding:5px 4px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '</div>'
          + '<div style="margin-bottom:6px;font-size:11px;line-height:1.8;">'
          + '<span style="color:#666;">佣比：</span><span id="shequn-comm-rate" style="color:#52c41a;font-weight:600;">-</span>'
          + '<span style="color:#666;margin-left:12px;">订单佣金：</span><span id="shequn-comm-amt" style="color:#52c41a;font-weight:600;">-</span>'
          + '</div>'
          + '<div style="margin-bottom:6px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">渠道Code</label>'
          + '<input id="tuopin-shequn-code" type="text" placeholder="请填写code" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<div style="margin-bottom:10px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">邮箱</label>'
          + '<input id="tuopin-shequn-email" type="text" placeholder="负责人邮箱" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;"></div>'
          + '<button id="tuopin-shequn-go" style="width:100%;padding:8px;background:#ff7a00;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">社群补贴</button>'
          + '<div id="tuopin-shequn-log" style="margin-top:6px;font-size:11px;color:#1890ff;"></div>'
          + '<div id="tuopin-shequn-today" style="margin-top:8px;border-top:1px dashed #ffcc80;padding-top:6px;">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
          + '<span style="font-size:10px;color:#ff7a00;font-weight:600;">今日补贴明细（本地）</span>'
          + '<button id="tuopin-shequn-today-clear" style="font-size:10px;border:1px solid #ff4d4f;border-radius:3px;background:#fff;color:#ff4d4f;cursor:pointer;padding:0 6px;">清空</button>'
          + '</div>'
          + '<div id="tuopin-shequn-today-list" style="max-height:200px;overflow-y:auto;font-size:10px;line-height:1.6;"></div>'
          + '</div>'
          + '</div>'
          // ── 代码植入 tab ──
          + '<div id="co-tab-inject" style="display:' + (coActiveTab==='inject' ? 'block' : 'none') + ';">'
          + '<textarea id="tuopin-inject-code" rows="7" style="width:100%;padding:5px;border:1px solid #ddd;border-radius:4px;font-size:10px;box-sizing:border-box;resize:vertical;font-family:monospace;" placeholder="粘贴要植入的 HTML 代码"></textarea>'
          + '<button id="tuopin-inject-go" style="width:100%;padding:7px;background:#1890ff;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;margin-top:6px;">植入代码</button>'
          + '<div id="tuopin-inject-log" style="margin-top:6px;max-height:60px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:6px;font-size:11px;line-height:1.5;color:#666;"></div>'
          + '<div id="tuopin-inject-history" style="margin-top:8px;border-top:1px solid #eee;padding-top:6px;max-height:120px;overflow-y:auto;"></div>'
          + '</div>'
          // ── 任务 tab ──
          + '<div id="co-tab-task" style="display:' + (coActiveTab==='task' ? 'block' : 'none') + ';">'
          + '<div style="margin-bottom:8px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">文章链接</label>'
          + '<input id="tuopin-task-arturl" type="text" value="https://www.smzdm.com/p/' + CO_ARTICLE_ID + '/" style="width:100%;padding:4px 5px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"></div>'
          + '<div id="tuopin-task-remain" style="font-size:11px;color:#999;margin-bottom:2px;text-align:center;">今日还剩 <span id="tuopin-task-remain-num" style="color:#ff4d4f;font-weight:600;">0</span> 个点赞收藏任务可配置</div>'
          + '<div id="tuopin-task-next-slot" style="font-size:10px;color:#666;margin-bottom:6px;text-align:center;">最近可配置：<span id="tuopin-task-next-slot-val" style="color:#1890ff;">—</span></div>'
          + '<button id="tuopin-task-go" style="width:100%;padding:7px;background:#ff7a00;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;">发布任务</button>'
          + '<div id="tuopin-task-log" style="margin-top:6px;font-size:11px;color:#1890ff;"></div>'
          + '<div id="tuopin-task-admin-panel" style="display:' + (coIsAdmin ? 'block' : 'none') + ';margin-top:8px;border-top:2px dashed #ffcc80;padding-top:8px;">'
          + '<div style="font-size:10px;color:#ff7a00;font-weight:600;margin-bottom:6px;">🔒 管理员专属</div>'
          + '<div style="margin-bottom:8px;">'
          + '<div style="display:flex;align-items:center;gap:3px;margin-bottom:4px;">'
          + '<label style="color:#666;font-size:11px;white-space:nowrap;width:36px;flex-shrink:0;">活动ID</label>'
          + '<select id="tuopin-task-actid-sel" style="flex:0 0 58px;padding:2px 3px;border:1px solid #ddd;border-radius:4px;font-size:11px;"></select>'
          + '<input id="tuopin-task-actid-input" type="text" placeholder="新增" style="flex:1;min-width:0;padding:2px 4px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">'
          + '<button id="tuopin-task-actid-add" style="padding:2px 5px;font-size:10px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;flex-shrink:0;">+</button>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:3px;">'
          + '<label style="color:#666;font-size:11px;white-space:nowrap;width:36px;flex-shrink:0;">奖励ID</label>'
          + '<select id="tuopin-task-rewardid-sel" style="flex:0 0 58px;padding:2px 3px;border:1px solid #ddd;border-radius:4px;font-size:11px;"></select>'
          + '<input id="tuopin-task-rewardid-input" type="text" placeholder="新增" style="flex:1;min-width:0;padding:2px 4px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">'
          + '<button id="tuopin-task-rewardid-add" style="padding:2px 5px;font-size:10px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;flex-shrink:0;">+</button>'
          + '</div>'
          + '</div>'
          + '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;display:block;margin-bottom:3px;">今日时间排序</label>'
          + '<div id="tuopin-task-slot-display" style="max-height:40px;overflow-y:auto;border:1px solid #f0f0f0;border-radius:4px;padding:3px 5px;margin-bottom:5px;background:#fafafa;"></div>'
          + '<div id="tuopin-task-slot-edit" style="display:none;">'
          + '<textarea id="tuopin-task-timesort" rows="4" placeholder="每行：开始<Tab>结束\n10:00:00\t11:00:00" style="width:100%;padding:4px;border:1px solid #ddd;border-radius:4px;font-size:10px;box-sizing:border-box;resize:vertical;font-family:monospace;"></textarea>'
          + '</div>'
          + '<div style="display:flex;gap:4px;margin-top:4px;">'
          + '<button id="tuopin-task-slot-edit-btn" style="flex:1;padding:5px;background:#fff;color:#666;border:1px solid #ddd;border-radius:4px;font-size:11px;cursor:pointer;">编辑</button>'
          + '<button id="tuopin-task-slot-confirm-btn" style="flex:1;padding:5px;background:#52c41a;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;">确定</button>'
          + '</div>'
          + '<div id="tuopin-task-sortlog" style="font-size:10px;color:#52c41a;margin-top:3px;"></div>'
          + '</div>'
          + '<div style="margin-top:10px;border-top:1px dashed #ffcc80;padding-top:6px;">'
          + '<div style="font-size:10px;color:#ff7a00;font-weight:600;margin-bottom:4px;">今日各时段配置情况（全同事）</div>'
          + '<div id="tuopin-task-done-today" style="max-height:260px;overflow-y:auto;font-size:10px;color:#666;"></div>'
          + '</div>'
          + '<div style="margin-top:10px;border-top:1px dashed #ffcc80;padding-top:6px;">'
          + '<div style="font-size:10px;color:#ff7a00;font-weight:600;margin-bottom:6px;">任务权限名单</div>'
          + '<div style="font-size:10px;color:#999;margin-bottom:4px;">当前名单：</div>'
          + '<div id="tuopin-task-whitelist-display" style="background:#f5f5f5;border:1px solid #eee;border-radius:4px;padding:4px 6px;font-size:10px;color:#555;min-height:24px;margin-bottom:8px;line-height:1.8;"></div>'
          + '<div style="margin-bottom:6px;">'
          + '<div style="font-size:10px;color:#1890ff;font-weight:600;margin-bottom:4px;">增加权限</div>'
          + '<div style="display:flex;gap:4px;">'
          + '<input id="tuopin-task-wl-add-input" type="text" placeholder="输入用户名" style="flex:1;min-width:0;padding:3px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;">'
          + '<button id="tuopin-task-wl-add-btn" style="padding:3px 8px;background:#1890ff;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;flex-shrink:0;">添加</button>'
          + '</div>'
          + '</div>'
          + '<div>'
          + '<div style="font-size:10px;color:#ff4d4f;font-weight:600;margin-bottom:4px;">删除权限</div>'
          + '<div style="display:flex;gap:4px;">'
          + '<select id="tuopin-task-wl-del-sel" style="flex:1;min-width:0;padding:3px 4px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;"></select>'
          + '<button id="tuopin-task-wl-del-btn" style="padding:3px 8px;background:#ff4d4f;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;flex-shrink:0;">删除</button>'
          + '</div>'
          + '</div>'
          + '<div id="tuopin-task-whitelist-log" style="font-size:10px;color:#52c41a;margin-top:5px;"></div>'
          + '</div></div>'
          + '</div>';
        panel.innerHTML = h;
        getRightStack().appendChild(panel);
        // 面板构建完成后，立即补一次版本更新徽标（若远端已有新版）
        if (window.__tuopinApplyUpdateBadge) window.__tuopinApplyUpdateBadge();

        var _salesDbReady = false;
        var _taskOk = false;  // SSO 确认有任务权限后置 true，coSwitchBigTab 用此值而不依赖 GM 缓存

        // 用上次缓存的 loginName 先立刻判断任务 tab 可见性，无需等 SSO 返回
        (function() {
          var cachedName = GM_getValue('tuopin_my_name', '');
          if (!cachedName) return;
          var wlCache2 = {};
          try { wlCache2 = JSON.parse(GM_getValue('tuopin_wl_cache', '{}')); } catch(e) {}
          var list2 = wlCache2.list || [];
          if (cachedName === 'handongxue' || list2.indexOf(cachedName) >= 0) {
            _taskOk = true;
            var taskTabBtn = document.getElementById('co-tab-btn-task');
            if (taskTabBtn && coActiveBigTab === 'ops') taskTabBtn.style.display = '';
          }
        })();

        // 异步请求 SSO 门户识别登录人，仅 handongxue 激活管理员模式，权限名单内用户显示任务 tab
        GM_xmlhttpRequest({
          method: 'GET', url: 'https://sso-bgm.smzdm.com/uas-sso/root/auth/app_list.action', timeout: 6000,
          onload: function(r) {
            try {
              var m = r.responseText.match(/欢\s*迎\s*([\w]+)登录/);
              if (!m) return;
              var loginName = m[1];
              // 识别到用户名，存起来供 claim 使用
              GM_setValue('tuopin_my_name', loginName);
              // 管理员
              if (loginName === 'handongxue') {
                coIsAdmin = true;
                _taskOk = true;
                var adminPanel = document.getElementById('tuopin-task-admin-panel');
                if (adminPanel) adminPanel.style.display = 'block';
                // 管理员在 ops 大 tab 下补显任务小 tab 按钮
                if (coActiveBigTab === 'ops') {
                  var _taskBtn = document.getElementById('co-tab-btn-task');
                  if (_taskBtn) _taskBtn.style.display = '';
                }
                // 从 relay 拉最新权限名单并初始化展示
                GM_xmlhttpRequest({
                  method: 'GET', url: RELAY + '/task/whitelist', timeout: 4000,
                  onload: function(wr) {
                    try {
                      var wd = JSON.parse(wr.responseText || '{}');
                      var wlList = wd.whitelist || [];
                      GM_setValue('tuopin_task_whitelist', JSON.stringify(wlList));
                      coWlRefresh(wlList);
                    } catch(e) {}
                  },
                  onerror: function() {
                    // fallback 本地
                    var wlList = [];
                    try { wlList = JSON.parse(GM_getValue('tuopin_task_whitelist', '[]')); } catch(e) {}
                    coWlRefresh(wlList);
                  }
                });
                // 管理员确认身份后：若 relay 今天还没有时段数据，自动把本地模式推送上去
                coSlotsGet(function(chk) {
                  if (chk.ok && !(chk.slots || []).length) {
                    var todayStr = coTodayStr();
                    var localPattern = [];
                    try { localPattern = JSON.parse(GM_getValue('tuopin_task_schedule','[]')); } catch(e){}
                    if (localPattern.length) {
                      var todaySlots = localPattern.map(function(s){
                        return {
                          startTime: todayStr + (s.startTime||'').slice(10),
                          endTime: todayStr + (s.endTime||'').slice(10)
                        };
                      });
                      coSlotsSet(todaySlots, function(res){
                        if (res.ok) { coRefreshSlots(); }
                      });
                    }
                  }
                });
              }
              // 白名单和 dbids 每天最多从 relay 拉取一次，缓存到本地
              var _today = coTodayStr();
              function applyWhitelist(taskWhitelist) {
                var canSeeTask = loginName === 'handongxue' || taskWhitelist.indexOf(loginName) >= 0;
                if (canSeeTask) {
                  _taskOk = true;
                  var taskTabBtn = document.getElementById('co-tab-btn-task');
                  if (taskTabBtn && coActiveBigTab === 'ops') taskTabBtn.style.display = '';
                }
              }
              function applyDbids(dbids) {
                if (dbids[loginName]) SUPERSET_DB = parseInt(dbids[loginName], 10);
                if (loginName === 'handongxue') {
                  var adminDbPanel = document.getElementById('co-sales-admin-panel');
                  if (adminDbPanel) { adminDbPanel.style.display = 'block'; coDbidsRefresh(dbids); }
                }
                // db 已就绪：销售数据查询在等它时由 coLoadSalesData 内部轮询自动放行
                _salesDbReady = true;
              }
              // 权限名单：有本地缓存就直接用，只有管理员增删名单时才会强制刷新缓存
              var wlCache = {};
              try { wlCache = JSON.parse(GM_getValue('tuopin_wl_cache', '{}')); } catch(e) {}
              var dbCache = {};
              try { dbCache = JSON.parse(GM_getValue('tuopin_dbids_cache', '{}')); } catch(e) {}

              if (wlCache.list) {
                applyWhitelist(wlCache.list);
              } else {
                GM_xmlhttpRequest({
                  method: 'GET', url: RELAY + '/task/whitelist', timeout: 4000,
                  onload: function(wr) {
                    var taskWhitelist = [];
                    try {
                      var wd = JSON.parse(wr.responseText || '{}');
                      taskWhitelist = wd.whitelist || [];
                      GM_setValue('tuopin_wl_cache', JSON.stringify({ list: taskWhitelist }));
                    } catch(e) {
                      taskWhitelist = (wlCache.list || []);
                    }
                    applyWhitelist(taskWhitelist);
                  },
                  onerror: function() { applyWhitelist(wlCache.list || []); }
                });
              }

              // 当前用户的 ID 已在今天缓存中 → 直接用（省去一次请求）
              // 否则（新加入的用户 / 缓存过期）→ 立刻从 relay 拉取，确保管理员刚添加的 ID 立即生效
              var dbidsCached = dbCache.date === _today && dbCache.dbids && dbCache.dbids[loginName];
              if (dbidsCached) {
                applyDbids(dbCache.dbids || {});
              } else {
                if (dbCache.dbids) applyDbids(dbCache.dbids); // 先用旧缓存初始化
                GM_xmlhttpRequest({
                  method: 'GET', url: RELAY + '/superset/dbids', timeout: 4000,
                  onload: function(dr) {
                    var dbids = {};
                    try {
                      var dd = JSON.parse(dr.responseText || '{}');
                      dbids = dd.dbids || {};
                      GM_setValue('tuopin_dbids_cache', JSON.stringify({ date: _today, dbids: dbids }));
                    } catch(e) {
                      dbids = (dbCache.dbids || {});
                    }
                    applyDbids(dbids);
                  },
                  onerror: function() { applyDbids(dbCache.dbids || {}); }
                });
              }
            } catch(e) {}
          },
          onerror: function() {}
        });

        // 折叠/展开（持久化：手动折叠后下次仍折叠，需手动展开）
        var coToggleBtn = document.getElementById('tuopin-co-toggle');
        if (coToggleBtn) coToggleBtn.onclick = function () {
          var now = GM_getValue('tuopin_co_collapsed', '') === '1';
          GM_setValue('tuopin_co_collapsed', now ? '' : '1');
          var body = document.getElementById('tuopin-co-body');
          if (body) body.style.display = now ? 'block' : 'none';
          coToggleBtn.textContent = now ? '▼' : '▶';
        };

        // ── Superset DB ID 管理（仅 handongxue 可见） ──
        var _coDbids = {};
        function coDbidsRefresh(dbids) {
          _coDbids = dbids || {};
          var display = document.getElementById('co-sales-dbids-display');
          var delSel = document.getElementById('co-sales-dbids-del-sel');
          if (display) {
            var keys = Object.keys(_coDbids);
            display.textContent = keys.length ? keys.map(function(k){ return k + ': ' + _coDbids[k]; }).join(' | ') : '暂无配置';
          }
          if (delSel) {
            delSel.innerHTML = '';
            Object.keys(_coDbids).forEach(function(k) {
              var opt = document.createElement('option');
              opt.value = k; opt.textContent = k + ' (' + _coDbids[k] + ')';
              delSel.appendChild(opt);
            });
          }
        }
        function coDbidsSave(dbids, logMsg) {
          var logEl = document.getElementById('co-sales-dbids-log');
          GM_xmlhttpRequest({
            method: 'POST', url: RELAY + '/superset/dbids',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ who: 'handongxue', dbids: dbids }),
            timeout: 6000,
            onload: function(r) {
              try {
                var j = JSON.parse(r.responseText);
                if (logEl) { logEl.textContent = j.ok ? (logMsg || '已保存') : ('失败: ' + (j.error||'')); }
                if (j.ok) {
                  GM_setValue('tuopin_dbids_cache', JSON.stringify({ date: coTodayStr(), dbids: dbids }));
                  coDbidsRefresh(dbids);
                }
              } catch(e) { if (logEl) logEl.textContent = '解析失败'; }
            },
            onerror: function() { if (logEl) logEl.textContent = '请求失败'; }
          });
        }
        var addBtn = document.getElementById('co-sales-dbids-add');
        if (addBtn) addBtn.onclick = function() {
          var name = (document.getElementById('co-sales-dbids-name').value || '').trim();
          var id = parseInt((document.getElementById('co-sales-dbids-id').value || '').trim(), 10);
          if (!name || !id) { var logEl = document.getElementById('co-sales-dbids-log'); if (logEl) logEl.textContent = '用户名和ID不能为空'; return; }
          var newDbids = Object.assign({}, _coDbids);
          newDbids[name] = id;
          coDbidsSave(newDbids, '已添加 ' + name);
          document.getElementById('co-sales-dbids-name').value = '';
          document.getElementById('co-sales-dbids-id').value = '';
        };
        var delBtn = document.getElementById('co-sales-dbids-del');
        if (delBtn) delBtn.onclick = function() {
          var sel = document.getElementById('co-sales-dbids-del-sel');
          var name = sel && sel.value;
          if (!name) return;
          var newDbids = Object.assign({}, _coDbids);
          delete newDbids[name];
          coDbidsSave(newDbids, '已删除 ' + name);
        };

        // ── 佣比查询（销售数据 tab 用） ──
        function coQuerySalesCommission() {
          var rateEl = document.getElementById('co-sales-comm-rate');
          var calcEl = document.getElementById('co-sales-comm-calc');
          if (!rateEl) return;
          // 先从页面取商品直达链接
          GM_xmlhttpRequest({
            method: 'POST',
            url: 'http://youhui.bgm.smzdm.com/youhui_action/ajax_get_article_detail',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
            data: 'article_id=' + CO_ARTICLE_ID + '&channel_id=1',
            timeout: 10000,
            onload: function(r) {
              var productUrl = '';
              try {
                var d = JSON.parse(r.responseText);
                productUrl = d.article_clean_link || d.article_direct_link || '';
              } catch(e) {}
              if (!productUrl) {
                if (rateEl) { rateEl.textContent = '-'; rateEl.style.color = '#999'; }
                return;
              }
              GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://commission-bgm.agentdevops.zdm.net/commission/?url=' + encodeURIComponent(productUrl),
                timeout: 15000,
                onload: function(resp) {
                  try {
                    var data = JSON.parse(resp.responseText || '{}');
                    if (!data.ok) { rateEl.textContent = '-'; rateEl.style.color = '#999'; return; }
                    var ratioNum = parseFloat(data.ratioPC);
                    var ratioPct = isNaN(ratioNum) ? '' : (ratioNum * 100).toFixed(2);
                    rateEl.textContent = ratioPct ? (ratioPct + '%') : '-';
                    rateEl.style.color = ratioPct ? '#1890ff' : '#999';
                    if (calcEl) { calcEl.textContent = '-'; calcEl.style.color = '#999'; }
                  } catch(e) { rateEl.textContent = '解析失败'; rateEl.style.color = '#ff4d4f'; }
                },
                onerror: function() { rateEl.textContent = '查询失败'; rateEl.style.color = '#ff4d4f'; },
                ontimeout: function() { rateEl.textContent = '查询超时'; rateEl.style.color = '#ff4d4f'; }
              });
            },
            onerror: function() { if (rateEl) { rateEl.textContent = '-'; rateEl.style.color = '#999'; } }
          });
        }

        // ── 销售数据查询（Superset） ──
        var _salesLoaded = false;
        var SALES_CACHE_KEY = 'tuopin_sales_' + CO_ARTICLE_ID;
        var SALES_CACHE_TTL = 30 * 60 * 1000; // 30 分钟
        function coLoadSalesData(force) {
          var box = document.getElementById('co-sales-content');
          if (!box) return;

          // 读缓存：非强制刷新时先渲染缓存，再静默后台刷新
          if (!force) {
            try {
              var cached = JSON.parse(GM_getValue(SALES_CACHE_KEY, 'null'));
              if (cached && (Date.now() - cached.ts) < SALES_CACHE_TTL) {
                renderAll(cached.row);
                return;
              }
            } catch(e) {}
          }

          if (_salesLoaded && !force) return;
          box.innerHTML = '<div style="text-align:center;color:#bbb;padding:20px 0;">查询中...</div>';

          function supersetQuery(sql, cb) {
            GM_xmlhttpRequest({
              method: 'POST',
              url: SUPERSET + '/api/v1/sqllab/execute/',
              headers: { 'Content-Type': 'application/json', 'Referer': SUPERSET + '/sqllab/' },
              data: JSON.stringify({ database_id: SUPERSET_DB, schema: 'bi_app', sql: sql, json: true, runAsync: false, expand_data: true, queryLimit: 1000 }),
              withCredentials: true,
              timeout: 35000,
              onload: function(r) {
                try {
                  var j = JSON.parse(r.responseText);
                  if (j.errors && j.errors.length) {
                    var msg = (j.errors[0] && j.errors[0].message) || '查询出错';
                    cb(msg.slice(0, 120)); return;
                  }
                  var rows = j.data || (j.result && j.result.data) || j.result || j.results || null;
                  cb(null, { data: rows, _raw: j });
                } catch(e) { cb('解析失败: ' + e.message); }
              },
              onerror: function(e) { console.log('[sales] onerror status=' + e.status + ' finalUrl=' + e.finalUrl, e); cb('请求失败(网络错误，请检查Tampermonkey是否授权连接bi-superset-bgm.smzdm.com，或重新安装脚本)'); },
              ontimeout: function() { cb('超时(查询超过35s)'); }
            });
          }

          var articleId = CO_ARTICLE_ID;
          var safeId = String(articleId).replace(/'/g, '');

          // 第一步：归因表（必须）
          var sqlA = 'SELECT ascribe_gmv, ascribe_cps, ascribe_order, marketing_id, youhui_shop_name'
            + ' FROM bi_app.dm_zdm_haojia_a final'
            + ' WHERE article_id = \'' + safeId + '\''
            + ' LIMIT 1';

          // 等 SUPERSET_DB 就绪（SSO+relay 覆盖登录人对应 database_id）再发查询，避免用默认 406 报错。
          // 轮询 300ms 一次，最多 12s；超时则用当前 db（默认或旧值）兜底发一次，不再卡死。
          function runSalesQuery() {
            supersetQuery(sqlA, function(errA, rA) {
            if (errA) {
              var box2 = document.getElementById('co-sales-content');
              if (box2) box2.innerHTML = '<div style="color:#ff4d4f;font-size:11px;padding:8px;">查询失败: ' + coEsc(String(errA).slice(0, 200)) + '</div>';
              return;
            }
            var baseRow = (rA && rA.data && rA.data[0]) ? rA.data[0] : null;
            if (!baseRow || !baseRow.marketing_id) { renderAll(null); return; }

            // 第二步：实时映射表（可选，无权限时跳过）
            var mid = String(baseRow.marketing_id).replace(/'/g, '');
            var sqlB = 'SELECT ROUND(SUM(gmv_rmb)) AS map_gmv, ROUND(SUM(cps)) AS map_cps, ROUND(SUM(order_num)) AS map_order_num'
              + ' FROM bi_app.ads_zdm_trade_orderproduct_realtime final'
              + ' WHERE pro_id = \'' + mid + '\''
              + ' AND toDate(order_create_time) BETWEEN today()-2 AND today()'
              + ' AND is_valid_order = \'1\'';

            supersetQuery(sqlB, function(errB, rB) {
              var mapRow = (!errB && rB && rB.data && rB.data[0]) ? rB.data[0] : {};
              var row = {
                ascribe_gmv: baseRow.ascribe_gmv,
                ascribe_cps: baseRow.ascribe_cps,
                ascribe_order: baseRow.ascribe_order,
                youhui_shop_name: baseRow.youhui_shop_name,
                map_gmv: mapRow.map_gmv || 0,
                map_cps: mapRow.map_cps || 0,
                map_order_num: mapRow.map_order_num || 0,
                map_no_perm: !!errB,
              };
              try { GM_setValue(SALES_CACHE_KEY, JSON.stringify({ row: row, ts: Date.now() })); } catch(e) {}
              renderAll(row);
            });
          });
          } // end runSalesQuery

          // db 就绪闸门：就绪立即查，否则轮询，12s 兜底强制查
          (function waitDb() {
            if (_salesDbReady) { runSalesQuery(); return; }
            var waited = 0;
            var iv = setInterval(function () {
              if (_salesDbReady) { clearInterval(iv); runSalesQuery(); }
              else if ((waited += 300) >= 12000) { clearInterval(iv); runSalesQuery(); }
            }, 300);
          })();

          function renderAll(row) {
              if (!box) return;
              var html = '<div style="margin-bottom:8px;">';

              // 归因数据（累计）
              html += '<div style="font-weight:600;color:#333;font-size:11px;margin-bottom:4px;">归因数据（累计）</div>';
              if (row) {
                var g2 = 'display:flex;justify-content:space-between;';
                html += '<div style="background:#fff7e6;border-radius:4px;padding:6px 8px;font-size:11px;">'
                  + '<div style="' + g2 + 'margin-bottom:3px;">'
                  + '<span>归因GMV：<b style="color:#ff7a00;">¥' + (row.ascribe_gmv || 0) + '</b></span>'
                  + '<span>归因CPS：<b style="color:#ff7a00;">¥' + (row.ascribe_cps || 0) + '</b></span>'
                  + '</div>'
                  + '<div style="' + g2 + '">'
                  + '<span>归因订单量：<b style="color:#ff7a00;">' + (row.ascribe_order || 0) + '</b></span>'
                  + '<span style="color:#999;">店铺：' + coEsc(row.youhui_shop_name || '—') + '</span>'
                  + '</div>'
                  + '</div>';
              } else {
                html += '<div style="color:#bbb;font-size:11px;padding:4px 0;">暂无数据</div>';
              }

              // 近3日映射
              html += '<div style="font-weight:600;color:#333;font-size:11px;margin-bottom:4px;margin-top:8px;">近3日映射数据</div>';
              if (row && row.map_no_perm) {
                html += '<div style="color:#bbb;font-size:11px;padding:4px 0;">无查询权限</div>';
              } else if (row && (row.map_gmv || row.map_cps)) {
                var g2 = 'display:flex;justify-content:space-between;';
                html += '<div style="background:#f6ffed;border-radius:4px;padding:6px 8px;font-size:11px;">'
                  + '<div style="' + g2 + 'margin-bottom:3px;">'
                  + '<span>映射GMV：<b style="color:#52c41a;">¥' + (row.map_gmv || 0) + '</b></span>'
                  + '<span>映射CPS：<b style="color:#52c41a;">¥' + (row.map_cps || 0) + '</b></span>'
                  + '</div>'
                  + '<div style="' + g2 + '">'
                  + '<span>映射订单量：<b style="color:#52c41a;">' + (row.map_order_num || 0) + '</b></span>'
                  + '<span>佣比：<b id="co-sales-comm-rate" style="color:#1890ff;">查询中...</b></span>'
                  + '</div>'
                  + '</div>';
              } else {
                html += '<div style="color:#bbb;font-size:11px;padding:4px 0;">暂无数据</div>';
              }
              html += '<div style="text-align:right;margin-top:6px;"><span id="co-sales-refresh" style="color:#bbb;font-size:10px;cursor:pointer;">刷新</span></div>';
              html += '</div>';
              box.innerHTML = html;
              _salesLoaded = true;

              var refreshBtn = document.getElementById('co-sales-refresh');
              if (refreshBtn) refreshBtn.onclick = function() { _salesLoaded = false; coLoadSalesData(true); };

              // 查询佣比
              coQuerySalesCommission();
            }
        }

        // Tab 切换
        var ALL_SUBTABS = ['optimize','sales','shequn','inject','task','batch'];
        // 切小 tab：显隐内容容器 + 激活样式；若小 tab 属于另一大 tab，连带切大 tab
        function coSwitchTab(key) {
          // 若 key 属于另一大 tab 组，先切大 tab（会连带显隐本组按钮）
          var bigOfKey = SUB_TO_BIG[key];
          if (bigOfKey && bigOfKey !== coActiveBigTab) {
            coSwitchBigTab(bigOfKey);
          }
          GM_setValue('tuopin_active_tab', key);
          coActiveTab = key;
          ALL_SUBTABS.forEach(function(k) {
            var body = document.getElementById('co-tab-' + k);
            var btn = document.getElementById('co-tab-btn-' + k);
            if (body) body.style.display = k === key ? 'block' : 'none';
            if (btn) {
              if (k === key) {
                btn.style.color = '#ff7a00';
                btn.style.borderBottom = '2px solid #ff7a00';
                btn.style.marginBottom = '-2px';
              } else {
                btn.style.color = '#999';
                btn.style.borderBottom = 'none';
                btn.style.marginBottom = '0';
              }
            }
          });
          if (key === 'sales') coLoadSalesData();
        }
        // 切大 tab：隐藏另一组小 tab 按钮、显示本组按钮；恢复本组上次小 tab
        function coSwitchBigTab(bigKey) {
          if (!BIG_TABS[bigKey]) return;
          coActiveBigTab = bigKey;
          GM_setValue('tuopin_active_big_tab', bigKey);
          // 大 tab 按钮激活样式
          ['subsidy','ops'].forEach(function(bk) {
            var bbtn = document.getElementById('co-bigtab-' + bk);
            if (bbtn) {
              if (bk === bigKey) { bbtn.style.color = '#fff'; bbtn.style.background = '#ff7a00'; }
              else { bbtn.style.color = '#999'; bbtn.style.background = '#f5f5f5'; }
            }
          });
          // 各组小 tab 按钮显隐（_taskOk 由 SSO 异步设置；兜底读 GM 缓存防 SSO 慢/失败）
          var canSeeTask = _taskOk;
          if (!canSeeTask) {
            var _wc = {}; try { _wc = JSON.parse(GM_getValue('tuopin_wl_cache', '{}')); } catch(e) {}
            var _cn = GM_getValue('tuopin_my_name', '');
            if (_cn && (_cn === 'handongxue' || (_wc.list || []).indexOf(_cn) >= 0)) canSeeTask = true;
          }
          Object.keys(BIG_TABS).forEach(function(bk) {
            BIG_TABS[bk].subtabs.forEach(function(sub) {
              var sbtn = document.getElementById('co-tab-btn-' + sub);
              if (!sbtn) return;
              if (bk === bigKey) {
                // 本组：显示（task 例外，无权限不显示）
                if (sub === 'task') sbtn.style.display = canSeeTask ? '' : 'none';
                else sbtn.style.display = '';
              } else {
                sbtn.style.display = 'none';
              }
            });
          });
          // 取本组上次小 tab（若不在本组则取本组第一个）
          var lastSub = GM_getValue('tuopin_active_tab', '');
          if (BIG_TABS[bigKey].subtabs.indexOf(lastSub) < 0) {
            lastSub = BIG_TABS[bigKey].subtabs[0];
          }
          coSwitchTab(lastSub);
        }
        ALL_SUBTABS.forEach(function(k) {
          var btn = document.getElementById('co-tab-btn-' + k);
          if (btn) btn.onclick = function() { coSwitchTab(k); };
        });
        // 大 tab 按钮绑定
        var bigSubBtn = document.getElementById('co-bigtab-subsidy');
        if (bigSubBtn) bigSubBtn.onclick = function() { coSwitchBigTab('subsidy'); };
        var bigOpsBtn = document.getElementById('co-bigtab-ops');
        if (bigOpsBtn) bigOpsBtn.onclick = function() { coSwitchBigTab('ops'); };
        // 若默认 tab 是 sales，立即加载（有缓存则秒出；无缓存时 coLoadSalesData 内部会等 SUPERSET_DB 就绪再发查询）
        if (coActiveTab === 'sales') coLoadSalesData();

        // ── 好价批量工具（batch tab）──
        (function() {
          var _batchResults = [];   // 当前查询结果：[{articleId, articleUrl, title, mall, tag, gmv, cps, rate}]
          function renderBatchHistory() {
            var box = document.getElementById('co-batch-history');
            if (!box) return;
            var list = [];
            try { list = JSON.parse(GM_getValue('tuopin_batch_history', '[]')); } catch(e) {}
            if (!list.length) { box.innerHTML = ''; return; }
            box.innerHTML = '<div style="font-size:10px;color:#aaa;margin-bottom:3px;">执行明细</div>'
              + list.slice().reverse().map(function(item, revIdx) {
                var idx = list.length - 1 - revIdx;
                var detailId = 'co-bh-detail-' + idx;
                var summary = '✓' + item.success + ' ⊘' + ((item.soldout || 0) + (item.expired || 0)) + (item.timeSkip ? ' ⏭' + item.timeSkip : '') + ' ✗' + item.failed;
                var statusColor = item.failed > 0 ? '#ff4d4f' : '#52c41a';
                return '<div style="border:1px solid #f0f0f0;border-radius:4px;margin-bottom:4px;overflow:hidden;">'
                  + '<div onclick="var d=document.getElementById(\'' + detailId + '\');d.style.display=d.style.display===\'none\'?\'block\':\'none\';" '
                  + 'style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;cursor:pointer;background:#fafafa;">'
                  + '<span style="font-size:10px;color:#555;">' + coEsc(item.time) + ' 执行' + coEsc(item.skills) + '</span>'
                  + '<span style="font-size:10px;color:' + statusColor + ';flex-shrink:0;margin-left:4px;">' + summary + '</span>'
                  + '</div>'
                  + '<div id="' + detailId + '" style="display:none;padding:4px 6px;font-size:10px;line-height:1.7;border-top:1px solid #f0f0f0;">'
                  + '<div style="color:#52c41a;">✓ 成功 ' + item.success + (item.successIds && item.successIds.length ? '：' + item.successIds.join(', ') : '') + '</div>'
                  + '<div style="color:#fa8c16;">⊘ 售罄 ' + (item.soldout||0) + ' / 过期 ' + (item.expired||0)
                    + ((item.soldoutIds && item.soldoutIds.length) || (item.expiredIds && item.expiredIds.length)
                      ? '：' + (item.soldoutIds || []).concat(item.expiredIds || []).join(', ') : '') + '</div>'
                  + (item.timeSkip ? '<div style="color:#1890ff;">⏭ 时间跳过 ' + item.timeSkip + (item.timeSkipIds && item.timeSkipIds.length ? '：' + item.timeSkipIds.join(', ') : '') + '</div>' : '')
                  + '<div style="color:#ff4d4f;">✗ 失败 ' + item.failed + (item.failedIds && item.failedIds.length ? '：' + item.failedIds.join(', ') : '') + '</div>'
                  + (item.failedDetails && item.failedDetails.length ? '<div style="color:#ff4d4f;font-size:9px;margin-top:2px;">' + item.failedDetails.map(function(d){ return coEsc(d); }).join('<br>') + '</div>' : '')
                  + '</div>'
                  + '</div>';
              }).join('');
          }
          function saveBatchHistory(item) {
            var list = [];
            try { list = JSON.parse(GM_getValue('tuopin_batch_history', '[]')); } catch(e) {}
            list.push(item);
            if (list.length > 20) list = list.slice(list.length - 20);
            GM_setValue('tuopin_batch_history', JSON.stringify(list));
            renderBatchHistory();
          }
          function batchLog(msg, color) {
            var el = document.getElementById('co-batch-log');
            if (el) { el.textContent = msg; el.style.color = color || '#ff4d4f'; }
          }
          function batchRunLog(msg) {
            var el = document.getElementById('co-batch-run-log');
            if (el) el.textContent = msg;
          }
          function coEsc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
          // 构造批量查询 SQL — 空字段 = 不筛选（全量查询）
          function buildBatchSQL() {
            function selVal(id) {
              var el = document.getElementById(id);
              return (el && el.value) ? el.value.trim() : '';
            }
            function numVal(id) {
              var el = document.getElementById(id);
              var v = (el && el.value) ? parseFloat(el.value) : NaN;
              return isNaN(v) ? 0 : v;
            }
            function sqlList(s) {
              var arr = s.split(',').map(function(x){ return x.trim(); }).filter(Boolean);
              if (!arr.length) return '';
              return "('" + arr.map(function(x){ return x.replace(/'/g, "''"); }).join("','") + "')";
            }
            var cate1 = selVal('co-batch-cate1');
            var cate2 = selVal('co-batch-cate2');
            var mall = selVal('co-batch-mall');
            var channel = selVal('co-batch-channel');
            var gmv = numVal('co-batch-gmv');
            var cps = numVal('co-batch-cps');
            var rateStr = (document.getElementById('co-batch-rate') || {}).value || '';
            var rate = rateStr.trim() !== '' ? parseFloat(rateStr) : NaN;
            var where = [];
            if (cate1) where.push("cate1_name IN " + sqlList(cate1));
            if (cate2) where.push("cate2_name IN " + sqlList(cate2));
            if (mall) where.push("mall_name IN " + sqlList(mall));
            if (channel) where.push("channel_name IN " + sqlList(channel));
            // 发布时间：近 3 天（baoliao_time 或 first_pub_time）
            where.push("((toDate(faxian_time) != '1970-01-01' AND toDate(baoliao_time) BETWEEN today()-2 AND today()) OR (toDate(baoliao_time) = '1970-01-01' AND toDate(first_pub_time) BETWEEN today()-2 AND today()))");
            // 勾选"发现"时只查 latest_uhome_editor_name 为空的文章
            var faxianCb = document.querySelector('.co-batch-skill[value="发现"]');
            if (faxianCb && faxianCb.checked) where.push("latest_uhome_editor_name = ''");
            var having = [];
            if (gmv > 0) having.push("ROUND(sum(ascribe_gmv)) >= " + gmv);
            if (cps > 0) having.push("sum(ascribe_cps) >= " + cps);
            if (!isNaN(rate) && rate > 0) having.push("toFloat64OrNull(substring(commission, position(':' IN commission) + 1, 4)) >= " + rate);
            var sql = "SELECT"
              + " substring(commission, position(':' IN commission) + 1, 4) AS `佣比`,"
              + " channel_name, concat('https://www.smzdm.com/p/', article_id, '/') AS `文章ID`, article_subtitle AS `到手价`,"
              + " ROUND(sum(ascribe_gmv)) AS `归因GMV`, sum(ascribe_cps) AS `归因CPS`, ROUND(sum(ascribe_order)) AS `归因订单量`,"
              + " article_title AS `文章名称`, youhui_shop_name AS `店铺名称`, faxian_time AS `发布发现时间`,"
              + " article_pro_status AS `文章状态`,"
              + " CASE WHEN tag_name LIKE '%绝对值%' THEN '绝对值' WHEN tag_name LIKE '%手慢无%' THEN '手慢无' WHEN tag_name LIKE '%神价格%' THEN '神价格' WHEN tag_name LIKE '%白菜党%' THEN '白菜党' WHEN tag_name LIKE '%闭眼跟着买%' THEN '闭眼跟着买' WHEN tag_name LIKE '%有点意思%' THEN '有点意思' WHEN tag_name LIKE '%必领神券%' THEN '必领神券' WHEN tag_name LIKE '%淘金币可用%' THEN '淘金币可用' WHEN tag_name LIKE '%有券的上%' THEN '有券的上' WHEN tag_name LIKE '%今日必买%' THEN '今日必买' WHEN tag_name LIKE '%yszb%' THEN 'yszb' WHEN tag_name LIKE '%phbdj%' THEN 'phbdj' WHEN tag_name LIKE '%困难好价%' THEN '困难好价' WHEN tag_name LIKE '%复杂好价%' THEN '复杂好价' ELSE '' END AS `标签`,"
              + " baoliao_user_nickname AS `达人名称`, first_pub_time AS `首次发布时间`, mall_name AS `商城`,"
              + " cate2_name AS `二级品类`"
              + " FROM bi_app.dm_zdm_haojia_a final"
              + " WHERE " + where.join(' AND ')
              + " GROUP BY commission, channel_name, article_id, article_subtitle, article_pro_status, tag_name, faxian_time, article_title, baoliao_user_nickname, first_pub_time, mall_name, youhui_shop_name, cate2_name, digital_price";
            if (having.length) sql += " HAVING " + having.join(' AND ');
            sql += " ORDER BY `归因GMV` DESC";
            return sql;
          }
          function runBatchQuery(onDone) {
            var sql = buildBatchSQL();
            batchLog('查询中...', '#1890ff');
            var resBox = document.getElementById('co-batch-results');
            if (resBox) resBox.innerHTML = '<div style="color:#bbb;text-align:center;padding:8px 0;">查询中...</div>';
            GM_xmlhttpRequest({
              method: 'POST', url: SUPERSET + '/api/v1/sqllab/execute/',
              headers: { 'Content-Type': 'application/json', 'Referer': SUPERSET + '/sqllab/' },
              data: JSON.stringify({ database_id: SUPERSET_DB, schema: 'bi_app', sql: sql, json: true, runAsync: false, expand_data: true }),
              withCredentials: true, timeout: 35000,
              onload: function(r) {
                try {
                  var j = JSON.parse(r.responseText);
                  if (j.errors && j.errors.length) { batchLog('查询失败: ' + ((j.errors[0] && j.errors[0].message) || '').slice(0,100)); if (onDone) onDone(false); return; }
                  var rows = j.data || (j.result && j.result.data) || j.result || j.results || [];
                  _batchResults = (Array.isArray(rows) ? rows : []).map(function(row) {
                    return {
                      articleId: String(row['文章ID'] || '').match(/\/p\/(\d+)/),
                      articleUrl: row['文章ID'] || '',
                      title: row['文章名称'] || '',
                      mall: row['商城'] || '',
                      tag: row['标签'] || '',
                      gmv: row['归因GMV'] || 0,
                      cps: row['归因CPS'] || 0,
                      rate: row['佣比'] || ''
                    };
                  }).filter(function(x){ return x.articleUrl; });
                  _batchResults.forEach(function(x){ x.articleId = x.articleId ? x.articleId[1] : ''; });
                  renderBatchResults();
                  if (onDone) onDone(true);
                } catch(e) { batchLog('解析失败: ' + e.message); if (onDone) onDone(false); }
              },
              onerror: function() { batchLog('请求失败(网络)'); if (onDone) onDone(false); },
              ontimeout: function() { batchLog('查询超时(>35s)'); if (onDone) onDone(false); }
            });
          }
          // 渲染某个任务的查询结果 tab（tid='' 表示临时预览，还未关联任务）
          function renderResultTab(tid, results, label) {
            var wrap = document.getElementById('co-batch-results-wrap');
            var tabsEl = document.getElementById('co-batch-results-tabs');
            var panelsEl = document.getElementById('co-batch-results-panels');
            if (!wrap || !tabsEl || !panelsEl) return;
            wrap.style.display = 'block';
            var tabId = 'co-rt-tab-' + (tid || 'preview');
            var panelId = 'co-rt-panel-' + (tid || 'preview');
            // 如果已存在就更新内容
            var existingPanel = document.getElementById(panelId);
            if (existingPanel) {
              existingPanel.innerHTML = buildResultsHTML(results);
              refreshTabsVisibility();
              return;
            }
            // 新建 tab 按钮
            var tab = document.createElement('div');
            tab.id = tabId;
            tab.setAttribute('data-tid', tid || '');
            tab.style.cssText = 'padding:3px 8px;font-size:10px;cursor:pointer;white-space:nowrap;border:1px solid #e0e0e0;border-bottom:none;background:#f5f5f5;color:#666;border-radius:4px 4px 0 0;margin-right:2px;flex-shrink:0;';
            tab.textContent = label;
            tab.onclick = function() { switchResultTab(tid || 'preview'); };
            tabsEl.appendChild(tab);
            // 新建内容面板
            var panel = document.createElement('div');
            panel.id = panelId;
            panel.style.cssText = 'display:none;';
            panel.innerHTML = buildResultsHTML(results);
            panelsEl.appendChild(panel);
            // 激活新 tab
            switchResultTab(tid || 'preview');
            refreshTabsVisibility();
          }
          // tab 数量 <= 1 时隐藏 tab 栏
          function refreshTabsVisibility() {
            var tabsEl = document.getElementById('co-batch-results-tabs');
            if (!tabsEl) return;
            tabsEl.style.display = tabsEl.children.length > 1 ? 'flex' : 'none';
          }
          function buildResultsHTML(results) {
            if (!results || !results.length) return '<div style="color:#bbb;text-align:center;padding:8px 0;">暂无数据</div>';
            var header = '<div style="color:#52c41a;font-size:10px;font-weight:600;padding:3px 2px 5px;border-bottom:1px solid #e8e8e8;margin-bottom:2px;">执行文章明细：查询完成：共 ' + results.length + ' 条</div>';
            return header + results.map(function(x) {
              return '<div style="padding:4px 2px;border-bottom:1px solid #f0f0f0;">'
                + '<div style="color:#333;font-weight:500;word-break:break-all;" title="' + coEsc(x.title) + '">' + coEsc(x.title).slice(0,28) + '</div>'
                + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px;">'
                + '<a href="' + coEsc(x.articleUrl) + '" target="_blank" style="color:#1890ff;font-size:9px;">' + x.articleId + '</a>'
                + '<span style="color:#999;font-size:9px;">GMV ' + coEsc(String(x.gmv)) + ' · ' + coEsc(x.mall) + '</span>'
                + '</div></div>';
            }).join('');
          }
          function switchResultTab(activeTid) {
            var tabsEl = document.getElementById('co-batch-results-tabs');
            var panelsEl = document.getElementById('co-batch-results-panels');
            if (!tabsEl || !panelsEl) return;
            tabsEl.querySelectorAll('[id^="co-rt-tab-"]').forEach(function(t) {
              var isActive = t.getAttribute('data-tid') === activeTid || t.id === 'co-rt-tab-' + activeTid;
              t.style.background = isActive ? '#fff' : '#f5f5f5';
              t.style.color = isActive ? '#ff7a00' : '#666';
              t.style.fontWeight = isActive ? '600' : 'normal';
            });
            panelsEl.querySelectorAll('[id^="co-rt-panel-"]').forEach(function(p) {
              p.style.display = p.id === 'co-rt-panel-' + activeTid ? 'block' : 'none';
            });
          }
          function removeResultTab(tid) {
            var tabEl = document.getElementById('co-rt-tab-' + tid);
            var panelEl = document.getElementById('co-rt-panel-' + tid);
            var tabsEl = document.getElementById('co-batch-results-tabs');
            var wrap = document.getElementById('co-batch-results-wrap');
            if (tabEl) tabEl.remove();
            if (panelEl) panelEl.remove();
            if (tabsEl && tabsEl.children.length > 0) {
              var firstTab = tabsEl.children[0];
              switchResultTab(firstTab.getAttribute('data-tid'));
              refreshTabsVisibility();
            } else if (wrap) {
              wrap.style.display = 'none';
            }
          }
          function renderBatchResults() {
            // 临时预览：使用 'preview' tab 展示当前 _batchResults（还未关联任务）
            var now = new Date();
            var label = '查询结果 ' + (now.getHours()) + ':' + String(now.getMinutes()).padStart(2,'0');
            renderResultTab('preview', _batchResults, label);
          }
          // 把上一个未完成任务中已执行的结果归档进明细（启动新任务前调用）
          function archivePrevTaskIfAny() {
            var raw = GM_getValue('tuopin_batch_tasks', '');
            if (!raw) return;
            var tasks;
            try { tasks = JSON.parse(raw); } catch(e) { return; }
            Object.keys(tasks).forEach(function(tid) {
              var t = tasks[tid];
              var results = t.results || [];
              if (!results.length) return;
              var now = new Date();
              var timeStr = (now.getMonth()+1) + '月' + now.getDate() + '日' + now.getHours() + '点' + String(now.getMinutes()).padStart(2,'0') + '分(中断归档)';
              var histItem = { time: timeStr, skills: (t.skills || []).join('/'), total: (t.ids || []).length, success: 0, soldout: 0, expired: 0, timeSkip: 0, failed: 0, successIds: [], soldoutIds: [], expiredIds: [], timeSkipIds: [], failedIds: [], failedDetails: [] };
              results.forEach(function(r) {
                var s = r.status, d = (r.detail || '');
                if (s === 'success') { histItem.success++; histItem.successIds.push(r.id); }
                else if (s === 'skipped') {
                  if (d.indexOf('同步首页时间') >= 0) { histItem.timeSkip++; histItem.timeSkipIds.push(r.id); }
                  else if (d.indexOf('售罄') >= 0) { histItem.soldout++; histItem.soldoutIds.push(r.id); }
                  else { histItem.expired++; histItem.expiredIds.push(r.id); }
                } else { histItem.failed++; histItem.failedIds.push(r.id); histItem.failedDetails.push(r.id + ': ' + d); }
              });
              saveBatchHistory(histItem);
            });
          }
          var _pollTimers = {};  // {tid: intervalId}
          function startBatchSkill(skills, tags, syncSkipTime) {
            var ids = _batchResults.map(function(x){ return x.articleId; }).filter(Boolean);
            if (!ids.length) { batchRunLog('无有效文章ID'); return; }
            var tid = String(Date.now());
            var now = new Date();
            var timeLabel = (now.getMonth()+1) + '月' + now.getDate() + '日' + now.getHours() + '点' + String(now.getMinutes()).padStart(2,'0') + '分';
            var taskObj = { tid: tid, skills: skills, ids: ids, idx: 0, results: [], startedAt: Date.now(), tags: tags || [], syncSkipTime: syncSkipTime || '', queryResults: _batchResults, queryLabel: timeLabel + ' ' + skills.join('/') };
            // 写入 tasks map
            var tasks = {};
            try { tasks = JSON.parse(GM_getValue('tuopin_batch_tasks', '{}')) || {}; } catch(e) {}
            tasks[tid] = taskObj;
            GM_setValue('tuopin_batch_tasks', JSON.stringify(tasks));
            batchRunLog('已启动任务' + tid + '：' + ids.length + '篇 × [' + skills.join('/') + ']');
            GM_openInTab('http://youhui.bgm.smzdm.com/edit_youhui/' + ids[0], { active: true, insert: true });
            // 把 preview tab 升级为本任务 tab（复用已有 tab 元素，替换 id/data-tid）
            var previewTab = document.getElementById('co-rt-tab-preview');
            var previewPanel = document.getElementById('co-rt-panel-preview');
            if (previewTab) { previewTab.id = 'co-rt-tab-' + tid; previewTab.setAttribute('data-tid', tid); previewTab.textContent = coEsc(taskObj.queryLabel); previewTab.onclick = function(){ switchResultTab(tid); }; }
            if (previewPanel) { previewPanel.id = 'co-rt-panel-' + tid; }
            switchResultTab(tid);
            // 创建该任务的进度卡片并开始轮询
            renderActiveTask(tid, taskObj);
            startTaskPolling(tid);
          }
          function renderActiveTask(tid, task) {
            var container = document.getElementById('co-batch-activetasks');
            if (!container) return;
            var cardId = 'co-task-card-' + tid;
            var statsId = 'co-task-stats-' + tid;
            var existing = document.getElementById(cardId);
            var total = (task.ids || []).length;
            var done = (task.results || []).length;
            var isStopped = !!task._stopped;
            if (!existing) {
              var card = document.createElement('div');
              card.id = cardId;
              card.style.cssText = 'border:1px solid #ffe0b2;border-radius:4px;margin-bottom:6px;overflow:hidden;font-size:10px;';
              var now = new Date();
              var timeStr = (now.getMonth()+1) + '月' + now.getDate() + '日' + now.getHours() + '点' + String(now.getMinutes()).padStart(2,'0') + '分';
              card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:#fff7ed;">'
                + '<span style="color:#ff7a00;font-weight:600;">' + coEsc(timeStr) + ' 执行' + coEsc((task.skills||[]).join('/')) + '</span>'
                + '<div style="display:flex;gap:4px;">'
                + '<button id="co-task-stop-' + tid + '" style="padding:2px 8px;font-size:10px;border:1px solid #ff4d4f;background:#fff;color:#ff4d4f;border-radius:3px;cursor:pointer;">' + (isStopped ? '继续' : '停止') + '</button>'
                + '<button id="co-task-end-' + tid + '" style="padding:2px 8px;font-size:10px;border:1px solid #aaa;background:#fff;color:#666;border-radius:3px;cursor:pointer;">结束</button>'
                + '</div></div>'
                + '<div id="' + statsId + '" style="padding:4px 6px;line-height:1.7;"></div>';
              container.insertBefore(card, container.firstChild);
              // 绑定停止/继续按钮
              var btn = document.getElementById('co-task-stop-' + tid);
              if (btn) btn.onclick = function() { toggleTaskStop(tid); };
              // 绑定结束按钮
              var endBtn = document.getElementById('co-task-end-' + tid);
              if (endBtn) endBtn.onclick = function() { terminateTask(tid); };
            } else {
              // 更新停止/继续按钮状态
              var btn2 = document.getElementById('co-task-stop-' + tid);
              if (btn2) btn2.textContent = isStopped ? '继续' : '停止';
            }
            // 更新进度统计
            renderTaskStats(statsId, task.results || [], total, isStopped);
          }
          function renderTaskStats(statsId, results, total, isStopped) {
            var box = document.getElementById(statsId);
            if (!box) return;
            var done = results.length;
            var success = 0, soldout = 0, expired = 0, timeSkip = 0, failed = 0;
            var failedIds = [], timeSkipIds = [], failedDetails = [];
            results.forEach(function(r) {
              var s = r.status, d = (r.detail || '');
              if (s === 'success') success++;
              else if (s === 'skipped') {
                if (d.indexOf('同步首页时间') >= 0) { timeSkip++; timeSkipIds.push(r.id); }
                else if (d.indexOf('售罄') >= 0) soldout++;
                else if (d.indexOf('过期') >= 0) expired++;
                else soldout++;
              } else { failed++; failedIds.push(r.id); failedDetails.push(r.id + ': ' + d); }
            });
            box.innerHTML = '<div>' + (isStopped ? '<span style="color:#fa8c16;">⏸ 已暂停 </span>' : '') + '进度：' + done + '/' + total + '</div>'
              + '<div style="color:#52c41a;">✓ 成功 ' + success + '</div>'
              + '<div style="color:#fa8c16;">⊘ 售罄 ' + soldout + ' / 过期 ' + expired + '</div>'
              + (timeSkip > 0 ? '<div style="color:#1890ff;">⏭ 时间跳过 ' + timeSkip + (timeSkipIds.length ? '：' + timeSkipIds.join(', ') : '') + '</div>' : '')
              + '<div style="color:#ff4d4f;">✗ 失败 ' + failed + (failedIds.length ? '：' + failedIds.join(', ') : '') + '</div>'
              + (failedDetails.length ? '<div style="color:#ff4d4f;font-size:9px;">' + failedDetails.map(function(d){ return coEsc(d); }).join('<br>') + '</div>' : '');
          }
          function terminateTask(tid) {
            var tasks = {};
            try { tasks = JSON.parse(GM_getValue('tuopin_batch_tasks', '{}')) || {}; } catch(e) {}
            var t = tasks[tid];
            if (!t) return;
            // 停轮询
            if (_pollTimers[tid]) { clearInterval(_pollTimers[tid]); delete _pollTimers[tid]; }
            // 归档已有结果到执行明细
            var now = new Date();
            var timeStr = (now.getMonth()+1) + '月' + now.getDate() + '日' + now.getHours() + '点' + String(now.getMinutes()).padStart(2,'0') + '分(手动结束)';
            var histItem = buildHistItem(timeStr, t);
            saveBatchHistory(histItem);
            // 打上 _terminated 标志让 edit tab 自动关闭，然后移除任务
            t._terminated = true;
            t._stopped = true;
            tasks[tid] = t;
            GM_setValue('tuopin_batch_tasks', JSON.stringify(tasks));
            // 延迟 3s 后彻底清除任务（给 edit tab 轮询到 _terminated 的时间）
            setTimeout(function() {
              var t2 = {};
              try { t2 = JSON.parse(GM_getValue('tuopin_batch_tasks', '{}')) || {}; } catch(e) {}
              delete t2[tid];
              GM_setValue('tuopin_batch_tasks', JSON.stringify(t2));
            }, 3000);
            // 移除卡片和结果 tab
            var card = document.getElementById('co-task-card-' + tid);
            if (card) card.remove();
            removeResultTab(tid);
            renderBatchHistory();
            batchRunLog('任务已结束并归档');
          }
          function toggleTaskStop(tid) {
            var tasks = {};
            try { tasks = JSON.parse(GM_getValue('tuopin_batch_tasks', '{}')) || {}; } catch(e) {}
            var t = tasks[tid];
            if (!t) return;
            if (t._stopped) {
              // 继续：清除标记，重置 startedAt，跳过已处理，开新 tab
              var doneIds = {};
              (t.results || []).forEach(function(r){ doneIds[r.id] = true; });
              while (t.idx < t.ids.length && doneIds[t.ids[t.idx]]) t.idx++;
              if (t.idx >= t.ids.length) {
                batchRunLog('任务 ' + tid + ' 已全部处理完');
                delete tasks[tid];
                GM_setValue('tuopin_batch_tasks', JSON.stringify(tasks));
                var card = document.getElementById('co-task-card-' + tid);
                if (card) card.remove();
                removeResultTab(tid);
                return;
              }
              delete t._stopped;
              t.startedAt = Date.now();
              tasks[tid] = t;
              GM_setValue('tuopin_batch_tasks', JSON.stringify(tasks));
              GM_openInTab('http://youhui.bgm.smzdm.com/edit_youhui/' + t.ids[t.idx], { active: true, insert: true });
              startTaskPolling(tid);
            } else {
              // 停止
              t._stopped = true;
              tasks[tid] = t;
              GM_setValue('tuopin_batch_tasks', JSON.stringify(tasks));
              if (_pollTimers[tid]) { clearInterval(_pollTimers[tid]); delete _pollTimers[tid]; }
              renderActiveTask(tid, t);
              batchRunLog('任务 ' + tid.slice(-4) + ' 已暂停');
            }
            var btn = document.getElementById('co-task-stop-' + tid);
            if (btn) btn.textContent = t._stopped ? '继续' : '停止';
          }
          function startTaskPolling(tid) {
            if (_pollTimers[tid]) { clearInterval(_pollTimers[tid]); }
            var pollN = 0;
            _pollTimers[tid] = setInterval(function() {
              pollN++;
              var tasks = {};
              try { tasks = JSON.parse(GM_getValue('tuopin_batch_tasks', '{}')) || {}; } catch(e) {}
              var t = tasks[tid];
              if (!t || pollN > 600) {
                clearInterval(_pollTimers[tid]); delete _pollTimers[tid];
                if (t && t.results) {
                  // 任务自然完成（edit tab 删除了 task），归档历史
                  var now2 = new Date();
                  var timeStr2 = (now2.getMonth()+1) + '月' + now2.getDate() + '日' + now2.getHours() + '点' + String(now2.getMinutes()).padStart(2,'0') + '分';
                  var histItem2 = buildHistItem(timeStr2, t);
                  saveBatchHistory(histItem2);
                } else if (!t) {
                  // task 被 edit tab 自然完成后删掉了，从最后读到的结果归档
                }
                var card = document.getElementById('co-task-card-' + tid);
                if (card) card.remove();
                removeResultTab(tid);
                batchRunLog('任务已完成');
                return;
              }
              if (t._stopped) return;  // 暂停中，不刷新进度
              renderActiveTask(tid, t);
            }, 2000);
          }
          function buildHistItem(timeStr, t) {
            var histItem = { time: timeStr, skills: (t.skills||[]).join('/'), total: (t.ids||[]).length, success: 0, soldout: 0, expired: 0, timeSkip: 0, failed: 0, successIds: [], soldoutIds: [], expiredIds: [], timeSkipIds: [], failedIds: [], failedDetails: [] };
            (t.results||[]).forEach(function(r) {
              var s = r.status, d = (r.detail || '');
              if (s === 'success') { histItem.success++; histItem.successIds.push(r.id); }
              else if (s === 'skipped') {
                if (d.indexOf('同步首页时间') >= 0) { histItem.timeSkip++; histItem.timeSkipIds.push(r.id); }
                else if (d.indexOf('售罄') >= 0) { histItem.soldout++; histItem.soldoutIds.push(r.id); }
                else { histItem.expired++; histItem.expiredIds.push(r.id); }
              } else { histItem.failed++; histItem.failedIds.push(r.id); histItem.failedDetails.push(r.id + ': ' + d); }
            });
            return histItem;
          }
          function runSelected() {
            var skills = Array.prototype.slice.call(document.querySelectorAll('.co-batch-skill:checked')).map(function(cb){ return cb.value; });
            if (!skills.length) { batchRunLog('请勾选至少一个操作'); return; }
            var tags = [];
            if (skills.indexOf('加标签') >= 0) {
              var tagInput = document.getElementById('co-batch-tag-input');
              var tagRaw = tagInput ? (tagInput.value || '').trim() : '';
              tags = tagRaw ? tagRaw.split(/[,，]/).map(function(s){ return s.trim(); }).filter(Boolean) : [];
              if (!tags.length) { batchRunLog('勾选加标签后请填写标签名'); if (tagInput) { tagInput.style.borderColor = '#ff4d4f'; tagInput.focus(); } return; }
            }
            var syncSkipTimeEl = document.getElementById('co-batch-sync-skip-time');
            var syncSkipTime = syncSkipTimeEl ? (syncSkipTimeEl.value || '') : '';
            // 每次执行都重新查询，保证使用当前筛选条件的最新数据
            runBatchQuery(function(ok) {
              if (!ok || !_batchResults.length) { batchRunLog(ok ? '查询结果为空' : '查询失败'); return; }
              startBatchSkill(skills, tags, syncSkipTime);
            });
          }
          function syncRunBtn() {
            var rBtnEl = document.getElementById('co-batch-run');
            if (!rBtnEl) return;
            rBtnEl.disabled = false;
            rBtnEl.textContent = '执行选中操作';
            rBtnEl.onclick = runSelected;
          }
          // 初始化
          renderBatchHistory();
          syncRunBtn();
          // 管理选项折叠
          var manageToggle = document.getElementById('co-batch-manage-toggle');
          var manageArea = document.getElementById('co-batch-manage-area');
          if (manageToggle && manageArea) {
            manageToggle.onclick = function() {
              var open = manageArea.style.display !== 'none';
              manageArea.style.display = open ? 'none' : 'block';
              manageToggle.textContent = open ? '管理选项 ▾' : '管理选项 ▴';
            };
          }
          // 品类/商城下拉
          function batchListGet(key) { try { return JSON.parse(GM_getValue(key, '[]')) || []; } catch(e) { return []; } }
          function batchListSave(key, list) { GM_setValue(key, JSON.stringify(list)); }
          function batchRefreshSel(selId, gmKey, single) {
            var sel = document.getElementById(selId);
            if (!sel) return;
            var list = batchListGet(gmKey);
            if (single) {
              var cur = GM_getValue('tuopin_batch_sel_' + selId, '') || '';
              sel.innerHTML = '<option value="">请选择</option>';
              list.forEach(function(v) { var o = document.createElement('option'); o.value = v; o.textContent = v; if (v === cur) o.selected = true; sel.appendChild(o); });
              if (!sel.onchange) sel.onchange = function() { GM_setValue('tuopin_batch_sel_' + selId, this.value); };
            } else {
              var selected = {};
              for (var i = 0; i < sel.options.length; i++) if (sel.options[i].selected) selected[sel.options[i].value] = true;
              sel.innerHTML = '';
              list.forEach(function(v) { var o = document.createElement('option'); o.value = v; o.textContent = v; if (selected[v]) o.selected = true; sel.appendChild(o); });
            }
          }
          function wireBatchAdd(selId, gmKey, inputId, addBtnId, single) {
            var addBtn = document.getElementById(addBtnId);
            if (!addBtn) return;
            addBtn.onclick = function() {
              var inp = document.getElementById(inputId);
              var v = (inp && inp.value || '').trim();
              if (!v) return;
              var list = batchListGet(gmKey);
              if (list.indexOf(v) < 0) { list.push(v); batchListSave(gmKey, list); }
              batchRefreshSel(selId, gmKey, single);
              if (inp) inp.value = '';
            };
          }
          if (!batchListGet('tuopin_batch_channel').length) {
            batchListSave('tuopin_batch_channel', ['发现', '国内优惠', '个人主页']);
          }
          batchRefreshSel('co-batch-cate1', 'tuopin_batch_cate1', true);
          batchRefreshSel('co-batch-cate2', 'tuopin_batch_cate2', true);
          batchRefreshSel('co-batch-mall', 'tuopin_batch_mall', true);
          batchRefreshSel('co-batch-channel', 'tuopin_batch_channel', true);
          wireBatchAdd('co-batch-cate1', 'tuopin_batch_cate1', 'co-batch-cate1-input', 'co-batch-cate1-add', true);
          wireBatchAdd('co-batch-cate2', 'tuopin_batch_cate2', 'co-batch-cate2-input', 'co-batch-cate2-add', true);
          wireBatchAdd('co-batch-mall', 'tuopin_batch_mall', 'co-batch-mall-input', 'co-batch-mall-add', true);
          wireBatchAdd('co-batch-channel', 'tuopin_batch_channel', 'co-batch-channel-input', 'co-batch-channel-add', true);
          // 执行按钮
          var rBtnInit = document.getElementById('co-batch-run');
          if (rBtnInit) rBtnInit.onclick = runSelected;
          // ── 权限管理 ──
          var ALL_SKILLS = ['精选', '回捞', '发现', '加标签'];
          function batchPermGet() { try { return JSON.parse(GM_getValue('tuopin_batch_perms', '{}')) || {}; } catch(e) { return {}; } }
          function batchPermSave(p) { GM_setValue('tuopin_batch_perms', JSON.stringify(p)); }
          // 根据当前登录人过滤可见 skill（管理员全显示）
          function applySkillPerm(loginName) {
            var nameEl = document.getElementById('co-batch-loginname');
            if (nameEl && loginName) nameEl.textContent = '(' + loginName + ')';
            if (coIsAdmin || !loginName) return;  // 管理员或未识别到用户名：全部显示
            var perms = batchPermGet();
            var allowed = perms[loginName];
            if (!allowed) return;  // 未配置权限：默认全显
            var cbs2 = document.querySelectorAll('.co-batch-skill');
            for (var i = 0; i < cbs2.length; i++) {
              var label = cbs2[i].closest('label');
              if (label) label.style.display = allowed.indexOf(cbs2[i].value) >= 0 ? '' : 'none';
            }
          }
          // SSO 回调后触发（SSO 异步，这里监听 GM 存储变化 + 立刻读一次）
          (function initPermUI() {
            var loginName = GM_getValue('tuopin_my_name', '');
            if (loginName) applySkillPerm(loginName);
            // 管理员显示权限按钮
            if (coIsAdmin) {
              var permBtn = document.getElementById('co-batch-perm-btn');
              if (permBtn) permBtn.style.display = '';
            }
          })();
          // SSO 异步完成后再次应用（SSO 可能比 IIFE 晚）
          setTimeout(function() {
            var loginName2 = GM_getValue('tuopin_my_name', '');
            if (loginName2) applySkillPerm(loginName2);
            if (coIsAdmin) {
              var permBtn2 = document.getElementById('co-batch-perm-btn');
              if (permBtn2) permBtn2.style.display = '';
            }
          }, 3000);
          // 权限管理面板的交互
          var permBtn3 = document.getElementById('co-batch-perm-btn');
          var permPanel = document.getElementById('co-batch-perm-panel');
          if (permBtn3 && permPanel) {
            permBtn3.onclick = function() {
              var open = permPanel.style.display !== 'none';
              permPanel.style.display = open ? 'none' : 'block';
              if (!open) renderPermList();
            };
          }
          function renderPermList() {
            var listEl = document.getElementById('co-perm-list');
            if (!listEl) return;
            var perms = batchPermGet();
            var keys = Object.keys(perms);
            if (!keys.length) { listEl.innerHTML = '<div style="color:#bbb;">暂无配置</div>'; return; }
            listEl.innerHTML = keys.map(function(u) {
              return '<div style="padding:2px 0;display:flex;justify-content:space-between;align-items:center;">'
                + '<span style="color:#555;">' + coEsc(u) + '：' + coEsc((perms[u]||[]).join('/')) + '</span>'
                + '<span style="color:#1890ff;cursor:pointer;font-size:9px;" onclick="(function(){'
                  + 'var ui=document.getElementById(\'co-perm-user\');if(ui)ui.value=\'' + u.replace(/'/g, "\\'") + '\';'
                  + 'var cbs=document.querySelectorAll(\'.co-perm-skill\');'
                  + 'var allowed=' + JSON.stringify(perms[u] || []) + ';'
                  + 'for(var i=0;i<cbs.length;i++)cbs[i].checked=allowed.indexOf(cbs[i].value)>=0;'
                + '})()">编辑</span>'
                + '</div>';
            }).join('');
          }
          var permSaveBtn = document.getElementById('co-perm-save');
          var permDelBtn = document.getElementById('co-perm-del');
          var permStatus = document.getElementById('co-perm-status');
          if (permSaveBtn) permSaveBtn.onclick = function() {
            var u = (document.getElementById('co-perm-user') || {}).value || '';
            u = u.trim();
            if (!u) { if (permStatus) permStatus.textContent = '请填写用户名'; return; }
            var checked = Array.prototype.slice.call(document.querySelectorAll('.co-perm-skill:checked')).map(function(cb){ return cb.value; });
            if (!checked.length) { if (permStatus) permStatus.textContent = '请至少选一个权限'; return; }
            var perms = batchPermGet();
            perms[u] = checked;
            batchPermSave(perms);
            if (permStatus) permStatus.textContent = '已保存';
            renderPermList();
          };
          if (permDelBtn) permDelBtn.onclick = function() {
            var u = (document.getElementById('co-perm-user') || {}).value || '';
            u = u.trim();
            if (!u) { if (permStatus) permStatus.textContent = '请填写用户名'; return; }
            var perms = batchPermGet();
            delete perms[u];
            batchPermSave(perms);
            if (permStatus) permStatus.textContent = '已删除';
            renderPermList();
          };
          // checkbox 监听
          var tagCbs = document.querySelectorAll('.co-batch-skill');
          var tagWrap = document.getElementById('co-batch-tag-wrap');
          function syncTagWrap() {
            var checked = false;
            for (var ci = 0; ci < tagCbs.length; ci++) { if (tagCbs[ci].value === '加标签' && tagCbs[ci].checked) { checked = true; break; } }
            if (tagWrap) tagWrap.style.display = checked ? 'block' : 'none';
          }
          for (var ti = 0; ti < tagCbs.length; ti++) {
            if (tagCbs[ti].value === '加标签') { tagCbs[ti].addEventListener('change', syncTagWrap); }
          }
          syncTagWrap();
          var syncSkipWrap = document.getElementById('co-batch-sync-skip-wrap');
          function syncSkipWrapToggle() {
            var checked = false;
            for (var ci = 0; ci < tagCbs.length; ci++) { if (tagCbs[ci].value === '回捞' && tagCbs[ci].checked) { checked = true; break; } }
            if (syncSkipWrap) syncSkipWrap.style.display = checked ? 'flex' : 'none';
          }
          for (var ti2 = 0; ti2 < tagCbs.length; ti2++) {
            if (tagCbs[ti2].value === '回捞') { tagCbs[ti2].addEventListener('change', syncSkipWrapToggle); }
          }
          syncSkipWrapToggle();
          // 刷新后恢复：重建已有活跃任务的进度卡片并恢复轮询
          (function restoreActiveTasks() {
            var raw = GM_getValue('tuopin_batch_tasks', '');
            if (!raw) return;
            var tasks;
            try { tasks = JSON.parse(raw); } catch(e) { return; }
            var activeCount = 0;
            Object.keys(tasks).forEach(function(tid) {
              var t = tasks[tid];
              if (!t || !t.ids || t.idx == null) return;
              if (t._terminated) return;  // 已终止，跳过
              renderActiveTask(tid, t);
              // 恢复查询结果 tab
              if (t.queryResults && t.queryResults.length) {
                renderResultTab(tid, t.queryResults, t.queryLabel || tid);
              }
              if (!t._stopped) startTaskPolling(tid);
              activeCount++;
            });
            // 有活跃任务时自动切到 batch tab 并提示
            if (activeCount > 0) {
              if (typeof coSwitchTab === 'function') coSwitchTab('batch');
              batchRunLog('已恢复 ' + activeCount + ' 个进行中的任务');
            }
          })();
        })();
        (function() {
          var amtEl = document.getElementById('tuopin-shequn-amount');
          var totalPriceEl = document.getElementById('tuopin-shequn-totalprice');
          var unitPriceEl = document.getElementById('tuopin-shequn-unitprice');
          var goodsNameEl = document.getElementById('tuopin-shequn-goodsname');
          var cleanLinkEl = document.getElementById('tuopin-shequn-cleanlink');
          var emailEl = document.getElementById('tuopin-shequn-email');
          var codeEl = document.getElementById('tuopin-shequn-code');
          var goBtn = document.getElementById('tuopin-shequn-go');
          var logEl = document.getElementById('tuopin-shequn-log');
          var rateEl = document.getElementById('shequn-comm-rate');
          var amtDisplayEl = document.getElementById('shequn-comm-amt');

          // 渠道 code 初始化（社群独立，用 tuopin_shequn_code）
          if (codeEl) {
            codeEl.value = GM_getValue('tuopin_shequn_code', '');
            codeEl.onblur = function() { GM_setValue('tuopin_shequn_code', this.value.trim()); };
          }

          // 显示上次创建的表单链接
          (function showLastFormUrl() {
            try {
              var urlMap = JSON.parse(GM_getValue('tuopin_subsidy_form_urls', '{}'));
              var lastUrl = urlMap[String(CO_ARTICLE_ID)];
              if (lastUrl && logEl) {
                logEl.innerHTML = '上次表单: <a href="' + lastUrl + '" target="_blank" style="color:#1890ff;text-decoration:underline;">' + lastUrl + '</a>';
              }
            } catch(e) {}
          })();

          // 渲染今日社群补贴记录（本地，仅当天）
          function renderShequnToday() {
            var box = document.getElementById('tuopin-shequn-today-list');
            if (!box) return;
            var rec = {};
            try { rec = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
            // 跨天判定：存储 date 不是今天则视为无记录，并主动清掉过期数据
            var todayKey = (function(){ var d = new Date(); var p = function(n){return n<10?'0'+n:''+n;}; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); })();
            if (rec.date !== todayKey) {
              if (rec.date) { try { GM_setValue('tuopin_shequn_today_forms', JSON.stringify({ date: todayKey, list: [] })); } catch(e) {} }
              box.innerHTML = '<div style="color:#bbb;">暂无记录</div>';
              return;
            }
            var lst = rec.list || [];
            if (!lst.length) {
              box.innerHTML = '<div style="color:#bbb;">暂无记录</div>';
              return;
            }
            var html = '';
            for (var i = lst.length - 1; i >= 0; i--) {
              var it = lst[i];
              var safeName = String(it.name || '').replace(/</g, '&lt;');
              var displayLink = it.wxLink || it.url;
              var safeLink = String(displayLink || '').replace(/</g, '&lt;');
              html += '<div style="margin-bottom:5px;padding:4px 5px;background:#fafafa;border-radius:3px;">'
                + '<div style="color:#333;margin-bottom:2px;">' + safeName + '</div>'
                + '<div style="display:flex;justify-content:space-between;align-items:flex-start;">'
                + '<a href="' + displayLink + '" target="_blank" style="color:#1890ff;text-decoration:none;word-break:break-all;font-size:10px;">' + safeLink + '</a>'
                + '<span style="color:#bbb;flex-shrink:0;margin-left:6px;font-size:10px;">' + (it.time || '') + '</span>'
                + '</div></div>';
            }
            box.innerHTML = html;
          }
          renderShequnToday();
          // 清空今日补贴明细（本地记录）
          var todayClearBtn = document.getElementById('tuopin-shequn-today-clear');
          if (todayClearBtn) todayClearBtn.onclick = function() {
            if (!confirm('确定清空今日补贴明细记录？')) return;
            GM_setValue('tuopin_shequn_today_forms', '{}');
            renderShequnToday();
          };
          // 面板打开时异步补充缺失的小程序链接
          // 先拉取列表页HTML提取 formId→biaodanKey 映射，再批量调接口
          (function patchWxLinksFromPanel() {
            var rec3 = {};
            try { rec3 = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
            // 仅处理当天记录，跨天不补
            var todayKey3 = (function(){ var d = new Date(); var p = function(n){return n<10?'0'+n:''+n;}; return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); })();
            if (rec3.date !== todayKey3) return;
            var lst3 = rec3.list || [];
            var missing = lst3.filter(function(it) {
              if (it.wxLink) return false;
              var fid = it.formId || (it.url && it.url.match(/\/(\d+)\/?$/) ? it.url.match(/\/(\d+)\/?$/)[1] : '');
              return !!fid;
            });
            if (!missing.length) return;
            // 拉取列表页HTML，解析 formId→biaodan_key 映射
            GM_xmlhttpRequest({
              method: 'GET',
              url: 'http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3',
              onload: function(resp) {
                // 提取所有 <input type="checkbox" value="FORMID"> 和同行 data-biaodan-key
                // 列表页结构：checkbox value=formId 和 .copy-wx-shortlink-btn data-biaodan-key 在同一 <tr>
                // 从HTML文本用正则提取：找每个 <tr>...</tr> 里同时含 checkbox value 和 data-biaodan-key
                var html = resp.responseText;
                var fidKeyMap = {};
                // 匹配 data-biaodan-key="KEY" 附近的 checkbox value="FID"
                var trReg = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
                var trMatch;
                while ((trMatch = trReg.exec(html)) !== null) {
                  var trContent = trMatch[1];
                  var fidM = trContent.match(/type="checkbox"[^>]*value="(\d+)"/);
                  var keyM = trContent.match(/data-biaodan-key="([a-f0-9]+)"/);
                  if (fidM && keyM) fidKeyMap[fidM[1]] = keyM[1];
                }
                // 对每条缺失记录查biaodan_key，调接口
                var pending = 0;
                missing.forEach(function(entry) {
                  var fid = entry.formId || (entry.url && entry.url.match(/\/(\d+)\/?$/) ? entry.url.match(/\/(\d+)\/?$/)[1] : '');
                  var key = fidKeyMap[fid];
                  if (!key) return;
                  pending++;
                  GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://biaodan.bgm.smzdm.com/biaodan/ajax_wx_miniprogram_short_link',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: 'biaodan_key=' + key,
                    onload: function(r) {
                      try {
                        var res = JSON.parse(r.responseText);
                        if (res && res.error_code === 0 && res.data && res.data.link) {
                          var rec4 = {};
                          try { rec4 = JSON.parse(GM_getValue('tuopin_shequn_today_forms', '{}')); } catch(e) {}
                          var lst4 = rec4.list || [];
                          for (var k = 0; k < lst4.length; k++) {
                            var kfid = lst4[k].formId || (lst4[k].url && lst4[k].url.match(/\/(\d+)\/?$/) ? lst4[k].url.match(/\/(\d+)\/?$/)[1] : '');
                            if (kfid === fid) { lst4[k].wxLink = res.data.link; if (!lst4[k].formId) lst4[k].formId = fid; break; }
                          }
                          rec4.list = lst4;
                          GM_setValue('tuopin_shequn_today_forms', JSON.stringify(rec4));
                        }
                      } catch(e) {}
                      pending--;
                      if (pending <= 0) renderShequnToday();
                    },
                    onerror: function() { pending--; if (pending <= 0) renderShequnToday(); }
                  });
                });
              },
              onerror: function() {}
            });
          })();

          // 实际总价和件数从接口回调填入
          var pageTotal = 0;
          var pageQty = 1;

          // 根据实际总价、补贴金额重新计算到手总价/单价
          function recalcPrices() {
            var sub = parseFloat((amtEl && amtEl.value) || '0') || 0;
            var totalAfter = pageTotal > 0 ? Math.round((pageTotal - sub) * 100) / 100 : 0;
            if (totalPriceEl) totalPriceEl.value = totalAfter > 0 ? totalAfter : '';
            var unitAfter = (totalAfter > 0 && pageQty > 0) ? Math.round(totalAfter / pageQty * 100) / 100 : 0;
            if (unitPriceEl) unitPriceEl.value = unitAfter > 0 ? unitAfter : '';
          }

          // 补贴金额变化时重算
          if (amtEl) amtEl.addEventListener('input', recalcPrices);
          var __shequnCommRate = '';
          var __shequnMall = '';
          function shequnLog(msg) { if (logEl) logEl.textContent = msg; }
          // 读取上次邮箱
          if (emailEl) emailEl.value = GM_getValue('tuopin_selected_email', '');
          // 查询佣比：通过 article_detail 接口获取商品链接，再查佣比
          (function queryShequnComm() {
            if (!CO_ARTICLE_ID) { if (rateEl) { rateEl.textContent = '无文章ID'; rateEl.style.color = '#999'; } return; }
            if (rateEl) { rateEl.textContent = '查询中...'; rateEl.style.color = '#999'; }
            GM_xmlhttpRequest({
              method: 'POST',
              url: 'http://youhui.bgm.smzdm.com/youhui_action/ajax_get_article_detail',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
              data: 'article_id=' + CO_ARTICLE_ID + '&channel_id=1',
              timeout: 10000,
              onload: function(r) {
                var productUrl = '';
                try {
                  var d = JSON.parse(r.responseText);
                  productUrl = d.article_clean_link || d.article_direct_link || '';
                  // 自动填充商品名（未手动填写时）
                  if (goodsNameEl && !goodsNameEl.value && d.article_title) goodsNameEl.value = d.article_title;
                  // 自动填充干净链接（未手动填写时）
                  if (cleanLinkEl && !cleanLinkEl.value && productUrl) cleanLinkEl.value = productUrl;
                  // 从接口取商城名称
                  if (d.article_mall) __shequnMall = d.article_mall;
                  // 临时日志：确认 article_mall 原始值
                  shequnLog('商城字段: article_mall=' + (d.article_mall || '(空)'));
                  // 从接口取实际总价和件数，赋值后触发重算
                  var apiTotal = parseFloat(d.article_final_price || '0') || 0;
                  var apiQty = parseInt(d.article_youhui_num || '1') || 1;
                  if (apiTotal > 0) { pageTotal = apiTotal; pageQty = apiQty; recalcPrices(); }
                } catch(e) {}
                if (!productUrl) { if (rateEl) { rateEl.textContent = '-'; rateEl.style.color = '#999'; } return; }
                GM_xmlhttpRequest({
                  method: 'GET',
                  url: 'https://commission-bgm.agentdevops.zdm.net/commission/?url=' + encodeURIComponent(productUrl),
                  timeout: 15000,
                  onload: function(resp) {
                    try {
                      var data = JSON.parse(resp.responseText || '{}');
                      if (!data.ok) { if (rateEl) { rateEl.textContent = '-'; rateEl.style.color = '#999'; } return; }
                      var ratioNum = parseFloat(data.ratioPC);
                      var ratioPct = isNaN(ratioNum) ? '' : (ratioNum * 100).toFixed(2);
                      __shequnCommRate = ratioPct || '';
                      if (rateEl) { rateEl.textContent = ratioPct ? (ratioPct + '%') : '-'; rateEl.style.color = ratioPct ? '#52c41a' : '#999'; }
                      // 计算订单佣金：从 article_detail 取到手价
                      try {
                        var d2 = JSON.parse(r.responseText);
                        var deal = parseFloat(d2.article_final_price || d2.article_deal_price || '0') || 0;
                        if (deal > 0 && ratioPct) {
                          var comm = Math.round(deal * (parseFloat(ratioPct) / 100) * 100) / 100;
                          if (amtDisplayEl) { amtDisplayEl.textContent = comm.toFixed(2) + '元'; amtDisplayEl.style.color = '#52c41a'; }
                        }
                      } catch(e2) {}
                    } catch(e) { if (rateEl) { rateEl.textContent = '解析失败'; rateEl.style.color = '#ff4d4f'; } }
                  },
                  onerror: function() { if (rateEl) { rateEl.textContent = '查询失败'; rateEl.style.color = '#ff4d4f'; } },
                  ontimeout: function() { if (rateEl) { rateEl.textContent = '查询超时'; rateEl.style.color = '#ff4d4f'; } }
                });
              },
              onerror: function() { if (rateEl) { rateEl.textContent = '-'; rateEl.style.color = '#999'; } }
            });
          })();
          if (!goBtn) return;
          goBtn.onclick = function() {
            var amt = parseFloat((amtEl && amtEl.value) || '0');
            var totalPrice = parseFloat((totalPriceEl && totalPriceEl.value) || '0');
            var email = (emailEl && emailEl.value.trim()) || '';
            var goodsName = (goodsNameEl && goodsNameEl.value.trim()) || '';
            var cleanLink = (cleanLinkEl && cleanLinkEl.value.trim()) || '';
            if (!amt || amt <= 0) {
              shequnLog('请填写补贴金额');
              if (amtEl) {
                amtEl.style.borderColor = '#ff4d4f';
                amtEl.focus();
                var _restoreAmt = function() { amtEl.style.borderColor = ''; amtEl.removeEventListener('input', _restoreAmt); };
                amtEl.addEventListener('input', _restoreAmt);
              }
              return;
            }
            if (!email) { shequnLog('请填写邮箱'); return; }
            // 优先用接口返回的商城，fallback 从 cleanLink 域名推断
            var mallName = __shequnMall || '淘系';
            if (!__shequnMall && cleanLink) {
              if (cleanLink.indexOf('jd.com') >= 0) mallName = '京东';
              else if (cleanLink.indexOf('tmall.com') >= 0 || cleanLink.indexOf('taobao.com') >= 0) mallName = '淘系';
              else if (cleanLink.indexOf('xiaomi.com') >= 0 || cleanLink.indexOf('mi.com') >= 0 || cleanLink.indexOf('youpin') >= 0) mallName = '小米有品';
              else if (cleanLink.indexOf('pinduoduo.com') >= 0 || cleanLink.indexOf('pdd.') >= 0) mallName = '拼多多';
              else if (cleanLink.indexOf('vip.com') >= 0) mallName = '唯品会';
            }
            // 保存邮箱
            GM_setValue('tuopin_selected_email', email);
            // 保存社群 code
            var shequnCode = (codeEl ? codeEl.value.trim() : '') || GM_getValue('tuopin_shequn_code', '');
            if (codeEl) GM_setValue('tuopin_shequn_code', shequnCode);
            // 构造队列项
            var queue = [];
            try { queue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch(e) {}
            queue.push({
              type: 'shequn',
              subsidy: String(amt),
              email: email,
              title: goodsName || (CO_ARTICLE_ID ? ('社群补贴-' + CO_ARTICLE_ID) : '社群补贴'),
              cleanLink: cleanLink,
              dealPrice: String(totalPrice),
              price: String(totalPrice),
              commissionRate: __shequnCommRate || '',
              articleId: CO_ARTICLE_ID || '',
              mall: mallName,
              code: shequnCode
            });
            GM_setValue('tuopin_subsidy_queue', JSON.stringify(queue));
            GM_setValue('tuopin_subsidy_index', '0');
            shequnLog('已加入队列，已在后台标签页开始建表单');
            // 新开后台标签页执行建表单（同大淘客模式）：生成 runId 引导锁，不锁当前编辑页、不启心跳，
            // 不干扰用户手动操作。新标签页凭 ?tuopin_run= 归属锁自己跑补贴队列。
            setTimeout(function() {
              var seq = (parseInt(GM_getValue(TUOPIN_FLOW_SEQ_KEY, '0'), 10) || 0) + 1;
              GM_setValue(TUOPIN_FLOW_SEQ_KEY, String(seq));
              var runId = 's' + seq + 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
              tuopinWriteLock(runId);
              GM_openInTab('http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3?tuopin_run=' + encodeURIComponent(runId), { active: false, insert: true });
            }, 800);
          };
        })();

        // 代码植入 tab 日志
        function injectLog(msg) {
          var box = document.getElementById('tuopin-inject-log');
          if (!box) return;
          var line = document.createElement('div'); line.textContent = msg;
          box.appendChild(line); box.scrollTop = box.scrollHeight;
        }

        // 代码植入历史记录渲染（始终显示该板块，空时提示；默认10条，可展开滚动查看全部）
        var coInjectHistExpanded = false;
        function coRenderInjectHistory() {
          var box = document.getElementById('tuopin-inject-history');
          if (!box) return;
          var hist = [];
          try { hist = JSON.parse(GM_getValue('tuopin_inject_history', '[]')); } catch(e) {}
          if (!hist.length) {
            box.innerHTML = '<div style="font-size:10px;color:#999;margin-bottom:4px;">往期植入记录</div>'
              + '<div style="color:#bbb;font-size:10px;text-align:center;padding:4px;">暂无植入记录</div>';
            return;
          }
          var all = hist.slice().reverse();
          var LIMIT = 10;
          var list = coInjectHistExpanded ? all : all.slice(0, LIMIT);
          var html = '<div style="font-size:10px;color:#999;margin-bottom:4px;">往期植入记录</div>';
          list.forEach(function(r) {
            html += '<div style="padding:3px 0;border-bottom:1px solid #f5f5f5;font-size:10px;color:#666;cursor:pointer;" data-code="' + encodeURIComponent(r.code) + '">'
              + '<span style="color:#1890ff;">[' + r.time + ']</span> '
              + '<span style="color:#333;">' + r.preview + '</span></div>';
          });
          if (all.length > LIMIT) {
            html += '<div id="tuopin-inject-history-toggle" style="text-align:center;color:#1890ff;font-size:10px;padding:4px;cursor:pointer;">'
              + (coInjectHistExpanded ? '收起 ▲' : '展开全部（' + all.length + ' 条）▼') + '</div>';
          }
          box.innerHTML = html;
          // 点击记录回填 textarea
          box.querySelectorAll('[data-code]').forEach(function(el) {
            el.onclick = function() {
              var ta = document.getElementById('tuopin-inject-code');
              if (ta) ta.value = decodeURIComponent(el.getAttribute('data-code'));
            };
          });
          var toggle = document.getElementById('tuopin-inject-history-toggle');
          if (toggle) toggle.onclick = function(){ coInjectHistExpanded = !coInjectHistExpanded; coRenderInjectHistory(); };
        }
        coRenderInjectHistory();

        // 代码植入 确认按钮 — 取 textarea 内容存储后打开后台执行
        var injectBtn = document.getElementById('tuopin-inject-go');
        if (injectBtn) injectBtn.onclick = function() {
          var code = (document.getElementById('tuopin-inject-code').value || '').trim();
          if (!code) return alert('请填写要植入的代码');
          GM_setValue('tuopin_inject_code', code);
          // 存入历史记录
          var hist = [];
          try { hist = JSON.parse(GM_getValue('tuopin_inject_history', '[]')); } catch(e) {}
          var now = new Date(); var p = function(n){return n<10?'0'+n:''+n;};
          var timeStr = p(now.getMonth()+1)+'-'+p(now.getDate())+' '+p(now.getHours())+':'+p(now.getMinutes());
          hist.push({ time: timeStr, preview: code.replace(/<[^>]+>/g,'').slice(0,20) || code.slice(0,20), code: code });
          if (hist.length > 20) hist = hist.slice(-20);
          GM_setValue('tuopin_inject_history', JSON.stringify(hist));
          coRenderInjectHistory();
          injectLog('→ 后台静默执行代码植入...');
          GM_openInTab('http://youhui.bgm.smzdm.com/edit_youhui/' + CO_ARTICLE_ID + '?tuopin_inject=1', { active: false, insert: true });
        };

        // 任务 tab 队列渲染
        // 渲染：时段展示 + 剩余数 + 最近可配置（基于共享端缓存）
        function coRenderSlotsAll() {
          var slots = coSlotsCache.slots || [];
          var claimed = coSlotsCache.claimed || [];
          var claimedSet = {};
          claimed.forEach(function(c){ claimedSet[c.startTime] = c; });
          var now = new Date();
          var nowStr = coNowStr();
          var AVAIL_MIN = 20; // 结束时间距现在 >= 20 分钟则可配
          // 可配：未被认领 且 结束时间距现在 >= 20 分钟
          var avail = slots.filter(function(s){
            if (claimedSet[s.startTime]) return false;
            var endDt = coParseTimeStr(s.endTime);
            if (!endDt) return false;
            return (endDt - now) >= AVAIL_MIN * 60 * 1000;
          });
          avail.sort(function(a,b){ return (a.startTime||'').localeCompare(b.startTime||''); });

          // 时段展示列表
          var disp = document.getElementById('tuopin-task-slot-display');
          if (disp) {
            if (!slots.length) {
              disp.innerHTML = '<div style="color:#bbb;text-align:center;padding:6px;">今日未配置时段，点"编辑"录入</div>';
            } else {
              var html = '';
              slots.forEach(function(s){
                var st = (s.startTime||'').slice(11,16), et = (s.endTime||'').slice(11,16);
                var cl = claimedSet[s.startTime];
                var endDt = coParseTimeStr(s.endTime);
                var expired = !endDt || (endDt - now) < AVAIL_MIN * 60 * 1000;
                var tag = cl ? '<span style="color:#bbb;">已配('+ (cl.who||'') +')</span>'
                        : (expired ? '<span style="color:#d9d9d9;">已过</span>' : '<span style="color:#52c41a;">可配</span>');
                html += '<div style="padding:3px 0;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;font-size:10px;">'
                  + '<span style="color:#333;">'+st+'~'+et+'</span>'+tag+'</div>';
              });
              disp.innerHTML = html;
            }
          }
          // 剩余数
          var numEl = document.getElementById('tuopin-task-remain-num');
          if (numEl) numEl.textContent = avail.length;
          // 最近可配置：优先当前进行中时段（已开始且结束时间 >= 20 分钟后），否则取最近未来时段
          var slotEl = document.getElementById('tuopin-task-next-slot-val');
          if (slotEl) {
            if (!avail.length) { slotEl.textContent='无（已无可配时段）'; slotEl.style.color='#ff4d4f'; }
            else {
              // avail 已按 startTime 升序；取第一个（最早的可配时段，包含当前进行中）
              slotEl.textContent=(avail[0].startTime||'').slice(11,16)+'~'+(avail[0].endTime||'').slice(11,16);
              slotEl.style.color='#1890ff';
            }
          }
        }

        // 今日各时段配置情况（全同事，来自共享端 claimed，按当前选中活动ID过滤明细；默认5条，可展开滚动查看全部）
        var coTaskDoneExpanded = false;
        function coRenderTaskDoneToday() {
          var box = document.getElementById('tuopin-task-done-today');
          if (!box) return;
          var slots = coSlotsCache.slots || [];
          var claimed = coSlotsCache.claimed || [];
          var curActId = (coIsAdmin ? (document.getElementById('tuopin-task-actid-sel') || {}).value : '') || GM_getValue('tuopin_actid_cur', '1261');
          var claimedMap = {};
          claimed.forEach(function(c){ claimedMap[c.startTime] = c; });
          if (!slots.length) { box.innerHTML = '<div style="color:#bbb;text-align:center;padding:4px;">今日未配置时段</div>'; return; }
          var items = [];
          slots.forEach(function(s){
            var cl = claimedMap[s.startTime];
            var st = (s.startTime||'').slice(11,16), et = (s.endTime||'').slice(11,16);
            var timeStr = st + '~' + et;
            if (!cl) {
              // 未配置，不显示
              return;
            }
            if ((cl.activityId || '') !== curActId) {
              items.push('<div style="padding:4px 0;border-bottom:1px solid #f5f5f5;">'
                + '<div style="color:#999;font-size:11px;">已配（' + (cl.who||'') + '·活动' + (cl.activityId||'') + '）</div>'
                + '<div style="color:#ccc;font-size:9px;margin-top:1px;">' + timeStr + '</div>'
                + '</div>');
              return;
            }
            items.push('<div style="padding:4px 0;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;gap:4px;">'
              + '<div style="flex:1;min-width:0;">'
              + '<div style="color:#52c41a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (cl.description||'-') + '</div>'
              + '<div style="color:#999;font-size:9px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
              + timeStr + '&nbsp;·&nbsp;' + (cl.who||'') + '&nbsp;·&nbsp;<a href="' + (cl.articleUrl||'') + '" target="_blank" style="color:#1890ff;">' + (cl.articleId||'-') + '</a>'
              + '&nbsp;¥' + (cl.price||'-') + '</div>'
              + '</div>'
              + '<button class="co-task-repub" data-stime="' + (cl.startTime||'') + '" style="flex-shrink:0;padding:2px 6px;font-size:9px;background:#ff7a00;color:#fff;border:none;border-radius:3px;cursor:pointer;white-space:nowrap;">发布</button>'
              + (coIsAdmin ? '<button class="co-task-del" data-stime="' + (cl.startTime||'') + '" style="flex-shrink:0;padding:2px 6px;font-size:9px;background:#ff4d4f;color:#fff;border:none;border-radius:3px;cursor:pointer;white-space:nowrap;">删除</button>' : '')
              + '</div>');
          });
          var html = '<div style="color:#bbb;font-size:9px;margin-bottom:3px;">仅展开活动ID：' + curActId + ' 的明细</div>';
          if (!items.length) { html += '<div style="color:#bbb;text-align:center;padding:6px;">今日暂无配置记录</div>'; box.innerHTML = html; return; }
          items.reverse();
          var LIMIT = 5;
          var show = coTaskDoneExpanded ? items : items.slice(0, LIMIT);
          html += show.join('');
          if (items.length > LIMIT) {
            html += '<div id="tuopin-task-done-toggle" style="text-align:center;color:#1890ff;font-size:10px;padding:4px;cursor:pointer;">'
              + (coTaskDoneExpanded ? '收起 ▲' : '展开全部（' + items.length + ' 条）▼') + '</div>';
          }
          box.innerHTML = html;
          var toggle = document.getElementById('tuopin-task-done-toggle');
          if (toggle) toggle.onclick = function(){ coTaskDoneExpanded = !coTaskDoneExpanded; coRenderTaskDoneToday(); };
          // 发布按钮：用已占位的 claimed 数据直接打开 task-bgm，并回显创建结果
          box.querySelectorAll('.co-task-repub').forEach(function(btn) {
            btn.onclick = function(e) {
              e.stopPropagation();
              var stime = btn.getAttribute('data-stime');
              var cl2 = (coSlotsCache.claimed || []).filter(function(c) { return c.startTime === stime; })[0];
              if (!cl2) { alert('找不到该时段信息，请刷新后重试'); return; }
              var params = {
                articleId: cl2.articleId || '', articleUrl: cl2.articleUrl || '',
                taskName: cl2.taskName || '', articleTitle: cl2.description || '',
                description: cl2.description || '', price: cl2.price || '',
                activityId: cl2.activityId || '', rewardId: cl2.rewardId || '',
                startTime: cl2.startTime || '', endTime: cl2.endTime || '', who: cl2.who || ''
              };
              // 重置上次结果，按钮进入"发布中"状态
              GM_setValue('tuopin_task_result', '');
              btn.disabled = true;
              btn.textContent = '发布中...';
              btn.style.background = '#aaa';
              GM_setValue('tuopin_pending_task', JSON.stringify(params));
              GM_openInTab('https://task-bgm.smzdm.com/#/task/create?tuopin_task=1', { active: false, insert: true });
              // 轮询创建结果（最多 45s）
              var pollCount = 0;
              var pollItv = setInterval(function() {
                var raw = GM_getValue('tuopin_task_result', '');
                if (!raw) { if (++pollCount > 90) { clearInterval(pollItv); btn.disabled = false; btn.textContent = '发布'; btn.style.background = '#ff7a00'; } return; }
                clearInterval(pollItv);
                GM_setValue('tuopin_task_result', '');
                try {
                  var res = JSON.parse(raw);
                  var logEl3 = document.getElementById('tuopin-task-log');
                  if (res.ok) {
                    btn.style.background = '#52c41a'; btn.textContent = '✓ 成功';
                    if (logEl3) logEl3.textContent = '✓ 任务创建成功（' + (stime||'').slice(11,16) + '）';
                  } else {
                    btn.style.background = '#ff4d4f'; btn.textContent = '✗ 失败';
                    if (logEl3) logEl3.textContent = '✗ 创建失败（' + (stime||'').slice(11,16) + '）：' + (res.msg || '');
                  }
                  btn.disabled = false;
                  // 5s 后按钮恢复
                  setTimeout(function() { if (btn.parentNode) { btn.style.background = '#ff7a00'; btn.textContent = '发布'; } }, 5000);
                } catch(e) {}
              }, 500);
            };
          });
          // 删除按钮（仅管理员）：释放该时段供其他任务占用
          box.querySelectorAll('.co-task-del').forEach(function(btn) {
            btn.onclick = function(e) {
              e.stopPropagation();
              if (!confirm('确定释放该时段？释放后其他任务可占用')) return;
              var stime = btn.getAttribute('data-stime');
              var who = GM_getValue('tuopin_my_name', '') || '';
              btn.disabled = true; btn.textContent = '...';
              coSlotsRelease(stime, who, function(res) {
                if (res && res.ok) {
                  coSlotsCache.claimed = (coSlotsCache.claimed || []).filter(function(c){ return c.startTime !== stime; });
                  try { GM_setValue('tuopin_slots_cache', JSON.stringify({ date: coSlotsCache.date, slots: coSlotsCache.slots, claimed: coSlotsCache.claimed })); } catch(e2){}
                  coRenderTaskDoneToday();
                } else {
                  var errMsg = (res && res.error) || '';
                  alert('释放失败：' + (errMsg === 'no_permission' ? '仅管理员可删除' : (errMsg === 'not_claimed' ? '该时段未被占用' : errMsg)));
                  btn.disabled = false; btn.textContent = '删除';
                }
              });
            };
          });
        }

        // 拉 relay 最新状态并渲染（SSE init 事件是主渲染路径，此函数用于手动刷新/管理员推送后强制更新）
        function coRefreshSlots() {
          var btn = document.getElementById('tuopin-task-go');
          coSlotsGet(function(data){
            var newClaimed = coSlotsCache.claimed || [];
            var todayStr = coTodayStr();
            var rawSlots = coSlotsCache.slots || [];
            var newSlots = rawSlots.map(function(s){
              return {
                startTime: todayStr + (s.startTime||'').slice(10),
                endTime: todayStr + (s.endTime||'').slice(10)
              };
            });
            if (!newSlots.length) {
              try {
                var localPattern = JSON.parse(GM_getValue('tuopin_task_schedule','[]'));
                newSlots = localPattern.map(function(s){
                  return {
                    startTime: todayStr + (s.startTime||'').slice(10),
                    endTime: todayStr + (s.endTime||'').slice(10)
                  };
                });
              } catch(e){}
            }
            coSlotsCache.slots = newSlots;
            coSlotsCache.claimed = newClaimed;
            GM_setValue('tuopin_task_schedule', JSON.stringify(newSlots));
            coRenderSlotsAll();
            coRenderTaskDoneToday();
            if (btn) { btn.disabled = false; btn.textContent = '发布任务'; btn.style.background = '#ff7a00'; }
            // 缓存最新槽位数据，供下次打开时即时渲染
            try { GM_setValue('tuopin_slots_cache', JSON.stringify({ date: coSlotsCache.date, slots: coSlotsCache.slots, claimed: coSlotsCache.claimed })); } catch(e) {}
          });
        }

        // SSE 实时订阅：有人取号时立刻推给所有打开面板的同事
        var coSSE = null;
        function coStartSSE() {
          try {
            if (coSSE) { try { coSSE.close(); } catch(e){} coSSE = null; }
            coSSE = new EventSource(RELAY + '/taskslots/stream?date=' + encodeURIComponent(coTodayStr()));
            coSSE.onmessage = function(e) {
              try {
                var d = JSON.parse(e.data);
                if (d.slots !== undefined) coSlotsCache.slots = d.slots;
                if (d.claimed !== undefined) coSlotsCache.claimed = d.claimed;
                coRenderSlotsAll();
                coRenderTaskDoneToday();
                try { GM_setValue('tuopin_slots_cache', JSON.stringify({ date: coSlotsCache.date, slots: coSlotsCache.slots, claimed: coSlotsCache.claimed })); } catch(ex2) {}
              } catch(ex) {}
            };
            coSSE.onerror = function() { /* 浏览器自动重连 */ };
          } catch(e) {}
        }
        coStartSSE();
        coRefreshSlots(); // 页面加载时主动拉一次兜底（SSE init 可能延迟）
        if (coSlotsCache.slots.length) coRenderSlotsAll(); // 有本地缓存时立即渲染，不等 relay 返回
        // 跨天时重启 SSE（防止订阅昨天的 date）
        var _sseDate = coTodayStr();
        setInterval(function() {
          var d = coTodayStr();
          if (d !== _sseDate) { _sseDate = d; coStartSSE(); }
        }, 60000);

        // 管理员电脑自动静默注册到 relay 名单（复用 taskslots，date="_admin_seats_"）
        if (coIsAdmin) {
          var _machineId = GM_getValue('tuopin_machine_id', '');
          if (!_machineId) { _machineId = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); GM_setValue('tuopin_machine_id', _machineId); }
        }

        // 活动/奖励 ID：下拉框 + 新增（历史存 GM，形式同补贴填邮箱）
        function dsLoadIdList(key, defaults) {
          var list = [];
          try { list = JSON.parse(GM_getValue(key, '[]')); } catch(e) {}
          if (!list.length) list = defaults.slice();
          return list;
        }
        function dsSaveIdList(key, list) { GM_setValue(key, JSON.stringify(list)); }
        function dsRefreshIdSelect(selId, list, current) {
          var sel = document.getElementById(selId);
          if (!sel) return;
          sel.innerHTML = '';
          list.forEach(function(v){
            var opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            if (v === current) opt.selected = true;
            sel.appendChild(opt);
          });
          if (!list.length) { var o = document.createElement('option'); o.value = ''; o.textContent = '（无）'; sel.appendChild(o); }
        }
        var actIdList = dsLoadIdList('tuopin_actid_list', ['1261']);
        var rewardIdList = dsLoadIdList('tuopin_rewardid_list', ['9398']);
        var curActId = GM_getValue('tuopin_actid_cur', '1261');
        var curRewardId = GM_getValue('tuopin_rewardid_cur', '9398');
        dsRefreshIdSelect('tuopin-task-actid-sel', actIdList, curActId);
        dsRefreshIdSelect('tuopin-task-rewardid-sel', rewardIdList, curRewardId);
        var actidSel = document.getElementById('tuopin-task-actid-sel');
        if (actidSel) actidSel.onchange = function(){ GM_setValue('tuopin_actid_cur', this.value); coRenderTaskDoneToday(); };
        var rewardidSel = document.getElementById('tuopin-task-rewardid-sel');
        if (rewardidSel) rewardidSel.onchange = function(){ GM_setValue('tuopin_rewardid_cur', this.value); };
        var actidAdd = document.getElementById('tuopin-task-actid-add');
        if (actidAdd) actidAdd.onclick = function(){
          var v = (document.getElementById('tuopin-task-actid-input').value || '').trim();
          if (!v) return;
          if (actIdList.indexOf(v) < 0) { actIdList.push(v); dsSaveIdList('tuopin_actid_list', actIdList); }
          GM_setValue('tuopin_actid_cur', v);
          dsRefreshIdSelect('tuopin-task-actid-sel', actIdList, v);
          document.getElementById('tuopin-task-actid-input').value = '';
        };
        var rewardidAdd = document.getElementById('tuopin-task-rewardid-add');
        if (rewardidAdd) rewardidAdd.onclick = function(){
          var v = (document.getElementById('tuopin-task-rewardid-input').value || '').trim();
          if (!v) return;
          if (rewardIdList.indexOf(v) < 0) { rewardIdList.push(v); dsSaveIdList('tuopin_rewardid_list', rewardIdList); }
          GM_setValue('tuopin_rewardid_cur', v);
          dsRefreshIdSelect('tuopin-task-rewardid-sel', rewardIdList, v);
          document.getElementById('tuopin-task-rewardid-input').value = '';
        };

        // 时间排序：编辑 / 确定 两个按钮
        var slotEditBtn = document.getElementById('tuopin-task-slot-edit-btn');
        if (slotEditBtn) slotEditBtn.onclick = function() {
          var ta = document.getElementById('tuopin-task-timesort');
          // 优先用 relay 已同步的 slots，其次本地存储
          var slots = coSlotsCache.slots && coSlotsCache.slots.length ? coSlotsCache.slots : [];
          if (!slots.length) { try { slots = JSON.parse(GM_getValue('tuopin_task_schedule','[]')); } catch(e){} }
          if (ta && !ta.value.trim()) {
            ta.value = slots.map(function(s){ return (s.startTime||'').slice(11) + '\t' + (s.endTime||'').slice(11); }).join('\n');
          }
          document.getElementById('tuopin-task-slot-edit').style.display = 'block';
          document.getElementById('tuopin-task-slot-display').style.display = 'none';
        };

        var slotConfirmBtn = document.getElementById('tuopin-task-slot-confirm-btn');
        if (slotConfirmBtn) slotConfirmBtn.onclick = function() {
          var raw = (document.getElementById('tuopin-task-timesort').value || '').trim();
          if (!raw) return alert('请填写时间段');
          var lines = raw.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
          var now = new Date();
          var tp = function(n){return n<10?'0'+n:''+n;};
          var dateStr = now.getFullYear()+'-'+tp(now.getMonth()+1)+'-'+tp(now.getDate());
          var nextDate = new Date(now); nextDate.setDate(nextDate.getDate() + 1);
          var nextDateStr = nextDate.getFullYear()+'-'+tp(nextDate.getMonth()+1)+'-'+tp(nextDate.getDate());
          var slots = [];
          lines.forEach(function(line){
            var cols = line.split(/\t|\s+/).map(function(s){return s.trim();}).filter(Boolean);
            if (cols.length >= 2) {
              var st = cols[0], et = cols[1];
              var startFull = dateStr + ' ' + st;
              var endFull = (/^0:00:00$|^00:00:00$/.test(et)) ? nextDateStr + ' ' + et : dateStr + ' ' + et;
              slots.push({ startTime: startFull, endTime: endFull });
            }
          });
          if (!slots.length) return alert('未识别到有效时间段');
          var logEl = document.getElementById('tuopin-task-sortlog');
          if (logEl) logEl.textContent = '⏳ 正在保存到共享端...';
          // 保存到共享端 + 本地兜底（不清除本地）
          coSlotsSet(slots, function(res){
            if (res && res.ok) {
              GM_setValue('tuopin_task_schedule', JSON.stringify(slots));
              if (logEl) logEl.textContent = '✓ 已保存 ' + slots.length + ' 个时段到共享端';
              // 切回展示
              document.getElementById('tuopin-task-slot-edit').style.display = 'none';
              document.getElementById('tuopin-task-slot-display').style.display = 'block';
              coRefreshSlots();
            } else {
              if (logEl) logEl.textContent = '✗ 保存失败：' + (res && res.error || 'relay unreachable') + '（仅存本地）';
              GM_setValue('tuopin_task_schedule', JSON.stringify(slots));
              document.getElementById('tuopin-task-slot-edit').style.display = 'none';
              document.getElementById('tuopin-task-slot-display').style.display = 'block';
              coRefreshSlots();
            }
          });
        };

        // 权限名单：刷新展示区和下拉
        function coWlRefresh(names) {
          var display = document.getElementById('tuopin-task-whitelist-display');
          if (display) display.innerHTML = names.length ? names.map(function(n){ return '<span style="display:inline-block;background:#e6f7ff;border:1px solid #91d5ff;border-radius:3px;padding:0 5px;margin:1px 2px;">'+n+'</span>'; }).join('') : '<span style="color:#bbb;">暂无</span>';
          var sel = document.getElementById('tuopin-task-wl-del-sel');
          if (sel) { sel.innerHTML = names.map(function(n){ return '<option value="'+n+'">'+n+'</option>'; }).join(''); }
        }

        // 推送名单到 relay
        function coWlSave(names, cb) {
          var logEl = document.getElementById('tuopin-task-whitelist-log');
          if (logEl) logEl.textContent = '⏳ 同步中...';
          GM_setValue('tuopin_task_whitelist', JSON.stringify(names));
          GM_xmlhttpRequest({
            method: 'POST', url: RELAY + '/task/whitelist',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ who: 'handongxue', whitelist: names }),
            timeout: 5000,
            onload: function(r) {
              try {
                var res = JSON.parse(r.responseText || '{}');
                if (logEl) logEl.style.color = res.ok ? '#52c41a' : '#ff4d4f';
                if (logEl) logEl.textContent = res.ok ? ('✓ 已同步，共 ' + names.length + ' 个用户') : ('✗ ' + (res.error || '失败'));
                if (res.ok && cb) {
                  GM_setValue('tuopin_wl_cache', JSON.stringify({ list: names }));
                  cb(names);
                }
              } catch(e) { if (logEl) logEl.textContent = '✗ 解析失败'; }
            },
            onerror: function() { if (logEl) { logEl.style.color='#ff4d4f'; logEl.textContent = '✗ 网络错误'; } }
          });
        }

        // 增加权限按钮
        var wlAddBtn = document.getElementById('tuopin-task-wl-add-btn');
        if (wlAddBtn) wlAddBtn.onclick = function() {
          var inp = document.getElementById('tuopin-task-wl-add-input');
          var name = (inp ? inp.value : '').trim();
          if (!name) return;
          var names = [];
          try { names = JSON.parse(GM_getValue('tuopin_task_whitelist', '[]')); } catch(e) {}
          if (names.indexOf(name) >= 0) {
            var logEl = document.getElementById('tuopin-task-whitelist-log');
            if (logEl) { logEl.style.color = '#faad14'; logEl.textContent = '⚠ ' + name + ' 已在名单中'; }
            return;
          }
          names.push(name);
          coWlSave(names, function(updated) { coWlRefresh(updated); if (inp) inp.value = ''; });
        };

        // 删除权限按钮
        var wlDelBtn = document.getElementById('tuopin-task-wl-del-btn');
        if (wlDelBtn) wlDelBtn.onclick = function() {
          var sel = document.getElementById('tuopin-task-wl-del-sel');
          var name = sel ? sel.value : '';
          if (!name) return;
          var names = [];
          try { names = JSON.parse(GM_getValue('tuopin_task_whitelist', '[]')); } catch(e) {}
          names = names.filter(function(n){ return n !== name; });
          coWlSave(names, function(updated) { coWlRefresh(updated); });
        };

        // 任务 发布按钮
        var taskGoBtn = document.getElementById('tuopin-task-go');
        if (taskGoBtn) taskGoBtn.onclick = function() {
          var artUrl = (document.getElementById('tuopin-task-arturl').value || '').trim();
          if (!artUrl) return alert('请填写文章链接');
          var artIdMatch = artUrl.match(/\/p\/(\d+)/);
          var artId = artIdMatch ? artIdMatch[1] : artUrl;
          var fullArtUrl = artUrl.indexOf('smzdm.com') >= 0 ? artUrl : 'https://www.smzdm.com/p/' + artId + '/';
          var actId = coIsAdmin ? ((document.getElementById('tuopin-task-actid-sel') || {}).value || '1261').trim() : '1261';
          var rewardId = coIsAdmin ? ((document.getElementById('tuopin-task-rewardid-sel') || {}).value || '9398').trim() : '9398';
          var who = (GM_getValue('tuopin_my_name', '') || '匿名');
          if (!who || who === '匿名') {
            alert('用户身份未识别（SSO 未完成），请等待页面完全加载后再试');
            return;
          }

          // 预先算好完整文案（与 task-bgm 自动填表保持一致）
          var articleTitle = coGetArticleTitle ? coGetArticleTitle() : '';
          // 剥掉标题前缀（今日必买：/ 爆卖补货：/ 国家补贴：等），只取商品名部分
          var articleTitleClean = articleTitle.replace(/^[\s\S]*?[：:]\s*/, '').trim() || articleTitle;
          var taskName = articleTitleClean.split(/\s+/)[0].replace(/[【】\[\]「」『』]/g, '');
          var titlePriceMatch = articleTitleClean.match(/([\d.]+)元/);
          var price = titlePriceMatch ? titlePriceMatch[1] : '';
          var productName = price ? articleTitleClean.replace(/\s*[\d.]+元.*/, '').trim() : articleTitleClean;
          var priceSuffix = price ? (' ' + price + '元') : '';
          var actionPart = '，点赞收藏获得抽奖';
          var maxNameLen = 42 - priceSuffix.length - actionPart.length;
          if (productName.length > maxNameLen && maxNameLen > 0) productName = productName.slice(0, maxNameLen);
          var description = productName + priceSuffix + actionPart;

          // 取号：实时拉 relay 找可配时段，点击即占位，成功后开 task-bgm 执行
          coSlotsGet(function(data){
            var slots = coSlotsCache.slots || [];
            var claimed = coSlotsCache.claimed || [];
            var claimedSet = {};
            claimed.forEach(function(c){ claimedSet[c.startTime] = c; });
            var now = new Date();
            var AVAIL_MIN = 20;
            var slot = slots.filter(function(s){
              if (claimedSet[s.startTime]) return false;
              var endDt = coParseTimeStr(s.endTime);
              return endDt && (endDt - now) >= AVAIL_MIN * 60 * 1000;
            }).sort(function(a,b){ return (a.startTime||'').localeCompare(b.startTime||''); })[0];
            if (!slot) {
              alert('当前无可配置时段（今日时段已用完或未配置）');
              return;
            }
            var claimInfo = {
              endTime: slot.endTime, taskName: taskName, description: description,
              articleId: artId, articleUrl: fullArtUrl, price: price,
              activityId: actId, rewardId: rewardId
            };
            // 取号：立即写入 relay 占位（原子操作）
            coSlotsClaim(slot.startTime, who, claimInfo, function(claimRes){
              if (!claimRes || !claimRes.ok) {
                if (claimRes && claimRes.error === 'no_permission') {
                  alert('您没有发布任务的权限，请联系管理员添加');
                } else {
                  alert('该时段已被他人取号：' + (claimRes && claimRes.claimedBy || '') + '，请刷新后重试');
                }
                coRefreshSlots();
                return;
              }
              // 取号成功：更新本地缓存（SSE 会同步给其他人）
              var now2 = new Date(); var pn = function(n){return n<10?'0'+n:''+n;};
              var params = {
                articleId: artId, articleUrl: fullArtUrl, taskName: taskName,
                articleTitle: articleTitle, description: description, price: price,
                activityId: actId, rewardId: rewardId,
                startTime: slot.startTime, endTime: slot.endTime, who: who,
                submitTime: now2.getFullYear()+'-'+pn(now2.getMonth()+1)+'-'+pn(now2.getDate())+' '+pn(now2.getHours())+':'+pn(now2.getMinutes())+':'+pn(now2.getSeconds())
              };
              GM_setValue('tuopin_pending_task', JSON.stringify(params));
              coRefreshSlots();
              var logEl = document.getElementById('tuopin-task-log');
              if (logEl) logEl.textContent = '✓ 已取号 ' + slot.startTime.slice(11,16) + '~' + slot.endTime.slice(11,16) + '，后台执行中...';
              GM_openInTab('https://task-bgm.smzdm.com/#/task/create?tuopin_task=1', { active: false, insert: true });
            });
          });
        };

        // 复选框变化时更新确认按钮显示
        // 监听复选框（事件委托）
        panel.addEventListener('change', function (e) {
          var t = e.target;
          if (t && t.classList.contains('co-select-cb')) coUpdateConfirmBtn();
          if (t && t.classList.contains('co-vid-cb')) {
            var vidBox = document.getElementById('tuopin-co-videos');
            if (vidBox) vidBox.querySelectorAll('[data-co-url]').forEach(function(card) {
              var cb = card.querySelector('.co-vid-cb');
              var actions = card.querySelector('.co-vid-actions');
              if (actions) actions.style.display = (cb && cb.checked) ? '' : 'none';
            });
          }
        });
        // 设为参考图（事件委托）
        panel.addEventListener('click', function (e) {
          var btn = e.target && e.target.classList.contains('co-set-refimg') ? e.target : null;
          if (btn) {
            var url = btn.getAttribute('data-url');
            if (url) { coRefImgAddUrl(url); }
          }
        });
        // 图片加载后显示真实宽高比（如 "1:1 · 镜头2"）
        function coUpdateImgRatio(container, shotIdx) {
          var imgEl = container.querySelector('img');
          var lblEl = container.querySelector('.co-img-lbl');
          if (!imgEl || !lblEl) return;
          function setRatio() {
            var w = imgEl.naturalWidth, h = imgEl.naturalHeight;
            if (!w || !h) return;
            function gcd(a, b) { return b ? gcd(b, a % b) : a; }
            var g = gcd(w, h);
            lblEl.textContent = (w / g) + ':' + (h / g) + ' · 镜头' + shotIdx;
          }
          if (imgEl.complete && imgEl.naturalWidth) { setRatio(); }
          else { imgEl.addEventListener('load', setRatio); }
        }

        // 视频生成核心逻辑（供"用于视频生成"按钮和"确认视频图"按钮共用）
        function coDoVideoGen(selectedUrls) {
          coLog('▶ coDoVideoGen selectedUrls=' + selectedUrls.length + ' url[0]=' + (selectedUrls[0]||'').slice(0,60));
          var vidBox = document.getElementById('tuopin-co-videos');
          if (!vidBox) { coLog('✗ 找不到视频容器'); return; }
          var vidPrompts = [];
          for (var _vi = 0; _vi < 2; _vi++) {
            var _vta = document.getElementById('co-prompt-' + _vi);
            if (_vta && _vta.value.trim()) vidPrompts.push(_vta.value.trim());
          }
          if (!vidPrompts.length) vidPrompts = ['电影切镜，多镜头合并，动态流畅，不改变商品形态'];
          if (vidPrompts.length < 2) vidPrompts.push(vidPrompts[0]);
          // 每条提示词末尾强制追加不改变商品外观约束
          vidPrompts = vidPrompts.map(function(p) {
            return p.replace(/[，,。.]*不改变商品形态[^，,。.]*/, '').replace(/，+$/, '') + '，不改变商品外观形态，镜头运动流畅自然';
          });
          var vidBtn = document.getElementById('tuopin-co-confirm-vid-btn');
          if (vidBtn) { vidBtn.disabled = true; vidBtn.textContent = '⏳ 提交中...'; }
          coLog('▶ 提交视频 (' + selectedUrls.length + ' 张图, ' + VID_MODELS.length + ' 个模型)');
          vidBox.innerHTML = '';
          var savedVids = [], vidDoneCount = 0;
          VID_MODELS.forEach(function(vm, vi) {
            var vc2 = document.createElement('div');
            vc2.style.cssText = 'border:1px solid #eee;border-radius:6px;padding:4px;font-size:10px;';
            vc2.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:6px 0;font-size:10px;">' + vm.name + ' 生成中...</div>';
            vidBox.appendChild(vc2);
            var vPrompt = vidPrompts[vi % vidPrompts.length];
            (function(vi, vc2, vm, vPrompt) {
              coSubmitVideo(vPrompt, selectedUrls, vi,
                function(taskId, modelId) {
                  coLog('✓ 视频' + (vi + 1) + '(' + vm.name + ') 已提交, taskId=' + taskId);
                  try {
                    var cur = JSON.parse(GM_getValue(CO_SESSION_KEY, '{}'));
                    var pts = (cur.pendingTasks || []).filter(function(p) { return p.idx !== vi; });
                    pts.push({ idx: vi, taskId: taskId, modelId: modelId });
                    cur.pendingTasks = pts;
                    GM_setValue(CO_SESSION_KEY, JSON.stringify(cur));
                  } catch(e) {}
                  coPollVideo(taskId, modelId,
                    function(vurl) {
                      vc2.style.position = 'relative';
                      vc2.setAttribute('data-co-url', vurl);
                      vc2.innerHTML = coVidCardHtml(vurl, vm.name + ' · ' + selectedUrls.length + '张合并');
                      coBindCopy(vc2); coUpdateConfirmBtn();
                      savedVids.push(vurl); vidDoneCount++;
                      if (vidBtn && vidDoneCount >= VID_MODELS.length) { vidBtn.disabled = false; vidBtn.textContent = '▶ 确认视频图'; }
                      try {
                        var cur2 = JSON.parse(GM_getValue(CO_SESSION_KEY, '{}'));
                        cur2.pendingTasks = (cur2.pendingTasks || []).filter(function(p) { return p.taskId !== taskId; });
                        cur2.videos = savedVids.slice();
                        GM_setValue(CO_SESSION_KEY, JSON.stringify(cur2));
                      } catch(e) {}
                      coLog('✓ 视频' + (vi + 1) + '(' + vm.name + ') 完成');
                    },
                    function(err) {
                      vc2.innerHTML = '<div style="color:#ff4d4f;text-align:center;padding:6px 0;font-size:10px;">✗ ' + vm.name + ' ' + err + '</div>';
                      vidDoneCount++;
                      if (vidBtn && vidDoneCount >= VID_MODELS.length) { vidBtn.disabled = false; vidBtn.textContent = '▶ 确认视频图'; }
                      coLog('✗ 视频' + (vi + 1) + ' ' + err);
                    }
                  );
                },
                function(err) {
                  vc2.innerHTML = '<div style="color:#ff4d4f;text-align:center;padding:6px 0;font-size:10px;">✗ ' + vm.name + ' 提交失败 ' + err + '</div>';
                  vidDoneCount++;
                  if (vidBtn && vidDoneCount >= VID_MODELS.length) { vidBtn.disabled = false; vidBtn.textContent = '▶ 确认视频图'; }
                  coLog('✗ 视频' + (vi + 1) + ' 提交失败 ' + err);
                }
              );
            })(vi, vc2, vm, vPrompt);
          });
        }

        // 图片/视频操作按钮（用于焦点图/视频生成/视频焦点图）
        panel.addEventListener('click', function (e) {
          var t = e.target;
          if (!t) return;
          var isFocusBtn = t.id === 'tuopin-co-use-focus-btn' || t.classList.contains('co-img-focus') || t.classList.contains('co-vid-focus');
          var isVideoBtn = t.id === 'tuopin-co-use-video-btn' || t.classList.contains('co-img-video');
          if (!isFocusBtn && !isVideoBtn) return;
          // 获取目标 URL
          var imgUrl = t.getAttribute('data-url');
          if (!imgUrl) {
            // 全局按钮：从勾选图取
            var singleChecked = panel.querySelectorAll('#tuopin-co-images .co-select-cb:checked');
            if (!singleChecked.length) return;
            imgUrl = singleChecked[0].getAttribute('data-url');
          }
          if (isVideoBtn) {
            // 收集所有勾选图；没有勾选时只用当前这张
            var videoChecked = panel.querySelectorAll('#tuopin-co-images .co-select-cb:checked');
            var videoUrls = videoChecked.length
              ? Array.prototype.map.call(videoChecked, function(cb) { return cb.getAttribute('data-url'); })
              : [imgUrl];
            coDoVideoGen(videoUrls);
            return;
          }
          // 用于焦点图 / 设置为焦点图
          var isVidFocus = t.classList.contains('co-vid-focus');
          var doFocusWithUrl = function(webUrl) {
            GM_setValue('tuopin_co_confirm_url', webUrl);
            GM_setValue('tuopin_co_confirm_aid', CO_ARTICLE_ID);
            GM_openInTab('http://youhui.bgm.smzdm.com/edit_youhui/' + CO_ARTICLE_ID + '?tuopin_co_confirm=1', { active: false, insert: true });
            coLog('→ 已后台打开编辑页进行焦点图替换: ' + webUrl.slice(0, 80));
            t.disabled = false; t.textContent = isVidFocus ? '设置为焦点图' : '用于焦点图';
          };
          if (isVidFocus) {
            // 视频 → webp → 焦点图（直接调 GW video_to_gif，与 img-to-gif 扩展一致）
            var apiKeyF = GM_getValue(CO_KEY, '');
            if (!apiKeyF) { alert('请先配置 API Key'); return; }
            coLog('⏳ 视频转 webp 中...');
            t.disabled = true; t.textContent = '⏳ 转换中...';
            GM_xmlhttpRequest({
              method: 'POST', url: GW + '/ai-omni-auth/video/video_to_gif',
              headers: { 'Authorization': 'Bearer ' + apiKeyF, 'Content-Type': 'application/json' },
              data: JSON.stringify({ type: 2, video_url: imgUrl, fps: 10, width: 480, quality: 80, upload_img_config: { channel: 12, type: 'youhui', oper: 'aigc' } }),
              timeout: 60000,
              onload: function(r) {
                try {
                  var j = JSON.parse(r.responseText);
                  if (j.error_code !== 0) { coLog('✗ 视频转 webp 失败: ' + (j.error_msg || '未知')); t.disabled = false; t.textContent = '设置为焦点图'; return; }
                  var webpUrl = ((j.data || {}).gif_url || '').replace(/(_source=[^&]*)/, '');
                  if (!webpUrl) { coLog('✗ 视频转 webp 无 URL'); t.disabled = false; t.textContent = '设置为焦点图'; return; }
                  coLog('✓ 视频转 webp 完成: ' + webpUrl.slice(0, 60));
                  doFocusWithUrl(webpUrl);
                } catch(e2) { coLog('✗ 解析失败: ' + e2.message); t.disabled = false; t.textContent = '设置为焦点图'; }
              },
              onerror: function() { coLog('✗ 视频转 webp 请求失败'); t.disabled = false; t.textContent = '设置为焦点图'; },
              ontimeout: function() { coLog('✗ 视频转 webp 超时'); t.disabled = false; t.textContent = '设置为焦点图'; }
            });
            return;
          }
          // 图片焦点图
          if (!imgUrl.startsWith('http')) {
            t.disabled = true; t.textContent = '⏳ 上传中...';
            GM_xmlhttpRequest({
              method: 'POST', url: RELAY + '/pictures/upload',
              headers: { 'Content-Type': 'application/json' },
              data: JSON.stringify({ data_url: imgUrl }), timeout: 15000,
              onload: function(r) {
                try {
                  var j = JSON.parse(r.responseText);
                  if (!j.ok) { coLog('✗ 图片上传失败: ' + (j.error || '未知')); t.disabled = false; t.textContent = '用于焦点图'; return; }
                  doFocusWithUrl(RELAY + '/img/' + j.img_id);
                } catch(e) { coLog('✗ 解析失败: ' + e.message); t.disabled = false; t.textContent = '用于焦点图'; }
              },
              onerror: function() { coLog('✗ 上传请求失败'); t.disabled = false; t.textContent = '用于焦点图'; },
              ontimeout: function() { coLog('✗ 上传超时'); t.disabled = false; t.textContent = '用于焦点图'; }
            });
          } else {
            doFocusWithUrl(imgUrl);
          }
        });
        // 确认填入按钮 / 确认视频图按钮
        panel.addEventListener('click', function (e) {
          var tid = e.target && e.target.id;
          if (tid !== 'tuopin-co-confirm-vid-btn' && tid !== 'tuopin-co-use-keyframe-btn') return;
          e.preventDefault();
          e.stopPropagation();
          if (tid === 'tuopin-co-confirm-vid-btn') {
            var checkedImgs = panel.querySelectorAll('#tuopin-co-images .co-select-cb:checked');
            if (!checkedImgs.length) { alert('请先在图生图区域勾选要合并成视频的图片'); return; }
            var selectedUrls = [];
            checkedImgs.forEach(function (cb) { selectedUrls.push(cb.getAttribute('data-url')); });
            coDoVideoGen(selectedUrls);
          } else if (tid === 'tuopin-co-use-keyframe-btn') {
            var confirmVidBtn2 = document.getElementById('tuopin-co-confirm-vid-btn');
            if (confirmVidBtn2) confirmVidBtn2.click();
          }
        });

        // 重新生成单张图片
        panel.addEventListener('click', function (e) {
          var btn = e.target && e.target.classList.contains('co-regen-img') ? e.target : null;
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var ta = document.getElementById('co-prompt-' + idx);
          var prompt = ta ? ta.value.trim() : '';
          if (!prompt) return;
          var apiKey = GM_getValue(CO_KEY, '');
          if (!apiKey) return alert('请先配置 API Key');
          var imagesBox2 = document.getElementById('tuopin-co-images');
          var imgCards = imagesBox2 ? imagesBox2.children : [];
          var ic2 = imgCards[idx];
          if (!ic2) return;
          var currentImg = (coRefImgUrls.length ? coRefImgUrls[0] : '') || coGetArticleImage();
          ic2.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:8px 0;">图' + (idx + 1) + ' 重新生成中...</div>';
          coLog('↺ 重新生成图' + (idx + 1));
          coCreateImg(prompt, coRefImgUrls.length ? coRefImgUrls : currentImg, idx,
            function (url) {
              coImgMeta[idx] = { prompt: prompt, url: url };
              ic2.setAttribute('data-co-url', url);
              ic2.innerHTML = '<label style="position:absolute;top:6px;left:6px;z-index:2;cursor:pointer;">'
                + '<input type="checkbox" class="co-select-cb" data-url="' + url + '" style="width:14px;height:14px;accent-color:#ff7a00;cursor:pointer;"></label>'
                + '<button class="co-set-refimg" data-url="' + url + '" title="设为参考图" style="position:absolute;top:6px;right:6px;z-index:2;padding:2px 5px;background:rgba(0,0,0,0.55);color:#fff;border:none;border-radius:3px;font-size:9px;cursor:pointer;display:none;">参考图</button>'
                + '<img src="' + url + '" style="width:100%;border-radius:4px;margin-bottom:4px;display:block;">'
                + '<div class="co-img-lbl" style="color:#bbb;font-size:9px;text-align:center;margin-bottom:3px;">镜头' + (idx+1) + '</div>'
                + '<div style="display:flex;gap:3px;">'
                + '<button class="co-copy" data-url="' + url + '" style="flex:1;padding:3px;background:#f0f7ff;color:#1890ff;border:1px solid #91d5ff;border-radius:4px;cursor:pointer;font-size:10px;">复制</button>'
                + '<a href="' + url + '" target="_blank" style="flex:1;padding:3px;text-align:center;background:#ff7a00;color:#fff;border-radius:4px;font-size:10px;text-decoration:none;">打开</a></div>'
                ;
              ic2.onmouseenter = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'block'; };
              ic2.onmouseleave = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'none'; };
              coUpdateImgRatio(ic2, idx + 1);
              coBindCopy(ic2);
              coUpdateConfirmBtn();
              coLog('✓ 图' + (idx + 1) + ' 重新生成完成');
            },
            function (err) {
              ic2.innerHTML = '<div class="co-gen" style="color:#ff4d4f;text-align:center;padding:8px 0;">✗ ' + err + '</div>';
              coLog('✗ 图' + (idx + 1) + ' 重新生成失败: ' + err);
            }
          );
        });

        // 用（已编辑的）某条视频提示词重新生成对应那条视频
        panel.addEventListener('click', function (e) {
          var btn = e.target && e.target.classList.contains('co-regen-vid') ? e.target : null;
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          if (isNaN(idx)) return;
          var ta = document.getElementById('co-prompt-' + idx);
          var prompt = ta ? ta.value.trim() : '';
          if (!prompt) { alert('该视频提示词为空'); return; }
          var apiKey = GM_getValue(CO_KEY, '');
          if (!apiKey) return alert('请先配置 API Key');
          var vidBox2 = document.getElementById('tuopin-co-videos');
          if (!vidBox2) return;
          var checked = panel.querySelectorAll('#tuopin-co-images .co-select-cb:checked');
          if (!checked.length) { alert('请先在图生图区域勾选要合并的图片'); return; }
          var selectedUrls = [];
          checked.forEach(function (cb) { selectedUrls.push(cb.getAttribute('data-url')); });

          var vm = VID_MODELS[idx % VID_MODELS.length];
          // 定位/创建对应视频卡片（按 idx 顺序匹配已有卡片，没有则新建）
          var cards = vidBox2.children;
          var vc3 = cards[idx];
          if (!vc3) {
            vc3 = document.createElement('div');
            vc3.style.cssText = 'border:1px solid #eee;border-radius:6px;padding:4px;font-size:10px;';
            vidBox2.appendChild(vc3);
          }
          vc3.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:6px 0;font-size:10px;">' + vm.name + ' 重新生成中...</div>';
          btn.disabled = true;
          coLog('↺ 重新生成视频' + (idx + 1) + '(' + vm.name + ') 用提示词: ' + prompt.slice(0, 30));
          coSubmitVideo(prompt, selectedUrls, idx,
            function (taskId, modelId) {
              coLog('✓ 视频' + (idx + 1) + '(' + vm.name + ') 已提交, taskId=' + taskId);
              try {
                var cur = JSON.parse(GM_getValue(CO_SESSION_KEY, '{}'));
                var pts = cur.pendingTasks || [];
                pts = pts.filter(function(p) { return p.idx !== idx; });
                pts.push({ idx: idx, taskId: taskId, modelId: modelId });
                cur.pendingTasks = pts;
                GM_setValue(CO_SESSION_KEY, JSON.stringify(cur));
              } catch(e) {}
              coPollVideo(taskId, modelId,
                function (vurl) {
                  btn.disabled = false;
                  vc3.style.position = 'relative';
                  vc3.setAttribute('data-co-url', vurl);
                  vc3.innerHTML = coVidCardHtml(vurl, vm.name + ' · ' + selectedUrls.length + '张合并');
                  coBindCopy(vc3);
                  coUpdateConfirmBtn();
                  try {
                    var cur2 = JSON.parse(GM_getValue(CO_SESSION_KEY, '{}'));
                    cur2.pendingTasks = (cur2.pendingTasks || []).filter(function(p) { return p.taskId !== taskId; });
                    if (!cur2.videos) cur2.videos = [];
                    if (cur2.videos.indexOf(vurl) < 0) cur2.videos.push(vurl);
                    GM_setValue(CO_SESSION_KEY, JSON.stringify(cur2));
                  } catch(e) {}
                  coLog('✓ 视频' + (idx + 1) + '(' + vm.name + ') 重新生成完成');
                },
                function (err) {
                  btn.disabled = false;
                  vc3.innerHTML = '<div style="color:#ff4d4f;text-align:center;padding:6px 0;font-size:10px;">✗ ' + vm.name + ' ' + err + '</div>';
                  coLog('✗ 视频' + (idx + 1) + ' 重新生成失败: ' + err);
                }
              );
            },
            function (err) {
              btn.disabled = false;
              vc3.innerHTML = '<div style="color:#ff4d4f;text-align:center;padding:6px 0;font-size:10px;">✗ ' + vm.name + ' 提交失败 ' + err + '</div>';
              coLog('✗ 视频' + (idx + 1) + ' 提交失败 ' + err);
            }
          );
        });

        (function restoreSession() {
          var sess = coLoadSession();
          if (!sess.ts || (Date.now() - sess.ts) > 3 * 3600e3) return;
          var scene = sess.scene; var prompts = sess.prompts || []; var imgs = sess.images || []; var vids = sess.videos || [];
          var pending = sess.pendingTasks || [];
          var pendingImgsRestore = sess.pendingImgs || [];
          document.getElementById('tuopin-co-scene').value = scene;
          // 提示词
          var pp = document.getElementById('tuopin-co-prompts');
          if (prompts.length) {
              var ph = '<div style="color:#999;font-size:10px;margin-bottom:4px;">视频提示词（上次生成）</div>';
            prompts.forEach(function (p, i) {
              ph += '<div style="display:flex;align-items:flex-start;gap:4px;margin-bottom:4px;">'
                + '<span style="color:#ff7a00;font-size:11px;font-weight:600;line-height:28px;flex-shrink:0;">' + (i + 1) + '.</span>'
                + '<textarea id="co-prompt-' + i + '" rows="2" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;line-height:1.4;resize:vertical;box-sizing:border-box;color:#333;">' + coEsc(p) + '</textarea>'
                + '<button class="co-regen-vid" data-idx="' + i + '" title="用此提示词重新生成视频(' + (VID_MODELS[i % VID_MODELS.length] ? VID_MODELS[i % VID_MODELS.length].name : '') + ')" style="flex-shrink:0;width:22px;height:22px;margin-top:3px;background:#fff7e6;border:1px solid #ffd591;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;padding:0;">▶</button>'
                + '</div>';
            });
            pp.innerHTML = ph;
          }
          // 图片/视频
          if (imgs.length) coFillCards(document.getElementById('tuopin-co-images'), imgs);
          if (vids.length) coFillCards(document.getElementById('tuopin-co-videos'), vids);
          // 恢复进行中的图片任务（刷新后重新发起生成）
          if (pendingImgsRestore.length) {
            var imagesBoxR = document.getElementById('tuopin-co-images');
            var resumeImgsArr = imgs.slice();
            var resumePendingImgs = pendingImgsRestore.slice();
            var resumeDone = 0;
            coSetStatus('已恢复上次结果，继续生成 ' + pendingImgsRestore.length + ' 张图片...');
            pendingImgsRestore.forEach(function (t) {
              // 补充图片卡片占位（已完成的 idx 已有卡片，未完成的补占位）
              var existCards = imagesBoxR.children.length;
              while (imagesBoxR.children.length <= t.idx) {
                var placeholder = document.createElement('div');
                placeholder.style.cssText = 'position:relative;border:1px solid #eee;border-radius:6px;padding:3px;font-size:10px;';
                placeholder.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:6px 0;font-size:10px;">图' + (imagesBoxR.children.length + 1) + ' 生成中...</div>';
                imagesBoxR.appendChild(placeholder);
              }
              var ic3 = imagesBoxR.children[t.idx];
              if (ic3) ic3.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:6px 0;font-size:10px;">图' + (t.idx + 1) + ' 生成中...</div>';
              coCreateImg(t.prompt, t.imgSrc, t.modelIdx,
                function (url) {
                  resumeDone++;
                  resumePendingImgs = resumePendingImgs.filter(function(x) { return x.idx !== t.idx; });
                  resumeImgsArr[t.idx] = url;
                  if (ic3) {
                    ic3.setAttribute('data-co-url', url);
                    ic3.innerHTML = '<label style="position:absolute;top:4px;left:4px;z-index:2;cursor:pointer;">'
                      + '<input type="checkbox" class="co-select-cb" data-url="' + url + '" style="width:14px;height:14px;accent-color:#ff7a00;cursor:pointer;"></label>'
                      + '<button class="co-set-refimg" data-url="' + url + '" title="设为参考图" style="position:absolute;top:4px;right:4px;z-index:2;padding:2px 5px;background:rgba(0,0,0,0.55);color:#fff;border:none;border-radius:3px;font-size:9px;cursor:pointer;display:none;">参考图</button>'
                      + '<img src="' + url + '" style="width:100%;border-radius:4px;margin-bottom:3px;display:block;">'
                      + '<div class="co-img-lbl" style="color:#bbb;font-size:9px;text-align:center;margin-bottom:2px;">镜头' + (t.idx+1) + '</div>'
                      + '<div style="display:flex;gap:2px;">'
                      + '<button class="co-copy" data-url="' + url + '" style="flex:1;padding:2px;background:#f0f7ff;color:#1890ff;border:1px solid #91d5ff;border-radius:3px;cursor:pointer;font-size:9px;">复制</button>'
                      + '<a href="' + url + '" target="_blank" style="flex:1;padding:2px;text-align:center;background:#ff7a00;color:#fff;border-radius:3px;font-size:9px;text-decoration:none;">打开</a></div>'
                      ;
                    ic3.onmouseenter = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'block'; };
                    ic3.onmouseleave = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'none'; };
                    coUpdateImgRatio(ic3, t.idx + 1);
                    coBindCopy(ic3);
                  }
                  coImgMeta[t.idx] = { prompt: t.prompt, url: url };
                  coUpdateConfirmBtn();
                  coSaveSession(scene, prompts, resumeImgsArr.filter(Boolean), vids, pending, resumePendingImgs);
                  if (resumePendingImgs.length === 0) coSetStatus('② 图片全部生成完成，勾选后点击确认视频图');
                  coLog('✓ 恢复图' + (t.idx + 1) + ' 完成');
                },
                function (err) {
                  resumeDone++;
                  resumePendingImgs = resumePendingImgs.filter(function(x) { return x.idx !== t.idx; });
                  if (ic3) { ic3.innerHTML = '<div class="co-gen" style="color:#ff4d4f;text-align:center;padding:6px 0;font-size:10px;">✗ ' + err + '</div>'; }
                  coSaveSession(scene, prompts, resumeImgsArr.filter(Boolean), vids, pending, resumePendingImgs);
                  coLog('✗ 恢复图' + (t.idx + 1) + ' 失败: ' + err);
                }
              );
            });
          }
          // 恢复进行中的视频任务（页面刷新后继续轮询）
          if (pending.length && prompts.length) {
            var imagesBox2 = document.getElementById('tuopin-co-images');
            var videosBox2 = document.getElementById('tuopin-co-videos');
            var resumeImgs = imgs.slice();
            var resumeVids = vids.slice();
            coSetStatus('已恢复上次结果，继续轮询 ' + pending.length + ' 个视频...');
            pending.forEach(function (t) {
              var idx = t.idx;
              var taskId = t.taskId;
              var modelId = t.modelId || (VID_MODELS[idx % VID_MODELS.length] || {}).id || '';
              // 在视频区插入/更新对应卡片为"轮询中"状态
              var vcards = videosBox2.children;
              var vc = vcards[idx];
              if (!vc) {
                vc = document.createElement('div');
                vc.style.cssText = 'border:1px solid #eee;border-radius:6px;padding:4px;font-size:10px;';
                videosBox2.appendChild(vc);
              }
              vc.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:8px 0;">视频' + (idx + 1) + ' 轮询中...</div>';
              coPollVideo(taskId, modelId,
                function (vurl) {
                  vc.style.position = 'relative';
                  vc.setAttribute('data-co-url', vurl);
                  vc.innerHTML = coVidCardHtml(vurl, '已恢复');
                  coBindCopy(vc);
                  coUpdateConfirmBtn();
                  resumeVids.push(vurl);
                  // 从 pending 移除该 task 并持久化
                  var newPending = [];
                  try {
                    var cur = JSON.parse(GM_getValue(CO_SESSION_KEY, '{}'));
                    newPending = (cur.pendingTasks || []).filter(function(pt) { return pt.taskId !== taskId; });
                  } catch(e) {}
                  coSaveSession(scene, prompts, resumeImgs, resumeVids, newPending);
                  if (newPending.length === 0) {
                    coSetStatus('✓ 全部视频生成完成');
                    coSaveHistory(scene, prompts, resumeImgs, resumeVids);
                    coRenderHistory();
                  }
                  coLog('✓ 视频' + (idx + 1) + ' 恢复完成');
                },
                function (err) {
                  if (vc.querySelector('.co-gen')) {
                    vc.querySelector('.co-gen').textContent = '✗ ' + err;
                    vc.querySelector('.co-gen').style.color = '#ff4d4f';
                  }
                  coLog('✗ 视频' + (idx + 1) + ' 恢复轮询失败: ' + err);
                }
              );
            });
          } else {
            coSetStatus('已恢复上次结果');
          }
        })();
        // 渲染历史
        coRenderHistory();

        var keyInput = document.getElementById('tuopin-co-key');

        // ── 参考图逻辑 ──
        var CO_REFIMG_KEY = 'tuopin_refimg_url';
        var coRefImgUrls = []; // 选中的参考图列表（支持多张）

        function coRefImgRenderGrid(imgs) {
          var grid = document.getElementById('tuopin-co-refimg-grid');
          if (!grid) return;
          if (!imgs || !imgs.length) {
            grid.innerHTML = '<div style="color:#bbb;font-size:11px;padding:4px;">正在加载后台图片...</div>';
            return;
          }
          grid.innerHTML = '';
          imgs.forEach(function(src) {
            var wrap = document.createElement('label');
            wrap.style.cssText = 'position:relative;cursor:pointer;width:52px;height:52px;flex-shrink:0;';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'co-refimg-cb';
            cb.setAttribute('data-src', src);
            cb.style.cssText = 'position:absolute;top:3px;left:3px;z-index:2;width:13px;height:13px;accent-color:#ff7a00;';
            var im = document.createElement('img');
            im.src = src;
            im.style.cssText = 'width:52px;height:52px;object-fit:cover;border-radius:4px;border:2px solid transparent;display:block;';
            cb.addEventListener('change', function() {
              im.style.borderColor = cb.checked ? '#ff7a00' : 'transparent';
              var idx = coRefImgUrls.indexOf(src);
              if (cb.checked && idx < 0) coRefImgUrls.push(src);
              if (!cb.checked && idx >= 0) coRefImgUrls.splice(idx, 1);
            });
            wrap.appendChild(cb); wrap.appendChild(im);
            grid.appendChild(wrap);
          });
          // 默认勾选第1张
          if (imgs.length) {
            var first = grid.querySelector('.co-refimg-cb');
            if (first) { first.checked = true; first.dispatchEvent(new Event('change')); }
          }
        }

        function coRefImgAddUrl(src) {
          if (!src || coRefImgUrls.indexOf(src) >= 0) return;
          var grid = document.getElementById('tuopin-co-refimg-grid');
          if (!grid) return;
          var wrap = document.createElement('label');
          wrap.style.cssText = 'position:relative;cursor:pointer;width:52px;height:52px;flex-shrink:0;';
          var cb = document.createElement('input');
          cb.type = 'checkbox'; cb.className = 'co-refimg-cb';
          cb.setAttribute('data-src', src); cb.checked = true;
          cb.style.cssText = 'position:absolute;top:3px;left:3px;z-index:2;width:13px;height:13px;accent-color:#ff7a00;';
          coRefImgUrls.push(src);
          var im = document.createElement('img');
          im.src = src;
          im.style.cssText = 'width:52px;height:52px;object-fit:cover;border-radius:4px;border:2px solid #ff7a00;display:block;';
          cb.addEventListener('change', function() {
            im.style.borderColor = cb.checked ? '#ff7a00' : 'transparent';
            var idx = coRefImgUrls.indexOf(src);
            if (cb.checked && idx < 0) coRefImgUrls.push(src);
            if (!cb.checked && idx >= 0) coRefImgUrls.splice(idx, 1);
          });
          wrap.appendChild(cb); wrap.appendChild(im);
          grid.insertBefore(wrap, grid.firstChild);
        }

        // 初始化参考图（使用预取缓存，打开面板时已经拿到数据）
        coRefImgRenderGrid([]);
        (function() {
          function onImgs(imgs) {
            if (imgs && imgs.length) {
              coRefImgRenderGrid(imgs);
            } else {
              var grid = document.getElementById('tuopin-co-refimg-grid');
              if (grid) grid.innerHTML = '<div style="color:#bbb;font-size:11px;padding:4px;">未找到图片，请本地上传或粘贴URL</div>';
            }
          }
          if (coRefImgCache !== null) { onImgs(coRefImgCache); }
          else { coRefImgCacheCallbacks.push(onImgs); }
        })();

        // 粘贴 URL 输入（回车追加）
        var refUrlInput = document.getElementById('tuopin-co-refimg-url');
        if (refUrlInput) {
          refUrlInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
              var v = this.value.trim();
              if (v) { coRefImgAddUrl(v); this.value = ''; }
            }
          });
          // 支持粘贴图片（clipboard image）
          refUrlInput.addEventListener('paste', function(e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
              if (items[i].type.indexOf('image') >= 0) {
                e.preventDefault();
                var file = items[i].getAsFile();
                var reader = new FileReader();
                reader.onload = function(ev) { coRefImgAddUrl(ev.target.result); };
                reader.readAsDataURL(file);
                return;
              }
            }
          });
        }

        // 本地上传（支持多文件）
        var refFileInput = document.getElementById('tuopin-co-refimg-file');
        if (refFileInput) {
          refFileInput.addEventListener('change', function() {
            var files = this.files;
            if (!files) return;
            for (var fi = 0; fi < files.length; fi++) {
              (function(file) {
                var reader = new FileReader();
                reader.onload = function(ev) { coRefImgAddUrl(ev.target.result); };
                reader.readAsDataURL(file);
              })(files[fi]);
            }
            this.value = '';
          });
        }
        // ── end 参考图 ──

        // ── 图生图模型切换 ──
        coImgModelIdx = 0; // 默认即梦5.0
        function coUpdateImgModelBtns() {
          [0, 1].forEach(function(i) {
            var b = document.getElementById('co-img-model-' + i);
            if (!b) return;
            if (i === coImgModelIdx) {
              b.style.background = '#ff7a00'; b.style.color = '#fff'; b.style.borderColor = '#ff7a00';
            } else {
              b.style.background = '#fff'; b.style.color = '#999'; b.style.borderColor = '#ddd';
            }
          });
        }
        [0, 1].forEach(function(i) {
          var b = document.getElementById('co-img-model-' + i);
          if (b) b.onclick = function() { coImgModelIdx = i; coUpdateImgModelBtns(); };
        });
        coUpdateImgModelBtns();
        keyInput.value = GM_getValue(CO_KEY, '');
        document.getElementById('tuopin-co-cog').onclick = function () {
          var s = document.getElementById('tuopin-co-settings');
          s.style.display = s.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('tuopin-co-savekey').onclick = function () {
          GM_setValue(CO_KEY, keyInput.value.trim());
          document.getElementById('tuopin-co-settings').style.display = 'none';   // 保存后收起
          coLog('✓ Key 已保存');
        };

        document.getElementById('tuopin-co-go').onclick = function () {
          var closeup = document.getElementById('tuopin-co-closeup').value.trim();
          var scene = document.getElementById('tuopin-co-scene').value.trim();
          if (!closeup && !scene) return alert('请输入特写词或场景词');
          var apiKey = GM_getValue(CO_KEY, '');
          if (!apiKey) { alert('请先点右上 ⚙ Key 配置 gw-openapi 的 Bearer Key'); return; }

          var img = (coRefImgUrls.length ? coRefImgUrls[0] : '') || coGetArticleImage();
          var refImgs = coRefImgUrls.length ? coRefImgUrls : [img];
          var title = coGetArticleTitle();
          var promptsBox = document.getElementById('tuopin-co-prompts');
          var imagesBox = document.getElementById('tuopin-co-images');
          var videosBox = document.getElementById('tuopin-co-videos');
          promptsBox.innerHTML = ''; imagesBox.innerHTML = ''; videosBox.innerHTML = '';
          coSetStatus('① 生成场景提示词中...');
          var logLabel = (closeup ? '特写:' + closeup : '') + (closeup && scene ? ' + ' : '') + (scene ? '场景:' + scene : '');
          coLog(logLabel + (title ? ' | 商品: ' + title.slice(0, 40) : ''));

          var coRetried = false;
          function coHandlePrompts(full) {
              var prompts = coParsePrompts(full);
              if (prompts.length < 2 && !coRetried) {
                coRetried = true;
                coLog('仅获得 ' + prompts.length + ' 条提示词，重试一次...');
                coSetStatus('① 提示词不足2条，重试中...');
                coLlmChat(closeup, scene, title, img, coHandlePrompts, function(e) {
                  coSetStatus('✗ 重试失败: ' + e);
                });
                return;
              }
              if (!prompts.length) {
                coSetStatus('✗ 未解析到提示词');
                coLog('原始输出: ' + (full || '').slice(0, 300));
                return;
              }
              // 展示视频提示词（可编辑，不用于图片）
              var ph = '<div style="color:#999;font-size:10px;margin-bottom:4px;">视频提示词</div>';
              prompts.forEach(function (p, i) {
                ph += '<div style="display:flex;align-items:flex-start;gap:4px;margin-bottom:4px;">'
                  + '<span style="color:#ff7a00;font-size:11px;font-weight:600;line-height:28px;flex-shrink:0;">' + (i + 1) + '.</span>'
                  + '<textarea id="co-prompt-' + i + '" rows="2" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;line-height:1.4;resize:vertical;box-sizing:border-box;color:#333;">' + coEsc(p) + '</textarea>'
                  + '<button class="co-regen-vid" data-idx="' + i + '" title="用此提示词重新生成视频(' + (VID_MODELS[i % VID_MODELS.length] ? VID_MODELS[i % VID_MODELS.length].name : '') + ')" style="flex-shrink:0;width:22px;height:22px;margin-top:3px;background:#fff7e6;border:1px solid #ffd591;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;padding:0;">▶</button>'
                  + '</div>';
              });
              promptsBox.innerHTML = ph;
              coSetStatus('② 图生图中...');
              coLog('✓ 视频提示词 ' + prompts.length + ' 条');

              // 构建图片提示词（基于特写词+场景词，与视频提示词无关）
              var imgBaseCore = (closeup && scene) ? closeup + '，' + scene
                : (closeup || scene);
              var IMG_CONSTRAINT = '，单张完整画面，不拼图，不改变商品形态，电影级摄影质感';

              var imgDone = 0, total = 6;
              var gotImgs = new Array(total);
              var pendingTasks = [];
              var pendingImgs = []; // [{idx, prompt, imgSrc, modelIdx}]
              coImgMeta = new Array(total);
              function persist() {
                coSaveSession(scene, prompts, gotImgs.filter(Boolean), [], pendingTasks, pendingImgs);
              }
              function removePendingImg(idx) {
                pendingImgs = pendingImgs.filter(function(t) { return t.idx !== idx; });
              }
              persist();
              function checkAll() {
                if (imgDone === total) {
                  coSetStatus('② 图片生成完成，勾选后点击确认视频图');
                  coSaveSession(scene, prompts, gotImgs.filter(Boolean), []);
                }
              }

              for (var i = 0; i < total; i++) {
                (function(i) {
                var imgBasePrompt = imgBaseCore + '，' + IMG_ANGLES[i % IMG_ANGLES.length] + IMG_CONSTRAINT;
                var ic = document.createElement('div');
                ic.style.cssText = 'position:relative;border:1px solid #eee;border-radius:6px;padding:3px;font-size:10px;';
                ic.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:6px 0;font-size:10px;">图' + (i + 1) + ' 生成中...</div>';
                imagesBox.appendChild(ic);
                // 记录进行中任务，刷新后可恢复
                pendingImgs.push({ idx: i, prompt: imgBasePrompt, imgSrc: refImgs[i % refImgs.length] || img, modelIdx: i });
                persist();
                coCreateImg(imgBasePrompt, [refImgs[i % refImgs.length] || img], i,
                  function (url) {
                    gotImgs[i] = url;
                    removePendingImg(i);
                    ic.setAttribute('data-co-url', url);
                    ic.innerHTML = '<label style="position:absolute;top:4px;left:4px;z-index:2;cursor:pointer;">'
                      + '<input type="checkbox" class="co-select-cb" data-url="' + url + '" style="width:14px;height:14px;accent-color:#ff7a00;cursor:pointer;"></label>'
                      + '<button class="co-set-refimg" data-url="' + url + '" title="设为参考图" style="position:absolute;top:4px;right:4px;z-index:2;padding:2px 5px;background:rgba(0,0,0,0.55);color:#fff;border:none;border-radius:3px;font-size:9px;cursor:pointer;display:none;">参考图</button>'
                      + '<img src="' + url + '" style="width:100%;border-radius:4px;margin-bottom:3px;display:block;">'
                      + '<div class="co-img-lbl" style="color:#bbb;font-size:9px;text-align:center;margin-bottom:2px;">镜头' + (i+1) + '</div>'
                      + '<div style="display:flex;gap:2px;">'
                      + '<button class="co-copy" data-url="' + url + '" style="flex:1;padding:2px;background:#f0f7ff;color:#1890ff;border:1px solid #91d5ff;border-radius:3px;cursor:pointer;font-size:9px;">复制</button>'
                      + '<a href="' + url + '" target="_blank" style="flex:1;padding:2px;text-align:center;background:#ff7a00;color:#fff;border-radius:3px;font-size:9px;text-decoration:none;">打开</a></div>'
                      ;
                    ic.onmouseenter = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'block'; };
                    ic.onmouseleave = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'none'; };
                    coUpdateImgRatio(ic, i + 1);
                    coBindCopy(ic);
                    imgDone++; persist(); checkAll();
                    coLog('✓ 图' + (i + 1) + ' 完成');
                    coImgMeta[i] = { prompt: imgBasePrompt, url: url };
                    coUpdateConfirmBtn();
                  },
                  function (err) {
                    removePendingImg(i);
                    ic.innerHTML = '<div style="padding:4px 0;text-align:center;">'
                      + '<div style="color:#ff4d4f;font-size:10px;margin-bottom:4px;">✗ ' + coEsc(err) + '</div>'
                      + '<button class="co-img-retry" style="padding:2px 8px;background:#ff7a00;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;">重试</button>'
                      + '</div>';
                    ic.querySelector('.co-img-retry').onclick = function() {
                      ic.innerHTML = '<div class="co-gen" style="color:#999;text-align:center;padding:6px 0;font-size:10px;">图' + (i + 1) + ' 生成中...</div>';
                      imgDone--;
                      coCreateImg(imgBasePrompt, refImgs, i,
                        function(url2) {
                          gotImgs[i] = url2;
                          removePendingImg(i);
                          ic.setAttribute('data-co-url', url2);
                          ic.innerHTML = '<label style="position:absolute;top:4px;left:4px;z-index:2;cursor:pointer;">'
                            + '<input type="checkbox" class="co-select-cb" data-url="' + url2 + '" style="width:14px;height:14px;accent-color:#ff7a00;cursor:pointer;"></label>'
                            + '<button class="co-set-refimg" data-url="' + url2 + '" title="设为参考图" style="position:absolute;top:4px;right:4px;z-index:2;padding:2px 5px;background:rgba(0,0,0,0.55);color:#fff;border:none;border-radius:3px;font-size:9px;cursor:pointer;display:none;">参考图</button>'
                            + '<img src="' + url2 + '" style="width:100%;border-radius:4px;margin-bottom:3px;display:block;">'
                            + '<div class="co-img-lbl" style="color:#bbb;font-size:9px;text-align:center;margin-bottom:2px;">镜头' + (i+1) + '</div>'
                            + '<div style="display:flex;gap:2px;">'
                            + '<button class="co-copy" data-url="' + url2 + '" style="flex:1;padding:2px;background:#f0f7ff;color:#1890ff;border:1px solid #91d5ff;border-radius:3px;cursor:pointer;font-size:9px;">复制</button>'
                            + '<a href="' + url2 + '" target="_blank" style="flex:1;padding:2px;text-align:center;background:#ff7a00;color:#fff;border-radius:3px;font-size:9px;text-decoration:none;">打开</a></div>';
                          ic.onmouseenter = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'block'; };
                          ic.onmouseleave = function() { var b = this.querySelector('.co-set-refimg'); if (b) b.style.display = 'none'; };
                          coUpdateImgRatio(ic, i + 1);
                          coBindCopy(ic);
                          imgDone++; persist(); checkAll();
                          coLog('✓ 图' + (i + 1) + ' 重试成功');
                          coImgMeta[i] = { prompt: imgBasePrompt, url: url2 };
                          coUpdateConfirmBtn();
                        },
                        function(err2) {
                          ic.innerHTML = '<div style="padding:4px 0;text-align:center;">'
                            + '<div style="color:#ff4d4f;font-size:10px;margin-bottom:4px;">✗ ' + coEsc(err2) + '</div>'
                            + '<button class="co-img-retry" style="padding:2px 8px;background:#ff7a00;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;">重试</button>'
                            + '</div>';
                          ic.querySelector('.co-img-retry').onclick = arguments.callee.caller; // re-bind handled by event
                          imgDone++; persist(); checkAll();
                        }
                      );
                    };
                    coLog('✗ 图' + (i + 1) + ' ' + err);
                    imgDone++; persist(); checkAll();
                  }
                );
                })(i);
              }
          }
          coLlmChat(closeup, scene, title, img, coHandlePrompts,
            function (err) {
              coSetStatus('✗ ' + err);
              coLog('✗ ' + err);
            }
          );
        };
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
      } else { build(); }
    })();
    return;
  }
  // ===== END 内容优化 =====

  // ===== 任务中台 task-bgm.smzdm.com 自动填表 =====
  if (location.hostname === 'task-bgm.smzdm.com') {
    var RELAY = 'https://commission-bgm.agentdevops.zdm.net';
    var taskParamRaw = (location.hash + location.search).indexOf('tuopin_task=1') >= 0
      ? GM_getValue('tuopin_pending_task', '') : '';
    if (taskParamRaw) {
      GM_setValue('tuopin_pending_task', '');
      var tp;
      try { tp = JSON.parse(taskParamRaw); } catch(e) { tp = null; }
      if (tp) {
        function taskLog(msg) { console.log('[任务中台] ' + msg); }
        function waitTaskVue(cb) {
          var tried = 0;
          function check() {
            var rootEl = document.querySelector('.create-box');
            if (rootEl && rootEl.__vue__) { cb(rootEl.__vue__); return; }
            tried++;
            if (tried < 60) { setTimeout(check, 200); }
            else { taskLog('Vue 未加载，放弃'); }
          }
          if (document.readyState === 'complete') { setTimeout(check, 500); }
          else { window.addEventListener('load', function() { setTimeout(check, 500); }, { once: true }); }
        }
        waitTaskVue(function(vue) {
          taskLog('Vue 已就绪，开始填表...');
          var P = tp;
          // 描述直接用主页侧传来的 description（已按新规则算好），兜底重算
          var description = P.description || '';
          if (!description) {
            var rawTitle2 = (P.articleTitle || '').replace(/^[\s\S]*?[：:]\s*/, '').trim() || P.articleTitle || '';
            var titlePriceMatch2 = rawTitle2.match(/([\d.]+)元/);
            var price2 = titlePriceMatch2 ? titlePriceMatch2[1] : '';
            var productName2 = price2 ? rawTitle2.replace(/\s*[\d.]+元.*/, '').trim() : rawTitle2;
            var priceSuffix2 = price2 ? (' ' + price2 + '元') : '';
            var maxNameLen2 = 42 - priceSuffix2.length - 8;
            if (productName2.length > maxNameLen2 && maxNameLen2 > 0) productName2 = productName2.slice(0, maxNameLen2);
            description = productName2 + priceSuffix2 + '，点赞收藏获得抽奖';
          }

          vue.$set(vue.createData, 'activity_ids', P.activityId);
          vue.$set(vue.createData, 'task_name', P.taskName);
          vue.$set(vue.createData, 'event_type', 'interactive.rating');
          vue.$set(vue.createData, 'reward_gift_id', P.rewardId);
          vue.$set(vue.createData, 'medal_code', '');
          vue.$set(vue.createData, 'description', description);
          vue.$set(vue.createData, 'start_time', P.startTime);
          vue.$set(vue.createData, 'end_time', P.endTime);
          vue.$set(vue.createData, 'redirect_url', P.articleUrl);
          vue.$set(vue.createData, 'save_type', 0);
          vue.$set(vue.createData, 'event_conds_data', JSON.stringify({
            article_id: P.articleId,
            isDirect: vue.isDirectObj ? vue.isDirectObj.point : 1,
            activity_ids: P.activityId
          }));

          // 填活动ID输入框并触发校验
          var actInput = document.querySelector('input[placeholder*="多个活动id"]') || document.querySelector('input[placeholder*="活动id"]');
          if (actInput) {
            actInput.value = P.activityId;
            actInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          setTimeout(function() {
            var verifyBtns = Array.from(document.querySelectorAll('button')).filter(function(b) { return b.textContent.indexOf('校验') >= 0; });
            if (verifyBtns[2]) verifyBtns[2].click();
            setTimeout(function() {
              var publishBtn = Array.from(document.querySelectorAll('button')).find(function(b) { return b.textContent.trim() === '发布'; });
              if (publishBtn) {
                publishBtn.click();
                taskLog('✓ 已点击发布，等待创建结果...');
                // 监听 Element UI toast，检测创建结果
                GM_setValue('tuopin_task_result', '');
                var resultChecked = false;
                var resultItv = setInterval(function() {
                  if (resultChecked) return;
                  var successEl = document.querySelector('.el-message--success, .el-notification--success');
                  var errorEl   = document.querySelector('.el-message--error,   .el-notification--error');
                  if (successEl) {
                    resultChecked = true; clearInterval(resultItv);
                    var msg = (successEl.textContent || '').trim();
                    GM_setValue('tuopin_task_result', JSON.stringify({ ok: true, startTime: P.startTime, msg: msg || '创建成功' }));
                    taskLog('✓ 任务创建成功');
                    setTimeout(function() { try { window.close(); } catch(e2) {} }, 1500);
                  } else if (errorEl) {
                    resultChecked = true; clearInterval(resultItv);
                    var msg2 = (errorEl.textContent || '').trim();
                    GM_setValue('tuopin_task_result', JSON.stringify({ ok: false, startTime: P.startTime, msg: msg2 || '创建失败' }));
                    taskLog('✗ 任务创建失败: ' + msg2);
                  }
                }, 300);
                setTimeout(function() {
                  if (!resultChecked) {
                    resultChecked = true; clearInterval(resultItv);
                    GM_setValue('tuopin_task_result', JSON.stringify({ ok: false, startTime: P.startTime, msg: '超时未收到结果，请手动确认' }));
                    taskLog('⚠ 超时，请手动确认');
                  }
                }, 30000);
              } else { taskLog('⚠ 未找到发布按钮，请手动发布'); }

              // 取号已在发布任务点击时完成，此处无需再 claim
            }, 1200);
          }, 1000);
        });
      }
    }
    return;
  }
  // ===== END 任务中台 =====

  var K = 'tuopin_selected_ids';
  var F = '__tuopin_inited__';

  if (window[F]) {
    var ot = document.getElementById('tuopin-toolbar');
    if (ot) ot.remove();
    var od = document.getElementById('tuopin-detail');
    if (od) od.remove();
    document.querySelectorAll('.tuopin-checkbox').forEach(function (el) { el.remove(); });
  }
  window[F] = true;

  // GM_xmlhttpRequest Promise 封装
  function GM_xmlhttpRequest_promise(method, url, data, headers) {
    return new Promise(function(resolve, reject) {
      GM_xmlhttpRequest({
        method: method,
        url: url,
        data: data || null,
        headers: headers || {},
        timeout: 15000,
        onload: function(resp) { resolve(resp.responseText || ''); },
        onerror: function(e) { reject(new Error('request failed')); },
        ontimeout: function() { reject(new Error('timeout')); }
      });
    });
  }

  // 通过 GM_xmlhttpRequest 跟随重定向链接，获取真实商品URL
  function resolveProductLink(rawUrl) {
    return new Promise(function(resolve) {
      if (!rawUrl) { resolve(''); return; }
      // 已经是干净的商品链接，直接返回
      if (rawUrl.match(/^https?:\/\/(?:detail\.tmall|item\.taobao|chaoshi\.detail\.tmall)\.com\/item\.htm\?id=\d+/)) {
        resolve(rawUrl); return;
      }
      // 尝试从URL参数中提取数字ID（不请求淘宝）
      var paramId = rawUrl.match(/[?&](?:id|itemId|item_id)=(\d{8,})/);
      if (paramId) {
        resolve('https://detail.tmall.com/item.htm?id=' + paramId[1]); return;
      }
      // 对 uland/edetail 链接做一次重定向跟踪（HEAD请求，不加载页面，不会限流）
      if (rawUrl.indexOf('uland') >= 0 || rawUrl.indexOf('edetail') >= 0) {
        GM_xmlhttpRequest({
          method: 'GET',
          url: rawUrl,
          timeout: 10000,
          anonymous: true,
          onload: function(resp) {
            var finalUrl = resp.finalUrl || resp.responseURL || '';
            var idFromFinal = finalUrl.match(/[?&]id=(\d{8,})/);
            if (idFromFinal) {
              resolve('https://detail.tmall.com/item.htm?id=' + idFromFinal[1]);
              return;
            }
            // 也从响应HTML中提取
            var html = resp.responseText || '';
            var htmlId = html.match(/item\.htm[^"']*[?&]id=(\d{8,})/);
            if (htmlId) {
              resolve('https://detail.tmall.com/item.htm?id=' + htmlId[1]);
              return;
            }
            resolve(rawUrl);
          },
          onerror: function() { resolve(rawUrl); },
          ontimeout: function() { resolve(rawUrl); }
        });
        return;
      }
      resolve(rawUrl);
    });
  }

  // 通过 GM_xmlhttpRequest 获取商品详情页售价（"优惠前"价格）
  function fetchDetailPrice(url) {
    return new Promise(function(resolve) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        timeout: 15000,
        onload: function(resp) {
          var html = resp.responseText || '';
          var result = { price: '', title: '' };

          // 提取结构化属性 {"valueName":"xxx","propertyName":"yyy"}
          var props = {};
          var propRe = /"valueName"\s*:\s*"([^"]+)"\s*,\s*"propertyName"\s*:\s*"([^"]+)"/g;
          var pm;
          while ((pm = propRe.exec(html)) !== null) {
            if (!props[pm[2]]) props[pm[2]] = pm[1];
          }
          // 备选格式 {"text":["xxx"],"title":"yyy"}
          var propRe2 = /\{"text"\s*:\s*\["([^"]+)"\]\s*,\s*"title"\s*:\s*"([^"]+)"\}/g;
          while ((pm = propRe2.exec(html)) !== null) {
            if (!props[pm[2]]) props[pm[2]] = pm[1];
          }

          // 拼接标题：品牌 + 品名 + 规格
          var brand = props['品牌'] || '';
          if (brand.indexOf('/') !== -1) brand = brand.split('/').pop();
          var itemName = props['品名'] || props['系列'] || '';
          var spec = props['单件净含量'] || props['净含量'] || props['包装规格'] || '';
          if (brand || itemName) {
            var titleParts = [];
            if (brand) titleParts.push(brand);
            if (itemName) titleParts.push(itemName);
            if (spec && itemName.indexOf(spec) === -1) titleParts.push(spec);
            result.title = titleParts.join(' ');
          } else {
            // fallback: 用页面title
            var dt = html.match(/"title"\s*:\s*"([^"]{5,80})"/);
            if (dt) {
              result.title = dt[1];
            } else {
              var tt = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              if (tt) result.title = tt[1].replace(/[-\s]*(?:tmall\.com|天猫|淘宝网|taobao\.com).*$/i, '').trim();
            }
          }

          // 提取价格
          var m = html.match(/优惠前[^<]*?[￥¥]([\d.]+)/);
          if (m) { result.price = m[1]; }
          else {
            var m2 = html.match(/subPrice[^"]*"[^>]*>.*?(\d+\.\d+)/);
            if (m2) { result.price = m2[1]; }
            else {
              var m3 = html.match(/originPrice[^"]*"[^>]*>.*?(\d+\.\d+)/);
              if (m3) { result.price = m3[1]; }
            }
          }
          resolve(result);
        },
        onerror: function() { resolve({ price: '', title: '' }); },
        ontimeout: function() { resolve({ price: '', title: '' }); }
      });
    });
  }

  var style = document.createElement('style');
  style.textContent = '.tuopin-checkbox{position:absolute;top:8px;left:8px;z-index:999;width:22px;height:22px;cursor:pointer;accent-color:#ff4757;transform:scale(1.3);opacity:0.9;}.tuopin-checkbox:hover{opacity:1;transform:scale(1.5);}';
  document.head.appendChild(style);

  function ld() {
    try { return JSON.parse(localStorage.getItem(K) || '[]'); }
    catch (e) { return []; }
  }

  function sv(ids) {
    localStorage.setItem(K, JSON.stringify(ids));
  }

  function gi() {
    var items = [];
    document.querySelectorAll('.goodsLayoutGutter').forEach(function (g) {
      Array.from(g.children).forEach(function (el) {
        if (el.className && /qlistGoodsMap(\d+)/.test(el.className)) items.push(el);
      });
    });
    return items;
  }

  function gid(el) {
    var m = el.className.match(/qlistGoodsMap(\d+)/);
    return m ? m[1] : null;
  }

  function hl(el, on) {
    el.style.outline = on ? '3px solid #ff4757' : '';
    el.style.outlineOffset = on ? '-3px' : '';
    el.style.borderRadius = on ? '8px' : '';
  }

  function inj() {
    var ids = ld();
    gi().forEach(function (item) {
      if (item.dataset.tuopin) return;
      item.dataset.tuopin = '1';
      item.style.position = 'relative';

      var id = gid(item);
      var checked = id && ids.includes(id);
      if (checked) hl(item, true);

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'tuopin-checkbox';
      cb.checked = checked;
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = gid(item);
        if (!id) return;
        var ids = ld(), idx = ids.indexOf(id);
        if (cb.checked) {
          if (idx === -1) ids.push(id);
          hl(item, true);
        } else {
          if (idx !== -1) ids.splice(idx, 1);
          hl(item, false);
          // 同步从 selected_data 里删除对应商品
          try {
            var sdata = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
            sdata = sdata.filter(function(d) { return String(d.id || d.gid || '') !== String(id); });
            localStorage.setItem('tuopin_selected_data', JSON.stringify(sdata, null, 2));
          } catch (e) {}
        }
        sv(ids);
        uc();
      });
      item.appendChild(cb);
    });
  }

  function uc() {
    var el = document.getElementById('tuopin-count');
    if (el) el.textContent = '(' + ld().length + ')';
  }

  function parseTpl(html) {
    var parts = html.split(/<\/br>/i);
    var title = '', price = '', coupon = '', couponLink = '', orderLink = '', recommendText = '';
    var taoJinBi = '', diJin = '', xiaoFeiQuan = '', lowestText = '';
    parts.forEach(function (part) {
      var clean = part.replace(/<[^>]+>/g, '').trim();
      if (!clean) return;
      if (!title && clean.match(/(?:优质素材|百亿补贴|官方验货|淘宝秒杀)[：:]/)) {
        title = clean.replace(/(?:优质素材|百亿补贴|官方验货|淘宝秒杀)[：:]\s*/, '').trim();
      }
      if (clean.match(/(?:福利价|券后价|到手价)/)) {
        var pm = clean.match(/([\d.]+)元/);
        if (pm) price = pm[1] + '元';
      }
      if (clean.match(/(\d+)元优惠券/) && !coupon) {
        var cm = clean.match(/(\d+)元优惠券/);
        if (cm) coupon = cm[1] + '元优惠券';
      }
      var tjbMatch = clean.match(/淘金币([\d.]+)/);
      if (tjbMatch && !taoJinBi) taoJinBi = tjbMatch[1];
      var djMatch = clean.match(/抵金([\d.]+)/);
      if (djMatch && !diJin) diJin = djMatch[1];
      var xfqMatch = clean.match(/消费[券卷]([\d.]+)/);
      if (xfqMatch && !xiaoFeiQuan) xiaoFeiQuan = xfqMatch[1];
      var lowestMatch = clean.match(/(?:淘金币|海金币|金币)[到至]手[价]?([\d.]+)/);
      if (lowestMatch && !lowestText) lowestText = lowestMatch[1];
      if (!lowestText) {
        var altLowest = clean.match(/到手[价]?([\d.]+)/);
        if (altLowest && clean.match(/淘金币|抵金|消费[券卷]|凑|海金币|金币/)) lowestText = altLowest[1];
      }
    });
    var lr = /<a[^>]+href='([^']+)'/g, m;
    var tbItemId = '';
    while ((m = lr.exec(html)) !== null) {
      if (m[1].indexOf('item/edetail') !== -1) orderLink = m[1];
      if (m[1].indexOf('quan/detail') !== -1) couponLink = m[1];
      // 尝试从各链接中提取淘宝数字商品ID
      if (!tbItemId) {
        var idParam = m[1].match(/[?&](?:id|itemId|item_id)=(\d{8,})/);
        if (idParam) tbItemId = idParam[1];
      }
    }
    // 也从整段HTML中提取（有些模板把ID写在文本里）
    if (!tbItemId) {
      var htmlIdMatch = html.match(/(?:item\.htm|item_id|itemId|goods_id)[^0-9]*(\d{10,})/);
      if (htmlIdMatch) tbItemId = htmlIdMatch[1];
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var c = parts[i].replace(/<[^>]+>/g, '').trim();
      if (c && c.length > 15 && !c.match(/优质素材|百亿补贴|福利价|优惠券|下单链接|先领|加购物车/)) {
        recommendText = c;
        break;
      }
    }
    // 如果title为空或太短，尝试从recommendText提取商品名（通常最后一段含完整商品名）
    if ((!title || title.length < 4) && recommendText) {
      // 去掉开头的 "任选X件XX.X" 或价格前缀，取【xxx】后面的部分或整段
      var altTitle = recommendText.replace(/^.*?[】\]]\s*/, '');
      if (altTitle === recommendText) altTitle = recommendText.replace(/^任选.*?件[\d.]*\s*/, '');
      if (altTitle.length > 5) title = altTitle;
    }
    // 从完整文案中提取件数（支持特殊数字字符，匹配"任选X件"/"下单X件"）
    var fullText = parts.map(function(p) { return p.replace(/<[^>]+>/g, ''); }).join('');
    var qtyStr = '';
    var unitPriceStr = '';
    var numMap = {'①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9','⑩':'10','⑪':'11','⑫':'12','⑬':'13','⑭':'14','⑮':'15','⑯':'16','⑰':'17','⑱':'18','⑲':'19','⑳':'20'};
    var qtyM = fullText.match(/(?:任选|下单)[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳\d]+件/);
    if (qtyM) {
      var raw = qtyM[0].replace(/任选|下单|件/g, '');
      qtyStr = numMap[raw] || raw.replace(/[^\d]/g, '') || '';
    }
    // 从"折X.XX元/件"提取折后单价，反推件数（兜底）
    var unitM = fullText.match(/折([\d.]+)元\/件/);
    if (unitM) {
      unitPriceStr = unitM[1];
      if (!qtyStr && price) {
        var priceNum = parseFloat(price);
        var unitNum = parseFloat(unitPriceStr);
        if (priceNum > 0 && unitNum > 0) {
          var calcQty = Math.round(priceNum / unitNum);
          if (calcQty > 1 && calcQty <= 50) qtyStr = String(calcQty);
        }
      }
    }
    // 从title中也提取（兜底）
    if (!qtyStr && title) {
      var titleQtyM = title.match(/(?:任选|下单)(\d+)件/);
      if (titleQtyM) qtyStr = titleQtyM[1];
    }
    return { title: title, price: price, coupon: coupon, couponLink: couponLink, orderLink: orderLink, recommendText: recommendText, taoJinBi: taoJinBi, diJin: diJin, xiaoFeiQuan: xiaoFeiQuan, lowestText: lowestText, qty: qtyStr, unitPrice: unitPriceStr, tbItemId: tbItemId };
  }

  function cleanTitle(t) {
    if (!t) return '';
    // 去掉开头方括号前缀 【xxx】(xxx)
    t = t.replace(/^[【\[（(][^】\]）)]*[】\]）)]\s*/, '');
    // 去掉所有标点符号
    t = t.replace(/[！!？?。，,、；;：:…·～~""''「」『』【】\[\]（）()《》<>｛｝{}﹔﹕﹖﹗﹐﹒﹑]/g, '');
    return t.trim();
  }

  function calcQtyDisplay(item) {
    if (item.manualQty) return item.manualQty;
    if (item.qty) return item.qty;
    if (item.divisor && parseInt(item.divisor) > 1) return item.divisor;
    var priceNum = parseFloat((item.price || '0').replace('元', ''));
    // 标题含"*X罐/盒/瓶/包"规格描述时，unit_price 是单件价而非组合单价，跳过反推
    var titleForQty = item.title || '';
    var hasSpecQty = /\*\d+[罐盒瓶包]/i.test(titleForQty);
    if (!hasSpecQty && item.unit_price && parseFloat(item.unit_price) > 0 && priceNum > 0) {
      var calc = Math.round(priceNum / parseFloat(item.unit_price));
      if (calc > 1 && calc <= 50) return String(calc);
    }
    if (item.recommendText) {
      var m = item.recommendText.match(/到手(\d+)[袋包件支颗盒]/);
      if (m && parseInt(m[1]) > 1) return m[1];
    }
    if (item.title) {
      var m2 = item.title.match(/(?:任选|下单)(\d+)件/);
      if (m2) return m2[1];
    }
    return '1';
  }

  function genCopy(item) {
    var parts = [];
    var origPrice = parseFloat(item.original_price || '0');
    var priceVal = parseFloat((item.price || '0').replace('元', ''));

    // 从素材里获取淘金币金额和最低价，倒推到手价
    var tjbAmount = 0;
    if (item.taoJinBi && parseFloat(item.taoJinBi) > 0) tjbAmount = parseFloat(item.taoJinBi);
    if (item.detailPromos && item.detailPromos.length > 0) {
      item.detailPromos.forEach(function(p) {
        var tjm = p.match(/淘金币[已抵]*([\d.]+)元?/);
        if (tjm) tjbAmount = parseFloat(tjm[1]);
      });
    }

    // 到手价逻辑：lowestText是淘金币到手价(最低价)，到手价 = lowestText + 淘金币
    var dealPrice;
    if (item.lowestText && parseFloat(item.lowestText) > 0 && tjbAmount > 0) {
      dealPrice = Math.round((parseFloat(item.lowestText) + tjbAmount) * 100) / 100;
    } else if (item.lowestText && parseFloat(item.lowestText) > 0) {
      dealPrice = parseFloat(item.lowestText);
    } else {
      dealPrice = priceVal;
    }

    // 售价（只有当原价高于到手价时显示，手动输入优先）
    var manualSell = item.manualSellPrice && parseFloat(item.manualSellPrice) > 0 ? parseFloat(item.manualSellPrice) : 0;
    var sellPrice = manualSell > 0 ? manualSell : (origPrice > dealPrice ? origPrice : (priceVal > dealPrice ? priceVal : 0));
    // 手动填了售价，无论是否高于到手价都显示
    if (manualSell > 0) {
      parts.push('天猫精选目前售价' + manualSell + '元');
    } else if (sellPrice > dealPrice) {
      parts.push('天猫精选目前售价' + sellPrice + '元');
    }

    // 淘礼金（紧跟售价后面）
    var tljAmount = item.manualTlj && parseFloat(item.manualTlj) > 0 ? parseFloat(item.manualTlj) : (item.taolijin && parseFloat(item.taolijin) > 0 ? parseFloat(item.taolijin) : 0);
    if (tljAmount > 0) {
      parts.push('淘礼金' + tljAmount + '元');
    }

    // 优惠券（coupon_amount 来自 search-v2，coupon 来自 parseTpl，互为兜底）
    var couponAmt = item.coupon_amount && parseFloat(item.coupon_amount) > 0 ? parseFloat(item.coupon_amount) : 0;
    if (couponAmt > 0) {
      if (item.coupon_condition) {
        parts.push('领取满' + item.coupon_condition + '元减' + couponAmt + '元优惠券');
      } else {
        parts.push('领取' + couponAmt + '元优惠券');
      }
    } else if (item.coupon && item.coupon.trim()) {
      parts.push('领取' + item.coupon.trim());
    }

    // 优惠信息汇总
    var promoList = [];
    if (item.is_88vip === '1') promoList.push('88VIP立减95折');
    if (item.guobu && parseFloat(item.guobu) > 0) promoList.push('国补' + item.guobu + '%');

    if (item.detailPromos && item.detailPromos.length > 0) {
      item.detailPromos.forEach(function(p) {
        if (!p.match(/淘金币/)) promoList.push(p);
      });
    } else {
      if (item.diJin && parseFloat(item.diJin) > 0) promoList.push('店铺抵金' + item.diJin + '元');
      if (item.xiaoFeiQuan && parseFloat(item.xiaoFeiQuan) > 0) promoList.push('消费券' + item.xiaoFeiQuan + '元');
    }

    if (promoList.length > 0) parts.push(promoList.join('，'));

    if (item.recommendText && item.recommendText.indexOf('下拉详情') !== -1) {
      parts.push('下拉详情加购');
    }

    // 下单件数（divisor>1才可信，=1时可能是后台未录入，继续走反推）
    var qty = item.qty || '';
    if (!qty && item.divisor && parseInt(item.divisor) > 1) {
      qty = item.divisor;
    }
    // unit_price 反推件数（search-v2 命中时有此字段，如小梅屋4袋=4件）
    // 标题含"*X罐/盒/瓶/包"规格描述时跳过，避免把规格件数误判为下单件数
    var titleStr = item.title || '';
    if (!qty && !/\*\d+[罐盒瓶包]/i.test(titleStr) && item.unit_price && parseFloat(item.unit_price) > 0) {
      var upCalc = Math.round(dealPrice / parseFloat(item.unit_price));
      if (upCalc > 1 && upCalc <= 50) qty = String(upCalc);
    }
    // 文案里的"到手X袋/包/件/支/颗/盒"也可以反推件数
    if (!qty && item.recommendText) {
      var dsBagM = item.recommendText.match(/到手(\d+)[袋包件支颗盒]/);
      if (dsBagM && parseInt(dsBagM[1]) > 1) qty = dsBagM[1];
    }
    if (!qty && item.title) {
      var qtyMatch = item.title.match(/(?:任选|下单)(\d+)件/);
      qty = qtyMatch ? qtyMatch[1] : '1';
    }
    if (!qty) qty = '1';
    parts.push('下单' + qty + '件');

    // 到手价（固定，从素材倒推）
    var subsidyAmount = item.subsidy && parseFloat(item.subsidy) > 0 ? parseFloat(item.subsidy) : 0;
    parts.push('到手价' + dealPrice.toFixed(2) + '元');
    if (parseInt(qty) > 1) {
      // 到手价的折单价（纯到手价 ÷ 件数）
      parts.push('折' + (dealPrice / parseInt(qty)).toFixed(2) + '元/件');
    }
    if (subsidyAmount > 0) {
      var subsidyPoints = Math.round(subsidyAmount * 10);
      var afterSubsidy = Math.round((dealPrice - subsidyAmount) * 100) / 100;
      if (afterSubsidy < 0) afterSubsidy = 0;
      parts.push('返' + subsidyPoints + '值得买积分，补贴后低至' + afterSubsidy.toFixed(2) + '元');
      if (parseInt(qty) > 1) {
        // 补贴后的折单价（补贴后价 ÷ 件数）
        parts.push('补贴后折' + (afterSubsidy / parseInt(qty)).toFixed(2) + '元/件');
      }
    }

    // 淘金币信息（在补贴后价格基础上减）
    // 用户手动输入的淘金币优先
    if (item.manualTjb && parseFloat(item.manualTjb) > 0) {
      tjbAmount = parseFloat(item.manualTjb);
    }
    var baseForTjb = subsidyAmount > 0 ? Math.round((dealPrice - subsidyAmount) * 100) / 100 : dealPrice;
    if (baseForTjb < 0) baseForTjb = 0;
    var qtyNumForTjb = parseInt(qty) || 1;
    if (tjbAmount > 0 && tjbAmount < baseForTjb) {
      var tjbFinal = Math.round((baseForTjb - tjbAmount) * 100) / 100;
      if (tjbFinal < 0) tjbFinal = 0;
      parts.push('淘金币已抵' + tjbAmount + '元');
      var tjbStr = '淘金币到手价' + tjbFinal.toFixed(2) + '元';
      if (qtyNumForTjb > 1) tjbStr += '，折' + (tjbFinal / qtyNumForTjb).toFixed(2) + '元/件';
      parts.push(tjbStr);
    } else if (item.gm_price && parseFloat(item.gm_price) > 0 && parseFloat(item.gm_price) < dealPrice) {
      var gmP = parseFloat(item.gm_price);
      var tjbCalc = Math.round((dealPrice - gmP) * 100) / 100;
      // 淘金币抵扣不应超过补贴后价格的50%，超过说明数据异常
      if (tjbCalc > 0 && tjbCalc < baseForTjb * 0.5) {
        var gmFinal = Math.round((baseForTjb - tjbCalc) * 100) / 100;
        if (gmFinal < 0) gmFinal = 0;
        parts.push('淘金币已抵' + tjbCalc.toFixed(2) + '元');
        var gmStr = '淘金币到手价' + gmFinal.toFixed(2) + '元';
        if (qtyNumForTjb > 1) gmStr += '，折' + (gmFinal / qtyNumForTjb).toFixed(2) + '元/件';
        parts.push(gmStr);
      }
    }

    // 猫超凑单推荐
    if (item.coudanGoods) {
      parts.push('凑单：' + item.coudanGoods);
    }

    return parts.join('，');
  }

  function highlightCopy(text) {
    var safe = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return safe.replace(/(返\d+值得买积分[^，]*(，补贴后低至[\d.]+元)?)/, '<span style="color:#e74c3c;font-weight:700;">$1</span>');
  }

  // 根据文案中的"到手价"动态重算淘礼金、补贴和淘金币部分
  function recalcSubsidyInCopy(copy, item) {
    var dealMatch = copy.match(/到手价([\d.]+)元/);
    if (!dealMatch) return copy;
    var dealPrice = parseFloat(dealMatch[1]);

    var qtyMatch = copy.match(/下单(\d+)件/);
    var qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

    var subsidyAmount = item.subsidy && parseFloat(item.subsidy) > 0 ? parseFloat(item.subsidy) : 0;
    var tjbAmount = item.manualTjb && parseFloat(item.manualTjb) > 0 ? parseFloat(item.manualTjb) : 0;
    var tljAmount = item.manualTlj && parseFloat(item.manualTlj) > 0 ? parseFloat(item.manualTlj) : 0;

    // 先删掉旧的售价、淘礼金、补贴、折xx元/件、淘金币部分
    copy = copy.replace(/^[，,]?\s*天猫精选目前售价[\d.]+元[，,]?/, '');
    copy = copy.replace(/天猫精选目前售价[\d.]+元[，,]?/g, '');
    copy = copy.replace(/[，,]\s*淘礼金[\d.]+元/, '');
    copy = copy.replace(/[，,]\s*返\d+值得买积分[^，]*(?:，补贴后低至[\d.]+元)?/, '');
    copy = copy.replace(/[，,]?\s*(?:折|低至|补贴后折)[\d.]+元\/件/g, '');
    copy = copy.replace(/[，,]\s*淘金币[已抵]*[\d.]+元/, '');
    copy = copy.replace(/[，,]\s*淘金币到手价[\d.]+元/, '');

    // 售价插在最前面（手动输入优先，否则用原算的售价）
    var dealMatch0 = copy.match(/到手价([\d.]+)元/);
    var dealPrice0 = dealMatch0 ? parseFloat(dealMatch0[1]) : 0;
    var manualSell = item.manualSellPrice && parseFloat(item.manualSellPrice) > 0 ? parseFloat(item.manualSellPrice) : 0;
    var origP = parseFloat(item.original_price || '0');
    var priceP = parseFloat((item.price || '0').replace('元', '')) || 0;
    var sellP = manualSell > 0 ? manualSell : (origP > dealPrice0 ? origP : (priceP > dealPrice0 ? priceP : 0));
    // 手动填了售价，无论是否高于到手价都显示
    if (manualSell > 0) {
      copy = '天猫精选目前售价' + manualSell + '元，' + copy.replace(/^[，,]\s*/, '');
    } else if (sellP > dealPrice0) {
      copy = '天猫精选目前售价' + sellP + '元，' + copy.replace(/^[，,]\s*/, '');
    }

    // 淘礼金插入在售价后面
    if (tljAmount > 0) {
      var sellMatch = copy.match(/售价[\d.]+元/);
      if (sellMatch) {
        copy = copy.replace(/(售价[\d.]+元)/, '$1，淘礼金' + tljAmount + '元');
      } else {
        // 没有售价，插在到手价前面
        copy = copy.replace(/(到手价)/, '淘礼金' + tljAmount + '元，$1');
      }
    }

    // 重新追加到手价折单价（纯到手价 ÷ 件数）
    if (qty > 1) {
      copy += '，折' + (dealPrice / qty).toFixed(2) + '元/件';
    }

    // 重新追加补贴部分
    if (subsidyAmount > 0) {
      var subsidyPoints = Math.round(subsidyAmount * 10);
      var afterSubsidy = Math.round((dealPrice - subsidyAmount) * 100) / 100;
      if (afterSubsidy < 0) afterSubsidy = 0;
      copy += '，返' + subsidyPoints + '值得买积分，补贴后低至' + afterSubsidy.toFixed(2) + '元';
      if (qty > 1) {
        copy += '，补贴后折' + (afterSubsidy / qty).toFixed(2) + '元/件';
      }
    }

    // 重新追加淘金币部分（在补贴后价格基础上再减）
    if (tjbAmount > 0) {
      var baseForTjb = subsidyAmount > 0 ? Math.round((dealPrice - subsidyAmount) * 100) / 100 : dealPrice;
      if (baseForTjb < 0) baseForTjb = 0;
      var tjbFinal = Math.round((baseForTjb - tjbAmount) * 100) / 100;
      if (tjbFinal < 0) tjbFinal = 0;
      copy += '，淘金币已抵' + tjbAmount + '元，淘金币到手价' + tjbFinal.toFixed(2) + '元';
      if (qty > 1) copy += '，折' + (tjbFinal / qty).toFixed(2) + '元/件';
    }

    return copy;
  }

  window.__tuopin_genCopy = genCopy;

  function showDetail() {
    var old = document.getElementById('tuopin-detail');
    if (old) old.remove();
    var oldOverlay = document.getElementById('tuopin-detail-overlay');
    if (oldOverlay) oldOverlay.remove();
    var data = [];
    try { data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]'); } catch (e) {}
    if (data.length === 0) return;
    // 打开看板时，对非手动编辑的文案按当前字段重新生成，避免缓存旧文案（如清空补贴后仍显示"补贴后折"）
    var dataChanged = false;
    data.forEach(function (item) {
      if (item && !item.customCopy) {
        var fresh = genCopy(item);
        if (fresh !== item.promoCopy) {
          item.promoCopy = fresh;
          dataChanged = true;
        }
      }
    });
    if (dataChanged) {
      localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
    }
    var d = document.createElement('div');
    d.id = 'tuopin-detail';
    d.style.cssText = 'position:fixed;top:80px;right:225px;z-index:99998;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);padding:12px 16px;max-height:80vh;overflow-y:auto;width:560px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;';
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px;"><span style="font-weight:600;color:#333;">商品详情</span><span id="tuopin-detail-close" style="cursor:pointer;color:#999;font-size:18px;">&times;</span></div>';
    data.forEach(function (item, idx) {
      h += '<div style="padding:10px 0;' + (idx < data.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '" data-item-idx="' + idx + '">';
      var titleLink = ((item.gid || item.id) ? 'https://www.dataoke.com/item?id=' + (item.gid || item.id) : '') || item.productLink || item.orderLink || '';
      h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
      h += '<span id="tuopin-title-display-' + idx + '" style="font-weight:600;flex:1;">' + (idx + 1) + '. ';
      if (titleLink) {
        h += '<a href="' + titleLink + '" target="_blank" style="color:#333;text-decoration:underline;text-decoration-color:#ccc;">' + (item.title || '') + '</a>';
      } else {
        h += (item.title || '');
      }
      h += '</span>';
      h += '<input id="tuopin-title-input-' + idx + '" type="text" value="' + (item.title || '').replace(/"/g, '&quot;') + '" style="display:none;flex:1;font-size:13px;padding:2px 6px;border:1px solid #1890ff;border-radius:4px;font-weight:600;" />';
      h += '<span class="tuopin-title-edit-btn" data-idx="' + idx + '" style="cursor:pointer;color:#1890ff;font-size:12px;white-space:nowrap;padding:2px 6px;border:1px solid #1890ff;border-radius:3px;">编辑</span>';
      h += '<span class="tuopin-item-del-btn" data-idx="' + idx + '" style="cursor:pointer;color:#ff4d4f;font-size:14px;white-space:nowrap;padding:2px 6px;border:1px solid #ff4d4f;border-radius:3px;line-height:1;" title="删除">×</span>';
      h += '</div>';
      if (item.commission_rate && parseFloat(item.commission_rate) > 0) {
        var commRate = parseFloat(item.commission_rate);
        var itemPrice = parseFloat((item.price || '0').replace('元', ''));
        var commAmt = (itemPrice * commRate / 100).toFixed(2);
        h += '<div style="color:#2ecc71;font-weight:500;">佣金：' + commAmt + '元（' + commRate + '%）</div>';
      }
      if (item.coupon) {
        var couponText = item.coupon;
        if (item.couponLink) {
          h += '<div style="color:#ff4757;font-weight:500;"><a href="' + item.couponLink + '" target="_blank" style="color:#ff4757;text-decoration:underline;">' + couponText + '</a></div>';
        } else {
          h += '<div style="color:#ff4757;font-weight:500;">' + couponText + '</div>';
        }
      }
      h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">';
      h += '<span style="color:#34495e;font-weight:500;display:flex;align-items:center;gap:3px;">售价：<input class="tuopin-sellprice-input" data-idx="' + idx + '" type="text" value="' + (item.manualSellPrice || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="选填">元</span>';
      h += '<span style="color:#e74c3c;font-weight:500;display:flex;align-items:center;gap:3px;">补贴：<input class="tuopin-subsidy-input" data-idx="' + idx + '" type="text" value="' + (item.subsidy || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="0">元</span>';
      h += '<span style="color:#27ae60;font-weight:500;display:flex;align-items:center;gap:3px;">淘金币：<input class="tuopin-tjb-input" data-idx="' + idx + '" type="text" value="' + (item.manualTjb || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="0">元</span>';
      h += '<span style="color:#7c3aed;font-weight:500;display:flex;align-items:center;gap:3px;">淘礼金：<input class="tuopin-tlj-input" data-idx="' + idx + '" type="text" value="' + (item.manualTlj || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="0">元</span>';
      h += '<span style="color:#1890ff;font-weight:500;display:flex;align-items:center;gap:3px;">件数：<input class="tuopin-qty-input" data-idx="' + idx + '" type="text" value="' + calcQtyDisplay(item) + '" style="width:40px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="1">件</span>';
      h += '</div>';
      var tagLine = [];
      if (item.is_88vip === '1') tagLine.push('88VIP 95折');
      if (item.taolijin && parseFloat(item.taolijin) > 0) tagLine.push('淘礼金' + item.taolijin + '元');
      if (tagLine.length > 0) h += '<div style="color:#7c3aed;">' + tagLine.join(' | ') + '</div>';
      if (item.detailPromos && item.detailPromos.length > 0) {
        var dispPromos = item.detailPromos.filter(function(p) { return !p.match(/淘金币/); });
        if (dispPromos.length > 0) h += '<div style="color:#e67e22;">' + dispPromos.join('，') + '</div>';
      }
      if (item.detailLowestPrice) {
        var tjbAmt = 0;
        if (item.detailPromos) item.detailPromos.forEach(function(p) { var m = p.match(/淘金币已抵([\d.]+)元/); if (m) tjbAmt = parseFloat(m[1]); });
        var realP = (parseFloat(item.detailLowestPrice) + tjbAmt).toFixed(2);
        h += '<div style="color:#d63031;font-weight:600;">到手价：' + realP + '元</div>';
        if (tjbAmt > 0) h += '<div style="color:#27ae60;font-weight:600;">淘金币到手价：' + item.detailLowestPrice + '元</div>';
      } else {
        var extras = [];
        if (item.diJin) extras.push('店铺抵金 -' + item.diJin + '元');
        if (item.xiaoFeiQuan) extras.push('消费券 -' + item.xiaoFeiQuan + '元');
        if (extras.length > 0) h += '<div style="color:#e67e22;">' + extras.join('，') + '</div>';
      }
      if (item.coudanGoods) h += '<div style="color:#8854d0;margin-top:4px;">凑单推荐：' + item.coudanGoods + '</div>';
      if (item.productLink) h += '<div style="word-break:break-all;margin-top:4px;"><a href="' + item.productLink + '" target="_blank" style="color:#1890ff;">' + item.productLink + '</a></div>';
      // 文案显示区（可编辑）
      h += '<div style="display:flex;align-items:flex-start;gap:6px;margin-top:6px;">';
      h += '<div id="tuopin-copy-display-' + idx + '" style="flex:1;color:#333;line-height:1.5;background:#fff3e0;padding:8px 10px;border-radius:4px;border-left:3px solid #ff9800;font-size:12px;">' + highlightCopy(item.promoCopy) + '</div>';
      h += '<textarea id="tuopin-copy-input-' + idx + '" style="display:none;flex:1;font-size:12px;padding:8px 10px;border:1px solid #ff9800;border-radius:4px;line-height:1.5;min-height:60px;resize:vertical;">' + (item.promoCopy || '').replace(/</g, '&lt;') + '</textarea>';
      h += '<span class="tuopin-copy-edit-btn" data-idx="' + idx + '" style="cursor:pointer;color:#ff9800;font-size:12px;white-space:nowrap;padding:2px 6px;border:1px solid #ff9800;border-radius:3px;">编辑</span>';
      h += '</div>';
      // 复制按钮
      h += '<div style="margin-top:6px;display:flex;gap:6px;">';
      h += '<button class="tuopin-copy-btn" data-idx="' + idx + '" style="padding:3px 8px;font-size:11px;border:1px solid #52c41a;border-radius:3px;background:#f6ffed;color:#52c41a;cursor:pointer;">复制文案</button>';
      h += '</div>';
      h += '</div>';
    });
    d.innerHTML = h;
    // 创建遮罩层，点击空白关闭
    var overlay = document.createElement('div');
    overlay.id = 'tuopin-detail-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99997;background:rgba(0,0,0,0.1);';
    overlay.onclick = function(e) { if (e.target === overlay) { d.remove(); overlay.remove(); } };
    document.body.appendChild(overlay);
    document.body.appendChild(d);
    document.getElementById('tuopin-detail-close').onclick = function () { d.remove(); overlay.remove(); };

    // 售价输入框事件
    // X 删除按钮事件
    d.querySelectorAll('.tuopin-item-del-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        var item = data[idx];
        data.splice(idx, 1);
        localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
        // 同步从勾选ID列表里删除
        if (item) {
          var itemId = String(item.id || item.gid || '');
          if (itemId) {
            var ids = JSON.parse(localStorage.getItem(K) || '[]');
            ids = ids.filter(function(i) { return String(i) !== itemId; });
            localStorage.setItem(K, JSON.stringify(ids));
            uc();
            // 取消卡片高亮
            gi().forEach(function(card) {
              if (String(gid(card)) === itemId) {
                hl(card, false);
                var cb = card.querySelector('.tuopin-checkbox');
                if (cb) cb.checked = false;
              }
            });
          }
        }
        // 刷新面板
        showDetail();
      });
    });

    d.querySelectorAll('.tuopin-sellprice-input').forEach(function(input) {
      var handler = function() {
        var idx = parseInt(input.dataset.idx);
        var val = input.value.trim();
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        data[idx].manualSellPrice = val;
        if (data[idx].customCopy && data[idx].promoCopy) {
          data[idx].promoCopy = recalcSubsidyInCopy(data[idx].promoCopy, data[idx]);
        } else {
          data[idx].promoCopy = genCopy(data[idx]);
        }
        var copyDisplay = document.getElementById('tuopin-copy-display-' + idx);
        if (copyDisplay) copyDisplay.innerHTML = highlightCopy(data[idx].promoCopy);
        var copyInput = document.getElementById('tuopin-copy-input-' + idx);
        if (copyInput) copyInput.value = data[idx].promoCopy;
        localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
      };
      input.addEventListener('change', handler);
      input.addEventListener('blur', handler);
    });

    // 补贴输入框事件
    d.querySelectorAll('.tuopin-subsidy-input').forEach(function(input) {
      var handler = function() {
        var idx = parseInt(input.dataset.idx);
        var val = input.value.trim();
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        data[idx].subsidy = val;
        if (data[idx].customCopy && data[idx].promoCopy) {
          data[idx].promoCopy = recalcSubsidyInCopy(data[idx].promoCopy, data[idx]);
        } else {
          data[idx].promoCopy = genCopy(data[idx]);
        }
        var copyDisplay = document.getElementById('tuopin-copy-display-' + idx);
        if (copyDisplay) copyDisplay.innerHTML = highlightCopy(data[idx].promoCopy);
        var copyInput = document.getElementById('tuopin-copy-input-' + idx);
        if (copyInput) copyInput.value = data[idx].promoCopy;
        localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
      };
      input.addEventListener('change', handler);
      input.addEventListener('blur', handler);
    });

    // 淘金币输入框事件
    d.querySelectorAll('.tuopin-tjb-input').forEach(function(input) {
      var handler = function() {
        var idx = parseInt(input.dataset.idx);
        var val = input.value.trim();
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        data[idx].manualTjb = val;
        if (data[idx].customCopy && data[idx].promoCopy) {
          data[idx].promoCopy = recalcSubsidyInCopy(data[idx].promoCopy, data[idx]);
        } else {
          data[idx].promoCopy = genCopy(data[idx]);
        }
        var copyDisplay = document.getElementById('tuopin-copy-display-' + idx);
        if (copyDisplay) copyDisplay.innerHTML = highlightCopy(data[idx].promoCopy);
        var copyInput = document.getElementById('tuopin-copy-input-' + idx);
        if (copyInput) copyInput.value = data[idx].promoCopy;
        localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
      };
      input.addEventListener('change', handler);
      input.addEventListener('blur', handler);
    });

    // 淘礼金输入框事件
    d.querySelectorAll('.tuopin-tlj-input').forEach(function(input) {
      var handler = function() {
        var idx = parseInt(input.dataset.idx);
        var val = input.value.trim();
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        data[idx].manualTlj = val;
        if (data[idx].customCopy && data[idx].promoCopy) {
          data[idx].promoCopy = recalcSubsidyInCopy(data[idx].promoCopy, data[idx]);
        } else {
          data[idx].promoCopy = genCopy(data[idx]);
        }
        var copyDisplay = document.getElementById('tuopin-copy-display-' + idx);
        if (copyDisplay) copyDisplay.innerHTML = highlightCopy(data[idx].promoCopy);
        var copyInput = document.getElementById('tuopin-copy-input-' + idx);
        if (copyInput) copyInput.value = data[idx].promoCopy;
        localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
      };
      input.addEventListener('change', handler);
      input.addEventListener('blur', handler);
    });

    // 件数输入框事件
    d.querySelectorAll('.tuopin-qty-input').forEach(function(input) {
      var handler = function() {
        var idx = parseInt(input.dataset.idx);
        var val = input.value.trim();
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        data[idx].manualQty = val;
        data[idx].qty = val;
        if (data[idx].customCopy && data[idx].promoCopy) {
          data[idx].promoCopy = recalcSubsidyInCopy(data[idx].promoCopy, data[idx]);
        } else {
          data[idx].promoCopy = genCopy(data[idx]);
        }
        var copyDisplay = document.getElementById('tuopin-copy-display-' + idx);
        if (copyDisplay) copyDisplay.innerHTML = highlightCopy(data[idx].promoCopy);
        var copyInput = document.getElementById('tuopin-copy-input-' + idx);
        if (copyInput) copyInput.value = data[idx].promoCopy;
        localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
      };
      input.addEventListener('change', handler);
      input.addEventListener('blur', handler);
    });

    // 文案编辑按钮事件
    d.querySelectorAll('.tuopin-copy-edit-btn').forEach(function(btn) {
      btn.onclick = function() {
        var idx = parseInt(btn.dataset.idx);
        var display = document.getElementById('tuopin-copy-display-' + idx);
        var input = document.getElementById('tuopin-copy-input-' + idx);
        if (input.style.display === 'none') {
          display.style.display = 'none';
          input.style.display = 'block';
          input.focus();
          btn.textContent = '保存';
          btn.style.background = '#ff9800';
          btn.style.color = '#fff';
        } else {
          var newCopy = input.value.trim();
          display.style.display = '';
          input.style.display = 'none';
          btn.textContent = '编辑';
          btn.style.background = '';
          btn.style.color = '#ff9800';
          if (newCopy) {
            var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
            // 动态重算补贴和淘金币部分
            newCopy = recalcSubsidyInCopy(newCopy, data[idx]);
            data[idx].promoCopy = newCopy;
            data[idx].customCopy = true;
            localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
            display.innerHTML = highlightCopy(newCopy);
            input.value = newCopy;
          }
        }
      };
    });

    // 标题编辑按钮事件
    d.querySelectorAll('.tuopin-title-edit-btn').forEach(function(btn) {
      btn.onclick = function() {
        var idx = parseInt(btn.dataset.idx);
        var display = document.getElementById('tuopin-title-display-' + idx);
        var input = document.getElementById('tuopin-title-input-' + idx);
        if (input.style.display === 'none') {
          display.style.display = 'none';
          input.style.display = 'block';
          input.focus();
          input.select();
          btn.textContent = '保存';
          btn.style.background = '#1890ff';
          btn.style.color = '#fff';
        } else {
          saveTitleEdit(idx);
        }
      };

      var idx = parseInt(btn.dataset.idx);
      var input = document.getElementById('tuopin-title-input-' + idx);
      input.addEventListener('blur', function() {
        if (input.style.display !== 'none') saveTitleEdit(idx);
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') input.blur();
      });
    });

    function saveTitleEdit(idx) {
      var display = document.getElementById('tuopin-title-display-' + idx);
      var input = document.getElementById('tuopin-title-input-' + idx);
      var btn = d.querySelector('.tuopin-title-edit-btn[data-idx="' + idx + '"]');
      var newTitle = input.value.trim();
      display.style.display = '';
      input.style.display = 'none';
      if (btn) { btn.textContent = '编辑'; btn.style.background = ''; btn.style.color = '#1890ff'; }
      if (newTitle) {
        var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
        if (data[idx] && data[idx].title !== newTitle) {
          data[idx].title = newTitle;
          data[idx].promoCopy = genCopy(data[idx]);
          localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
          showDetail();
        }
      }
    }

    // 复制文案按钮
    d.querySelectorAll('.tuopin-copy-btn').forEach(function(btn) {
      btn.onclick = function() {
        var idx = parseInt(btn.dataset.idx);
        var copyEl = document.getElementById('tuopin-copy-display-' + idx);
        if (copyEl) {
          navigator.clipboard.writeText(copyEl.textContent).then(function() {
            btn.textContent = '已复制';
            setTimeout(function() { btn.textContent = '复制文案'; }, 1500);
          });
        }
      };
    });
  }

  function showEditPanel(idx) {
    var oldEdit = document.getElementById('tuopin-edit-panel');
    if (oldEdit) oldEdit.remove();
    var data = [];
    try { data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]'); } catch(e) {}
    var item = data[idx];
    if (!item) return;

    var hongbao = '', zhijiang = '', lijian = '', tjb = '', other = '';
    (item.detailPromos || []).forEach(function(p) {
      var m;
      if ((m = p.match(/红包[已抵]*([\d.]+)/))) hongbao = m[1];
      else if ((m = p.match(/直降([\d.]+)/))) zhijiang = m[1];
      else if ((m = p.match(/(?:超级立减|超市立减|立减)([\d.]+)/))) lijian = (lijian ? parseFloat(lijian) + parseFloat(m[1]) : parseFloat(m[1])).toString();
      else if ((m = p.match(/淘金币[已抵]*([\d.]+)/))) tjb = m[1];
      else if ((m = p.match(/(?:限时补贴|补贴)([\d.]+)/))) lijian = (lijian ? parseFloat(lijian) + parseFloat(m[1]) : parseFloat(m[1])).toString();
      else other += (other ? '、' : '') + p;
    });
    if (item.manualTjb && parseFloat(item.manualTjb) > 0) tjb = item.manualTjb;

    var panel = document.createElement('div');
    panel.id = 'tuopin-edit-panel';
    panel.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999999;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:16px 20px;width:420px;max-height:80vh;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;';

    var html = '<div style="font-weight:600;margin-bottom:12px;font-size:14px;">编辑优惠信息 - ' + (item.title || '').slice(0,25) + '</div>';
    html += '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr><td style="padding:5px 0;width:100px;font-weight:500;">券后价：</td><td><input id="edit-price" value="' + (item.price || '').replace('元','') + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">优惠券：</td><td><input id="edit-coupon" value="' + (item.coupon_amount || '') + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;"> 元' + (item.coupon_condition ? ' （满' + item.coupon_condition + '）' : '') + '</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">88VIP：</td><td><input type="checkbox" id="edit-88vip" ' + (item.is_88vip === '1' ? 'checked' : '') + '> 95折</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">淘礼金：</td><td><input id="edit-taolijin" value="' + (item.taolijin || '') + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="0"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">红包：</td><td><input id="edit-hongbao" value="' + hongbao + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="0"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">直降：</td><td><input id="edit-zhijiang" value="' + zhijiang + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="0"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">立减：</td><td><input id="edit-lijian" value="' + lijian + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="0"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">淘金币：</td><td><input id="edit-tjb" value="' + tjb + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="0"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">国补：</td><td><input id="edit-guobu" value="' + (item.guobu || '') + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="7"> %</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">补贴：</td><td><input id="edit-subsidy" value="' + (item.subsidy || '') + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="0"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;">平台加补后：</td><td><input id="edit-lowest" value="' + (item.detailLowestPrice || '') + '" style="width:80px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="可选"> 元</td></tr>';
    html += '<tr><td style="padding:5px 0;font-weight:500;vertical-align:top;">其他促销：</td><td><input id="edit-other" value="' + other + '" style="width:200px;padding:3px 6px;border:1px solid #ddd;border-radius:3px;" placeholder="如有其他"></td></tr>';
    html += '</table>';
    html += '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">';
    html += '<button id="edit-cancel" style="padding:6px 14px;border:1px solid #ddd;border-radius:4px;background:#f5f5f5;cursor:pointer;">取消</button>';
    html += '<button id="edit-save" style="padding:6px 14px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;font-weight:500;">保存并重算</button>';
    html += '</div>';
    panel.innerHTML = html;
    document.body.appendChild(panel);

    document.getElementById('edit-cancel').onclick = function() { panel.remove(); };
    document.getElementById('edit-save').onclick = function() {
      var newPrice = document.getElementById('edit-price').value.trim();
      var is88 = document.getElementById('edit-88vip').checked ? '1' : '0';
      var taolijin = document.getElementById('edit-taolijin').value.trim();
      var guobu = document.getElementById('edit-guobu').value.trim();
      var subsidyVal = document.getElementById('edit-subsidy').value.trim();
      var lowest = document.getElementById('edit-lowest').value.trim();
      var hb = document.getElementById('edit-hongbao').value.trim();
      var zj = document.getElementById('edit-zhijiang').value.trim();
      var lj = document.getElementById('edit-lijian').value.trim();
      var tb = document.getElementById('edit-tjb').value.trim();
      var ot = document.getElementById('edit-other').value.trim();
      var couponAmt = document.getElementById('edit-coupon').value.trim();

      var newPromos = [];
      if (hb && parseFloat(hb) > 0) newPromos.push('红包已抵' + hb + '元');
      if (zj && parseFloat(zj) > 0) newPromos.push('直降' + zj + '元');
      if (lj && parseFloat(lj) > 0) newPromos.push('立减' + lj + '元');
      if (tb && parseFloat(tb) > 0) newPromos.push('淘金币' + tb + '元');
      if (ot) ot.split(/[、\n]/).forEach(function(s) { if (s.trim()) newPromos.push(s.trim()); });

      item.price = newPrice + '元';
      item.is_88vip = is88;
      item.taolijin = taolijin || '';
      item.manualTlj = taolijin || '';
      item.guobu = guobu || '';
      item.subsidy = subsidyVal || '';
      item.manualTjb = tb || '';
      item.detailLowestPrice = lowest || '';
      item.detailPromos = newPromos;
      if (couponAmt) item.coupon_amount = couponAmt;

      item.promoCopy = genCopy(item);
      item.customCopy = false;
      data[idx] = item;
      localStorage.setItem('tuopin_selected_data', JSON.stringify(data, null, 2));
      panel.remove();
      showDetail();
    };
  }

  window.__tuopin_show_detail = showDetail;

  function ctb() {
    if (document.getElementById('tuopin-toolbar')) return;
    var t = document.createElement('div');
    t.id = 'tuopin-toolbar';
    var tbCollapsed = GM_getValue('tuopin_tb_collapsed', '') === '1';
    t.innerHTML = '<div style="font-size:14px;font-weight:600;color:#333;border-bottom:' + (tbCollapsed ? 'none' : '1px solid #eee') + ';padding-bottom:' + (tbCollapsed ? '0' : '8px') + ';margin-bottom:' + (tbCollapsed ? '0' : '8px') + ';display:flex;align-items:center;justify-content:space-between;cursor:pointer;" id="tb-header">' +
      '<span>拓品助手 <span id="tuopin-count" style="color:#ff4757;">(0)</span></span>' +
      '<span id="tb-toggle" style="font-size:11px;color:#999;margin-left:6px;">' + (tbCollapsed ? '▶' : '▼') + '</span>' +
      '</div>' +
      '<div id="tb-body" style="display:' + (tbCollapsed ? 'none' : 'block') + ';">' +
      '<button id="tb-all" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ddd;border-radius:4px;background:#f8f9fa;font-size:13px;cursor:pointer;text-align:left;">全选</button>' +
      '<button id="tb-none" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ddd;border-radius:4px;background:#f8f9fa;font-size:13px;cursor:pointer;text-align:left;">取消全选</button>' +
      '<button id="tb-get" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ff4757;border-radius:4px;background:#ff4757;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">获取选中商品</button>' +
      '<button id="tb-view" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">查看优惠信息</button>' +
      '<button id="tb-publish" style="display:block;width:100%;padding:6px 10px;margin-bottom:8px;border:1px solid #52c41a;border-radius:4px;background:#52c41a;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">去发布</button>' +
      '<div style="border-top:1px solid #eee;padding-top:8px;margin-top:4px;">' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">标签（可多选）</label>' +
        '<div id="tb-tag-trigger" style="border:1px solid #ddd;border-radius:4px;padding:4px 6px;cursor:pointer;font-size:12px;min-height:22px;display:flex;justify-content:space-between;align-items:center;background:#fff;margin-bottom:4px;">' +
          '<span id="tb-tag-summary" style="color:#bbb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">请选择标签</span>' +
          '<span style="color:#999;font-size:10px;">▾</span>' +
        '</div>' +
        '<div id="tb-tag-dropdown" style="display:none;border:1px solid #ddd;border-radius:4px;padding:4px;margin-top:2px;max-height:120px;overflow-y:auto;font-size:11px;line-height:1.6;background:#fff;"></div>' +
        '<div style="display:flex;gap:4px;margin-top:4px;">' +
          '<input id="tb-tag-input" type="text" placeholder="添加标签，如今日必买" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="tb-tag-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div></div>' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">表单邮箱</div>' +
        '<select id="tb-email-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;"><option value="">请选择邮箱</option></select>' +
        '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
          '<input id="tb-email-input" type="text" placeholder="添加邮箱" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="tb-email-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">渠道Code</div>' +
        '<input id="tb-code" type="text" placeholder="请填写code" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:8px;box-sizing:border-box;">' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">发布账号</div>' +
        '<select id="tb-account-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;"><option value="">请选择账号</option></select>' +
        '<div style="display:flex;gap:4px;">' +
          '<input id="tb-account-input" type="text" placeholder="添加账号" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="tb-account-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div>' +
        '<div style="margin-top:8px;">' +
          '<div style="font-size:11px;color:#999;margin-bottom:4px;">是否在已有文章补贴</div>' +
          '<select id="tb-subsidy-existing" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;">' +
            '<option value="no">否</option>' +
            '<option value="yes">是</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '</div>';
    t.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);padding:12px 16px;width:170px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    document.body.appendChild(t);
    // 面板构建完成后，立即补一次版本更新徽标（若远端已有新版）
    if (window.__tuopinApplyUpdateBadge) window.__tuopinApplyUpdateBadge();

    // 折叠/展开
    document.getElementById('tb-header').onclick = function() {
      var body = document.getElementById('tb-body');
      var toggle = document.getElementById('tb-toggle');
      var header = document.getElementById('tb-header');
      var nowCollapsed = body.style.display === 'none';
      body.style.display = nowCollapsed ? 'block' : 'none';
      toggle.textContent = nowCollapsed ? '▼' : '▶';
      header.style.borderBottom = nowCollapsed ? '1px solid #eee' : 'none';
      header.style.paddingBottom = nowCollapsed ? '8px' : '0';
      header.style.marginBottom = nowCollapsed ? '8px' : '0';
      GM_setValue('tuopin_tb_collapsed', nowCollapsed ? '' : '1');
    };

    // 标签管理（多选，与编辑后台/JD 面板共用 tuopin_tag_list / tuopin_selected_tags）
    function tbLoadTags() { try { return JSON.parse(GM_getValue('tuopin_tag_list', '[]')); } catch(e) { return []; } }
    function tbSaveTags(list) { GM_setValue('tuopin_tag_list', JSON.stringify(list)); }
    function tbLoadSelTags() { try { return JSON.parse(GM_getValue('tuopin_selected_tags', '[]')); } catch(e) { return []; } }
    function tbSaveSelTags(list) { GM_setValue('tuopin_selected_tags', JSON.stringify(list)); }
    function tbRefreshTagSelect() {
      var box = document.getElementById('tb-tag-dropdown');
      if (!box) return;
      var tags = tbLoadTags();
      var selected = tbLoadSelTags();
      box.innerHTML = '';
      if (!tags.length) { box.innerHTML = '<span style="color:#bbb;">暂无标签，请在下方添加</span>'; }
      else {
        tags.forEach(function(tg) {
          var lbl = document.createElement('label');
          lbl.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;padding:2px 0;';
          var cb = document.createElement('input');
          cb.type = 'checkbox'; cb.value = tg;
          cb.checked = selected.indexOf(tg) >= 0;
          cb.onchange = function() {
            var cur = tbLoadSelTags();
            if (this.checked) { if (cur.indexOf(tg) < 0) cur.push(tg); }
            else { cur = cur.filter(function(x) { return x !== tg; }); }
            tbSaveSelTags(cur);
            tbUpdateTagSummary();
          };
          lbl.appendChild(cb);
          var span = document.createElement('span'); span.textContent = tg;
          span.style.cssText = 'flex:1;';
          lbl.appendChild(span);
          var del = document.createElement('span');
          del.textContent = '×';
          del.style.cssText = 'cursor:pointer;color:#ff4d4f;font-size:13px;line-height:1;padding:0 4px;';
          del.title = '删除标签';
          del.onclick = function(e) {
            e.preventDefault(); e.stopPropagation();
            if (!confirm('删除标签「' + tg + '」？')) return;
            tbSaveTags(tbLoadTags().filter(function(x) { return x !== tg; }));
            tbSaveSelTags(tbLoadSelTags().filter(function(x) { return x !== tg; }));
            tbRefreshTagSelect();
          };
          lbl.appendChild(del);
          box.appendChild(lbl);
        });
      }
      tbUpdateTagSummary();
    }
    function tbUpdateTagSummary() {
      var summary = document.getElementById('tb-tag-summary');
      if (!summary) return;
      var selected = tbLoadSelTags();
      summary.textContent = selected.length ? selected.join('、') : '请选择标签';
      summary.style.color = selected.length ? '#333' : '#bbb';
    }
    (function() {
      var trigger = document.getElementById('tb-tag-trigger');
      var dropdown = document.getElementById('tb-tag-dropdown');
      if (trigger && dropdown) {
        trigger.onclick = function(e) {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        document.addEventListener('click', function(e) {
          if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        });
      }
      var addBtn = document.getElementById('tb-tag-add');
      if (addBtn) addBtn.onclick = function() {
        var input = document.getElementById('tb-tag-input');
        var tag = (input.value || '').trim();
        if (!tag) { alert('请输入标签'); return; }
        var list = tbLoadTags();
        if (list.indexOf(tag) < 0) { list.push(tag); tbSaveTags(list); }
        var sel = tbLoadSelTags();
        if (sel.indexOf(tag) < 0) { sel.push(tag); tbSaveSelTags(sel); }
        tbRefreshTagSelect();
        input.value = '';
      };
      tbRefreshTagSelect();
    })();

    // 邮箱管理逻辑（GM_setValue 绑定本机）
    function loadEmails() {
      try { return JSON.parse(GM_getValue('tuopin_email_list', '[]')); } catch(e) { return []; }
    }
    function saveEmails(list) { GM_setValue('tuopin_email_list', JSON.stringify(list)); }
    function getSelectedEmail() { return GM_getValue('tuopin_selected_email', ''); }
    function setSelectedEmail(email) { GM_setValue('tuopin_selected_email', email); }
    function refreshEmailSelect() {
      var sel = document.getElementById('tb-email-select');
      if (!sel) return;
      var emails = loadEmails();
      var current = getSelectedEmail();
      sel.innerHTML = '<option value="">请选择邮箱</option>';
      emails.forEach(function(em) {
        var opt = document.createElement('option');
        opt.value = em; opt.textContent = em;
        if (em === current) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    refreshEmailSelect();
    // 渠道 code 初始化（与社群 code 独立，用 tuopin_subsidy_code）
    var tbCodeEl = document.getElementById('tb-code');
    if (tbCodeEl) {
      tbCodeEl.value = GM_getValue('tuopin_subsidy_code', '');
      tbCodeEl.onblur = function() { GM_setValue('tuopin_subsidy_code', this.value.trim()); };
    }
    document.getElementById('tb-email-select').onchange = function() {
      setSelectedEmail(this.value);
    };
    document.getElementById('tb-email-add').onclick = function() {
      var input = document.getElementById('tb-email-input');
      var email = (input.value || '').trim();
      if (!email || email.indexOf('@') < 0) { alert('请输入有效邮箱'); return; }
      var list = loadEmails();
      if (list.indexOf(email) < 0) { list.push(email); saveEmails(list); }
      setSelectedEmail(email);
      refreshEmailSelect();
      input.value = '';
    };

    // 发布账号管理逻辑
    function loadAccounts() {
      try { return JSON.parse(GM_getValue('tuopin_account_list', '[]')); } catch(e) { return []; }
    }
    function saveAccounts(list) { GM_setValue('tuopin_account_list', JSON.stringify(list)); }
    function getSelectedAccount() { return GM_getValue('tuopin_selected_account', ''); }
    function setSelectedAccount(acc) { GM_setValue('tuopin_selected_account', acc); }
    function refreshAccountSelect() {
      var sel = document.getElementById('tb-account-select');
      if (!sel) return;
      var accounts = loadAccounts();
      var current = getSelectedAccount();
      sel.innerHTML = '<option value="">请选择账号</option>';
      accounts.forEach(function(acc) {
        var opt = document.createElement('option');
        opt.value = acc; opt.textContent = acc;
        if (acc === current) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    refreshAccountSelect();
    document.getElementById('tb-account-select').onchange = function() {
      setSelectedAccount(this.value);
    };
    document.getElementById('tb-account-add').onclick = function() {
      var input = document.getElementById('tb-account-input');
      var acc = (input.value || '').trim();
      if (!acc) { alert('请输入账号名称'); return; }
      var list = loadAccounts();
      if (list.indexOf(acc) < 0) { list.push(acc); saveAccounts(list); }
      setSelectedAccount(acc);
      refreshAccountSelect();
      input.value = '';
    };

    // 是否在已有文章补贴
    var subsidyExistingSel = document.getElementById('tb-subsidy-existing');
    subsidyExistingSel.value = GM_getValue('tuopin_subsidy_existing', 'no');
    subsidyExistingSel.onchange = function() {
      GM_setValue('tuopin_subsidy_existing', this.value);
    };

    document.getElementById('tb-all').onclick = function () {
      var ids = ld();
      gi().forEach(function (item) {
        var id = gid(item);
        if (id && !ids.includes(id)) { ids.push(id); hl(item, true); }
        var cb = item.querySelector('.tuopin-checkbox');
        if (cb) cb.checked = true;
      });
      sv(ids);
      uc();
    };

    document.getElementById('tb-none').onclick = function () {
      gi().forEach(function (item) {
        hl(item, false);
        var cb = item.querySelector('.tuopin-checkbox');
        if (cb) cb.checked = false;
      });
      sv([]);
      uc();
    };

    document.getElementById('tb-get').onclick = function () {
      var btn = document.getElementById('tb-get');
      btn.textContent = '获取中...';
      btn.disabled = true;
      var ids = ld();
      if (ids.length === 0) { btn.textContent = '获取选中商品'; btn.disabled = false; return; }

      // 等待所有勾选卡片的 DOM 渲染（翻页后虚拟列表可能还未 mount）
      var waitCount = 0;
      function waitForCards(callback) {
        var missing = ids.filter(function(id) { return !document.querySelector('.qlistGoodsMap' + id); });
        if (missing.length === 0 || waitCount >= 20) {
          if (missing.length > 0) console.log('[拓品] 仍有' + missing.length + '个卡片未渲染，继续获取');
          callback();
        } else {
          waitCount++;
          setTimeout(function() { waitForCards(callback); }, 300);
        }
      }

      waitForCards(function() {
      var jawUid = document.cookie.match(/jaw_uid=([^;]+)/);
      var token = jawUid ? jawUid[1] : '';
      // 先从DOM卡片提取标题和goodsSign（最可靠来源）
      var domTitles = {};
      var domGoodsSigns = {};
      var domDivisors = {};
      ids.forEach(function (id) {
        var card = document.querySelector('.qlistGoodsMap' + id);
        if (!card) return;
        // 优先读卡片上可见的商品名称（短标题）
        var visibleTitleEl = card.querySelector('[class*="qlist-goods-new-style-title"], [class*="goodsNewStyleTitle"], [class*="goods-new-style-title"], a[class*="goods-v3-style-title"], a[class*="style-title"]');
        if (visibleTitleEl && visibleTitleEl.textContent.trim()) {
          domTitles[id] = visibleTitleEl.textContent.trim();
        }
        var chainEl = card.querySelector('[class*="goodsCopyandChain"]');
        if (chainEl) {
          if (!domTitles[id] && chainEl.getAttribute('data-d_title')) domTitles[id] = chainEl.getAttribute('data-d_title');
          if (chainEl.getAttribute('data-goodsid')) domGoodsSigns[id] = chainEl.getAttribute('data-goodsid');
          // 读 divisor 字段
          var dv = chainEl.getAttribute('data-divisor');
          if (dv && parseInt(dv) > 0) domDivisors[id] = dv;
        }
        // 也从其他元素找 data-goodsid / data-divisor
        if (!domGoodsSigns[id]) {
          var gsEl = card.querySelector('[data-goodsid]');
          if (gsEl) domGoodsSigns[id] = gsEl.getAttribute('data-goodsid');
        }
        if (!domDivisors[id]) {
          var dvEl = card.querySelector('[data-divisor]');
          if (dvEl) { var dval = dvEl.getAttribute('data-divisor'); if (parseInt(dval) > 0) domDivisors[id] = dval; }
        }
        // 兜底：扫描卡片内所有元素的所有 data-* 属性，找含 divisor/qty/件数 的字段
        if (!domDivisors[id]) {
          var allEls = card.querySelectorAll('*');
          for (var ei = 0; ei < allEls.length; ei++) {
            var el = allEls[ei];
            for (var ai = 0; ai < el.attributes.length; ai++) {
              var attr = el.attributes[ai];
              if (/divisor|_qty|num_buy/i.test(attr.name) && parseInt(attr.value) > 0) {
                domDivisors[id] = attr.value;
                break;
              }
            }
            if (domDivisors[id]) break;
          }
        }
      });
      var results = [];
      // get-tpl 并行请求
      var tplPromises = ids.map(function (gid) {
        return fetch('https://dtkapi.ffquan.cn/taobaoapi/get-tpl?gid=' + gid + '&is_new_pc=1&jaw_uid=' + token)
          .then(function (r) { return r.json(); })
          .then(function (json) {
            if (json.code !== 1 || !json.data) return null;
            var info = parseTpl(json.data);
            info.id = gid;
            if (domTitles[gid]) info.title = domTitles[gid];
            return info;
          })
          .catch(function () { return null; });
      });
      Promise.all(tplPromises).then(function (tplResults) {
        results = tplResults.filter(function(r) { return r !== null; });
        // 从 get-tpl 解析出的淘宝ID直接构造商品链接，同时附加 goodsSign
        results.forEach(function(item) {
          if (item.tbItemId && !item.productLink) {
            item.productLink = 'https://detail.tmall.com/item.htm?id=' + item.tbItemId;
          }
          if (!item.productLink && item.id && /^\d{10,}$/.test(item.id)) {
            item.productLink = 'https://detail.tmall.com/item.htm?id=' + item.id;
          }
          // 从 DOM 获取 goodsSign 和 divisor
          if (!item.goodsSign && domGoodsSigns[item.id]) {
            item.goodsSign = domGoodsSigns[item.id];
          }
          if (!item.divisor && domDivisors[item.id]) {
            item.divisor = domDivisors[item.id];
          }
        });
        // search-v2 全品类100页并行请求（去掉 cid 限制，覆盖所有在推商品）
        var idMap = {};
        var allPages = [];
        for (var pi = 1; pi <= 100; pi++) allPages.push(pi);
        var searchPromises = allPages.map(function(pg) {
          return fetch('https://dtkapi.ffquan.cn/go_getway/proxy/search-v2?platform=1&page=' + pg + '&px=zh&version=2&api_v=1&flow_identifier=normal&pageSize=100')
            .then(function (r) { return r.json(); })
            .then(function (json) {
              var list = json.data && json.data.search && json.data.search.list ? json.data.search.list : [];
              list.forEach(function (g) {
                if (!idMap[g.id]) idMap[g.id] = g;
                // 同时用 goodsSign 建索引（用于和淘宝 gid 匹配）
                var gs = g.goodsid || g.goods_sign || '';
                if (gs && !idMap[gs]) idMap[gs] = g;
              });
            })
            .catch(function () {});
        });
        return Promise.all(searchPromises).then(function() {
            results.forEach(function (item) {
              // item.id 是淘宝 gid，先用 goodsSign 匹配，再用内部 id 匹配
              var g = idMap[item.goodsSign] || idMap[item.id];
              if (g) {
                var cleanD = cleanTitle(g.d_title || '');
                var subT = g.sub_title || '';
                var rawTitle = cleanTitle(g.title || '');
                // 卡片 DOM 上的 data-d_title 最准确，优先使用
                item.title = domTitles[item.id] || cleanD || subT || rawTitle || item.title;
                item.original_price = g.original_price || '';
                if (g.coupon_amount) item.coupon_amount = g.coupon_amount;
                if (g.coupon_condition) item.coupon_condition = g.coupon_condition;
                item.unit_price = g.unit_price || '';
                item.gm_price = g.gm_price || '';
                item.is_88vip = g.is_88vip || '0';
                item.is_chaoshi = g.is_chaoshi || '0';
                item.commission_rate = g.commission_rate || '';
                item.direct_commission = g.direct_commission || '';
                item.highest_commission = g.highest_commission || '';
                item.goodsSign = g.goodsid || g.goods_sign || '';
                // divisor 是下单件数（API直接提供）
                if (g.divisor && parseInt(g.divisor) > 0) item.divisor = g.divisor;
                // 从 gm_price 和 price 计算淘金币抵扣额（仅当 get-tpl 没有提供时）
                if (!item.taoJinBi && g.gm_price && g.price && parseFloat(g.price) > parseFloat(g.gm_price)) {
                  var tjbVal = (parseFloat(g.price) - parseFloat(g.gm_price)).toFixed(2);
                  if (parseFloat(tjbVal) > 0) item.taoJinBi = tjbVal;
                }
                // 从 show_tags 解析国补百分比
                if (g.show_tags) {
                  try {
                    var tags = typeof g.show_tags === 'string' ? JSON.parse(g.show_tags) : g.show_tags;
                    var markets = (tags.three && tags.three.market) || [];
                    markets.forEach(function(tag) {
                      var gbm = (tag.short_name || '').match(/国补(\d+)%/);
                      if (gbm) item.guobu = gbm[1];
                    });
                  } catch(e) {}
                }
                // 保存商品链接 — 从 API 数据直接构造干净链接（不请求淘宝）
                var tbId = g.goods_id || g.goodsId || g.num_iid || g.itemid || g.item_id || '';
                if (!tbId) {
                  // 尝试从 API 各种 URL 字段中提取数字ID
                  var allUrls = [g.item_url, g.coupon_click_url, g.click_url, g.url, g.share_url, g.direct_url].join(' ');
                  var tbIdMatch = allUrls.match(/[?&](?:id|itemId|item_id)=(\d{8,})/);
                  if (tbIdMatch) tbId = tbIdMatch[1];
                }
                if (tbId) {
                  var linkHost = (g.is_tmall === '1' || g.is_chaoshi === '1') ? 'https://detail.tmall.com/item.htm?id=' : 'https://item.taobao.com/item.htm?id=';
                  item.productLink = linkHost + tbId;
                } else if (g.item_url && g.item_url.match(/(?:detail\.tmall|item\.taobao|chaoshi\.detail\.tmall)\.com\/item\.htm\?id=\d+/)) {
                  item.productLink = g.item_url;
                } else if (g.coupon_click_url && g.coupon_click_url.match(/(?:detail\.tmall|item\.taobao|chaoshi\.detail\.tmall)\.com\/item\.htm\?id=\d+/)) {
                  item.productLink = g.coupon_click_url;
                }
                if (!item.orderLink && g.coupon_click_url) item.orderLink = g.coupon_click_url;
                if (!item.orderLink && g.item_url) item.orderLink = g.item_url;
                // market_group 含 420 表示有淘金币抵扣
                var spText = g.special_text || [];
                for (var si = 0; si < spText.length; si++) {
                  var stm = spText[si].match(/淘金币抵后([\d.]+)/);
                  if (stm) { item.special_text_lowest = stm[1]; break; }
                }
              }
              // qty fallback：parseTpl/search-v2 都没拿到件数时，从title提取
              if (!item.qty && !(item.divisor && parseInt(item.divisor) > 1) && item.title) {
                var qm = item.title.match(/(?:任选|下单)(\d+)件/);
                if (qm) item.qty = qm[1];
              }
              item.promoCopy = genCopy(item);
            });
          });
      }).then(function () {
        // 通过 SMZDM 后台 market_search API 批量解析商品链接（不请求淘宝，不被限流）
        btn.textContent = '解析链接中...';
        var needResolve = [];
        results.forEach(function(item) {
          if (item.productLink && item.productLink.match(/^https?:\/\/(?:detail\.tmall|item\.taobao|chaoshi\.detail\.tmall)\.com\/item\.htm\?id=\d+/)) {
            return;
          }
          // 如果没有 goodsSign，尝试从 edetail 链接中提取
          if (!item.goodsSign) {
            var links = [item.orderLink, item.couponLink, item.productLink].filter(Boolean);
            for (var li = 0; li < links.length; li++) {
              var gsMatch = links[li].match(/[?&]id=([A-Za-z0-9_-]{20,})/);
              if (gsMatch) { item.goodsSign = gsMatch[1]; break; }
            }
          }
          if (item.goodsSign) {
            needResolve.push(item);
          } else {
            item.productLink = item.orderLink || item.couponLink || '';
          }
        });
        if (needResolve.length === 0) return Promise.resolve();
        // 逐个通过 SMZDM market_search 查询（SMZDM自家服务器不限流）
        function resolveOneViaSmzdm(item) {
          return GM_xmlhttpRequest_promise('POST', 'https://go.smzdm.com/tool/market_search',
            'mall=%E6%B7%98%E5%AE%9D&id_type=3&ids=' + encodeURIComponent(item.goodsSign) + '&idrel=&get_idrel=%E6%8F%90%E4%BA%A4',
            { 'Content-Type': 'application/x-www-form-urlencoded' }
          ).then(function(html) {
            var m = html.match(/<textarea[^>]*name="idrel"[^>]*>([\s\S]*?)<\/textarea>/);
            if (m && m[1]) {
              var linkMatch = m[1].match(/数字商品链接[：:]\s*(https?:\/\/[^\s；\n]+)/);
              if (linkMatch) { item.productLink = linkMatch[1]; }
              if (!linkMatch) {
                // 备选：从textarea中提取任何 tmall/taobao 链接
                var altLink = m[1].match(/(https?:\/\/(?:detail\.tmall|item\.taobao|chaoshi\.detail\.tmall)\.com\/item\.htm\?id=\d+)/);
                if (altLink) item.productLink = altLink[1];
              }
              var bMatch = m[1].match(/营销ID\s*B段[：:]\s*(\S+)/);
              if (bMatch) item.bDuan = bMatch[1];
              if (item.productLink && item.productLink.match(/item\.htm\?id=\d+/)) return;
            }
            // market_search 失败，尝试从 orderLink 重定向跟踪获取真实链接
            var rawLink = item.orderLink || item.couponLink || '';
            if (rawLink) {
              return resolveProductLink(rawLink).then(function(resolved) {
                if (resolved) item.productLink = resolved;
                else item.productLink = rawLink;
              });
            }
            item.productLink = rawLink;
          }).catch(function() {
            var rawLink = item.orderLink || item.couponLink || '';
            if (rawLink) {
              return resolveProductLink(rawLink).then(function(resolved) {
                if (resolved) item.productLink = resolved;
                else item.productLink = rawLink;
              });
            }
            item.productLink = rawLink;
          });
        }
        // 串行执行，避免并发问题
        var chain = Promise.resolve();
        needResolve.forEach(function(item) {
          chain = chain.then(function() { return resolveOneViaSmzdm(item); });
        });
        return chain;
      }).then(function () {
        // 统一清理标题：优先用卡片 DOM data-d_title，再 cleanTitle
        results.forEach(function(item) {
          if (domTitles[item.id]) {
            item.title = domTitles[item.id];
          } else {
            item.title = cleanTitle(item.title);
          }
          // domDivisors 最终兜底（search-v2 未命中时）
          if (!item.divisor && domDivisors[item.id]) {
            item.divisor = domDivisors[item.id];
          }
          // qty最终兜底：从 title / domTitles 提取（含"任选X件"/"下单X件"）
          if (!item.qty && !(item.divisor && parseInt(item.divisor) > 1)) {
            var qsrc = item.title || domTitles[item.id] || '';
            var qm = qsrc.match(/(?:任选|下单)(\d+)件/);
            if (qm) item.qty = qm[1];
          }
          item.promoCopy = genCopy(item);
        });
        localStorage.setItem('tuopin_selected_data', JSON.stringify(results, null, 2));
        btn.textContent = '已获取 (' + results.length + ')';
        btn.disabled = false;
        setTimeout(function () { btn.textContent = '获取选中商品'; }, 3000);
      });
      }); // end waitForCards
    };

    document.getElementById('tb-view').onclick = function () {
      showDetail();
    };

    document.getElementById('tb-publish').onclick = function () {
      var data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]');
      if (data.length === 0) {
        alert('请先获取选中商品');
        return;
      }
      var queue = data.map(function (item) {
        var dealPrice = parseFloat((item.price || '0').replace('元', ''));
        var subsidyAmount = item.subsidy && parseFloat(item.subsidy) > 0 ? parseFloat(item.subsidy) : 0;
        var mall = '天猫';
        var origPrice = parseFloat(item.original_price || '0');
        var youhuiParts = [];
        if (origPrice > dealPrice) youhuiParts.push('目前售价' + origPrice + '元');
        if (item.coupon_amount && parseFloat(item.coupon_amount) > 0) {
          if (item.coupon_condition) youhuiParts.push('使用满' + item.coupon_condition + '元减' + item.coupon_amount + '元优惠券');
          else youhuiParts.push('使用' + item.coupon_amount + '元优惠券');
        }
        var youhuiText = mall + '该商品' + youhuiParts.join('，') + '，到手价' + dealPrice.toFixed(2) + '元，近期好价，喜欢可入～';
        // 折后单价：纯到手价 ÷ 件数（单件时直接用到手价）—— 注意不是"补贴后"价格
        var qty = item.qty || '';
        if (!qty) {
          var qm = item.title ? item.title.match(/(\d+)件/) : null;
          qty = qm ? qm[1] : '1';
        }
        var qtyNum = parseInt(qty) || 1;
        // 折后单价用纯到手价（与 genCopy 的"折xx元/件"保持一致，而非"补贴后折"）
        var unitPrice = qtyNum > 1 ? (dealPrice / qtyNum).toFixed(2) : dealPrice.toFixed(2);
        return {
          title: item.title || '',
          productLink: item.productLink || item.orderLink || item.couponLink || '',
          price: unitPrice,
          original_price: item.original_price || '',
          coupon_amount: item.coupon_amount || '',
          coupon_condition: item.coupon_condition || '',
          promoCopy: item.promoCopy || '',
          youhuiText: youhuiText,
          subsidy: item.subsidy || '',
          manualTjb: item.manualTjb || '',
          gid: item.id || item.gid || '',
          dealPrice: dealPrice.toFixed(2),
          qty: String(qtyNum),
          commissionRate: item.commission_rate || '',
          goodsSign: item.goodsSign || '',
          mall: item.mall || '淘宝',
          bDuan: item.bDuan || '',
          code: GM_getValue('tuopin_subsidy_code', '')
        };
      });
      GM_setValue('tuopin_publish_queue', JSON.stringify(queue));
      GM_setValue('tuopin_publish_index', 0);
      GM_setValue('tuopin_publish_results', '[]');
      GM_setValue('tuopin_summary_closed', '');
      // 新开标签页跑流程：生成带序号的 runId 引导锁并带进 URL，让新标签成为流程归属者。
      // 大淘客本页不执行队列，故不写自身 session、不启心跳（避免长期占锁误拦后续手动操作）。
      var seq = (parseInt(GM_getValue(TUOPIN_FLOW_SEQ_KEY, '0'), 10) || 0) + 1;
      GM_setValue(TUOPIN_FLOW_SEQ_KEY, String(seq));
      var runId = 's' + seq + 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      tuopinWriteLock(runId);
      GM_openInTab('http://youhui.bgm.smzdm.com/add_guonei?tuopin_run=' + encodeURIComponent(runId), { active: false, insert: true });
    };

    uc();
  }

  var tmr = null;
  new MutationObserver(function () {
    clearTimeout(tmr);
    tmr = setTimeout(function () {
      if (document.querySelector('.goodsLayoutGutter')) {
        inj();
        if (!document.getElementById('tuopin-toolbar')) ctb();
      }
      // JD 页面也监听 DOM 变化注入 checkbox
      if (jdIsJDPage()) { jdInj(); jdCtb(); }
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });

  var scrollTmr = null;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTmr);
    scrollTmr = setTimeout(function() {
      if (jdIsJDPage()) { jdInj(); jdUc(); }
      else { inj(); uc(); }
    }, 200);
  }, true);

  function ti() {
    if (document.querySelector('.goodsLayoutGutter')) { inj(); ctb(); }
    else if (jdIsJDPage()) { jdInj(); jdCtb(); }
    else setTimeout(ti, 500);
  }
  ti();

  // ===== JD 商品采集 =====
  var JD_K = 'tuopin_jd_selected';
  var JD_F = '__tuopin_jd_inited__';

  function jdIsJDPage() {
    return /search\.jd\.com|list\.jd\.com/.test(location.hostname);
  }

  function jdLd() {
    try { return JSON.parse(localStorage.getItem(JD_K) || '[]'); }
    catch (e) { return []; }
  }

  function jdSv(ids) {
    localStorage.setItem(JD_K, JSON.stringify(ids));
  }

  function jdGi() {
    return Array.from(document.querySelectorAll('[data-sku]'));
  }

  function jdGid(el) {
    return el.getAttribute('data-sku') || '';
  }

  function jdHl(el, on) {
    if (on) {
      el.style.outline = '3px solid #ff7a00';
      el.style.outlineOffset = '-3px';
      el.style.borderRadius = '4px';
      el.style.background = '#fff7e6';
    } else {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.borderRadius = '';
      el.style.background = '';
    }
  }

  function jdGetInfo(el) {
    var sku = jdGid(el);
    var titleEl = el.querySelector('[title]');
    var title = titleEl ? (titleEl.getAttribute('title') || titleEl.getAttribute('alt') || '') : '';
    var text = (el.textContent || '').trim();
    var priceMatch = text.match(/¥\s*([\d.]+)/);
    var price = priceMatch ? priceMatch[1] : '';
    // 店铺
    var shop = '';
    var shopMatch = text.match(/([^\s|¥\d]+(?:京东)?(?:自营旗舰店|旗舰店|专卖店|专营店))/);
    if (shopMatch) shop = shopMatch[1];
    // 销量/热度
    var sales = '';
    var salesMatch = text.match(/(?:已售\s*\d+[万+]?\s*\+?|\d+[万+]?\s*\+\s*(?:人已买|人种草|人复购))/);
    if (salesMatch) sales = salesMatch[0];
    // 图片
    var imgEl = el.querySelector('img');
    var img = imgEl ? (imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || '') : '';
    if (img && img.startsWith('//')) img = 'https:' + img;
    // 商品链接
    var link = 'https://item.jd.com/' + sku + '.html';
    return { sku: sku, title: title, price: price, shop: shop, sales: sales, img: img, link: link };
  }

  function jdInj() {
    var ids = jdLd();
    jdGi().forEach(function (item) {
      var id = jdGid(item);
      // 已有 checkbox：只更新状态
      if (item.dataset.tuopinJd) {
        var cb = item.querySelector('.tuopin-jd-checkbox');
        if (cb) cb.checked = id && ids.indexOf(id) >= 0;
        jdHl(item, id && ids.indexOf(id) >= 0);
        return;
      }
      item.dataset.tuopinJd = '1';
      item.style.position = 'relative';

      var id = jdGid(item);
      var checked = id && ids.indexOf(id) >= 0;
      if (checked) jdHl(item, true);

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'tuopin-jd-checkbox';
      cb.checked = checked;
      cb.style.cssText = 'position:absolute;top:4px;left:4px;z-index:99;width:16px;height:16px;cursor:pointer;accent-color:#ff7a00;';
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = jdGid(item);
        if (!id) return;
        var ids = jdLd(), idx = ids.indexOf(id);
        if (cb.checked) {
          if (idx === -1) ids.push(id);
          jdHl(item, true);
        } else {
          if (idx !== -1) ids.splice(idx, 1);
          jdHl(item, false);
        }
        jdSv(ids);
        jdUc();
      });
      item.appendChild(cb);
    });
  }

  function jdUc() {
    var el = document.getElementById('tuopin-jd-count');
    if (el) el.textContent = '(' + jdLd().length + ')';
  }

  function jdCtb() {
    if (document.getElementById('tuopin-jd-toolbar')) return;
    var t = document.createElement('div');
    t.id = 'tuopin-jd-toolbar';
    var tbCollapsed = GM_getValue('tuopin_jd_tb_collapsed', '') === '1';
    t.innerHTML = '<div style="font-size:14px;font-weight:600;color:#333;border-bottom:' + (tbCollapsed ? 'none' : '1px solid #eee') + ';padding-bottom:' + (tbCollapsed ? '0' : '8px') + ';margin-bottom:' + (tbCollapsed ? '0' : '8px') + ';display:flex;align-items:center;justify-content:space-between;cursor:pointer;" id="jd-tb-header">' +
      '<span>拓品助手-JD <span id="tuopin-jd-count" style="color:#ff7a00;">(0)</span></span>' +
      '<span id="jd-tb-toggle" style="font-size:11px;color:#999;margin-left:6px;">' + (tbCollapsed ? '▶' : '▼') + '</span>' +
      '</div>' +
      '<div id="jd-tb-body" style="display:' + (tbCollapsed ? 'none' : 'block') + ';">' +
      '<button id="jd-tb-all" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ddd;border-radius:4px;background:#f8f9fa;font-size:13px;cursor:pointer;text-align:left;">全选本页</button>' +
      '<button id="jd-tb-none" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ddd;border-radius:4px;background:#f8f9fa;font-size:13px;cursor:pointer;text-align:left;">取消全选</button>' +
      '<button id="jd-tb-get" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ff4757;border-radius:4px;background:#ff4757;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">获取选中商品</button>' +
      '<button id="jd-tb-view" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">查看优惠信息</button>' +
      '<button id="jd-tb-publish" style="display:block;width:100%;padding:6px 10px;margin-bottom:8px;border:1px solid #52c41a;border-radius:4px;background:#52c41a;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">去发布</button>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:4px;margin-bottom:4px;">' +
      '<span id="jd-tb-cog" style="cursor:pointer;color:#999;font-size:12px;">⚙ 京东API</span></div>' +
      '<div id="jd-tb-settings" style="display:none;margin-bottom:8px;padding:8px;background:#f9f9f9;border-radius:6px;">' +
        '<input id="jd-tb-channel" type="text" placeholder="channel_id" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;margin-bottom:4px;">' +
        '<input id="jd-tb-apikey" type="password" placeholder="X-Bgm-Api-Key" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;box-sizing:border-box;margin-bottom:4px;">' +
        '<button id="jd-tb-savekey" style="width:100%;padding:5px;background:#1890ff;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer;">保存凭证</button>' +
      '</div>' +
      '<div style="border-top:1px solid #eee;padding-top:8px;margin-top:4px;">' +
        '<div style="margin-bottom:4px;"><label style="color:#666;font-size:11px;">标签（可多选）</label>' +
        '<div id="jd-tb-tag-trigger" style="border:1px solid #ddd;border-radius:4px;padding:4px 6px;cursor:pointer;font-size:12px;min-height:22px;display:flex;justify-content:space-between;align-items:center;background:#fff;margin-bottom:4px;">' +
          '<span id="jd-tb-tag-summary" style="color:#bbb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">请选择标签</span>' +
          '<span style="color:#999;font-size:10px;">▾</span>' +
        '</div>' +
        '<div id="jd-tb-tag-dropdown" style="display:none;border:1px solid #ddd;border-radius:4px;padding:4px;margin-top:2px;max-height:120px;overflow-y:auto;font-size:11px;line-height:1.6;background:#fff;"></div>' +
        '<div style="display:flex;gap:4px;margin-top:4px;">' +
          '<input id="jd-tb-tag-input" type="text" placeholder="添加标签，如今日必买" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="jd-tb-tag-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div></div>' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">表单邮箱</div>' +
        '<select id="jd-tb-email-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;"><option value="">请选择邮箱</option></select>' +
        '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
          '<input id="jd-tb-email-input" type="text" placeholder="添加邮箱" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="jd-tb-email-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">发布账号</div>' +
        '<select id="jd-tb-account-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;"><option value="">请选择账号</option></select>' +
        '<div style="display:flex;gap:4px;">' +
          '<input id="jd-tb-account-input" type="text" placeholder="添加账号" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="jd-tb-account-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div>' +
        '<div style="margin-top:8px;">' +
          '<div style="font-size:11px;color:#999;margin-bottom:4px;">是否在已有文章补贴</div>' +
          '<select id="jd-tb-subsidy-existing" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;">' +
            '<option value="no">否</option>' +
            '<option value="yes">是</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '</div>';
    t.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);padding:12px 16px;width:170px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    document.body.appendChild(t);
    // 面板构建完成后，立即补一次版本更新徽标（若远端已有新版）
    if (window.__tuopinApplyUpdateBadge) window.__tuopinApplyUpdateBadge();

    // 折叠/展开
    document.getElementById('jd-tb-header').onclick = function() {
      var body = document.getElementById('jd-tb-body');
      var toggle = document.getElementById('jd-tb-toggle');
      var header = document.getElementById('jd-tb-header');
      var nowCollapsed = body.style.display === 'none';
      body.style.display = nowCollapsed ? 'block' : 'none';
      toggle.textContent = nowCollapsed ? '▼' : '▶';
      header.style.borderBottom = nowCollapsed ? '1px solid #eee' : 'none';
      header.style.paddingBottom = nowCollapsed ? '8px' : '0';
      header.style.marginBottom = nowCollapsed ? '8px' : '0';
      GM_setValue('tuopin_jd_tb_collapsed', nowCollapsed ? '' : '1');
    };

    // 全选
    document.getElementById('jd-tb-all').onclick = function() {
      var allIds = jdGi().map(function(el) { return jdGid(el); }).filter(Boolean);
      jdSv(allIds);
      jdInj();
      jdUc();
    };

    // 取消全选
    document.getElementById('jd-tb-none').onclick = function() {
      jdSv([]);
      jdInj();
      jdUc();
    };

    // 标签管理（多选，与编辑后台发布共用 tuopin_tag_list / tuopin_selected_tags）
    function jdLoadTags() { try { return JSON.parse(GM_getValue('tuopin_tag_list', '[]')); } catch(e) { return []; } }
    function jdSaveTags(list) { GM_setValue('tuopin_tag_list', JSON.stringify(list)); }
    function jdLoadSelTags() { try { return JSON.parse(GM_getValue('tuopin_selected_tags', '[]')); } catch(e) { return []; } }
    function jdSaveSelTags(list) { GM_setValue('tuopin_selected_tags', JSON.stringify(list)); }
    function jdRefreshTagSelect() {
      var box = document.getElementById('jd-tb-tag-dropdown');
      if (!box) return;
      var tags = jdLoadTags();
      var selected = jdLoadSelTags();
      box.innerHTML = '';
      if (!tags.length) { box.innerHTML = '<span style="color:#bbb;">暂无标签，请在下方添加</span>'; }
      else {
        tags.forEach(function(tg) {
          var lbl = document.createElement('label');
          lbl.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;padding:2px 0;';
          var cb = document.createElement('input');
          cb.type = 'checkbox'; cb.value = tg;
          cb.checked = selected.indexOf(tg) >= 0;
          cb.onchange = function() {
            var cur = jdLoadSelTags();
            if (this.checked) { if (cur.indexOf(tg) < 0) cur.push(tg); }
            else { cur = cur.filter(function(x) { return x !== tg; }); }
            jdSaveSelTags(cur);
            jdUpdateTagSummary();
          };
          lbl.appendChild(cb);
          var span = document.createElement('span'); span.textContent = tg;
          span.style.cssText = 'flex:1;';
          lbl.appendChild(span);
          var del = document.createElement('span');
          del.textContent = '×';
          del.style.cssText = 'cursor:pointer;color:#ff4d4f;font-size:13px;line-height:1;padding:0 4px;';
          del.title = '删除标签';
          del.onclick = function(e) {
            e.preventDefault(); e.stopPropagation();
            if (!confirm('删除标签「' + tg + '」？')) return;
            jdSaveTags(jdLoadTags().filter(function(x) { return x !== tg; }));
            jdSaveSelTags(jdLoadSelTags().filter(function(x) { return x !== tg; }));
            jdRefreshTagSelect();
          };
          lbl.appendChild(del);
          box.appendChild(lbl);
        });
      }
      jdUpdateTagSummary();
    }
    function jdUpdateTagSummary() {
      var summary = document.getElementById('jd-tb-tag-summary');
      if (!summary) return;
      var selected = jdLoadSelTags();
      summary.textContent = selected.length ? selected.join('、') : '请选择标签';
      summary.style.color = selected.length ? '#333' : '#bbb';
    }
    (function() {
      var trigger = document.getElementById('jd-tb-tag-trigger');
      var dropdown = document.getElementById('jd-tb-tag-dropdown');
      if (trigger && dropdown) {
        trigger.onclick = function(e) {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        document.addEventListener('click', function(e) {
          if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        });
      }
      var addBtn = document.getElementById('jd-tb-tag-add');
      if (addBtn) addBtn.onclick = function() {
        var input = document.getElementById('jd-tb-tag-input');
        var tag = (input.value || '').trim();
        if (!tag) { alert('请输入标签'); return; }
        var list = jdLoadTags();
        if (list.indexOf(tag) < 0) { list.push(tag); jdSaveTags(list); }
        var sel = jdLoadSelTags();
        if (sel.indexOf(tag) < 0) { sel.push(tag); jdSaveSelTags(sel); }
        jdRefreshTagSelect();
        input.value = '';
      };
      jdRefreshTagSelect();
    })();

    // 邮箱管理（与淘客共用 GM 存储，邮箱/账号跨页面一致）
    function loadEmails() { try { return JSON.parse(GM_getValue('tuopin_email_list', '[]')); } catch(e) { return []; } }
    function saveEmails(list) { GM_setValue('tuopin_email_list', JSON.stringify(list)); }
    function getSelectedEmail() { return GM_getValue('tuopin_selected_email', ''); }
    function setSelectedEmail(email) { GM_setValue('tuopin_selected_email', email); }
    function refreshEmailSelect() {
      var sel = document.getElementById('jd-tb-email-select');
      if (!sel) return;
      var emails = loadEmails();
      var current = getSelectedEmail();
      sel.innerHTML = '<option value="">请选择邮箱</option>';
      emails.forEach(function(em) {
        var opt = document.createElement('option');
        opt.value = em; opt.textContent = em;
        if (em === current) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    refreshEmailSelect();
    document.getElementById('jd-tb-email-select').onchange = function() { setSelectedEmail(this.value); };
    document.getElementById('jd-tb-email-add').onclick = function() {
      var input = document.getElementById('jd-tb-email-input');
      var email = (input.value || '').trim();
      if (!email || email.indexOf('@') < 0) { alert('请输入有效邮箱'); return; }
      var list = loadEmails();
      if (list.indexOf(email) < 0) { list.push(email); saveEmails(list); }
      setSelectedEmail(email);
      refreshEmailSelect();
      input.value = '';
    };

    // 发布账号管理
    function loadAccounts() { try { return JSON.parse(GM_getValue('tuopin_account_list', '[]')); } catch(e) { return []; } }
    function saveAccounts(list) { GM_setValue('tuopin_account_list', JSON.stringify(list)); }
    function getSelectedAccount() { return GM_getValue('tuopin_selected_account', ''); }
    function setSelectedAccount(acc) { GM_setValue('tuopin_selected_account', acc); }
    function refreshAccountSelect() {
      var sel = document.getElementById('jd-tb-account-select');
      if (!sel) return;
      var accounts = loadAccounts();
      var current = getSelectedAccount();
      sel.innerHTML = '<option value="">请选择账号</option>';
      accounts.forEach(function(acc) {
        var opt = document.createElement('option');
        opt.value = acc; opt.textContent = acc;
        if (acc === current) opt.selected = true;
        sel.appendChild(opt);
      });
    }
    refreshAccountSelect();
    document.getElementById('jd-tb-account-select').onchange = function() { setSelectedAccount(this.value); };
    document.getElementById('jd-tb-account-add').onclick = function() {
      var input = document.getElementById('jd-tb-account-input');
      var acc = (input.value || '').trim();
      if (!acc) { alert('请输入账号'); return; }
      var list = loadAccounts();
      if (list.indexOf(acc) < 0) { list.push(acc); saveAccounts(list); }
      setSelectedAccount(acc);
      refreshAccountSelect();
      input.value = '';
    };

    // 是否补贴
    var subsidySel = document.getElementById('jd-tb-subsidy-existing');
    subsidySel.value = GM_getValue('tuopin_subsidy_existing', 'no') || 'no';
    subsidySel.onchange = function() { GM_setValue('tuopin_subsidy_existing', this.value); };

    // 京东 API 凭证配置（齿轮展开/保存）
    var jdCog = document.getElementById('jd-tb-cog');
    var jdSettings = document.getElementById('jd-tb-settings');
    var jdChannelInput = document.getElementById('jd-tb-channel');
    var jdApikeyInput = document.getElementById('jd-tb-apikey');
    jdChannelInput.value = GM_getValue('jd_api_channel_id', '') || '';
    jdApikeyInput.value = GM_getValue('jd_api_key', '') || '';
    jdCog.onclick = function() { jdSettings.style.display = jdSettings.style.display === 'none' ? 'block' : 'none'; };
    document.getElementById('jd-tb-savekey').onclick = function() {
      GM_setValue('jd_api_channel_id', (jdChannelInput.value || '').trim());
      GM_setValue('jd_api_key', (jdApikeyInput.value || '').trim());
      this.textContent = '已保存'; this.style.background = '#52c41a';
      setTimeout(function() { var b = document.getElementById('jd-tb-savekey'); b.textContent = '保存凭证'; b.style.background = '#1890ff'; }, 1500);
    };

    // 获取选中商品：调京东 keywordSearch API 补全券后价/优惠券/佣金
    document.getElementById('jd-tb-get').onclick = function() {
      var btn = this;
      var channelId = GM_getValue('jd_api_channel_id', '') || '';
      var apiKey = GM_getValue('jd_api_key', '') || '';
      if (!channelId || !apiKey) { alert('请先在⚙京东API中填写 channel_id 和 X-Bgm-Api-Key'); jdSettings.style.display = 'block'; return; }
      var ids = jdLd();
      if (!ids.length) { alert('请先勾选商品'); return; }
      btn.textContent = '获取中...'; btn.disabled = true;

      // 收集每个勾选商品的标题/SKU/链接/页面价格
      var cards = jdGi();
      var infoMap = {};
      cards.forEach(function(card) { var info = jdGetInfo(card); infoMap[info.sku] = info; });
      var queries = ids.map(function(id) {
        var info = infoMap[id] || { sku: id, link: 'https://item.jd.com/' + id + '.html' };
        // 用商品标题作为搜索关键词，截短避免过长
        var kw = (info.title || '').slice(0, 40) || id;
        return { id: id, info: info, keyword: kw };
      });

      function jdApiQuery(keyword, cb) {
        GM_xmlhttpRequest({
          method: 'POST',
          url: 'http://youhui.bgm.smzdm.com/skill/keywordSearch',
          headers: { 'Content-Type': 'application/json', 'X-Bgm-Api-Key': apiKey },
          data: JSON.stringify({ source: 'jd', keyword: keyword, channel_id: channelId, page_index: 1, page_size: 50, sortName: 'price' }),
          timeout: 30000,
          onload: function(r) {
            try {
              var j = JSON.parse(r.responseText);
              if (j.error_code !== 0) { cb(null); return; }
              var q = JSON.parse(j.data.result.jd_union_open_goods_query_responce.queryResult);
              cb(q.data || []);
            } catch(e) { cb(null); }
          },
          onerror: function() { cb(null); },
          ontimeout: function() { cb(null); }
        });
      }

      // 计算单个商品叠加到手价（同 category-price-query Skill 逻辑）
      function jdBestTotal(item) {
        var pi = item.priceInfo || {};
        var orig = parseFloat(pi.price || '99999999');
        var coupons = (item.couponInfo || {}).couponList || [];
        var current = orig;
        var pct = coupons.filter(function(c) { return c.couponStyle === 3; });
        if (pct.length) current = Math.round(current * Math.min.apply(null, pct.map(function(c) { return c.discount; })) * 100) / 100;
        var fixed = coupons.filter(function(c) { return c.couponStyle === 0 || c.couponStyle === 4; });
        if (fixed.length) {
          var applicable = fixed.filter(function(c) { return current >= (c.quota || 0); });
          if (applicable.length) current = Math.round((current - Math.max.apply(null, applicable.map(function(c) { return c.discount; }))) * 100) / 100;
        }
        var calc = Math.max(current, 0.01);
        var couponPrice = parseFloat(pi.lowestCouponPrice || orig);
        var ppi = item.purchasePriceInfo || {};
        var purchasePrice = parseFloat(ppi.purchasePrice || '0');
        var candidates = [calc, couponPrice, purchasePrice].filter(function(p) { return p > 0; });
        return candidates.length ? Math.min.apply(null, candidates) : orig;
      }

      // 逐条查询（避免并发触发风控）
      var results = [];
      var idx = 0;
      function next() {
        if (idx >= queries.length) {
          localStorage.setItem('tuopin_selected_data', JSON.stringify(results, null, 2));
          btn.textContent = '已获取 ' + results.length + ' 件';
          btn.disabled = false;
          setTimeout(function() { btn.textContent = '获取选中商品'; }, 2000);
          return;
        }
        var q = queries[idx++];
        jdApiQuery(q.keyword, function(items) {
          btn.textContent = '获取中(' + idx + '/' + queries.length + ')';
          var picked = null;
          // 优先按 SKU 精确匹配，否则取最便宜的
          if (items && items.length) {
            picked = items.filter(function(it) { return String(it.spuid || it.skuId || '') === String(q.id); })[0] || items[0];
          }
          var info = q.info;
          if (picked) {
            var dealPrice = jdBestTotal(picked);
            var qtyNum = 1;
            var qm = info.title ? info.title.match(/(\d+)\s*(?:件|支|袋|包|罐|瓶|听|盒)/) : null;
            if (qm) qtyNum = parseInt(qm[1]) || 1;
            var unitPrice = qtyNum > 1 ? (dealPrice / qtyNum).toFixed(2) : dealPrice.toFixed(2);
            var pi = picked.priceInfo || {};
            var origPrice = parseFloat(pi.price || '0') || 0;
            var lowestCouponPrice = parseFloat(pi.lowestCouponPrice || '0') || 0;
            var ppi = picked.purchasePriceInfo || {};
            var purchasePrice = parseFloat(ppi.purchasePrice || '0') || 0;
            var coupons = (picked.couponInfo || {}).couponList || [];
            // 完整券列表（用于详情展示）
            var couponListStr = coupons.map(function(c) {
              var desc = '';
              if (c.couponStyle === 3) desc = '满减折扣' + (c.discount ? (Math.round(c.discount*1000)/10) + '折' : '');
              else if (c.couponStyle === 0 || c.couponStyle === 4) desc = '满' + (c.quota||0) + '减' + (c.discount||0);
              else if (c.couponStyle === 529) desc = '满件折';
              else desc = '券(style=' + c.couponStyle + ')';
              return desc;
            }).join('；');
            var couponAmt = '', couponCond = '';
            var fixedC = coupons.filter(function(c) { return c.couponStyle === 0 || c.couponStyle === 4; });
            if (fixedC.length) {
              couponAmt = String(Math.max.apply(null, fixedC.map(function(c) { return c.discount; })));
              couponCond = String(fixedC[0].quota || '');
            }
            // 佣金
            var ci = picked.commissionInfo || {};
            var commShare = ci.commissionShare || '';   // 佣金比例 %
            var commAmount = ci.commission || '';       // 佣金金额
            // API 返回的 SKU 名（用于详情展示，可能与页面标题不同）
            var apiSkuName = picked.skuName || '';
            // 优惠文案
            var parts = [];
            if (origPrice > dealPrice) parts.push('目前售价' + origPrice + '元');
            if (couponAmt) parts.push(couponCond ? '使用满' + couponCond + '元减' + couponAmt + '元优惠券' : '使用' + couponAmt + '元优惠券');
            if (!parts.length) parts.push('到手价' + dealPrice.toFixed(2) + '元');
            results.push({
              id: info.sku || q.id,
              gid: info.sku || q.id,
              title: info.title || '',
              apiSkuName: apiSkuName,
              productLink: info.link,
              price: unitPrice,
              original_price: origPrice ? origPrice.toFixed(2) : '',
              lowestCouponPrice: lowestCouponPrice ? lowestCouponPrice.toFixed(2) : '',
              purchasePrice: purchasePrice ? purchasePrice.toFixed(2) : '',
              couponListStr: couponListStr,
              couponListArr: coupons.map(function(c) {
                var desc = '';
                if (c.couponStyle === 3) desc = '满减折扣' + (c.discount ? (Math.round(c.discount*1000)/10) + '折' : '');
                else if (c.couponStyle === 0 || c.couponStyle === 4) desc = '满' + (c.quota||0) + '减' + (c.discount||0);
                else if (c.couponStyle === 529) desc = '满件折';
                else desc = '券(style=' + c.couponStyle + ')';
                return { desc: desc, link: '' };
              }),
              coupon_amount: couponAmt,
              coupon_condition: couponCond,
              promoCopy: '',
              youhuiText: '京东该商品' + parts.join('，') + '，到手价' + dealPrice.toFixed(2) + '元，近期好价，喜欢可入～',
              subsidy: '', manualTjb: '',
              dealPrice: dealPrice.toFixed(2),
              qty: String(qtyNum),
              commissionRate: commShare,
              commissionAmount: commAmount,
              goodsSign: '',
              mall: '京东', bDuan: ''
            });
          } else {
            // API 未匹配，回退用页面价格
            var dp = parseFloat(info.price || '0') || 0;
            results.push({
              id: info.sku || q.id, gid: info.sku || q.id,
              title: info.title || '', productLink: info.link,
              price: dp.toFixed(2), original_price: info.price || '',
              coupon_amount: '', coupon_condition: '', promoCopy: '',
              youhuiText: '京东该商品到手价' + dp.toFixed(2) + '元，近期好价，喜欢可入～',
              subsidy: '', manualTjb: '', dealPrice: dp.toFixed(2), qty: '1',
              commissionRate: '', goodsSign: '', mall: '京东', bDuan: ''
            });
          }
          next();
        });
      }
      next();
    };

    // 查看优惠信息：展示 selected_data
    document.getElementById('jd-tb-view').onclick = function() {
      jdShowDetail();
    };

    // 去发布：复用大淘客的 queue 构造 + 开新标签逻辑
    document.getElementById('jd-tb-publish').onclick = function() {
      var data = [];
      try { data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]'); } catch(e) {}
      if (!data.length) { alert('请先获取选中商品'); return; }
      var queue = data.map(function (item) {
        var dealPrice = parseFloat((item.dealPrice || item.price || '0').replace('元', '')) || 0;
        var qtyNum = parseInt(item.qty) || 1;
        var unitPrice = qtyNum > 1 ? (dealPrice / qtyNum).toFixed(2) : dealPrice.toFixed(2);
        var mall = item.mall || '京东';
        var origPrice = parseFloat(item.original_price || '0') || 0;
        var youhuiParts = [];
        if (origPrice > dealPrice) youhuiParts.push('目前售价' + origPrice + '元');
        if (item.coupon_amount && parseFloat(item.coupon_amount) > 0) {
          if (item.coupon_condition) youhuiParts.push('使用满' + item.coupon_condition + '元减' + item.coupon_amount + '元优惠券');
          else youhuiParts.push('使用' + item.coupon_amount + '元优惠券');
        }
        if (!youhuiParts.length) youhuiParts.push('到手价' + dealPrice.toFixed(2) + '元');
        var youhuiText = mall + '该商品' + youhuiParts.join('，') + '，近期好价，喜欢可入～';
        return {
          title: item.title || '',
          productLink: item.productLink || '',
          price: unitPrice,
          original_price: item.original_price || '',
          coupon_amount: item.coupon_amount || '',
          coupon_condition: item.coupon_condition || '',
          promoCopy: item.promoCopy || '',
          youhuiText: item.youhuiText || youhuiText,
          subsidy: item.subsidy || '',
          manualTjb: item.manualTjb || '',
          gid: item.id || item.gid || '',
          dealPrice: dealPrice.toFixed(2),
          qty: String(qtyNum),
          commissionRate: item.commissionRate || '',
          goodsSign: item.goodsSign || '',
          mall: mall,
          bDuan: item.bDuan || '',
          code: GM_getValue('tuopin_subsidy_code', '')
        };
      });
      GM_setValue('tuopin_publish_queue', JSON.stringify(queue));
      GM_setValue('tuopin_publish_index', 0);
      GM_setValue('tuopin_publish_results', '[]');
      GM_setValue('tuopin_summary_closed', '');
      var seq = (parseInt(GM_getValue(TUOPIN_FLOW_SEQ_KEY, '0'), 10) || 0) + 1;
      GM_setValue(TUOPIN_FLOW_SEQ_KEY, String(seq));
      var runId = 's' + seq + 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      tuopinWriteLock(runId);
      GM_openInTab('http://youhui.bgm.smzdm.com/add_guonei?tuopin_run=' + encodeURIComponent(runId), { active: false, insert: true });
    };

    jdUc();
  }

  // JD 商品详情弹窗
  function jdShowDetail() {
    var old = document.getElementById('tuopin-jd-detail');
    if (old) old.remove();
    var oldOverlay = document.getElementById('tuopin-jd-detail-overlay');
    if (oldOverlay) oldOverlay.remove();
    var data = [];
    try { data = JSON.parse(localStorage.getItem('tuopin_selected_data') || '[]'); } catch(e) {}
    if (!data.length) { alert('请先获取选中商品'); return; }

    var overlay = document.createElement('div');
    overlay.id = 'tuopin-jd-detail-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100000;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(overlay);

    var d = document.createElement('div');
    d.id = 'tuopin-jd-detail';
    d.style.cssText = 'background:#fff;border-radius:8px;padding:16px;width:600px;max-width:92vw;max-height:85vh;overflow-y:auto;font-family:sans-serif;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:10px;"><span style="font-weight:600;color:#333;">JD商品详情（' + data.length + '件）</span><span id="tuopin-jd-detail-close" style="cursor:pointer;color:#999;font-size:18px;">&times;</span></div>';
    data.forEach(function(item, i) {
      var origPrice = parseFloat(item.original_price || '0') || 0;
      var lowest = item.lowestCouponPrice || '—';
      var purch = item.purchasePrice || '—';
      var deal = item.dealPrice || item.price || '—';
      var commRate = item.commissionRate ? (item.commissionRate + '%') : '—';
      var commAmt = item.commissionAmount || '—';
      var couponList = item.couponListStr || '无';
      html += '<div style="border:1px solid #f0f0f0;border-radius:6px;padding:8px;margin-bottom:10px;position:relative;">' +
        // 商品名称（单行，可编辑）+ 保存 + 删除×
        '<div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">' +
          '<label style="color:#666;font-size:11px;white-space:nowrap;">商品名称</label>' +
          '<input data-jd-idx="' + i + '" class="jd-detail-title" type="text" value="' + (item.title || '').replace(/"/g,'&quot;') + '" style="flex:1;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;box-sizing:border-box;min-width:0;">' +
          '<button data-jd-idx="' + i + '" class="jd-detail-save-one" style="padding:5px 8px;border:1px solid #ff7a00;border-radius:4px;background:#ff7a00;color:#fff;font-size:11px;cursor:pointer;white-space:nowrap;">保存</button>' +
          '<span data-jd-idx="' + i + '" class="jd-detail-del" title="删除该商品" style="cursor:pointer;color:#ff4d4f;font-size:18px;line-height:1;padding:0 4px;flex-shrink:0;">×</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;color:#666;font-size:11px;line-height:1.7;margin-bottom:6px;">' +
          '<div>京东原价：<b style="color:#666;">' + (origPrice ? '¥'+origPrice.toFixed(2) : '—') + '</b></div>' +
          '<div>最终到手价：<b style="color:#ff7a00;">¥' + deal + '</b>' + (item.qty > 1 ? '('+item.qty+'件折¥'+item.price+'/件)' : '') + '</div>' +
          '<div>佣金比例：<b style="color:#722ed1;">' + commRate + '</b></div>' +
          '<div>佣金金额：<b style="color:#722ed1;">' + (commAmt === '—' ? '—' : '¥'+commAmt) + '</b></div>' +
          (function() {
            var arr = item.couponListArr;
            // 旧数据没有 couponListArr，从 couponListStr 降级构造
            if (!arr || !arr.length) {
              var str = item.couponListStr || '';
              if (!str || str === '无') return '<div style="grid-column:span 2;">券列表：<span style="color:#333;">无</span></div>';
              arr = str.split('；').filter(Boolean).map(function(desc) { return { desc: desc, link: '' }; });
              item.couponListArr = arr;
            }
            return '<div style="grid-column:span 4;display:flex;align-items:center;flex-wrap:wrap;gap:6px;"><span style="color:#666;white-space:nowrap;">券列表：</span>' +
              arr.map(function(c) {
                if (c.link) {
                  return '<a href="' + c.link.replace(/"/g,'&quot;') + '" target="_blank" style="color:#1890ff;text-decoration:underline;white-space:nowrap;">' + c.desc + '</a>';
                } else {
                  return '<span style="color:#333;white-space:nowrap;">' + c.desc + '</span>';
                }
              }).join('<span style="color:#aaa;">；</span>') +
            '</div>';
          })() +
        '</div>' +
        '<div style="color:#666;font-size:11px;line-height:1.6;margin-bottom:6px;">' +
          '<div style="color:#1890ff;word-break:break-all;">链接：<a href="' + (item.productLink||'') + '" target="_blank" style="color:#1890ff;">' + (item.productLink||'') + '</a></div>' +
        '</div>' +
        '<textarea data-jd-idx="' + i + '" class="jd-detail-copy" rows="2" style="width:100%;padding:5px 6px;border:1px solid #ddd;border-radius:4px;font-size:11px;line-height:1.5;resize:vertical;box-sizing:border-box;background:#f6ffed;color:#52c41a;">' + (item.youhuiText || '').replace(/</g,'&lt;') + '</textarea>' +
      '</div>';
    });
    d.innerHTML = html;
    overlay.appendChild(d);

    function jdSaveData(arr) { localStorage.setItem('tuopin_selected_data', JSON.stringify(arr, null, 2)); }

    document.getElementById('tuopin-jd-detail-close').onclick = function() { d.remove(); overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) { d.remove(); overlay.remove(); } };
    // 单条保存
    d.querySelectorAll('.jd-detail-save-one').forEach(function(btn) {
      btn.onclick = function() {
        var idx = parseInt(btn.getAttribute('data-jd-idx'), 10);
        var input = d.querySelector('.jd-detail-title[data-jd-idx="' + idx + '"]');
        if (isNaN(idx) || !data[idx] || !input) return;
        data[idx].title = input.value;
        jdSaveData(data);
        var orig = btn.textContent;
        btn.textContent = '已保存'; btn.style.background = '#52c41a';
        setTimeout(function() { btn.textContent = orig; btn.style.background = '#ff7a00'; }, 1200);
      };
    });
    // 单条删除
    d.querySelectorAll('.jd-detail-del').forEach(function(del) {
      del.onclick = function() {
        var idx = parseInt(del.getAttribute('data-jd-idx'), 10);
        if (isNaN(idx) || !data[idx]) return;
        if (!confirm('删除该商品？')) return;
        data.splice(idx, 1);
        jdSaveData(data);
        d.remove(); overlay.remove();
        jdShowDetail(); // 重新渲染
      };
    });
    // 文案失焦（点击空白处）自动保存
    d.querySelectorAll('.jd-detail-copy').forEach(function(ta) {
      ta.addEventListener('blur', function() {
        var idx = parseInt(ta.getAttribute('data-jd-idx'), 10);
        if (isNaN(idx) || !data[idx]) return;
        if ((data[idx].youhuiText || '') !== ta.value) {
          data[idx].youhuiText = ta.value;
          jdSaveData(data);
          var orig = ta.style.borderColor;
          ta.style.borderColor = '#52c41a';
          setTimeout(function() { ta.style.borderColor = orig; }, 800);
        }
      });
    });
  }
  // ===== END JD 商品采集 =====
})();
