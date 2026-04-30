// Report modal — visible to everyone

function openReportModal(itemId, itemName, preselect = 'missing') {
  document.getElementById('report-modal-backdrop')?.remove();

  const el = document.createElement('div');
  el.id = 'report-modal-backdrop';
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal modal--narrow">
      <div class="modal-header">
        <div class="modal-title">Report an Issue</div>
        <button class="modal-close" onclick="closeModal('report-modal-backdrop')">×</button>
      </div>
      <div class="modal-body">
        <p class="report-item-name">Item: <strong>${escHtml(itemName)}</strong></p>
        <form id="report-form" onsubmit="submitReport_form(event,${itemId})">
          <div class="report-type-toggle">
            <label class="report-type-btn${preselect==='missing'?' active':''}">
              <input type="radio" name="type" value="missing" ${preselect==='missing'?'checked':''}>
              <span>🔍 Missing</span>
            </label>
            <label class="report-type-btn${preselect==='broken'?' active':''}">
              <input type="radio" name="type" value="broken" ${preselect==='broken'?'checked':''}>
              <span>🔧 Broken / Damaged</span>
            </label>
          </div>
          <div class="form-field" style="margin-top:16px">
            <label>Additional notes <span style="color:var(--text-dim)">(optional)</span></label>
            <textarea name="note" rows="3" placeholder="Describe the issue…"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="closeModal('report-modal-backdrop')">Cancel</button>
            <button type="submit" class="btn btn-copper" id="report-submit-btn">Submit Report</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(el);

  // Make radio labels toggle active class
  el.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      el.querySelectorAll('.report-type-btn').forEach(b => b.classList.remove('active'));
      radio.closest('.report-type-btn').classList.add('active');
    });
  });
}

async function submitReport_form(e, itemId) {
  e.preventDefault();
  const form = e.target;
  const btn  = document.getElementById('report-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending…';

  const type = form.elements['type'].value;
  const note = form.elements['note'].value.trim();

  try {
    await submitReport(itemId, type, note);
    closeModal('report-modal-backdrop');
    toast(`Report submitted — thank you!`);
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false;
    btn.innerHTML = 'Submit Report';
  }
}
