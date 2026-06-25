/* ailc · лендинг · интерактив без зависимостей */
(function () {
  'use strict';

  /* ── матрица конфигов: редактор × способ доставки ───────────────────── */
  var IMAGE = 'ghcr.io/pro-deploy/ailc';

  function serverEntry(delivery, withType) {
    var entry = {};
    if (withType) entry.type = 'stdio';
    if (delivery === 'npx') {
      entry.command = 'npx';
      entry.args = ['-y', 'ailc-mcp'];
    } else {
      entry.command = 'docker';
      entry.args = ['run', '-i', '--rm', '-v', '${workspaceFolder}:/work', '-w', '/work', IMAGE, 'serve'];
    }
    return entry;
  }

  function configFor(editor, delivery) {
    var withType = editor === 'vscode';
    var rootKey = withType ? 'servers' : 'mcpServers';
    var obj = {};
    obj[rootKey] = { ailc: serverEntry(delivery, withType) };
    return JSON.stringify(obj, null, 2);
  }

  var EDITORS = {
    claude: { file: '.mcp.json' },
    cursor: { file: '~/.cursor/mcp.json' },
    vscode: { file: 'MCP: Open User Configuration' },
    cline:  { file: 'cline_mcp_settings.json' }
  };

  function hintFor(editor, delivery) {
    var parts = [];
    if (editor === 'claude') parts.push('Файл <b>.mcp.json</b> в корне проекта.');
    if (editor === 'cursor') parts.push('Файл <b>~/.cursor/mcp.json</b>.');
    if (editor === 'vscode') parts.push('Палитра команд, <b>MCP: Open User Configuration</b>. Раздел <b>servers</b>, поле <b>type: stdio</b> обязательно.');
    if (editor === 'cline') parts.push('Иконка <b>MCP Servers</b> в Cline, затем <b>Configure</b>.');

    if (delivery === 'npx') {
      parts.push('Файл скачается сам. Нужен Node.js 16 или новее.');
    } else {
      parts.push('Образ скачается сам. Нужен Docker.');
      if (editor === 'claude' || editor === 'cursor') {
        parts.push('Вместо <b>${workspaceFolder}</b> впишите путь к папке проекта.');
      }
    }
    return parts.join(' ');
  }

  /* ── подсветка JSON ─────────────────────────────────────────────────── */
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function highlight(json) {
    var h = escapeHtml(json);
    h = h.replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, function (m, str, colon) {
      if (colon) {
        return '<span class="tok-key">' + str + '</span><span class="tok-punc">' + colon + '</span>';
      }
      return '<span class="tok-str">' + str + '</span>';
    });
    h = h.replace(/([{}\[\],])/g, '<span class="tok-punc">$1</span>');
    return h;
  }

  /* ── состояние и отрисовка ──────────────────────────────────────────── */
  var state = { editor: 'claude', delivery: 'npx' };

  var codeText = document.querySelector('[data-codetext]');
  var fileEl = document.querySelector('[data-file]');
  var hintEl = document.querySelector('[data-hint]');
  var copyBtn = document.querySelector('[data-copy]');
  var copyLabel = document.querySelector('[data-copylabel]');

  function render() {
    var cfg = configFor(state.editor, state.delivery);
    if (codeText) codeText.innerHTML = highlight(cfg);
    if (fileEl) fileEl.textContent = EDITORS[state.editor].file;
    if (hintEl) hintEl.innerHTML = hintFor(state.editor, state.delivery);
    if (copyBtn) {
      copyBtn.dataset.raw = cfg;
      copyBtn.classList.remove('is-done');
      if (copyLabel) copyLabel.textContent = 'Копировать';
    }
  }

  document.querySelectorAll('[data-editor]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.editor = btn.dataset.editor;
      setActive('[data-editor]', btn);
      render();
    });
  });
  document.querySelectorAll('[data-delivery]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.delivery = btn.dataset.delivery;
      setActive('[data-delivery]', btn);
      render();
    });
  });

  function setActive(selector, active) {
    document.querySelectorAll(selector).forEach(function (b) {
      var on = b === active;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  /* ── копирование ────────────────────────────────────────────────────── */
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var raw = copyBtn.dataset.raw || '';
      var done = function () {
        copyBtn.classList.add('is-done');
        if (copyLabel) copyLabel.textContent = 'Скопировано';
        setTimeout(function () {
          copyBtn.classList.remove('is-done');
          if (copyLabel) copyLabel.textContent = 'Копировать';
        }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(raw).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = raw;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* no-op */ }
        document.body.removeChild(ta);
      }
    });
  }

  render();

  /* ── проявление при прокрутке ───────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reveals.length === 0) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ── липкая кнопка на мобильном показывается после прокрутки мимо героя ── */
  var sticky = document.querySelector('.sticky-cta');
  if (sticky) {
    var toggleSticky = function () {
      if (window.scrollY > 760) { sticky.classList.add('show'); }
      else { sticky.classList.remove('show'); }
    };
    window.addEventListener('scroll', toggleSticky, { passive: true });
    toggleSticky();
  }

  /* ── балл в герое плавно набирается, как стрелка прибора ──────────────── */
  var scoreEl = document.querySelector('.verdict:not(.verdict--demo) .verdict__score');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (scoreEl && !reduce) {
    var node = scoreEl.firstChild; // текстовый узел с числом, дальше span «/100»
    if (node && node.nodeType === 3) {
      var target = parseInt(node.textContent, 10);
      if (target) {
        var dur = 1100, start = null;
        node.textContent = '0';
        var tick = function (ts) {
          if (start === null) start = ts;
          var p = Math.min(1, (ts - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          node.textContent = String(Math.round(eased * target));
          if (p < 1) { requestAnimationFrame(tick); } else { node.textContent = String(target); }
        };
        requestAnimationFrame(tick);
      }
    }
  }
})();
