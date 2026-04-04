/* ============================================
   더에셋스퀘어 Sub-site 3 — Interactive Features
   Checklist · FAQ Accordion · Compare · Gallery
   ============================================ */

(function () {
  'use strict';

  // ── COMPARE FEATURE ──
  const MAX_COMPARE = 3;
  let compareList = JSON.parse(sessionStorage.getItem('compareList') || '[]');

  function renderComparePanel() {
    const panel = document.getElementById('comparePanel');
    if (!panel) return;

    if (compareList.length === 0) {
      panel.classList.remove('visible');
      return;
    }

    panel.classList.add('visible');

    const itemsWrap = panel.querySelector('.compare-items');
    if (itemsWrap) {
      itemsWrap.innerHTML = compareList.map(function (item, i) {
        return '<div class="compare-item">' +
          '<button class="remove" data-idx="' + i + '" aria-label="제거">×</button>' +
          '<div class="name">' + item.name + '</div>' +
          '<div class="price">' + item.price + '</div>' +
          '</div>';
      }).join('');
    }

    var countEl = panel.querySelector('.compare-count');
    if (countEl) countEl.textContent = compareList.length;

    // Update card buttons
    document.querySelectorAll('.btn-compare').forEach(function (btn) {
      var id = btn.getAttribute('data-id');
      var inList = compareList.some(function (c) { return c.id === id; });
      btn.classList.toggle('active', inList);
      btn.textContent = inList ? '비교 ✓' : '비교함 담기';
    });

    sessionStorage.setItem('compareList', JSON.stringify(compareList));
  }

  function toggleCompare(id, name, price) {
    var idx = compareList.findIndex(function (c) { return c.id === id; });
    if (idx > -1) {
      compareList.splice(idx, 1);
    } else if (compareList.length < MAX_COMPARE) {
      compareList.push({ id: id, name: name, price: price });
    }
    renderComparePanel();
  }

  // Compare button clicks
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-compare');
    if (btn) {
      e.preventDefault();
      toggleCompare(
        btn.getAttribute('data-id'),
        btn.getAttribute('data-name'),
        btn.getAttribute('data-price')
      );
    }

    // Remove from compare
    var removeBtn = e.target.closest('.compare-item .remove');
    if (removeBtn) {
      var idx = parseInt(removeBtn.getAttribute('data-idx'), 10);
      compareList.splice(idx, 1);
      renderComparePanel();
    }

    // Close compare panel
    var closeBtn = e.target.closest('.compare-close');
    if (closeBtn) {
      compareList = [];
      renderComparePanel();
    }

    // Compare go button
    var goBtn = e.target.closest('.btn-compare-go');
    if (goBtn && compareList.length >= 2) {
      showCompareTable();
    }
  });

  function showCompareTable() {
    var existing = document.getElementById('compareTableModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'compareTableModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem;';

    var rows = [
      { label: '현장명', key: 'name' },
      { label: '분양가', key: 'price' },
      { label: '위치', key: 'location' },
      { label: '타입', key: 'type' },
      { label: '입주예정', key: 'moveIn' }
    ];

    var headerCols = compareList.map(function (c) { return '<th>' + c.name + '</th>'; }).join('');
    var bodyRows = rows.map(function (row) {
      var cells = compareList.map(function (c) { return '<td>' + (c[row.key] || '-') + '</td>'; }).join('');
      return '<tr><th>' + row.label + '</th>' + cells + '</tr>';
    }).join('');

    modal.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:700px;width:100%;max-height:80vh;overflow:auto;padding:1.5rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
      '<h3 style="font-size:1.125rem;font-weight:800;">분양 비교</h3>' +
      '<button onclick="this.closest(\'#compareTableModal\').remove()" style="min-height:44px;min-width:44px;background:#f1f3f5;border:none;border-radius:50%;font-size:1.25rem;cursor:pointer;">×</button>' +
      '</div>' +
      '<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th></th>' + headerCols + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>' +
      '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });
  }

  // ── FAQ ACCORDION ──
  document.addEventListener('click', function (e) {
    var question = e.target.closest('.faq-question');
    if (!question) return;

    var item = question.closest('.faq-item');
    var wasOpen = item.classList.contains('open');

    // Close all in same list
    var list = item.closest('.faq-list');
    if (list) {
      list.querySelectorAll('.faq-item.open').forEach(function (el) {
        el.classList.remove('open');
      });
    }

    if (!wasOpen) item.classList.add('open');
  });

  // ── CHECKLIST ──
  function initChecklists() {
    document.querySelectorAll('.checklist').forEach(function (cl) {
      var id = cl.getAttribute('data-checklist-id') || 'default';
      var saved = JSON.parse(sessionStorage.getItem('checklist_' + id) || '[]');

      cl.querySelectorAll('.checklist-item').forEach(function (item, i) {
        if (saved.indexOf(i) > -1) item.classList.add('checked');

        item.addEventListener('click', function () {
          item.classList.toggle('checked');
          updateChecklistProgress(cl, id);
        });
      });

      updateChecklistProgress(cl, id);
    });
  }

  function updateChecklistProgress(cl, id) {
    var items = cl.querySelectorAll('.checklist-item');
    var checked = cl.querySelectorAll('.checklist-item.checked');
    var pct = items.length ? Math.round((checked.length / items.length) * 100) : 0;

    var bar = cl.querySelector('.checklist-progress-bar');
    if (bar) bar.style.width = pct + '%';

    var indices = [];
    items.forEach(function (item, i) {
      if (item.classList.contains('checked')) indices.push(i);
    });
    sessionStorage.setItem('checklist_' + id, JSON.stringify(indices));
  }

  // ── FLOOR PLAN GALLERY ──
  function initGalleries() {
    document.querySelectorAll('.floorplan-gallery').forEach(function (gallery) {
      var track = gallery.querySelector('.floorplan-track');
      var slides = gallery.querySelectorAll('.floorplan-slide');
      var prevBtn = gallery.querySelector('.floorplan-prev');
      var nextBtn = gallery.querySelector('.floorplan-next');
      var dots = gallery.querySelectorAll('.floorplan-dot');
      var current = 0;
      var total = slides.length;

      if (total === 0) return;

      // Touch swipe
      var startX = 0;
      var diffX = 0;

      track.addEventListener('touchstart', function (e) {
        startX = e.touches[0].clientX;
      }, { passive: true });

      track.addEventListener('touchmove', function (e) {
        diffX = e.touches[0].clientX - startX;
      }, { passive: true });

      track.addEventListener('touchend', function () {
        if (Math.abs(diffX) > 50) {
          if (diffX < 0 && current < total - 1) current++;
          else if (diffX > 0 && current > 0) current--;
          goTo(current);
        }
        diffX = 0;
      });

      function goTo(idx) {
        current = idx;
        track.style.transform = 'translateX(-' + (current * 100) + '%)';
        dots.forEach(function (d, i) {
          d.classList.toggle('active', i === current);
        });
        if (prevBtn) prevBtn.disabled = current === 0;
        if (nextBtn) nextBtn.disabled = current === total - 1;
      }

      if (prevBtn) prevBtn.addEventListener('click', function () {
        if (current > 0) goTo(current - 1);
      });
      if (nextBtn) nextBtn.addEventListener('click', function () {
        if (current < total - 1) goTo(current + 1);
      });

      goTo(0);
    });
  }

  // ── SMOOTH SCROLL ──
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (link) {
      var target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // ── INIT ──
  function init() {
    renderComparePanel();
    initChecklists();
    initGalleries();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
