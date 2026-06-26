
// ==UserScript==
// @name         大淘客拓品助手
// @namespace    https://www.dataoke.com/
// @version      1.8.0
// @downloadURL  https://raw.githubusercontent.com/handingdong4-ship-it/tuopin-assistant/main/tuopin-assistant.user.js
// @updateURL    https://raw.githubusercontent.com/handingdong4-ship-it/tuopin-assistant/main/tuopin-assistant.user.js
// @description  在大淘客选品库页面，商品卡片左上角显示复选框，勾选即选中，配合浮动工具栏获取商品详情及优惠文案，支持一键发布到SMZDM
// @author       handongxue
// @match        *://*dataoke.com/xp/*
// @match        *://*dataoke.com/*
// @include      *dataoke.com*
// @match        *://youhui.bgm.smzdm.com/add_guonei*
// @match        *://biaodan.bgm.smzdm.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @connect      detail.tmall.com
// @connect      chaoshi.detail.tmall.com
// @connect      item.taobao.com
// @connect      uland.taobao.com
// @connect      s.click.taobao.com
// @connect      www.smzdm.com
// @connect      go.smzdm.com
// @connect      biaodan.bgm.smzdm.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ===== SMZDM 自动发布逻辑 =====
  if (location.hostname === 'youhui.bgm.smzdm.com' && location.pathname.includes('add_guonei')) {
    var queueStr = GM_getValue('tuopin_publish_queue', '[]');
    var queue = [];
    try { queue = JSON.parse(queueStr); } catch (e) { queue = []; }
    var idx = GM_getValue('tuopin_publish_index', 0);
    if (!queue.length || idx >= queue.length) return;

    function smzdmLog(msg) {
      var box = document.getElementById('tuopin-smzdm-log');
      if (box) {
        box.innerHTML += '<div>' + msg + '</div>';
        box.scrollTop = box.scrollHeight;
      }
      console.log('[拓品发布] ' + msg);
    }

    function createStatusPanel() {
      var panel = document.createElement('div');
      panel.id = 'tuopin-smzdm-panel';
      panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:16px;width:320px;font-family:-apple-system,sans-serif;font-size:13px;';
      panel.innerHTML = '<div style="font-weight:600;font-size:15px;margin-bottom:8px;color:#333;">拓品自动发布</div>' +
        '<div id="tuopin-smzdm-progress" style="color:#1890ff;margin-bottom:6px;">准备中...</div>' +
        '<div id="tuopin-smzdm-log" style="max-height:200px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:8px;font-size:11px;line-height:1.6;color:#666;"></div>' +
        '<div style="margin-top:8px;display:flex;gap:6px;">' +
        '<button id="tuopin-smzdm-stop" style="padding:4px 12px;border:1px solid #ff4d4f;border-radius:4px;background:#fff;color:#ff4d4f;cursor:pointer;font-size:12px;">停止</button>' +
        '</div>';
      document.body.appendChild(panel);
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
            resolve(result);
          },
          onerror: function() { resolve(null); },
          ontimeout: function() { resolve(null); }
        });
      });
    }

    async function checkPrevArticle(prevUrl, currentPrice) {
      var info = await fetchPrevArticleInfo(prevUrl);
      if (!info) return { action: 'continue', reason: '无法获取上一篇信息，默认继续' };

      var skipTags = ['绝对值', '手慢无', '白菜党', '抄作业'];
      for (var i = 0; i < info.tags.length; i++) {
        for (var j = 0; j < skipTags.length; j++) {
          if (info.tags[i].indexOf(skipTags[j]) !== -1) {
            return { action: 'skip', reason: '上一篇有标签"' + skipTags[j] + '"' };
          }
        }
      }

      if (info.price > 0 && currentPrice > 0 && info.price <= currentPrice) {
        return { action: 'skip', reason: '上一篇到手价' + info.price + '元≤当前' + currentPrice + '元' };
      }

      if (info.author && info.author.indexOf('小小值') !== -1) {
        return { action: 'continue', reason: '上一篇为小小值发布，覆盖' };
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

        var currentPrice = parseFloat(item.price || '0');
        var decision = { action: 'continue', reason: '未找到上一篇链接' };
        if (prevLink) {
          decision = await checkPrevArticle(prevLink, currentPrice);
          smzdmLog('上一篇判断: ' + decision.reason);
        } else {
          smzdmLog('未找到上一篇链接，默认继续');
        }

        if (decision.action === 'skip') {
          // 点取消跳过
          var cancelBtns = document.querySelectorAll('.boxy-btn2, input[value="取消"], button');
          for (var i = 0; i < cancelBtns.length; i++) {
            var t = cancelBtns[i].textContent.trim() || cancelBtns[i].value || '';
            if (cancelBtns[i].offsetParent !== null && t === '取消') { cancelBtns[i].click(); break; }
          }
          return { status: 'skip_3day', reason: decision.reason, prevUrl: prevLink };
        } else {
          // 点确认继续自建
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

      // 折后单价 = 补贴后价格 ÷ 件数（每件价格）
      if (item.price) {
        var rawPrice = parseFloat(item.price.replace('元', '')) || 0;
        var qtyNum1 = parseInt(item.manualQty || item.qty || (item.divisor && parseInt(item.divisor) > 1 ? item.divisor : '') || '1') || 1;
        var unitPrice1 = qtyNum1 > 1 ? (Math.round(rawPrice / qtyNum1 * 100) / 100).toFixed(2) : rawPrice.toFixed(2);
        var priceEl = document.querySelector('[name="article_digital_price"]');
        if (priceEl) setInputValue(priceEl, unitPrice1);
        // 淘金币价格 = 淘金币到手价 ÷ 件数
        var tjbAmt0 = parseFloat(item.manualTjb || item.taoJinBi || '0') || 0;
        if (tjbAmt0 > 0) {
          var tjbTotal = Math.max(0, rawPrice - tjbAmt0);
          var tjbUnit = qtyNum1 > 1 ? (Math.round(tjbTotal / qtyNum1 * 100) / 100).toFixed(2) : tjbTotal.toFixed(2);
          var finalPriceEl = document.querySelector('[name="article_final_price"]');
          if (finalPriceEl) setInputValue(finalPriceEl, tjbUnit);
        }
        // 订单价 = 优惠券后到手总价（补贴和淘金币前）
        var pagePriceEl = document.querySelector('[name="article_page_price"]');
        if (pagePriceEl) setInputValue(pagePriceEl, rawPrice.toFixed(2));
        // 件数字段（标题旁边的数字）
        if (qtyNum1 > 1) {
          var youhuiNumEl = document.querySelector('[name="article_youhui_num"]');
          if (youhuiNumEl) setInputValue(youhuiNumEl, String(qtyNum1));
        }
      }

      // (新)价格优惠描述：有补贴时填 "淘金币到手价xx元，返xx值得买积分后"（有淘金币时加前缀）
      if (item.subsidy && parseFloat(item.subsidy) > 0) {
        var subsidyPoints = Math.round(parseFloat(item.subsidy) * 10);
        var priceDescText = '';
        var tjbAmt = parseFloat(item.manualTjb || '0');
        if (tjbAmt > 0) {
          var dp = parseFloat(item.dealPrice || '0');
          var sub = parseFloat(item.subsidy) || 0;
          var afterSub = Math.round((dp - sub) * 100) / 100;
          if (afterSub < 0) afterSub = 0;
          var tjbFinal = Math.round((afterSub - tjbAmt) * 100) / 100;
          if (tjbFinal < 0) tjbFinal = 0;
          priceDescText = '淘金币到手价' + tjbFinal.toFixed(2) + '元，';
        }
        priceDescText += '返' + subsidyPoints + '值得买积分后';
        var priceDescEl = document.querySelector('[name="article_subtitle_new"]');
        if (priceDescEl) {
          setInputValue(priceDescEl, priceDescText);
          smzdmLog('价格优惠描述: ' + priceDescText);
        }
      }

      // 优惠力度 → UEditor（优先用 promoCopy 完整文案）
      var copyText = item.promoCopy || item.youhuiText;
      if (copyText) {
        try {
          if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant0) {
            // 补贴部分加粗加红：从"返xx值得买积分"到末尾
            var htmlCopy = copyText.replace(/(返\d+值得买积分.*)$/, '<strong style="color:red">$1</strong>');
            UE.instants.ueditorInstant0.setContent('<p>' + htmlCopy + '</p>');
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

      // 标签
      if (item.subsidy && parseFloat(item.subsidy) > 0) {
        var tagInput = document.querySelector('#tag_name');
        if (tagInput) {
          setInputValue(tagInput, '美食自补');
          await sleep(100);
          var addTagBtn = document.querySelector('#add_new_tag');
          if (addTagBtn) addTagBtn.click();
          await sleep(300);
          // 加"今日必买"标签
          setInputValue(tagInput, '今日必买');
          await sleep(100);
          if (addTagBtn) addTagBtn.click();
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

      // 折后单价
      if (item.price) {
        var priceEl = document.querySelector('[name="article_digital_price"]');
        if (priceEl) setInputValue(priceEl, item.price);
      }

      // (新)价格优惠描述：有补贴时填 "淘金币到手价xx元，返xx值得买积分后"（有淘金币时加前缀）
      if (item.subsidy && parseFloat(item.subsidy) > 0) {
        var subsidyPoints = Math.round(parseFloat(item.subsidy) * 10);
        var priceDescText = '';
        var tjbAmt2 = parseFloat(item.manualTjb || '0');
        if (tjbAmt2 > 0) {
          var dp2 = parseFloat(item.dealPrice || '0');
          var sub2 = parseFloat(item.subsidy) || 0;
          var afterSub2 = Math.round((dp2 - sub2) * 100) / 100;
          if (afterSub2 < 0) afterSub2 = 0;
          var tjbFinal2 = Math.round((afterSub2 - tjbAmt2) * 100) / 100;
          if (tjbFinal2 < 0) tjbFinal2 = 0;
          priceDescText = '淘金币到手价' + tjbFinal2.toFixed(2) + '元，';
        }
        priceDescText += '返' + subsidyPoints + '值得买积分后';
        var priceDescEl = document.querySelector('[name="article_subtitle_new"]');
        if (priceDescEl) setInputValue(priceDescEl, priceDescText);
      }

      // 优惠力度 → UEditor（优先用 promoCopy 完整文案）
      var copyText = item.promoCopy || item.youhuiText;
      if (copyText) {
        try {
          if (typeof UE !== 'undefined' && UE.instants && UE.instants.ueditorInstant0) {
            // 补贴部分加粗加红：从"返xx值得买积分"到末尾
            var htmlCopy = copyText.replace(/(返\d+值得买积分.*)$/, '<strong style="color:red">$1</strong>');
            UE.instants.ueditorInstant0.setContent('<p>' + htmlCopy + '</p>');
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

      // 标签：有补贴才加"美食自补"+"今日必买"
      if (item.subsidy && parseFloat(item.subsidy) > 0) {
        var tagInput = document.querySelector('#tag_name');
        if (tagInput) {
          setInputValue(tagInput, '美食自补');
          await sleep(100);
          var addTagBtn = document.querySelector('#add_new_tag');
          if (addTagBtn) addTagBtn.click();
          await sleep(300);
          setInputValue(tagInput, '今日必买');
          await sleep(100);
          if (addTagBtn) addTagBtn.click();
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

      await sleep(500);
      var p1 = await runPhase1(item);

      if (p1 === 'skip_3day' || (p1 && p1.status === 'skip_3day')) {
        var skipReason = (p1 && p1.reason) ? p1.reason : '3天内已发布过';
        var prevUrl = (p1 && p1.prevUrl) ? p1.prevUrl : '';
        smzdmLog('跳过: ' + skipReason);
        results.push({ title: item.title || '', status: 'skip_3day', reason: skipReason, prevUrl: prevUrl });
        GM_setValue('tuopin_publish_results', JSON.stringify(results));
        currentIdx++;
        GM_setValue('tuopin_publish_index', currentIdx);
        if (currentIdx < total) {
          await sleep(500);
          window.onbeforeunload = null;
          location.href = 'http://youhui.bgm.smzdm.com/add_guonei';
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
          location.href = 'http://youhui.bgm.smzdm.com/add_guonei';
          return;
        }
      } else {
        // Phase 1 已完成字段注入，直接发布
        await sleep(300);
        var p3 = await runPhase3();

        if (p3.status === 'success') {
          results.push({ title: item.title || '', status: 'success', reason: '', articleId: p3.articleId || '' });
          // 如果有补贴，加入补贴队列
          if (item.subsidy && parseFloat(item.subsidy) > 0 && p3.articleId) {
            var subsidyQueue = [];
            try { subsidyQueue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) { subsidyQueue = []; }
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
              gid: item.gid || ''
            });
            GM_setValue('tuopin_subsidy_queue', JSON.stringify(subsidyQueue));
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
          location.href = 'http://youhui.bgm.smzdm.com/add_guonei';
          return;
        }
      }

      // 全部处理完 → 显示汇总
      showResultsSummary(results, total);
      GM_setValue('tuopin_publish_queue', '[]');
      GM_setValue('tuopin_publish_index', 0);
      GM_setValue('tuopin_publish_results', '[]');
      // 如果有补贴队列，跳转到补贴表单页面
      var pendingSubsidy = [];
      try { pendingSubsidy = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
      if (pendingSubsidy.length > 0) {
        smzdmLog('有 ' + pendingSubsidy.length + ' 个补贴待创建，3秒后跳转...');
        await sleep(3000);
        window.onbeforeunload = null;
        location.href = 'http://biaodan.bgm.smzdm.com/biaodan/subsidies_list_ver3';
      }
    }

    function showResultsSummary(results, total) {
      var successCount = 0;
      var failList = [];
      var successList = [];
      results.forEach(function (r) {
        if (r.status === 'success') { successCount++; successList.push(r); }
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

      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999998;display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:12px;padding:24px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;font-family:-apple-system,sans-serif;';
      var h = '<div style="font-size:16px;font-weight:600;color:#333;margin-bottom:12px;">发布结果汇总</div>';
      h += '<div style="color:#52c41a;margin-bottom:8px;">成功: ' + successCount + ' 个</div>';
      if (failList.length > 0) h += '<div style="color:#ff4d4f;margin-bottom:8px;">未成功: ' + failList.length + ' 个</div>';
      h += '<div style="border-top:1px solid #eee;padding-top:8px;margin-top:8px;">';
      var idx = 0;
      successList.forEach(function (r) {
        idx++;
        h += '<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;">';
        h += '<div style="font-size:13px;color:#333;">' + idx + '. ' + (r.title || '未知商品') + '</div>';
        h += '<div style="font-size:12px;color:#52c41a;margin-top:2px;">发布成功' + (r.articleId ? ' (ID: ' + r.articleId + ')' : '') + '</div>';
        h += '</div>';
      });
      failList.forEach(function (r) {
        idx++;
        var statusColor = r.status === 'skip_3day' ? '#faad14' : '#ff4d4f';
        var statusText = r.status === 'skip_3day' ? '已跳过(重复)' : r.status === 'error' ? '失败' : '未确认';
        h += '<div style="padding:6px 0;border-bottom:1px solid #f0f0f0;">';
        h += '<div style="font-size:13px;color:#333;">' + idx + '. ' + (r.title || '未知商品') + '</div>';
        var reasonHtml = r.reason;
        if (r.prevUrl) {
          reasonHtml = '<a href="' + r.prevUrl + '" target="_blank" style="color:' + statusColor + ';text-decoration:underline;">' + r.reason + '</a>';
        }
        h += '<div style="font-size:12px;color:' + statusColor + ';margin-top:2px;">' + statusText + '：' + reasonHtml + '</div>';
        h += '</div>';
      });
      h += '</div>';
      h += '<div style="text-align:right;margin-top:12px;"><button id="tuopin-result-close" style="padding:6px 16px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;">关闭</button></div>';
      box.innerHTML = h;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      document.getElementById('tuopin-result-close').onclick = function () { overlay.remove(); };
      overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    }

    window.addEventListener('load', function () {
      setTimeout(function () { processQueue(); }, 2000);
    });

    return;
  }
  // ===== END SMZDM 逻辑 =====

  // ===== 补贴表单自动化逻辑 =====
  if (location.hostname === 'biaodan.bgm.smzdm.com') {
    // 拦截原生 alert/confirm（如"字段添加成功！页面即将刷新..."），自动确认
    var _noop = function() { return true; };
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

    function subsidyLog(msg) {
      console.log('[拓品补贴] ' + msg);
      var box = document.getElementById('tuopin-subsidy-log');
      if (box) { box.innerHTML += '<div>' + msg + '</div>'; box.scrollTop = box.scrollHeight; }
    }

    function createSubsidyPanel() {
      var panel = document.createElement('div');
      panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.25);padding:16px;width:340px;font-family:-apple-system,sans-serif;font-size:13px;max-height:90vh;overflow-y:auto;';
      panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<div style="font-weight:600;font-size:15px;color:#e74c3c;">补贴表单自动创建</div>' +
        '<button id="tuopin-subsidy-stop" style="padding:4px 12px;border:1px solid #ff4d4f;border-radius:4px;background:#fff;color:#ff4d4f;cursor:pointer;font-size:12px;">停止</button>' +
        '</div>' +
        '<div id="tuopin-subsidy-progress" style="color:#1890ff;margin-bottom:6px;">准备中...</div>' +
        '<div id="tuopin-subsidy-log" style="max-height:200px;overflow-y:auto;background:#f5f5f5;border-radius:4px;padding:8px;font-size:11px;line-height:1.6;color:#666;"></div>';
      document.body.appendChild(panel);
      document.getElementById('tuopin-subsidy-stop').onclick = function() {
        GM_setValue('tuopin_subsidy_queue', '[]');
        GM_setValue('tuopin_subsidy_index', 0);
        subsidyLog('已停止');
        var progressEl = document.getElementById('tuopin-subsidy-progress');
        if (progressEl) progressEl.textContent = '已停止';
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
      await sleep(1500);

      var dates = calcDates();

      // 1. 表单名称（日期+标题）
      var now = new Date();
      var datePrefix = (now.getMonth() + 1) + '.' + now.getDate();
      var nameField = document.querySelector('input[placeholder*="用于表单后台展示"]');
      if (nameField) { setInputValue(nameField, datePrefix + (item.title || '').slice(0, 20)); subsidyLog('✓ 表单名称'); }

      // 1.5 商品标题（选填）
      var goodsTitleField = document.querySelector('input[placeholder*="用于好价详情页活动规则展示"]');
      if (goodsTitleField) { setInputValue(goodsTitleField, item.title || ''); subsidyLog('✓ 商品标题'); }

      // 2. 适用终端: APP+PC+Wap
      clickRadioByText('APP+PC+Wap');

      // 3. 活动链接
      var linkField = document.querySelector('input[placeholder*="用于发站内信时的活动链接"]');
      if (linkField) setInputValue(linkField, 'https://www.smzdm.com/p/' + item.articleId + '/');

      // 4. ROI
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

      // 5. 补贴来源: 兴趣
      clickRadioByText('兴趣');
      await sleep(400); // 等兴趣部门 checkbox 出现

      // 5.5 兴趣部门: 勾选"美食部"
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

      // 6-7. 审核时间 + 活动时间
      var timeInputsStart = document.querySelectorAll('input[placeholder="开始时间"]');
      var timeInputsEnd = document.querySelectorAll('input[placeholder="结束时间"]');
      if (timeInputsStart.length >= 1) setInputValue(timeInputsStart[0], dates.startTime);
      if (timeInputsEnd.length >= 1) setInputValue(timeInputsEnd[0], dates.auditEndTime);
      if (timeInputsStart.length >= 2) setInputValue(timeInputsStart[1], dates.startTime);
      if (timeInputsEnd.length >= 2) setInputValue(timeInputsEnd[1], dates.auditEndTime);

      // 8. 名额
      var quotaField = document.querySelector('input[placeholder="填写表单名额数"]');
      if (quotaField) setInputValue(quotaField, '50');

      // 9. 商城 - custom-multiselect
      var mallVal = (item.mall || '').indexOf('京东') >= 0 ? '600233' : '600008';
      var mallTrigger = document.querySelector('.multiselect-trigger');
      if (mallTrigger) {
        mallTrigger.click();
        await sleep(200);
        var mallCb = document.querySelector('.multiselect-option input[type="checkbox"][value="' + mallVal + '"]');
        if (mallCb && !mallCb.checked) {
          var mallLbl = mallCb.closest('label');
          if (mallLbl) mallLbl.click(); else mallCb.click();
        }
        await sleep(100);
        mallTrigger.click();
        subsidyLog('✓ 商城');
      } else {
        var mallSelect = document.querySelector('select[name="mall_ids[]"]');
        if (mallSelect) { mallSelect.value = mallVal; mallSelect.dispatchEvent(new Event('change', { bubbles: true })); }
      }

      // 10. 商品编码（优先从productLink提取淘宝/京东真实商品ID）
      var skuId = '';
      if (item.productLink) { var idMatch = item.productLink.match(/[?&]id=(\d+)/); if (idMatch) skuId = idMatch[1]; }
      if (!skuId && item.gid && /^\d{10,}$/.test(item.gid)) skuId = item.gid;
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
        if (commField) setInputValue(commField, item.commissionRate + '%');
      }

      // 12. 预算渠道code
      var budgetField = document.querySelector('input[placeholder*="预算渠道Code"]');
      if (budgetField) setInputValue(budgetField, 'zyzx_meishi');

      // 13. 最低支付金额 = 到手价 - 补贴
      var minPayField = document.querySelector('input[placeholder*="满300-100"]') || document.querySelector('input[placeholder*="输入300"]');
      if (minPayField) {
        var dp = parseFloat(item.dealPrice || item.price) || 0;
        var sub = parseFloat(item.subsidy) || 0;
        var minPay = Math.floor(dp - sub);
        if (minPay < 0) minPay = 0;
        setInputValue(minPayField, String(minPay));
        subsidyLog('✓ 最低支付: ' + minPay);
      }

      // 14. 补贴积分 = 补贴金额 × 10
      var subsidyField = document.querySelector('input[placeholder*="成本单位"]');
      if (subsidyField) {
        var subsidyPoints = Math.round((parseFloat(item.subsidy) || 0) * 10);
        setInputValue(subsidyField, String(subsidyPoints));
        subsidyLog('✓ 积分: ' + subsidyPoints);
      }

      // 15. 复审时间
      var reviewField = document.querySelector('input[placeholder="复审时间"]');
      if (reviewField) setInputValue(reviewField, dates.reviewTimeStr);

      // 16. 返补贴时间
      var rewardField = null;
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
      if (rewardField) { setInputValue(rewardField, dates.rewardTimeStr); subsidyLog('✓ 返补贴时间'); }

      // 17. 邮箱 - 从GM存储读取
      var savedEmail = GM_getValue('tuopin_selected_email', '');
      if (savedEmail) {
        var emailField = document.querySelector('input[placeholder*="英文逗号隔开"]');
        if (emailField) { setInputValue(emailField, savedEmail); subsidyLog('✓ 邮箱: ' + savedEmail); }
      }
      await sleep(200);

      // 18. 活动规则 - 自动生成
      var autoGenBtns = document.querySelectorAll('button');
      var genCount = 0;
      for (var gi = 0; gi < autoGenBtns.length; gi++) {
        if ((autoGenBtns[gi].textContent || '').trim() === '自动生成') {
          genCount++;
          if (genCount === 1) { autoGenBtns[gi].click(); subsidyLog('✓ 活动规则'); break; }
        }
      }

      await sleep(300);

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

      // 20. 订单审核 - 自动生成
      genCount = 0;
      for (var gi2 = 0; gi2 < autoGenBtns.length; gi2++) {
        if ((autoGenBtns[gi2].textContent || '').trim() === '自动生成') {
          genCount++;
          if (genCount === 2) { autoGenBtns[gi2].click(); subsidyLog('✓ 订单审核'); break; }
        }
      }

      await sleep(500);

      // 21. 点击"下一步"按钮
      var nextBtn = null;
      var allBtns = document.querySelectorAll('button');
      for (var nb = 0; nb < allBtns.length; nb++) {
        if ((allBtns[nb].textContent || '').trim() === '下一步') { nextBtn = allBtns[nb]; break; }
      }
      if (nextBtn) {
        nextBtn.click();
        subsidyLog('✓ 已点击下一步，等待跳转到字段配置页...');
        // 跳转到 form_type 页后，processSubsidyQueue 会自动触发 fillSubsidyFormPage2
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

      // 点击"保存更新"按钮
      var btns3 = document.querySelectorAll('button, input[type="submit"], a');
      for (var sb = 0; sb < btns3.length; sb++) {
        var sbText = (btns3[sb].textContent || btns3[sb].value || '').trim();
        if (sbText.indexOf('保存更新') >= 0) {
          btns3[sb].click();
          subsidyLog('✓ 已点击保存更新');
          subsidyLog('--- 表单创建完成 ---');
          return;
        }
      }
      subsidyLog('✗ 未找到保存更新按钮');
    }

    async function processSubsidyQueue() {
      // 检查是否已被停止
      var currentQueue = [];
      try { currentQueue = JSON.parse(GM_getValue('tuopin_subsidy_queue', '[]')); } catch (e) {}
      if (!currentQueue || currentQueue.length === 0) return;

      createSubsidyPanel();
      var item = subsidyQueue[subsidyIdx];
      var progressEl = document.getElementById('tuopin-subsidy-progress');
      if (progressEl) progressEl.textContent = '处理 ' + (subsidyIdx + 1) + '/' + subsidyQueue.length + ': ' + (item.title || '').slice(0, 20);
      subsidyLog('文章ID: ' + item.articleId + ' 补贴: ' + item.subsidy + '元');

      // 在列表页 → 点击新建按钮
      if (location.pathname.indexOf('subsidies_list') >= 0) {
        subsidyLog('在列表页，查找新建按钮...');
        await sleep(2000);
        var btns = document.querySelectorAll('a, button, .el-button');
        var clicked = false;
        for (var i = 0; i < btns.length; i++) {
          if ((btns[i].textContent || '').indexOf('新建机审补贴购表单') >= 0) {
            btns[i].click();
            clicked = true;
            subsidyLog('✓ 已点击"新建机审补贴购表单"');
            break;
          }
        }
        if (!clicked) {
          subsidyLog('✗ 未找到"新建机审补贴购表单"按钮');
          subsidyLog('请手动点击新建按钮，脚本将在表单页自动填写');
        }
        return;
      }

      // 在表单页 → 填写表单（第一页：填标题、价格、文案等）
      if (location.pathname.indexOf('form_name') >= 0 || location.search.indexOf('type=4') >= 0) {
        await fillSubsidyForm(item);
        return;
      }

      // 在表单第二页（字段配置页）→ 执行第二页逻辑
      var isPage2 = location.pathname.indexOf('form_field') >= 0 || location.pathname.indexOf('form_type') >= 0 || location.search.indexOf('step=2') >= 0;
      if (isPage2) {
        await fillSubsidyFormPage2();
        subsidyIdx++;
        GM_setValue('tuopin_subsidy_index', subsidyIdx);
        if (subsidyIdx >= subsidyQueue.length) {
          subsidyLog('全部 ' + subsidyQueue.length + ' 个补贴表单处理完成！');
          GM_setValue('tuopin_subsidy_queue', '[]');
          GM_setValue('tuopin_subsidy_index', 0);
        } else {
          subsidyLog('还剩 ' + (subsidyQueue.length - subsidyIdx) + ' 个待处理');
          await sleep(2000);
          location.href = '/biaodan/subsidies_list_ver3';
        }
        return;
      }

      subsidyLog('当前页面非列表/表单页，等待跳转...');
    }

    if (document.readyState === 'complete') {
      processSubsidyQueue();
    } else {
      window.addEventListener('load', processSubsidyQueue);
    }
    return;
  }
  // ===== END 补贴表单逻辑 =====

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

    // 售价（只有当原价高于到手价时显示）
    var sellPrice = origPrice > dealPrice ? origPrice : priceVal > dealPrice ? priceVal : 0;
    if (sellPrice > dealPrice) {
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
    if (subsidyAmount > 0) {
      var subsidyPoints = Math.round(subsidyAmount * 10);
      var afterSubsidy = Math.round((dealPrice - subsidyAmount) * 100) / 100;
      if (afterSubsidy < 0) afterSubsidy = 0;
      parts.push('返' + subsidyPoints + '值得买积分，补贴后低至' + afterSubsidy.toFixed(2) + '元');
    }

    if (parseInt(qty) > 1) {
      var baseForUnit = subsidyAmount > 0 ? Math.round((dealPrice - subsidyAmount) * 100) / 100 : dealPrice;
      if (baseForUnit < 0) baseForUnit = 0;
      var unitPriceVal = (baseForUnit / parseInt(qty)).toFixed(2);
      parts.push('折' + unitPriceVal + '元/件');
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

    // 先删掉旧的淘礼金、补贴、折xx元/件、淘金币部分
    copy = copy.replace(/[，,]\s*淘礼金[\d.]+元/, '');
    copy = copy.replace(/[，,]\s*返\d+值得买积分[^，]*(?:，补贴后低至[\d.]+元)?/, '');
    copy = copy.replace(/[，,]?\s*折[\d.]+元\/件/g, '');
    copy = copy.replace(/[，,]\s*淘金币[已抵]*[\d.]+元/, '');
    copy = copy.replace(/[，,]\s*淘金币到手价[\d.]+元/, '');

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

    // 重新追加补贴部分
    if (subsidyAmount > 0) {
      var subsidyPoints = Math.round(subsidyAmount * 10);
      var afterSubsidy = Math.round((dealPrice - subsidyAmount) * 100) / 100;
      if (afterSubsidy < 0) afterSubsidy = 0;
      copy += '，返' + subsidyPoints + '值得买积分，补贴后低至' + afterSubsidy.toFixed(2) + '元';
      if (qty > 1) {
        copy += '，折' + (afterSubsidy / qty).toFixed(2) + '元/件';
      }
    } else if (qty > 1) {
      // 无补贴时，直接在到手价后追加折单价
      copy += '，折' + (dealPrice / qty).toFixed(2) + '元/件';
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
    var d = document.createElement('div');
    d.id = 'tuopin-detail';
    d.style.cssText = 'position:fixed;top:80px;right:225px;z-index:99998;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);padding:12px 16px;max-height:80vh;overflow-y:auto;width:560px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;';
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px;"><span style="font-weight:600;color:#333;">商品详情</span><span id="tuopin-detail-close" style="cursor:pointer;color:#999;font-size:18px;">&times;</span></div>';
    data.forEach(function (item, idx) {
      h += '<div style="padding:10px 0;' + (idx < data.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : '') + '" data-item-idx="' + idx + '">';
      var titleLink = item.productLink || item.orderLink || '';
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
      h += '<span style="color:#e74c3c;font-weight:500;display:flex;align-items:center;gap:3px;">补贴：<input class="tuopin-subsidy-input" data-idx="' + idx + '" type="text" value="' + (item.subsidy || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="0">元</span>';
      h += '<span style="color:#27ae60;font-weight:500;display:flex;align-items:center;gap:3px;">淘金币：<input class="tuopin-tjb-input" data-idx="' + idx + '" type="text" value="' + (item.manualTjb || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="0">元</span>';
      h += '<span style="color:#7c3aed;font-weight:500;display:flex;align-items:center;gap:3px;">淘礼金：<input class="tuopin-tlj-input" data-idx="' + idx + '" type="text" value="' + (item.manualTlj || '') + '" style="width:50px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="0">元</span>';
      h += '<span style="color:#1890ff;font-weight:500;display:flex;align-items:center;gap:3px;">件数：<input class="tuopin-qty-input" data-idx="' + idx + '" type="text" value="' + calcQtyDisplay(item) + '" style="width:40px;padding:2px 4px;border:1px solid #ddd;border-radius:3px;font-size:12px;" placeholder="1">件</span>';
      h += '</div>';
      var tagLine = [];
      if (item.is_88vip === '1') tagLine.push('88VIP 95折');
      if (item.taolijin && parseFloat(item.taolijin) > 0) tagLine.push('淘礼金' + item.taolijin + '元');
      if (tagLine.length > 0) h += '<div style="color:#7c3aed;">' + tagLine.join(' | ') + '</div>';
      if (item.detailPromos && item.detailPromos.length > 0) h += '<div style="color:#e67e22;">' + item.detailPromos.join('，') + '</div>';
      if (item.detailLowestPrice) {
        var tjbAmt = 0;
        if (item.detailPromos) item.detailPromos.forEach(function(p) { var m = p.match(/淘金币已抵([\d.]+)元/); if (m) tjbAmt = parseFloat(m[1]); });
        var realP = (parseFloat(item.detailLowestPrice) + tjbAmt).toFixed(2);
        h += '<div style="color:#d63031;font-weight:600;">到手价：' + realP + '元</div>';
        if (tjbAmt > 0) h += '<div style="color:#27ae60;font-weight:600;">淘金币到手价：' + item.detailLowestPrice + '元</div>';
      } else {
        var extras = [];
        if (item.taoJinBi) extras.push('淘金币 -' + item.taoJinBi + '元');
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
    t.innerHTML = '<div style="font-size:14px;font-weight:600;color:#333;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:8px;">拓品助手 <span id="tuopin-count" style="color:#ff4757;">(0)</span></div>' +
      '<button id="tb-all" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ddd;border-radius:4px;background:#f8f9fa;font-size:13px;cursor:pointer;text-align:left;">全选</button>' +
      '<button id="tb-none" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ddd;border-radius:4px;background:#f8f9fa;font-size:13px;cursor:pointer;text-align:left;">取消全选</button>' +
      '<button id="tb-get" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #ff4757;border-radius:4px;background:#ff4757;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">获取选中商品</button>' +
      '<button id="tb-view" style="display:block;width:100%;padding:6px 10px;margin-bottom:4px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">查看优惠信息</button>' +
      '<button id="tb-publish" style="display:block;width:100%;padding:6px 10px;margin-bottom:8px;border:1px solid #52c41a;border-radius:4px;background:#52c41a;color:#fff;font-size:13px;cursor:pointer;text-align:left;font-weight:500;">去发布</button>' +
      '<div style="border-top:1px solid #eee;padding-top:8px;margin-top:4px;">' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">表单邮箱</div>' +
        '<select id="tb-email-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;"><option value="">请选择邮箱</option></select>' +
        '<div style="display:flex;gap:4px;margin-bottom:8px;">' +
          '<input id="tb-email-input" type="text" placeholder="添加邮箱" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="tb-email-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#999;margin-bottom:4px;">发布账号</div>' +
        '<select id="tb-account-select" style="width:100%;padding:4px 6px;font-size:12px;border:1px solid #ddd;border-radius:4px;margin-bottom:4px;"><option value="">请选择账号</option></select>' +
        '<div style="display:flex;gap:4px;">' +
          '<input id="tb-account-input" type="text" placeholder="添加账号" style="flex:1;padding:4px 6px;font-size:11px;border:1px solid #ddd;border-radius:4px;min-width:0;">' +
          '<button id="tb-account-add" style="padding:4px 8px;font-size:11px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;cursor:pointer;white-space:nowrap;">添加</button>' +
        '</div>' +
      '</div>';
    t.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.15);padding:12px 16px;width:170px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    document.body.appendChild(t);

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
        var visibleTitleEl = card.querySelector('[class*="qlist-goods-new-style-title"], [class*="goodsNewStyleTitle"], [class*="goods-new-style-title"]');
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
        // 折后单价：补贴后价格÷件数（单件时直接用补贴后价格）
        var qty = item.qty || '';
        if (!qty) {
          var qm = item.title ? item.title.match(/(\d+)件/) : null;
          qty = qm ? qm[1] : '1';
        }
        var qtyNum = parseInt(qty) || 1;
        var afterSubsidy = subsidyAmount > 0 ? dealPrice - subsidyAmount : dealPrice;
        if (afterSubsidy < 0) afterSubsidy = 0;
        var unitPrice = qtyNum > 1 ? (afterSubsidy / qtyNum).toFixed(2) : afterSubsidy.toFixed(2);
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
          commissionRate: item.commission_rate || '',
          goodsSign: item.goodsSign || '',
          mall: item.mall || '淘宝',
          bDuan: item.bDuan || ''
        };
      });
      GM_setValue('tuopin_publish_queue', JSON.stringify(queue));
      GM_setValue('tuopin_publish_index', 0);
      GM_setValue('tuopin_publish_results', '[]');
      window.open('http://youhui.bgm.smzdm.com/add_guonei', '_blank');
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
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });

  var scrollTmr = null;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTmr);
    scrollTmr = setTimeout(function() {
      inj();
      uc();
    }, 200);
  }, true);

  function ti() {
    if (document.querySelector('.goodsLayoutGutter')) { inj(); ctb(); }
    else setTimeout(ti, 500);
  }
  ti();
})();
