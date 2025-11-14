document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.add-to-cart');

  buttons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const productId = btn.dataset.id;
      const qtyInput = document.querySelector(`#qty-${productId}`);
      const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;

      try {
        const res = await fetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ product_id: productId, qty }),
        });

        const cart = await res.json();

        const cartBtn = document.querySelector('#cart-count');
        const count = Object.keys(cart)
          .filter((k) => k !== 'coupon')
          .reduce((sum, k) => sum + cart[k], 0);
        if (cartBtn) cartBtn.textContent = `Koszyk (${count})`;
      } catch (err) {
        console.error(err);
        alert('Błąd podczas dodawania do koszyka');
      }
    });
  });
});
