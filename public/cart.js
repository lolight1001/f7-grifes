// F7 Grifes — carrinho compartilhado (localStorage, funciona sem login)
(function () {
  var CART_KEY = 'f7_cart';

  // Número real do WhatsApp da loja, formato 55 + DDD + número (só dígitos).
  // Usado pelo botão flutuante e pelo botão "Finalizar no WhatsApp" da sacola.
  window.F7_WHATSAPP = '5511970999294';
  window.F7_WHATSAPP_LINK = function (text) {
    return 'https://wa.me/' + window.F7_WHATSAPP + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(arr) {
    localStorage.setItem(CART_KEY, JSON.stringify(arr));
    updateCartBadge();
  }

  function sameLine(a, productId, size) {
    return a.productId === productId && (a.size || '') === (size || '');
  }

  function addToCart(item) {
    var cart = getCart();
    var existing = cart.find(function (l) { return sameLine(l, item.productId, item.size); });
    if (existing) {
      existing.qty = Math.min(99, existing.qty + (item.qty || 1));
    } else {
      cart.push({
        productId: item.productId,
        name: item.name,
        price: item.price,
        image: item.image || '',
        category: item.category || '',
        size: item.size || '',
        qty: item.qty || 1
      });
    }
    saveCart(cart);
  }

  function setLineQty(productId, size, qty) {
    var cart = getCart();
    var line = cart.find(function (l) { return sameLine(l, productId, size); });
    if (!line) return;
    line.qty = Math.max(1, Math.min(99, qty));
    saveCart(cart);
  }

  function removeLine(productId, size) {
    var cart = getCart().filter(function (l) { return !sameLine(l, productId, size); });
    saveCart(cart);
  }

  function clearCart() {
    saveCart([]);
  }

  function cartTotalQty() {
    return getCart().reduce(function (sum, l) { return sum + l.qty; }, 0);
  }

  function cartSubtotal() {
    return getCart().reduce(function (sum, l) { return sum + l.qty * l.price; }, 0);
  }

  function updateCartBadge() {
    var el = document.getElementById('cartCount');
    if (el) el.textContent = cartTotalQty();
  }

  window.F7Cart = {
    getCart: getCart,
    addToCart: addToCart,
    setLineQty: setLineQty,
    removeLine: removeLine,
    clearCart: clearCart,
    cartTotalQty: cartTotalQty,
    cartSubtotal: cartSubtotal,
    updateCartBadge: updateCartBadge
  };

  document.addEventListener('DOMContentLoaded', updateCartBadge);
})();
