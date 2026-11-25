document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Sidebar Drawer & Backdrop
    const topbar = document.querySelector('.topbar');
    if (topbar && document.querySelector('.sidebar')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'mobile-nav-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
        toggleBtn.innerHTML = '☰';

        const backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';

        topbar.prepend(toggleBtn);
        document.body.appendChild(backdrop);

        const closeDrawer = () => document.body.classList.remove('sidebar-open');
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
        backdrop.addEventListener('click', closeDrawer);
    }

    // 2. Quick-Amount Chips on Dashboard Buy Form
    const priceInput = document.getElementById('price');
    if (priceInput && priceInput.parentElement) {
        const presets = [10000, 15000, 25000, 50000];
        const chipWrap = document.createElement('div');
        chipWrap.className = 'quick-price-chips';

        presets.forEach((amount) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quick-chip';
            btn.textContent = `Rp ${amount.toLocaleString('id-ID')}`;
            btn.addEventListener('click', () => {
                priceInput.value = String(amount);
                priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                priceInput.focus();
            });
            chipWrap.appendChild(btn);
        });

        priceInput.parentElement.appendChild(chipWrap);
    }

    // 3. Live Spend-Ratio Bar on Spendable Balance Card
    const spendableCard = document.querySelector('.card.spendable');
    const spendableEl = document.getElementById('spendableBalance');
    const safeEl = document.getElementById('safeToSpendToday');

    if (spendableCard && spendableEl && safeEl) {
        const bar = document.createElement('div');
        bar.className = 'budget-health-bar';
        const fill = document.createElement('div');
        fill.className = 'budget-health-fill';
        fill.style.width = '100%';
        bar.appendChild(fill);
        spendableCard.appendChild(bar);

        const parseRp = (text) => Number(String(text).replace(/[^0-9-]/g, '')) || 0;
        const syncBar = () => {
            const spendable = parseRp(spendableEl.textContent);
            const safeDaily = parseRp(safeEl.textContent);
            if (spendable <= 0) {
                fill.style.width = '6%';
                return;
            }
            const ratio = safeDaily > 0 ? Math.min(100, Math.max(12, Math.round((safeDaily * 30 / spendable) * 100))) : 75;
            fill.style.width = `${ratio}%`;
        };

        const observer = new MutationObserver(syncBar);
        observer.observe(spendableEl, { childList: true, characterData: true, subtree: true });
        observer.observe(safeEl, { childList: true, characterData: true, subtree: true });
        syncBar();
    }
});