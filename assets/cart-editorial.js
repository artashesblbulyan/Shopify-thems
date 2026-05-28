(function () {
  if (window.__edCartEditorialBound) return;
  window.__edCartEditorialBound = true;

  function closest(target, selector) {
    return target instanceof Element ? target.closest(selector) : null;
  }

  function endpoint(rawUrl) {
    var url = rawUrl || '/cart/change';
    return url.indexOf('.js') === -1 ? url.replace(/\/$/, '') + '.js' : url;
  }

  function showCartToast(message) {
    var toast = document.querySelector('[data-ed-cart-toast]');
    if (!toast) return;
    var text = toast.querySelector('[data-ed-cart-toast-message]');
    if (text) text.textContent = message || 'Bag updated.';
    window.clearTimeout(window.__edCartToastTimer);
    toast.classList.add('is-visible');
    window.__edCartToastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  function updateCartCount(count) {
    document.querySelectorAll('[data-ed-cart-count]').forEach(function (el) {
      el.textContent = count;
    });
  }

  function setBusy(section, busy) {
    if (!section) return;
    section.classList.toggle('is-updating', busy);
    section.dataset.edCartBusy = busy ? 'true' : 'false';
    section.querySelectorAll('[data-ed-cart-qty-button], [data-ed-cart-qty-input]').forEach(function (el) {
      el.disabled = busy;
    });
  }

  function refreshCartSection(section) {
    var note = section.querySelector('.ed-cart__note');
    var hasNote = Boolean(note);
    var noteValue = hasNote ? note.value : '';
    var sectionId = section.dataset.sectionId || 'main';
    var cartUrl = section.dataset.cartUrl || '/cart';
    var separator = cartUrl.indexOf('?') === -1 ? '?' : '&';
    var url = cartUrl + separator + 'section_id=' + encodeURIComponent(sectionId);

    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Cart section refresh failed.');
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var nextSection = doc.querySelector('[data-ed-cart-section]');
        if (!nextSection) throw new Error('Cart section not found.');

        var nextNote = nextSection.querySelector('.ed-cart__note');
        if (nextNote && hasNote) nextNote.value = noteValue;

        nextSection.classList.add('ed-section-in-view');
        nextSection.querySelectorAll('.ed-reveal, .ed-reveal-stagger').forEach(function (el) {
          el.classList.add('is-in');
        });

        section.replaceWith(nextSection);
      });
  }

  function serializePayload(payload) {
    var body = new URLSearchParams();
    Object.keys(payload).forEach(function (key) {
      body.append(key, payload[key]);
    });
    return body.toString();
  }

  function responseError(response) {
    return response.text().then(function (text) {
      var message = 'Could not update cart.';
      if (text) {
        try {
          var data = JSON.parse(text);
          message = data.description || data.message || message;
        } catch (error) {
          message = text;
        }
      }
      throw new Error(message);
    });
  }

  function postCartChange(section, payload) {
    return fetch(endpoint(section.dataset.cartChangeUrl), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: serializePayload(payload),
    }).then(function (response) {
      if (response.ok) return response.json();
      return responseError(response);
    });
  }

  function changeCartItem(section, itemKey, line, quantity) {
    var attempts = [];

    if (line) {
      attempts.push({
        line: String(line),
        quantity: String(quantity),
      });
    }

    if (itemKey) {
      attempts.push({
        id: itemKey,
        quantity: String(quantity),
      });
    }

    if (!attempts.length) return Promise.reject(new Error('Cart line was not found.'));

    return postCartChange(section, attempts[0]).catch(function (firstError) {
      if (!attempts[1]) throw firstError;
      return postCartChange(section, attempts[1]);
    });
  }

  function updateItem(section, itemKey, line, quantity, input) {
    if (!section || section.dataset.edCartBusy === 'true') return;

    var previousQuantity = input ? input.value : '';
    var nextQuantity = Math.max(0, parseInt(quantity, 10) || 0);
    if (input) input.value = nextQuantity;

    setBusy(section, true);

    changeCartItem(section, itemKey, line, nextQuantity)
      .then(function (cart) {
        updateCartCount(cart.item_count || 0);
        return refreshCartSection(section);
      })
      .then(function () {
        showCartToast('Bag updated.');
      })
      .catch(function (error) {
        if (input) input.value = previousQuantity;
        setBusy(section, false);
        showCartToast(error.message || 'Could not update cart.');
      });
  }

  function maxFor(el) {
    if (!el) return Infinity;
    if (el.dataset.edUnlimited === 'true') return Infinity;
    var max = parseInt(el.dataset.edMax, 10);
    return isNaN(max) ? Infinity : max;
  }

  document.addEventListener('click', function (event) {
    var remove = closest(event.target, '[data-ed-cart-remove]');
    if (remove) {
      var removeSection = remove.closest('[data-ed-cart-section]');
      event.preventDefault();
      updateItem(removeSection, remove.dataset.key, remove.dataset.line, 0);
      return;
    }

    var button = closest(event.target, '[data-ed-cart-qty-button]');
    if (!button) return;
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }

    var section = button.closest('[data-ed-cart-section]');
    var qty = button.closest('.ed-cart__qty');
    var input = qty && qty.querySelector('[data-ed-cart-qty-input]');
    if (!section || !input) return;

    event.preventDefault();
    var current = parseInt(input.value, 10) || 0;
    var step = parseInt(button.dataset.edCartStep, 10) || 0;
    var next = current + step;
    var max = maxFor(button);

    if (step > 0 && next > max) {
      showCartToast(max <= 0 ? 'This item is sold out.' : 'Only ' + max + ' available in stock.');
      return;
    }

    updateItem(section, button.dataset.key, button.dataset.line, next, input);
  });

  document.addEventListener('change', function (event) {
    var input = closest(event.target, '[data-ed-cart-qty-input]');
    if (!input) return;

    var section = input.closest('[data-ed-cart-section]');
    var requested = parseInt(input.value, 10) || 0;
    var max = maxFor(input);

    if (requested > max) {
      showCartToast(max <= 0 ? 'This item is sold out.' : 'Only ' + max + ' available in stock.');
      input.value = max;
      requested = max;
    }

    updateItem(section, input.dataset.key, input.dataset.line, requested, input);
  });
})();
